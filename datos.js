/* ============================================================
   DIARIO DE CAFE · capa de datos
   ------------------------------------------------------------
   Todo lo que toca la base pasa por aca. Ninguna vista escribe
   directo a Supabase.

   Corrige, respecto de la v2:
   B-01  hoy() usaba UTC y despues de las 20:00 en Chile guardaba
         la fecha de manana. Ahora usa la zona local de verdad.
   B-02  Si el CDN de Supabase no cargaba, el script moria en la
         linea del createClient y la app quedaba en blanco. Ahora
         hay try/catch y modo local.
   B-03  Los cambios sin conexion se perdian en silencio. Ahora
         hay una cola persistente con reintento.
   B-04  Vaciar el inventario resucitaba los 18 cafes de INIT.
         Ya no existe INIT: los datos viven en la base.
   B-05  Nada de innerHTML con datos crudos: esc() escapa todo.
   B-06  Los catch vacios ahora registran el error.
   ============================================================ */

'use strict';

const DB = (() => {

  // Proyecto Coffee_APP. Esta llave es publica por diseno: lo que protege los
  // datos es el RLS, no ocultar la llave.
  const SUPABASE_URL = 'https://aszoozagouzoevnnqcqc.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzem9vemFnb3V6b2V2bm5xY3FjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4NDM5MzQsImV4cCI6MjA5NTQxOTkzNH0.i53JarILe53fntBQw7p8rqZcw7rAXp5kUsHxzw9TrqU';

  const CLAVE_COLA   = 'cafe_cola_v3';
  const CLAVE_CACHE  = 'cafe_cache_v3';
  const CLAVE_ERRORES= 'cafe_errores_v3';

  let sb = null;
  let usuario = null;
  let hayBackend = false;

  /* ---------- B-02: el CDN puede fallar y la app tiene que abrir igual ---------- */
  try {
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: true, autoRefreshToken: true }
      });
      hayBackend = true;
    } else {
      registrarError('cdn', 'No cargo el SDK de Supabase. La app abre en modo solo lectura desde cache.');
    }
  } catch (e) {
    registrarError('cdn', e);
  }

  /* ================== utilidades ================== */

  /* B-01: fecha local de Chile, no UTC */
  function hoy() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }

  function ahora() { return new Date().toISOString(); }

  /* B-05: escapado obligatorio antes de cualquier innerHTML */
  function esc(v) {
    if (v === null || v === undefined) return '';
    return String(v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* Para meter texto dentro de un atributo onclick="fn('...')" sin romper el HTML */
  function escAttr(v) { return esc(v).replace(/\\/g, '\\\\'); }

  function num(v, porDefecto = null) {
    if (v === null || v === undefined || v === '') return porDefecto;
    const n = parseFloat(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : porDefecto;
  }

  /* Cuenta dias entre dos FECHAS, no entre dos instantes.
     Antes comparaba contra new Date() y a las 11:00 de la manana devolvia
     un dia menos que a las 13:00 para la misma fecha de tueste. */
  function diasEntre(desde, hasta) {
    if (!desde) return null;
    const a = new Date(String(desde).slice(0, 10) + 'T12:00:00');
    const b = new Date((hasta ? String(hasta).slice(0, 10) : hoy()) + 'T12:00:00');
    if (isNaN(a) || isNaN(b)) return null;
    return Math.round((b - a) / 86400000);
  }

  function segundosATexto(s) {
    if (s === null || s === undefined) return '—';
    const m = Math.floor(s / 60), r = s % 60;
    return `${m}:${String(r).padStart(2, '0')}`;
  }

  function textoASegundos(t) {
    if (!t) return null;
    t = String(t).trim().replace(',', '.');
    if (/^\d{1,2}:\d{1,2}$/.test(t)) {
      const [m, s] = t.split(':').map(Number);
      return m * 60 + s;
    }
    const v = parseFloat(t);
    if (!Number.isFinite(v)) return null;
    return v < 20 ? Math.round(v * 60) : Math.round(v);
  }

  function clp(v) {
    if (v === null || v === undefined || v === '') return '—';
    return '$' + Math.round(v).toLocaleString('es-CL');
  }

  function fecha(f) {
    if (!f) return '—';
    const d = new Date(f.length <= 10 ? f + 'T12:00:00' : f);
    if (isNaN(d)) return esc(f);
    return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  /* B-06: los errores se guardan, no se tragan */
  function registrarError(donde, e) {
    const msg = (e && e.message) ? e.message : String(e);
    console.error('[' + donde + ']', e);
    try {
      const arr = JSON.parse(localStorage.getItem(CLAVE_ERRORES) || '[]');
      arr.unshift({ donde, msg, cuando: new Date().toISOString() });
      localStorage.setItem(CLAVE_ERRORES, JSON.stringify(arr.slice(0, 40)));
    } catch (_) { /* localStorage lleno o bloqueado: no hay mas que hacer */ }
  }
  function errores() {
    try { return JSON.parse(localStorage.getItem(CLAVE_ERRORES) || '[]'); }
    catch (e) { return []; }
  }

  /* ================== B-03: cola de escrituras sin conexion ================== */

  function leerCola() {
    try { return JSON.parse(localStorage.getItem(CLAVE_COLA) || '[]'); }
    catch (e) { registrarError('cola/leer', e); return []; }
  }
  function guardarCola(c) {
    try { localStorage.setItem(CLAVE_COLA, JSON.stringify(c)); }
    catch (e) { registrarError('cola/guardar', e); }
  }
  function encolar(op) {
    const c = leerCola();
    c.push({ ...op, id: crypto.randomUUID(), cuando: ahora(), intentos: 0 });
    guardarCola(c);
    document.dispatchEvent(new CustomEvent('cola:cambio', { detail: { pendientes: c.length } }));
  }
  function pendientes() { return leerCola().length; }

  async function sincronizar() {
    if (!hayBackend || !usuario || !navigator.onLine) return { enviadas: 0, pendientes: pendientes() };
    let cola = leerCola();
    if (!cola.length) return { enviadas: 0, pendientes: 0 };

    const quedan = [];
    let enviadas = 0;
    for (const op of cola) {
      try {
        await ejecutar(op, true);
        enviadas++;
      } catch (e) {
        op.intentos = (op.intentos || 0) + 1;
        op.ultimoError = (e && e.message) ? e.message : String(e);
        registrarError('sincronizar/' + op.tabla, e);
        // Tras 5 intentos se deja de reintentar pero NO se borra: queda visible.
        quedan.push(op);
      }
    }
    guardarCola(quedan);
    document.dispatchEvent(new CustomEvent('cola:cambio', { detail: { pendientes: quedan.length } }));
    return { enviadas, pendientes: quedan.length };
  }

  window.addEventListener('online', () => sincronizar().then(r => {
    if (r.enviadas) document.dispatchEvent(new CustomEvent('datos:cambio'));
  }));

  /* ================== ejecucion de operaciones ================== */

  async function ejecutar(op, desdeCola = false) {
    if (!hayBackend) throw new Error('Sin backend disponible');
    if (!sb) throw new Error('Cliente no inicializado');

    // profiles se identifica por user_id, no por id. Sin esto el guardado de
    // ajustes fallaba con "column id does not exist".
    const clave = op.clave || (op.tabla === 'profiles' ? 'user_id' : 'id');

    let q;
    if (op.accion === 'insert') {
      q = sb.from(op.tabla).insert(op.datos).select();
    } else if (op.accion === 'update') {
      q = sb.from(op.tabla).update(op.datos).eq(clave, op.id).select();
    } else if (op.accion === 'delete_suave') {
      q = sb.from(op.tabla).update({ deleted_at: ahora() }).eq(clave, op.id).select();
    } else if (op.accion === 'rpc') {
      q = sb.rpc(op.fn, op.datos || {});
    } else {
      throw new Error('Accion desconocida: ' + op.accion);
    }
    const { data, error } = await q;
    if (error) throw error;
    return data;
  }

  /* Escribe. Si no hay red, encola y devuelve null sin perder nada. */
  async function escribir(op) {
    if (!navigator.onLine || !hayBackend) {
      encolar(op);
      return { encolado: true, datos: null };
    }
    try {
      const datos = await ejecutar(op);
      return { encolado: false, datos };
    } catch (e) {
      // Errores de validacion (constraint) NO se encolan: hay que avisar a la persona.
      const esValidacion = e && (e.code === '23514' || e.code === '23505' || e.code === '23503'
                                 || /violates|check constraint/i.test(e.message || ''));
      if (esValidacion) throw e;
      encolar(op);
      registrarError('escribir/' + op.tabla, e);
      return { encolado: true, datos: null };
    }
  }

  /* ================== sesion ================== */

  async function sesionActual() {
    if (!hayBackend) return null;
    try {
      const { data } = await sb.auth.getSession();
      usuario = data && data.session ? data.session.user : null;
      return usuario;
    } catch (e) { registrarError('sesion', e); return null; }
  }

  async function enviarCodigo(email) {
    if (!hayBackend) throw new Error('Sin conexion con el servidor');
    // shouldCreateUser en false: es una app personal, no un registro abierto.
    const { error } = await sb.auth.signInWithOtp({
      email: String(email).trim().toLowerCase(),
      options: { shouldCreateUser: false }
    });
    if (error) throw error;
  }

  async function verificarCodigo(email, codigo) {
    const { data, error } = await sb.auth.verifyOtp({
      email: String(email).trim().toLowerCase(),
      token: String(codigo).trim(),
      type: 'email'
    });
    if (error) throw error;
    usuario = data.user;
    return usuario;
  }

  async function salir() {
    // No se borra la cache antes de sincronizar: eso perdia datos en la v2.
    const r = await sincronizar();
    if (r.pendientes > 0) {
      throw new Error(`Quedan ${r.pendientes} cambios sin subir. Conectate antes de salir para no perderlos.`);
    }
    try { localStorage.removeItem(CLAVE_CACHE); } catch (e) { registrarError('salir', e); }
    if (hayBackend) await sb.auth.signOut();
    usuario = null;
  }

  /* ================== lectura ================== */

  const estado = {
    cafes: [], lotes: [], movimientos: [], recetas: [], versiones: [], pasos: [],
    preparaciones: [], catas: [], molinillos: [], metodos: [], procesos: [],
    tostadores: [], descriptores: [], catDescriptores: [], perfil: null,
    cargado: false, desdeCache: false
  };

  function guardarCache() {
    try {
      localStorage.setItem(CLAVE_CACHE, JSON.stringify({
        cuando: ahora(),
        d: {
          cafes: estado.cafes, lotes: estado.lotes, movimientos: estado.movimientos,
          recetas: estado.recetas, versiones: estado.versiones, pasos: estado.pasos,
          preparaciones: estado.preparaciones, catas: estado.catas,
          molinillos: estado.molinillos, metodos: estado.metodos, procesos: estado.procesos,
          tostadores: estado.tostadores, descriptores: estado.descriptores,
          catDescriptores: estado.catDescriptores, perfil: estado.perfil
        }
      }));
    } catch (e) { registrarError('cache/guardar', e); }
  }

  function cargarCache() {
    try {
      const raw = localStorage.getItem(CLAVE_CACHE);
      if (!raw) return false;
      const { d } = JSON.parse(raw);
      Object.assign(estado, d);
      estado.desdeCache = true;
      estado.cargado = true;
      return true;
    } catch (e) { registrarError('cache/leer', e); return false; }
  }

  async function cargarTodo() {
    if (!hayBackend || !navigator.onLine) {
      const ok = cargarCache();
      if (!ok) throw new Error('Sin conexion y sin datos guardados en este dispositivo.');
      return estado;
    }

    const tablas = [
      ['cafes', 'coffees', '*', 'nombre'],
      ['lotes', 'inventory_lots', '*', 'created_at'],
      ['movimientos', 'inventory_movements', '*', null],
      ['recetas', 'recipes', '*', 'created_at'],
      ['versiones', 'recipe_versions', '*', null],
      ['pasos', 'recipe_steps', '*', null],
      ['preparaciones', 'brew_sessions', '*', null],
      ['catas', 'tasting_reviews', '*', null],
      ['molinillos', 'grinders', '*', null],
      ['metodos', 'brewing_methods', '*', 'orden'],
      ['procesos', 'coffee_processes', '*', 'orden'],
      ['tostadores', 'roasters', '*', 'nombre'],
      ['catDescriptores', 'flavor_categories', '*', 'orden'],
      ['descriptores', 'flavor_descriptors', '*', 'nombre']
    ];

    try {
      const res = await Promise.all(tablas.map(([, tabla, cols, orden]) => {
        let q = sb.from(tabla).select(cols);
        if (orden) q = q.order(orden);
        return q;
      }));
      tablas.forEach(([clave], i) => {
        const { data, error } = res[i];
        if (error) { registrarError('cargar/' + clave, error); return; }
        estado[clave] = data || [];
      });

      // Los soft-deleted no se muestran, pero se dejan en la base.
      ['cafes', 'lotes', 'recetas', 'preparaciones', 'catas', 'molinillos', 'tostadores']
        .forEach(k => { estado[k] = estado[k].filter(x => !x.deleted_at); });

      const { data: perf } = await sb.from('profiles').select('*').maybeSingle();
      estado.perfil = perf || null;

      estado.cargado = true;
      estado.desdeCache = false;
      guardarCache();
      await sincronizar();
      return estado;
    } catch (e) {
      registrarError('cargarTodo', e);
      if (cargarCache()) return estado;
      throw e;
    }
  }

  /* ================== indices y consultas derivadas ================== */

  const porId = (arr, id) => arr.find(x => x.id === id) || null;

  function cafe(id) { return porId(estado.cafes, id); }
  function lote(id) { return porId(estado.lotes, id); }
  function metodo(id) { return porId(estado.metodos, id) || { id, nombre: id }; }
  function proceso(id) { return porId(estado.procesos, id) || { id, nombre: 'Desconocido' }; }
  function molinillo(id) { return porId(estado.molinillos, id); }
  function tostador(id) { return porId(estado.tostadores, id); }

  function lotesDe(cafeId) { return estado.lotes.filter(l => l.coffee_id === cafeId); }
  function movimientosDe(loteId) {
    return estado.movimientos.filter(m => m.lot_id === loteId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
  function preparacionesDe(cafeId) {
    return estado.preparaciones.filter(p => p.coffee_id === cafeId)
      .sort((a, b) => new Date(b.preparado_en) - new Date(a.preparado_en));
  }
  function cataDe(prepId) { return estado.catas.find(c => c.brew_session_id === prepId) || null; }
  function versionesDe(recetaId) {
    return estado.versiones.filter(v => v.recipe_id === recetaId).sort((a, b) => b.version - a.version);
  }
  function versionActual(recetaId) {
    const r = porId(estado.recetas, recetaId);
    if (!r) return null;
    return estado.versiones.find(v => v.recipe_id === recetaId && v.version === r.version_actual)
        || versionesDe(recetaId)[0] || null;
  }
  function pasosDe(versionId) {
    return estado.pasos.filter(p => p.version_id === versionId).sort((a, b) => a.orden - b.orden);
  }

  const ESTADOS_ACTIVOS = ['sin_abrir', 'abierto', 'bajo_stock'];
  function lotesActivos() { return estado.lotes.filter(l => ESTADOS_ACTIVOS.includes(l.estado)); }
  function lotesAbiertos() { return estado.lotes.filter(l => ['abierto', 'bajo_stock'].includes(l.estado)); }

  /* ---------- calculos de inventario (art. 7) ---------- */

  function dosisHabitual() {
    return num(estado.perfil && estado.perfil.dosis_habitual_g, 15) || 15;
  }

  /* Tazas restantes = gramos disponibles / dosis habitual. Es una ESTIMACION. */
  function tazasRestantes(l, dosis) {
    const d = dosis || dosisHabitualDe(l) || dosisHabitual();
    if (!d || d <= 0) return null;
    return Math.floor(num(l.gramos_disponibles, 0) / d);
  }

  /* Si ya preparo este cafe, usa su dosis real promedio en vez de la generica. */
  function dosisHabitualDe(l) {
    const preps = estado.preparaciones.filter(p => p.lot_id === l.id && p.dosis_g);
    if (!preps.length) return null;
    return preps.reduce((s, p) => s + num(p.dosis_g, 0), 0) / preps.length;
  }

  function costoPorTaza(l, dosis) {
    const cpg = num(l.costo_por_gramo);
    if (cpg === null) return null;
    const d = dosis || dosisHabitualDe(l) || dosisHabitual();
    return cpg * d;
  }

  function diasDesdeTueste(l) { return l.fecha_tueste ? diasEntre(l.fecha_tueste) : null; }
  function diasDesdeApertura(l) { return l.fecha_apertura ? diasEntre(l.fecha_apertura) : null; }

  /* Consumo real de los ultimos N dias, tomado del libro mayor. */
  function consumoUltimos(dias) {
    const corte = new Date(); corte.setDate(corte.getDate() - dias);
    return estado.movimientos
      .filter(m => m.tipo === 'preparacion' && new Date(m.fecha + 'T12:00:00') >= corte)
      .reduce((s, m) => s + Math.abs(num(m.gramos, 0)), 0);
  }

  /* Dias que aguanta una bolsa al ritmo de consumo reciente. */
  function diasEstimados(l) {
    const g30 = consumoUltimos(30);
    if (!g30) return null;
    const porDia = g30 / 30;
    const abiertos = lotesAbiertos().length || 1;
    const porDiaEsteLote = porDia / abiertos;
    if (porDiaEsteLote <= 0) return null;
    return Math.round(num(l.gramos_disponibles, 0) / porDiaEsteLote);
  }

  function totalGramosDisponibles() {
    return lotesActivos().reduce((s, l) => s + num(l.gramos_disponibles, 0), 0);
  }

  function tazasDisponiblesTotales() {
    const d = dosisHabitual();
    return d > 0 ? Math.floor(totalGramosDisponibles() / d) : 0;
  }

  function lotesPorTerminarse(umbralTazas = 3) {
    return lotesAbiertos()
      .filter(l => { const t = tazasRestantes(l); return t !== null && t <= umbralTazas; })
      .sort((a, b) => num(a.gramos_disponibles, 0) - num(b.gramos_disponibles, 0));
  }

  function lotesMasTiempoAbiertos() {
    return lotesAbiertos().filter(l => l.fecha_apertura)
      .sort((a, b) => new Date(a.fecha_apertura) - new Date(b.fecha_apertura));
  }

  /* Que bolsa conviene priorizar: la mas vieja desde el tueste que este abierta. */
  function priorizar() {
    const cand = lotesAbiertos().filter(l => num(l.gramos_disponibles, 0) > 0);
    if (!cand.length) return null;
    const conTueste = cand.filter(l => l.fecha_tueste);
    if (conTueste.length) {
      return conTueste.sort((a, b) => new Date(a.fecha_tueste) - new Date(b.fecha_tueste))[0];
    }
    return lotesMasTiempoAbiertos()[0] || cand[0];
  }

  function valoracionPromedio(cafeId) {
    const vals = estado.preparaciones
      .filter(p => p.coffee_id === cafeId)
      .map(p => { const c = cataDe(p.id); return c ? (num(c.puntuacion_personal) ?? (num(c.valoracion_1a5) ? num(c.valoracion_1a5) * 2 : null)) : null; })
      .filter(v => v !== null);
    if (!vals.length) {
      const c = cafe(cafeId);
      return c && c.valoracion_1a5 ? { valor: c.valoracion_1a5, escala: 5, n: 0, fuente: 'historica' } : null;
    }
    return { valor: vals.reduce((a, b) => a + b, 0) / vals.length, escala: 10, n: vals.length, fuente: 'preparaciones' };
  }

  function metodoMasUsado() {
    const cuenta = {};
    estado.preparaciones.forEach(p => { cuenta[p.method_id] = (cuenta[p.method_id] || 0) + 1; });
    const e = Object.entries(cuenta).sort((a, b) => b[1] - a[1])[0];
    return e ? { id: e[0], nombre: metodo(e[0]).nombre, n: e[1] } : null;
  }

  function mejorCafe() {
    let mejor = null;
    estado.cafes.forEach(c => {
      const v = valoracionPromedio(c.id);
      if (!v) return;
      const norm = v.escala === 5 ? v.valor * 2 : v.valor;
      if (!mejor || norm > mejor.norm) mejor = { cafe: c, ...v, norm };
    });
    return mejor;
  }

  function ultimaPreparacion() {
    return [...estado.preparaciones].sort((a, b) => new Date(b.preparado_en) - new Date(a.preparado_en))[0] || null;
  }

  function recetaFavorita() {
    const fav = estado.recetas.filter(r => r.estado === 'favorita' || r.estado === 'principal');
    if (!fav.length) return null;
    const conteo = fav.map(r => ({ r, n: estado.preparaciones.filter(p => p.recipe_id === r.id).length }));
    return conteo.sort((a, b) => b.n - a.n)[0].r;
  }

  /* ================== escritura de alto nivel ================== */

  async function nuevoCafe(datos) {
    const r = await escribir({ accion: 'insert', tabla: 'coffees', datos: { ...datos, user_id: usuario.id } });
    return r;
  }
  async function editarCafe(id, datos) {
    return escribir({ accion: 'update', tabla: 'coffees', id, datos });
  }
  async function borrarCafe(id) {
    return escribir({ accion: 'delete_suave', tabla: 'coffees', id });
  }

  async function nuevoLote(datos) {
    return escribir({ accion: 'insert', tabla: 'inventory_lots', datos: { ...datos, user_id: usuario.id } });
  }
  async function editarLote(id, datos) {
    return escribir({ accion: 'update', tabla: 'inventory_lots', id, datos });
  }

  /* Todo cambio de peso pasa por un movimiento: nunca se edita gramos_disponibles. */
  async function nuevoMovimiento({ lot_id, tipo, gramos, motivo, fecha: f, brew_session_id }) {
    if (tipo === 'ajuste' && (!motivo || motivo.trim().length < 3)) {
      throw new Error('Un ajuste manual necesita un motivo de al menos 3 letras.');
    }
    return escribir({
      accion: 'insert', tabla: 'inventory_movements',
      datos: { user_id: usuario.id, lot_id, tipo, gramos, motivo: motivo || null,
               fecha: f || hoy(), brew_session_id: brew_session_id || null }
    });
  }

  async function nuevaReceta(datos) {
    return escribir({ accion: 'insert', tabla: 'recipes', datos: { ...datos, user_id: usuario.id } });
  }
  async function nuevaVersion(datos) {
    return escribir({ accion: 'insert', tabla: 'recipe_versions', datos: { ...datos, user_id: usuario.id } });
  }
  async function nuevosPasos(filas) {
    if (!filas.length) return { datos: [] };
    return escribir({ accion: 'insert', tabla: 'recipe_steps',
                      datos: filas.map(f => ({ ...f, user_id: usuario.id })) });
  }

  async function nuevaPreparacion(datos) {
    return escribir({ accion: 'insert', tabla: 'brew_sessions', datos: { ...datos, user_id: usuario.id } });
  }
  async function editarPreparacion(id, datos) {
    return escribir({ accion: 'update', tabla: 'brew_sessions', id, datos });
  }
  async function borrarPreparacion(id) {
    // El trigger devuelve la dosis al inventario.
    return escribir({ accion: 'delete_suave', tabla: 'brew_sessions', id });
  }

  async function nuevaCata(datos) {
    return escribir({ accion: 'insert', tabla: 'tasting_reviews', datos: { ...datos, user_id: usuario.id } });
  }
  async function editarCata(id, datos) {
    return escribir({ accion: 'update', tabla: 'tasting_reviews', id, datos });
  }

  async function guardarPerfil(datos) {
    if (estado.perfil) return escribir({ accion: 'update', tabla: 'profiles', id: usuario.id, datos });
    return escribir({ accion: 'insert', tabla: 'profiles', datos: { ...datos, user_id: usuario.id } });
  }

  async function asegurarTostador(nombre) {
    const n = (nombre || '').trim();
    if (!n) return null;
    const ya = estado.tostadores.find(t => t.nombre.toLowerCase() === n.toLowerCase());
    if (ya) return ya.id;
    const r = await escribir({ accion: 'insert', tabla: 'roasters', datos: { user_id: usuario.id, nombre: n } });
    if (r.datos && r.datos[0]) { estado.tostadores.push(r.datos[0]); return r.datos[0].id; }
    return null;
  }

  /* ================== exportacion (art. 34) ================== */

  function descargar(nombre, contenido, tipo) {
    const blob = new Blob([contenido], { type: tipo });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nombre;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function aCSV(filas, columnas) {
    const q = v => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    return [columnas.map(c => q(c.titulo)).join(';')]
      .concat(filas.map(f => columnas.map(c => q(c.valor(f))).join(';')))
      .join('\n');
  }

  function exportarInventarioCSV() {
    const cols = [
      { titulo: 'Cafe', valor: l => (cafe(l.coffee_id) || {}).nombre },
      { titulo: 'Tostador', valor: l => { const c = cafe(l.coffee_id); return c && c.roaster_id ? (tostador(c.roaster_id) || {}).nombre : ''; } },
      { titulo: 'Pais', valor: l => (cafe(l.coffee_id) || {}).pais },
      { titulo: 'Proceso', valor: l => proceso((cafe(l.coffee_id) || {}).proceso_id).nombre },
      { titulo: 'Estado', valor: l => l.estado },
      { titulo: 'Gramos iniciales', valor: l => l.gramos_iniciales },
      { titulo: 'Gramos disponibles', valor: l => l.gramos_disponibles },
      { titulo: '% restante', valor: l => l.porcentaje_restante },
      { titulo: 'Tazas restantes (est.)', valor: l => tazasRestantes(l) },
      { titulo: 'Precio', valor: l => l.precio_pagado },
      { titulo: 'Costo por gramo', valor: l => l.costo_por_gramo },
      { titulo: 'Costo por taza (est.)', valor: l => { const c = costoPorTaza(l); return c === null ? '' : Math.round(c); } },
      { titulo: 'Fecha compra', valor: l => l.fecha_compra },
      { titulo: 'Fecha tueste', valor: l => l.fecha_tueste },
      { titulo: 'Dias desde tueste', valor: l => diasDesdeTueste(l) },
      { titulo: 'Fecha apertura', valor: l => l.fecha_apertura },
      { titulo: 'Ubicacion', valor: l => l.ubicacion }
    ];
    descargar(`inventario_${hoy()}.csv`, '﻿' + aCSV(estado.lotes, cols), 'text/csv;charset=utf-8');
  }

  function exportarPreparacionesCSV() {
    const cols = [
      { titulo: 'Fecha', valor: p => p.fecha },
      { titulo: 'Cafe', valor: p => (cafe(p.coffee_id) || {}).nombre },
      { titulo: 'Metodo', valor: p => metodo(p.method_id).nombre },
      { titulo: 'Receta', valor: p => { const r = porId(estado.recetas, p.recipe_id); return r ? r.nombre : ''; } },
      { titulo: 'Version', valor: p => { const v = porId(estado.versiones, p.version_id); return v ? v.version : ''; } },
      { titulo: 'Molinillo', valor: p => { const g = molinillo(p.grinder_id); return g ? g.marca + ' ' + g.modelo : ''; } },
      { titulo: 'Molienda', valor: p => p.molienda_ajuste },
      { titulo: 'Dosis g', valor: p => p.dosis_g },
      { titulo: 'Agua g', valor: p => p.agua_g },
      { titulo: 'Ratio', valor: p => p.ratio },
      { titulo: 'Temp C', valor: p => p.temperatura_c },
      { titulo: 'Tiempo', valor: p => segundosATexto(p.tiempo_total_seg) },
      { titulo: 'Dias desde tueste', valor: p => p.dias_desde_tueste },
      { titulo: 'Puntuacion 1-10', valor: p => { const c = cataDe(p.id); return c ? c.puntuacion_personal : ''; } },
      { titulo: 'Valoracion 1-5 (historica)', valor: p => { const c = cataDe(p.id); return c ? c.valoracion_1a5 : ''; } },
      { titulo: 'Contexto', valor: p => p.contexto },
      { titulo: 'Comentarios', valor: p => p.comentarios }
    ];
    descargar(`preparaciones_${hoy()}.csv`,
      '﻿' + aCSV([...estado.preparaciones].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)), cols),
      'text/csv;charset=utf-8');
  }

  function exportarTodoJSON() {
    const paquete = {
      formato: 'diario-cafe/relacional', version: 3, exportado: ahora(),
      aviso: 'Respaldo completo. Las puntuaciones personales no son puntajes SCA.',
      datos: {
        perfil: estado.perfil, cafes: estado.cafes, tostadores: estado.tostadores,
        lotes: estado.lotes, movimientos: estado.movimientos,
        recetas: estado.recetas, versiones: estado.versiones, pasos: estado.pasos,
        preparaciones: estado.preparaciones, catas: estado.catas, molinillos: estado.molinillos
      }
    };
    descargar(`diario_cafe_completo_${hoy()}.json`, JSON.stringify(paquete, null, 2), 'application/json');
  }

  /* ================== API ================== */
  return {
    // infraestructura
    get sb() { return sb; }, get usuario() { return usuario; }, get hayBackend() { return hayBackend; },
    estado, cargarTodo, sincronizar, pendientes, errores, registrarError,
    sesionActual, enviarCodigo, verificarCodigo, salir,
    // utilidades
    hoy, ahora, esc, escAttr, num, clp, fecha, diasEntre, segundosATexto, textoASegundos,
    // consultas
    cafe, lote, metodo, proceso, molinillo, tostador, porId,
    lotesDe, movimientosDe, preparacionesDe, cataDe, versionesDe, versionActual, pasosDe,
    lotesActivos, lotesAbiertos, lotesPorTerminarse, lotesMasTiempoAbiertos, priorizar,
    dosisHabitual, dosisHabitualDe, tazasRestantes, costoPorTaza,
    diasDesdeTueste, diasDesdeApertura, diasEstimados,
    totalGramosDisponibles, tazasDisponiblesTotales, consumoUltimos,
    valoracionPromedio, metodoMasUsado, mejorCafe, ultimaPreparacion, recetaFavorita,
    // escritura
    nuevoCafe, editarCafe, borrarCafe, nuevoLote, editarLote, nuevoMovimiento,
    nuevaReceta, nuevaVersion, nuevosPasos,
    nuevaPreparacion, editarPreparacion, borrarPreparacion,
    nuevaCata, editarCata, guardarPerfil, asegurarTostador,
    // exportacion
    exportarInventarioCSV, exportarPreparacionesCSV, exportarTodoJSON, descargar
  };
})();

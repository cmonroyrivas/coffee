/* ============================================================
   DIARIO DE CAFE · interfaz
   ------------------------------------------------------------
   Navegacion de 5 secciones (art. 4), dashboard (art. 5),
   inventario en gramos (art. 6-7), temporizador guiado (art. 12),
   evaluacion rapida (art. 16) y asistente de ajuste (art. 14).

   Correcciones respecto de la v2:
   B-07  Ahora hay ruteo por hash: el boton atras del navegador
         funciona y recargar no te devuelve siempre al inicio.
   B-08  Los modales tienen role=dialog, atrapan el foco y lo
         devuelven al cerrar.
   B-09  Se reemplazaron confirm() y alert() por dialogos propios.
   B-10  El mapa ya no marca los 18 paises como tuyos: se ignoran
         los paises vacios.
   B-11  Los promedios ya no dan NaN: se filtran los nulos.
   B-12  Ids con crypto.randomUUID(), no Date.now().
   ============================================================ */

'use strict';

const APP = (() => {

  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const esc = DB.esc;

  let vistaActual = 'inicio';
  let ultimoFoco = null;
  let temporizador = null;

  /* ============================================================
     avisos
     ============================================================ */
  let tToast;
  function toast(msg, tipo) {
    const t = $('#toast');
    t.textContent = msg;
    t.className = tipo === 'error' ? 'show error' : 'show';
    clearTimeout(tToast);
    tToast = setTimeout(() => { t.className = ''; }, tipo === 'error' ? 5200 : 3200);
  }

  function bandaOffline() {
    const b = $('#bandaOffline');
    const p = DB.pendientes();
    const f = DB.fallidas().length;
    const rechazados = f
      ? ` ${f} cambio${f === 1 ? '' : 's'} no se pudo guardar: mira ☰ → Diagnóstico.`
      : '';
    if (!navigator.onLine) {
      $('#bandaOfflineTxt').textContent = (p
        ? `Sin conexión. ${p} cambio${p === 1 ? '' : 's'} guardado${p === 1 ? '' : 's'} aquí, se suben cuando vuelva.`
        : 'Sin conexión. Puedes seguir registrando: se sube solo cuando vuelva.') + rechazados;
      b.classList.add('show');
    } else if (p || f) {
      $('#bandaOfflineTxt').textContent = (p
        ? `Subiendo ${p} cambio${p === 1 ? '' : 's'} pendiente${p === 1 ? '' : 's'}…`
        : 'Todo al día.') + rechazados;
      b.classList.add('show');
    } else {
      b.classList.remove('show');
    }
  }

  /* ============================================================
     B-08: modales accesibles con foco atrapado
     ============================================================ */
  function abrirModal(titulo, html, alCerrar) {
    ultimoFoco = document.activeElement;
    $('#modalTit').textContent = titulo;
    $('#modalCuerpo').innerHTML = html;
    $('#modal').classList.add('show');
    $('#modal').dataset.alCerrar = alCerrar ? '1' : '';
    document.body.style.overflow = 'hidden';
    const foco = $('#modalCuerpo').querySelector('input,select,textarea,button');
    (foco || $('#modalCerrar')).focus();
  }

  function cerrarModal() {
    $('#modal').classList.remove('show');
    $('#modalCuerpo').innerHTML = '';
    document.body.style.overflow = '';
    if (ultimoFoco && ultimoFoco.focus) ultimoFoco.focus();
    ultimoFoco = null;
  }

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && $('#modal').classList.contains('show')) cerrarModal();
    if (e.key !== 'Tab' || !$('#modal').classList.contains('show')) return;
    const f = Array.from($('#modalCaja').querySelectorAll(
      'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])'
    )).filter(x => x.offsetParent !== null);
    if (!f.length) return;
    const primero = f[0], ultimo = f[f.length - 1];
    if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
  });

  /* B-09: confirmacion propia, no confirm() del navegador */
  function confirmar(titulo, texto, textoBoton, peligroso) {
    return new Promise(res => {
      abrirModal(titulo, `
        <p style="font-size:var(--tx-sm);color:var(--t2)">${esc(texto)}</p>
        <div class="btn-fila" style="margin-top:20px">
          <button class="btn ${peligroso ? 'btn-peligro' : 'btn-pri'}" style="flex:1" id="cfSi">${esc(textoBoton)}</button>
          <button class="btn" style="flex:1" id="cfNo">Cancelar</button>
        </div>`);
      $('#cfSi').onclick = () => { cerrarModal(); res(true); };
      $('#cfNo').onclick = () => { cerrarModal(); res(false); };
    });
  }

  /* ============================================================
     B-07: ruteo por hash
     ============================================================ */
  const VISTAS = ['inicio', 'cafes', 'preparar', 'bitacora', 'ruta'];

  function irA(vista, reemplazar) {
    if (!VISTAS.includes(vista)) vista = 'inicio';
    vistaActual = vista;
    $$('.vista').forEach(v => v.classList.toggle('activa', v.id === 'v-' + vista));
    $$('.nav-b').forEach(b => {
      const es = b.dataset.vista === vista;
      if (es) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    window.scrollTo({ top: 0, behavior: 'instant' });
    const h = '#/' + vista;
    if (location.hash !== h) {
      if (reemplazar) history.replaceState(null, '', h); else history.pushState(null, '', h);
    }
    render(vista);
  }

  window.addEventListener('popstate', () => {
    const v = (location.hash || '#/inicio').replace('#/', '');
    irA(v, true);
  });

  /* ============================================================
     helpers de presentacion
     ============================================================ */
  function claseProceso(procesoId) {
    const fam = DB.proceso(procesoId).familia || 'otro';
    return 'pc-' + (['lavado', 'natural', 'honey', 'fermentado'].includes(fam) ? fam : 'otro');
  }

  function barraClase(pct) {
    if (pct === null || pct === undefined) return '';
    return pct <= 20 ? 'bajo' : pct <= 45 ? 'medio' : '';
  }

  function nombreTostador(cafe) {
    if (!cafe || !cafe.roaster_id) return '';
    const t = DB.tostador(cafe.roaster_id);
    return t ? t.nombre : '';
  }

  const ETIQUETA_ESTADO = {
    lista_deseos: 'En lista de deseos', comprado: 'Comprado', sin_abrir: 'Sin abrir',
    abierto: 'Abierto', bajo_stock: 'Queda poco', terminado: 'Terminado',
    archivado: 'Archivado', regalado: 'Regalado', descartado: 'Descartado'
  };
  const CHIP_ESTADO = { abierto: 'ok', sin_abrir: '', bajo_stock: 'warn', terminado: '', descartado: 'bad' };

  const ETIQUETA_MOV = {
    compra: 'Compra', apertura: 'Apertura de la bolsa', preparacion: 'Preparación',
    ajuste: 'Ajuste manual', merma: 'Merma', regalo: 'Regalo', muestra: 'Muestra',
    descarte: 'Descarte', devolucion: 'Devolución'
  };

  /* Para nombrar en Diagnóstico un cambio que quedó sin subir */
  const ETIQUETA_TABLA = {
    inventory_movements: 'Movimiento de inventario', inventory_lots: 'Bolsa',
    coffees: 'Café', brew_sessions: 'Preparación', tasting_reviews: 'Evaluación',
    review_descriptors: 'Sabores de una evaluación', recipes: 'Receta',
    recipe_versions: 'Versión de receta', recipe_steps: 'Pasos de receta',
    roasters: 'Tostador', profiles: 'Tus ajustes'
  };

  /* ============================================================
     RENDER: despachador
     ============================================================ */
  function render(vista) {
    try {
      if (vista === 'inicio') renderInicio();
      else if (vista === 'cafes') renderCafes();
      else if (vista === 'preparar') renderPreparar();
      else if (vista === 'bitacora') renderBitacora();
      else if (vista === 'ruta') renderRuta();
      marcarAvisos();
    } catch (e) {
      DB.registrarError('render/' + vista, e);
      toast('Algo falló al dibujar esta pantalla. Quedó registrado en el diagnóstico.', 'error');
    }
  }

  function refrescar() { render(vistaActual); }
  document.addEventListener('datos:cambio', refrescar);
  document.addEventListener('cola:cambio', () => { bandaOffline(); marcarAvisos(); });
  window.addEventListener('online', bandaOffline);
  window.addEventListener('offline', bandaOffline);

  function marcarAvisos() {
    const porTerminar = DB.lotesPorTerminarse(3).length;
    const sinEvaluar = DB.estado.preparaciones.filter(p => !DB.cataDe(p.id)).length;
    $$('.nav-b').forEach(b => {
      const v = b.dataset.vista;
      const hay = (v === 'cafes' && porTerminar > 0) || (v === 'bitacora' && sinEvaluar > 0);
      b.classList.toggle('con-aviso', hay);
    });
  }

  /* ============================================================
     VISTA 1 · INICIO (art. 5)
     ============================================================ */
  function renderInicio() {
    const abiertos = DB.lotesAbiertos();
    const sinAbrir = DB.estado.lotes.filter(l => l.estado === 'sin_abrir');
    const gramos = DB.totalGramosDisponibles();
    const tazas = DB.tazasDisponiblesTotales();
    const porTerminar = DB.lotesPorTerminarse(3);
    const g7 = DB.consumoUltimos(7), g30 = DB.consumoUltimos(30);
    const ultima = DB.ultimaPreparacion();
    const mm = DB.metodoMasUsado();
    const mejor = DB.mejorCafe();
    const favRec = DB.recetaFavorita();
    const prioridad = DB.priorizar();
    const brechas = MOTOR.brechasInventario();

    const hora = new Date().getHours();
    $('#inicioSaludo').textContent =
      (hora < 12 ? 'Buenos días' : hora < 20 ? 'Buenas tardes' : 'Buenas noches') +
      (DB.estado.perfil && DB.estado.perfil.nombre ? ', ' + DB.estado.perfil.nombre : '') + '.' +
      (DB.estado.desdeCache ? ' Mostrando los últimos datos guardados en este dispositivo.' : '');

    let h = '';

    /* --- accesos rapidos --- */
    h += `<div class="rapidas">
      <button class="rapida destacada" onclick="APP.irA('preparar')">
        <span class="rapida-ico" aria-hidden="true">▽</span>
        <span class="rapida-t">Preparar café</span>
        <span class="rapida-d">Receta, temporizador y evaluación</span>
      </button>
      <button class="rapida" onclick="APP.formCafe()">
        <span class="rapida-ico" aria-hidden="true">＋</span>
        <span class="rapida-t">Agregar café</span>
        <span class="rapida-d">Bolsa nueva al inventario</span>
      </button>
      <button class="rapida" onclick="APP.formMovimiento()">
        <span class="rapida-ico" aria-hidden="true">⇄</span>
        <span class="rapida-t">Registrar compra</span>
        <span class="rapida-d">O cualquier movimiento</span>
      </button>
      <button class="rapida" onclick="APP.irA('ruta')">
        <span class="rapida-ico" aria-hidden="true">◈</span>
        <span class="rapida-t">Registrar visita</span>
        <span class="rapida-d">Cafetería o ruta</span>
      </button>
    </div>`;

    /* --- alerta de inventario bajo --- */
    if (porTerminar.length) {
      h += `<div class="nota nota-ojo">
        <b>${porTerminar.length} bolsa${porTerminar.length === 1 ? '' : 's'} por terminarse.</b><br>
        ${porTerminar.slice(0, 3).map(l => {
          const c = DB.cafe(l.coffee_id);
          const t = DB.tazasRestantes(l);
          return `${esc(c ? c.nombre : '—')}: quedan ${DB.num(l.gramos_disponibles, 0)} g, unas ${t} preparacion${t === 1 ? '' : 'es'}`;
        }).join('<br>')}
      </div>`;
    }

    /* --- KPIs --- */
    h += `<div class="seccion"><div class="kpis">
      <div class="kpi"><div class="kpi-n">${abiertos.length}</div><div class="kpi-l">Cafés abiertos</div></div>
      <div class="kpi"><div class="kpi-n">${Math.round(gramos)}<small> g</small></div><div class="kpi-l">Disponibles</div></div>
      <div class="kpi"><div class="kpi-n">${tazas}</div><div class="kpi-l">Tazas (estimadas)</div></div>
      <div class="kpi ${sinAbrir.length ? '' : ''}"><div class="kpi-n">${sinAbrir.length}</div><div class="kpi-l">Sin abrir</div></div>
    </div>
    <p class="pista" style="font-size:var(--tx-xs);color:var(--t3);margin-top:8px">
      Las tazas son una estimación: gramos disponibles dividido por tu dosis habitual (${DB.dosisHabitual()} g).
    </p></div>`;

    /* --- ¿Qué preparo hoy? --- */
    h += `<div class="seccion">
      <div class="seccion-tit">¿Qué preparo hoy?</div>
      <div class="card card-p">${formQuePreparo()}</div>
    </div>`;

    /* --- sugerencia de prioridad --- */
    if (prioridad) {
      const c = DB.cafe(prioridad.coffee_id);
      const d = DB.diasDesdeTueste(prioridad);
      h += `<div class="seccion">
        <div class="seccion-tit">Qué conviene tomar primero</div>
        <div class="card card-p">
          <div style="font-family:var(--f-display);font-size:var(--tx-lg);font-weight:800">${esc(c ? c.nombre : '—')}</div>
          <p style="font-size:var(--tx-sm);color:var(--t2);margin:6px 0 0">
            ${d !== null
              ? `Lleva ${d} días desde el tueste, es la bolsa abierta más antigua que tienes.`
              : 'Es la bolsa que llevas más tiempo con abierta.'}
            Quedan ${DB.num(prioridad.gramos_disponibles, 0)} g.
          </p>
          <div class="btn-fila" style="margin-top:14px">
            <button class="btn btn-pri" onclick="APP.prepararCon('${prioridad.coffee_id}','${prioridad.id}')">Preparar este</button>
            <button class="btn" onclick="APP.detalleCafe('${prioridad.coffee_id}')">Ver ficha</button>
          </div>
        </div>
      </div>`;
    }

    /* --- consumo y actividad --- */
    h += `<div class="seccion">
      <div class="seccion-tit">Tu ritmo</div>
      <div class="card card-p"><div class="datos">
        <div class="dato"><span class="dato-k">Consumo últimos 7 días</span><span class="dato-v">${Math.round(g7)} g</span></div>
        <div class="dato"><span class="dato-k">Consumo últimos 30 días</span><span class="dato-v">${Math.round(g30)} g</span></div>
        <div class="dato"><span class="dato-k">Último café preparado</span><span class="dato-v">${
          ultima ? esc((DB.cafe(ultima.coffee_id) || {}).nombre || '—') + ' · ' + DB.fecha(ultima.fecha) : 'Todavía ninguno'
        }</span></div>
        <div class="dato"><span class="dato-k">Método más usado</span><span class="dato-v">${mm ? esc(mm.nombre) + ' (' + mm.n + ')' : '—'}</span></div>
        <div class="dato"><span class="dato-k">Café mejor evaluado</span><span class="dato-v">${
          mejor ? esc(mejor.cafe.nombre) + ' · ' + mejor.valor.toFixed(1) + '/' + mejor.escala : '—'
        }</span></div>
        <div class="dato"><span class="dato-k">Receta favorita</span><span class="dato-v">${favRec ? esc(favRec.nombre) : 'Aún sin marcar'}</span></div>
      </div></div>
    </div>`;

    /* --- que café falta --- */
    h += `<div class="seccion">
      <div class="seccion-tit">Qué café te falta</div>
      <div class="card card-p">
        <p style="font-size:var(--tx-sm);color:var(--t2);margin:0 0 12px">${esc(brechas.resumen)}</p>
        ${brechas.suficiente ? '' : brechas.brechas.slice(0, 2).map(b => `
          <div class="nota nota-info" style="margin:8px 0">
            <b>${esc(b.titulo)}</b><br>${esc(b.desc)}
          </div>`).join('')}
        <button class="btn btn-fant" onclick="APP.irA('bitacora');APP.bitacoraTab('brechas')">Ver el análisis completo →</button>
      </div>
    </div>`;

    $('#inicioContenido').innerHTML = h;
    engancharQuePreparo();
  }

  /* ---------- bloque ¿Qué preparo hoy? ---------- */
  function formQuePreparo() {
    const activos = DB.lotesActivos().filter(l => DB.num(l.gramos_disponibles, 0) > 0);
    if (!activos.length) {
      return `<p style="font-size:var(--tx-sm);color:var(--t2);margin:0">
        No tienes café con gramos disponibles. Agrega una bolsa para empezar.</p>
        <button class="btn btn-pri" style="margin-top:12px" onclick="APP.formCafe()">Agregar café</button>`;
    }
    const metodos = DB.estado.metodos.filter(m => m.activo);
    return `
      <div class="campo">
        <label for="qpCafe">Café</label>
        <select id="qpCafe">${activos.map(l => {
          const c = DB.cafe(l.coffee_id);
          return `<option value="${l.id}">${esc(c ? c.nombre : '—')} · ${DB.num(l.gramos_disponibles, 0)} g</option>`;
        }).join('')}</select>
      </div>
      <div class="campo">
        <label for="qpMetodo">Método</label>
        <select id="qpMetodo">${metodos.map(m => `<option value="${m.id}">${esc(m.nombre)}</option>`).join('')}</select>
      </div>
      <div class="grid2">
        <div class="campo">
          <label for="qpMl">Cantidad en la taza</label>
          <select id="qpMl">
            <option value="">Como diga la receta</option>
            <option value="150">150 ml · una taza chica</option>
            <option value="250" selected>250 ml · una taza</option>
            <option value="350">350 ml · taza grande</option>
            <option value="500">500 ml · para dos</option>
          </select>
        </div>
        <div class="campo">
          <label for="qpPerfil">Qué buscas</label>
          <select id="qpPerfil">
            <option value="mas_equilibrado">Más equilibrado</option>
            <option value="mas_dulce">Más dulce</option>
            <option value="mas_brillante">Más brillante</option>
            <option value="mas_intenso">Más intenso</option>
            <option value="mas_limpio">Más limpio</option>
          </select>
        </div>
      </div>
      <button class="btn btn-pri btn-bloque" id="qpIr">Sugerir una receta</button>
      <div id="qpResultado" style="margin-top:16px"></div>`;
  }

  function engancharQuePreparo() {
    const b = $('#qpIr');
    if (!b) return;
    b.onclick = () => {
      const loteId = $('#qpCafe').value;
      const lote = DB.lote(loteId);
      if (!lote) return;
      const r = MOTOR.recomendar({
        cafeId: lote.coffee_id, loteId,
        methodId: $('#qpMetodo').value,
        mlBebida: DB.num($('#qpMl').value),
        perfilDeseado: $('#qpPerfil').value
      });
      if (!r) { toast('No tengo datos suficientes para sugerir algo con ese método.', 'error'); return; }
      $('#qpResultado').innerHTML = tarjetaRecomendacion(r) + `
        <button class="btn btn-pri btn-bloque" style="margin-top:12px"
          onclick="APP.iniciarPreparacion('${r.cafe.id}','${lote.id}','${r.metodo.id}',${r.dosis_g},${r.agua_g},${r.temperatura_c},${r.molienda === null ? 'null' : r.molienda},${r.tiempo_total_seg || 'null'})">
          Preparar con esta receta</button>`;
    };
  }

  /* ---------- tarjeta de recomendación explicable (art. 42) ---------- */
  function tarjetaRecomendacion(r) {
    const g = r.grinder;
    return `<div class="reco">
      <div class="reco-tit">Punto de partida sugerido</div>
      <div class="reco-params">
        <div class="reco-p"><div class="reco-p-n">${r.dosis_g}</div><div class="reco-p-l">g café</div></div>
        <div class="reco-p"><div class="reco-p-n">${r.agua_g}</div><div class="reco-p-l">g agua</div></div>
        <div class="reco-p"><div class="reco-p-n">1:${r.ratio.toFixed(1)}</div><div class="reco-p-l">ratio</div></div>
        <div class="reco-p"><div class="reco-p-n">${r.temperatura_c}°</div><div class="reco-p-l">°C</div></div>
        ${r.molienda !== null ? `<div class="reco-p"><div class="reco-p-n">${r.molienda}</div><div class="reco-p-l">${esc(g ? g.unidad_ajuste : 'molienda')}</div></div>` : ''}
        ${r.tiempo_total_seg ? `<div class="reco-p"><div class="reco-p-n">${DB.segundosATexto(r.tiempo_total_seg)}</div><div class="reco-p-l">tiempo</div></div>` : ''}
      </div>
      ${r.aviso ? `<div class="nota nota-ojo" style="margin:8px 0">${esc(r.aviso)}</div>` : ''}
      <p class="reco-porque">${esc(r.explicacion)}</p>
      ${r.referencia && r.referencia.razon ? `<p class="reco-porque" style="margin-top:8px"><b>Por qué estos números:</b> ${esc(r.referencia.razon)}</p>` : ''}
      ${r.referencia && r.referencia.tecnica ? `<p class="reco-porque" style="margin-top:4px"><b>Técnica:</b> ${esc(r.referencia.tecnica)}</p>` : ''}
      ${r.molienda !== null && g ? `<p class="reco-porque" style="margin-top:8px">
        Molienda en ${esc(g.marca)} ${esc(g.modelo)}, tomada de ${esc(r.moliendaOrigen || 'la referencia')}.
        Los ${esc(g.unidad_ajuste)} son una referencia de <em>tu</em> molinillo desde su punto cero: en otra unidad del mismo modelo no significan lo mismo.
      </p>` : ''}
      ${r.comparacion ? `<p class="reco-porque" style="margin-top:8px"><b>Comparado con tu última vez (${DB.fecha(r.comparacion.fecha)}):</b>
        ${r.comparacion.igual ? 'prácticamente lo mismo.' : esc(r.comparacion.cambios.join(', ')) + '.'}</p>` : ''}
      <div class="reco-meta">
        <span class="confianza ${r.confianza}">Confianza ${r.confianza}</span>
        · ${r.nRegistros} registro${r.nRegistros === 1 ? '' : 's'} detrás
        · Datos usados: ${esc(r.datosUsados.join('; '))}<br>
        <b>Si vas a cambiar algo, cambia ${esc(r.variablePrincipal)}</b><br>
        Es un punto de partida, no una verdad: tu paladar decide.
      </div>
    </div>`;
  }

  /* ============================================================
     VISTA 2 · CAFÉS
     ============================================================ */
  const filtros = { texto: '', estado: 'activos', proceso: '', pais: '' };

  function renderCafes() {
    const total = DB.estado.cafes.length;
    const activos = DB.lotesActivos().length;
    $('#cafesResumen').textContent =
      `${total} cafés en tu historia · ${activos} bolsa${activos === 1 ? '' : 's'} activa${activos === 1 ? '' : 's'} · ${Math.round(DB.totalGramosDisponibles())} g disponibles`;

    /* --- filtros --- */
    const procesos = [...new Set(DB.estado.cafes.map(c => c.proceso_id).filter(Boolean))];
    // B-10: se ignoran los paises vacios
    const paises = [...new Set(DB.estado.cafes.map(c => (c.pais || '').trim()).filter(p => p !== ''))].sort();

    $('#cafesFiltros').innerHTML = `
      <div class="campo">
        <label for="fTexto">Buscar</label>
        <input type="search" id="fTexto" value="${esc(filtros.texto)}" placeholder="Nombre, tostador, origen, nota…">
      </div>
      <div class="opciones" style="margin-bottom:12px" role="group" aria-label="Filtrar por estado">
        ${[['activos', 'Con café'], ['abierto', 'Abiertos'], ['sin_abrir', 'Sin abrir'],
           ['bajo_stock', 'Queda poco'], ['terminado', 'Terminados'], ['', 'Todos']]
          .map(([v, t]) => `<button class="opcion" aria-pressed="${filtros.estado === v}" data-estado="${v}">${t}</button>`).join('')}
      </div>
      <details class="avanzado">
        <summary>Más filtros</summary>
        <div class="grid2" style="margin-top:12px">
          <div class="campo"><label for="fProceso">Proceso</label>
            <select id="fProceso"><option value="">Todos</option>
              ${procesos.map(p => `<option value="${esc(p)}" ${filtros.proceso === p ? 'selected' : ''}>${esc(DB.proceso(p).nombre)}</option>`).join('')}
            </select></div>
          <div class="campo"><label for="fPais">País</label>
            <select id="fPais"><option value="">Todos</option>
              ${paises.map(p => `<option value="${esc(p)}" ${filtros.pais === p ? 'selected' : ''}>${esc(p)}</option>`).join('')}
            </select></div>
        </div>
      </details>
      <button class="btn btn-pri btn-bloque" style="margin-bottom:20px" onclick="APP.formCafe()">＋ Agregar café</button>`;

    $('#fTexto').oninput = e => { filtros.texto = e.target.value; pintarLista(); };
    $$('#cafesFiltros [data-estado]').forEach(b => b.onclick = () => {
      filtros.estado = b.dataset.estado; renderCafes();
    });
    const fp = $('#fProceso'), fpa = $('#fPais');
    if (fp) fp.onchange = e => { filtros.proceso = e.target.value; pintarLista(); };
    if (fpa) fpa.onchange = e => { filtros.pais = e.target.value; pintarLista(); };

    pintarLista();
  }

  function pintarLista() {
    const t = filtros.texto.toLowerCase().trim();
    let lotes = DB.estado.lotes.slice();

    if (filtros.estado === 'activos') lotes = lotes.filter(l => ['sin_abrir', 'abierto', 'bajo_stock'].includes(l.estado));
    else if (filtros.estado) lotes = lotes.filter(l => l.estado === filtros.estado);

    lotes = lotes.filter(l => {
      const c = DB.cafe(l.coffee_id);
      if (!c) return false;
      if (filtros.proceso && c.proceso_id !== filtros.proceso) return false;
      if (filtros.pais && (c.pais || '').trim() !== filtros.pais) return false;
      if (!t) return true;
      const heno = [c.nombre, nombreTostador(c), c.pais, c.region, c.variedad, c.notas_tostador, c.finca]
        .filter(Boolean).join(' ').toLowerCase();
      return heno.includes(t);
    });

    // Orden: primero lo que queda poco, luego por gramos
    const peso = e => ({ bajo_stock: 0, abierto: 1, sin_abrir: 2 }[e] ?? 3);
    lotes.sort((a, b) => peso(a.estado) - peso(b.estado) || DB.num(a.gramos_disponibles, 0) - DB.num(b.gramos_disponibles, 0));

    if (!lotes.length) {
      $('#cafesLista').innerHTML = `<div class="vacio">
        <div class="vacio-ico" aria-hidden="true">◗</div>
        <h3>Nada con esos filtros</h3>
        <p>Prueba con "Todos" o borra la búsqueda.</p>
      </div>`;
      return;
    }

    $('#cafesLista').innerHTML = lotes.map(l => {
      const c = DB.cafe(l.coffee_id);
      const proc = DB.proceso(c.proceso_id);
      const disp = DB.num(l.gramos_disponibles, 0);
      const pct = DB.num(l.porcentaje_restante, 0);
      const tazas = DB.tazasRestantes(l);
      const dTueste = DB.diasDesdeTueste(l);
      const costoTaza = DB.costoPorTaza(l);
      const val = DB.valoracionPromedio(c.id);
      const activo = ['sin_abrir', 'abierto', 'bajo_stock'].includes(l.estado);

      return `<article class="cafe-card">
        <div class="cafe-zona ${claseProceso(c.proceso_id)}">
          <span>${esc(proc.nombre)}</span>
          <span>${esc(ETIQUETA_ESTADO[l.estado] || l.estado)}</span>
        </div>
        <div class="cafe-cuerpo">
          <h3 class="cafe-nombre">${esc(c.nombre)}</h3>
          ${nombreTostador(c) ? `<div class="cafe-tostador">${esc(nombreTostador(c))}</div>` : ''}
          <div class="cafe-meta">
            ${c.pais ? `<span><b>${esc(c.pais)}</b>${c.region ? ' · ' + esc(c.region) : ''}</span>` : ''}
            ${c.variedad ? `<span>${esc(c.variedad)}</span>` : ''}
            ${c.altitud_min_msnm ? `<span>${c.altitud_min_msnm}${c.altitud_max_msnm && c.altitud_max_msnm !== c.altitud_min_msnm ? '–' + c.altitud_max_msnm : ''} msnm</span>` : ''}
            ${val ? `<span class="chip">${val.valor.toFixed(1)}/${val.escala}${val.n ? ' · ' + val.n + ' prep.' : ' · histórica'}</span>` : ''}
            ${c.recompraria ? '<span class="chip ok">Recompraría</span>' : ''}
          </div>

          ${activo ? `<div class="gramos">
            <div class="gramos-cifras">
              <span class="gramos-g">${disp}<small> g de ${DB.num(l.gramos_iniciales, 0)}</small></span>
              <span class="gramos-tazas">${tazas !== null ? '~' + tazas + ' preparacion' + (tazas === 1 ? '' : 'es') : ''}</span>
            </div>
            <div class="barra" role="img" aria-label="Queda el ${pct}% de la bolsa">
              <div class="barra-in ${barraClase(pct)}" style="width:${Math.max(2, pct)}%"></div>
            </div>
            <div class="cafe-meta" style="margin-top:10px">
              ${dTueste !== null ? `<span>${dTueste} días del tueste</span>` : '<span style="color:var(--warn)">Sin fecha de tueste</span>'}
              ${costoTaza !== null ? `<span>${DB.clp(costoTaza)} por taza</span>` : ''}
              ${l.fecha_apertura ? `<span>Abierta hace ${DB.diasDesdeApertura(l)} d</span>` : ''}
            </div>
          </div>` : ''}

          <div class="btn-fila" style="margin-top:16px">
            ${activo && disp > 0 ? `<button class="btn btn-pri" onclick="APP.prepararCon('${c.id}','${l.id}')">Preparar</button>` : ''}
            <button class="btn" onclick="APP.detalleCafe('${c.id}')">Ficha</button>
            ${activo ? `<button class="btn" onclick="APP.formMovimiento('${l.id}')">Movimiento</button>` : ''}
          </div>
        </div>
      </article>`;
    }).join('');
  }

  /* ============================================================
     FICHA HISTÓRICA DEL CAFÉ (art. 18)
     ============================================================ */
  function detalleCafe(cafeId) {
    const c = DB.cafe(cafeId);
    if (!c) return;
    const lotes = DB.lotesDe(cafeId);
    const preps = DB.preparacionesDe(cafeId);
    const val = DB.valoracionPromedio(cafeId);
    const proc = DB.proceso(c.proceso_id);

    const gastado = lotes.reduce((s, l) => s + DB.num(l.precio_pagado, 0), 0);
    const consumido = lotes.reduce((s, l) => s + (DB.num(l.gramos_iniciales, 0) - DB.num(l.gramos_disponibles, 0)), 0);
    const compras = lotes.filter(l => l.fecha_compra).sort((a, b) => new Date(a.fecha_compra) - new Date(b.fecha_compra));

    /* resumen automatico: SOLO afirma lo que respalda el historial */
    let resumen = '';
    if (preps.length >= 2) {
      const conNota = preps.map(p => ({ p, pts: MOTOR.puntuacionDe(p) })).filter(x => x.pts !== null);
      if (conNota.length >= 2) {
        const mejorP = conNota.sort((a, b) => b.pts - a.pts)[0];
        const porMet = {};
        conNota.forEach(({ p, pts }) => { (porMet[p.method_id] = porMet[p.method_id] || []).push(pts); });
        const mejorMet = Object.entries(porMet).map(([k, v]) => ({ k, prom: v.reduce((a, b) => a + b, 0) / v.length, n: v.length }))
          .sort((a, b) => b.prom - a.prom)[0];
        resumen = `Tu mejor resultado con este café fue en ${DB.metodo(mejorP.p.method_id).nombre}` +
          (mejorP.p.ratio ? `, ratio 1:${(+mejorP.p.ratio).toFixed(1)}` : '') +
          (mejorP.p.temperatura_c ? `, ${mejorP.p.temperatura_c} °C` : '') +
          (mejorP.p.molienda_ajuste != null ? `, molienda ${mejorP.p.molienda_ajuste}` : '') + '. ' +
          (Object.keys(porMet).length > 1
            ? `De los métodos que probaste, ${DB.metodo(mejorMet.k).nombre} promedia mejor (${mejorMet.prom.toFixed(1)} en ${mejorMet.n}).`
            : `Todavía lo has preparado solo en ${DB.metodo(mejorMet.k).nombre}: no se puede comparar entre métodos.`);
      }
    }
    if (!resumen) {
      resumen = preps.length === 1
        ? 'Tienes una sola preparación registrada de este café. Con dos o más empieza a poder compararse.'
        : 'Todavía no hay preparaciones registradas de este café, así que no hay nada que resumir sin inventarlo.';
    }

    const html = `
      <div class="subtabs" role="tablist">
        <button class="subtab" role="tab" aria-selected="true" data-st="perfil">Origen</button>
        <button class="subtab" role="tab" aria-selected="false" data-st="bolsas">Bolsas (${lotes.length})</button>
        <button class="subtab" role="tab" aria-selected="false" data-st="historial">Historial (${preps.length})</button>
        <button class="subtab" role="tab" aria-selected="false" data-st="sabores">Sabores</button>
      </div>

      <div data-panel="perfil">
        <div class="cafe-zona ${claseProceso(c.proceso_id)}" style="border-radius:8px;margin-bottom:16px">
          <span>${esc(proc.nombre)}</span>${c.perfil_tueste ? `<span>Tueste ${esc(c.perfil_tueste)}</span>` : ''}
        </div>
        <div class="datos">
          ${[['Tostador', nombreTostador(c)], ['País', c.pais], ['Región', c.region], ['Finca', c.finca],
             ['Productor', c.productor], ['Variedad', c.variedad], ['Especie', c.especie],
             ['Altitud', c.altitud_min_msnm ? c.altitud_min_msnm + (c.altitud_max_msnm && c.altitud_max_msnm !== c.altitud_min_msnm ? '–' + c.altitud_max_msnm : '') + ' msnm' : ''],
             ['Fermentación', c.tipo_fermentacion], ['Lote', c.lote_microlote]]
            .filter(([, v]) => v)
            .map(([k, v]) => `<div class="dato"><span class="dato-k">${k}</span><span class="dato-v">${esc(v)}</span></div>`).join('')}
        </div>

        ${c.notas_tostador ? `<div class="seccion" style="margin-top:20px">
          <div class="seccion-tit">Notas declaradas por el tostador</div>
          <p style="font-size:var(--tx-sm);color:var(--t2);margin:0">${esc(c.notas_tostador)}</p>
        </div>` : ''}

        ${c.puntaje_declarado ? `<div class="nota nota-info">
          El tostador declara ${c.puntaje_declarado} puntos. Es información de la bolsa, no una evaluación tuya ni una certificación.
        </div>` : ''}

        <div class="seccion" style="margin-top:20px">
          <div class="seccion-tit">Tu balance con este café</div>
          <div class="datos">
            <div class="dato"><span class="dato-k">Tu valoración</span><span class="dato-v">${val ? val.valor.toFixed(1) + '/' + val.escala + (val.fuente === 'historica' ? ' (histórica)' : ' · ' + val.n + ' prep.') : 'Sin evaluar'}</span></div>
            <div class="dato"><span class="dato-k">¿Lo comprarías de nuevo?</span><span class="dato-v">${c.recompraria === true ? 'Sí' : c.recompraria === false ? 'No' : 'Sin decidir'}</span></div>
            <div class="dato"><span class="dato-k">Veces comprado</span><span class="dato-v">${lotes.length}</span></div>
            <div class="dato"><span class="dato-k">Consumido en total</span><span class="dato-v">${Math.round(consumido)} g</span></div>
            <div class="dato"><span class="dato-k">Gasto acumulado</span><span class="dato-v">${gastado ? DB.clp(gastado) : '—'}</span></div>
            ${compras.length ? `<div class="dato"><span class="dato-k">Primera compra</span><span class="dato-v">${DB.fecha(compras[0].fecha_compra)}</span></div>` : ''}
            ${compras.length > 1 ? `<div class="dato"><span class="dato-k">Última compra</span><span class="dato-v">${DB.fecha(compras[compras.length - 1].fecha_compra)}</span></div>` : ''}
          </div>
        </div>

        <div class="nota">${esc(resumen)}</div>
        ${c.observaciones ? `<p style="font-size:var(--tx-sm);color:var(--t2)"><b>Tus observaciones:</b> ${esc(c.observaciones)}</p>` : ''}
        ${c.notas_migracion ? `<p style="font-size:var(--tx-xs);color:var(--t3)">${esc(c.notas_migracion)}</p>` : ''}

        <div class="btn-fila" style="margin-top:20px">
          <button class="btn" onclick="APP.formCafe('${c.id}')">Editar ficha</button>
          <button class="btn btn-peligro" onclick="APP.borrarCafe('${c.id}')">Eliminar</button>
        </div>
      </div>

      <div data-panel="bolsas" style="display:none">
        ${lotes.length ? lotes.map(l => {
          const movs = DB.movimientosDe(l.id);
          return `<div class="card card-p" style="margin-bottom:14px">
            <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px">
              <b>${esc(ETIQUETA_ESTADO[l.estado] || l.estado)}</b>
              <span class="chip ${CHIP_ESTADO[l.estado] || ''}">${DB.num(l.gramos_disponibles, 0)} / ${DB.num(l.gramos_iniciales, 0)} g</span>
            </div>
            <div class="datos" style="margin-top:10px">
              ${l.fecha_compra ? `<div class="dato"><span class="dato-k">Comprada</span><span class="dato-v">${DB.fecha(l.fecha_compra)}</span></div>` : ''}
              ${l.fecha_tueste ? `<div class="dato"><span class="dato-k">Tostada</span><span class="dato-v">${DB.fecha(l.fecha_tueste)} · ${DB.diasDesdeTueste(l)} días</span></div>` : ''}
              ${l.fecha_apertura ? `<div class="dato"><span class="dato-k">Abierta</span><span class="dato-v">${DB.fecha(l.fecha_apertura)}</span></div>` : ''}
              ${l.fecha_termino ? `<div class="dato"><span class="dato-k">Terminada</span><span class="dato-v">${DB.fecha(l.fecha_termino)}</span></div>` : ''}
              ${l.precio_pagado ? `<div class="dato"><span class="dato-k">Precio</span><span class="dato-v">${DB.clp(l.precio_pagado)} · ${DB.clp(l.costo_por_100g)}/100 g</span></div>` : ''}
              ${l.lugar_compra ? `<div class="dato"><span class="dato-k">Comprada en</span><span class="dato-v">${esc(l.lugar_compra)}</span></div>` : ''}
              ${l.origen_adquisicion !== 'personal' ? `<div class="dato"><span class="dato-k">Origen</span><span class="dato-v">${esc(l.origen_adquisicion)}</span></div>` : ''}
            </div>
            ${l.observaciones ? `<p style="font-size:var(--tx-xs);color:var(--t3);margin:10px 0 0">${esc(l.observaciones)}</p>` : ''}
            <div class="btn-fila" style="margin-top:12px">
              <button class="btn" onclick="APP.formMovimiento('${l.id}')">Registrar movimiento</button>
              <button class="btn btn-fant" onclick="APP.formLote('${c.id}','${l.id}')">Editar bolsa</button>
            </div>
            ${movs.length ? `<details class="avanzado" style="margin-top:12px">
              <summary>Movimientos (${movs.length})</summary>
              <div style="margin-top:10px">${movs.map(m => {
                const g = DB.num(m.gramos, 0);
                return `<div class="mov">
                  <span class="mov-g ${g > 0 ? 'entra' : g < 0 ? 'sale' : ''}">${g > 0 ? '+' : ''}${g === 0 ? '—' : g + ' g'}</span>
                  <span class="mov-d">
                    <span class="mov-t">${esc(ETIQUETA_MOV[m.tipo] || m.tipo)}</span>
                    <span class="mov-m">${DB.fecha(m.fecha)}${m.motivo ? ' · ' + esc(m.motivo) : ''}</span>
                  </span>
                </div>`;
              }).join('')}</div>
              <p style="font-size:var(--tx-xs);color:var(--t3);margin-top:10px">
                Los movimientos no se borran. Para corregir uno se registra el movimiento inverso, así el historial queda completo.
              </p>
            </details>` : ''}
          </div>`;
        }).join('') : '<p style="color:var(--t3);font-size:var(--tx-sm)">Sin bolsas registradas.</p>'}
        <button class="btn btn-pri btn-bloque" onclick="APP.formLote('${c.id}')">＋ Agregar otra bolsa</button>
      </div>

      <div data-panel="historial" style="display:none">
        ${preps.length ? preps.map(p => filaPreparacion(p)).join('') : `
          <div class="vacio"><div class="vacio-ico" aria-hidden="true">▽</div>
          <h3>Sin preparaciones</h3><p>Cuando prepares este café y lo registres, acá vas a poder comparar qué funcionó.</p></div>`}
      </div>

      <div data-panel="sabores" style="display:none">${tarjetaSabores(c.id)}</div>`;

    abrirModal(c.nombre, html);
    engancharSubtabs();
  }

  /* ============================================================
     RUEDA DE SABORES · comparación tostador vs. lo que catastraste (F-04 fase 2)
     ============================================================ */
  function tarjetaSabores(cafeId) {
    const c = DB.cafe(cafeId);
    const tuyos0 = DB.descriptoresDeCafe(cafeId);
    const tuyos = MOTOR.compararSabores(c.notas_tostador, tuyos0);
    const porCategoria = {};
    tuyos.forEach(d => { (porCategoria[d.categoria.id] = porCategoria[d.categoria.id] || []).push(d); });
    const categorias = [...DB.estado.catDescriptores]
      .filter(cat => (porCategoria[cat.id] || []).length)
      .sort((a, b) => DB.num(a.orden, 100) - DB.num(b.orden, 100));

    return `
      <div class="seccion">
        <div class="seccion-tit">Notas declaradas por el tostador</div>
        ${c.notas_tostador
          ? `<p style="font-size:var(--tx-sm);color:var(--t2);margin:0">${esc(c.notas_tostador)}</p>`
          : '<p class="pista">Esta bolsa no tiene notas del tostador registradas.</p>'}
      </div>

      <div class="seccion" style="margin-top:20px">
        <div class="seccion-tit">Lo que tú reconociste (${tuyos.length})</div>
        ${!tuyos.length ? `<div class="nota">Todavía no has anotado sabores de este café.
            Cuando evalúes una preparación y abras "Detallar…", los sabores que marques van a aparecer acá,
            comparados con lo que declara el tostador.</div>`
          : categorias.map(cat => `
            <details class="avanzado" open style="margin-bottom:8px">
              <summary>${esc(cat.nombre)} (${porCategoria[cat.id].length})</summary>
              <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px">
                ${porCategoria[cat.id].sort((a, b) => b.n - a.n).map(d => `
                  <span class="chip ${d.esDefecto ? 'bad' : ''}">${esc(d.descriptor.nombre)}
                    <small style="opacity:.7">×${d.n} · int. ${d.intensidadProm}</small>${d.coincideTostador ? ' · ✓ tostador' : ''}
                  </span>`).join('')}
              </div>
            </details>`).join('')}
      </div>`;
  }

  function engancharSubtabs() {
    const cont = $('#modalCuerpo');
    cont.querySelectorAll('.subtab').forEach(b => b.onclick = () => {
      cont.querySelectorAll('.subtab').forEach(x => x.setAttribute('aria-selected', x === b));
      cont.querySelectorAll('[data-panel]').forEach(p => p.style.display = p.dataset.panel === b.dataset.st ? '' : 'none');
    });
  }

  function filaPreparacion(p) {
    const c = DB.cafe(p.coffee_id);
    const cata = DB.cataDe(p.id);
    const pts = MOTOR.puntuacionDe(p);
    const nSabores = cata ? DB.descriptoresDeCata(cata.id).length : 0;
    return `<div class="card card-p" style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline">
        <b>${esc(DB.metodo(p.method_id).nombre)}</b>
        <span style="font-size:var(--tx-xs);color:var(--t3)">${DB.fecha(p.fecha)}</span>
      </div>
      ${c ? `<div style="font-size:var(--tx-sm);color:var(--t2)">${esc(c.nombre)}</div>` : ''}
      <div class="cafe-meta" style="margin-top:8px">
        <span><b>${p.dosis_g}</b> g</span><span><b>${p.agua_g}</b> g agua</span>
        <span>1:${p.ratio ? (+p.ratio).toFixed(1) : '—'}</span>
        ${p.temperatura_c ? `<span>${p.temperatura_c} °C</span>` : ''}
        ${p.molienda_ajuste != null ? `<span>mol. ${p.molienda_ajuste}</span>` : ''}
        ${p.tiempo_total_seg ? `<span>${DB.segundosATexto(p.tiempo_total_seg)}</span>` : ''}
        ${p.dias_desde_tueste != null ? `<span>${p.dias_desde_tueste} d del tueste</span>` : ''}
      </div>
      ${pts !== null ? `<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;align-items:center">
          <span class="chip ${pts >= 8 ? 'ok' : pts >= 6 ? '' : 'warn'}">${pts.toFixed(1)}/10${cata && cata.valoracion_1a5 && cata.puntuacion_personal === null ? ' (desde 1–5)' : ''}</span>
          ${nSabores ? `<span class="chip">${nSabores} sabor${nSabores === 1 ? '' : 'es'}</span>` : ''}
        </div>` : `
        <div style="margin-top:8px"><button class="btn btn-pri" onclick="APP.formEvaluacion('${p.id}')">Evaluar ahora</button></div>`}
      ${p.comentarios ? `<p style="font-size:var(--tx-sm);color:var(--t2);margin:8px 0 0">${esc(p.comentarios)}</p>` : ''}
      ${p.ajuste_sugerido ? `<p style="font-size:var(--tx-xs);color:var(--t3);margin:6px 0 0"><b>Para la próxima:</b> ${esc(p.ajuste_sugerido)}</p>` : ''}
      ${p.notas_migracion ? `<p style="font-size:var(--tx-xs);color:var(--t3);margin:6px 0 0">${esc(p.notas_migracion)}</p>` : ''}
      <div class="btn-fila" style="margin-top:10px">
        <button class="btn btn-fant" onclick="APP.prepararCon('${p.coffee_id}','${p.lot_id || ''}','${p.method_id}',${p.dosis_g},${p.agua_g},${p.temperatura_c || 'null'},${p.molienda_ajuste === null ? 'null' : p.molienda_ajuste},${p.tiempo_total_seg || 'null'})">Repetir</button>
        ${pts !== null ? `<button class="btn btn-fant" onclick="APP.formEvaluacion('${p.id}')">${nSabores ? 'Editar evaluación' : '＋ Anotar sabores'}</button>` : ''}
        <button class="btn btn-fant" onclick="APP.borrarPreparacion('${p.id}')">Eliminar</button>
      </div>
    </div>`;
  }

  /* ============================================================
     FORMULARIO DE CAFÉ + BOLSA (flujo 1, art. 40)
     ============================================================ */
  function formCafe(id) {
    const c = id ? DB.cafe(id) : null;
    const procesos = DB.estado.procesos.filter(p => !p.user_id);
    const html = `
      <form id="fmCafe" novalidate>
        <div class="campo">
          <label for="cNombre">Nombre del café *</label>
          <input id="cNombre" required value="${esc(c ? c.nombre : '')}" placeholder="Ej: Huila Natural">
          <div class="msg-error">Necesito al menos el nombre.</div>
        </div>
        <div class="grid2">
          <div class="campo"><label for="cTostador">Tostador</label>
            <input id="cTostador" list="lstTostadores" value="${esc(c ? nombreTostador(c) : '')}">
            <datalist id="lstTostadores">${DB.estado.tostadores.map(t => `<option value="${esc(t.nombre)}">`).join('')}</datalist>
          </div>
          <div class="campo"><label for="cProceso">Proceso</label>
            <select id="cProceso">${procesos.map(p =>
              `<option value="${esc(p.id)}" ${c && c.proceso_id === p.id ? 'selected' : ''}>${esc(p.nombre)}</option>`).join('')}</select>
          </div>
        </div>
        <div class="grid2">
          <div class="campo"><label for="cPais">País</label><input id="cPais" value="${esc(c ? c.pais : '')}"></div>
          <div class="campo"><label for="cRegion">Región</label><input id="cRegion" value="${esc(c ? c.region : '')}"></div>
        </div>
        <div class="campo"><label for="cNotas">Notas que declara la bolsa</label>
          <textarea id="cNotas" placeholder="Separa con punto y coma: durazno; miel; cacao">${esc(c ? c.notas_tostador : '')}</textarea>
          <div class="pista">Son las notas del tostador. Lo que percibas tú se registra al evaluar cada preparación.</div>
        </div>

        <details class="avanzado" ${c ? '' : ''}>
          <summary>Datos de origen (opcional)</summary>
          <div style="margin-top:12px">
            <div class="grid2">
              <div class="campo"><label for="cFinca">Finca</label><input id="cFinca" value="${esc(c ? c.finca : '')}"></div>
              <div class="campo"><label for="cProductor">Productor</label><input id="cProductor" value="${esc(c ? c.productor : '')}"></div>
            </div>
            <div class="grid2">
              <div class="campo"><label for="cVariedad">Variedad</label><input id="cVariedad" value="${esc(c ? c.variedad : '')}"></div>
              <div class="campo"><label for="cTueste">Perfil de tueste</label>
                <select id="cTueste"><option value="">Sin dato</option>
                  ${['claro', 'medio-claro', 'medio', 'medio-oscuro', 'oscuro'].map(t =>
                    `<option value="${t}" ${c && c.perfil_tueste === t ? 'selected' : ''}>${t}</option>`).join('')}
                </select></div>
            </div>
            <div class="grid2">
              <div class="campo"><label for="cAltMin">Altitud mínima (msnm)</label>
                <input id="cAltMin" type="number" inputmode="numeric" min="200" max="3500" value="${c && c.altitud_min_msnm ? c.altitud_min_msnm : ''}"></div>
              <div class="campo"><label for="cAltMax">Altitud máxima</label>
                <input id="cAltMax" type="number" inputmode="numeric" min="200" max="3500" value="${c && c.altitud_max_msnm ? c.altitud_max_msnm : ''}"></div>
            </div>
            <div class="campo"><label for="cPuntaje">Puntaje que declara el tostador</label>
              <input id="cPuntaje" type="number" inputmode="decimal" step="0.5" min="0" max="100" value="${c && c.puntaje_declarado ? c.puntaje_declarado : ''}">
              <div class="pista">Es lo que dice la bolsa. No es tu evaluación ni un puntaje certificado.</div>
            </div>
            <div class="campo"><label for="cObs">Tus observaciones</label>
              <textarea id="cObs">${esc(c ? c.observaciones : '')}</textarea></div>
          </div>
        </details>

        ${!c ? `<fieldset>
          <legend>La bolsa que compraste</legend>
          <div class="grid2">
            <div class="campo"><label for="lGramos">Peso de la bolsa (g) *</label>
              <input id="lGramos" type="number" inputmode="decimal" step="1" min="1" value="250" required>
              <div class="msg-error">El peso tiene que ser mayor que cero.</div></div>
            <div class="campo"><label for="lPrecio">Precio pagado</label>
              <input id="lPrecio" type="number" inputmode="numeric" step="1" min="0" placeholder="15000"></div>
          </div>
          <div class="grid2">
            <div class="campo"><label for="lTueste">Fecha de tueste</label><input id="lTueste" type="date" max="${DB.hoy()}"></div>
            <div class="campo"><label for="lCompra">Fecha de compra</label><input id="lCompra" type="date" value="${DB.hoy()}" max="${DB.hoy()}"></div>
          </div>
          <div class="grid2">
            <div class="campo"><label for="lEstado">¿Ya la abriste?</label>
              <select id="lEstado"><option value="sin_abrir">Todavía cerrada</option><option value="abierto">Sí, ya está abierta</option></select></div>
            <div class="campo"><label for="lOrigen">Cómo llegó</label>
              <select id="lOrigen">
                <option value="personal">La compré</option><option value="regalo">Regalo</option>
                <option value="muestra">Muestra</option><option value="colaboracion">Colaboración</option>
              </select></div>
          </div>
          <div class="campo"><label for="lLugar">Dónde la compraste</label><input id="lLugar" placeholder="Tienda, web, cafetería…"></div>
        </fieldset>` : ''}

        <div class="btn-fila">
          <button type="submit" class="btn btn-pri" style="flex:1">${c ? 'Guardar cambios' : 'Guardar café'}</button>
          <button type="button" class="btn" onclick="APP.cerrarModal()">Cancelar</button>
        </div>
      </form>`;

    abrirModal(c ? 'Editar ' + c.nombre : 'Agregar café', html);
    $('#fmCafe').onsubmit = e => { e.preventDefault(); guardarCafe(id); };
  }

  async function guardarCafe(id) {
    const nombre = $('#cNombre').value.trim();
    const campoNombre = $('#cNombre').closest('.campo');
    campoNombre.classList.toggle('error', !nombre);
    if (!nombre) { $('#cNombre').focus(); return; }

    const gramos = id ? null : DB.num($('#lGramos').value);
    if (!id) {
      const cg = $('#lGramos').closest('.campo');
      cg.classList.toggle('error', !(gramos > 0));
      if (!(gramos > 0)) { $('#lGramos').focus(); return; }
    }

    try {
      const roasterId = await DB.asegurarTostador($('#cTostador').value);
      const datos = {
        nombre, roaster_id: roasterId,
        pais: $('#cPais').value.trim() || null,
        region: $('#cRegion').value.trim() || null,
        proceso_id: $('#cProceso').value,
        notas_tostador: $('#cNotas').value.trim() || null,
        finca: ($('#cFinca') || {}).value ? $('#cFinca').value.trim() : null,
        productor: ($('#cProductor') || {}).value ? $('#cProductor').value.trim() : null,
        variedad: ($('#cVariedad') || {}).value ? $('#cVariedad').value.trim() : null,
        perfil_tueste: ($('#cTueste') || {}).value || null,
        altitud_min_msnm: DB.num(($('#cAltMin') || {}).value),
        altitud_max_msnm: DB.num(($('#cAltMax') || {}).value) || DB.num(($('#cAltMin') || {}).value),
        puntaje_declarado: DB.num(($('#cPuntaje') || {}).value),
        observaciones: ($('#cObs') || {}).value ? $('#cObs').value.trim() : null
      };

      if (id) {
        await DB.editarCafe(id, datos);
        toast('Ficha actualizada.');
      } else {
        const r = await DB.nuevoCafe(datos);
        const nuevo = r.datos && r.datos[0];
        if (nuevo) {
          await DB.nuevoLote({
            coffee_id: nuevo.id,
            gramos_iniciales: gramos,
            precio_pagado: DB.num($('#lPrecio').value),
            fecha_tueste: $('#lTueste').value || null,
            fecha_compra: $('#lCompra').value || null,
            estado: $('#lEstado').value,
            origen_adquisicion: $('#lOrigen').value,
            lugar_compra: $('#lLugar').value.trim() || null,
            stock_minimo_g: DB.num(DB.estado.perfil && DB.estado.perfil.stock_minimo_g, 50)
          });
          if ($('#lEstado').value === 'abierto') {
            await DB.sincronizar();
          }
          toast('Café y bolsa guardados.');
        } else {
          // Sin conexión el café queda en la cola, pero todavía no tiene id,
          // así que la bolsa no se puede asociar. Se avisa en vez de perderla en silencio.
          toast('Café guardado aquí. Cuando vuelva la conexión se sube y tendrás que agregar la bolsa con sus gramos.', 'error');
        }
      }
      cerrarModal();
      await recargar();
    } catch (e) {
      DB.registrarError('guardarCafe', e);
      toast(mensajeError(e), 'error');
    }
  }

  function formLote(cafeId, loteId) {
    const l = loteId ? DB.lote(loteId) : null;
    const c = DB.cafe(cafeId);
    const html = `<form id="fmLote" novalidate>
      <p style="font-size:var(--tx-sm);color:var(--t2);margin:0 0 16px">${esc(c ? c.nombre : '')}</p>
      <div class="grid2">
        <div class="campo"><label for="loGramos">Peso inicial (g) *</label>
          <input id="loGramos" type="number" step="1" min="1" required value="${l ? DB.num(l.gramos_iniciales, '') : 250}">
          <div class="msg-error">Tiene que ser mayor que cero.</div></div>
        <div class="campo"><label for="loPrecio">Precio</label>
          <input id="loPrecio" type="number" step="1" min="0" value="${l && l.precio_pagado ? l.precio_pagado : ''}"></div>
      </div>
      <div class="grid2">
        <div class="campo"><label for="loTueste">Fecha de tueste</label>
          <input id="loTueste" type="date" max="${DB.hoy()}" value="${l && l.fecha_tueste ? l.fecha_tueste : ''}"></div>
        <div class="campo"><label for="loCompra">Fecha de compra</label>
          <input id="loCompra" type="date" max="${DB.hoy()}" value="${l && l.fecha_compra ? l.fecha_compra : DB.hoy()}"></div>
      </div>
      <div class="grid2">
        <div class="campo"><label for="loMin">Aviso cuando queden menos de (g)</label>
          <input id="loMin" type="number" step="1" min="0" value="${l ? DB.num(l.stock_minimo_g, 50) : 50}"></div>
        <div class="campo"><label for="loUbi">Dónde la guardas</label>
          <input id="loUbi" value="${esc(l ? l.ubicacion : '')}" placeholder="Despensa, frasco hermético…"></div>
      </div>
      <div class="campo"><label for="loLugar">Dónde la compraste</label>
        <input id="loLugar" value="${esc(l ? l.lugar_compra : '')}"></div>
      <div class="campo"><label for="loObs">Observaciones</label>
        <textarea id="loObs">${esc(l ? l.observaciones : '')}</textarea></div>
      ${l ? `<div class="nota nota-info">Los gramos disponibles (${DB.num(l.gramos_disponibles, 0)} g) no se editan acá:
        se calculan desde los movimientos. Si el número no cuadra, registra un ajuste con su motivo.</div>` : ''}
      <div class="btn-fila">
        <button type="submit" class="btn btn-pri" style="flex:1">Guardar</button>
        <button type="button" class="btn" onclick="APP.cerrarModal()">Cancelar</button>
      </div>
    </form>`;

    abrirModal(l ? 'Editar bolsa' : 'Nueva bolsa', html);
    $('#fmLote').onsubmit = async e => {
      e.preventDefault();
      const g = DB.num($('#loGramos').value);
      const cg = $('#loGramos').closest('.campo');
      cg.classList.toggle('error', !(g > 0));
      if (!(g > 0)) return;
      const datos = {
        gramos_iniciales: g,
        precio_pagado: DB.num($('#loPrecio').value),
        fecha_tueste: $('#loTueste').value || null,
        fecha_compra: $('#loCompra').value || null,
        stock_minimo_g: DB.num($('#loMin').value, 50),
        ubicacion: $('#loUbi').value.trim() || null,
        lugar_compra: $('#loLugar').value.trim() || null,
        observaciones: $('#loObs').value.trim() || null
      };
      try {
        if (l) await DB.editarLote(l.id, datos);
        else await DB.nuevoLote({ ...datos, coffee_id: cafeId, estado: 'sin_abrir' });
        toast('Bolsa guardada.');
        cerrarModal();
        await recargar();
      } catch (err) { toast(mensajeError(err), 'error'); }
    };
  }

  /* ============================================================
     MOVIMIENTOS DE INVENTARIO (art. 7)
     ============================================================ */
  function formMovimiento(loteId) {
    const activos = DB.estado.lotes.filter(l => !['descartado'].includes(l.estado));
    if (!activos.length) { toast('Primero agrega una bolsa.', 'error'); return; }
    const sel = loteId || activos[0].id;

    const html = `<form id="fmMov" novalidate>
      <div class="campo"><label for="mvLote">Bolsa</label>
        <select id="mvLote">${activos.map(l => {
          const c = DB.cafe(l.coffee_id);
          return `<option value="${l.id}" ${l.id === sel ? 'selected' : ''}>${esc(c ? c.nombre : '—')} · ${DB.num(l.gramos_disponibles, 0)} g</option>`;
        }).join('')}</select></div>

      <div class="campo"><label for="mvTipo">Qué pasó</label>
        <select id="mvTipo">
          <option value="devolucion">Me devolvieron café (entra)</option>
          <option value="apertura">Abrí la bolsa</option>
          <option value="merma">Se echó a perder (sale)</option>
          <option value="regalo">La regalé (sale)</option>
          <option value="muestra">Di una muestra (sale)</option>
          <option value="descarte">La descarté (sale)</option>
          <option value="ajuste">Corregir el saldo</option>
        </select></div>

      <div class="campo" id="mvCampoG"><label for="mvGramos">Gramos</label>
        <input id="mvGramos" type="number" inputmode="decimal" step="0.1" min="0" placeholder="0">
        <div class="pista" id="mvPista"></div>
        <div class="msg-error">Los gramos tienen que ser mayores que cero.</div></div>

      <div class="campo" id="mvCampoSigno" style="display:none"><label for="mvSigno">Dirección del ajuste</label>
        <select id="mvSigno"><option value="-1">Quitar gramos</option><option value="1">Agregar gramos</option></select></div>

      <div class="campo"><label for="mvFecha">Fecha</label>
        <input id="mvFecha" type="date" value="${DB.hoy()}" max="${DB.hoy()}"></div>

      <div class="campo"><label for="mvMotivo">Motivo <span id="mvOblig" style="display:none">(obligatorio)</span></label>
        <input id="mvMotivo" placeholder="Ej: pesé la bolsa y no cuadraba">
        <div class="msg-error">Un ajuste manual necesita un motivo de al menos 3 letras.</div></div>

      <div class="btn-fila">
        <button type="submit" class="btn btn-pri" style="flex:1">Registrar</button>
        <button type="button" class="btn" onclick="APP.cerrarModal()">Cancelar</button>
      </div>
      <div class="nota nota-info">¿Compraste más de este café? Eso es una <b>bolsa nueva</b>, no un movimiento:
        tiene su propia fecha de tueste y su propio precio. Si se mezclaran en una sola bolsa, los días
        desde el tueste y el costo por taza dejarían de servir.
        <div style="margin-top:10px"><button type="button" class="btn" id="mvNuevaBolsa">Agregar otra bolsa</button></div>
      </div>
      <p style="font-size:var(--tx-xs);color:var(--t3);margin-top:12px">
        Todo movimiento queda en el historial y no se borra. Los gramos disponibles se recalculan solos.</p>
    </form>`;

    abrirModal('Movimiento de inventario', html);

    const sincronizarForm = () => {
      const tipo = $('#mvTipo').value;
      const l = DB.lote($('#mvLote').value);
      $('#mvCampoG').style.display = tipo === 'apertura' ? 'none' : '';
      $('#mvCampoSigno').style.display = tipo === 'ajuste' ? '' : 'none';
      $('#mvOblig').style.display = tipo === 'ajuste' ? '' : 'none';
      const sale = ['merma', 'regalo', 'muestra', 'descarte'].includes(tipo);
      $('#mvPista').textContent = sale && l
        ? `Disponible ahora: ${DB.num(l.gramos_disponibles, 0)} g. No puedes sacar más que eso.`
        : tipo === 'ajuste' && l ? `El saldo actual es ${DB.num(l.gramos_disponibles, 0)} g.` : '';
    };
    $('#mvTipo').onchange = sincronizarForm;
    $('#mvLote').onchange = sincronizarForm;
    sincronizarForm();

    $('#mvNuevaBolsa').onclick = () => {
      const l = DB.lote($('#mvLote').value);
      if (l) formLote(l.coffee_id);
    };

    $('#fmMov').onsubmit = async e => {
      e.preventDefault();
      const tipo = $('#mvTipo').value;
      const motivo = $('#mvMotivo').value.trim();
      let gramos = DB.num($('#mvGramos').value, 0);

      if (tipo === 'ajuste' && motivo.length < 3) {
        $('#mvMotivo').closest('.campo').classList.add('error'); $('#mvMotivo').focus(); return;
      }
      $('#mvMotivo').closest('.campo').classList.remove('error');

      if (tipo !== 'apertura') {
        const ok = gramos > 0;
        $('#mvGramos').closest('.campo').classList.toggle('error', !ok);
        if (!ok) { $('#mvGramos').focus(); return; }
      }

      if (tipo === 'apertura') gramos = 0;
      else if (tipo === 'ajuste') gramos = gramos * DB.num($('#mvSigno').value, -1);
      else if (['merma', 'regalo', 'muestra', 'descarte'].includes(tipo)) gramos = -Math.abs(gramos);
      else gramos = Math.abs(gramos);

      try {
        await DB.nuevoMovimiento({
          lot_id: $('#mvLote').value, tipo, gramos,
          motivo: motivo || null, fecha: $('#mvFecha').value
        });
        toast('Movimiento registrado.');
        cerrarModal();
        await recargar();
      } catch (err) { toast(mensajeError(err), 'error'); }
    };
  }

  /* ============================================================
     VISTA 3 · PREPARAR
     ============================================================ */
  function renderPreparar() {
    const activos = DB.lotesActivos().filter(l => DB.num(l.gramos_disponibles, 0) > 0);
    let h = '';

    if (!activos.length) {
      h = `<div class="vacio"><div class="vacio-ico" aria-hidden="true">▽</div>
        <h3>No tienes café disponible</h3>
        <p>Agrega una bolsa con sus gramos y podrás preparar con temporizador y descuento automático.</p>
        <button class="btn btn-pri" onclick="APP.formCafe()">Agregar café</button></div>`;
      $('#prepararContenido').innerHTML = h;
      return;
    }

    h += `<div class="seccion"><div class="seccion-tit">Empieza acá</div>
      <div class="card card-p">${formQuePreparo()}</div></div>`;

    /* --- recetas guardadas --- */
    const recetas = DB.estado.recetas.filter(r => r.estado !== 'archivada');
    h += `<div class="seccion">
      <div class="seccion-tit">Tus recetas (${recetas.length})</div>
      ${recetas.length ? recetas.map(r => {
        const v = DB.versionActual(r.id);
        const c = r.coffee_id ? DB.cafe(r.coffee_id) : null;
        const usos = DB.estado.preparaciones.filter(p => p.recipe_id === r.id).length;
        return `<div class="card card-p" style="margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline">
            <b>${esc(r.nombre)}</b>
            <span class="chip ${r.estado === 'favorita' || r.estado === 'principal' ? 'ok' : ''}">${esc(r.estado)}</span>
          </div>
          <div style="font-size:var(--tx-xs);color:var(--t3);margin-top:3px">
            ${esc(DB.metodo(r.method_id).nombre)} · ${r.tipo === 'adaptada' ? 'adaptada a ' + esc(c ? c.nombre : '—') : 'receta base'}
            · versión ${v ? v.version : 1} · ${usos} preparacion${usos === 1 ? '' : 'es'}
          </div>
          ${v ? `<div class="cafe-meta" style="margin-top:8px">
            <span><b>${v.dosis_g}</b> g</span><span><b>${v.agua_g}</b> g agua</span>
            <span>1:${(+v.ratio).toFixed(1)}</span>
            ${v.temperatura_c ? `<span>${v.temperatura_c} °C</span>` : ''}
            ${v.molienda_ajuste != null ? `<span>mol. ${v.molienda_ajuste}</span>` : ''}
          </div>` : ''}
          <div class="btn-fila" style="margin-top:12px">
            ${v && c ? `<button class="btn btn-pri" onclick="APP.prepararCon('${c.id}','','${r.method_id}',${v.dosis_g},${v.agua_g},${v.temperatura_c || 'null'},${v.molienda_ajuste ?? 'null'},${v.tiempo_total_seg || 'null'},'${r.id}','${v.id}')">Preparar</button>` : ''}
            ${v ? `<button class="btn btn-fant" onclick="APP.formDuplicarReceta('${r.id}')">Duplicar y ajustar</button>` : ''}
          </div>
        </div>`;
      }).join('') : `<div class="nota">Todavía no tienes recetas guardadas. Cuando prepares algo que te guste, guárdalo como receta y podrás versionarlo.</div>`}
    </div>`;

    /* --- referencia por proceso (contenido heredado) --- */
    h += `<div class="seccion">
      <div class="seccion-tit">Referencia por proceso</div>
      <div class="nota nota-info">Estos rangos son un punto de partida general, no una receta para tu café en particular.
      Las recomendaciones de arriba sí toman en cuenta tu historial.</div>
      ${Object.entries(typeof RECETAS !== 'undefined' ? RECETAS : {}).map(([proc, d]) => `
        <details class="avanzado">
          <summary>${esc(proc)} — ${esc(d.perfil || '')}</summary>
          <p style="font-size:var(--tx-sm);color:var(--t2);margin:10px 0">${esc(d.char || '')}</p>
          ${d.tip ? `<p style="font-size:var(--tx-sm);color:var(--t2)">${esc(d.tip)}</p>` : ''}
          <table class="tabla"><thead><tr><th>Método</th><th>C3</th><th>Whirly</th><th>Temp</th><th>Tiempo</th></tr></thead>
          <tbody>${Object.entries(d.metodos || {}).map(([m, r]) => `
            <tr><td><b>${esc(m)}</b><div style="font-size:var(--tx-xs);color:var(--t3)">${esc(r.dosis || '')} · ${esc(r.agua || '')}</div></td>
            <td>${esc(r.C3 || '—')}</td><td>${esc(r.Whirly || '—')}</td>
            <td>${esc(r.temp || '—')}</td><td>${esc(r.tiempo || '—')}</td></tr>`).join('')}</tbody></table>
        </details>`).join('')}
    </div>`;

    $('#prepararContenido').innerHTML = h;
    engancharQuePreparo();
  }

  function prepararCon(cafeId, loteId, methodId, dosis, agua, temp, molienda, tiempo, recetaId, versionId) {
    if (!methodId) {
      // Vino desde una tarjeta sin método: usar el favorito o el primero disponible
      const r = MOTOR.recomendar({ cafeId, loteId, methodId: (DB.estado.perfil && DB.estado.perfil.metodo_favorito_id) || 'v60', perfilDeseado: 'mas_equilibrado' });
      if (!r) { toast('No pude armar una sugerencia para ese café.', 'error'); return; }
      return iniciarPreparacion(cafeId, loteId || (r.lote ? r.lote.id : ''), r.metodo.id, r.dosis_g, r.agua_g, r.temperatura_c, r.molienda, r.tiempo_total_seg);
    }
    iniciarPreparacion(cafeId, loteId, methodId, dosis, agua, temp, molienda, tiempo, recetaId, versionId);
  }

  /* ============================================================
     DUPLICAR Y AJUSTAR RECETA (F-03 fase 2)
     Crea la version siguiente sin tocar la anterior: el esquema
     versiona por diseño, esto solo agrega el boton.
     ============================================================ */
  function formDuplicarReceta(recetaId) {
    const r = DB.porId(DB.estado.recetas, recetaId);
    const v = DB.versionActual(recetaId);
    if (!r || !v) return;
    const siguiente = Math.max(...DB.versionesDe(recetaId).map(x => x.version), r.version_actual || 1) + 1;

    abrirModal('Duplicar y ajustar', `
      <p style="font-size:var(--tx-sm);color:var(--t2);margin:0 0 20px">
        ${esc(r.nombre)} · versión actual: ${v.version}. Se guarda como versión ${siguiente};
        la ${v.version} queda intacta en el historial.</p>
      <form id="fmDupReceta" novalidate>
        <div class="grid2">
          <div class="campo"><label for="drDosis">Dosis (g)</label>
            <input id="drDosis" type="number" inputmode="decimal" step="0.1" value="${v.dosis_g}">
            <div class="msg-error">La dosis tiene que ser mayor que cero.</div></div>
          <div class="campo"><label for="drAgua">Agua (g)</label>
            <input id="drAgua" type="number" inputmode="decimal" step="1" value="${v.agua_g}">
            <div class="msg-error">El agua tiene que ser mayor que cero.</div></div>
        </div>
        <div class="grid2">
          <div class="campo"><label for="drTemp">Temperatura (°C)</label>
            <input id="drTemp" type="number" inputmode="decimal" step="1" value="${v.temperatura_c ?? ''}"></div>
          <div class="campo"><label for="drMolienda">Molienda</label>
            <input id="drMolienda" type="number" inputmode="decimal" step="0.1" value="${v.molienda_ajuste ?? ''}"></div>
        </div>
        <div class="campo"><label for="drTiempo">Tiempo total (m:ss)</label>
          <input id="drTiempo" value="${v.tiempo_total_seg ? DB.segundosATexto(v.tiempo_total_seg) : ''}" placeholder="3:30"></div>
        <div class="campo"><label for="drNotas">Qué estás cambiando y por qué</label>
          <textarea id="drNotas" placeholder="Ej: molienda más fina porque la última vez salió aguada"></textarea>
          <div class="msg-error">Contá en unas palabras qué estás cambiando (mínimo 3 letras).</div>
          <div class="pista">Queda anotado en el historial de versiones de esta receta.</div></div>
        <div class="btn-fila">
          <button type="submit" class="btn btn-pri" style="flex:1">Guardar como versión ${siguiente}</button>
          <button type="button" class="btn" onclick="APP.cerrarModal()">Cancelar</button>
        </div>
      </form>`);

    $('#fmDupReceta').onsubmit = async e => {
      e.preventDefault();
      const dosis = DB.num($('#drDosis').value);
      const agua = DB.num($('#drAgua').value);
      const notas = $('#drNotas').value.trim();

      const okDosis = dosis > 0, okAgua = agua > 0, okNotas = notas.length >= 3;
      $('#drDosis').closest('.campo').classList.toggle('error', !okDosis);
      $('#drAgua').closest('.campo').classList.toggle('error', !okAgua);
      $('#drNotas').closest('.campo').classList.toggle('error', !okNotas);
      if (!okDosis || !okAgua || !okNotas) { (!okDosis ? $('#drDosis') : !okAgua ? $('#drAgua') : $('#drNotas')).focus(); return; }

      try {
        const rr = await DB.nuevaVersion({
          recipe_id: recetaId, version: siguiente, deriva_de: v.id,
          grinder_id: v.grinder_id || null,
          dosis_g: dosis, agua_g: agua,
          temperatura_c: DB.num($('#drTemp').value),
          molienda_ajuste: DB.num($('#drMolienda').value),
          tiempo_total_seg: DB.textoASegundos($('#drTiempo').value),
          bloom: v.bloom, bloom_agua_g: v.bloom_agua_g, bloom_seg: v.bloom_seg,
          agitacion: v.agitacion, velocidad_vertido: v.velocidad_vertido,
          tipo_filtro: v.tipo_filtro, tipo_agua: v.tipo_agua,
          notas_cambio: notas
        });
        await DB.editarReceta(recetaId, { version_actual: siguiente });
        toast(rr.encolado ? 'Guardado aquí. Se sube cuando vuelva la conexión.' : `Versión ${siguiente} guardada.`);
        cerrarModal();
        await recargar();
      } catch (err) { toast(mensajeError(err), 'error'); }
    };
  }

  /* ============================================================
     TEMPORIZADOR GUIADO (art. 12)
     ============================================================ */
  function iniciarPreparacion(cafeId, loteId, methodId, dosis, agua, temp, molienda, tiempo, recetaId, versionId) {
    const c = DB.cafe(cafeId);
    if (!c) return;
    let lote = loteId ? DB.lote(loteId) : null;
    if (!lote) lote = DB.lotesDe(cafeId).find(l => ['abierto', 'bajo_stock', 'sin_abrir'].includes(l.estado)) || null;

    const receta = {
      metodo: DB.metodo(methodId), dosis_g: dosis, agua_g: agua,
      temperatura_c: temp || 92, tiempo_total_seg: tiempo, parametros_metodo: {}
    };
    const pasos = MOTOR.generarPasos(receta);

    temporizador = {
      cafeId, loteId: lote ? lote.id : null, methodId, recetaId: recetaId || null, versionId: versionId || null,
      dosis, agua, temp: temp || 92, molienda, tiempoObjetivo: tiempo,
      pasos, indice: 0, segundos: 0, corriendo: false, intervalo: null, marcas: []
    };

    pintarTemporizador();
  }

  function pintarTemporizador() {
    const t = temporizador;
    const c = DB.cafe(t.cafeId);
    const lote = t.loteId ? DB.lote(t.loteId) : null;
    const paso = t.pasos[t.indice];

    const html = `
      <p style="font-size:var(--tx-sm);color:var(--t2);margin:0 0 4px">${esc(c.nombre)} · ${esc(DB.metodo(t.methodId).nombre)}</p>
      <div class="cafe-meta" style="margin-bottom:16px">
        <span><b>${t.dosis}</b> g</span><span><b>${t.agua}</b> g agua</span>
        <span>1:${(t.agua / t.dosis).toFixed(1)}</span><span>${t.temp} °C</span>
        ${t.molienda !== null && t.molienda !== undefined ? `<span>mol. ${t.molienda}</span>` : ''}
      </div>

      <div class="timer-wrap">
        <div class="timer-reloj" id="tmReloj" role="timer" aria-live="off">${DB.segundosATexto(t.segundos)}</div>
        ${paso && paso.agua_objetivo_g ? `<div class="timer-obj">Agua acumulada: <b>${paso.agua_objetivo_g} g</b></div>` : ''}
        <div class="btn-fila" style="justify-content:center;margin-top:20px">
          <button class="btn" id="tmAtras" ${t.indice === 0 ? 'disabled' : ''} aria-label="Paso anterior">‹ Atrás</button>
          <button class="btn btn-pri" id="tmPlay" style="min-width:130px">${t.corriendo ? '⏸ Pausar' : t.segundos ? '▶ Seguir' : '▶ Iniciar'}</button>
          <button class="btn" id="tmSig">${t.indice >= t.pasos.length - 1 ? 'Terminar ›' : 'Siguiente ›'}</button>
        </div>
      </div>

      <div style="margin-top:20px">
        ${t.pasos.map((p, i) => `
          <div class="paso ${i === t.indice ? 'actual' : i < t.indice ? 'hecho' : ''}">
            <span class="paso-n">${String(i + 1).padStart(2, '0')}</span>
            <span class="paso-txt">
              <span class="paso-t">${esc(p.tipo)}</span>
              <div>${esc(p.instruccion)}</div>
              ${p.segundo_inicio !== null && p.segundo_inicio !== undefined
                ? `<div class="paso-tiempo">${DB.segundosATexto(p.segundo_inicio)}${p.segundo_fin ? ' → ' + DB.segundosATexto(p.segundo_fin) : ''}${p.agua_objetivo_g ? ' · hasta ' + p.agua_objetivo_g + ' g' : ''}</div>`
                : ''}
            </span>
          </div>`).join('')}
      </div>

      <div class="nota nota-info">Cuando termines vas a poder corregir los gramos reales que usaste.
      ${lote ? `Se van a descontar de <b>${esc(c.nombre)}</b> (quedan ${DB.num(lote.gramos_disponibles, 0)} g).`
              : 'No hay bolsa asociada, así que no se descuenta nada del inventario.'}</div>

      <button class="btn btn-fant btn-bloque" id="tmCancelar">Cancelar sin guardar</button>`;

    abrirModal('Preparando', html);

    $('#tmPlay').onclick = () => { t.corriendo ? pausar() : arrancar(); };
    $('#tmAtras').onclick = () => { if (t.indice > 0) { t.indice--; pintarTemporizador(); } };
    $('#tmSig').onclick = () => {
      t.marcas.push({ paso: t.indice + 1, tipo: t.pasos[t.indice].tipo, segundo: t.segundos });
      if (t.indice >= t.pasos.length - 1) { pausar(); formCerrarPreparacion(); }
      else { t.indice++; avisar(); pintarTemporizador(); }
    };
    $('#tmCancelar').onclick = async () => {
      pausar();
      if (await confirmar('Cancelar la preparación', 'No se va a guardar nada ni se va a descontar café. ¿Seguro?', 'Sí, cancelar', true)) {
        temporizador = null; cerrarModal();
      } else { pintarTemporizador(); }
    };
  }

  function arrancar() {
    const t = temporizador;
    if (!t || t.corriendo) return;
    t.corriendo = true;
    t.intervalo = setInterval(() => {
      t.segundos++;
      const r = $('#tmReloj');
      if (r) r.textContent = DB.segundosATexto(t.segundos);
      const p = t.pasos[t.indice];
      if (p && p.segundo_fin && t.segundos === p.segundo_fin) avisar();
    }, 1000);
    const b = $('#tmPlay'); if (b) b.textContent = '⏸ Pausar';
  }

  function pausar() {
    const t = temporizador;
    if (!t) return;
    t.corriendo = false;
    clearInterval(t.intervalo);
    const b = $('#tmPlay'); if (b) b.textContent = '▶ Seguir';
  }

  function avisar() {
    if (navigator.vibrate) { try { navigator.vibrate([90, 60, 90]); } catch (e) { /* sin soporte */ } }
    const r = $('#tmReloj');
    if (r) { r.style.color = 'var(--ac)'; setTimeout(() => { r.style.color = ''; }, 550); }
  }

  /* ---------- cierre: gramos reales + evaluación ---------- */
  function formCerrarPreparacion() {
    const t = temporizador;
    const c = DB.cafe(t.cafeId);
    const lote = t.loteId ? DB.lote(t.loteId) : null;
    const disp = lote ? DB.num(lote.gramos_disponibles, 0) : null;

    abrirModal('Cerrar la preparación', `
      <form id="fmCerrar" novalidate>
        <p style="font-size:var(--tx-sm);color:var(--t2);margin:0 0 16px">
          ${esc(c.nombre)} · ${esc(DB.metodo(t.methodId).nombre)} · ${DB.segundosATexto(t.segundos)}</p>

        <div class="grid2">
          <div class="campo"><label for="czDosis">Gramos de café que usaste *</label>
            <input id="czDosis" type="number" inputmode="decimal" step="0.1" min="0.1" required value="${t.dosis}">
            <div class="pista">${disp !== null ? `Se descuentan de esta bolsa. Disponible: ${disp} g.` : 'Sin bolsa asociada: no se descuenta.'}</div>
            <div class="msg-error" id="czErrDosis">Revisa la dosis.</div></div>
          <div class="campo"><label for="czAgua">Gramos de agua *</label>
            <input id="czAgua" type="number" inputmode="decimal" step="1" min="1" required value="${t.agua}"></div>
        </div>
        <div class="grid2">
          <div class="campo"><label for="czTemp">Temperatura (°C)</label>
            <input id="czTemp" type="number" inputmode="numeric" min="1" max="100" value="${t.temp}"></div>
          <div class="campo"><label for="czTiempo">Tiempo total</label>
            <input id="czTiempo" value="${DB.segundosATexto(t.segundos)}" placeholder="3:30"></div>
        </div>
        <div class="grid2">
          <div class="campo"><label for="czMolienda">Molienda</label>
            <input id="czMolienda" type="number" inputmode="decimal" step="0.1" value="${t.molienda !== null && t.molienda !== undefined ? t.molienda : ''}"></div>
          <div class="campo"><label for="czContexto">Dónde</label>
            <select id="czContexto">
              <option value="casa">En casa</option><option value="trabajo">En el trabajo</option>
              <option value="viaje">De viaje</option><option value="exterior">Al aire libre</option>
              <option value="cafeteria">En una cafetería</option>
            </select></div>
        </div>
        <div class="campo"><label for="czComentarios">Comentarios</label>
          <textarea id="czComentarios" placeholder="Qué notaste, qué cambiarías…"></textarea></div>

        <div class="btn-fila">
          <button type="submit" class="btn btn-pri" style="flex:1">Guardar y evaluar</button>
          <button type="button" class="btn" id="czSoloGuardar">Solo guardar</button>
        </div>
      </form>`);

    const guardar = async (evaluar) => {
      const dosis = DB.num($('#czDosis').value);
      const agua = DB.num($('#czAgua').value);
      const cd = $('#czDosis').closest('.campo');
      let error = null;
      if (!(dosis > 0)) error = 'La dosis tiene que ser mayor que cero.';
      else if (disp !== null && dosis > disp + 0.01) error = `En esa bolsa quedan ${disp} g y estás registrando ${dosis} g.`;
      else if (!(agua > 0)) error = 'El agua tiene que ser mayor que cero.';
      cd.classList.toggle('error', !!error);
      if (error) { $('#czErrDosis').textContent = error; $('#czDosis').focus(); return; }

      try {
        const r = await DB.nuevaPreparacion({
          coffee_id: t.cafeId, lot_id: t.loteId, method_id: t.methodId,
          recipe_id: t.recetaId, version_id: t.versionId,
          grinder_id: (DB.estado.molinillos.find(g => g.es_principal) || {}).id || null,
          dosis_g: dosis, agua_g: agua,
          temperatura_c: DB.num($('#czTemp').value),
          tiempo_total_seg: DB.textoASegundos($('#czTiempo').value),
          molienda_ajuste: DB.num($('#czMolienda').value),
          contexto: $('#czContexto').value,
          comentarios: $('#czComentarios').value.trim() || null,
          tiempos_reales: t.marcas,
          fecha: DB.hoy()
        });
        const prep = r.datos && r.datos[0];
        temporizador = null;
        toast(r.encolado ? 'Guardado aquí. Se sube cuando vuelva la conexión.' : 'Preparación registrada y café descontado.');
        cerrarModal();
        await recargar();
        if (evaluar && prep) formEvaluacion(prep.id);
      } catch (e) {
        DB.registrarError('cerrarPreparacion', e);
        toast(mensajeError(e), 'error');
      }
    };

    $('#fmCerrar').onsubmit = e => { e.preventDefault(); guardar(true); };
    $('#czSoloGuardar').onclick = () => guardar(false);
  }

  /* ============================================================
     EVALUACIÓN + ASISTENTE DE AJUSTE (art. 14 y 16)
     ============================================================ */
  const evalTmp = { pts: null, meGusto: null, atributos: {}, diag: {}, recompra: null, descriptores: {} };

  /* Pinta la rueda de sabores agrupada por familia. seleccionInicial trae los
     descriptores ya elegidos (edicion de una cata existente). */
  function pintarSelectorSabores(seleccionInicial) {
    const porCat = {};
    DB.estado.descriptores.forEach(d => { (porCat[d.categoria_id] = porCat[d.categoria_id] || []).push(d); });
    const cats = [...DB.estado.catDescriptores].sort((a, b) => DB.num(a.orden, 100) - DB.num(b.orden, 100));
    if (!cats.some(c => (porCat[c.id] || []).length)) {
      return '<p class="pista">Todavía no hay descriptores de sabor cargados.</p>';
    }
    const yaSel = new Map(seleccionInicial.map(s => [s.descriptor_id, s]));
    return cats.filter(c => (porCat[c.id] || []).length).map(c => `
      <details class="avanzado">
        <summary>${esc(c.nombre)}${c.tipo === 'defecto' ? ' (defectos)' : ''}</summary>
        <div class="opciones" style="margin-top:10px">
          ${porCat[c.id].map(d => {
            const s = yaSel.get(d.id);
            const intensidad = s ? DB.num(s.intensidad, 3) : 3;
            return `
            <div class="sabor-fila" data-desc="${esc(d.id)}">
              <button type="button" class="opcion" data-defecto="${c.tipo === 'defecto'}" aria-pressed="${s ? 'true' : 'false'}">${esc(d.nombre)}</button>
              <div class="escala escala-mini" role="group" aria-label="Intensidad de ${esc(d.nombre)}" style="display:${s ? '' : 'none'}">
                ${[1, 2, 3, 4, 5].map(i => `<button type="button" data-v="${i}" aria-pressed="${intensidad === i}">${i}</button>`).join('')}
              </div>
            </div>`;
          }).join('')}
        </div>
      </details>`).join('');
  }

  function engancharSelectorSabores() {
    $$('.sabor-fila').forEach(fila => {
      const descId = fila.dataset.desc;
      const btn = fila.querySelector('.opcion');
      const escMini = fila.querySelector('.escala-mini');
      btn.onclick = () => {
        const activo = btn.getAttribute('aria-pressed') === 'true';
        if (activo) {
          btn.setAttribute('aria-pressed', 'false');
          escMini.style.display = 'none';
          delete evalTmp.descriptores[descId];
        } else {
          btn.setAttribute('aria-pressed', 'true');
          escMini.style.display = '';
          evalTmp.descriptores[descId] = { descriptor_id: descId, intensidad: 3, es_defecto: btn.dataset.defecto === 'true' };
        }
      };
      escMini.querySelectorAll('button').forEach(b => b.onclick = () => {
        escMini.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
        if (evalTmp.descriptores[descId]) evalTmp.descriptores[descId].intensidad = DB.num(b.dataset.v);
      });
    });
  }

  function formEvaluacion(prepId) {
    const p = DB.porId(DB.estado.preparaciones, prepId);
    if (!p) return;
    const c = DB.cafe(p.coffee_id);
    const ya = DB.cataDe(prepId);
    const sabsYa = ya ? DB.descriptoresDeCata(ya.id) : [];
    evalTmp.descriptores = {};
    sabsYa.forEach(s => { evalTmp.descriptores[s.descriptor_id] = { descriptor_id: s.descriptor_id, intensidad: DB.num(s.intensidad, 3), es_defecto: !!s.es_defecto }; });

    const atributos = [['aroma', 'Aroma'], ['dulzor', 'Dulzor'], ['acidez', 'Acidez'], ['cuerpo', 'Cuerpo'],
                       ['sabor', 'Sabor'], ['balance', 'Balance'], ['retrogusto', 'Retrogusto'],
                       ['claridad', 'Claridad'], ['complejidad', 'Complejidad'], ['uniformidad', 'Uniformidad'],
                       ['intensidad', 'Intensidad']];

    /* La columna es me_gusto, no meGusto: leerla mal dejaba la respuesta sin marcar
       al reabrir una evaluacion ya guardada. */
    evalTmp.atributos = {};
    if (ya) atributos.forEach(([k]) => { const v = DB.num(ya[k]); if (v !== null) evalTmp.atributos[k] = v; });
    Object.assign(evalTmp, {
      pts: ya ? DB.num(ya.puntuacion_personal) : null,
      meGusto: ya && ya.me_gusto !== null && ya.me_gusto !== undefined ? !!ya.me_gusto : null,
      recompra: c && c.recompraria !== null && c.recompraria !== undefined ? !!c.recompraria : null,
      diag: {}, prepId
    });
    const pres = (valor, esperado) => `aria-pressed="${valor === esperado ? 'true' : 'false'}"`;

    abrirModal('¿Cómo quedó?', `
      <p style="font-size:var(--tx-sm);color:var(--t2);margin:0 0 20px">
        ${esc(c ? c.nombre : '')} · ${esc(DB.metodo(p.method_id).nombre)} · ${DB.fecha(p.fecha)}</p>

      <div class="campo">
        <label id="lbPts">Tu puntuación, de 1 a 10</label>
        <div class="escala" role="group" aria-labelledby="lbPts" id="evPts">
          ${Array.from({ length: 10 }, (_, i) => `<button type="button" data-v="${i + 1}" ${pres(evalTmp.pts, i + 1)}>${i + 1}</button>`).join('')}
        </div>
        <div class="pista">Es tu puntuación personal, no un puntaje SCA ni una evaluación profesional.</div>
      </div>

      <div class="campo"><label id="lbGusto">¿Te gustó?</label>
        <div class="si-no" role="group" aria-labelledby="lbGusto" id="evGusto">
          <button type="button" data-v="1" ${pres(evalTmp.meGusto, true)}>Sí</button>
          <button type="button" data-v="0" ${pres(evalTmp.meGusto, false)}>No</button>
        </div></div>

      <details class="avanzado">
        <summary>Detallar los 11 atributos${Object.keys(evalTmp.atributos).length ? ` (${Object.keys(evalTmp.atributos).length} puestos)` : ''}…</summary>
        <div style="margin-top:12px">
          ${atributos.map(([k, l]) => `
            <div class="campo"><label id="lb-${k}">${l} (1 a 5)</label>
              <div class="escala" role="group" aria-labelledby="lb-${k}" data-attr="${k}">
                ${Array.from({ length: 5 }, (_, i) => `<button type="button" data-v="${i + 1}" ${pres(evalTmp.atributos[k], i + 1)}>${i + 1}</button>`).join('')}
              </div></div>`).join('')}
        </div>
      </details>

      <details class="avanzado" id="evSabores" ${sabsYa.length ? 'open' : ''}>
        <summary>Rueda de sabores: ¿qué reconociste?${sabsYa.length ? ` (${sabsYa.length})` : ''}</summary>
        <div class="pista" style="margin:10px 0">Marca los que sientas. Al elegir uno vas a poder ajustar la intensidad, de 1 a 5.
          Después los ves comparados con las notas del tostador en la ficha del café, pestaña Sabores.</div>
        ${pintarSelectorSabores(sabsYa)}
      </details>

      <fieldset><legend>Para saber qué ajustar</legend>
        <p style="font-size:var(--tx-xs);color:var(--t3);margin:0 0 8px">
          Responde lo que reconozcas. Con esto la app propone uno o dos cambios, no más.</p>
        ${MOTOR.PREGUNTAS.map(q => `
          <div class="pregunta">
            <p id="q-${q.id}">${esc(q.texto)}</p>
            <div class="si-no" role="group" aria-labelledby="q-${q.id}" data-diag="${q.id}">
              <button type="button" data-v="1" aria-pressed="false">Sí</button>
              <button type="button" data-v="0" aria-pressed="false">No</button>
            </div>
          </div>`).join('')}
      </fieldset>

      <div class="campo"><label for="evNotas">Notas de la taza</label>
        <textarea id="evNotas" placeholder="Qué sentiste: durazno, miel, cacao…">${esc(ya ? ya.notas : '')}</textarea>
        <div class="pista">Estas son <b>tus</b> notas. Las de la bolsa se guardan aparte, para poder compararlas.</div></div>

      <div class="campo"><label id="lbRec">¿Comprarías este café de nuevo?</label>
        <div class="si-no" role="group" aria-labelledby="lbRec" id="evRec">
          <button type="button" data-v="1" ${pres(evalTmp.recompra, true)}>Sí</button>
          <button type="button" data-v="0" ${pres(evalTmp.recompra, false)}>No</button>
        </div></div>

      <button class="btn btn-pri btn-bloque" id="evGuardar">Guardar evaluación</button>`);

    const grupo = (sel, alElegir) => {
      $$(sel + ' button').forEach(b => b.onclick = () => {
        const g = b.parentElement;
        g.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
        alElegir(DB.num(b.dataset.v), g);
      });
    };
    grupo('#evPts', v => { evalTmp.pts = v; });
    grupo('#evGusto', v => { evalTmp.meGusto = v === 1; });
    grupo('#evRec', v => { evalTmp.recompra = v === 1; });
    $$('[data-attr]').forEach(g => g.querySelectorAll('button').forEach(b => b.onclick = () => {
      g.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      evalTmp.atributos[g.dataset.attr] = DB.num(b.dataset.v);
    }));
    engancharSelectorSabores();
    $$('[data-diag]').forEach(g => g.querySelectorAll('button').forEach(b => b.onclick = () => {
      g.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      evalTmp.diag[g.dataset.diag] = b.dataset.v === '1';
    }));

    $('#evGuardar').onclick = async () => {
      if (evalTmp.pts === null && evalTmp.meGusto === null) {
        toast('Pon al menos una puntuación o si te gustó.', 'error'); return;
      }
      try {
        const hayDetalle = Object.keys(evalTmp.atributos).length || Object.keys(evalTmp.descriptores).length;
        const datos = {
          brew_session_id: prepId, modalidad: hayDetalle ? 'completa' : 'rapida',
          puntuacion_personal: evalTmp.pts, me_gusto: evalTmp.meGusto,
          compraria_de_nuevo: evalTmp.recompra,
          notas: $('#evNotas').value.trim() || null,
          diagnostico: evalTmp.diag, ...evalTmp.atributos
        };
        const r = ya ? await DB.editarCata(ya.id, datos) : await DB.nuevaCata(datos);
        const idCata = ya ? ya.id : (r.datos && r.datos[0] && r.datos[0].id);
        if (idCata) await DB.guardarDescriptoresCata(idCata, Object.values(evalTmp.descriptores));

        if (evalTmp.recompra !== null && c) {
          await DB.editarCafe(c.id, { recompraria: evalTmp.recompra });
        }

        const ajuste = MOTOR.sugerirAjuste(evalTmp.diag, p);
        if (ajuste.sugerencias.length) {
          await DB.editarPreparacion(prepId, {
            ajuste_variable: ajuste.sugerencias[0].variable,
            ajuste_sugerido: ajuste.sugerencias.map(s => s.que).join(' · ')
          });
        }
        cerrarModal();
        await recargar();
        mostrarAjuste(ajuste, p);
      } catch (e) {
        DB.registrarError('guardarEvaluacion', e);
        toast(mensajeError(e), 'error');
      }
    };
  }

  function mostrarAjuste(ajuste, prep) {
    abrirModal('Para la próxima', `
      <p style="font-size:var(--tx-sm);color:var(--t2)">${esc(ajuste.mensaje)}</p>
      ${ajuste.sugerencias.map(s => `
        <div class="reco" style="margin-top:14px">
          <div class="reco-tit">${esc(s.que)}</div>
          <p class="reco-porque">${esc(s.porque)}</p>
          <div class="reco-meta">Variable a mover: <b>${esc(s.variable)}</b> (${esc(s.delta)})</div>
        </div>`).join('')}
      ${ajuste.sinCambios ? '' : `<div class="nota nota-info">
        Cambia solo una cosa por vez. Si mueves molienda, temperatura y ratio a la vez, la próxima taza puede salir mejor
        pero no vas a saber por qué, y eso no se puede repetir.</div>`}
      <button class="btn btn-pri btn-bloque" style="margin-top:16px" onclick="APP.cerrarModal()">Entendido</button>`);
  }

  /* ============================================================
     VISTA 4 · BITÁCORA
     ============================================================ */
  let tabBitacora = 'preparaciones';

  function renderBitacora() {
    const sinEvaluar = DB.estado.preparaciones.filter(p => !DB.cataDe(p.id)).length;
    const tabs = [
      ['preparaciones', 'Preparaciones'], ['estadisticas', 'Estadísticas'],
      ['preferencias', 'Tus preferencias'], ['brechas', 'Qué te falta'], ['aprende', 'Aprende']
    ];
    $('#bitacoraTabs').innerHTML = tabs.map(([k, t]) =>
      `<button class="subtab" role="tab" aria-selected="${tabBitacora === k}" data-bt="${k}">${t}${k === 'preparaciones' && sinEvaluar ? ' ·' + sinEvaluar : ''}</button>`).join('');
    $$('#bitacoraTabs .subtab').forEach(b => b.onclick = () => { tabBitacora = b.dataset.bt; renderBitacora(); });

    if (tabBitacora === 'preparaciones') pintarBitacoraPreps();
    else if (tabBitacora === 'estadisticas') pintarEstadisticas();
    else if (tabBitacora === 'preferencias') pintarPreferencias();
    else if (tabBitacora === 'brechas') pintarBrechas();
    else pintarAprende();
  }

  function bitacoraTab(t) { tabBitacora = t; renderBitacora(); }

  function pintarBitacoraPreps() {
    const preps = [...DB.estado.preparaciones].sort((a, b) => new Date(b.preparado_en) - new Date(a.preparado_en));
    const sinEvaluar = preps.filter(p => !DB.cataDe(p.id));

    let h = '';
    if (sinEvaluar.length) {
      h += `<div class="nota nota-ojo"><b>${sinEvaluar.length} preparación${sinEvaluar.length === 1 ? '' : 'es'} sin evaluar.</b>
        Evaluar es lo que después permite comparar y saber qué funcionó.</div>`;
    }
    if (!preps.length) {
      h += `<div class="vacio"><div class="vacio-ico" aria-hidden="true">▤</div>
        <h3>Tu bitácora está vacía</h3>
        <p>Cada preparación que registres queda acá con sus parámetros, para poder compararlas después.</p>
        <button class="btn btn-pri" onclick="APP.irA('preparar')">Preparar café</button></div>`;
    } else {
      let mesActual = '';
      preps.forEach(p => {
        const mes = new Date(p.fecha + 'T12:00:00').toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
        if (mes !== mesActual) { mesActual = mes; h += `<div class="seccion-tit" style="margin-top:24px">${esc(mes)}</div>`; }
        h += filaPreparacion(p);
      });
    }
    $('#bitacoraContenido').innerHTML = h;
  }

  function pintarEstadisticas() {
    const preps = DB.estado.preparaciones;
    const lotes = DB.estado.lotes;
    const comprados = lotes.reduce((s, l) => s + DB.num(l.gramos_iniciales, 0), 0);
    const consumidos = lotes.reduce((s, l) => s + (DB.num(l.gramos_iniciales, 0) - DB.num(l.gramos_disponibles, 0)), 0);
    const gastado = lotes.reduce((s, l) => s + DB.num(l.precio_pagado, 0), 0);
    const conPrecio = lotes.filter(l => l.costo_por_gramo !== null);
    const costoTazaProm = conPrecio.length
      ? conPrecio.reduce((s, l) => s + DB.num(l.costo_por_gramo, 0), 0) / conPrecio.length * DB.dosisHabitual()
      : null;

    // B-11: promedios sin NaN
    const prom = (arr, f) => { const v = arr.map(f).filter(x => x !== null && Number.isFinite(x)); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
    const ratioProm = prom(preps, p => DB.num(p.ratio));
    const tempProm = prom(preps, p => DB.num(p.temperatura_c));

    const porMetodo = {};
    preps.forEach(p => { (porMetodo[p.method_id] = porMetodo[p.method_id] || []).push(p); });

    const bolsasTerminadas = lotes.filter(l => l.estado === 'terminado' && l.fecha_apertura && l.fecha_termino);
    const duracionProm = bolsasTerminadas.length
      ? bolsasTerminadas.reduce((s, l) => s + DB.diasEntre(l.fecha_apertura, l.fecha_termino), 0) / bolsasTerminadas.length
      : null;

    $('#bitacoraContenido').innerHTML = `
      <div class="seccion"><div class="seccion-tit">Inventario</div>
        <div class="card card-p"><div class="datos">
          <div class="dato"><span class="dato-k">Gramos comprados en total</span><span class="dato-v">${Math.round(comprados)} g</span></div>
          <div class="dato"><span class="dato-k">Gramos consumidos</span><span class="dato-v">${Math.round(consumidos)} g</span></div>
          <div class="dato"><span class="dato-k">Disponibles ahora</span><span class="dato-v">${Math.round(DB.totalGramosDisponibles())} g</span></div>
          <div class="dato"><span class="dato-k">Gasto registrado</span><span class="dato-v">${gastado ? DB.clp(gastado) : '—'}</span></div>
          <div class="dato"><span class="dato-k">Costo promedio por taza</span><span class="dato-v">${costoTazaProm !== null ? DB.clp(costoTazaProm) : 'Falta registrar precios'}</span></div>
          <div class="dato"><span class="dato-k">Cafés activos</span><span class="dato-v">${DB.lotesActivos().length}</span></div>
          <div class="dato"><span class="dato-k">Duración promedio de una bolsa</span><span class="dato-v">${duracionProm !== null ? Math.round(duracionProm) + ' días' : 'Sin datos suficientes'}</span></div>
        </div></div></div>

      <div class="seccion"><div class="seccion-tit">Preparaciones</div>
        <div class="card card-p"><div class="datos">
          <div class="dato"><span class="dato-k">Total registradas</span><span class="dato-v">${preps.length}</span></div>
          <div class="dato"><span class="dato-k">Ratio promedio</span><span class="dato-v">${ratioProm !== null ? '1:' + ratioProm.toFixed(1) : '—'}</span></div>
          <div class="dato"><span class="dato-k">Temperatura promedio</span><span class="dato-v">${tempProm !== null ? tempProm.toFixed(0) + ' °C' : '—'}</span></div>
        </div>
        ${Object.keys(porMetodo).length ? `<table class="tabla" style="margin-top:16px">
          <thead><tr><th>Método</th><th>Veces</th><th>Ratio</th><th>Nota</th></tr></thead>
          <tbody>${Object.entries(porMetodo).map(([m, ps]) => {
            const notas = ps.map(p => MOTOR.puntuacionDe(p)).filter(x => x !== null);
            const r = prom(ps, p => DB.num(p.ratio));
            return `<tr><td><b>${esc(DB.metodo(m).nombre)}</b></td><td>${ps.length}</td>
              <td>${r !== null ? '1:' + r.toFixed(1) : '—'}</td>
              <td>${notas.length ? (notas.reduce((a, b) => a + b, 0) / notas.length).toFixed(1) + '/10' : '—'}</td></tr>`;
          }).join('')}</tbody></table>` : ''}
        </div></div>

      <div class="seccion"><div class="seccion-tit">Exportar y respaldar</div>
        <div class="card card-p">
          <div class="btn-fila">
            <button class="btn" onclick="DB.exportarInventarioCSV()">Inventario en CSV</button>
            <button class="btn" onclick="DB.exportarPreparacionesCSV()">Preparaciones en CSV</button>
            <button class="btn btn-pri" onclick="DB.exportarTodoJSON()">Respaldo completo (JSON)</button>
          </div>
          <p style="font-size:var(--tx-xs);color:var(--t3);margin:12px 0 0">
            Los CSV abren directo en Excel con formato chileno (punto y coma como separador).</p>
        </div></div>`;
  }

  function pintarPreferencias() {
    const p = MOTOR.perfilPreferencias();
    const bloque = (tit, arr, nota) => arr.length ? `
      <div class="seccion"><div class="seccion-tit">${tit}</div>
        <div class="card card-p">
          ${arr.map(x => `<p style="font-size:var(--tx-sm);color:var(--t2);margin:0 0 10px">${esc(x)}</p>`).join('')}
          ${nota ? `<p style="font-size:var(--tx-xs);color:var(--t3);margin:8px 0 0">${nota}</p>` : ''}
        </div></div>` : '';

    $('#bitacoraContenido').innerHTML = `
      <p class="sub-vista">Este perfil se construye solo con lo que registras. Está separado en tres niveles a propósito:
      no es lo mismo un dato que una tendencia, ni una tendencia que una hipótesis.</p>
      ${bloque('Datos comprobados', p.hechos, 'Se pueden contar directamente en tus registros.')}
      ${bloque('Tendencias', p.tendencias, 'Patrones con al menos 2 o 3 registros detrás. Pueden cambiar con más datos.')}
      ${bloque('Hipótesis y qué probar', p.hipotesis, 'Todavía no hay datos para afirmarlo. Son cosas que valdría la pena probar.')}
      ${!p.hechos.length && !p.tendencias.length ? `<div class="vacio">
        <div class="vacio-ico" aria-hidden="true">◉</div><h3>Aún no hay perfil</h3>
        <p>Con 5 preparaciones evaluadas empiezan a aparecer patrones reales. Vas ${p.nEvaluadas}.</p></div>` : ''}`;
  }

  function pintarBrechas() {
    const b = MOTOR.brechasInventario();
    $('#bitacoraContenido').innerHTML = `
      <div class="card card-p" style="margin-bottom:20px">
        <p style="font-size:var(--tx-sm);color:var(--t2);margin:0">${esc(b.resumen)}</p>
        ${b.datosUsados ? `<p style="font-size:var(--tx-xs);color:var(--t3);margin:10px 0 0">Analizado sobre: ${esc(b.datosUsados)}.</p>` : ''}
      </div>
      ${b.suficiente
        ? `<div class="nota">Tu inventario está bien cubierto, así que no te voy a sugerir compras. Es mejor terminar lo que tienes:
           cada bolsa que se queda meses abierta pierde más de lo que suma una nueva.</div>`
        : b.brechas.map(x => `<div class="card card-p" style="margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline">
              <b style="font-family:var(--f-display);font-size:var(--tx-md)">${esc(x.titulo)}</b>
              <span class="chip ${x.prioridad === 1 ? 'warn' : ''}">prioridad ${x.prioridad}</span>
            </div>
            <p style="font-size:var(--tx-sm);color:var(--t2);margin:8px 0 0">${esc(x.desc)}</p>
          </div>`).join('')}`;
  }

  function pintarAprende() {
    const tips = typeof TIPS_DIARIOS !== 'undefined' ? TIPS_DIARIOS : [];
    const vars = typeof VARIEDADES !== 'undefined' ? VARIEDADES : [];
    const cata = typeof CATA_STEPS !== 'undefined' ? CATA_STEPS : [];
    const dia = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
    const tip = tips.length ? tips[dia % tips.length] : null;

    $('#bitacoraContenido').innerHTML = `
      ${tip ? `<div class="card card-p" style="margin-bottom:20px">
        <div class="seccion-tit">Tip de hoy · ${esc(tip.tag)}</div>
        <p style="font-family:var(--f-display);font-size:var(--tx-lg);font-weight:800;margin:0 0 8px">${esc(tip.texto)}</p>
        <p style="font-size:var(--tx-sm);color:var(--t2);margin:0">${esc(tip.detalle)}</p>
      </div>` : ''}

      <div class="seccion"><div class="seccion-tit">Cómo catar (${cata.length} pasos)</div>
        ${cata.map(s => `<div class="paso"><span class="paso-n">${esc(s.n)}</span>
          <span class="paso-txt"><b>${esc(s.title)}</b><div style="font-size:var(--tx-sm);color:var(--t2);margin-top:4px">${esc(s.text)}</div></span>
        </div>`).join('')}</div>

      <div class="seccion"><div class="seccion-tit">Variedades (${vars.length})</div>
        ${vars.map(v => `<details class="avanzado">
          <summary>${esc(v.nombre)} — ${esc(v.origen || '')}</summary>
          <p style="font-size:var(--tx-sm);color:var(--t2);margin:10px 0">${esc(v.desc || '')}</p>
          <div class="datos">
            ${v.sabores ? `<div class="dato"><span class="dato-k">Sabores típicos</span><span class="dato-v">${esc([].concat(v.sabores).join(', '))}</span></div>` : ''}
            ${v.metodos ? `<div class="dato"><span class="dato-k">Métodos</span><span class="dato-v">${esc(v.metodos)}</span></div>` : ''}
            ${v.proceso ? `<div class="dato"><span class="dato-k">Proceso</span><span class="dato-v">${esc(v.proceso)}</span></div>` : ''}
            ${v.altitud ? `<div class="dato"><span class="dato-k">Altitud</span><span class="dato-v">${esc(v.altitud)}</span></div>` : ''}
          </div>
          ${v.nota ? `<p style="font-size:var(--tx-xs);color:var(--t3);margin-top:10px">${esc(v.nota)}</p>` : ''}
        </details>`).join('')}</div>`;
  }

  /* ============================================================
     VISTA 5 · RUTA (Fase 3 — honesta sobre lo que todavía no hay)
     ============================================================ */
  function renderRuta() {
    const origenes = typeof ORIGINS !== 'undefined' ? ORIGINS : [];
    // B-10: se ignoran los paises vacios, que hacian que TODO calzara
    const misPaises = new Set(DB.estado.cafes.map(c => (c.pais || '').trim().toLowerCase())
      .filter(p => p !== '')
      .flatMap(p => p.split('/').map(x => x.trim()))
      .filter(Boolean));

    const sinAcento = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
    const tengo = o => {
      const on = sinAcento(o.pais.toLowerCase());
      for (const p of misPaises) {
        const pn = sinAcento(p);
        if (pn === on) return true;
        if (pn.length >= 4 && on.length >= 4 && (pn.includes(on) || on.includes(pn))) return true;
      }
      return false;
    };
    const cuenta = o => {
      const on = sinAcento(o.pais.toLowerCase());
      return DB.estado.cafes.filter(c => {
        const cp = sinAcento((c.pais || '').trim().toLowerCase());
        if (!cp) return false;
        return cp.split('/').map(x => x.trim()).some(x => x === on || (x.length >= 4 && on.length >= 4 && (x.includes(on) || on.includes(x))));
      }).length;
    };

    const explorados = origenes.filter(tengo);

    $('#rutaContenido').innerHTML = `
      <div class="nota nota-info">
        <b>Esta sección está en construcción.</b> Cafeterías, visitas, rankings ponderados, rutas de viaje
        y el banco de contenido de Charlie en Ruta corresponden a la Fase 3 del plan.
        La base de datos ya está diseñada para recibirlos sin migraciones destructivas.
      </div>

      <div class="seccion"><div class="seccion-tit">Tu mapa de orígenes</div>
        <div class="card card-p">
          <p style="font-size:var(--tx-sm);color:var(--t2);margin:0 0 14px">
            Has probado café de <b>${explorados.length}</b> de los ${origenes.length} orígenes de referencia.
            ${28 - DB.estado.cafes.filter(c => (c.pais || '').trim()).length > 0
              ? `Hay ${DB.estado.cafes.filter(c => !(c.pais || '').trim()).length} café${DB.estado.cafes.filter(c => !(c.pais || '').trim()).length === 1 ? '' : 's'} sin país registrado, así que no cuentan en el mapa.`
              : ''}
          </p>
          ${origenes.map(o => {
            const n = cuenta(o);
            return `<div class="dato">
              <span class="dato-k"><span aria-hidden="true">${o.flag}</span> ${esc(o.pais)}
                <span style="display:block;font-size:var(--tx-xs);opacity:.8">${esc(o.perfil)}</span></span>
              <span class="dato-v">${n ? `<span class="chip ok">${n} café${n === 1 ? '' : 's'}</span>` : '<span class="chip">Sin probar</span>'}</span>
            </div>`;
          }).join('')}
        </div></div>`;
  }

  /* ============================================================
     PERFIL Y AJUSTES
     ============================================================ */
  function abrirPerfil() {
    const p = DB.estado.perfil || {};
    const errs = DB.errores();
    abrirModal('Perfil y ajustes', `
      <form id="fmPerfil">
        <div class="grid2">
          <div class="campo"><label for="pfNombre">Cómo te llamas</label>
            <input id="pfNombre" value="${esc(p.nombre || '')}"></div>
          <div class="campo"><label for="pfCiudad">Ciudad</label>
            <input id="pfCiudad" value="${esc(p.ciudad || '')}"></div>
        </div>
        <div class="grid2">
          <div class="campo"><label for="pfDosis">Tu dosis habitual (g)</label>
            <input id="pfDosis" type="number" inputmode="decimal" step="0.5" min="1" value="${DB.num(p.dosis_habitual_g, 15)}">
            <div class="pista">Con esto se calculan las tazas restantes y el costo por taza.</div></div>
          <div class="campo"><label for="pfStock">Avisar cuando queden menos de (g)</label>
            <input id="pfStock" type="number" inputmode="numeric" step="5" min="0" value="${DB.num(p.stock_minimo_g, 50)}"></div>
        </div>
        <div class="campo"><label for="pfMetodo">Método favorito</label>
          <select id="pfMetodo">${DB.estado.metodos.filter(m => m.activo).map(m =>
            `<option value="${m.id}" ${p.metodo_favorito_id === m.id ? 'selected' : ''}>${esc(m.nombre)}</option>`).join('')}</select></div>
        <button type="submit" class="btn btn-pri btn-bloque">Guardar ajustes</button>
      </form>

      <div class="seccion" style="margin-top:28px"><div class="seccion-tit">Tus molinillos</div>
        ${DB.estado.molinillos.map(g => `<div class="card card-p" style="margin-bottom:10px">
          <b>${esc(g.marca)} ${esc(g.modelo)}</b> ${g.es_principal ? '<span class="chip ok">principal</span>' : ''}
          <div class="datos" style="margin-top:8px">
            <div class="dato"><span class="dato-k">Unidad de ajuste</span><span class="dato-v">${esc(g.unidad_ajuste)}</span></div>
            <div class="dato"><span class="dato-k">Punto cero</span><span class="dato-v">${DB.num(g.punto_cero, 0)}</span></div>
            <div class="dato"><span class="dato-k">Rango</span><span class="dato-v">${DB.num(g.ajuste_min, '—')} a ${DB.num(g.ajuste_max, '—')}</span></div>
          </div>
          ${g.observaciones ? `<p style="font-size:var(--tx-xs);color:var(--t3);margin:8px 0 0">${esc(g.observaciones)}</p>` : ''}
        </div>`).join('')}
        <div class="nota nota-info">Los clics se cuentan desde el punto cero de <b>tu</b> molinillo.
        No son universales: dos Timemore C3 distintos no muelen igual con el mismo número de clics.</div>
      </div>

      <div class="seccion"><div class="seccion-tit">Respaldos</div>
        <div class="btn-fila">
          <button class="btn btn-pri" onclick="DB.exportarTodoJSON()">Descargar respaldo completo</button>
          <button class="btn" onclick="DB.exportarInventarioCSV()">Inventario CSV</button>
        </div>
        <p style="font-size:var(--tx-xs);color:var(--t3);margin-top:10px">
          Además hay respaldos automáticos en el servidor: tus 28 cafés originales quedaron guardados antes de la migración.</p>
      </div>

      <div class="seccion"><div class="seccion-tit">Diagnóstico</div>
        <div class="datos">
          <div class="dato"><span class="dato-k">Conexión</span><span class="dato-v">${navigator.onLine ? 'En línea' : 'Sin conexión'}</span></div>
          <div class="dato"><span class="dato-k">Cambios sin subir</span><span class="dato-v">${DB.pendientes()}</span></div>
          <div class="dato"><span class="dato-k">Backend</span><span class="dato-v">${DB.hayBackend ? 'Disponible' : 'No cargó (modo caché)'}</span></div>
          <div class="dato"><span class="dato-k">Datos mostrados</span><span class="dato-v">${DB.estado.desdeCache ? 'Desde este dispositivo' : 'Del servidor'}</span></div>
        </div>
        ${DB.fallidas().length ? `<div class="nota nota-ojo" style="margin-top:12px">
          <b>${DB.fallidas().length} cambio${DB.fallidas().length === 1 ? '' : 's'} que no se pudo guardar.</b>
          Reintentar no sirve: el dato no cuadra y va a fallar igual. Mira el motivo, vuelve a hacer
          la operación con el número correcto, y descarta esto para que deje de aparecer.
        </div>
        ${DB.fallidas().map(o => `<div class="card card-p" style="margin-bottom:10px">
          <div style="font-size:var(--tx-xs);color:var(--t3);text-transform:uppercase;letter-spacing:.08em">
            ${esc(ETIQUETA_TABLA[o.tabla] || o.tabla)} · ${DB.fecha(o.cuando)}</div>
          <p style="font-size:var(--tx-sm);margin:6px 0">${esc(mensajeError({ message: o.ultimoError || '' }))}</p>
          <details class="avanzado" style="margin:8px 0 0">
            <summary>Ver el dato exacto</summary>
            <pre style="font-size:var(--tx-xs);color:var(--t3);white-space:pre-wrap;word-break:break-word;margin:8px 0 0">${esc(JSON.stringify(o.datos, null, 1))}</pre>
          </details>
          <button class="btn btn-peligro btn-bloque" style="margin-top:10px" onclick="APP.descartarFallida('${esc(o.id)}')">Descartar este cambio</button>
        </div>`).join('')}` : ''}
        ${errs.length ? `<details class="avanzado" style="margin-top:12px">
          <summary>Últimos errores (${errs.length})</summary>
          ${errs.slice(0, 8).map(e => `<p style="font-size:var(--tx-xs);color:var(--t3);margin:6px 0">
            <b>${esc(e.donde)}</b> · ${esc(e.msg)}</p>`).join('')}
        </details>` : ''}
        ${DB.pendientes() ? `<button class="btn btn-bloque" style="margin-top:12px" onclick="APP.forzarSync()">Intentar subir ahora</button>` : ''}
      </div>

      <button class="btn btn-peligro btn-bloque" style="margin-top:20px" onclick="APP.salir()">Cerrar sesión</button>`);

    $('#fmPerfil').onsubmit = async e => {
      e.preventDefault();
      try {
        await DB.guardarPerfil({
          nombre: $('#pfNombre').value.trim() || null,
          ciudad: $('#pfCiudad').value.trim() || null,
          dosis_habitual_g: DB.num($('#pfDosis').value, 15),
          stock_minimo_g: DB.num($('#pfStock').value, 50),
          metodo_favorito_id: $('#pfMetodo').value
        });
        toast('Ajustes guardados.');
        cerrarModal();
        await recargar();
      } catch (err) { toast(mensajeError(err), 'error'); }
    };
  }

  /* ============================================================
     acciones sueltas
     ============================================================ */
  async function borrarCafe(id) {
    const c = DB.cafe(id);
    if (!c) return;
    const preps = DB.preparacionesDe(id).length;
    const ok = await confirmar('Eliminar café',
      `Se va a eliminar «${c.nombre}»${preps ? ` junto con sus ${preps} preparaciones` : ''}. ` +
      'Queda archivado en la base, no se borra de verdad, pero desaparece de tus listas.',
      'Eliminar', true);
    if (!ok) return;
    try { await DB.borrarCafe(id); toast('Café eliminado.'); cerrarModal(); await recargar(); }
    catch (e) { toast(mensajeError(e), 'error'); }
  }

  async function borrarPrep(id) {
    const ok = await confirmar('Eliminar preparación',
      'El café que se había descontado vuelve al inventario y queda un movimiento de corrección en el historial.',
      'Eliminar', true);
    if (!ok) return;
    try { await DB.borrarPreparacion(id); toast('Preparación eliminada, café devuelto al inventario.'); cerrarModal(); await recargar(); }
    catch (e) { toast(mensajeError(e), 'error'); }
  }

  async function forzarSync() {
    const r = await DB.sincronizar();
    toast(r.pendientes ? `Quedan ${r.pendientes} sin subir.` : `Listo: ${r.enviadas} cambio${r.enviadas === 1 ? '' : 's'} subido${r.enviadas === 1 ? '' : 's'}.`);
    bandaOffline();
    await recargar();
  }

  async function salir() {
    try { await DB.salir(); location.reload(); }
    catch (e) { toast(e.message, 'error'); }
  }

  function mensajeError(e) {
    const m = (e && e.message) ? e.message : String(e);
    if (/gramos_disponibles|No alcanza/i.test(m)) return m;
    if (/ajuste_exige_motivo/i.test(m)) return 'Un ajuste manual necesita un motivo.';
    if (/apertura_no_antes_de_compra/i.test(m)) return 'La fecha de apertura no puede ser anterior a la de compra.';
    if (/termino_no_antes_de_apertura/i.test(m)) return 'La fecha de término no puede ser anterior a la de apertura.';
    if (/disponible_no_supera_inicial/i.test(m)) return 'No puede haber más gramos disponibles que el peso inicial de la bolsa.';
    if (/duplicate key|already exists/i.test(m)) return 'Ese registro ya existe.';
    if (/dosis_g|agua_g/i.test(m)) return 'La dosis y el agua tienen que ser mayores que cero.';
    if (/puntuacion_personal/i.test(m)) return 'La puntuación tiene que estar entre 1 y 10.';
    return 'No se pudo guardar: ' + m;
  }

  async function descartarFallida(id) {
    const op = DB.fallidas().find(o => o.id === id);
    if (!op) return;
    const ok = await confirmar('Descartar este cambio',
      'Este cambio no se pudo guardar y no se va a poder. Si lo descartas desaparece de la lista ' +
      'y queda anotado en los errores. Nada de lo que ya está guardado se toca.',
      'Sí, descartarlo', true);
    if (!ok) { abrirPerfil(); return; }
    DB.descartarFallida(id);
    toast('Cambio descartado.');
    abrirPerfil();
  }

  async function recargar() {
    try { await DB.cargarTodo(); } catch (e) { DB.registrarError('recargar', e); }
    refrescar();
    bandaOffline();
  }

  /* ============================================================
     ARRANQUE
     ============================================================ */
  async function arrancarApp() {
    $('#login').classList.remove('show');
    try {
      await DB.cargarTodo();
    } catch (e) {
      DB.registrarError('arranque', e);
      $('#bandaError').textContent = 'No pude cargar tus datos: ' + ((e && e.message) || e);
      $('#bandaError').classList.add('show');
    }
    $('#cargando').classList.add('oculto');
    const v = (location.hash || '#/inicio').replace('#/', '');
    irA(VISTAS.includes(v) ? v : 'inicio', true);
    bandaOffline();
  }

  function mostrarLogin() {
    $('#cargando').classList.add('oculto');
    $('#login').classList.add('show');
    $('#loginEmail').focus();
  }

  async function iniciar() {
    if (!DB.hayBackend) {
      // El CDN no cargó: se intenta abrir con la caché local
      $('#bandaError').textContent = 'No cargó la librería del servidor. Estás viendo los últimos datos guardados en este dispositivo.';
      $('#bandaError').classList.add('show');
      await arrancarApp();
      return;
    }
    const u = await DB.sesionActual();
    if (u) await arrancarApp(); else mostrarLogin();
  }

  /* --- login --- */
  document.addEventListener('DOMContentLoaded', () => {
    $('#btnEnviarCodigo').onclick = async () => {
      const email = $('#loginEmail').value.trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { $('#loginMsg').textContent = 'Revisa el correo.'; return; }
      $('#btnEnviarCodigo').disabled = true;
      $('#loginMsg').textContent = 'Enviando…';
      try {
        await DB.enviarCodigo(email);
        $('#loginPaso1').style.display = 'none';
        $('#loginPaso2').style.display = '';
        $('#loginMsg').textContent = 'Te mandé un código a ' + email;
        $('#loginCodigo').focus();
      } catch (e) {
        $('#loginMsg').textContent = /not found|signups not allowed|Signups not allowed/i.test(e.message || '')
          ? 'Ese correo no tiene cuenta en esta app.'
          : 'No se pudo enviar: ' + e.message;
      } finally { $('#btnEnviarCodigo').disabled = false; }
    };
    $('#btnVerificar').onclick = async () => {
      $('#btnVerificar').disabled = true;
      $('#loginMsg').textContent = 'Verificando…';
      try {
        await DB.verificarCodigo($('#loginEmail').value, $('#loginCodigo').value);
        $('#cargando').classList.remove('oculto');
        await arrancarApp();
      } catch (e) {
        $('#loginMsg').textContent = 'Código incorrecto o vencido.';
      } finally { $('#btnVerificar').disabled = false; }
    };
    $('#btnVolverEmail').onclick = () => {
      $('#loginPaso2').style.display = 'none';
      $('#loginPaso1').style.display = '';
      $('#loginMsg').textContent = '';
    };
    $('#loginCodigo').addEventListener('keydown', e => { if (e.key === 'Enter') $('#btnVerificar').click(); });
    $('#loginEmail').addEventListener('keydown', e => { if (e.key === 'Enter') $('#btnEnviarCodigo').click(); });

    $$('.nav-b').forEach(b => b.onclick = () => irA(b.dataset.vista));
    $('#modalCerrar').onclick = cerrarModal;
    $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') cerrarModal(); });
    $('#btnPerfil').onclick = abrirPerfil;
    $('#btnBuscar').onclick = () => { irA('cafes'); setTimeout(() => { const f = $('#fTexto'); if (f) f.focus(); }, 120); };

    iniciar();
  });

  /* API publica para los onclick del HTML */
  return {
    irA, cerrarModal, formCafe, formLote, formMovimiento, detalleCafe,
    prepararCon, iniciarPreparacion, formEvaluacion, formDuplicarReceta, bitacoraTab,
    borrarCafe, borrarPreparacion: borrarPrep, forzarSync, descartarFallida, salir, abrirPerfil, toast
  };
})();

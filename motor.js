/* ============================================================
   DIARIO DE CAFE · motor de recomendaciones y ajustes
   ------------------------------------------------------------
   Reglas que se respetan sin excepcion (art. 13, 41 y 42):
   · Nunca se afirma que una receta va a quedar perfecta.
   · Toda recomendacion dice de donde salio y cuantos registros
     la respaldan.
   · Se aprende primero de los resultados reales de Carla y solo
     despues de las reglas genericas por proceso.
   · El asistente cambia UNA variable, dos como maximo.
   · No se inventa informacion que no este en los datos.
   ============================================================ */

'use strict';

const MOTOR = (() => {

  /* Puente entre los ids del modelo nuevo y las claves del contenido heredado */
  const PROCESO_A_RECETAS = {
    lavado: 'Lavado', natural: 'Natural',
    honey: 'Honey', honey_amarillo: 'Honey', honey_rojo: 'Honey', honey_negro: 'Honey',
    anaerobico: 'Anaeróbico', fermentacion_extendida: 'Anaeróbico',
    maceracion_carbonica: 'Anaeróbico', natural_fermentado: 'Natural fermentado',
    despulpado_natural: 'Despulpado natural', blend: 'Blend',
    experimental: 'Anaeróbico', descafeinado: 'Lavado', desconocido: 'Blend'
  };

  const METODO_A_RECETAS = {
    v60: 'V60', aeropress: 'AeroPress', prensa: 'Prensa Francesa',
    moka: 'Moka', nano_outin: 'Nano Outin'
  };

  const PERFILES = {
    mas_dulce:       { etiqueta: 'más dulce',       temp: -1, ratio: -0.5, molienda: -1 },
    mas_brillante:   { etiqueta: 'más brillante',   temp: +2, ratio: +0.5, molienda: -1 },
    mas_intenso:     { etiqueta: 'más intenso',     temp: 0,  ratio: -1.5, molienda: -1 },
    mas_limpio:      { etiqueta: 'más limpio',      temp: -1, ratio: +1.0, molienda: +2 },
    mas_equilibrado: { etiqueta: 'más equilibrado', temp: 0,  ratio: 0,    molienda: 0 }
  };

  /* Lee "13–16" o "91–93°C" y devuelve el punto medio */
  function medioRango(txt) {
    if (!txt) return null;
    const nums = String(txt).replace(',', '.').match(/\d+(\.\d+)?/g);
    if (!nums || !nums.length) return null;
    const v = nums.map(Number);
    return v.length === 1 ? v[0] : (v[0] + v[v.length - 1]) / 2;
  }

  function puntuacionDe(prep) {
    const c = DB.cataDe(prep.id);
    if (!c) return null;
    if (c.puntuacion_personal !== null && c.puntuacion_personal !== undefined) return DB.num(c.puntuacion_personal);
    if (c.valoracion_1a5) return DB.num(c.valoracion_1a5) * 2;   // 1-5 -> 1-10, se avisa en la explicacion
    return null;
  }

  /* ============================================================
     RECOMENDACION DE PUNTO DE PARTIDA
     ============================================================ */
  function recomendar({ cafeId, loteId, methodId, mlBebida, perfilDeseado }) {
    const cafe = DB.cafe(cafeId);
    if (!cafe) return null;
    const lote = loteId ? DB.lote(loteId) : (DB.lotesDe(cafeId).find(l => ['abierto', 'bajo_stock', 'sin_abrir'].includes(l.estado)) || null);
    const met = DB.metodo(methodId);
    const proc = DB.proceso(cafe.proceso_id);
    const datosUsados = [];
    let base = null, confianza = 'baja', origen = '', nRegistros = 0;

    /* --- Nivel 1: sus propias preparaciones de ESTE cafe con ESTE metodo --- */
    const propias = DB.preparacionesDe(cafeId)
      .filter(p => p.method_id === methodId && !p.deleted_at)
      .map(p => ({ p, pts: puntuacionDe(p) }))
      .filter(x => x.pts !== null)
      .sort((a, b) => b.pts - a.pts);

    if (propias.length >= 2) {
      const buenas = propias.filter(x => x.pts >= Math.max(7, propias[0].pts - 1));
      const usar = buenas.length ? buenas : propias.slice(0, 2);
      base = promediar(usar.map(x => x.p));
      nRegistros = usar.length;
      confianza = usar.length >= 3 ? 'alta' : 'media';
      origen = `tus ${usar.length} mejores preparaciones de este café en ${met.nombre}`;
      datosUsados.push(`${propias.length} preparaciones evaluadas de este café`);
      const rango = usar.map(x => x.p.ratio).filter(Boolean);
      if (rango.length > 1) {
        datosUsados.push(`ratios entre 1:${Math.min(...rango).toFixed(1)} y 1:${Math.max(...rango).toFixed(1)}`);
      }
    }

    /* --- Nivel 2: otros cafes del MISMO proceso con este metodo --- */
    if (!base) {
      const mismos = DB.estado.cafes.filter(c => c.proceso_id === cafe.proceso_id).map(c => c.id);
      const parecidas = DB.estado.preparaciones
        .filter(p => mismos.includes(p.coffee_id) && p.method_id === methodId && !p.deleted_at)
        .map(p => ({ p, pts: puntuacionDe(p) }))
        .filter(x => x.pts !== null && x.pts >= 7)
        .sort((a, b) => b.pts - a.pts);
      if (parecidas.length) {
        base = promediar(parecidas.slice(0, 3).map(x => x.p));
        nRegistros = Math.min(3, parecidas.length);
        confianza = parecidas.length >= 3 ? 'media' : 'baja';
        origen = `tus mejores preparaciones de otros cafés ${proc.nombre.toLowerCase()} en ${met.nombre}`;
        datosUsados.push(`${parecidas.length} preparaciones bien evaluadas de cafés ${proc.nombre.toLowerCase()}`);
      }
    }

    /* --- Nivel 3: tabla de referencia por proceso (contenido.js) --- */
    let refTabla = null;
    const claveProc = PROCESO_A_RECETAS[cafe.proceso_id] || 'Blend';
    const claveMet = METODO_A_RECETAS[methodId];
    if (typeof RECETAS !== 'undefined' && RECETAS[claveProc] && claveMet && RECETAS[claveProc].metodos[claveMet]) {
      refTabla = RECETAS[claveProc].metodos[claveMet];
    }

    if (!base) {
      if (!refTabla) return null;
      base = {
        dosis_g: medioRango(refTabla.dosis) || 16,
        agua_g: medioRango(refTabla.agua) || 250,
        temperatura_c: Math.round(medioRango(refTabla.temp) || 92),
        tiempo_total_seg: Math.round((medioRango(refTabla.tiempo) || 3) * 60),
        molienda: null
      };
      base.ratio = base.agua_g / base.dosis_g;
      confianza = 'baja';
      nRegistros = 0;
      origen = `la tabla de referencia por proceso (${proc.nombre}), porque todavía no tienes preparaciones de este café en ${met.nombre}`;
      datosUsados.push(`referencia general para café ${proc.nombre.toLowerCase()}`);
    }

    /* --- Molienda: preset guardado > historial > tabla --- */
    const grinder = DB.estado.molinillos.find(g => g.es_principal) || DB.estado.molinillos[0] || null;
    let molienda = base.molienda;
    let moliendaOrigen = molienda !== null ? 'tu historial' : null;
    if (molienda === null && refTabla && grinder) {
      const col = grinder.unidad_ajuste === 'clics' ? refTabla.C3 : refTabla.Whirly;
      molienda = medioRango(col);
      moliendaOrigen = 'la tabla de referencia';
    }

    /* --- Ajuste por perfil deseado --- */
    const ajustes = [];
    const perf = PERFILES[perfilDeseado];
    let temp = base.temperatura_c, ratio = base.ratio;
    if (perf && perfilDeseado !== 'mas_equilibrado') {
      temp = Math.min(100, Math.max(80, Math.round(temp + perf.temp)));
      ratio = Math.max(8, ratio + perf.ratio);
      if (perf.molienda && molienda !== null) {
        molienda = Math.round((molienda + perf.molienda * (grinder && grinder.unidad_ajuste === 'clics' ? 1 : 0.2)) * 10) / 10;
      }
      ajustes.push(`Ajustado hacia una taza ${perf.etiqueta}.`);
    }

    /* --- Ajuste por edad del café desde el tueste --- */
    const dias = lote ? DB.diasDesdeTueste(lote) : null;
    if (dias !== null) {
      datosUsados.push(`${dias} días desde el tueste`);
      if (dias <= 7) {
        temp = Math.max(80, temp - 1);
        ajustes.push('El café está muy fresco y todavía libera CO₂: 1 °C menos y un bloom algo más largo ayudan a que no burbujee tanto.');
      } else if (dias >= 35) {
        temp = Math.min(100, temp + 1);
        ajustes.push('Ya pasaron más de 35 días desde el tueste: 1 °C más ayuda a sacarle dulzor a un café que se está apagando.');
      }
    }

    /* --- Cantidad de bebida pedida --- */
    let dosis = base.dosis_g, agua = base.agua_g;
    if (mlBebida && mlBebida > 0) {
      agua = Math.round(mlBebida * 1.12);   // se pierde agua en el lecho de café
      dosis = Math.round((agua / ratio) * 10) / 10;
      ajustes.push(`Calculado para ~${mlBebida} ml en la taza (el lecho de café retiene algo de agua).`);
    } else {
      agua = Math.round(dosis * ratio);
    }

    /* --- Tope: no proponer mas de lo que hay en la bolsa --- */
    let aviso = null;
    if (lote && DB.num(lote.gramos_disponibles, 0) < dosis) {
      const disp = DB.num(lote.gramos_disponibles, 0);
      aviso = `En esa bolsa quedan ${disp} g y esta receta pide ${dosis} g. Ajusté la dosis a lo que hay.`;
      dosis = Math.floor(disp * 10) / 10;
      agua = Math.round(dosis * ratio);
    }

    /* --- Que variable conviene mover --- */
    const variable = confianza === 'baja'
      ? 'la molienda: es la que más mueve la extracción. Cambia un solo clic y compara.'
      : 'el ratio: ya tienes molienda y temperatura razonables para este café.';

    /* --- Comparacion con la preparacion anterior --- */
    const anterior = DB.preparacionesDe(cafeId).filter(p => p.method_id === methodId)[0] || null;
    let comparacion = null;
    if (anterior) {
      const difs = [];
      if (anterior.dosis_g !== null && Math.abs(anterior.dosis_g - dosis) >= 0.5) difs.push(`dosis ${anterior.dosis_g} g → ${dosis} g`);
      if (anterior.ratio && Math.abs(anterior.ratio - ratio) >= 0.3) difs.push(`ratio 1:${(+anterior.ratio).toFixed(1)} → 1:${ratio.toFixed(1)}`);
      if (anterior.temperatura_c && anterior.temperatura_c !== temp) difs.push(`temperatura ${anterior.temperatura_c} °C → ${temp} °C`);
      if (anterior.molienda_ajuste !== null && molienda !== null && Math.abs(anterior.molienda_ajuste - molienda) >= 0.5) {
        difs.push(`molienda ${anterior.molienda_ajuste} → ${molienda}`);
      }
      comparacion = difs.length
        ? { fecha: anterior.fecha, cambios: difs }
        : { fecha: anterior.fecha, cambios: [], igual: true };
    }

    const explicacion = `Punto de partida sugerido a partir de ${origen}.` +
      (ajustes.length ? ' ' + ajustes.join(' ') : '');

    return {
      dosis_g: dosis,
      agua_g: agua,
      ratio: Math.round(ratio * 100) / 100,
      temperatura_c: temp,
      tiempo_total_seg: base.tiempo_total_seg || null,
      molienda, moliendaOrigen,
      grinder,
      metodo: met, proceso: proc, cafe, lote,
      explicacion, confianza, nRegistros, datosUsados,
      variablePrincipal: variable,
      comparacion, aviso,
      referencia: refTabla ? { razon: refTabla.razon, tecnica: refTabla.tecnica } : null,
      esEstimacion: true
    };
  }

  function promediar(preps) {
    const prom = (k) => {
      const v = preps.map(p => DB.num(p[k])).filter(x => x !== null);
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
    };
    const dosis = prom('dosis_g') || 16;
    const agua = prom('agua_g') || 250;
    return {
      dosis_g: Math.round(dosis * 10) / 10,
      agua_g: Math.round(agua),
      ratio: agua / dosis,
      temperatura_c: prom('temperatura_c') ? Math.round(prom('temperatura_c')) : 92,
      tiempo_total_seg: prom('tiempo_total_seg') ? Math.round(prom('tiempo_total_seg')) : null,
      molienda: prom('molienda_ajuste')
    };
  }

  /* ============================================================
     PASOS DEL TEMPORIZADOR GUIADO (art. 12)
     Se generan desde los parametros, no estan hardcodeados.
     ============================================================ */
  function generarPasos(r) {
    const pasos = [];
    const add = (tipo, instruccion, ini, fin, agua) =>
      pasos.push({ tipo, instruccion, segundo_inicio: ini, segundo_fin: fin, agua_objetivo_g: agua });

    const dosis = r.dosis_g, agua = r.agua_g;
    const total = r.tiempo_total_seg || 210;
    const m = r.metodo.id;

    if (m === 'v60' || m === 'nano_outin') {
      add('enjuagar', 'Enjuaga el filtro con agua caliente y bota esa agua. Así se va el sabor a papel y se calienta el dripper.', null, null, null);
      add('dosificar', `Pon ${dosis} g de café molido y nivela el lecho con un golpecito.`, null, null, null);
      const bloom = Math.round(dosis * 2.5);
      add('bloom', `Inicia el cronómetro y moja el café hasta ${bloom} g. Un swirl suave para que no queden zonas secas.`, 0, 45, bloom);
      add('espera', 'Espera a que termine el bloom. Vas a ver cómo sube y baja la espuma.', 0, 45, bloom);
      const segundo = Math.round(agua * 0.6);
      add('vertido', `Vierte en círculos hasta ${segundo} g, sin tocar las paredes.`, 45, 90, segundo);
      add('vertido', `Completa hasta ${agua} g. Vertido más lento al final.`, 90, 135, agua);
      add('drenaje', 'Deja drenar. Un último swirl suave ayuda a que el lecho quede plano.', 135, total, agua);
      add('servir', 'Retira el dripper y sirve.', total, null, agua);
    } else if (m === 'aeropress') {
      const invertido = r.parametros_metodo && r.parametros_metodo.modo === 'invertido';
      add('preparar', invertido ? 'Arma la AeroPress invertida y deja el filtro listo aparte.'
                                : 'Arma la AeroPress normal, pon el filtro y enjuágalo.', null, null, null);
      add('dosificar', `Pon ${dosis} g de café molido.`, null, null, null);
      add('vertido', `Inicia el cronómetro y agrega los ${agua} g de agua a ${r.temperatura_c} °C.`, 0, 20, agua);
      add('agitar', 'Revuelve 3 veces con suavidad y tapa.', 20, 30, agua);
      add('espera', 'Deja infusionar.', 30, Math.max(60, total - 30), agua);
      add('presionar', 'Presiona parejo durante 25–30 segundos. Si cuesta mucho, la molienda está muy fina.', Math.max(60, total - 30), total, agua);
      add('servir', 'Sirve. Si quedó muy concentrado, agrega agua caliente (bypass) hasta que te guste.', total, null, agua);
    } else if (m === 'prensa') {
      add('preparar', 'Calienta la prensa con agua caliente y bótala.', null, null, null);
      add('dosificar', `Pon ${dosis} g de café molido grueso.`, null, null, null);
      add('vertido', `Inicia el cronómetro y vierte los ${agua} g de agua de una vez.`, 0, 30, agua);
      add('espera', 'Deja reposar sin revolver. Se va a formar una costra arriba.', 30, 240, agua);
      add('agitar', 'Rompe la costra con una cuchara y retira la espuma de la superficie.', 240, 260, agua);
      add('espera', 'Deja decantar sin presionar: los finos bajan solos y la taza queda más limpia.', 260, total, agua);
      add('presionar', 'Baja el pistón muy suave, solo hasta la superficie del líquido.', total, null, agua);
      add('servir', 'Sirve todo de inmediato para que no siga extrayendo.', total, null, agua);
    } else if (m === 'moka') {
      add('preparar', 'Llena la base con agua ya caliente hasta justo debajo de la válvula. Con agua caliente el café no se quema mientras sube.', null, null, null);
      add('dosificar', `Pon ${dosis} g de café en el embudo. Nivela sin apretar: la moka no se compacta.`, null, null, null);
      add('preparar', 'Cierra bien y pon a fuego medio-bajo, con la tapa abierta para ver la salida.', null, null, null);
      add('espera', 'Espera a que empiece a salir café. Tiene que fluir parejo, color miel, sin escupir.', 0, 180, null);
      add('retirar', 'Cuando el chorro se aclara y empieza a gorgotear, retira del fuego de inmediato.', 180, total, null);
      add('preparar', 'Enfría la base con un paño húmedo para cortar la extracción de golpe.', total, null, null);
      add('servir', 'Revuelve y sirve. Si quedó muy intenso, dilúyelo con agua caliente.', total, null, null);
    } else {
      add('dosificar', `Pon ${dosis} g de café molido.`, null, null, null);
      add('vertido', `Agrega ${agua} g de agua a ${r.temperatura_c} °C.`, 0, 30, agua);
      add('espera', 'Deja extraer el tiempo de la receta.', 30, total, agua);
      add('servir', 'Sirve.', total, null, agua);
    }

    add('evaluar', 'Prueba y evalúa. Anotar ahora, en caliente, es lo que después te permite comparar.', null, null, null);
    return pasos.map((p, i) => ({ ...p, orden: i + 1 }));
  }

  /* ============================================================
     ASISTENTE DE AJUSTE (art. 14)
     Una o dos variables como maximo. Nunca mas.
     ============================================================ */
  const PREGUNTAS = [
    { id: 'debil',       texto: '¿La taza quedó débil o aguada?' },
    { id: 'intensa',     texto: '¿Quedó demasiado intensa?' },
    { id: 'amargor',     texto: '¿Sentiste amargor excesivo?' },
    { id: 'astringente', texto: '¿Sentiste astringencia, esa sensación que seca la boca?' },
    { id: 'acidez_ok',   texto: '¿La acidez fue agradable?' },
    { id: 'acidez_pun',  texto: '¿La acidez fue punzante o agresiva?' },
    { id: 'plana',       texto: '¿La taza quedó plana, sin nada que destacara?' },
    { id: 'dulzor',      texto: '¿Tuvo buen dulzor?' },
    { id: 'claridad',    texto: '¿Se distinguían los sabores con claridad?' }
  ];

  /* Devuelve como maximo 2 sugerencias, ordenadas por importancia */
  function sugerirAjuste(diag, prep) {
    const s = [];
    const grinder = prep && prep.grinder_id ? DB.molinillo(prep.grinder_id) : null;
    const unidad = grinder && grinder.unidad_ajuste === 'clics' ? 'un clic' : 'un punto';

    // Subextraccion: acido punzante + plana o debil, sin amargor
    const subextraida = (diag.debil || diag.plana || diag.acidez_pun) && !diag.amargor && !diag.astringente;
    // Sobreextraccion: amargor y/o astringencia
    const sobreextraida = diag.amargor || diag.astringente;

    if (sobreextraida) {
      s.push({
        variable: 'molienda',
        que: `Muele ${unidad} más grueso`,
        porque: diag.astringente
          ? 'La astringencia casi siempre viene de sobreextracción o de demasiados finos. Moler más grueso baja las dos cosas.'
          : 'El amargor suele ser sobreextracción. Con la molienda más gruesa el agua pasa más rápido y saca menos.',
        delta: '+1'
      });
      if (diag.amargor && prep && prep.temperatura_c && prep.temperatura_c >= 94) {
        s.push({
          variable: 'temperatura',
          que: `Baja la temperatura a ${prep.temperatura_c - 2} °C`,
          porque: 'Sobre 94 °C se extraen más compuestos amargos, sobre todo en tuestes claros.',
          delta: '-2 °C'
        });
      }
    } else if (subextraida) {
      if (diag.debil && !diag.acidez_pun) {
        s.push({
          variable: 'ratio',
          que: 'Baja el ratio: usa 1 o 2 g más de café para la misma agua',
          porque: 'Si está aguada pero sin acidez agresiva, casi siempre falta café, no falta extracción.',
          delta: '-1 punto de ratio'
        });
      } else {
        s.push({
          variable: 'molienda',
          que: `Muele ${unidad} más fino`,
          porque: 'La acidez punzante y la taza plana son señales típicas de subextracción. Más fino aumenta el contacto y saca dulzor.',
          delta: '-1'
        });
      }
      if (diag.plana && prep && prep.temperatura_c && prep.temperatura_c <= 91) {
        s.push({
          variable: 'temperatura',
          que: `Sube la temperatura a ${prep.temperatura_c + 2} °C`,
          porque: 'Con poca temperatura cuesta extraer dulzor y cuerpo. Dos grados más suelen bastar.',
          delta: '+2 °C'
        });
      }
    } else if (diag.intensa) {
      s.push({
        variable: 'ratio',
        que: 'Sube el ratio: la misma dosis con 20–30 g más de agua',
        porque: 'Si el sabor te gusta pero es demasiado, el problema es concentración, no extracción. No cambies la molienda.',
        delta: '+1 punto de ratio'
      });
    }

    if (!s.length) {
      if (diag.dulzor && diag.claridad && diag.acidez_ok) {
        return {
          sinCambios: true,
          mensaje: 'Dulzor, claridad y acidez agradable: esta receta está funcionando. Repítela igual antes de tocar nada, y si se sostiene, márcala como favorita.',
          sugerencias: []
        };
      }
      return {
        sinCambios: true,
        mensaje: 'Con estas respuestas no hay una señal clara de qué mover. Repite la receta tal cual y fíjate en un solo aspecto: si extrae de más o de menos.',
        sugerencias: []
      };
    }

    return {
      sinCambios: false,
      mensaje: s.length === 1
        ? 'Cambia solo esto para la próxima:'
        : 'Cambia una de estas dos, no las dos juntas: si mueves varias cosas a la vez no vas a saber cuál funcionó.',
      sugerencias: s.slice(0, 2)
    };
  }

  /* ============================================================
     QUE CAFE ME FALTA (art. 20)
     Solo mira el inventario ACTIVO y no recomienda comprar
     cuando ya hay suficiente.
     ============================================================ */
  function brechasInventario() {
    const activos = DB.lotesActivos();
    const cafesActivos = activos.map(l => DB.cafe(l.coffee_id)).filter(Boolean);
    const gramos = DB.totalGramosDisponibles();
    const tazas = DB.tazasDisponiblesTotales();

    if (!cafesActivos.length) {
      return {
        suficiente: false,
        resumen: 'No tienes café activo en el inventario. Cualquier compra suma.',
        brechas: []
      };
    }

    const procesos = cafesActivos.map(c => DB.proceso(c.proceso_id).familia);
    const paises = cafesActivos.map(c => (c.pais || '').toLowerCase()).filter(Boolean);
    const tostadores = new Set(cafesActivos.map(c => c.roaster_id).filter(Boolean));
    const notas = cafesActivos.map(c => (c.notas_tostador || '').toLowerCase()).join(' ');

    const tiene = {
      achocolatado: /chocolate|cacao|caramelo|panela|az[úu]car|toffee|nuez|avellana|man[íi]/.test(notas),
      floral:       /floral|jazm[íi]n|rosa|lavanda|t[ée] blanco|bergamota/.test(notas),
      frutal:       /frut|durazno|damasco|ciruela|maracuy[áa]|mango|frutilla|frambuesa|mora|ar[áa]ndano|cereza/.test(notas),
      citrico:      /naranja|lim[óo]n|mandarina|pomelo|c[íi]tric|lima/.test(notas),
      cuerpoAlto:   /cuerpo (completo|alto|redondo)|sedoso|cremoso|denso/.test(notas),
      descaf:       cafesActivos.some(c => c.proceso_id === 'descafeinado'),
      fermentado:   procesos.includes('fermentado'),
      lavado:       procesos.includes('lavado'),
      natural:      procesos.includes('natural'),
      honey:        procesos.includes('honey')
    };

    const brechas = [];
    const push = (titulo, desc, prioridad) => brechas.push({ titulo, desc, prioridad });

    if (!tiene.achocolatado) {
      push('Un café achocolatado de cuerpo medio',
        'Es el hueco más claro de tu inventario: no tienes ningún café dulce y achocolatado para el día a día. Un lavado de Brasil o Colombia cumple bien ese papel.', 1);
    }
    if (!tiene.lavado) {
      push('Un lavado clásico',
        'Los lavados son la referencia para calibrar el paladar: taza limpia y acidez definida. Sin uno en la estantería cuesta comparar el resto.', 1);
    }
    if (!tiene.floral && !tiene.citrico) {
      push('Algo floral o cítrico',
        'Te falta el extremo brillante del espectro. Un etíope lavado o un keniano abren mucho la referencia sensorial.', 2);
    }
    if (!tiene.natural && !tiene.honey) {
      push('Un natural o un honey',
        'Todo tu inventario activo viene de procesos que no dejan la fruta en contacto con el grano. Un natural te muestra cuánto dulzor aporta el proceso.', 2);
    }
    if (!tiene.descaf) {
      push('Un descafeinado decente',
        'Para las tardes y para preparar sin pensar en la hora. Los descafeinados de proceso azúcar de caña ya son muy buenos.', 4);
    }
    if (tostadores.size <= 2) {
      push('Un tostador que no hayas probado',
        `Tu inventario activo viene de ${tostadores.size} tostador${tostadores.size === 1 ? '' : 'es'}. Cambiar de tostador cambia más la taza de lo que uno espera, incluso con el mismo origen.`, 3);
    }
    const africanos = paises.some(p => /etiop|keni|ruanda|burundi|tanzan|ugand/.test(p));
    if (!africanos) {
      push('Un origen africano',
        'No tienes ningún africano activo. Es el continente que más cambia el mapa sensorial: acidez y aromática distintas a todo lo americano.', 2);
    }

    /* No recomendar comprar cuando ya hay de sobra */
    const suficiente = gramos >= 600 && brechas.filter(b => b.prioridad === 1).length === 0;

    let resumen;
    if (suficiente) {
      resumen = `Tienes ${Math.round(gramos)} g activos (unas ${tazas} tazas) y el inventario está bien cubierto. No necesitas comprar: aprovecha lo que tienes y registra más preparaciones para afinar tus preferencias.`;
    } else if (gramos >= 600) {
      resumen = `Tienes ${Math.round(gramos)} g activos, así que no hay urgencia. Cuando compres, considera cubrir lo que falta antes de repetir un perfil que ya tienes.`;
    } else {
      resumen = `Te quedan ${Math.round(gramos)} g activos, unas ${tazas} tazas. Es un buen momento para reponer.`;
    }

    return {
      suficiente, resumen,
      gramos, tazas,
      brechas: brechas.sort((a, b) => a.prioridad - b.prioridad),
      datosUsados: `${cafesActivos.length} cafés activos, ${new Set(procesos).size} familias de proceso, ${tostadores.size} tostadores`
    };
  }

  /* ============================================================
     PERFIL DE PREFERENCIAS (art. 19)
     Separa hechos de tendencias y de hipotesis.
     ============================================================ */
  function perfilPreferencias() {
    const preps = DB.estado.preparaciones.filter(p => !p.deleted_at);
    const conNota = preps.map(p => ({ p, pts: puntuacionDe(p) })).filter(x => x.pts !== null);

    const hechos = [], tendencias = [], hipotesis = [];

    // Hechos: lo que se puede contar
    if (preps.length) {
      const mm = DB.metodoMasUsado();
      hechos.push(`Has registrado ${preps.length} preparación${preps.length === 1 ? '' : 'es'}. Tu método más usado es ${mm.nombre} (${mm.n}).`);
    }
    const recompra = DB.estado.cafes.filter(c => c.recompraria);
    if (recompra.length) {
      hechos.push(`Marcaste ${recompra.length} café${recompra.length === 1 ? '' : 's'} como recompraría: ${recompra.map(c => c.nombre).join(', ')}.`);
    }
    const favoritos = DB.estado.cafes.filter(c => c.estado_personal === 'favorito');
    if (favoritos.length) hechos.push(`Tienes ${favoritos.length} cafés marcados como favoritos.`);

    // Tendencias: requieren al menos 3 registros comparables
    if (conNota.length >= 3) {
      const porProceso = {};
      conNota.forEach(({ p, pts }) => {
        const c = DB.cafe(p.coffee_id); if (!c) return;
        const fam = DB.proceso(c.proceso_id).familia;
        (porProceso[fam] = porProceso[fam] || []).push(pts);
      });
      const rank = Object.entries(porProceso)
        .filter(([, v]) => v.length >= 2)
        .map(([k, v]) => ({ k, prom: v.reduce((a, b) => a + b, 0) / v.length, n: v.length }))
        .sort((a, b) => b.prom - a.prom);
      if (rank.length >= 2) {
        tendencias.push(`Tus mejores notas están en cafés de proceso ${rank[0].k} (promedio ${rank[0].prom.toFixed(1)} sobre ${rank[0].n} preparaciones) y las más bajas en ${rank[rank.length - 1].k}.`);
      }
    } else {
      hipotesis.push(`Todavía hay pocas preparaciones evaluadas (${conNota.length}) para afirmar tendencias. Con 5 o más empiezan a aparecer patrones reales.`);
    }

    // Basado en las valoraciones historicas 1-5, que si son muchas
    const hist = DB.estado.cafes.filter(c => c.valoracion_1a5);
    if (hist.length >= 5) {
      const porProc = {};
      hist.forEach(c => {
        const fam = DB.proceso(c.proceso_id).familia;
        (porProc[fam] = porProc[fam] || []).push(c.valoracion_1a5);
      });
      const r = Object.entries(porProc).filter(([, v]) => v.length >= 3)
        .map(([k, v]) => ({ k, prom: v.reduce((a, b) => a + b, 0) / v.length, n: v.length }))
        .sort((a, b) => b.prom - a.prom);
      if (r.length) {
        tendencias.push(`En tus valoraciones históricas (escala 1–5), los procesos ${r[0].k} promedian ${r[0].prom.toFixed(1)} sobre ${r[0].n} cafés.`);
      }
      const paises = {};
      hist.forEach(c => { if (c.pais) (paises[c.pais] = paises[c.pais] || []).push(c.valoracion_1a5); });
      const rp = Object.entries(paises).filter(([, v]) => v.length >= 3)
        .map(([k, v]) => ({ k, prom: v.reduce((a, b) => a + b, 0) / v.length, n: v.length }))
        .sort((a, b) => b.prom - a.prom);
      if (rp.length >= 2) {
        tendencias.push(`Por origen, ${rp[0].k} es el que mejor evalúas (${rp[0].prom.toFixed(1)} en ${rp[0].n} cafés).`);
      }
    }

    // Hipotesis: lo que habria que probar para saber
    const familias = new Set(DB.estado.cafes.map(c => DB.proceso(c.proceso_id).familia));
    if (familias.size <= 2) {
      hipotesis.push('Tus compras se concentran en pocas familias de proceso. No se puede saber si prefieres eso o si simplemente no has probado otra cosa.');
    }
    const metodosUsados = new Set(preps.map(p => p.method_id));
    if (metodosUsados.size === 1 && preps.length >= 3) {
      hipotesis.push(`Todas tus preparaciones registradas son en ${DB.metodo([...metodosUsados][0]).nombre}. Probar el mismo café en otro método es la forma más rápida de saber si el método o el café es lo que te gusta.`);
    }

    return { hechos, tendencias, hipotesis, nPreparaciones: preps.length, nEvaluadas: conNota.length };
  }

  /* ============================================================
     RUEDA DE SABORES: comparacion simple con las notas del tostador
     ------------------------------------------------------------
     Solo marca coincidencia de texto (nombre o sinonimo del
     descriptor dentro de las notas). No inventa relaciones que el
     texto no tenga.
     ============================================================ */
  function compararSabores(notasTostador, descriptoresUsuario) {
    // Se comparan sin acentos, igual que el mapa de origenes: las notas de las
    // bolsas vienen escritas indistintamente "jazmin" o "jazmín".
    const sinAcento = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const texto = sinAcento(notasTostador || '');
    return descriptoresUsuario.map(d => {
      const nombres = [d.descriptor.nombre, ...(d.descriptor.sinonimos || [])]
        .filter(Boolean).map(sinAcento);
      const coincideTostador = !!texto && nombres.some(n => texto.includes(n));
      return { ...d, coincideTostador };
    });
  }

  return {
    recomendar, generarPasos, sugerirAjuste, brechasInventario, perfilPreferencias,
    compararSabores,
    PREGUNTAS, PERFILES, medioRango, puntuacionDe,
    PROCESO_A_RECETAS, METODO_A_RECETAS
  };
})();

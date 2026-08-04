/* ============================================================
   DIARIO DE CAFE · contenido editorial y catalogos
   Extraido literalmente de inventario_cafes_v2.html (v2).
   Este material es original de Carla y NO se reescribe:
   41 tips, 8 variedades, 18 origenes, 8 familias de sabor,
   7 pasos de cata, recetas por proceso (C3 + Whirly) y el
   motor de recomendacion filtro/espresso.
   ============================================================ */

/* --- Molinillos conocidos (referencia de rangos, no verdad absoluta) --- */
const GRINDERS = {
  C3:     { name: 'Timemore C3',         unit: 'clicks', desc: 'Manual · ~83 µm/click · 36 clicks total' },
  Whirly: { name: 'Timemore Whirly 01S', unit: 'ajuste', desc: 'Eléctrico · escala decimal 1.0–12.0 · punto de partida, calibra a tu gusto' }
};

/* --- Recetas por proceso: el activo mas valioso de la v2 --- */
const RECETAS = {
  'Lavado': {
    cssClass: 'pc-lavado', cssColor: 'var(--p-lavado)',
    perfil: 'Limpio · Ácido · Floral / Cítrico',
    char: 'La pulpa se remueve antes del secado → sabor cristalino, acidez protagonista.',
    tip: '💡 Usa 91–93°C para potenciar la acidez limpia. Flujo constante y bloom corto.',
    metodos: {
      'V60':            { C3:'13–16', Whirly:'4.5–6.0', temp:'91–93°C', dosis:'17–20g', agua:'300ml', tiempo:'3–4 min',   razon:'Flujo controlado resalta sabores limpios sin sobreextracción.', tecnica:'Bloom 30s, 2 fases, flujo constante.' },
      'AeroPress':      { C3:'12–15', Whirly:'3.0–4.5', temp:'88–90°C', dosis:'16–18g', agua:'200ml', tiempo:'1.5–2 min', razon:'Extracción rápida preserva la acidez cítrica y floral.',       tecnica:'Presión lenta 30–40s.' },
      'Nano Outin':     { C3:'13–16', Whirly:'4.0–5.5', temp:'90–92°C', dosis:'14–16g', agua:'240ml', tiempo:'2.5–3 min', razon:'Similar a V60 pero con flujo más rápido.',                      tecnica:'Bloom 30s, 2 fases rápidas.' },
      'Prensa Francesa':{ C3:'20–24', Whirly:'8.0–10.0',temp:'93–95°C', dosis:'30–35g', agua:'500ml', tiempo:'4 min',     razon:'Inmersión completa, molido grueso evita amargor.',              tecnica:'Reposo exacto 4 min, sin agitar.' }
    }
  },
  'Natural': {
    cssClass: 'pc-natural', cssColor: 'var(--p-natural)',
    perfil: 'Afrutado · Dulce · Cuerpo Completo',
    char: 'Se seca con toda la cereza → máxima dulzura, fruta intensa, bajo ácido.',
    tip: '💡 Temperatura media-alta y tiempos largos de inmersión. No sobreextrae.',
    metodos: {
      'Prensa Francesa':{ C3:'20–24', Whirly:'8.0–10.0',temp:'93–95°C', dosis:'30–35g', agua:'500ml', tiempo:'4 min',     razon:'Inmersión completa extrae máxima dulzura y cuerpo.',  tecnica:'Reposo exacto 4 min, sin agitar.' },
      'AeroPress':      { C3:'14–16', Whirly:'3.5–4.5', temp:'90–92°C', dosis:'18–20g', agua:'200ml', tiempo:'1.5–2 min', razon:'Presión suave extrae dulzura sin amargura.',          tecnica:'Presión muy lenta, sin esfuerzo.' },
      'V60':            { C3:'14–16', Whirly:'5.0–6.5', temp:'92–94°C', dosis:'18–20g', agua:'300ml', tiempo:'3.5–4 min', razon:'Flujo lento potencia el cuerpo y la dulzura natural.', tecnica:'Bloom 45s, vierte despacio.' }
    }
  },
  'Honey': {
    cssClass: 'pc-honey', cssColor: 'var(--p-honey)',
    perfil: 'Balance Perfecto · Dulce + Ácido',
    char: 'Pulpa removida, mucílago permanece → equilibrio único entre dulzura y acidez.',
    tip: '💡 Temperaturas medias (89–92°C). El Honey tiene su propio balance — no lo fuerces.',
    metodos: {
      'V60':        { C3:'13–16', Whirly:'4.5–6.0', temp:'90–92°C', dosis:'18–20g', agua:'300ml', tiempo:'3–3.5 min',  razon:'Control fino destaca el balance natural del Honey.',   tecnica:'Bloom 30s, flujo moderado y constante.' },
      'AeroPress':  { C3:'13–15', Whirly:'3.0–4.5', temp:'89–91°C', dosis:'17–19g', agua:'200ml', tiempo:'1.5–2 min',  razon:'Mantiene ambos perfiles sin que uno domine.',          tecnica:'Presión media.' },
      'Nano Outin': { C3:'13–16', Whirly:'4.0–5.5', temp:'89–91°C', dosis:'15–17g', agua:'240ml', tiempo:'2.5–3 min',  razon:'Ideal para explorar el perfil equilibrado.',           tecnica:'Flujo moderado a rápido.' }
    }
  },
  'Anaeróbico': {
    cssClass: 'pc-anaer', cssColor: 'var(--p-anaer)',
    perfil: 'Explosivo · Notas Intensas · Complejo',
    char: 'Fermentación anaeróbica → sabores intensificados, notas tropicales únicas.',
    tip: '💡 TEMPERATURA BAJA (87–89°C). El anaeróbico ya tiene mucho que decir — el agua caliente lo abruma.',
    metodos: {
      'V60':        { C3:'13–15', Whirly:'4.0–5.5', temp:'87–89°C', dosis:'18–20g', agua:'300ml', tiempo:'3–3.5 min',  razon:'Agua fría previene sobreextracción de la complejidad.',      tecnica:'Bloom cuidadoso, flujo lento y deliberado.' },
      'AeroPress':  { C3:'12–14', Whirly:'2.8–4.0', temp:'85–87°C', dosis:'16–18g', agua:'200ml', tiempo:'1.5–2 min',  razon:'Extracción rápida + agua fría = claridad de notas complejas.', tecnica:'Presión consistente, no muy lenta.' },
      'Nano Outin': { C3:'13–15', Whirly:'4.0–5.0', temp:'87–89°C', dosis:'15–17g', agua:'240ml', tiempo:'2.5–3 min',  razon:'Control de temperatura crítico para no abrumar el perfil.',   tecnica:'NO subas la temp. Bloom largo 40s.' }
    }
  },
  'Natural fermentado': {
    cssClass: 'pc-fermentado', cssColor: 'var(--p-fermentado)',
    perfil: 'Ultra Complejo · Frutas Intensas · Cuerpo',
    char: 'Doble fermentación → intensificación máxima, frutas exóticas, complejidad extrema.',
    tip: '💡 Temperatura BAJA + bloom largo (45s) para desgasificar bien antes de extraer.',
    metodos: {
      'V60':            { C3:'13–15', Whirly:'4.5–5.5', temp:'88–90°C', dosis:'18–20g', agua:'300ml', tiempo:'3–3.5 min', razon:'Balance entre claridad y complejidad fermentativa.', tecnica:'Bloom largo 45s, flujo deliberado.' },
      'Prensa Francesa':{ C3:'20–24', Whirly:'8.0–9.5', temp:'92–94°C', dosis:'30–35g', agua:'500ml', tiempo:'4 min',     razon:'Cuerpo completo complementa la complejidad.',       tecnica:'Reposo total, sin agitar.' }
    }
  },
  'Despulpado natural': {
    cssClass: 'pc-despulpado', cssColor: 'var(--p-despulpado)',
    perfil: 'Equilibrio · Cuerpo Medio · Frutas Moderadas',
    char: 'Punto intermedio entre Lavado y Natural — cuerpo presente con algo de acidez.',
    tip: '💡 Similar a Honey: explora ambos lados del perfil. V60 funciona muy bien aquí.',
    metodos: {
      'V60':       { C3:'13–16', Whirly:'4.5–6.0', temp:'90–92°C', dosis:'18–20g', agua:'300ml', tiempo:'3–3.5 min', razon:'Control fino destaca el balance equilibrado.', tecnica:'Estándar V60, flujo moderado.' },
      'AeroPress': { C3:'13–15', Whirly:'3.0–4.5', temp:'89–91°C', dosis:'17–19g', agua:'200ml', tiempo:'1.5–2 min', razon:'Rapidez sin comprometer el balance.',          tecnica:'Presión media.' }
    }
  },
  'Blend': {
    cssClass: 'pc-blend', cssColor: 'var(--p-blend)',
    perfil: 'Múltiples Perfiles · Equilibrio Intencionado',
    char: 'Combinación de orígenes — sigue las instrucciones del tostador si disponibles.',
    tip: '💡 V60 es tu mejor aliado para blends: su versatilidad maneja múltiples perfiles.',
    metodos: {
      'V60':       { C3:'13–16', Whirly:'4.5–6.0', temp:'90–93°C', dosis:'18–20g', agua:'300ml', tiempo:'3–4 min',   razon:'Versatilidad del V60 para múltiples perfiles.',    tecnica:'Bloom 30s, flujo constante.' },
      'AeroPress': { C3:'12–15', Whirly:'3.0–4.5', temp:'88–90°C', dosis:'17–19g', agua:'200ml', tiempo:'1.5–2 min', razon:'Extracción rápida mantiene el balance del blend.', tecnica:'Presión consistente.' }
    }
  }
};

const PC_MAP = {
  'Lavado':'pc-lavado','Natural':'pc-natural','Honey':'pc-honey',
  'Anaeróbico':'pc-anaer','Natural fermentado':'pc-fermentado',
  'Despulpado natural':'pc-despulpado','Blend':'pc-blend'
};

function getMetodosRecomendados(cafe) {
  const p   = cafe.proceso || '';
  const v   = (cafe.variedad || '').toLowerCase();
  const alt = parseInt(cafe.altitud) || 0;
  const sca = parseFloat(cafe.sca) || 0;
  const pais = (cafe.pais || '').toLowerCase();

  /* F = score filtro, E = score espresso */
  let F = 0, E = 0;

  /* Proceso — señal más fuerte */
  const pMap = {
    'Lavado':              [4, 0],
    'Natural':             [1, 4],
    'Despulpado natural':  [1, 3],
    'Honey':               [2, 3],
    'Natural fermentado':  [1, 3],
    'Anaeróbico':          [2, 2],
    'Blend':               [1, 2],
    'Desconocido':         [1, 1],
  };
  const ps = pMap[p] || [1, 1];
  F += ps[0]; E += ps[1];

  /* Variedad */
  if (/geisha|gesha/.test(v))            { F += 3; }
  if (/sl28|sl34/.test(v))               { F += 2; }
  if (/pink bourbon|typica|pacamara/.test(v)) { F += 1; }
  if (/catuai|mundo novo|icatu/.test(v)) { E += 1; }
  if (/caturra|bourbon|tabi/.test(v))    { F += 0.5; E += 0.5; }
  if (/java/.test(v))                    { F += 1; }

  /* Altitud */
  if (alt >= 1700)            F += 1;
  else if (alt > 0 && alt < 1400) E += 1;

  /* SCA */
  if (sca >= 86) F += 1;

  /* País */
  if (/etiopía|etiopia|ethiopia/.test(pais)) F += 1;
  if (/kenia|kenya/.test(pais))              F += 1;
  if (/brasil|brazil/.test(pais))            E += 1;
  if (/ruanda|rwanda/.test(pais))            F += 1;

  const total = F + E || 1;
  const fRatio = F / total;

  const recs = [];
  if (fRatio >= 0.62) {
    recs.push('filtro');
    if (E >= 2) recs.push('espresso');        /* aún funciona para espresso */
  } else if (fRatio <= 0.38) {
    recs.push('espresso');
    if (E >= 2) recs.push('leche');
  } else {
    /* versátil */
    recs.push('filtro');
    recs.push('espresso');
    if (E >= 2) recs.push('leche');
  }
  return recs;
}

/* --- Tips diarios --- */
const TIPS_DIARIOS = [
  { tag:'Método · V60', texto:'El bloom no es opcional', detalle:'Empieza siempre con 2–3× el peso del café en agua (si usas 15g → 30–45ml) a 93°C durante 30–45 segundos. Es el CO₂ escapando: si lo salteas, las burbujas bloquean el flujo y obtienes extracción despareja. Si no ves burbujas, el café ya está muy fresco.' },
  { tag:'Compras', texto:'La fecha de tueste importa más que el precio', detalle:'Busca cafés con menos de 4–8 semanas de tostado para filtro, y 10–21 días de reposo para espresso (el CO₂ extra dificulta la extracción). Un café de $4.000 fresco supera a uno de $12.000 con 3 meses en bodega.' },
  { tag:'Proceso · Lavado', texto:'El lavado te muestra el terroir sin filtros', detalle:'Al remover el mucílago con agua, el café expresa directamente las características de su suelo, altitud y variedad. Es el proceso más "honesto": si la variedad es interesante o la finca tiene carácter, lo verás en taza.' },
  { tag:'Proceso · Natural', texto:'Natural no significa fermentado: significa frutal', detalle:'El grano se seca dentro de la fruta por semanas. El resultado es más cuerpo, dulzura intensa y notas de fruta madura. Requiere control milimétrico del secado — los errores se notan como fermentación en taza.' },
  { tag:'Método · AeroPress', texto:'La presión del AeroPress no es espresso', detalle:'El AeroPress genera ~0.3–0.7 bares vs los 9 bares del espresso. Su magia está en la inmersión total + filtrado limpio. Invertirlo (inverted method) da más control sobre el tiempo de contacto. Muele más grueso de lo que crees.' },
  { tag:'Sciencia', texto:'La temperatura del agua cambia el perfil del café', detalle:'88°C extrae ácidos suaves y dulzura — ideal para naturales y anaeróbicos florales. 93–96°C extrae más estructura y amargor — ideal para lavados de altura. Prueba el mismo café a 90°C y 95°C: son perfiles completamente distintos.' },
  { tag:'Variedades', texto:'Geisha no es solo moda: tiene razones botánicas', detalle:'La variedad Geisha tiene hoja alargada y perfil floral único por su genética etíope. Crece mejor sobre 1700 msnm y es muy susceptible a enfermedades — produce poco y cuesta caro. Sus notas de jazmín y bergamota son reales, no marketing.' },
  { tag:'Método · Prensa Francesa', texto:'La prensa francesa extrae los aceites que el filtro retiene', detalle:'Sin papel, los aceites naturales pasan a la taza — eso da el cuerpo característico. La desventaja: sin filtrar los finos, puede haber sedimento. Espera 4 minutos, no revuelvas después de verter, y sirve lentamente.' },
  { tag:'Molienda', texto:'La consistencia de molienda importa más que el número', detalle:'Un molino de burr muele más uniformemente que uno de cuchillas. Los finos (partículas pequeñas) sobreextraen y dan amargor. Con un buen molino cada ajuste es predecible — y eso cambia todo.' },
  { tag:'Altitud', texto:'A más altitud, más densidad y acidez más brillante', detalle:'A mayor altitud (1500–2200 msnm) las temperaturas bajas ralentizan el desarrollo del fruto. El grano crece más lento, acumula más azúcares, es más denso y tiene acidez más compleja. Los SHB (Strictly Hard Bean, +1400m) son los preferidos en especialidad.' },
  { tag:'Proceso · Honey', texto:'El honey es el punto medio entre lavado y natural', detalle:'Se remueve la pulpa pero se deja parte del mucílago durante el secado. Más mucílago = más dulzura, más complejidad. Existen honey amarillo (menos mucílago), rojo y negro. El negro puede tener tanta fruta como un natural.' },
  { tag:'Recetas', texto:'El ratio agua:café es tu primer parámetro', detalle:'1:15 (1g de café por 15ml de agua) es el punto de partida para la mayoría de métodos de filtro. Para una taza de 250ml necesitas ~16–17g de café. El espresso usa 1:2 (18g → 36ml). Ajusta el ratio antes de cambiar otros parámetros.' },
  { tag:'Método · Nano Outin', texto:'El Nano Outin es inmersión controlada: no lo apures', detalle:'Este método de doble cámara funciona por presión diferencial: el café se extrae en la cámara superior y luego baja por gravedad. La clave es la molienda media y el tiempo: 3–4 minutos para un filtrado limpio y equilibrado.' },
  { tag:'Agua', texto:'El agua filtrada no es perfecta: el café necesita minerales', detalle:'El agua completamente desmineralizada extrae mal el café — los minerales actúan como vectores de sabor. Lo ideal es 75–150 TDS, con predominancia de magnesio (capta aromas). El agua embotellada baja en minerales suele funcionar bien.' },
  { tag:'Fermentación', texto:'Anaeróbico significa fermentación sin oxígeno', detalle:'El café anaeróbico se fermenta en tanques sellados donde las levaduras trabajan sin O₂. El resultado son sabores más intensos: ciruela, vino, cacao. Es difícil de dominar — cuando está bien hecho es extraordinario; mal hecho, es feo.' },
  { tag:'Sciencia', texto:'La extracción tiene tres fases', detalle:'1) Acidez y brillantez salen primero. 2) Azúcares y dulzura en el medio. 3) Amargos y taninos al final. Si tu café amarga, sobreextraíste. Si es plano o agrio, subextraíste. El objetivo: ~18–22% extracción total.' },
  { tag:'Origen · Colombia', texto:'Colombia produce dos cosechas al año en muchas regiones', detalle:'Gracias a la geografía andina, regiones como Huila, Nariño y Cauca cosechan en abril-junio y en octubre-diciembre. Huila es conocida por acidez brillante; Nariño por notas florales e intensidad. Dos temporadas = más frescura en el mercado.' },
  { tag:'Variedades · Colombia', texto:'Tabi y Pink Bourbon son variedades colombianas únicas', detalle:'Tabi es un híbrido creado por Cenicafé (Typica × Bourbon × Timor): buena taza y resistencia a enfermedades. Pink Bourbon es misteriosa — genética debatida, perfil floral y balance ácido/dulce la han vuelto muy buscada.' },
  { tag:'Compras', texto:'El tostador importa tanto como el origen', detalle:'Un buen café puede ser arruinado por un tueste oscuro que carboniza los azúcares. Para especialidad, busca tuestes claros a medios que preserven los sabores del origen. "Intenso" o "fuerte" sin mencionar el origen es señal de tueste oscuro genérico.' },
  { tag:'Método · Espresso', texto:'Para espresso busca cafés con 14–21 días de reposo', detalle:'El café recién tostado tiene mucho CO₂ que impide la extracción uniforme. Espera al menos 10 días, idealmente 14–21 para tuestes claros. Señal de que está listo: la crema es densa y color avellana, no clara llena de burbujas grandes.' },
  { tag:'Origen · Etiopía', texto:'Etiopía es el origen del café: la diversidad genética es única', detalle:'El café arábica se originó en las selvas de Kaffa. Hay miles de variedades silvestres sin catalogar. Los lavados de Yirgacheffe son famosos por bergamota, limón y flor de azahar. Los naturales de Sidamo y Guji tienen fruta tropical intensa.' },
  { tag:'Variedades', texto:'Bourbon y Typica son las dos variedades madre del arábica', detalle:'Casi todas las variedades modernas descienden de estas dos. Bourbon llegó de Etiopía a la isla Bourbon en el S.XVIII. Typica viajó vía Yemen, India y Java. Ambas dan tazas complejas y son la base genética de Caturra, Catuai, Mundo Novo y decenas más.' },
  { tag:'Proceso', texto:'El despulpado natural es el proceso dominante en Brasil', detalle:'Similar al honey: se remueve la pulpa mecánicamente pero se deja algo del mucílago. Produce cafés con buen cuerpo, dulzura de chocolate y nuez, menor acidez que los lavados — muy consistentes para espresso. Brasil no podría producir lo que produce sin este proceso.' },
  { tag:'Sciencia', texto:'El color del tueste afecta la solubilidad', detalle:'Los tuestes claros tienen grano más duro y menos soluble — necesitas agua más caliente o más tiempo. Los tuestes oscuros son más solubles — extraen rápido y se sobreextraen con facilidad. Si tienes un natural oscuro que amarga, baja la temperatura antes de cambiar la molienda.' },
  { tag:'Almacenamiento', texto:'El orden de enemigos del café: oxígeno, humedad, luz, temperatura', detalle:'Guarda en recipiente hermético opaco, temperatura ambiente (no el refrigerador: la condensación es peor que el calor). Una vez molido, el café pierde 70% de sus aromas en 15 minutos — muele justo antes de preparar.' },
  { tag:'Origen · Kenia', texto:'Los kenianos SL28 y SL34 tienen sabor a grosella negra', detalle:'Los laboratorios Scott desarrollaron estas variedades en los años 30–40. Resultado inesperado: acidez intensa con notas de grosella negra, tomate maduro y vino. El sistema de subastas kenianas (AA, AB por tamaño de grano) garantiza alta calidad.' },
  { tag:'Método', texto:'Más grueso no siempre resuelve el amargor', detalle:'El error común: si amarga, moler más grueso. Pero si la temperatura es muy alta o el tiempo de contacto largo, igual sobreextraes. Los dos parámetros van juntos. Primero baja la temperatura 2°C antes de cambiar la molienda.' },
  { tag:'Proceso · Anaeróbico', texto:'Los anaeróbicos tienen notas de fermentación intencional', detalle:'Cuando ves "anaeróbico natural fermentado": espera ciruela macerada, vino tinto, cacao. Es un perfil polarizante. En métodos de filtro a baja temperatura (88–90°C) el perfil se vuelve más suave y complejo.' },
  { tag:'Recetas', texto:'La vertida en el V60 no es solo técnica: es ritmo', detalle:'30g bloom → espera 30s → 70g en espiral (0:30–1:00) → 100g (1:00–1:30) → 150g (1:30–2:00). Las vertidas en espiral distribuyen el agua mejor que verter siempre al centro. Tiempo total ideal: 2:30–3:00 min para 15g de café.' },
  { tag:'Compras', texto:'Los cafés de doble fermentación son más expresivos', detalle:'La fermentación extendida (24–72h en tanque sellado) amplifica los sabores del café. Busca: "fermentación larga", "maceración carbónica", "anaeróbico doble". Son más intensos, más complejos, y un poco más difíciles de extraer bien.' },
  { tag:'Origen · Perú', texto:'Perú está emergiendo en el mapa de la especialidad', detalle:'Cajamarca, San Martín y Amazonas producen cafés de altura con notas limpias, cítricos y florales. Principalmente de pequeños agricultores en cooperativas. Excelente relación calidad-precio: especialidad a precios más accesibles que Colombia o Kenia.' },
  { tag:'Sciencia', texto:'El filtro de papel también filtra aceites', detalle:'Los aceites del café contienen cafestol y kahweol, que elevan el colesterol LDL. El filtro de papel los retiene casi completamente. La prensa francesa los deja pasar. Dicho esto: una o dos tazas diarias de prensa francesa no tienen impacto clínico significativo en adultos sanos.' },
  { tag:'Método', texto:'Precalentar siempre: la temperatura estable cambia el resultado', detalle:'Una cafetera fría absorbe calor del agua, bajando la temperatura real de extracción 3–5°C por debajo de lo que configuraste. Vierte agua caliente en el dripper, la jarra y la taza antes de empezar — notarás la diferencia desde el primer sorbo.' },
  { tag:'Variedades', texto:'Caturra muestra exactamente lo que le das', detalle:'Mutación natural de Bourbon descubierta en Brasil. Compacta, productiva, sensible al manejo. A baja altitud puede ser plana. A 1600+ msnm con buen proceso: dulzura de caramelo y acidez cítrica limpia. No tiene los florales del Geisha, pero tiene carácter cuando está bien cultivada.' },
  { tag:'Origen · Guatemala', texto:'Guatemala tiene microclimas que producen cafés muy distintos', detalle:'Huehuetenango (1500–2000msnm) produce cafés con acidez brillante y notas frutales. Antigua tiene suelo volcánico que da cuerpo y dulzura. Cobán es húmedo y produce cafés más suaves y achocolatados. Tres perfiles completamente distintos en el mismo país.' },
  { tag:'Método', texto:'La WDT mejora el espresso más que cualquier otro cambio menor', detalle:'Revolver el café molido en el portafiltro con una aguja antes de tamp elimina los grumos. Los grumos crean canales donde el agua fluye más rápido, generando extracción despareja. Cuesta $0 si usas una aguja de disección — el resultado: crema más uniforme.' },
  { tag:'Sciencia', texto:'El café robusta no es inferior: es diferente', detalle:'Coffea canephora tiene más cafeína (2×), menos azúcares, más amargos. Alta calidad de robusta de Vietnam o Uganda puede ser compleja, con notas de chocolate y especias. Los blends de espresso italianos clásicos usan 10–30% robusta para crema y cuerpo.' },
  { tag:'Método · Cold Brew', texto:'El cold brew se extrae con tiempo, no con temperatura', detalle:'Con agua fría (4–20°C) durante 12–24 horas extraes principalmente dulzura y compuestos de bajo amargor. Los ácidos delicados quedan en el grano — perfil muy distinto al mismo café en caliente. Ratio 1:8, molienda gruesa, refrigerador hasta 2 semanas.' },
  { tag:'Origen · Costa Rica', texto:'Costa Rica formalizó el honey process y el micro-lote', detalle:'Los micro-beneficios costarricenses desarrollaron el honey a escala. La ley prohíbe el cultivo de robusta — solo arábica. Tarrazu es la región más famosa por acidez brillante; Tres Ríos produce cafés más sutiles con notas de fruta roja.' },
  { tag:'Variedades', texto:'Pacamara: el grano gigante de El Salvador', detalle:'Híbrido de Pacas y Maragogipe. Sus granos son los más grandes del mundo del café. El perfil sorprende: a pesar del tamaño, es elegante, con buena acidez y notas que van de floral a chocolatada según el proceso.' },
  { tag:'Recetas', texto:'En espresso: primero calibra el tiempo, luego todo lo demás', detalle:'Para 18g de café → 36ml, el tiempo objetivo es 25–30 segundos. Si extrae en 15s → muele más fino. Si tarda 40s+ → más grueso. La presión (9 bars) se mantiene constante; la resistencia del café la controlas con la molienda.' },
];

/* --- Variedades --- */
const VARIEDADES = [
  {
    nombre: 'Geisha / Gesha',
    origen: 'Etiopía → Panamá',
    desc: 'La variedad más codiciada del café de especialidad. Originaria de Gesha, Etiopía, su potencial se descubrió en Hacienda La Esmeralda, Panamá, en 2004. Su perfil es inmediatamente reconocible y difícil de igualar. Crece mejor sobre 1800 msnm, produce poco y es muy susceptible a enfermedades — todo eso justifica el precio.',
    sabores: ['Jazmín', 'Bergamota', 'Té blanco', 'Maracuyá', 'Limón'],
    metodos: 'V60, AeroPress invertido',
    proceso: 'Lavado o Natural',
    altitud: 'Sobre 1700 msnm',
    nota: 'Cualquier error de extracción se amplifica — exige técnica afinada'
  },
  {
    nombre: 'Caturra',
    origen: 'Brasil → Colombia',
    desc: 'Mutación natural de Bourbon descubierta en Minas Gerais, Brasil. Es la variedad base de muchos cafés colombianos: compacta, productiva, honesta. A baja altitud puede ser plana; a 1600+ msnm con buen proceso muestra dulzura de caramelo y acidez cítrica limpia.',
    sabores: ['Caramelo', 'Cítrico', 'Cereza', 'Chocolate', 'Frutos secos'],
    metodos: 'V60, Prensa Francesa',
    proceso: 'Lavado (mejor expresión a altura)',
    altitud: '1200–2000 msnm',
    nota: 'Workhouse del café de especialidad: versátil y honesta'
  },
  {
    nombre: 'Bourbon',
    origen: 'Isla Reunión (Francia)',
    desc: 'Una de las dos variedades madre del arábica moderno. Llegó de Etiopía a la isla Bourbon (hoy Reunión) en el S.XVIII. Produce tazas complejas con dulzura y acidez brillante de fruta roja. Las variantes amarilla y naranja añaden aún más dulzura.',
    sabores: ['Fruta roja', 'Chocolate', 'Caramelo', 'Madera suave', 'Floral sutil'],
    metodos: 'V60, Chemex, AeroPress',
    proceso: 'Lavado o Natural',
    altitud: '1200–1800 msnm',
    nota: 'Base genética de Caturra, Catuai y decenas de variedades más'
  },
  {
    nombre: 'Typica',
    origen: 'Etiopía → Asia → América',
    desc: 'La otra gran variedad madre. Viajó de Etiopía a Yemen, luego a India, Java, y de ahí al mundo entero. Sus tazas son delicadas, limpias, con dulzura de vainilla y acidez suave. Produce poco (gran desventaja comercial) pero a plena altura puede ser extraordinaria.',
    sabores: ['Vainilla', 'Floral suave', 'Limón suave', 'Miel', 'Chocolate blanco'],
    metodos: 'V60, Chemex',
    proceso: 'Lavado (expresa mejor su delicadeza)',
    altitud: '1400–2000 msnm',
    nota: 'Bajo rendimiento pero elegancia difícil de igualar'
  },
  {
    nombre: 'Pink Bourbon',
    origen: 'Colombia',
    desc: 'Variedad de identidad genética debatida — se cree híbrido de Bourbon rojo y amarillo con posible influencia etíope. Ha ganado popularidad enorme en el mercado colombiano por su perfil floral intenso, balance ácido/dulce perfecto y retrogusto largo.',
    sabores: ['Durazno', 'Rosa', 'Maracuyá', 'Guayaba', 'Citronella'],
    metodos: 'V60, AeroPress a baja temperatura',
    proceso: 'Lavado o Honey',
    altitud: '1500–2100 msnm',
    nota: 'Muy de moda — busca productores serios para los mejores ejemplos'
  },
  {
    nombre: 'Tabi',
    origen: 'Colombia (Cenicafé)',
    desc: 'Creada por Cenicafé como híbrido de Typica, Bourbon y Timor. Su nombre significa "bueno" en dialecto páez. Tiene resistencia a enfermedades, alta productividad y un perfil de taza complejo con estructura y dulzura. Es el futuro práctico del café colombiano de calidad.',
    sabores: ['Chocolate', 'Canela', 'Fruta tropical', 'Almizcle', 'Caramelo'],
    metodos: 'V60, Prensa Francesa, Espresso',
    proceso: 'Lavado, Natural o Honey',
    altitud: '1500–2000 msnm',
    nota: 'Versatilidad excepcional: funciona bien en cualquier método'
  },
  {
    nombre: 'SL28 / SL34',
    origen: 'Kenia (Laboratorios Scott)',
    desc: 'Desarrolladas por los Laboratorios Scott en los años 1930–40, estas variedades kenianas tienen una identidad única: acidez intensa con notas de grosella negra, tomate maduro y vino. Son muy valoradas en el mercado de exportación y difíciles de encontrar fuera de Kenia.',
    sabores: ['Grosella negra', 'Tomate', 'Vino tinto', 'Limón negro', 'Especias'],
    metodos: 'V60, Chemex (realza la acidez)',
    proceso: 'Lavado (casi siempre)',
    altitud: '1500–2100 msnm',
    nota: 'Para quienes aman la acidez brillante — no para todos, pero memorables'
  },
  {
    nombre: 'Pacamara',
    origen: 'El Salvador',
    desc: 'Híbrido de Pacas (Bourbon salvadoreño compacto) y Maragogipe (mutación Typica de granos gigantes). Sus granos son los más grandes del mundo del café. El perfil sorprende: a pesar del tamaño, es elegante y complejo, con acidez clara y notas que van de floral a chocolatada según el proceso.',
    sabores: ['Floral', 'Frutas tropicales', 'Chocolate amargo', 'Vainilla', 'Madera dulce'],
    metodos: 'V60, AeroPress',
    proceso: 'Lavado o Natural',
    altitud: '1200–1800 msnm',
    nota: 'Los granos grandes piden molienda calibrada — no asumir por el tamaño'
  },
];

/* --- Origenes --- */
const ORIGINS = [
  { pais:'Etiopía',      flag:'🇪🇹', region:'África Oriental',   perfil:'Bergamota, jazmín, limón, té blanco, fruta tropical. El origen del café arábica.' },
  { pais:'Kenya',        flag:'🇰🇪', region:'África Oriental',   perfil:'Grosella negra, tomate maduro, vino tinto, especias. Acidez brillante y única.' },
  { pais:'Ruanda',       flag:'🇷🇼', region:'África Central',    perfil:'Azúcar de caña, fruta tropical, floral. Cuerpo sedoso, acidez elegante.' },
  { pais:'Colombia',     flag:'🇨🇴', region:'América del Sur',   perfil:'Caramelo, fruta roja, chocolate, acidez cítrica limpia. Dos cosechas al año.' },
  { pais:'Peru',         flag:'🇵🇪', region:'América del Sur',   perfil:'Chocolate, caramelo, cítrico suave. Especialidad emergente, excelente valor.' },
  { pais:'Bolivia',      flag:'🇧🇴', region:'América del Sur',   perfil:'Chocolate amargo, durazno, almendras. Altitud extrema, producción limitada.' },
  { pais:'Brasil',       flag:'🇧🇷', region:'América del Sur',   perfil:'Chocolate, nuez, caramelo, bajo en acidez. Base clásica del espresso.' },
  { pais:'Ecuador',      flag:'🇪🇨', region:'América del Sur',   perfil:'Floral, cítrico, cacao. Origen emergente con gran potencial.' },
  { pais:'Guatemala',    flag:'🇬🇹', region:'América Central',   perfil:'Acidez brillante, fruta, cuerpo completo. Múltiples microclimas únicos.' },
  { pais:'Honduras',     flag:'🇭🇳', region:'América Central',   perfil:'Dulce, caramelo, fruta tropical. Gran crecimiento en calidad reciente.' },
  { pais:'Costa Rica',   flag:'🇨🇷', region:'América Central',   perfil:'Acidez brillante, honey process innovador. Solo arábica por ley.' },
  { pais:'El Salvador',  flag:'🇸🇻', region:'América Central',   perfil:'Bourbon, Pacamara únicos. Dulce, complejo, historia cafetera profunda.' },
  { pais:'Nicaragua',    flag:'🇳🇮', region:'América Central',   perfil:'Suave, dulce, achocolatado. Coffees de finca con buen perfil de altura.' },
  { pais:'Panamá',       flag:'🇵🇦', region:'América Central',   perfil:'Hogar de la Geisha. Hacienda La Esmeralda cambió el mundo del café.' },
  { pais:'México',       flag:'🇲🇽', region:'América del Norte', perfil:'Chocolate, especias, acidez suave. Chiapas y Oaxaca son las zonas clave.' },
  { pais:'Jamaica',      flag:'🇯🇲', region:'Caribe',            perfil:'Blue Mountain: suave, limpio, equilibrado. Uno de los más caros del mundo.' },
  { pais:'Indonesia',    flag:'🇮🇩', region:'Asia Pacífico',     perfil:'Terroso, cuerpo completo, especiado. Sumatra Mandheling es el icónico.' },
  { pais:'Yemen',        flag:'🇾🇪', region:'Medio Oriente',     perfil:'Vino, especias, frutas secas. El origen histórico del café comercial.' },
];

/* --- Familias de sabor (paleta y descripciones) --- */
const FLAVOR_CATS = [
  { name:'Frutal', color:'oklch(58% 0.18 29)', desc:'Frutos tropicales, cítricos, bayas. Suele indicar buen proceso y variedad expresiva.',
    tags:['Maracuyá','Mango','Limón','Naranja','Cereza','Ciruela','Frutilla','Grosella','Durazno','Piña'] },
  { name:'Floral', color:'oklch(55% 0.16 338)', desc:'Jazmín, rosas, lavanda. Típico de variedades como Geisha y orígenes etíopes lavados.',
    tags:['Jazmín','Rosa','Lavanda','Bergamota','Hibisco','Azahar','Madreselva'] },
  { name:'Dulce', color:'oklch(68% 0.16 72)', desc:'Azúcar, miel, caramelo. Indica buena madurez del fruto y proceso cuidado.',
    tags:['Caramelo','Miel','Panela','Chocolate blanco','Vainilla','Melaza','Toffee'] },
  { name:'Nuez y Cacao', color:'oklch(48% 0.10 52)', desc:'Avellana, almendra, chocolate. Común en Brasil, Honduras y procesos naturales suaves.',
    tags:['Chocolate amargo','Cacao','Avellana','Almendra','Nuez','Maní','Mantequilla'] },
  { name:'Especiado', color:'oklch(52% 0.14 43)', desc:'Canela, pimienta, clavo. Aparece en anaeróbicos y algunos naturales fermentados.',
    tags:['Canela','Clavo','Anís','Pimienta','Cardamomo','Nuez moscada'] },
  { name:'Ácido', color:'oklch(56% 0.19 238)', desc:'Acidez brillante o vinácea. Señal de altura, variedad y buen proceso en lavados.',
    tags:['Limón','Lima','Mandarina','Manzana verde','Vinagre suave','Tamarindo','Vino blanco'] },
  { name:'Fermentado', color:'oklch(52% 0.21 302)', desc:'Vino, cerveza, kimchi. Intencional en anaeróbicos, defecto en naturales mal manejados.',
    tags:['Vino tinto','Ciruela macerada','Levadura','Kombucha','Vinagre intenso','Fermentado tropical'] },
  { name:'Verde / Vegetal', color:'oklch(50% 0.17 152)', desc:'Hierba, guisantes, madera fresca. Suele indicar subextracción o café poco maduro.',
    tags:['Hierba','Guisante','Bambú','Madera fresca','Cebolla suave','Tabaco'] },
];

/* --- Protocolo de cata --- */
const CATA_STEPS = [
  { n:'01', title:'Prepara y espera', text:'Prepara el café con tu método habitual. Espera 2–3 minutos antes de probar — deja que baje la temperatura a ~65°C. A temperatura muy alta, los sabores se aplastan.' },
  { n:'02', title:'Primera nariz (seco)', text:'Antes de preparar, huele el café molido. Cierra los ojos. ¿Qué categoría aparece? Esa primera impresión suele confirmar el perfil del proceso: floral = lavado etíope, frutal intenso = natural.' },
  { n:'03', title:'Primera nariz (húmedo)', text:'Inmediatamente después de verter el agua caliente sobre el café, inhala el vapor. El CO₂ liberado arrastra los aromas más volátiles y florales — los más difíciles de detectar en taza fría.' },
  { n:'04', title:'Primer sorbo: textura', text:'Toma un sorbo y enfócate solo en la textura antes del sabor. ¿Acuoso como el té? ¿Sedoso como la leche? ¿Cremoso? ¿Con taninos que resecan? El cuerpo te dice algo sobre el proceso y el molido.' },
  { n:'05', title:'Segundo sorbo: dulzura y acidez', text:'¿Hay dulzura al inicio? ¿La acidez es brillante y limpia o áspera? ¿En qué parte de la lengua la sientes? La acidez en los lados = cítrica. Al frente = málica (manzana). En la garganta = fermentativa.' },
  { n:'06', title:'Retrogusto', text:'Después de tragar, ¿cuánto tiempo permanece el sabor? ¿Qué cambia? Los mejores cafés tienen retrogusto largo y evolucionan: empiezan con fruta, terminan con chocolate o flor. Un retrogusto corto o amargo = sobreextracción o tueste oscuro.' },
  { n:'07', title:'Taza fría (15–20 min)', text:'Vuelve a la taza cuando está casi fría. Los azúcares se perciben mejor a baja temperatura y la acidez se vuelve más clara. Si el café mejoró frío: buen origen. Si empeoró: posible sobreextracción o agua mal calibrada.' },
];

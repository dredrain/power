// guia.js — contenido de referencia (offline, sin dependencias).
// Saca del flujo de entreno las explicaciones largas y las agrupa aqui:
//   - ACLARACIONES: como funciona la app y la filosofia de fase 1.
//   - ESQUEMAS / esquemaSVG(): dibujos SVG por patron de movimiento.
//   - FICHAS: guia breve por ejercicio (claves + errores), keyed por id del bloque.
// Todo es texto/SVG inline: no descarga imagenes ni gifs (no rompe offline ni
// inventa URLs). Los gifs reales quedan como hueco de fase 2.

// ---- Aclaraciones (movidas desde el flujo) ----
export const ACLARACIONES = [
  {
    titulo: 'Lo unico que cuenta: presentarte',
    cuerpo: 'En esta fase el unico objetivo es la adherencia, no los kilos. Un dia en que solo haces el basico ya es un exito total. Sin PRs, sin porcentajes, sin rachas de dias: eso llega en fase 2, cuando el habito este asentado.',
  },
  {
    titulo: 'Como se cuenta la adherencia',
    cuerpo: 'Objetivo: 3 sesiones del nucleo (A, B, C) por semana. La version minima ("voy justo") cuenta igual que la completa. El dia de casa (D) es un extra: saltarlo no penaliza. Regla operativa: nunca dos sesiones seguidas perdidas. No se persiguen rachas de dias consecutivos — entrenar dias seguidos no suma a la adherencia y carga de mas lumbar/rodilla viniendo de destreno.',
  },
  {
    titulo: 'El semaforo',
    cuerpo: 'Verde: vas bien esta semana. Amarillo: te falta alguna sesion, aun a tiempo. Rojo: cuidado con encadenar dos perdidas. El mensaje se calcula solo con las sesiones del nucleo registradas.',
  },
  {
    titulo: 'Subir / mantener / bajar',
    cuerpo: 'La app autorregula la carga por RIR: si la ultima vez el peso se quedo facil (dejaste mas reps en el deposito que el objetivo), sugiere Subir; si costo lo justo, Mantener; si costo de mas, Bajar. Nunca sugiere subir si una zona relevante tenia dolor alto o empeoro a 24h. "Estimar" aparece la primera vez, cuando aun no hay historial.',
  },
  {
    titulo: 'La regla de las 24h (dolor)',
    cuerpo: 'Una molestia de 3-4/10 durante el ejercicio es aceptable si no empeora al dia siguiente ni altera el sueno. Por eso, al abrir la app al dia siguiente, pregunta como siguen las zonas que dolieron. Si empeoraron a 24h, la app baja la carga de esa zona en vez de insistir.',
  },
  {
    titulo: '"Voy justo" (version minima)',
    cuerpo: 'Deja solo el basico y el trabajo no recortable (~40 min) para los dias que llegas tarde o cansado. Completar la version minima cuenta como sesion hecha. Es mejor una sesion corta que ninguna.',
  },
  {
    titulo: 'RIR y RPE',
    cuerpo: 'RIR = repeticiones en reserva (las que podrias hacer mas antes del fallo). En fase 1 el objetivo es RIR >= 3 (RPE <= 7): siempre dejar 3-4 en el deposito. Vienes de destreno; los tendones y la espalda toleran menos de lo que la fuerza recuerda.',
  },
  {
    titulo: 'El calentamiento no se recorta',
    cuerpo: 'El trabajo correctivo de lumbar, rodilla y hombro vive en el calentamiento y entre series del basico, no como un bloque aparte que se recorta cuando vas justo. La evidencia apoya la fuerza progresiva cargable por encima de estiramientos o correctivos aislados: por eso los accesorios ya son ejercicios de fuerza, no un circuito de gomas.',
  },
  {
    titulo: 'Cuando parar y ver a un fisio',
    cuerpo: 'La app no diagnostica. Si aparece dolor agudo, punzante, irradiado, nocturno o que empeora de forma progresiva: fisioterapeuta deportivo antes de seguir cargando esa zona. Gestionar el dolor no es ni ignorarlo ni reposo total: es ajustar carga o rango.',
  },
];

// ---- Esquemas SVG por patron de movimiento ----
// Se inyectan como innerHTML; el color lo pone el CSS (.esquema ...).
const ESQUEMAS = {
  // Sentadilla (vista frontal, fondo de la sentadilla, barra en la espalda).
  sentadilla: `<svg class="esquema" viewBox="0 0 140 120" role="img" aria-label="Esquema de sentadilla">
    <line class="suelo" x1="16" y1="110" x2="124" y2="110"/>
    <line class="barra" x1="40" y1="38" x2="100" y2="38"/>
    <line class="disco" x1="40" y1="26" x2="40" y2="50"/>
    <line class="disco" x1="100" y1="26" x2="100" y2="50"/>
    <circle class="art" cx="70" cy="26" r="6"/>
    <line class="fig" x1="70" y1="40" x2="70" y2="66"/>
    <line class="fig" x1="70" y1="46" x2="52" y2="39"/>
    <line class="fig" x1="70" y1="46" x2="88" y2="39"/>
    <line class="fig" x1="70" y1="66" x2="52" y2="84"/>
    <line class="fig" x1="52" y1="84" x2="52" y2="106"/>
    <line class="fig" x1="70" y1="66" x2="88" y2="84"/>
    <line class="fig" x1="88" y1="84" x2="88" y2="106"/>
    <line class="fig" x1="44" y1="106" x2="58" y2="106"/>
    <line class="fig" x1="82" y1="106" x2="96" y2="106"/>
    <line class="flecha" x1="118" y1="98" x2="118" y2="54"/>
    <polygon class="flecha-fill" points="112,62 124,62 118,48"/>
  </svg>`,
  // Bisagra de cadera (perfil): tronco hacia delante, espalda recta, barra en las manos.
  bisagra: `<svg class="esquema" viewBox="0 0 140 120" role="img" aria-label="Esquema de bisagra de cadera">
    <line class="suelo" x1="16" y1="110" x2="124" y2="110"/>
    <line class="fig" x1="74" y1="60" x2="74" y2="86"/>
    <line class="fig" x1="74" y1="86" x2="72" y2="108"/>
    <line class="fig" x1="64" y1="108" x2="82" y2="108"/>
    <line class="fig" x1="74" y1="60" x2="43" y2="50"/>
    <circle class="art" cx="36" cy="47" r="6"/>
    <line class="fig" x1="47" y1="51" x2="49" y2="82"/>
    <circle class="relleno" cx="49" cy="88" r="7"/>
    <line class="disco" x1="49" y1="79" x2="49" y2="97"/>
    <line class="flecha" x1="112" y1="92" x2="112" y2="54"/>
    <polygon class="flecha-fill" points="106,62 118,62 112,48"/>
  </svg>`,
  // Press banca (perfil): banco, cuerpo tumbado, barra arriba y fantasma en el pecho.
  empuje: `<svg class="esquema" viewBox="0 0 140 120" role="img" aria-label="Esquema de press banca">
    <line class="suelo" x1="16" y1="110" x2="124" y2="110"/>
    <line class="equipo" x1="30" y1="80" x2="92" y2="80"/>
    <line class="equipo" x1="38" y1="80" x2="38" y2="108"/>
    <line class="equipo" x1="84" y1="80" x2="84" y2="108"/>
    <line class="fig" x1="40" y1="74" x2="80" y2="74"/>
    <circle class="art" cx="86" cy="71" r="6"/>
    <line class="fig" x1="44" y1="74" x2="36" y2="92"/>
    <line class="fig" x1="36" y1="92" x2="36" y2="108"/>
    <line class="fig" x1="74" y1="74" x2="70" y2="46"/>
    <line class="fig" x1="80" y1="74" x2="76" y2="46"/>
    <line class="barra" x1="58" y1="44" x2="90" y2="44"/>
    <line class="disco" x1="58" y1="34" x2="58" y2="54"/>
    <line class="disco" x1="90" y1="34" x2="90" y2="54"/>
    <line class="ghost" x1="60" y1="66" x2="88" y2="66"/>
    <line class="flecha" x1="112" y1="68" x2="112" y2="46"/>
    <polygon class="flecha-fill" points="106,54 118,54 112,40"/>
  </svg>`,
  // Remo (perfil, remo sentado en polea): tira del agarre hacia el torso.
  'tiron-horizontal': `<svg class="esquema" viewBox="0 0 140 120" role="img" aria-label="Esquema de remo horizontal">
    <line class="suelo" x1="16" y1="110" x2="124" y2="110"/>
    <circle class="art" cx="46" cy="44" r="6"/>
    <line class="fig" x1="46" y1="50" x2="48" y2="82"/>
    <line class="fig" x1="48" y1="82" x2="74" y2="86"/>
    <line class="fig" x1="74" y1="86" x2="92" y2="100"/>
    <line class="fig" x1="47" y1="56" x2="66" y2="62"/>
    <line class="fig" x1="66" y1="62" x2="86" y2="64"/>
    <circle class="relleno" cx="88" cy="64" r="4"/>
    <line class="equipo" x1="88" y1="64" x2="120" y2="72"/>
    <line class="equipo" x1="120" y1="52" x2="120" y2="100"/>
    <line class="flecha" x1="98" y1="46" x2="70" y2="46"/>
    <polygon class="flecha-fill" points="78,40 78,52 64,46"/>
  </svg>`,
  // Dominada / jalon (tiron vertical): barra con soportes, brazos flexionados, subir.
  'tiron-vertical': `<svg class="esquema" viewBox="0 0 140 120" role="img" aria-label="Esquema de dominada">
    <line class="barra" x1="34" y1="20" x2="106" y2="20"/>
    <line class="equipo" x1="38" y1="20" x2="38" y2="10"/>
    <line class="equipo" x1="102" y1="20" x2="102" y2="10"/>
    <line class="fig" x1="58" y1="22" x2="52" y2="40"/>
    <line class="fig" x1="52" y1="40" x2="62" y2="48"/>
    <line class="fig" x1="82" y1="22" x2="88" y2="40"/>
    <line class="fig" x1="88" y1="40" x2="78" y2="48"/>
    <circle class="art" cx="70" cy="54" r="6"/>
    <line class="fig" x1="70" y1="60" x2="70" y2="86"/>
    <line class="fig" x1="70" y1="86" x2="78" y2="102"/>
    <line class="fig" x1="70" y1="86" x2="62" y2="102"/>
    <line class="flecha" x1="118" y1="92" x2="118" y2="54"/>
    <polygon class="flecha-fill" points="112,62 124,62 118,48"/>
  </svg>`,
  // Abduccion de cadera (frontal, de pie con goma): la pierna se abre hacia fuera.
  abduccion: `<svg class="esquema" viewBox="0 0 140 120" role="img" aria-label="Esquema de abduccion de cadera">
    <line class="suelo" x1="16" y1="110" x2="124" y2="110"/>
    <circle class="art" cx="58" cy="26" r="6"/>
    <line class="fig" x1="58" y1="32" x2="58" y2="64"/>
    <line class="fig" x1="58" y1="42" x2="48" y2="52"/>
    <line class="fig" x1="58" y1="64" x2="56" y2="106"/>
    <line class="fig" x1="50" y1="106" x2="62" y2="106"/>
    <line class="fig" x1="58" y1="64" x2="92" y2="88"/>
    <line class="fig" x1="86" y1="90" x2="98" y2="85"/>
    <path class="ghost" d="M56,104 Q76,104 90,90"/>
    <line class="flecha" x1="72" y1="78" x2="98" y2="70"/>
    <polygon class="flecha-fill" points="92,63 106,68 92,77"/>
  </svg>`,
  // Core anti-extension (rueda abdominal de rodillas): cuerpo extendido hacia la rueda.
  core: `<svg class="esquema" viewBox="0 0 140 120" role="img" aria-label="Esquema de core con rueda abdominal">
    <line class="suelo" x1="10" y1="110" x2="130" y2="110"/>
    <line class="fig" x1="44" y1="88" x2="46" y2="108"/>
    <line class="fig" x1="44" y1="88" x2="66" y2="78"/>
    <circle class="art" cx="72" cy="76" r="6"/>
    <line class="fig" x1="70" y1="80" x2="92" y2="98"/>
    <circle class="equipo" cx="99" cy="100" r="9"/>
    <circle class="relleno" cx="99" cy="100" r="2.5"/>
    <line class="equipo" x1="88" y1="100" x2="110" y2="100"/>
    <line class="flecha" x1="70" y1="64" x2="98" y2="70"/>
    <polygon class="flecha-fill" points="90,58 104,68 88,72"/>
  </svg>`,
  // Movilidad (gato-camello en cuadrupedia): columna arqueada + fantasma hundida.
  movilidad: `<svg class="esquema" viewBox="0 0 140 120" role="img" aria-label="Esquema de movilidad gato-camello">
    <line class="suelo" x1="10" y1="110" x2="130" y2="110"/>
    <line class="fig" x1="44" y1="108" x2="48" y2="76"/>
    <line class="fig" x1="96" y1="108" x2="90" y2="76"/>
    <path class="fig" d="M48,76 Q69,50 90,76"/>
    <path class="ghost" d="M48,80 Q69,98 90,80"/>
    <line class="fig" x1="48" y1="76" x2="42" y2="70"/>
    <circle class="art" cx="39" cy="68" r="5"/>
    <line class="flecha" x1="69" y1="42" x2="69" y2="28"/>
    <polygon class="flecha-fill" points="63,36 75,36 69,24"/>
  </svg>`,
  // Fallback: barra con discos.
  generico: `<svg class="esquema" viewBox="0 0 140 120" role="img" aria-label="Esquema de ejercicio">
    <line class="suelo" x1="20" y1="98" x2="120" y2="98"/>
    <line class="barra" x1="30" y1="60" x2="110" y2="60"/>
    <line class="disco" x1="34" y1="42" x2="34" y2="78"/>
    <line class="disco" x1="42" y1="47" x2="42" y2="73"/>
    <line class="disco" x1="106" y1="42" x2="106" y2="78"/>
    <line class="disco" x1="98" y1="47" x2="98" y2="73"/>
  </svg>`,
};

export function esquemaSVG(patron) {
  return ESQUEMAS[patron] || ESQUEMAS.generico;
}

// ---- Fichas de ejercicio (keyed por Ejercicio.id del bloque) ----
export const FICHAS = {
  sentadilla: {
    nombre: 'Sentadilla', patron: 'sentadilla',
    claves: ['Basico del dia: va primero.', 'Cadera atras y abajo, pecho arriba.', 'Profundidad comoda (~paralelo); no fuerces el ROM con destreno.', 'La rodilla sigue la linea del pie.'],
    evita: ['Valgo: que la rodilla se meta hacia dentro.', 'Buscar la maxima profundidad esta semana.'],
  },
  'peso-muerto-rumano': {
    nombre: 'Peso muerto rumano', patron: 'bisagra',
    claves: ['Ancla de la version minima: no se recorta.', 'Bisagra de cadera: culo atras, no es una sentadilla.', 'Espalda neutra; barra pegada a la pierna.', 'Carga moderada, no es un peso muerto pesado.'],
    evita: ['Redondear la lumbar.', 'Adelantar las rodillas y convertirlo en sentadilla.'],
  },
  'remo-mancuerna': {
    nombre: 'Remo con mancuerna a una mano', patron: 'tiron-horizontal',
    claves: ['Tira del codo hacia la cadera, no del brazo.', 'Espalda apoyada y neutra.', 'Volumen de espalda alta: cuida el hombro.'],
    evita: ['Rotar el tronco para levantar mas peso.'],
  },
  'abduccion-cadera': {
    nombre: 'Abduccion de cadera con carga', patron: 'abduccion',
    claves: ['Gluteo medio cargado y progresable (no goma de 15 min).', 'Control de valgo y cara externa de rodilla.', 'Puede intercalarse entre series de sentadilla.'],
    evita: ['Compensar con el tronco en vez de la cadera.'],
  },
  'rueda-abdominal': {
    nombre: 'Rueda abdominal', patron: 'core',
    claves: ['Core anti-extension: protege la lumbar bajo carga.', 'Manten la cadera y la lumbar en linea, sin arquear.', 'Progresa en rango (mas estirado) antes que en reps.'],
    evita: ['Dejar caer la lumbar en la fase estirada.'],
  },
  'press-banca': {
    nombre: 'Press banca', patron: 'empuje',
    claves: ['Basico del dia: va primero.', 'Agarre no muy ancho y ROM comodo al inicio (hombro).', 'Baja controlado, sin rebote.'],
    evita: ['Arco extremo y agarre muy abierto al principio.'],
  },
  'press-inclinado-mancuerna': {
    nombre: 'Press inclinado con mancuernas', patron: 'empuje',
    claves: ['Ancla de la version minima.', 'La mancuerna deja elegir un ROM amable con el hombro.', 'Pecho alto y deltoide anterior.'],
    evita: ['Bajar mas alla de un rango comodo de hombro.'],
  },
  'jalon-dominada': {
    nombre: 'Jalon al pecho o dominada asistida', patron: 'tiron-vertical',
    claves: ['Tiron vertical: dorsal y espalda alta.', 'Equilibra el empuje del dia, cuida el hombro.', 'Lleva los codos abajo y atras.'],
    evita: ['Balancearte para completar la repeticion.'],
  },
  'face-pull': {
    nombre: 'Face pull / deltoide posterior', patron: 'tiron-horizontal',
    claves: ['Deltoide posterior y rotadores externos.', 'Progresable en carga; correctivo de hombro.', 'Puede intercalarse entre series de banca.'],
    evita: ['Usar demasiado peso y perder el rango.'],
  },
  'peso-muerto': {
    nombre: 'Peso muerto convencional', patron: 'bisagra',
    claves: ['Basico del dia: va primero. Empieza MUY conservador.', 'Reps bajas para calidad tecnica con poca fatiga lumbar.', 'Espalda neutra; barra pegada al cuerpo.', 'Si la lumbar viene cargada, baja carga o rango antes que saltarlo.'],
    evita: ['Redondear la lumbar buscando kilos.', 'Encadenar volumen lumbar alto de los dias A y C.'],
  },
  bulgara: {
    nombre: 'Sentadilla bulgara (zancada dividida)', patron: 'sentadilla',
    claves: ['Ancla de la version minima.', 'Cuadriceps y gluteo unilateral, amable con la lumbar.', 'Clave para control de rodilla y cadera.', 'Cuenta las reps por pierna.'],
    evita: ['Dejar caer la rodilla hacia dentro.'],
  },
  hiperextension: {
    nombre: 'Hiperextension / extension lumbar con carga', patron: 'bisagra',
    claves: ['Extensores de la espalda cargados y progresables.', 'Base de la evidencia sobre dolor lumbar.', 'Rango comodo, control en todo el recorrido.'],
    evita: ['Hiperextender de golpe al final.'],
  },
  'remo-alto-dominada': {
    nombre: 'Dominada o jalon agarre neutro', patron: 'tiron-vertical',
    claves: ['Mas volumen de espalda alta/dorsal para el hombro.', 'Agarre neutro, comodo para el hombro.'],
    evita: ['Rango parcial por usar demasiada asistencia o lastre.'],
  },
  'dominadas-casa': {
    nombre: 'Dominadas (negativas o completas)', patron: 'tiron-vertical',
    claves: ['Extra de casa: no cuenta como fallo si se salta.', 'Progresa en reps/tempo, o negativas si aun no salen.', 'Espalda alta para el hombro.'],
    evita: ['Bajar de golpe sin controlar la negativa.'],
  },
  'remo-goma-casa': {
    nombre: 'Remo / face pull con goma', patron: 'tiron-horizontal',
    claves: ['Tension de goma progresable (goma mas dura = mas carga).', 'Deltoide posterior y rotadores.'],
    evita: ['Perder tension al volver.'],
  },
  'abduccion-goma-casa': {
    nombre: 'Abduccion de cadera con goma', patron: 'abduccion',
    claves: ['Gluteo medio con tension de goma para control de rodilla.', 'Progresa con goma mas dura o mas rango.'],
    evita: ['Compensar con el tronco.'],
  },
  'rueda-casa': {
    nombre: 'Rueda abdominal (casa)', patron: 'core',
    claves: ['Core anti-extension para proteger la lumbar.', 'Progresa en rango antes que en reps.'],
    evita: ['Arquear la lumbar en la fase estirada.'],
  },
};

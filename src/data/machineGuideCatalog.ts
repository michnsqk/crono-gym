export interface MachineGuideEntry {
  name: string;
  group: "Pierna / Glúteo" | "Espalda / Torso" | "Pecho / Hombro" | "Brazos" | "General / Core";
  muscles: string[];
  exercises: string[];
  tip: string;
}

export const MACHINE_GUIDE_CATALOG: readonly MachineGuideEntry[] = [
  // --- Pierna / Glúteo ---
  {
    name: "Extensión de cuádriceps",
    group: "Pierna / Glúteo",
    muscles: ["Cuádriceps (recto femoral, vasto medial y lateral)"],
    exercises: ["Extensión bilateral", "Extensión unilateral (40s/lado)", "Drop-set al fallo"],
    tip: "Alinea el eje de la máquina con tu rodilla y controla la bajada 2–3 s.",
  },
  {
    name: "Curl femoral acostado",
    group: "Pierna / Glúteo",
    muscles: ["Isquiotibiales", "Gemelos (asistencia)"],
    exercises: ["Curl femoral acostado bilateral", "Curl femoral unilateral"],
    tip: "Mantén la cadera pegada al banco sin despegar los glúteos al subir.",
  },
  {
    name: "Press de pierna",
    group: "Pierna / Glúteo",
    muscles: ["Cuádriceps", "Glúteo mayor", "Isquiotibiales"],
    exercises: ["Prensa 45° pies medios", "Pies altos/anchos (glúteo)", "Prensa a una pierna"],
    tip: "No despegues el sacro del respaldo al bajar; no bloquees las rodillas arriba.",
  },
  {
    name: "Máquina de abducción y aducción",
    group: "Pierna / Glúteo",
    muscles: ["Glúteo medio/menor (abducción)", "Aductores (aducción)"],
    exercises: ["Abducción sentado recto o inclinado", "Aducción de cadera"],
    tip: "Haz una pausa de 1 s en apertura máxima en abducción para mayor estímulo en glúteo medio.",
  },
  {
    name: "Sentadilla Hack",
    group: "Pierna / Glúteo",
    muscles: ["Cuádriceps", "Glúteo mayor"],
    exercises: ["Hack squat profundo (pies bajos)", "Hack con pies altos"],
    tip: "Pega la espalda y lumbar al respaldo durante todo el recorrido.",
  },
  {
    name: "Patada para glúteo",
    group: "Pierna / Glúteo",
    muscles: ["Glúteo mayor", "Isquiotibiales"],
    exercises: ["Patada trasera en máquina (unilateral 40s/lado)"],
    tip: "Extiende la cadera hacia atrás sin arquear la zona lumbar.",
  },
  {
    name: "Sentadilla perfecta",
    group: "Pierna / Glúteo",
    muscles: ["Cuádriceps", "Glúteo mayor", "Erectores espinales"],
    exercises: ["Sentadilla guiada estándar", "Postura cerrada o sumo"],
    tip: "Mantén las rodillas siguiendo la línea de las puntas de los pies.",
  },
  {
    name: "Press para pierna vertical",
    group: "Pierna / Glúteo",
    muscles: ["Glúteo mayor", "Isquiotibiales", "Cuádriceps"],
    exercises: ["Prensa vertical bilateral", "Prensa vertical unilateral"],
    tip: "Baja profundo controlando la cadera sin redondear la espalda baja.",
  },
  {
    name: "Sentadilla Smith",
    group: "Pierna / Glúteo",
    muscles: ["Cuádriceps", "Glúteos", "Isquiotibiales", "Pecho / Hombro (con banco)"],
    exercises: ["Sentadilla en Smith", "Búlgara en Smith", "Hip thrust en Smith", "Press inclinado en Smith"],
    tip: "Adelanta ligeramente los pies en sentadilla para mantener el torso vertical.",
  },
  {
    name: "Rack para sentadilla",
    group: "Pierna / Glúteo",
    muscles: ["Cuádriceps", "Glúteos", "Isquiotibiales", "Core"],
    exercises: ["Sentadilla libre con barra", "Peso muerto rumano", "Zancadas con barra", "Press militar de pie"],
    tip: "Ajusta los topes de seguridad a la altura justa debajo de tu punto más bajo.",
  },
  {
    name: "Máquina hip thrust",
    group: "Pierna / Glúteo",
    muscles: ["Glúteo mayor", "Isquiotibiales"],
    exercises: ["Hip thrust bilateral", "Hip thrust a una pierna", "Puente con pausa arriba"],
    tip: "Mira al frente (barbilla recogida) y alinea espinillas verticales arriba.",
  },
  {
    name: "Sentadilla Sissi",
    group: "Pierna / Glúteo",
    muscles: ["Cuádriceps (énfasis recto femoral)"],
    exercises: ["Sissi squat corporal", "Sissi squat con disco al pecho"],
    tip: "Asegura los tobillos y baja proyectando rodillas adelante con cadera extendida.",
  },
  {
    name: "Banca para pantorrilla sentado",
    group: "Pierna / Glúteo",
    muscles: ["Sóleo", "Gastrocnemio (gemelos)"],
    exercises: ["Elevación de talones sentado (puntas rectas, adentro o afuera)"],
    tip: "Pausa 2 s abajo en estiramiento máximo para evitar rebotar con el tendón de Aquiles.",
  },

  // --- Espalda / Torso ---
  {
    name: "Remo sentado para espalda",
    group: "Espalda / Torso",
    muscles: ["Espalda media (romboides, trapecio medio)", "Dorsales", "Bíceps"],
    exercises: ["Remo en máquina agarre neutro (bilateral o unilateral)", "Remo agarre prono ancho"],
    tip: "Apoya el pecho en el pad y lleva los codos atrás sin encoger los hombros.",
  },
  {
    name: "Remo sentado en polea baja",
    group: "Espalda / Torso",
    muscles: ["Dorsales", "Romboides", "Trapecio medio", "Bíceps"],
    exercises: ["Remo Gironda con triángulo", "Remo con barra ancha", "Remo unilateral con maneral D"],
    tip: "Mantén el torso firme con ligera inclinación adelante en el estiramiento.",
  },
  {
    name: "Polea alta",
    group: "Espalda / Torso",
    muscles: ["Dorsales", "Redondo mayor", "Bíceps / Tríceps (según maneral)"],
    exercises: ["Jalón al pecho", "Jalón supino", "Jalón unilateral", "Extensión de tríceps en polea alta"],
    tip: "Inicia el jalón deprimiendo escápulas antes de flexionar los codos.",
  },
  {
    name: "Polea alta para dorsales",
    group: "Espalda / Torso",
    muscles: ["Dorsal ancho", "Redondo mayor", "Deltoide posterior"],
    exercises: ["Jalón barra recta/curva", "Jalón agarre neutro cerrado", "Pullover en polea"],
    tip: "Dirige los codos hacia las caderas, no hacia atrás, para aislar el dorsal.",
  },
  {
    name: "Máquina para asistencia en tríceps y espalda",
    group: "Espalda / Torso",
    muscles: ["Dorsales y bíceps (dominadas)", "Pecho bajo y tríceps (fondos)"],
    exercises: ["Dominadas asistidas (prono/neutro/supino)", "Fondos asistidos"],
    tip: "Menos contrapeso = más carga real. Controla el descenso completo.",
  },
  {
    name: "Banca de hiperextensiones",
    group: "Espalda / Torso",
    muscles: ["Erectores espinales (lumbares)", "Glúteos", "Isquiotibiales"],
    exercises: ["Hiperextensión lumbar (espalda neutra)", "Extensión para glúteo (espalda alta redondeada)"],
    tip: "Coloca el apoyo justo debajo de los huesos de la cadera para permitir bisagra libre.",
  },

  // --- Pecho / Hombro ---
  {
    name: "Máquina flyes",
    group: "Pecho / Hombro",
    muscles: ["Pectoral mayor (esternal)", "Deltoide anterior / posterior (en reversa)"],
    exercises: ["Peck deck / aperturas para pecho", "Aperturas inversas para deltoide posterior"],
    tip: "Ajusta el asiento para que los puños queden a la altura de la línea media del pecho.",
  },
  {
    name: "Máquina press para pecho",
    group: "Pecho / Hombro",
    muscles: ["Pectoral mayor", "Deltoide anterior", "Tríceps"],
    exercises: ["Press de pecho sentado (bilateral o unilateral)"],
    tip: "Retrae escápulas contra el respaldo y empuja sin adelantar los hombros.",
  },
  {
    name: "Banco declinado para pecho",
    group: "Pecho / Hombro",
    muscles: ["Pectoral inferior (costal)", "Tríceps", "Abdomen"],
    exercises: ["Press declinado con barra/mancuernas", "Crunch declinado"],
    tip: "Asegura bien los empeines en los rodillos antes de tomar las mancuernas o barra.",
  },
  {
    name: "Máquina press para hombro",
    group: "Pecho / Hombro",
    muscles: ["Deltoide anterior y lateral", "Tríceps"],
    exercises: ["Press militar en máquina (agarre prono o neutro)"],
    tip: "Ajusta el asiento para que los manerales inicien a la altura de tus orejas/hombros.",
  },
  {
    name: "Banca horizontal para pecho",
    group: "Pecho / Hombro",
    muscles: ["Pectoral medio", "Deltoide anterior", "Tríceps", "Dorsales (remo con mancuerna)"],
    exercises: ["Press de banca plano", "Aperturas planas", "Remo a un brazo apoyado en banco"],
    tip: "Mantén los 5 puntos de apoyo: cabeza, escápulas, glúteos y ambos pies firmes.",
  },
  {
    name: "Banco inclinado para pecho",
    group: "Pecho / Hombro",
    muscles: ["Pectoral superior (clavicular)", "Deltoide anterior", "Bíceps (curl inclinado)"],
    exercises: ["Press inclinado con mancuernas/barra", "Aperturas inclinadas", "Curl inclinado"],
    tip: "Una inclinación de 30° maximiza el pectoral superior sin sobrecargar el hombro.",
  },

  // --- Brazos ---
  {
    name: "Banco Scott",
    group: "Brazos",
    muscles: ["Bíceps braquial (cabeza corta)", "Braquial anterior"],
    exercises: ["Curl predicador con barra Z", "Curl predicador unilateral con mancuerna"],
    tip: "Apoya las axilas arriba del pad y evita hiperextender el codo abajo.",
  },
  {
    name: "Máquina para bíceps y tríceps",
    group: "Brazos",
    muscles: ["Bíceps braquial", "Tríceps braquial"],
    exercises: ["Curl de bíceps en máquina", "Extensión / press de tríceps en máquina"],
    tip: "Alinea los codos exactamente con el eje de rotación de la máquina.",
  },
  {
    name: "Máquina curl Scott",
    group: "Brazos",
    muscles: ["Bíceps braquial", "Braquiorradial"],
    exercises: ["Curl predicador guiado bilateral", "Curl predicador unilateral"],
    tip: "Mantén las muñecas neutras y sube sin despegar los tríceps del pad.",
  },

  // --- General / Core ---
  {
    name: "Poleas de posiciones en estación",
    group: "General / Core",
    muscles: ["Cuerpo completo (pecho, hombro, espalda, brazo, glúteo, core)"],
    exercises: [
      "Cruce de poleas (alto/medio/bajo)",
      "Face pull",
      "Elevaciones laterales en polea",
      "Curl bayesian",
      "Patada en polea con tobillera",
      "Press Pallof",
    ],
    tip: "Ajusta la altura de la polea al ángulo natural de la fibra muscular que trabajas.",
  },
  {
    name: "Máquina para abdomen",
    group: "General / Core",
    muscles: ["Recto abdominal", "Flexores de cadera"],
    exercises: ["Crunch abdominal sentado con carga progresiva"],
    tip: "Flexiona la columna llevando costillas hacia pelvis; no jales con los brazos.",
  },
  {
    name: "Bancas para abdominales",
    group: "General / Core",
    muscles: ["Recto abdominal", "Oblicuos"],
    exercises: ["Crunch inclinado", "Elevación de piernas en banco", "Giros rusos"],
    tip: "Exhala al contraer arriba y controla la bajada sin golpear la lumbar.",
  },
  {
    name: "Banca multifuncional",
    group: "General / Core",
    muscles: ["Pecho", "Hombro", "Bíceps", "Tríceps", "Espalda", "Pierna"],
    exercises: ["Press en distintos ángulos (0°–85°)", "Elevaciones laterales sentado", "Sentadilla búlgara"],
    tip: "Verifica que el pin de inclinación esté completamente encajado antes de cargar peso.",
  },
];

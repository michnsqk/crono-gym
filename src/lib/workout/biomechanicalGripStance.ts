import type { Slug } from "react-muscle-highlighter";

export type BiomechanicsAtlasTab = "foot_stance" | "attachments" | "upper_angle";

export type GripOrientation =
  | "Neutro (Semipronado)"
  | "Prono (Palmas abajo)"
  | "Supino (Palmas arriba)"
  | "Rotación Libre / Neutro-Prono"
  | "Semisupinado (Ángulo anatómico)"
  | "Tobillera / Tracción Distal";

export interface CronosAttachmentEntry {
  equipmentId: string;
  name: string;
  shortName: string;
  imageUrl: string;
  gripOrientation: GripOrientation;
  family: "pull_back" | "arms_isolation" | "legs_glutes";
  biomechanicalFocus: string;
  whyUseIt: string;
  primaryMuscles: readonly string[];
  secondaryMuscles: readonly string[];
  muscleSlugs: readonly Slug[];
  recommendedSide: "front" | "back";
  recommendedExercises: readonly string[];
  chipSummary: string;
}

export type FootStanceId =
  | "low_narrow"
  | "standard_mid"
  | "high_neutral"
  | "high_wide_sumo"
  | "bottom_edge_calves";

export interface FootStanceZone {
  id: FootStanceId;
  label: string;
  shortLabel: string;
  subtitle: string;
  kneeFlexionDeg: string;
  hipFlexionDeg: string;
  stanceWidthCm: string;
  toeOutAngleDeg: string;
  biomechanicalFocus: string;
  primaryMuscles: readonly string[];
  secondaryMuscles: readonly string[];
  muscleSlugs: readonly Slug[];
  recommendedSide: "front" | "back";
  cues: readonly string[];
  compatibleMachines: readonly string[];
  /** Normalized coordinates (0..100) for rendering the interactive SVG footplate */
  svgFootprint: {
    leftX: number;
    rightX: number;
    y: number;
    toeRotationDeg: number;
  };
  chipSummary: string;
}

export type UpperBodyTrajectoryId =
  | "bench_decline_15"
  | "bench_flat_0"
  | "bench_incline_30"
  | "bench_incline_45"
  | "bench_shoulder_75"
  | "elbows_tucked_lats"
  | "elbows_flared_upper_back"
  | "shoulder_hyperext_bayesian"
  | "shoulder_flexed_preacher";

export interface UpperBodyGripAngleEntry {
  id: UpperBodyTrajectoryId;
  category: "bench_angle" | "pull_elbow_path" | "arm_shoulder_angle";
  label: string;
  angleBadge: string;
  subtitle: string;
  biomechanicalFocus: string;
  jointProtectionNote: string;
  primaryMuscles: readonly string[];
  secondaryMuscles: readonly string[];
  muscleSlugs: readonly Slug[];
  recommendedSide: "front" | "back";
  cues: readonly string[];
  chipSummary: string;
}

export const CRONOS_ATTACHMENTS_GUIDE: readonly CronosAttachmentEntry[] = [
  {
    equipmentId: "CG-EQP-0038",
    name: "Maneral Cuerda (Tríceps / Face Pull / Martillo)",
    shortName: "Maneral Cuerda",
    imageUrl: "/images/gym-equipment/CG-EQP-0038_maneral-cuerda_vista-01.jpg",
    gripOrientation: "Rotación Libre / Neutro-Prono",
    family: "arms_isolation",
    biomechanicalFocus:
      "Permite abrir las muñecas al final del recorrido (pronación terminal o rotación externa), logrando acortamiento máximo.",
    whyUseIt:
      "En extensión de tríceps enfatiza la cabeza lateral y medial sin bloquear los codos; en Face Pull activa deltoides posterior y manguito rotador; en curl neutro enfoca braquial y braquiorradial.",
    primaryMuscles: ["Tríceps (Cabeza Lateral)", "Deltoides Posterior", "Braquiorradial"],
    secondaryMuscles: ["Cabeza Larga del Tríceps", "Infraespinoso / Redondo Menor"],
    muscleSlugs: ["triceps", "deltoids", "forearm"],
    recommendedSide: "back",
    recommendedExercises: [
      "Extensión de tríceps en polea alta con cuerda",
      "Extensión de tríceps sobre la cabeza en polea (Katana)",
      "Face Pull en polea alta con cuerda",
      "Curl martillo en polea baja con cuerda",
      "Crunch abdominal arrodillado en polea alta",
    ],
    chipSummary: "Maneral: Cuerda · Rotación terminal",
  },
  {
    equipmentId: "CG-EQP-0037",
    name: "Maneral Barra Recta Corta Giratoria",
    shortName: "Barra Recta Corta",
    imageUrl: "/images/gym-equipment/CG-EQP-0037_maneral-barra-recta_vista-01.jpg",
    gripOrientation: "Prono (Palmas abajo)",
    family: "arms_isolation",
    biomechanicalFocus:
      "Fija las muñecas en supinación o pronación completa para máxima transmisión de fuerza bilateral.",
    whyUseIt:
      "En agarre prono bloquea la muñeca para empujar con la cabeza lateral del tríceps; en agarre supino produce supinación máxima sobre ambas cabezas del bíceps braquial.",
    primaryMuscles: ["Bíceps Braquial", "Tríceps (Cabeza Lateral y Medial)"],
    secondaryMuscles: ["Flexores/Extensores de Antebrazo", "Dorsal Ancho (Pullover)"],
    muscleSlugs: ["biceps", "triceps", "forearm"],
    recommendedSide: "front",
    recommendedExercises: [
      "Pushdown de tríceps con barra recta en polea",
      "Curl de bíceps en polea baja con barra recta",
      "Pullover en polea alta con brazos rectos",
      "Predicador en polea baja a dos manos",
    ],
    chipSummary: "Maneral: Barra Recta · Prono/Supino fijo",
  },
  {
    equipmentId: "CG-EQP-0039",
    name: "Maneral Barra Z (EZ) para Polea",
    shortName: "Maneral Barra Z",
    imageUrl: "/images/gym-equipment/CG-EQP-0039_maneral-barra-z_vista-01.jpg",
    gripOrientation: "Semisupinado (Ángulo anatómico)",
    family: "arms_isolation",
    biomechanicalFocus:
      "Su ángulo ergonómico de ~25 grados descarga la articulación radiocubital y el tendón cubital sin perder tensión constante.",
    whyUseIt:
      "Ideal para curl predicador en polea, curl de bíceps pesado y press francés en polea cuando la barra recta genera molestia en muñecas o epitróclea.",
    primaryMuscles: ["Bíceps (Cabeza Corta y Larga)", "Braquial Anterior", "Tríceps"],
    secondaryMuscles: ["Antebrazo"],
    muscleSlugs: ["biceps", "triceps", "forearm"],
    recommendedSide: "front",
    recommendedExercises: [
      "Predicador en polea baja a dos manos con barra Z",
      "Curl de bíceps en polea con barra Z",
      "Extensión de tríceps pesada con barra Z",
    ],
    chipSummary: "Maneral: Barra Z · Semisupinado ergonómico",
  },
  {
    equipmentId: "CG-EQP-0040",
    name: "Maneral Estribo Individual (D-Handle Unilateral)",
    shortName: "Estribo Unilateral",
    imageUrl: "/images/gym-equipment/CG-EQP-0040_maneral-estribo_vista-01.jpg",
    gripOrientation: "Rotación Libre / Neutro-Prono",
    family: "arms_isolation",
    biomechanicalFocus:
      "Alineación libre de hombro, codo y muñeca en el plano escapular exacto, eliminando asimetrías entre hemicuerpos.",
    whyUseIt:
      "Indispensable para Curl Bayesian (hombro en extensión), Predicador unilateral en polea, elevaciones laterales en polea, cruces de pecho y jalón/remo unilateral iliaco.",
    primaryMuscles: ["Cabeza Larga del Bíceps", "Deltoides Lateral", "Dorsal Iliaco", "Pectoral"],
    secondaryMuscles: ["Tríceps Unilateral", "Oblicuos (Press Pallof)"],
    muscleSlugs: ["biceps", "deltoids", "upper-back", "chest"],
    recommendedSide: "front",
    recommendedExercises: [
      "Curl Bayesian en polea baja unilateral",
      "Predicador unilateral en polea baja",
      "Elevaciones laterales en polea baja unilateral",
      "Jalón unilateral en polea alta (enfoque dorsal iliaco)",
    ],
    chipSummary: "Maneral: Estribo D · Plano escapular libre",
  },
  {
    equipmentId: "CG-EQP-0041",
    name: "Barra Larga de Jalón al Pecho (Lat Bar Clásica)",
    shortName: "Barra Larga Jalón",
    imageUrl: "/images/gym-equipment/CG-EQP-0041_maneral-barra-larga-jalon_vista-01.jpg",
    gripOrientation: "Prono (Palmas abajo)",
    family: "pull_back",
    biomechanicalFocus:
      "Favorece la aducción frontal del húmero con abducción moderada (1.5x ancho biacromial), reclutando fibras superiores del dorsal y redondo mayor.",
    whyUseIt:
      "El clásico para amplitud dorsal (V-Taper). Evita abrir más allá de los extremos curvos para no perder rango de elongación ni forzar el manguito rotador.",
    primaryMuscles: ["Dorsal Ancho (Fibras Superiores)", "Redondo Mayor"],
    secondaryMuscles: ["Trapecio Medio/Inferior", "Romboides", "Bíceps"],
    muscleSlugs: ["upper-back", "trapezius", "biceps"],
    recommendedSide: "back",
    recommendedExercises: [
      "Jalón al pecho agarre ancho prono",
      "Jalón al pecho agarre supino medio",
    ],
    chipSummary: "Maneral: Barra Larga · Aducción frontal (V-Taper)",
  },
  {
    equipmentId: "CG-EQP-0043",
    name: "Barra Larga con Agarraderas Neutras (Tipo MAG / Paralelo Ancho)",
    shortName: "Barra Anatómica Neutro Ancho",
    imageUrl: "/images/gym-equipment/CG-EQP-0043_maneral-barra-larga-agarraderas_vista-01.jpg",
    gripOrientation: "Neutro (Semipronado)",
    family: "pull_back",
    biomechanicalFocus:
      "Combina anchura media-amplia con muñecas neutras: alinea el braquiorradial (el flexor de codo más potente) y permite llevar los codos más atrás.",
    whyUseIt:
      "Maximiza la retracción escapular y el reclutamiento de espalda media (romboides, trapecio medio y dorsal) con menor fatiga prematura de antebrazo.",
    primaryMuscles: ["Espalda Media (Romboides y Trapecio)", "Dorsal Ancho"],
    secondaryMuscles: ["Deltoides Posterior", "Braquiorradial"],
    muscleSlugs: ["upper-back", "trapezius", "deltoids"],
    recommendedSide: "back",
    recommendedExercises: [
      "Jalón al pecho con barra anatómica neutra",
      "Remo sentado ancho hacia el esternón (Upper Back Row)",
    ],
    chipSummary: "Maneral: Anatómico Neutro · Densidad escapular",
  },
  {
    equipmentId: "CG-EQP-0044",
    name: "Maneral Triángulo / Doble D de Agarre Cerrado",
    shortName: "Triángulo Doble D",
    imageUrl: "/images/gym-equipment/CG-EQP-0044_maneral-agarre-cerrado_vista-01.jpg",
    gripOrientation: "Neutro (Semipronado)",
    family: "pull_back",
    biomechanicalFocus:
      "Guía el húmero en extensión sagital pura con los codos pegados al torso, maximizando el estiramiento y acortamiento de las fibras inferiores (iliacas) del dorsal.",
    whyUseIt:
      "Úsalo en remo Gironda o jalón cerrado llevando las manos hacia la cadera/ombligo y evitando encoger los hombros.",
    primaryMuscles: ["Dorsal Ancho (Fibras Inferiores / Iliacas)"],
    secondaryMuscles: ["Erectores Espinales", "Romboides", "Braquial"],
    muscleSlugs: ["upper-back", "lower-back", "biceps"],
    recommendedSide: "back",
    recommendedExercises: [
      "Remo sentado en polea baja con triángulo (Gironda)",
      "Jalón al pecho en polea alta con agarre neutro cerrado",
      "Remo en Barra T con maneral cerrado",
    ],
    chipSummary: "Maneral: Triángulo V · Extensión sagital dorsal bajo",
  },
  {
    equipmentId: "CG-EQP-0042",
    name: "Maneral V para Tríceps (Pressdown en V)",
    shortName: "Maneral V Tríceps",
    imageUrl: "/images/gym-equipment/CG-EQP-0042_maneral-v_vista-01.jpg",
    gripOrientation: "Semisupinado (Ángulo anatómico)",
    family: "arms_isolation",
    biomechanicalFocus:
      "Permite inclinar ligeramente el torso y manejar cargas altas en extensión de codo con las muñecas en ángulo neutro-prono estable.",
    whyUseIt:
      "Excelente para sobrecarga mecánica pesada de las tres cabezas del tríceps sin la tensión articular de una barra recta.",
    primaryMuscles: ["Tríceps (Cabeza Lateral y Medial)", "Cabeza Larga del Tríceps"],
    secondaryMuscles: ["Ancóneo", "Estabilizadores Escapulares"],
    muscleSlugs: ["triceps", "forearm"],
    recommendedSide: "back",
    recommendedExercises: [
      "Extensión de tríceps pesada con maneral V",
      "Press cerrado de tríceps en polea alta",
    ],
    chipSummary: "Maneral: V Tríceps · Sobrecarga pesada de codo",
  },
  {
    equipmentId: "CG-EQP-0045",
    name: "Tobillera Acolchada para Polea Baja",
    shortName: "Tobillera de Polea",
    imageUrl: "/images/gym-equipment/CG-EQP-0045_tobillera-polea_vista-01.jpg",
    gripOrientation: "Tobillera / Tracción Distal",
    family: "legs_glutes",
    biomechanicalFocus:
      "Aplica el vector de resistencia directamente en el tobillo, aislando la extensión o abducción de cadera sin involucrar agarre manual.",
    whyUseIt:
      "Patea en diagonal (~30° hacia atrás y afuera) para alinear las fibras del glúteo medio y mayor, o extiende recto hacia atrás sin arquear la zona lumbar.",
    primaryMuscles: ["Glúteo Mayor", "Glúteo Medio (Abducción)"],
    secondaryMuscles: ["Isquiotibiales", "Flexores de Cadera (si se tracciona al frente)"],
    muscleSlugs: ["gluteal", "hamstring", "adductors"],
    recommendedSide: "back",
    recommendedExercises: [
      "Patada de glúteo en polea baja con tobillera",
      "Abducción de cadera de pie en polea baja (30° diagonal)",
      "Aducción de cadera en polea baja",
    ],
    chipSummary: "Accesorio: Tobillera · Extensión/Abducción de cadera",
  },
  {
    equipmentId: "CG-EQP-0053",
    name: "Barra Romana / Suiza (Agarre Neutro Paralelo)",
    shortName: "Barra Romana",
    imageUrl: "/images/gym-equipment/CG-EQP-0053_barra-romana_vista-01.jpg",
    gripOrientation: "Neutro (Semipronado)",
    family: "arms_isolation",
    biomechanicalFocus:
      "Mantiene los codos cerrados en el plano sagital con muñecas 100% neutras en curls, press francés y press cerrado.",
    whyUseIt:
      "En curl enfatiza braquial anterior y cabeza larga del bíceps; en rompecráneos o press cerrado protege hombros y muñecas al eliminar la rotación interna forzada.",
    primaryMuscles: ["Tríceps (3 Cabezas)", "Braquial Anterior", "Pectoral Esternal/Clavicular"],
    secondaryMuscles: ["Deltoides Anterior", "Braquiorradial"],
    muscleSlugs: ["triceps", "biceps", "chest", "forearm"],
    recommendedSide: "front",
    recommendedExercises: [
      "Press con barra romana (agarre neutro) para pecho y tríceps",
      "Curl martillo con barra romana",
      "Press francés (rompecráneos) con barra romana",
    ],
    chipSummary: "Barra: Romana · Agarre neutro sagital",
  },
  {
    equipmentId: "CG-EQP-0046",
    name: "Maneral V Metálico (Extensión Pesada de Tríceps)",
    shortName: "Maneral V Metálico",
    imageUrl: "/images/gym-equipment/CG-EQP-0046_maneral-v-metalico_vista-01.jpg",
    gripOrientation: "Neutro (Semipronado)",
    family: "arms_isolation",
    biomechanicalFocus:
      "Ángulo en V rígido que concentra la fuerza de extensión de codo sin la inestabilidad de la cuerda, ideal para cargas altas en tríceps.",
    whyUseIt:
      "Coloca las muñecas en un ángulo diagonal natural (45°) que reduce el estrés cubital respecto a la barra recta y permite empujar más peso en polea alta.",
    primaryMuscles: ["Tríceps (Cabeza Lateral y Medial)"],
    secondaryMuscles: ["Tríceps (Cabeza Larga)", "Ancóneo"],
    muscleSlugs: ["triceps", "forearm"],
    recommendedSide: "back",
    recommendedExercises: [
      "Extensión de tríceps en polea alta con maneral V",
      "Press cerrado de tríceps en polea alta",
    ],
    chipSummary: "Maneral: V Metálico · Tríceps pesado",
  },
  {
    equipmentId: "CG-EQP-0049",
    name: "Maneral Agarre Cerrado Metálico (Triángulo Paralelo)",
    shortName: "Triángulo Cerrado Metálico",
    imageUrl: "/images/gym-equipment/CG-EQP-0049_maneral-agarre-cerrado-metalico_vista-01.jpg",
    gripOrientation: "Neutro (Semipronado)",
    family: "pull_back",
    biomechanicalFocus:
      "Mantiene los codos pegados al torso durante la extensión sagital del hombro, maximizando el estiramiento y tracción del dorsal ancho inferior.",
    whyUseIt:
      "El agarre paralelo compacto alinea el bíceps y el braquiorradial en su línea de fuerza óptima, evitando que los antebrazos fallen antes que la espalda.",
    primaryMuscles: ["Dorsal Ancho (Fibras Inferiores)", "Redondo Mayor"],
    secondaryMuscles: ["Romboides", "Trapecio Medio", "Bíceps / Braquiorradial"],
    muscleSlugs: ["upper-back", "trapezius", "biceps"],
    recommendedSide: "back",
    recommendedExercises: [
      "Remo sentado en polea baja con triángulo cerrado",
      "Jalón al pecho en polea alta con triángulo cerrado",
    ],
    chipSummary: "Maneral: Triángulo Cerrado · Dorsal bajo",
  },
  {
    equipmentId: "CG-EQP-0047",
    name: "Arnés de Cuello con Cadena (Estabilidad Cervical)",
    shortName: "Arnés de Cuello",
    imageUrl: "/images/gym-equipment/CG-EQP-0047_arnes-cuello_vista-01.jpg",
    gripOrientation: "Rotación Libre / Neutro-Prono",
    family: "pull_back",
    biomechanicalFocus:
      "Aplica resistencia axial controlada directamente sobre los extensores cervicales y el trapecio superior en rango controlado.",
    whyUseIt:
      "Fortalece la musculatura profunda del cuello y el trapecio alto para proteger la columna cervical en deportes de contacto y levantamientos pesados.",
    primaryMuscles: ["Trapecio Superior", "Extensores Cervicales (Esplenio / Semiespinoso)"],
    secondaryMuscles: ["Elevador de la Escápula"],
    muscleSlugs: ["trapezius", "neck"],
    recommendedSide: "back",
    recommendedExercises: [
      "Extensión cervical sentado con arnés y disco",
      "Isométricos cervicales en polea con arnés",
    ],
    chipSummary: "Accesorio: Arnés de Cuello · Cervical/Trapecio",
  },
  {
    equipmentId: "CG-EQP-0048",
    name: "Cinturón de Lastre con Cadena (Fondos y Dominadas)",
    shortName: "Cinturón de Lastre",
    imageUrl: "/images/gym-equipment/CG-EQP-0048_cinturon-lastre-cadena_vista-01.jpg",
    gripOrientation: "Rotación Libre / Neutro-Prono",
    family: "pull_back",
    biomechanicalFocus:
      "Suspende discos directamente desde el centro de gravedad pélvico para aplicar sobrecarga progresiva en movimientos de peso corporal.",
    whyUseIt:
      "Descomprime la columna lumbar mientras añade carga vertical limpia en dominadas y fondos sin tener que sujetar una mancuerna con las rodillas.",
    primaryMuscles: ["Dorsal Ancho", "Pectoral Inferior", "Tríceps"],
    secondaryMuscles: ["Core / Estabilizadores Escapulares", "Bíceps"],
    muscleSlugs: ["upper-back", "chest", "triceps"],
    recommendedSide: "back",
    recommendedExercises: [
      "Dominadas pronas o neutras con cinturón de lastre",
      "Fondos en paralelas lastrados para pecho o tríceps",
    ],
    chipSummary: "Accesorio: Cinturón de Lastre · Calistenia pesada",
  },
  {
    equipmentId: "CG-EQP-0052",
    name: "Barra Z Estándar (Curl y Press Francés)",
    shortName: "Barra Z Estándar",
    imageUrl: "/images/gym-equipment/CG-EQP-0052_barra-z_vista-01.jpg",
    gripOrientation: "Semisupinado (Ángulo anatómico)",
    family: "arms_isolation",
    biomechanicalFocus:
      "La doble curvatura ergonómica coloca la articulación radiocubital a ~30° de la supinación total, descargando muñecas y epicóndilos.",
    whyUseIt:
      "Recluta de forma sinérgica el bíceps braquial y el braquial anterior en curls, y permite bajar detrás de la frente en press francés sin dolor de codo.",
    primaryMuscles: ["Bíceps Braquial", "Braquial Anterior", "Tríceps (Cabeza Larga)"],
    secondaryMuscles: ["Braquiorradial", "Flexores del Antebrazo"],
    muscleSlugs: ["biceps", "triceps", "forearm"],
    recommendedSide: "front",
    recommendedExercises: [
      "Curl de bíceps con barra Z de pie o en banco Scott",
      "Press francés (rompecráneos) con barra Z",
      "Curl spider en banco inclinado con barra Z",
    ],
    chipSummary: "Barra: Z Estándar · Semi-supino ergonómico",
  },
  {
    equipmentId: "CG-EQP-0059",
    name: "Barra Z Olímpica (Mangas Giratorias 50 mm)",
    shortName: "Barra Z Olímpica",
    imageUrl: "/images/gym-equipment/CG-EQP-0059_barra-z-olimpica_vista-01.jpg",
    gripOrientation: "Semisupinado (Ángulo anatómico)",
    family: "arms_isolation",
    biomechanicalFocus:
      "Combina los ángulos semi-supino y semi-prono de la barra Z con mangas olímpicas rotatorias que eliminan el torque inercial de los discos.",
    whyUseIt:
      "Ideal para sobrecarga pesada en brazos: los discos giran libremente sobre los rodamientos, evitando que la barra tuerza tus muñecas a mitad del recorrido.",
    primaryMuscles: ["Bíceps Braquial", "Tríceps (Cabeza Larga y Lateral)"],
    secondaryMuscles: ["Braquial Anterior", "Braquiorradial"],
    muscleSlugs: ["biceps", "triceps", "forearm"],
    recommendedSide: "front",
    recommendedExercises: [
      "Curl pesado con barra Z olímpica",
      "Press francés acostado con barra Z olímpica",
      "Remo al mentón agarre ancho en barra Z",
    ],
    chipSummary: "Barra: Z Olímpica · Carga pesada sin torque",
  },
  {
    equipmentId: "CG-EQP-0054",
    name: "Barra Hexagonal / Trap Bar (Peso Muerto y Granjero)",
    shortName: "Barra Hexagonal",
    imageUrl: "/images/gym-equipment/CG-EQP-0054_barra-hexagonal_vista-01.jpg",
    gripOrientation: "Neutro (Semipronado)",
    family: "legs_glutes",
    biomechanicalFocus:
      "Permite al atleta colocarse dentro del centro de masa de la carga con agarre neutro bilateral, reduciendo el brazo de palanca sobre L4-L5.",
    whyUseIt:
      "Reparte el trabajo de forma equilibrada entre cuádriceps y cadena posterior con mucho menor cizallamiento lumbar que el peso muerto con barra recta.",
    primaryMuscles: ["Cuádriceps", "Glúteo Mayor", "Isquiotibiales", "Trapecio Superior"],
    secondaryMuscles: ["Erectores Espinales", "Agarre / Antebrazo", "Core"],
    muscleSlugs: ["quadriceps", "gluteal", "hamstring", "trapezius"],
    recommendedSide: "front",
    recommendedExercises: [
      "Peso muerto con barra hexagonal (agarre alto o bajo)",
      "Encogimientos de trapecio con barra hexagonal",
      "Paseo del granjero (Farmer's Walk) en barra hexagonal",
    ],
    chipSummary: "Barra: Hexagonal · Centro de masa alineado",
  },
  {
    equipmentId: "CG-EQP-0055",
    name: "Barra Olímpica 20 kg (Fuerza Compuesta)",
    shortName: "Barra Olímpica 20 kg",
    imageUrl: "/images/gym-equipment/CG-EQP-0055_barra-olimpica_vista-01.jpg",
    gripOrientation: "Prono (Palmas abajo)",
    family: "legs_glutes",
    biomechanicalFocus:
      "Eje recto de acero de 20 kg con moleteado olímpico y mangas giratorias de 50 mm para máxima producción de fuerza bilateral.",
    whyUseIt:
      "Herramienta base para los básicos multiarticulares (sentadilla, press de banca, peso muerto, press militar y remo Pendlay) con progresión exacta.",
    primaryMuscles: ["Cuádriceps / Glúteo", "Pectoral Mayor", "Cadena Posterior"],
    secondaryMuscles: ["Deltoides", "Tríceps", "Erectores Espinales"],
    muscleSlugs: ["quadriceps", "gluteal", "chest", "hamstring", "lower-back"],
    recommendedSide: "front",
    recommendedExercises: [
      "Sentadilla libre con barra olímpica y peso muerto rumano",
      "Press de banca plano/inclinado y press militar de pie",
      "Remo con barra inclinado (Pendlay / Yates)",
    ],
    chipSummary: "Barra: Olímpica 20 kg · Básicos compuestos",
  },
  {
    equipmentId: "CG-EQP-0074",
    name: "Soporte Landmine (Pivote Multidireccional T-Bar)",
    shortName: "Soporte Landmine",
    imageUrl: "/images/gym-equipment/CG-EQP-0074_soporte-landmine_vista-01.jpg",
    gripOrientation: "Neutro (Semipronado)",
    family: "pull_back",
    biomechanicalFocus:
      "Ancla un extremo de la barra olímpica en un pivote de 360°, transformando la carga vertical en una curva de resistencia en arco diagonal.",
    whyUseIt:
      "Permite realizar remos en punta (T-Bar / Meadows) con gran tracción dorsal y presses diagonales muy amigables para hombros con pinzamiento.",
    primaryMuscles: ["Dorsal Ancho", "Espalda Media (Romboides / Trapecio)", "Deltoides Anterior"],
    secondaryMuscles: ["Oblicuos / Core Anti-rotación", "Pectoral Clavicular"],
    muscleSlugs: ["upper-back", "trapezius", "deltoids", "obliques"],
    recommendedSide: "back",
    recommendedExercises: [
      "Remo en punta (T-Bar) con soporte Landmine y maneral V",
      "Remo Meadows unilateral en Landmine",
      "Press Landmine unilateral de hombro y rotaciones de core",
    ],
    chipSummary: "Accesorio: Landmine · Arco diagonal T-Bar",
  },
  {
    equipmentId: "CG-EQP-0077",
    name: "Arm Blaster (Aislador Pectoral de Bíceps)",
    shortName: "Arm Blaster",
    imageUrl: "/images/gym-equipment/CG-EQP-0077_arm-blaster_vista-01.jpg",
    gripOrientation: "Supino (Palmas arriba)",
    family: "arms_isolation",
    biomechanicalFocus:
      "Placa curva de aluminio que apoya los tríceps frente a las costillas e impide que los codos retrocedan o se adelanten por inercia.",
    whyUseIt:
      "Convierte cualquier curl de pie con barra Z o mancuernas en un aislamiento estricto tipo predicador vertical, eliminando el balanceo lumbar.",
    primaryMuscles: ["Bíceps Braquial (Cabeza Corta y Larga)"],
    secondaryMuscles: ["Braquial Anterior", "Braquiorradial"],
    muscleSlugs: ["biceps", "forearm"],
    recommendedSide: "front",
    recommendedExercises: [
      "Curl estricto con barra Z y Arm Blaster",
      "Curl con mancuernas simultáneo o martillo en Arm Blaster",
    ],
    chipSummary: "Accesorio: Arm Blaster · Codos fijos 100%",
  },
];

export const FOOT_STANCE_MATRIX: readonly FootStanceZone[] = [
  {
    id: "low_narrow",
    label: "Pies Bajos y Estrechos",
    shortLabel: "Pies Bajos · Cuádriceps",
    subtitle: "Máxima dorsiflexión de tobillo y flexión profunda de rodilla",
    kneeFlexionDeg: "125° – 135° (Alta)",
    hipFlexionDeg: "75° – 85° (Moderada)",
    stanceWidthCm: "Anchura de caderas (15–22 cm)",
    toeOutAngleDeg: "5° – 10° (Casi rectos)",
    biomechanicalFocus:
      "Al bajar los pies en la plataforma, la tibia viaja más hacia adelante sobre la punta del pie, aumentando el brazo de momento sobre la rodilla y aislando el vasto externo y recto femoral.",
    primaryMuscles: ["Cuádriceps (Vasto Externo)", "Vasto Medial (VMO)", "Recto Femoral"],
    secondaryMuscles: ["Glúteo Mayor (secundario)"],
    muscleSlugs: ["quadriceps", "calves"],
    recommendedSide: "front",
    cues: [
      "Mantén todo el talón pegado a la plataforma; no bajes los pies tanto que el talón se despegue.",
      "Permite que las rodillas avancen en línea con el segundo dedo del pie.",
      "Ideal en Prensa 45°, Hack Squat y Sentadilla Pendular para enfoque 100% cuádriceps.",
    ],
    compatibleMachines: ["CG-EQP-0002", "CG-EQP-0003", "CG-EQP-0019", "CG-EQP-0023"],
    svgFootprint: { leftX: 38, rightX: 62, y: 68, toeRotationDeg: 6 },
    chipSummary: "Postura: Pies bajos y estrechos · Enfoque Cuádriceps",
  },
  {
    id: "standard_mid",
    label: "Postura Media Estándar",
    shortLabel: "Postura Media · Balanceada",
    subtitle: "Distribución equilibrada entre rodilla y cadera",
    kneeFlexionDeg: "110° – 120° (Balanceada)",
    hipFlexionDeg: "95° – 105° (Balanceada)",
    stanceWidthCm: "Anchura de hombros (30–38 cm)",
    toeOutAngleDeg: "12° – 18° (Natural)",
    biomechanicalFocus:
      "Equilibra las demandas mecánicas entre extensores de rodilla (cuádriceps) y extensores de cadera (glúteo mayor), permitiendo mover la mayor carga absoluta con seguridad lumbar.",
    primaryMuscles: ["Cuádriceps Completo", "Glúteo Mayor"],
    secondaryMuscles: ["Aductor Mayor", "Isquiotibiales (estabilización)"],
    muscleSlugs: ["quadriceps", "gluteal"],
    recommendedSide: "front",
    cues: [
      "Coloca los pies a la mitad de la plataforma, separados al ancho de los hombros.",
      "Empuja con el trípode plantar completo (talón, base del pulgar y quinto metatarsiano).",
      "Mantén el sacro pegado al respaldo durante toda la fase excéntrica.",
    ],
    compatibleMachines: ["CG-EQP-0002", "CG-EQP-0003", "CG-EQP-0019", "CG-EQP-0023"],
    svgFootprint: { leftX: 33, rightX: 67, y: 50, toeRotationDeg: 14 },
    chipSummary: "Postura: Pies medios · Cuádriceps + Glúteo balanceado",
  },
  {
    id: "high_neutral",
    label: "Pies Altos y Anchura Media",
    shortLabel: "Pies Altos · Glúteo e Isquios",
    subtitle: "Mayor flexión de cadera con menor estrés patelofemoral",
    kneeFlexionDeg: "85° – 95° (Reducida)",
    hipFlexionDeg: "115° – 125° (Profunda)",
    biomechanicalFocus:
      "Subir los pies en la plataforma limita el desplazamiento anterior de la tibia (tibia casi vertical) e incrementa el ángulo de flexión de cadera, estirando al máximo el glúteo mayor y la cadena posterior.",
    stanceWidthCm: "Anchura de hombros (30–36 cm)",
    toeOutAngleDeg: "10° – 15°",
    primaryMuscles: ["Glúteo Mayor", "Isquiotibiales"],
    secondaryMuscles: ["Cuádriceps (menor demanda patelar)", "Aductor Mayor"],
    muscleSlugs: ["gluteal", "hamstring"],
    recommendedSide: "back",
    cues: [
      "Empuja decididamente desde los talones sintiendo el estiramiento profundo en el glúteo.",
      "Excelente opción si sientes molestia en el tendón rotuliano o rodilla.",
      "En Máquina Smith, adelanta los pies 25–30 cm frente a la línea de la barra para lograr este mismo efecto.",
    ],
    compatibleMachines: ["CG-EQP-0002", "CG-EQP-0003", "CG-EQP-0019"],
    svgFootprint: { leftX: 34, rightX: 66, y: 26, toeRotationDeg: 12 },
    chipSummary: "Postura: Pies altos · Enfoque Glúteo e Isquios",
  },
  {
    id: "high_wide_sumo",
    label: "Pies Altos, Anchos y Puntas 30°–45° (Sumo)",
    shortLabel: "Sumo Alto · Glúteo y Aductores",
    subtitle: "Abducción + rotación externa de cadera para aductores y glúteo",
    kneeFlexionDeg: "90° – 100°",
    hipFlexionDeg: "115° – 130° (Con abducción)",
    stanceWidthCm: "1.5x anchura de hombros (45–58 cm)",
    toeOutAngleDeg: "30° – 45° (Puntas hacia afuera)",
    biomechanicalFocus:
      "La combinación de abducción y rotación externa elonga el aductor mayor (potente extensor de cadera desde el fondo) y recluta intensamente las fibras superiores yuxtacoxales del glúteo.",
    primaryMuscles: ["Glúteo Mayor y Medio", "Aductor Mayor (Cara Interna)"],
    secondaryMuscles: ["Isquiotibiales", "Vasto Medial"],
    muscleSlugs: ["gluteal", "adductors", "hamstring"],
    recommendedSide: "back",
    cues: [
      "Abre las rodillas activamente en la misma dirección a la que apuntan las puntas de tus pies.",
      "Evita el valgo dinámico (que las rodillas colapsen hacia adentro al iniciar el empuje).",
      "Controla 2 segundos la bajada en el punto de máximo estiramiento de cadera.",
    ],
    compatibleMachines: ["CG-EQP-0002", "CG-EQP-0003", "CG-EQP-0018"],
    svgFootprint: { leftX: 21, rightX: 79, y: 28, toeRotationDeg: 36 },
    chipSummary: "Postura: Sumo alto 35° · Glúteo y Aductores",
  },
  {
    id: "bottom_edge_calves",
    label: "Borde Inferior (Solo Metatarsos · Pantorrilla)",
    shortLabel: "Metatarsos · Gemelos",
    subtitle: "Rodilla extendida (sin hiperextender) para gastrocnemio",
    kneeFlexionDeg: "5° – 10° (Microflexión de seguridad)",
    hipFlexionDeg: "Estático",
    stanceWidthCm: "Anchura de caderas (18–25 cm)",
    toeOutAngleDeg: "0° neutro / +15° gemelo interno / -15° externo",
    biomechanicalFocus:
      "Al mantener la rodilla casi recta, el gastrocnemio (músculo biarticular que cruza rodilla y tobillo) permanece elongado y asume la mayor parte de la carga frente al sóleo.",
    primaryMuscles: ["Gastrocnemio Medial y Lateral (Gemelos)", "Sóleo"],
    secondaryMuscles: ["Tibial Posterior", "Peroneos"],
    muscleSlugs: ["calves"],
    recommendedSide: "back",
    cues: [
      "Apoya únicamente la bola del pie (metatarsos) con los seguros de la prensa puestos.",
      "Pausa 2 segundos abajo en dorsiflexión máxima para disipar el reflejo elástico del tendón de Aquiles.",
      "Sube en flexión plantar completa y sostén 1 segundo arriba.",
    ],
    compatibleMachines: ["CG-EQP-0002", "CG-EQP-0012", "CG-EQP-0013"],
    svgFootprint: { leftX: 39, rightX: 61, y: 86, toeRotationDeg: 0 },
    chipSummary: "Postura: Borde inferior · Gastrocnemio (Gemelos)",
  },
];

export const UPPER_BODY_GRIP_MATRIX: readonly UpperBodyGripAngleEntry[] = [
  {
    id: "bench_decline_15",
    category: "bench_angle",
    label: "Declinado (-15°) / Fondos Inclinados",
    angleBadge: "-15° Declinado",
    subtitle: "Vector descendente alineado con las fibras abdominales/costales del pectoral",
    biomechanicalFocus:
      "Alinea el empuje con las fibras inferiores (porción abdominal y esternal baja) del pectoral mayor, reduciendo el requerimiento de flexión anterior del deltoides.",
    jointProtectionNote: "Menor pinzamiento subacromial que el press plano con codos abiertos.",
    primaryMuscles: ["Pectoral Inferior (Porción Costal)", "Pectoral Esternal"],
    secondaryMuscles: ["Tríceps Braquial", "Deltoides Anterior"],
    muscleSlugs: ["chest", "triceps"],
    recommendedSide: "front",
    cues: [
      "Mantén las escápulas retraídas y deprimidas hacia los bolsillos traseros.",
      "En fondos en paralelas, inclina el torso 25° hacia adelante para enfatizar el pectoral.",
    ],
    chipSummary: "Ángulo: -15° Declinado · Pectoral Inferior",
  },
  {
    id: "bench_flat_0",
    category: "bench_angle",
    label: "Plano (0°) · Codos a 45°–60° (Plano Escapular)",
    angleBadge: "0° Plano",
    subtitle: "Máximo reclutamiento global del pectoral esternal",
    biomechanicalFocus:
      "Llevar los codos a 45°–60° respecto al torso (en lugar de 90° en 'T') alinea las fibras esternales del pectoral y protege el tendón del supraespinoso y la cápsula anterior del hombro.",
    jointProtectionNote: "NUNCA abras los codos a 90° ('en T'); mantén 45°–60° de abducción.",
    primaryMuscles: ["Pectoral Mayor (Porción Esternal)", "Tríceps"],
    secondaryMuscles: ["Deltoides Anterior"],
    muscleSlugs: ["chest", "triceps", "deltoids"],
    recommendedSide: "front",
    cues: [
      "Toca con la barra o mancuernas a la altura de la línea inferior del pecho/esternón.",
      "Conserva un arco torácico natural con glúteos y pies firmes en el suelo.",
    ],
    chipSummary: "Ángulo: 0° Plano (Codos 45°) · Pectoral Esternal",
  },
  {
    id: "bench_incline_30",
    category: "bench_angle",
    label: "Inclinado Óptimo (30°)",
    angleBadge: "30° Inclinado",
    subtitle: "El punto dulce biomecánico para el haz clavicular (pectoral superior)",
    biomechanicalFocus:
      "Estudios EMG demuestran que 30° de inclinación maximiza la activación de la porción clavicular del pectoral sin ceder el protagonismo al deltoides anterior.",
    jointProtectionNote: "Usa codos a ~45°; ideal con mancuernas o barra Smith hacia la clavícula.",
    primaryMuscles: ["Pectoral Superior (Haz Clavicular)"],
    secondaryMuscles: ["Deltoides Anterior", "Tríceps"],
    muscleSlugs: ["chest", "deltoids"],
    recommendedSide: "front",
    cues: [
      "Ajusta el respaldo en la muesca 2 o 3 (30° reales, no 45°–60°).",
      "Baja controlando 2–3 segundos hasta estirar las fibras claviculares.",
    ],
    chipSummary: "Ángulo: 30° Inclinado · Pectoral Clavicular",
  },
  {
    id: "bench_incline_45",
    category: "bench_angle",
    label: "Inclinado Alto (45°)",
    angleBadge: "45° Híbrido",
    subtitle: "Transición entre pectoral clavicular y deltoides anterior",
    biomechanicalFocus:
      "A 45° la carga se reparte casi 50/50 entre el haz clavicular alto y el deltoides anterior. Útil como segundo press o para atletas con poca movilidad en press militar vertical.",
    jointProtectionNote: "Evita rebotar en el fondo para proteger el tendón largo del bíceps.",
    primaryMuscles: ["Deltoides Anterior", "Pectoral Clavicular Alto"],
    secondaryMuscles: ["Tríceps", "Serrato Anterior"],
    muscleSlugs: ["deltoids", "chest", "triceps"],
    recommendedSide: "front",
    cues: [
      "Lleva los codos ligeramente por delante de la línea de los hombros.",
      "Excelente ángulo para press con mancuernas en agarre neutro o semipronado.",
    ],
    chipSummary: "Ángulo: 45° Inclinado · Hombro Ant. + Clavicular",
  },
  {
    id: "bench_shoulder_75",
    category: "bench_angle",
    label: "Press de Hombro (70°–75° Respaldo)",
    angleBadge: "75° Hombro",
    subtitle: "Más seguro y estable que 90° verticales puros",
    biomechanicalFocus:
      "Inclinar el respaldo a 70°–75° (en lugar de 90° rectos) permite que la escápula rote libremente en el plano escapular sin hiperextender la columna lumbar para esquivar el mentón.",
    jointProtectionNote: "Trabaja en el plano escapular (codos ~30° hacia adelante, no pegados a la pared).",
    primaryMuscles: ["Deltoides Anterior y Lateral", "Tríceps"],
    secondaryMuscles: ["Trapecio Superior", "Serrato Anterior"],
    muscleSlugs: ["deltoids", "triceps", "trapezius"],
    recommendedSide: "front",
    cues: [
      "Coloca el banco un punto antes de la vertical completa (75°).",
      "Mantén los antebrazos perpendiculares al suelo en todo el recorrido.",
    ],
    chipSummary: "Ángulo: 75° Escapular · Deltoides sin arquear lumbar",
  },
  {
    id: "elbows_tucked_lats",
    category: "pull_elbow_path",
    label: "Tracción Sagital (Codos Pegados al Costado · 0°–20°)",
    angleBadge: "Codos 15° · Dorsal",
    subtitle: "Extensión humeral pura hacia la cadera",
    biomechanicalFocus:
      "Llevar los codos rozando las costillas en dirección al bolsillo/cadera maximiza el brazo de momento del dorsal ancho (especialmente fibras iliacas y costales).",
    jointProtectionNote: "Mantén el hombro lejos de la oreja (depresión escapular activa).",
    primaryMuscles: ["Dorsal Ancho (Fibras Inferiores y Medias)"],
    secondaryMuscles: ["Redondo Mayor", "Braquial"],
    muscleSlugs: ["upper-back", "lower-back"],
    recommendedSide: "back",
    cues: [
      "Piensa en llevar los codos hacia tus bolsillos, no en jalar con las manos.",
      "Usa maneral triángulo (CG-EQP-0044) o estribo unilateral (CG-EQP-0040).",
    ],
    chipSummary: "Trayectoria: Codos pegados · Enfoque Dorsal Ancho",
  },
  {
    id: "elbows_flared_upper_back",
    category: "pull_elbow_path",
    label: "Tracción Transversal (Codos Abiertos · 45°–75°)",
    angleBadge: "Codos 60° · Espalda Alta",
    subtitle: "Abducción horizontal con retracción escapular completa",
    biomechanicalFocus:
      "Abrir los codos entre 45° y 75° respecto al torso desactiva parcialmente el dorsal ancho y transfiere la carga directa a romboides, trapecio medio/inferior y deltoides posterior.",
    jointProtectionNote: "Junta las escápulas al final del recorrido durante 1 segundo completo.",
    primaryMuscles: ["Romboides", "Trapecio Medio e Inferior", "Deltoides Posterior"],
    secondaryMuscles: ["Redondo Menor", "Infraespinoso"],
    muscleSlugs: ["trapezius", "upper-back", "deltoids"],
    recommendedSide: "back",
    cues: [
      "Tracciona hacia la línea del esternón o pecho alto, no hacia el ombligo.",
      "Ideal en Remo con Pecho Apoyado (CG-EQP-0009) o Barra Anatómica Ancha (CG-EQP-0043).",
    ],
    chipSummary: "Trayectoria: Codos 60° · Espalda Alta y Romboides",
  },
  {
    id: "shoulder_hyperext_bayesian",
    category: "arm_shoulder_angle",
    label: "Hombro en Extensión (Detrás del Torso · Bayesian / Katana)",
    angleBadge: "Estiramiento Máximo",
    subtitle: "Hipertrofia mediada por estiramiento en cabezas biarticulares",
    biomechanicalFocus:
      "En el Curl Bayesian (codo detrás del torso) se elonga la cabeza larga del bíceps en el hombro; en Extensión Katana sobre la cabeza (codo arriba a 150°) se elonga la cabeza larga del tríceps.",
    jointProtectionNote: "Mantén el hombro estable sin dejar que rote hacia adelante en el curl.",
    primaryMuscles: ["Cabeza Larga del Bíceps (Pico)", "Cabeza Larga del Tríceps"],
    secondaryMuscles: ["Braquial Anterior"],
    muscleSlugs: ["biceps", "triceps"],
    recommendedSide: "front",
    cues: [
      "Da un paso al frente respecto a la polea baja para iniciar con tensión desde el estiramiento.",
      "Para tríceps (Katana), apunta los codos al techo y extiende sin abrirlos.",
    ],
    chipSummary: "Posición: Hombro en extensión/flexión · Cabeza Larga",
  },
  {
    id: "shoulder_flexed_preacher",
    category: "arm_shoulder_angle",
    label: "Hombro en Flexión Apoyado (Predicador / Spider)",
    angleBadge: "Acortamiento Puro",
    subtitle: "Aislamiento estricto sin impulso y énfasis en braquial/cabeza corta",
    biomechanicalFocus:
      "Con los brazos apoyados delante del torso en el banco Scott (Predicador), la cabeza larga pierde tensión pasiva pero el braquial anterior y la cabeza corta asumen el 100% del trabajo sin inercia.",
    jointProtectionNote: "En polea baja la tensión se mantiene arriba (donde las mancuernas pierden carga).",
    primaryMuscles: ["Cabeza Corta del Bíceps", "Braquial Anterior"],
    secondaryMuscles: ["Braquiorradial"],
    muscleSlugs: ["biceps", "forearm"],
    recommendedSide: "front",
    cues: [
      "Pega toda la axila y el tríceps al cojín del predicador; no levantes los codos al subir.",
      "Al hacerlo en polea baja (unilateral o bilateral) obtienes tensión constante en todo el arco.",
    ],
    chipSummary: "Posición: Hombro flexionado (Predicador) · Cabeza Corta",
  },
];

export interface BiomechanicsContextInput {
  bodyPart?: string | null;
  muscleGroup?: string | null;
  movementPattern?: string | null;
  exerciseName?: string | null;
  equipmentId?: string | null;
}

export function resolveInitialBiomechanicsTab(
  input?: BiomechanicsContextInput | null,
): BiomechanicsAtlasTab {
  if (!input) return "foot_stance";
  const text = `${input.bodyPart ?? ""} ${input.muscleGroup ?? ""} ${input.movementPattern ?? ""} ${input.exerciseName ?? ""}`
    .trim()
    .toLowerCase();

  if (
    /\b(leg|legs|quad|quads|quadriceps|hamstring|hamstrings|glute|glutes|calv|calves|pierna|cuadriceps|cuádriceps|isquio|gluteo|glúteo|pantorrilla|gemelo|prensa|sentadilla|squat|hack|lunge|zancada)\b/.test(
      text,
    )
  ) {
    return "foot_stance";
  }

  if (
    /\b(chest|pecho|pectoral|bench|banca|inclinad|declinad|shoulder|shoulders|hombro|deltoid|militar|press|dip|fondo)\b/.test(
      text,
    ) &&
    !/\b(leg press|prensa|pushdown|polea)\b/.test(text)
  ) {
    return "upper_angle";
  }

  if (
    /\b(back|espalda|dorsal|lat|lats|row|remo|pulldown|jalon|jalón|bicep|bícep|tricep|trícep|curl|bayesian|predicador|katana|polea|cable|maneral|face pull)\b/.test(
      text,
    )
  ) {
    return "attachments";
  }

  return "foot_stance";
}

export function countsMapFromSlugs(slugs: readonly Slug[]): ReadonlyMap<Slug, number> {
  const map = new Map<Slug, number>();
  slugs.forEach((slug, index) => {
    map.set(slug, index === 0 ? 3 : 2);
  });
  return map;
}

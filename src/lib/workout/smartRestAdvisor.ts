/**
 * workout/smartRestAdvisor.ts — Inteligencia de descanso por modalidad y grupo muscular.
 *
 * Calcula tiempos de descanso recomendados según:
 * - Modalidad: unilateral (con descanso inter-lado de 40s), máquina/polea, o bilateral libre.
 * - Región: core, pierna, aislamiento de brazo, o compuesto de tren superior.
 * - Tipo de serie: calentamiento, normal, fallo o dropset.
 */

export type RestModality = "unilateral" | "machine" | "bilateral";
export type RestRegion = "core" | "leg" | "arm_isolation" | "compound_upper";

export interface ExerciseRestContext {
  name?: string | null;
  name_es?: string | null;
  target?: string | null;
  bodyPart?: string | null;
  body_part?: string | null;
  equipment?: string | null;
  equipment_id?: string | null;
  movement_pattern?: string | null;
  setType?: "warmup" | "normal" | "failure" | "dropset";
}

export interface SmartRestRecommendation {
  modality: RestModality;
  region: RestRegion;
  /** Segundos recomendados al cambiar de brazo/pierna/lado en ejercicios unilaterales. */
  betweenSidesSeconds: number | null;
  /** Segundos recomendados al completar la serie completa (ambos lados o bilateral). */
  betweenSetsSeconds: number;
  /** Etiqueta corta para UI (ej. "Unilateral · 40s/lado"). */
  shortBadge: string;
  /** Explicación breve para el atleta. */
  detail: string;
}

export const UNILATERAL_SIDE_REST_SECONDS = 40;

function normalizeText(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const UNILATERAL_PATTERNS = [
  "unilateral",
  "a una mano",
  "a un brazo",
  "a una pierna",
  "1 brazo",
  "1 pierna",
  "1 mano",
  "single arm",
  "single-arm",
  "one arm",
  "one-arm",
  "single leg",
  "single-leg",
  "one leg",
  "one-leg",
  "alternado",
  "alternating",
  "bulgara",
  "bulgarian",
  "zancada",
  "lunge",
  "split squat",
  "step up",
  "step-up",
  "pistol",
  "cossack",
  "suitcase",
  "concentration",
  "concentrado",
  "kickback",
  "patada de gluteo",
  "side plank",
  "plancha lateral",
  "pallof",
];

const MACHINE_PATTERNS = [
  "machine",
  "leverage",
  "smith",
  "sled",
  "cable",
  "polea",
  "maquina",
  "prensa",
  "leg press",
  "hack squat",
  "pec deck",
  "leg extension",
  "extension de cuadriceps",
  "leg curl",
  "curl femoral",
  "lat pulldown",
  "jalon",
  "seated row",
];

const CORE_PATTERNS = [
  "abs",
  "abdominals",
  "obliques",
  "core",
  "waist",
  "abdomen",
  "oblicuos",
  "plancha",
  "plank",
  "crunch",
  "ab wheel",
  "rueda abdominal",
  "elevacion de piernas",
  "leg raise",
  "pallof",
  "russian twist",
  "giro ruso",
];

const LEG_PATTERNS = [
  "quads",
  "quadriceps",
  "hamstrings",
  "glutes",
  "calves",
  "adductors",
  "abductors",
  "upper legs",
  "lower legs",
  "cuadriceps",
  "isquiotibiales",
  "gluteo",
  "gemelos",
  "pantorrilla",
  "sentadilla",
  "squat",
  "peso muerto",
  "deadlift",
  "hip thrust",
  "prensa",
  "zancada",
  "lunge",
  "bulgara",
  "rdl",
];

const ARM_ISOLATION_PATTERNS = [
  "biceps",
  "triceps",
  "forearms",
  "antebrazo",
  "curl",
  "tricep",
  "elevacion lateral",
  "lateral raise",
  "face pull",
  "pajaro",
  "rear delt",
  "kickback",
  "martillo",
  "hammer",
];

function matchesAny(haystack: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => haystack.includes(pattern));
}

export function classifyExerciseRest(ctx: ExerciseRestContext): {
  modality: RestModality;
  region: RestRegion;
} {
  const combinedName = normalizeText(
    `${ctx.name ?? ""} ${ctx.name_es ?? ""} ${ctx.movement_pattern ?? ""}`,
  );
  const equipmentText = normalizeText(`${ctx.equipment ?? ""} ${ctx.equipment_id ?? ""}`);
  const muscleText = normalizeText(
    `${ctx.target ?? ""} ${ctx.bodyPart ?? ""} ${ctx.body_part ?? ""} ${ctx.name ?? ""} ${ctx.name_es ?? ""}`,
  );

  let modality: RestModality = "bilateral";
  if (matchesAny(combinedName, UNILATERAL_PATTERNS)) {
    modality = "unilateral";
  } else if (
    matchesAny(equipmentText, MACHINE_PATTERNS) ||
    matchesAny(combinedName, MACHINE_PATTERNS)
  ) {
    modality = "machine";
  }

  let region: RestRegion = "compound_upper";
  if (matchesAny(muscleText, CORE_PATTERNS)) {
    region = "core";
  } else if (matchesAny(muscleText, LEG_PATTERNS)) {
    region = "leg";
  } else if (
    ctx.movement_pattern === "isolation" ||
    matchesAny(muscleText, ARM_ISOLATION_PATTERNS)
  ) {
    region = "arm_isolation";
  }

  return { modality, region };
}

export function recommendSmartRest(
  ctx: ExerciseRestContext,
): SmartRestRecommendation {
  const { modality, region } = classifyExerciseRest(ctx);
  const betweenSidesSeconds =
    modality === "unilateral" ? UNILATERAL_SIDE_REST_SECONDS : null;

  if (ctx.setType === "warmup") {
    return {
      modality,
      region,
      betweenSidesSeconds,
      betweenSetsSeconds: 45,
      shortBadge:
        modality === "unilateral" ? "Calentamiento · 40s/lado" : "Calentamiento · 45s",
      detail:
        modality === "unilateral"
          ? "Calentamiento: 40 s entre lados y 45 s antes de pasar a carga."
          : "Calentamiento: 45 s para activar sin fatiga.",
    };
  }

  let betweenSetsSeconds: number;
  if (modality === "unilateral") {
    betweenSetsSeconds = region === "leg" ? 90 : region === "core" ? 45 : 60;
  } else if (modality === "machine") {
    betweenSetsSeconds =
      region === "leg" ? 90 : region === "core" ? 45 : region === "compound_upper" ? 75 : 60;
  } else {
    betweenSetsSeconds =
      region === "leg" ? 150 : region === "core" ? 45 : region === "compound_upper" ? 120 : 75;
  }

  if (ctx.setType === "failure" || ctx.setType === "dropset") {
    betweenSetsSeconds = Math.max(betweenSetsSeconds, 90);
  }

  const modalityLabel =
    modality === "unilateral"
      ? "Unilateral"
      : modality === "machine"
        ? "Máquina"
        : "Bilateral";
  const regionLabel =
    region === "leg"
      ? "Pierna"
      : region === "core"
        ? "Core"
        : region === "arm_isolation"
          ? "Brazo / Aislamiento"
          : "Compuesto";

  const shortBadge =
    modality === "unilateral"
      ? `Unilateral · 40s/lado · ${betweenSetsSeconds}s serie`
      : `${modalityLabel} ${regionLabel} · ${betweenSetsSeconds}s`;

  const detail =
    modality === "unilateral"
      ? `Descansa ${UNILATERAL_SIDE_REST_SECONDS} s al cambiar de lado y ${betweenSetsSeconds} s al completar ambos.`
      : `${modalityLabel} (${regionLabel.toLowerCase()}): ${betweenSetsSeconds} s recomendados entre series.`;

  return {
    modality,
    region,
    betweenSidesSeconds,
    betweenSetsSeconds,
    shortBadge,
    detail,
  };
}

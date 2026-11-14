import type { CatalogExercise, StationKey } from "@/lib/catalog/types";

export type SmartLoadMode = "overload" | "cross_transfer" | "biometric_day_0" | "bodyweight";
export type ExperienceLevel = "beginner" | "intermediate" | "advanced";
export type SetFeedback = "too_light" | "perfect" | "too_heavy";
export type SmartSetType = "warmup" | "normal" | "dropset" | "failure";

export interface HistoricalCompletion {
  weightKg: number;
  reps: number;
  completed: boolean;
}

export interface SmartLoadParams {
  mode: SmartLoadMode;
  weightKg?: number;
  reps?: number;
  targetReps?: number;
  weightHistory?: readonly HistoricalCompletion[];
  sourceOneRmKg?: number;
  targetStation?: StationKey;
  experienceLevel?: ExperienceLevel;
  /** Resolved implement, when the caller already classified it. */
  category?: EquipmentCategory;
  equipment?: string;
  equipmentId?: string;
}

export interface SmartLoadResult {
  weightKg: number;
  suggestedReps: number;
  reason: string;
  confidence: "high" | "medium" | "low";
}

export interface SmartWorkoutSet {
  weightKg: number;
  reps: number;
  type: SmartSetType;
  completed?: boolean;
}

const TRANSFER_FACTORS: Partial<Record<StationKey, number>> = {
  leg_press_45: 1.5,
  free_weight_area: 1,
  flat_bench: 0.9,
  incline_bench: 0.85,
  squat_rack: 0.9,
  smith_machine: 0.85,
  cable_high_pulley: 0.65,
  cable_low_pulley: 0.65,
  cable_mid_pulley: 0.65,
  cable_seated_row: 0.65,
  cable_lat_pulldown: 0.65,
  cable_triceps_station: 0.65,
};

function finite(value: number | undefined, fallback = 0): number {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function roundLoad(value: number): number {
  return Math.max(0, Math.round(value * 2) / 2);
}

export function epley(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  return weightKg * (1 + reps / 30);
}

function dayZeroFactor(station: StationKey | undefined, movementPattern?: string): number {
  if (station === "leg_press_45") return 1.2;
  if (station === "squat_rack" || station === "smith_machine") return 0.6;
  if (station === "flat_bench" || station === "incline_bench") return 0.45;
  if (station?.startsWith("cable_")) return 0.4;
  if (movementPattern === "isolation" || station === "free_weight_area") return 0.15;
  return 0.3;
}

/**
 * The machines that only ever host the athlete's own body.
 *
 * A pull-up bar, a decline bench for abdominals or a hyperextension bench are
 * machines, so the catalog maps them to an `CG-EQP-*` id — and a mapped id is
 * exactly what used to make the engine treat a pull-up as a loaded barbell and
 * prescribe "Barra 7kg". The machine is a place, not a load.
 */
const BODYWEIGHT_EQUIPMENT_IDS = new Set(["CG-EQP-0051", "CG-EQP-0028", "CG-EQP-0015"]);

/** What a calisthenics movement is called in the catalog and in a coach's rename. */
const BODYWEIGHT_NAME_HINTS = [
  "elevacion de piernas",
  "elevacion de rodillas",
  "dominada",
  "pull-up",
  "pull up",
  "chin-up",
  "chin up",
  "fondos",
  "flexiones",
  "push-up",
  "push up",
  "dip",
  "plancha",
  "abdominal",
  "crunch",
  "hiperextension",
  "extension lumbar",
  "bicicleta",
  "estiramiento",
];

/**
 * Words that mean the movement does carry something.
 *
 * "Crunch en polea" and "dominadas con lastre" are loaded movements that happen to
 * be named after a calisthenics one: the machine or the added weight decides.
 */
const LOADED_NAME_HINTS = [
  "polea",
  "cable",
  "mancuerna",
  "barra",
  "disco",
  "lastre",
  "kettlebell",
  "pesa rusa",
  "smith",
  "maquina",
  "máquina",
  "hack",
  "hack squat",
  "press",
];

/** The parts of a catalog row the load estimate needs to recognise. */
export interface BodyweightCandidate {
  equipment_id?: string | null;
  equipment?: string | null;
  name?: string | null;
  name_es?: string | null;
  movement_pattern?: string | null;
}

/** The load-free prescription shown instead of a bar breakdown. */
export const BODYWEIGHT_LOAD_HINT = "Peso corporal · Controla el balanceo (lastre opcional)";

/** Case- and accent-insensitive, so "Elevación" and "elevacion" are one movement. */
function foldName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Whether a movement is done with the athlete's own body and nothing else.
 *
 * One rule, in one place: the training screen asks it before estimating a load,
 * and every caller gets the same answer. A bodyweight exercise has no number to
 * estimate, so the engine must not invent one for it.
 */
export function isBodyweightExercise(
  input: BodyweightCandidate | null | undefined,
): boolean {
  if (!input) return false;

  const equipmentId = (input.equipment_id ?? "").trim();
  if (equipmentId === "NONE") return true;
  if (BODYWEIGHT_EQUIPMENT_IDS.has(equipmentId.toUpperCase())) return true;

  const equipment = foldName(input.equipment ?? "");
  if (equipment === "body weight" || equipment === "bodyweight" || equipment === "assisted") {
    return true;
  }

  const name = foldName(`${input.name ?? ""} ${input.name_es ?? ""}`);
  if (!name.trim()) return false;
  if (LOADED_NAME_HINTS.some((hint) => name.includes(hint))) return false;
  return BODYWEIGHT_NAME_HINTS.some((hint) => name.includes(hint));
}

/* ------------------------------------------------------------------------- *
 * Equipment categories: how the load is written down                        *
 * ------------------------------------------------------------------------- */

export type EquipmentCategory = "bodyweight" | "dumbbell" | "barbell" | "cable" | "machine";

export interface EquipmentCategoryInput extends BodyweightCandidate {
  station?: StationKey | null;
  /** The caller already decided this one is bodyweight. */
  isBodyweight?: boolean;
}

/**
 * The five ways this gym loads a movement.
 *
 * Not the same question as `equipmentKindOf`. That one answers "how much of a
 * lift survives a change of implement", so it needs an `other` bucket for rows
 * that match nothing and a transfer factor for each. This one answers "how is
 * the number written on the card" -- per hand, per side of a bar, or as a pin
 * in a stack -- and a movement that matches nothing here is on a machine,
 * because that is what the athlete sees when they walk in.
 */
const CATEGORY_HINTS: ReadonlyArray<readonly [EquipmentCategory, RegExp]> = [
  ["dumbbell", /mancuerna|dumbbell/],
  ["cable", /polea|cable|pulley|crossover|jabon|jalon|lat\s?pull/],
  ["barbell", /barra|barbell|olimp|smith/],
  ["machine", /maquina|machine|selectorizada|leverage|pec\s?deck|hack|glute|press|curl|extension/],
];

export function classifyEquipmentCategory(
  input: EquipmentCategoryInput | null | undefined,
): EquipmentCategory {
  if (!input) return "machine";
  if (input.isBodyweight || isBodyweightExercise(input) || input.station === "pullup_dip_station") {
    return "bodyweight";
  }
  if (input.station?.startsWith("cable_")) return "cable";
  if (input.station === "squat_rack" || input.station === "smith_machine") return "barbell";

  // Accents are decoration on a catalog name: "Jalón" and "Jalon" are the same
  // movement, and only one of them used to reach the cable pattern.
  const text = foldName(
    `${input.equipment ?? ""} ${input.equipment_id ?? ""} ${input.name ?? ""} ${input.name_es ?? ""}`,
  );
  for (const [category, pattern] of CATEGORY_HINTS) {
    if (pattern.test(text)) return category;
  }
  return "machine";
}

/** The smallest load the athlete can actually put on this implement. */
export function incrementForCategory(category: EquipmentCategory): number {
  return category === "dumbbell" ? 2 : 2.5;
}

export function estimateSmartLoad(params: SmartLoadParams & {
  movementPattern?: string;
}): SmartLoadResult {
  const targetReps = Math.max(1, Math.round(finite(params.targetReps, 8)));

  // An exercise with no external load has no load to estimate: a push-up is
  // fifteen reps, not "65 kg times a station factor". Inventing a number here is
  // how a first session ends up loaded with a weight the movement never had.
  if (params.mode === "bodyweight") {
    return {
      weightKg: 0,
      suggestedReps: Math.max(targetReps, 15),
      reason: "Peso corporal: la carga la pone el atleta, no una barra.",
      confidence: "high",
    };
  }

  if (params.mode === "biometric_day_0") {
    const rawBodyWeight = finite(params.weightKg, 65);
    if (rawBodyWeight < 0) {
      return {
        weightKg: 0,
        suggestedReps: targetReps,
        reason: "Peso corporal inválido; iniciar sin carga externa.",
        confidence: "low",
      };
    }
    const bodyWeight = rawBodyWeight > 0 ? rawBodyWeight : 65;
    const experienceFactor = {
      beginner: 0.7,
      intermediate: 0.85,
      advanced: 1,
    }[params.experienceLevel ?? "beginner"];

    return {
      weightKg: roundLoad(bodyWeight * experienceFactor * dayZeroFactor(params.targetStation, params.movementPattern)),
      suggestedReps: targetReps,
      reason: "Carga inicial calculada por peso corporal, experiencia y estación.",
      confidence: "medium",
    };
  }

  if (params.mode === "cross_transfer") {
    const sourceOneRm = finite(
      params.sourceOneRmKg,
      epley(finite(params.weightKg), Math.max(1, Math.round(finite(params.reps, targetReps)))),
    );
    const factor = TRANSFER_FACTORS[params.targetStation ?? "free_weight_area"] ?? 0.5;
    return {
      weightKg: roundLoad((sourceOneRm * factor) / (1 + targetReps / 30)),
      suggestedReps: targetReps,
      reason: "Carga transferida mediante 1RM Epley y estación objetivo.",
      confidence: sourceOneRm > 0 ? "high" : "low",
    };
  }

  const completed = (params.weightHistory ?? []).filter(
    (entry) => entry.completed && entry.weightKg > 0 && entry.reps > 0,
  );
  const latest = completed.at(-1);
  if (!latest) {
    return {
      weightKg: roundLoad(finite(params.weightKg)),
      suggestedReps: targetReps,
      reason: "Sin historial suficiente para progresar.",
      confidence: "low",
    };
  }

  const achievedTarget = latest.reps >= targetReps;
  const increment = incrementForCategory(
    params.category ??
      classifyEquipmentCategory({
        station: params.targetStation,
        equipment: params.equipment,
        equipment_id: params.equipmentId,
      }),
  );
  return {
    weightKg: roundLoad(latest.weightKg + (achievedTarget ? increment : 0)),
    suggestedReps: targetReps,
    reason: achievedTarget
      ? `Objetivo completado: +${increment}kg sobre la última serie.`
      : "Mantener carga hasta completar el rango objetivo.",
    confidence: "high",
  };
}

export interface WarmupRampInput {
  workingWeightKg: number;
  targetReps?: number;
  workingReps?: number;
  isBodyweight?: boolean;
  category?: EquipmentCategory;
  equipmentCategory?: EquipmentCategory;
  musclePreviouslyWorked?: boolean;
}

/**
 * The ramp that actually prepares a lift.
 *
 * A single "50 %" opener does not prepare a 100 kg squat: the athlete's first
 * real set is then a 50 kg jump. The ramp is sized by how much bar there is, so
 * a heavy lift gets three touch-and-go ramps and a light one gets a single
 * opener, and a bodyweight movement gets one set because there is no load to
 * climb.
 */
export function generateWarmupRamp(input: WarmupRampInput): SmartWorkoutSet[] {
  const reps = Math.max(1, Math.round(finite(input.workingReps ?? input.targetReps, 10)));
  const category = input.equipmentCategory ?? input.category ?? "machine";
  const isBodyweight = input.isBodyweight === true || category === "bodyweight";
  const weight = Math.max(0, finite(input.workingWeightKg));

  if (input.musclePreviouslyWorked) {
    // The muscle is already warm from earlier in the session: one short opener.
    return [
      {
        weightKg: isBodyweight ? 0 : roundLoad(weight * 0.5),
        reps: Math.min(8, reps),
        type: "warmup",
        completed: false,
      },
    ];
  }

  if (isBodyweight) {
    return [{ weightKg: 0, reps: Math.min(8, reps), type: "warmup" }];
  }

  if (weight <= 15) {
    return [{ weightKg: roundLoad(weight * 0.5), reps: Math.min(8, reps), type: "warmup" }];
  }

  if (weight < 40) {
    return [
      { weightKg: roundLoad(weight * 0.5), reps: Math.min(8, reps), type: "warmup" },
      { weightKg: roundLoad(weight * 0.75), reps: Math.min(4, reps), type: "warmup" },
    ];
  }

  return [
    { weightKg: roundLoad(weight * 0.5), reps: Math.min(10, reps), type: "warmup" },
    { weightKg: roundLoad(weight * 0.7), reps: Math.min(5, reps), type: "warmup" },
    { weightKg: roundLoad(weight * 0.85), reps: Math.min(2, reps), type: "warmup" },
  ];
}

export function generateSmartWarmupSets(
  workingWeightKg: number,
  musclePreviouslyWorked: boolean,
): SmartWorkoutSet[] {
  return generateWarmupRamp({
    workingWeightKg,
    musclePreviouslyWorked,
  });
}

export function calibratePendingSets<T extends { weightKg: number }>(
  sets: readonly T[],
  index: number,
  feedback: SetFeedback,
): T[] {
  const multiplier = feedback === "too_light" ? 1.05 : feedback === "too_heavy" ? 0.9 : 1;
  return sets.map((set, setIndex) =>
    setIndex <= index ? { ...set } : { ...set, weightKg: roundLoad(set.weightKg * multiplier) },
  );
}

export function getAdaptiveRestSeconds(
  setType: SmartSetType,
  movementPattern?: string,
): number {
  if (setType === "warmup") return 45;
  if (setType === "failure" || setType === "dropset") return 90;
  const compounds = new Set(["squat", "hinge", "horizontal_push", "horizontal_pull", "vertical_push", "vertical_pull"]);
  return compounds.has(movementPattern ?? "") ? 120 : 75;
}

export interface PlateBreakdownResult {
  mode: "bodyweight" | "dumbbell" | "cable" | "barbell" | "machine";
  summary: string;
  barWeightKg?: number;
  perSideKg?: number;
  platesPerSide: number[];
  perHandKg?: number;
  remainderKg?: number;
}

const STANDARD_GYM_PLATES = [20, 15, 10, 5, 2.5, 1.25] as const;

function decomposePlates(targetKg: number): { plates: number[]; remainderKg: number } {
  let remaining = Math.max(0, roundLoad(targetKg));
  const plates: number[] = [];
  for (const plate of STANDARD_GYM_PLATES) {
    while (remaining + 0.01 >= plate) {
      plates.push(plate);
      remaining = Math.round((remaining - plate) * 100) / 100;
    }
  }
  return { plates, remainderKg: Math.max(0, remaining) };
}

export function getPlateAndImplementBreakdown(
  weightKg: number,
  station: StationKey,
  equipment?: string,
  category?: EquipmentCategory,
): PlateBreakdownResult {
  const weight = roundLoad(weightKg);
  if (station === "pullup_dip_station" || category === "bodyweight" || weight <= 0) {
    return { mode: "bodyweight", summary: BODYWEIGHT_LOAD_HINT, platesPerSide: [] };
  }
  if (
    category === "dumbbell" ||
    (station === "free_weight_area" && equipment?.toLowerCase().includes("dumbbell"))
  ) {
    const perHand = roundLoad(weight / 2);
    return {
      mode: "dumbbell",
      summary: `Mancuerna ${perHand} kg c/u · ${weight} kg total`,
      perHandKg: perHand,
      platesPerSide: [],
    };
  }
  if (category === "cable" || station.startsWith("cable_")) {
    return {
      mode: "cable",
      summary: `Torre ${weight} kg · seleccionar pasador`,
      platesPerSide: [],
    };
  }
  if (category === "machine") {
    const perSide = roundLoad(weight / 2);
    const { plates, remainderKg } = decomposePlates(perSide);
    return {
      mode: "machine",
      summary: `${weight} kg en máquina${plates.length > 0 ? ` · [${plates.join("+")} kg]/lado` : ""}`,
      perSideKg: perSide,
      platesPerSide: plates,
      remainderKg,
    };
  }

  const barWeightKg = 20;
  if (weight <= barWeightKg) {
    return {
      mode: "barbell",
      summary: `Barra ${weight} kg`,
      barWeightKg: weight,
      perSideKg: 0,
      platesPerSide: [],
      remainderKg: 0,
    };
  }

  const perSideKg = roundLoad((weight - barWeightKg) / 2);
  const { plates, remainderKg } = decomposePlates(perSideKg);
  return {
    mode: "barbell",
    summary: `Barra 20 kg + [${plates.join(" + ") || perSideKg} kg]/lado`,
    barWeightKg,
    perSideKg,
    platesPerSide: plates,
    remainderKg,
  };
}

export interface WarmupRampStepMeta {
  restSeconds: number;
  restLabel: string;
  purpose: string;
}

export const QUICK_RAMP_TARGET_WEIGHTS = [30, 40, 50, 60, 80] as const;

export function getWarmupRampStepMeta(index: number, total: number): WarmupRampStepMeta {
  if (total <= 1) {
    return {
      restSeconds: 45,
      restLabel: "Descanso: 45s",
      purpose: "Activación ligera y fijación técnica",
    };
  }
  if (index === 0) {
    return {
      restSeconds: 45,
      restLabel: "Descanso: 45s",
      purpose: "Lubricación articular y patrón motor",
    };
  }
  if (index >= total - 1) {
    return {
      restSeconds: 90,
      restLabel: "Descanso: 90s",
      purpose: "Potenciación post-activación (PAP) sin fatiga",
    };
  }
  return {
    restSeconds: 60,
    restLabel: "Descanso: 60s",
    purpose: "Activación neuromuscular progresiva",
  };
}

export function getLoadBreakdownHint(
  weightKg: number,
  station: StationKey,
  equipment?: string,
  category?: EquipmentCategory,
): string {
  const weight = roundLoad(weightKg);
  // A bar and a dip station carry the athlete, not a load: there is no bar
  // breakdown to describe, and inventing one is what put "Barra 7kg" on a pull-up.
  if (station === "pullup_dip_station") return BODYWEIGHT_LOAD_HINT;
  if (category === "bodyweight") return BODYWEIGHT_LOAD_HINT;
  // A dumbbell is written per hand: "60kg" means two 30s, and the card has to
  // say so or the athlete loads 60 in each hand and calls it an overload.
  if (category === "dumbbell") {
    return `Mancuerna ${roundLoad(weight / 2)}kg por mano · ${weight}kg total`;
  }
  if (station === "free_weight_area" && equipment?.toLowerCase().includes("dumbbell")) {
    return `Mancuerna ${roundLoad(weight / 2)}kg por mano`;
  }
  if (category === "cable") return `Torre ${weight}kg · seleccionar pasador`;
  if (station.startsWith("cable_")) return `Torre ${weight}kg · seleccionar pasador`;
  if (weight <= 20) return `Barra ${weight}kg`;
  return `Barra 20kg + [${roundLoad((weight - 20) / 2)}kg]/lado`;
}

export interface SmartSubstitute {
  exercise: CatalogExercise;
  suggestedWeightKg: number;
  imageUrl: string;
  conversionReason: string;
}

export function findSmartSubstitutes(
  current: CatalogExercise,
  weightKg: number,
  catalog: readonly CatalogExercise[],
): SmartSubstitute[] {
  const eligible = catalog.filter((exercise) =>
    exercise.id !== current.id &&
    exercise.availableInCronosGym !== false &&
    exercise.equipment_id !== current.equipment_id,
  );
  const primary = eligible.filter((exercise) =>
    Boolean(current.movement_pattern) &&
    exercise.movement_pattern === current.movement_pattern,
  );
  const secondary = eligible.filter((exercise) =>
    exercise.muscle_group === current.muscle_group ||
    exercise.target === current.target ||
    exercise.body_part === current.body_part,
  );
  const candidates = [...primary, ...secondary].filter((exercise, index, list) =>
    list.findIndex((item) => item.id === exercise.id) === index,
  );
  return candidates
    .slice(0, 4)
    .map((exercise) => ({
      exercise,
      suggestedWeightKg: roundLoad(weightKg * 0.75),
      imageUrl: exercise.image || exercise.gif_url,
      conversionReason: "Conversión conservadora entre estaciones.",
    }));
}

export const SET_TYPE_GUIDES = {
  warmup: "W · Aproximación: prepara el músculo sin generar fatiga.",
  normal: "1, 2, 3 · Serie efectiva: termina con RIR 1–2.",
  dropset: "D · Drop Set: reduce la carga y continúa sin descanso.",
  failure: "F · Al fallo: detén la serie cuando se pierda la técnica.",
} as const;

/* ------------------------------------------------------------------------- *
 * The strength model: what the engine remembers between sessions            *
 * ------------------------------------------------------------------------- */

/**
 * Where the learned model lives.
 *
 * A model, not a log. Every set already reaches Supabase and the offline
 * queue, so storing sets again here would give the engine a second version of
 * the truth that drifts from the one the athlete sees in their history. What
 * the engine needs is one number per movement -- the best estimated one-rep
 * max -- and the last load that actually worked, so a movement the athlete has
 * never done can still be loaded from a pattern they have.
 */
export const STRENGTH_MODEL_KEY = "cronos_strength_model_v1";

export interface StrengthExerciseRecord {
  bestE1rmKg: number;
  lastWeightKg: number;
  lastReps: number;
  lastRpe: number | null;
  updatedAt: string;
}

export interface StrengthPatternRecord {
  bestE1rmKg: number;
  updatedAt: string;
}

export interface StrengthModel {
  version: 1;
  exercises: Record<string, StrengthExerciseRecord>;
  patterns: Record<string, StrengthPatternRecord>;
  /** How sharply this athlete reacts to a change of load. 1 is average. */
  sensitivity: number;
  calibration: ExperienceLevel;
  updatedAt: string;
}

export function emptyStrengthModel(): StrengthModel {
  return {
    version: 1,
    exercises: {},
    patterns: {},
    sensitivity: 1,
    calibration: "beginner",
    updatedAt: "",
  };
}

/**
 * `localStorage` is not always there: a private window can throw on access and
 * the engine is also imported by the coach preview and by tests that run in
 * node. A model that cannot be read is an empty model, never a crash in the
 * middle of a set.
 */
function strengthStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function positiveNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

export function loadStrengthModel(): StrengthModel {
  const store = strengthStorage();
  if (!store) return emptyStrengthModel();
  let raw: string | null = null;
  try {
    raw = store.getItem(STRENGTH_MODEL_KEY);
  } catch {
    return emptyStrengthModel();
  }
  if (!raw) return emptyStrengthModel();

  try {
    const parsed = JSON.parse(raw) as Partial<StrengthModel> | null;
    if (!parsed || typeof parsed !== "object") return emptyStrengthModel();
    const exercises: Record<string, StrengthExerciseRecord> = {};
    for (const [id, entry] of Object.entries(parsed.exercises ?? {})) {
      if (!entry || typeof entry !== "object") continue;
      const record = entry as Partial<StrengthExerciseRecord>;
      exercises[id] = {
        bestE1rmKg: positiveNumber(record.bestE1rmKg),
        lastWeightKg: positiveNumber(record.lastWeightKg),
        lastReps: Math.max(0, Math.round(positiveNumber(record.lastReps))),
        lastRpe: typeof record.lastRpe === "number" && Number.isFinite(record.lastRpe) ? record.lastRpe : null,
        updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : "",
      };
    }
    const patterns: Record<string, StrengthPatternRecord> = {};
    for (const [pattern, entry] of Object.entries(parsed.patterns ?? {})) {
      if (!entry || typeof entry !== "object") continue;
      const record = entry as Partial<StrengthPatternRecord>;
      patterns[pattern] = {
        bestE1rmKg: positiveNumber(record.bestE1rmKg),
        updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : "",
      };
    }
    const sensitivity = positiveNumber(parsed.sensitivity);
    return {
      version: 1,
      exercises,
      patterns,
      sensitivity: sensitivity >= 0.8 && sensitivity <= 1.2 ? sensitivity : 1,
      calibration:
        parsed.calibration === "advanced" || parsed.calibration === "intermediate"
          ? parsed.calibration
          : "beginner",
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "",
    };
  } catch {
    // A model written by a future build is unreadable, not dangerous: start over.
    return emptyStrengthModel();
  }
}

export function saveStrengthModel(model: StrengthModel): void {
  const store = strengthStorage();
  if (!store) return;
  try {
    store.setItem(STRENGTH_MODEL_KEY, JSON.stringify(model));
  } catch {
    // A full or blocked store must never break a set the athlete just did.
  }
}

/** The best e1RM the model knows for one exercise, or 0. */
export function readExerciseBest(model: StrengthModel, exerciseId: string): number {
  return model.exercises[exerciseId]?.bestE1rmKg ?? 0;
}

/** The best e1RM the model knows for one movement pattern, or 0. */
export function readPatternBest(model: StrengthModel, movementPattern?: string | null): number {
  if (!movementPattern) return 0;
  return model.patterns[movementPattern]?.bestE1rmKg ?? 0;
}

/* ------------------------------------------------------------------------- *
 * Intra-session regulation                                                  *
 * ------------------------------------------------------------------------- */

export type OverloadDirection = "increase_load" | "increase_reps" | "hold" | "reduce_load";

export interface OverloadSuggestion {
  direction: OverloadDirection;
  weightDeltaKg: number;
  repsDelta: number;
  reason: string;
}

export interface SetAdjustmentInput {
  weightKg: number;
  reps: number;
  targetReps: number;
  rpe?: number | null;
  isBodyweight?: boolean;
  /** The increment the gym actually has: 2.5 on a bar, 2 on a dumbbell. */
  incrementKg?: number;
}

/**
 * What to do with the remaining sets, decided by the set that was just done.
 *
 * Symmetry can only progress between sessions, because it needs a finished one
 * to compare against. A set is a measurement too: two reps over target, or a
 * hard set that still felt easy, is the athlete telling the engine the load is
 * wrong *now*, while there are still sets left to fix it in.
 */
export function suggestSetAdjustment(input: SetAdjustmentInput): OverloadSuggestion | null {
  const reps = Math.max(0, Math.round(finite(input.reps)));
  const targetReps = Math.max(1, Math.round(finite(input.targetReps, 8)));
  const rpe = typeof input.rpe === "number" && Number.isFinite(input.rpe) ? input.rpe : null;
  const increment = input.incrementKg ?? (input.isBodyweight ? 0 : 2.5);
  const weight = Math.max(0, finite(input.weightKg));

  if (rpe === 10 && reps < targetReps) {
    return input.isBodyweight
      ? { direction: "reduce_load", weightDeltaKg: 0, repsDelta: -1, reason: "RPE 10 sin llegar a la meta: baja una repetición y recupera la técnica." }
      : { direction: "reduce_load", weightDeltaKg: -increment, repsDelta: 0, reason: "RPE 10 sin llegar a la meta: baja la carga para mantener el estímulo." };
  }

  if (reps >= targetReps + 2) {
    return input.isBodyweight
      ? { direction: "increase_reps", weightDeltaKg: 0, repsDelta: 2, reason: "Dos repeticiones de sobra: el cuerpo pide más recorrido." }
      : { direction: "increase_reps", weightDeltaKg: 0, repsDelta: 2, reason: "Dos repeticiones de sobra: sube el rango antes que el peso." };
  }

  if (rpe !== null && rpe <= 7 && weight > 0) {
    return { direction: "increase_load", weightDeltaKg: increment, repsDelta: 0, reason: "La serie quedó fácil (RPE bajo): sube la carga." };
  }

  if (rpe !== null && rpe >= 9.5 && reps >= targetReps) {
    return { direction: "hold", weightDeltaKg: 0, repsDelta: 0, reason: "Serie al límite con la meta cumplida: repite la carga." };
  }

  return null;
}

export interface RecordSetInput {
  exerciseId: string;
  movementPattern?: string | null;
  bodyPart?: string | null;
  weightKg: number;
  reps: number;
  rpe?: number | null;
  targetReps?: number;
  isBodyweight?: boolean;
  incrementKg?: number;
  /** Injectable for tests; defaults to the real clock. */
  now?: number;
}

export interface RecordSetResult {
  model: StrengthModel;
  e1rmKg: number;
  previousE1rmKg: number;
  improved: boolean;
  suggestion: OverloadSuggestion | null;
}

/**
 * Teach the engine from one completed set.
 *
 * Called on every `✓` and from the calibration modal, so the model moves while
 * the session is still running instead of waiting for the summary. The e1RM is
 * the only thing kept per exercise: it is comparable across rep ranges, which a
 * raw "best weight" is not.
 */
export function recordSetAndTrainEngine(input: RecordSetInput): RecordSetResult {
  const model = loadStrengthModel();
  const weight = Math.max(0, finite(input.weightKg));
  const reps = Math.max(0, Math.round(finite(input.reps)));
  const e1rm = epley(weight, reps);
  const previous = model.exercises[input.exerciseId]?.bestE1rmKg ?? 0;
  const stamp = new Date(input.now ?? Date.now()).toISOString();

  model.exercises[input.exerciseId] = {
    bestE1rmKg: Math.max(previous, e1rm),
    lastWeightKg: weight,
    lastReps: reps,
    lastRpe: typeof input.rpe === "number" && Number.isFinite(input.rpe) ? input.rpe : null,
    updatedAt: stamp,
  };

  if (input.movementPattern) {
    const pattern = input.movementPattern;
    const patternBest = model.patterns[pattern]?.bestE1rmKg ?? 0;
    model.patterns[pattern] = {
      bestE1rmKg: Math.max(patternBest, e1rm),
      updatedAt: stamp,
    };
  }

  if (input.rpe === 10) model.calibration = "advanced";
  else if (input.rpe !== null && input.rpe !== undefined && input.rpe <= 7 && model.calibration === "beginner") {
    model.calibration = "intermediate";
  }

  model.updatedAt = stamp;
  saveStrengthModel(model);

  return {
    model,
    e1rmKg: e1rm,
    previousE1rmKg: previous,
    improved: e1rm > previous,
    suggestion: suggestSetAdjustment({
      weightKg: weight,
      reps,
      targetReps: input.targetReps ?? reps,
      rpe: input.rpe ?? null,
      isBodyweight: input.isBodyweight,
      incrementKg: input.incrementKg,
    }),
  };
}

/* ------------------------------------------------------------------------- *
 * Cold start: loading an exercise with no history of its own                *
 * ------------------------------------------------------------------------- */

export type EquipmentKind = "barbell" | "machine" | "dumbbell" | "pulley" | "bodyweight" | "other";

/**
 * How much of a lift survives a change of implement.
 *
 * A 100 kg barbell press is not 100 kg on a dumbbell or on a machine: the
 * dumbbell has to be lifted once per hand and the machine has a fixed path.
 * Transferring the number unchanged is how a first set becomes an ego test.
 */
export const EQUIPMENT_TRANSFER_FACTORS: Record<EquipmentKind, number> = {
  barbell: 1,
  machine: 0.95,
  dumbbell: 0.42,
  pulley: 0.75,
  bodyweight: 1,
  other: 0.8,
};

const EQUIPMENT_KIND_HINTS: ReadonlyArray<readonly [EquipmentKind, RegExp]> = [
  ["dumbbell", /mancuerna|dumbbell/i],
  ["pulley", /polea|cable|pulley|crossover/i],
  ["barbell", /barra|barbell|olimp/i],
  ["bodyweight", /peso corporal|body ?weight|calistenia/i],
  ["machine", /m[aá]quina|machine|smith|selectorizada/i],
];

export function equipmentKindOf(equipment?: string | null, equipmentId?: string | null): EquipmentKind {
  if (equipmentId === "NONE") return "bodyweight";
  const text = `${equipment ?? ""} ${equipmentId ?? ""}`.trim();
  if (!text) return "other";
  for (const [kind, pattern] of EQUIPMENT_KIND_HINTS) {
    if (pattern.test(text)) return kind;
  }
  return "other";
}

/** The smallest load the gym can actually load on this implement. */
export function gymIncrementFor(kind: EquipmentKind): number {
  if (kind === "dumbbell") return 2;
  if (kind === "barbell" || kind === "machine" || kind === "bodyweight") return 2.5;
  return 2.5;
}

function roundToIncrement(value: number, increment: number): number {
  const step = increment > 0 ? increment : 2.5;
  return Math.max(0, Math.round(value / step) * step);
}

/** The three one-tap answers to "how do we calibrate this today?". */
export const CALIBRATION_PRESETS = [
  { id: "light", label: "Técnica (-15%)", short: "Técnica", factor: 0.85, hint: "Prioriza el recorrido y la técnica." },
  { id: "standard", label: "Estándar para mi peso (Recomendado)", short: "Estándar", factor: 1, hint: "La estimación por biometría, sin ajustes." },
  { id: "demanding", label: "Exigente / Ya lo domino (+15%)", short: "Exigente", factor: 1.15, hint: "Para un patrón que ya dominas." },
] as const;

export type CalibrationPresetId = (typeof CALIBRATION_PRESETS)[number]["id"];

export interface ColdStartInput {
  exerciseId: string;
  movementPattern?: string | null;
  bodyPart?: string | null;
  equipment?: string | null;
  equipmentId?: string | null;
  station?: StationKey;
  bodyWeightKg?: number;
  targetReps?: number;
  experienceLevel?: ExperienceLevel;
  isBodyweight?: boolean;
  /** e1RM per exercise id, from the athlete's own history. */
  historyByExercise?: Readonly<Record<string, number>>;
  /** Exercise ids that share the pattern or the body part, best first. */
  siblingExerciseIds?: readonly string[];
  preset?: CalibrationPresetId;
  model?: StrengthModel;
}

export interface ColdStartResult {
  weightKg: number;
  suggestedReps: number;
  /** Where the number came from, so the modal can say it out loud. */
  source: "exercise" | "transfer" | "biometrics";
  sourceLabel: string;
  reason: string;
  calibrated: boolean;
  /** How this implement is loaded, so the card can be written per hand. */
  category: EquipmentCategory;
  /** "Mancuerna 12.5kg por mano · 25kg total", or the bodyweight line. */
  breakdownHint: string;
}

/**
 * Put a load on an exercise the athlete has never logged.
 *
 * Three sources, best first: their own record of this movement, a sibling in
 * the same pattern (scaled by implement), and finally biometrics. It never
 * returns "no idea" -- a cold exercise still has to be trainable, and a blank
 * weight field is what makes people guess.
 */
export function inferColdStartLoad(input: ColdStartInput): ColdStartResult {
  const targetReps = Math.max(1, Math.round(finite(input.targetReps, 8)));
  const preset = CALIBRATION_PRESETS.find((item) => item.id === input.preset) ?? CALIBRATION_PRESETS[1];
  const model = input.model ?? loadStrengthModel();
  const kind = equipmentKindOf(input.equipment, input.equipmentId);
  const category = classifyEquipmentCategory({
    equipment: input.equipment ?? undefined,
    equipment_id: input.equipmentId ?? undefined,
    station: input.station,
    isBodyweight: input.isBodyweight,
  });
  const increment = incrementForCategory(category);
  const factor = EQUIPMENT_TRANSFER_FACTORS[kind];
  const isBodyweight = input.isBodyweight === true || category === "bodyweight";

  // A movement that only ever carries the athlete has no load to calibrate, and
  // asking for one is what makes the first session feel impossible.
  if (isBodyweight) {
    return {
      weightKg: 0,
      suggestedReps: Math.max(targetReps, 15),
      source: "biometrics",
      sourceLabel: "Peso corporal",
      reason: "Peso corporal: la carga la pone el atleta; el peso externo va a cero.",
      calibrated: input.preset !== undefined,
      category,
      breakdownHint: BODYWEIGHT_LOAD_HINT,
    };
  }

  const own = Math.max(
    positiveNumber(input.historyByExercise?.[input.exerciseId]),
    readExerciseBest(model, input.exerciseId),
  );
  if (own > 0) {
    const weight = roundToIncrement((own / (1 + targetReps / 30)) * preset.factor, increment);
    return {
      weightKg: weight,
      suggestedReps: targetReps,
      source: "exercise",
      sourceLabel: "Tu última marca en este ejercicio",
      reason: "Ya tienes una marca propia: se ajusta a las repeticiones de hoy.",
      calibrated: input.preset !== undefined,
      category,
      breakdownHint: getLoadBreakdownHint(weight, input.station ?? "free_weight_area", input.equipment ?? undefined, category),
    };
  }

  const patternBest = readPatternBest(model, input.movementPattern);
  const siblings = (input.siblingExerciseIds ?? [])
    .map((id) => positiveNumber(input.historyByExercise?.[id]))
    .filter((value) => value > 0);
  const transferred = Math.max(patternBest, ...siblings, 0) * factor;

  if (transferred > 0) {
    const weight = roundToIncrement((transferred / (1 + targetReps / 30)) * preset.factor, increment);
    return {
      weightKg: weight,
      suggestedReps: targetReps,
      source: "transfer",
      sourceLabel: input.movementPattern ? `Transferido desde tu patrón ${input.movementPattern}` : "Transferido desde un ejercicio equivalente",
      reason: `Mismo patrón, otro implemento: se aplica el factor ${factor} de ${kind}.`,
      calibrated: input.preset !== undefined,
      category,
      breakdownHint: getLoadBreakdownHint(weight, input.station ?? "free_weight_area", input.equipment ?? undefined, category),
    };
  }

  const biometric = estimateSmartLoad({
    mode: "biometric_day_0",
    weightKg: input.bodyWeightKg ?? 65,
    targetReps,
    targetStation: input.station,
    movementPattern: input.movementPattern ?? undefined,
    experienceLevel: input.experienceLevel ?? model.calibration,
  });
  const weight = roundToIncrement(biometric.weightKg * preset.factor, increment);

  return {
    weightKg: weight,
    suggestedReps: targetReps,
    source: "biometrics",
    sourceLabel: `Estimado por ${preset.id === "light" ? "técnica ligera" : preset.id === "demanding" ? "nivel exigente" : "peso corporal y experiencia"}`,
    reason: "Sin marcas previas: se estima con el peso corporal, la estación y la experiencia.",
    calibrated: input.preset !== undefined,
    category,
    breakdownHint: getLoadBreakdownHint(weight, input.station ?? "free_weight_area", input.equipment ?? undefined, category),
  };
}

/* ------------------------------------------------------------------------- *
 * Exercise ranks                                                            *
 * ------------------------------------------------------------------------- */

export type ExerciseRankTier =
  | "Sin rango"
  | "Bronce I" | "Bronce II" | "Bronce III"
  | "Plata I" | "Plata II" | "Plata III"
  | "Oro I" | "Oro II" | "Oro III"
  | "Esmeralda I" | "Esmeralda II" | "Esmeralda III"
  | "Diamante"
  | "Titán Cronos";

const RANK_COLORS = {
  none: "#8E8E93",
  bronze: "#C87F42",
  silver: "#C7C7CC",
  gold: "#FFD60A",
  emerald: "#30D158",
  diamond: "#64D2FF",
  titan: "#BF5AF2",
} as const;

interface RankRung {
  tier: ExerciseRankTier;
  /** Minimum relative strength (e1RM / bodyweight), or reps for bodyweight. */
  min: number;
  colorHex: string;
}

/**
 * One ladder for the whole body: the same tier means the same relative
 * strength, whether it was earned on a barbell or on a pull-up bar.
 */
const STRENGTH_LADDER: readonly RankRung[] = [
  { tier: "Sin rango", min: 0, colorHex: RANK_COLORS.none },
  { tier: "Bronce I", min: 0.3, colorHex: RANK_COLORS.bronze },
  { tier: "Bronce II", min: 0.4, colorHex: RANK_COLORS.bronze },
  { tier: "Bronce III", min: 0.5, colorHex: RANK_COLORS.bronze },
  { tier: "Plata I", min: 0.6, colorHex: RANK_COLORS.silver },
  { tier: "Plata II", min: 0.7, colorHex: RANK_COLORS.silver },
  { tier: "Plata III", min: 0.8, colorHex: RANK_COLORS.silver },
  { tier: "Oro I", min: 0.9, colorHex: RANK_COLORS.gold },
  { tier: "Oro II", min: 1.0, colorHex: RANK_COLORS.gold },
  { tier: "Oro III", min: 1.1, colorHex: RANK_COLORS.gold },
  { tier: "Esmeralda I", min: 1.2, colorHex: RANK_COLORS.emerald },
  { tier: "Esmeralda II", min: 1.3, colorHex: RANK_COLORS.emerald },
  { tier: "Esmeralda III", min: 1.4, colorHex: RANK_COLORS.emerald },
  { tier: "Diamante", min: 1.6, colorHex: RANK_COLORS.diamond },
  { tier: "Titán Cronos", min: 2.0, colorHex: RANK_COLORS.titan },
];

/** Calisthenics has no load to divide by bodyweight, so reps are the ladder. */
const BODYWEIGHT_LADDER: readonly RankRung[] = [
  { tier: "Sin rango", min: 0, colorHex: RANK_COLORS.none },
  { tier: "Bronce I", min: 6, colorHex: RANK_COLORS.bronze },
  { tier: "Bronce II", min: 8, colorHex: RANK_COLORS.bronze },
  { tier: "Bronce III", min: 10, colorHex: RANK_COLORS.bronze },
  { tier: "Plata I", min: 12, colorHex: RANK_COLORS.silver },
  { tier: "Plata II", min: 15, colorHex: RANK_COLORS.silver },
  { tier: "Plata III", min: 18, colorHex: RANK_COLORS.silver },
  { tier: "Oro I", min: 20, colorHex: RANK_COLORS.gold },
  { tier: "Oro II", min: 25, colorHex: RANK_COLORS.gold },
  { tier: "Oro III", min: 30, colorHex: RANK_COLORS.gold },
  { tier: "Esmeralda I", min: 35, colorHex: RANK_COLORS.emerald },
  { tier: "Esmeralda II", min: 40, colorHex: RANK_COLORS.emerald },
  { tier: "Esmeralda III", min: 45, colorHex: RANK_COLORS.emerald },
  { tier: "Diamante", min: 50, colorHex: RANK_COLORS.diamond },
  { tier: "Titán Cronos", min: 60, colorHex: RANK_COLORS.titan },
];

export interface ExerciseRankInput {
  exerciseId: string;
  weightKg: number;
  reps: number;
  bodyWeightKg?: number;
  isBodyweight?: boolean;
  movementPattern?: string | null;
  /** The reps the athlete is aiming for; the next rank is priced in them. */
  targetReps?: number;
  incrementKg?: number;
  equipment?: string;
  equipmentId?: string;
  category?: EquipmentCategory;
  /** Which station the movement is performed at, when the caller knows it. */
  station?: StationKey | null;
}

export interface ExerciseRankState {
  tier: ExerciseRankTier;
  colorHex: string;
  progressPct: number;
}

export interface NextExerciseRank {
  tier: ExerciseRankTier;
  targetWeightKg: number;
  targetReps: number;
  colorHex: string;
  /** True when the athlete already sits on the last rung. */
  maxed: boolean;
}

export interface ExerciseRankResult {
  currentRank: ExerciseRankState;
  nextRank: NextExerciseRank;
  /** e1RM for loaded work, best reps for bodyweight. */
  score: number;
  /** Relative strength (loaded) or reps (bodyweight). */
  ratio: number;
  /** Which ladder priced this rank, so the sheet can explain the bar. */
  family: RankFamily;
  /** How the implement is loaded, as the card is written. */
  category: EquipmentCategory;
}

/** What kind of lift the rank is priced against. */
export type RankFamily = "compound" | "push_pull" | "isolation" | "bodyweight";

/** The bars the base ladder starts and tops out at; every family scales between them. */
const BASE_LADDER_MIN = 0.3;
const BASE_LADDER_MAX = 2.0;

/**
 * A ladder that spans `from` to `to` but keeps the same fifteen rungs.
 *
 * The tier names are the vocabulary and the colours are the badge; what changes
 * between a squat and a lateral raise is the scale they sit on. A lateral raise
 * can never reach a 2.0 bodyweight ratio, so one shared scale made half the
 * catalog unrankable and the other half trivially Diamante.
 */
export function buildStrengthLadder(from: number, to: number): readonly RankRung[] {
  const floor = Math.max(0, finite(from, BASE_LADDER_MIN));
  const ceiling = Math.max(floor, finite(to, BASE_LADDER_MAX));
  const span = (ceiling - floor) / (BASE_LADDER_MAX - BASE_LADDER_MIN);

  return [
    { tier: "Sin rango", min: 0, colorHex: RANK_COLORS.none },
    ...STRENGTH_LADDER.slice(1).map((rung) => ({
      tier: rung.tier,
      min: Math.round((floor + (rung.min - BASE_LADDER_MIN) * span) * 1000) / 1000,
      colorHex: rung.colorHex,
    })),
  ];
}

const FAMILY_LADDERS: Readonly<Record<Exclude<RankFamily, "bodyweight">, readonly RankRung[]>> = {
  compound: buildStrengthLadder(0.6, 2.2),
  push_pull: buildStrengthLadder(0.3, 2.0),
  isolation: buildStrengthLadder(0.15, 0.65),
};

const COMPOUND_HINTS = /barra|barbell|squat|sentadilla|peso muerto|deadlift|press\s*banca|bench|leg\s?press|prensa|hip\s?thrust|remo\s*barra/;

/** Stations where the load is a bar or a loaded sled, whatever the machine looks like. */
const COMPOUND_STATIONS = /squat_rack|smith_machine|leg_press_45|flat_bench|incline_bench/;

/**
 * Which ladder prices this movement.
 *
 * Station first: a leg press is a machine and a compound, and pricing it as an
 * isolation movement put its top rank where the athlete could reach it by
 * accident. Then the implement, then the movement's own name.
 */
function classifyRankFamily(input: ExerciseRankInput, category: EquipmentCategory): RankFamily {
  if (input.isBodyweight || category === "bodyweight") return "bodyweight";
  const station = input.station ?? "";
  if (COMPOUND_STATIONS.test(station)) return "compound";
  if (category === "cable") return "isolation";
  if (COMPOUND_HINTS.test(foldName(`${input.equipment ?? ""} ${station}`))) return "compound";
  if (category === "machine") return "isolation";
  return "push_pull";
}

/**
 * Where the athlete stands on one exercise, and what the next rung costs.
 *
 * The score is relative, not absolute: 100 kg means nothing without knowing
 * what the athlete weighs, and a rank that a 50 kg athlete can never reach is
 * decoration. The next rank is expressed as a load and a rep count because
 * that is the only form in which it can be acted on -- "get stronger" is not a
 * target, "27.5 × 8" is.
 */
export function computeExerciseRank(input: ExerciseRankInput): ExerciseRankResult {
  const bodyweight = Math.max(0, finite(input.bodyWeightKg));
  const weight = Math.max(0, finite(input.weightKg));
  const reps = Math.max(0, Math.round(finite(input.reps)));
  const targetReps = Math.max(1, Math.round(finite(input.targetReps, 8)));
  const category =
    input.category ??
    classifyEquipmentCategory({
      equipment: input.equipment,
      equipment_id: input.equipmentId,
      station: input.station,
      isBodyweight: input.isBodyweight,
    });
  const family = classifyRankFamily(input, category);
  const increment = incrementForCategory(category);
  const step = input.incrementKg ?? increment;
  const ladder = family === "bodyweight" ? BODYWEIGHT_LADDER : FAMILY_LADDERS[family];

  const e1rm = epley(weight, reps);
  const ratio = family === "bodyweight" ? reps : bodyweight > 0 ? e1rm / bodyweight : 0;

  let index = 0;
  for (let i = 0; i < ladder.length; i += 1) {
    if (ratio + 1e-9 >= ladder[i].min) index = i;
  }

  const current = ladder[index];
  const next = ladder[index + 1] ?? null;
  const span = next ? next.min - current.min : 0;
  const progressPct = next
    ? Math.min(100, Math.max(0, Math.round(((ratio - current.min) / (span || 1)) * 100)))
    : 100;

  const targetWeightKg =
    family === "bodyweight"
      ? 0
      : next && bodyweight > 0
        ? roundToIncrement((next.min * bodyweight) / (1 + targetReps / 30), step)
        : roundToIncrement(weight, step);

  return {
    currentRank: { tier: current.tier, colorHex: current.colorHex, progressPct },
    nextRank: next
      ? {
          tier: next.tier,
          targetWeightKg,
          targetReps: family === "bodyweight" ? next.min : targetReps,
          colorHex: next.colorHex,
          maxed: false,
        }
      : {
          tier: current.tier,
          targetWeightKg,
          targetReps,
          colorHex: current.colorHex,
          maxed: true,
        },
    score: family === "bodyweight" ? reps : e1rm,
    ratio,
    family,
    category,
  };
}

/* ------------------------------------------------------------------------- *
 * Biomechanical alternatives                                                *
 * ------------------------------------------------------------------------- */

/** "CG-EQP-0051 · Barra Dominadas" -> "Barra Dominadas". */
export function cleanEquipmentLabel(value?: string | null): string {
  if (!value) return "";
  return value
    .replace(/CG-EQP-\d+/gi, "")
    .replace(/^[\s·•|/,;:–—-]+/, "")
    .replace(/[\s·•|/,;:–—-]+$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * The part of a catalog row the replacement rules need to read.
 *
 * Structural on purpose: the shipped catalog (`CatalogExercise`) and the row the
 * workout holds (`Exercise`, from Supabase) both satisfy it, so the engine does
 * not have to choose which one the app happens to be holding.
 */
export interface AlternativeCandidate {
  id: string;
  name: string;
  name_es?: string | null;
  body_part: string;
  target: string;
  equipment: string;
  movement_pattern?: string | null;
  equipment_id?: string | null;
  equipment_name?: string | null;
  station_key?: string | null;
  muscle_group?: string;
  customNameEs?: string;
  availableInCronosGym?: boolean;
  image?: string;
  gif_url?: string;
}

export interface StationAlternative {
  exercise: AlternativeCandidate;
  displayName: string;
  cleanEquipmentName: string;
  suggestedWeightKg: number;
  reason: string;
}

/**
 * The movements that can replace this one without changing what it trains.
 *
 * A substitute is only a substitute if the muscle and the pattern survive the
 * swap: offering a crunch in place of a bench press is not an alternative, it
 * is a different workout. So the filter is strict -- same body part, or the
 * same pattern on the same muscle group -- and never both missing.
 */
export function findStationAlternatives(
  current: AlternativeCandidate,
  catalog: readonly AlternativeCandidate[],
  weightKg: number,
  limit = 6,
): StationAlternative[] {
  const currentBody = (current.body_part ?? "").trim().toLowerCase();
  const currentPattern = (current.movement_pattern ?? "").trim().toLowerCase();
  const currentMuscle = (current.muscle_group ?? "").trim().toLowerCase();
  const currentTarget = (current.target ?? "").trim().toLowerCase();

  /**
   * The region the athlete is actually training.
   *
   * A replacement that leaves the region is not a replacement, it is a
   * different exercise: swapping a bench press for a crunch changes what the
   * session is for. So the body part is a hard gate, not a score bonus, and a
   * core row can never answer a chest/back/leg movement.
   */
  const currentRegion = regionOf(currentBody);
  const isBandCandidate = (item: AlternativeCandidate): boolean => {
    const eq = (item.equipment ?? "").trim().toLowerCase();
    const label = `${item.name ?? ""} ${item.name_es ?? ""} ${item.customNameEs ?? ""}`.trim().toLowerCase();
    if (eq === "band" || eq === "bands" || eq === "resistance band" || eq.includes("resistance band")) {
      return true;
    }
    return /\b(band|bands|resistance band|banda|bandas|elástica|elastica)\b/i.test(`${eq} ${label}`);
  };
  const currentIsBand = isBandCandidate(current);

  const scored: Array<{ exercise: AlternativeCandidate; score: number }> = [];

  for (const exercise of catalog) {
    if (exercise.id === current.id) continue;
    if (exercise.availableInCronosGym === false) continue;
    if (exercise.station_key === "unavailable_station") continue;
    if (!currentIsBand && isBandCandidate(exercise)) continue;

    const body = (exercise.body_part ?? "").trim().toLowerCase();
    const pattern = (exercise.movement_pattern ?? "").trim().toLowerCase();
    const muscle = (exercise.muscle_group ?? "").trim().toLowerCase();
    const target = (exercise.target ?? "").trim().toLowerCase();

    // Both sides must name a region: a row without one cannot be proven to be
    // the same exercise, and an empty region on either side is not a match.
    if (currentRegion === null || regionOf(body) === null) continue;
    if (regionOf(body) !== currentRegion) continue;

    const samePattern = currentPattern !== "" && pattern === currentPattern;
    const sameMuscle = currentMuscle !== "" && muscle === currentMuscle;
    const sameTarget = currentTarget !== "" && target === currentTarget;

    // Same region plus a shared way of moving it. The target is what keeps a
    // "push" from landing on a row filed under the same region but aimed at a
    // different muscle.
    if (!samePattern && !sameTarget && !sameMuscle) continue;

    const score =
      (samePattern ? 4 : 0) + (sameTarget ? 2 : 0) + (sameMuscle ? 1 : 0);
    scored.push({ exercise, score });
  }

  const best = scored
    .sort((a, b) => b.score - a.score || a.exercise.name.localeCompare(b.exercise.name))
    .slice(0, Math.max(1, limit));

  const currentKind = equipmentKindOf(current.equipment, current.equipment_id);
  const currentWeight = Math.max(0, finite(weightKg));

  return best.map(({ exercise }) => {
    const kind = equipmentKindOf(exercise.equipment, exercise.equipment_id);
    const converted = roundToIncrement(currentWeight * (EQUIPMENT_TRANSFER_FACTORS[kind] / (EQUIPMENT_TRANSFER_FACTORS[currentKind] || 1)), gymIncrementFor(kind));
    return {
      exercise,
      displayName: exercise.customNameEs ?? exercise.name_es ?? exercise.name,
      // The athlete reads a machine name, never a `CG-EQP-0040`: when the row
      // only carries the id, the friendly equipment word is what is shown.
      cleanEquipmentName:
        cleanEquipmentLabel(exercise.equipment_name) ||
        cleanEquipmentLabel(exercise.equipment) ||
        exercise.equipment_name ||
        "Equipo",
      suggestedWeightKg: currentWeight > 0 ? converted : 0,
      reason:
        kind === currentKind
          ? "Mismo patrón y mismo implemento: la carga se mantiene."
          : `Mismo patrón, otro implemento (${kind}): la carga se convierte.`,
    };
  });
}

/**
 * Collapses a catalog `body_part` into the region the athlete is training.
 *
 * Returns null when the value names no region at all, which the caller treats
 * as "cannot be proven to match" rather than as a wildcard.
 */
function regionOf(bodyPart: string): string | null {
  const value = bodyPart.trim().toLowerCase();
  if (value === "") return null;
  if (value.includes("abdominal")) return "core";
  if (value === "abs") return "core";
  if (value.includes("chest")) return "chest";
  if (value.includes("back")) return "back";
  if (value.includes("shoulder")) return "shoulders";
  if (value.includes("arm")) return "arms";
  if (value.includes("leg") || value.includes("quad") || value.includes("hamstring") || value.includes("glute")) return "legs";
  if (value.includes("cardio")) return "cardio";
  if (value.includes("neck")) return "neck";
  return value;
}


export type MobilityFamily = "push" | "pull" | "legs" | "core";

export interface MobilityWarmupStep {
  id: string;
  title: string;
  focusZone: string;
  cue: string;
  doseLabel: string;
  tempoLabel: string;
}

export interface MobilityWarmupInput {
  movementPattern?: string | null;
  bodyPart?: string | null;
  equipmentCategory?: EquipmentCategory | null;
  exerciseName?: string | null;
  workingWeightKg?: number;
  isBodyweight?: boolean;
}

export interface MobilityWarmupProtocol {
  family: MobilityFamily;
  familyLabel: string;
  summary: string;
  durationBadge: string;
  steps: readonly MobilityWarmupStep[];
  activationSet: SmartWorkoutSet & { label: string };
}

const MOBILITY_TEMPLATES: Record<
  MobilityFamily,
  Omit<MobilityWarmupProtocol, "activationSet">
> = {
  push: {
    family: "push",
    familyLabel: "Patrón de Empuje · Hombro y Escápula",
    summary: "Lubrica el manguito rotador, estabiliza la escápula y abre la caja torácica antes de empujar carga.",
    durationBadge: "3 min",
    steps: [
      {
        id: "push-rot",
        title: "Rotación externa de manguito con banda",
        focusZone: "Hombro / Supraespinoso",
        cue: "Codos pegados a las costillas a 90 grados; abre sin arquear la lumbar.",
        doseLabel: "15 reps/lado",
        tempoLabel: "2-1-2",
      },
      {
        id: "push-thoracic",
        title: "Dislocaciones amplias y extensión torácica",
        focusZone: "Columna torácica / Pectoral",
        cue: "Lleva el bastón o banda por encima de la cabeza manteniendo escápulas deprimidas.",
        doseLabel: "45s",
        tempoLabel: "Controlado",
      },
      {
        id: "push-scap",
        title: "Flexiones escapulares (scapular push-ups)",
        focusZone: "Serrato anterior / Estabilidad",
        cue: "Brazos extendidos en todo momento; junta y separa escápulas suavemente.",
        doseLabel: "12 reps",
        tempoLabel: "2-1-1",
      },
    ],
  },
  pull: {
    family: "pull",
    familyLabel: "Patrón de Tirón · Dorsal y Escápula",
    summary: "Desbloquea la rotación torácica y activa la retracción escapular para traccionar sin compensar con bíceps.",
    durationBadge: "3 min",
    steps: [
      {
        id: "pull-scap",
        title: "Colgado activo / depresión escapular en polea",
        focusZone: "Trapecio inferior / Dorsal",
        cue: "Aléjate de las orejas bajando hombros sin doblar los codos.",
        doseLabel: "45s",
        tempoLabel: "2s pausa",
      },
      {
        id: "pull-tspine",
        title: "Rotación torácica en cuadrupedia (Open Book)",
        focusZone: "Columna dorsal / Costillas",
        cue: "Sigue la mano con la mirada mientras exhalas en el punto máximo.",
        doseLabel: "10 reps/lado",
        tempoLabel: "2-1-2",
      },
      {
        id: "pull-facepull",
        title: "Activación escapular y deltoides posterior",
        focusZone: "Romboides / Deltoides post.",
        cue: "Tira suave hacia la frente con pulgares apuntando atrás y pausa de control.",
        doseLabel: "15 reps",
        tempoLabel: "2-1-2",
      },
    ],
  },
  legs: {
    family: "legs",
    familyLabel: "Tren Inferior · Tobillo, Cadera y Glúteo",
    summary: "Amplía la dorsiflexión del tobillo, desbloquea la flexión de cadera y enciende el glúteo medio.",
    durationBadge: "4 min",
    steps: [
      {
        id: "legs-ankle",
        title: "Dorsiflexión de tobillo en zancada 90/90",
        focusZone: "Tobillo / Sóleo",
        cue: "Lleva la rodilla por delante de los dedos sin levantar el talón del suelo.",
        doseLabel: "45s",
        tempoLabel: "2s por repetición",
      },
      {
        id: "legs-hip",
        title: "Apertura de cadera profunda (Pry Squat)",
        focusZone: "Cadera / Aductores",
        cue: "Baja en sentadilla profunda empujando rodillas hacia afuera con los codos.",
        doseLabel: "45s",
        tempoLabel: "Respiración nasal",
      },
      {
        id: "legs-glute",
        title: "Puente de glúteo con pausa unilateral",
        focusZone: "Glúteo mayor / Medio",
        cue: "Empuja desde el talón evitando hiperextender la zona lumbar arriba.",
        doseLabel: "12 reps",
        tempoLabel: "1-2-1",
      },
    ],
  },
  core: {
    family: "core",
    familyLabel: "Core y Calistenia · Columna y Faja Media",
    summary: "Sincroniza el diafragma con la musculatura profunda para blindar la zona lumbar y preparar muñecas.",
    durationBadge: "3 min",
    steps: [
      {
        id: "core-catcamel",
        title: "Movilidad segmentada gato-camello",
        focusZone: "Columna torácica y lumbar",
        cue: "Articula vértebra por vértebra inhalando al extender y exhalando al flexionar.",
        doseLabel: "45s",
        tempoLabel: "Fluido",
      },
      {
        id: "core-deadbug",
        title: "Dead-bug con presión abdominal",
        focusZone: "Transverso / Oblicuos",
        cue: "Mantén la zona lumbar pegada al suelo mientras extiendes brazo y pierna contraria.",
        doseLabel: "12 reps",
        tempoLabel: "3-1-2",
      },
      {
        id: "core-brace",
        title: "Activación de muñecas y anti-rotación",
        focusZone: "Muñecas / Faja lumbar",
        cue: "Realiza círculos suaves de carga en muñecas y activa abdomen antes de la serie.",
        doseLabel: "30s",
        tempoLabel: "Estable",
      },
    ],
  },
};

function resolveMobilityFamily(input: MobilityWarmupInput): MobilityFamily {
  const pattern = (input.movementPattern ?? "").trim().toLowerCase();
  const body = (input.bodyPart ?? "").trim().toLowerCase();
  const name = (input.exerciseName ?? "").trim().toLowerCase();

  if (pattern === "horizontal_push" || pattern === "vertical_push") return "push";
  if (pattern === "horizontal_pull" || pattern === "vertical_pull" || pattern === "curl") return "pull";
  if (pattern === "squat" || pattern === "hinge") return "legs";
  if (
    pattern === "anti_extension" ||
    pattern === "anti_rotation" ||
    pattern === "rotation" ||
    pattern === "flexion" ||
    pattern === "carry"
  ) {
    return "core";
  }

  if (
    body.includes("leg") ||
    body.includes("quad") ||
    body.includes("hamstring") ||
    body.includes("glute") ||
    body.includes("piern") ||
    body.includes("cuadr") ||
    body.includes("isquio") ||
    body.includes("glut") ||
    body.includes("calv") ||
    body.includes("pantorr") ||
    /\b(squat|sentadilla|leg press|prensa|lunge|zancada|deadlift|peso muerto|hip thrust|femoral|cuadriceps)\b/.test(
      name,
    )
  ) {
    return "legs";
  }

  if (
    body.includes("back") ||
    body.includes("espalda") ||
    body.includes("lat") ||
    body.includes("dorsal") ||
    body.includes("bicep") ||
    /\b(row|remo|pulldown|jalon|jalón|pull-up|dominada|face pull|curl)\b/.test(name)
  ) {
    return "pull";
  }

  if (
    body.includes("chest") ||
    body.includes("pecho") ||
    body.includes("shoulder") ||
    body.includes("hombro") ||
    body.includes("tricep") ||
    /\b(bench|press|banca|militar|fondo|dip|fly|apertura|push|tricep|elevacion)\b/.test(name)
  ) {
    return "push";
  }

  if (
    body.includes("abs") ||
    body.includes("abdom") ||
    body.includes("core") ||
    body.includes("waist") ||
    input.isBodyweight === true ||
    input.equipmentCategory === "bodyweight" ||
    /\b(plank|plancha|crunch|dead bug|pallof|hang|ab)\b/.test(name)
  ) {
    return "core";
  }

  return "push";
}

/**
 * Generates a specific joint-mobility & neuromuscular activation sequence
 * for the active movement family, plus an ultra-light `W0` priming set.
 */
export function generateMobilityWarmupProtocol(
  input: MobilityWarmupInput,
): MobilityWarmupProtocol {
  const family = resolveMobilityFamily(input);
  const template = MOBILITY_TEMPLATES[family];
  const isBodyweight = input.isBodyweight === true || input.equipmentCategory === "bodyweight";
  const weight = Math.max(0, finite(input.workingWeightKg));
  const activationWeight =
    isBodyweight || weight <= 0 ? 0 : Math.max(2.5, roundLoad(weight * 0.3));

  return {
    ...template,
    activationSet: {
      weightKg: activationWeight,
      reps: 12,
      type: "warmup",
      completed: false,
      label: "W0 · Activación articular",
    },
  };
}

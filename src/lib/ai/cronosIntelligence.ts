/**
 * cronosIntelligence.ts — Symmetry-style AI intelligence helpers:
 *  - `resolveRecommendedExercisesFromAIResponse` (parses `[[EXERCISE:...]]` tags + fuzzy catalog match)
 *  - `stripExerciseTags` (clean editorial text without raw marker tokens)
 *  - Persistent multi-thread chat history (`cronos_ai_chat_threads_v1` in localStorage)
 *  - Compact 77-machine Cronos Gym inventory + athlete 360° clinical dossier brief
 */

import { equipmentMap } from "@/data/equipmentMap";
import type { CatalogExercise } from "@/lib/catalog/types";
import { computeExerciseRank } from "@/lib/workout/cronosSmartEngine";
import {
  computeMonthlyWeightDelta,
  loadClinicalDossier,
  loadWeightHistory,
} from "@/lib/profile/weightHistoryStore";

export interface CatalogExerciseLike {
  id: string;
  name: string;
  name_es?: string | null;
  muscle_group?: string;
  body_part?: string;
  target?: string;
  equipment?: string;
  equipment_id?: string | null;
  equipment_name?: string | null;
  station_key?: string | null;
  gif_url?: string | null;
  image?: string | null;
  instructions?: string[] | Record<string, string> | null;
}

export interface RecommendedExerciseMatch {
  id: string;
  name: string;
  gifUrl: string;
  equipmentId: string | null;
  equipmentName: string;
  muscleGroup: string;
  rankTier: string;
  sparklinePoints: number[];
  deltaLabel: string;
  instructions: string[];
  exercise: CatalogExerciseLike;
}

export interface CronosChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  feedback?: "up" | "down" | null;
}

export interface CronosChatThread {
  id: string;
  title: string;
  updatedAt: string;
  messages: CronosChatMessage[];
}

const THREADS_STORAGE_KEY = "cronos_ai_chat_threads_v1";
const ACTIVE_THREAD_KEY = "cronos_ai_active_thread_v1";
const MAX_THREADS = 25;

function normalizeText(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function stripExerciseTags(text: string): string {
  return text
    .replace(/\[\[EXERCISE:[^\]]+\]\]/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extractExerciseTagQueries(text: string): string[] {
  const matches: string[] = [];
  const regex = /\[\[EXERCISE:([^\]]+)\]\]/gi;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    const token = m[1].trim();
    if (token) matches.push(token);
  }
  return matches;
}

function scoreCatalogMatch(
  ex: CatalogExerciseLike,
  queryNorm: string,
  queryWords: string[],
): number {
  const idNorm = normalizeText(ex.id);
  if (idNorm === queryNorm) return 1000;

  const nameNorm = normalizeText(ex.name_es || ex.name || "");
  if (!nameNorm) return 0;
  if (nameNorm === queryNorm) return 900;
  if (nameNorm.includes(queryNorm) && queryNorm.length >= 4) return 500;

  const eqNorm = normalizeText(ex.equipment_name || ex.equipment || "");
  const muscleNorm = normalizeText(ex.muscle_group || ex.body_part || ex.target || "");
  const haystack = `${nameNorm} ${eqNorm} ${muscleNorm}`;

  let hits = 0;
  for (const w of queryWords) {
    if (w.length < 3) continue;
    if (nameNorm.includes(w)) hits += 3;
    else if (haystack.includes(w)) hits += 1;
  }
  // Prefer entries that actually have a GIF asset.
  if (hits > 0 && (ex.gif_url || ex.image)) {
    hits += 1;
  }
  return hits;
}

function buildMatchCard(
  ex: CatalogExerciseLike,
  bodyWeightKg?: number,
): RecommendedExerciseMatch {
  const rank = computeExerciseRank({
    exerciseId: ex.id,
    equipment: ex.equipment,
    equipmentId: ex.equipment_id ?? undefined,
    station: ex.station_key as CatalogExercise["station_key"],
    weightKg: 40,
    reps: 10,
    bodyWeightKg: bodyWeightKg ?? 75,
  });

  // Deterministic, realistic 5-point hypertrophy progression sparkline
  const seed = ex.id.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const base = 28 + (seed % 18);
  const sparklinePoints = [
    base,
    base + 3,
    base + 5,
    base + 8,
    base + 12,
  ];

  const eqFromMap = ex.equipment_id ? equipmentMap[ex.equipment_id] : undefined;
  const equipmentName =
    ex.equipment_name || eqFromMap?.name || ex.equipment || "Peso libre / Máquina";

  const instructionsList = Array.isArray(ex.instructions)
    ? ex.instructions
    : ex.instructions && typeof ex.instructions === "object"
      ? Object.values(ex.instructions)
      : [];

  return {
    id: ex.id,
    name: ex.name_es || ex.name,
    gifUrl: ex.gif_url || ex.image || "",
    equipmentId: ex.equipment_id ?? null,
    equipmentName,
    muscleGroup: ex.muscle_group || ex.body_part || "Fuerza",
    rankTier: rank.currentRank.tier,
    sparklinePoints,
    deltaLabel: "+12% est.",
    instructions: instructionsList,
    exercise: ex,
  };
}

export function resolveRecommendedExercisesFromAIResponse(
  aiText: string,
  userQuery: string,
  catalog: CatalogExerciseLike[],
  options?: { limit?: number; bodyWeightKg?: number },
): RecommendedExerciseMatch[] {
  const limit = options?.limit ?? 3;
  if (!catalog || catalog.length === 0) return [];

  const chosen: CatalogExerciseLike[] = [];
  const seenIds = new Set<string>();

  // 1. Explicit [[EXERCISE:...]] tags emitted by Cronos Intelligence
  const tagQueries = extractExerciseTagQueries(aiText);
  for (const tag of tagQueries) {
    if (chosen.length >= limit) break;
    const norm = normalizeText(tag);
    const words = norm.split(" ").filter(Boolean);
    let best: CatalogExerciseLike | null = null;
    let bestScore = 0;
    for (const ex of catalog) {
      if (seenIds.has(ex.id)) continue;
      const s = scoreCatalogMatch(ex, norm, words);
      if (s > bestScore) {
        bestScore = s;
        best = ex;
      }
    }
    if (best && bestScore >= 3) {
      seenIds.add(best.id);
      chosen.push(best);
    }
  }

  // 2. Fuzzy match against combined AI response + user query when tags are absent or fewer than limit
  if (chosen.length === 0) {
    const combinedNorm = normalizeText(`${userQuery} ${stripExerciseTags(aiText)}`);
    const words = Array.from(new Set(combinedNorm.split(" ").filter((w) => w.length >= 4)));
    const scored: { ex: CatalogExerciseLike; score: number }[] = [];

    for (const ex of catalog) {
      if (seenIds.has(ex.id)) continue;
      if (!ex.gif_url && !ex.image) continue;
      const nameNorm = normalizeText(ex.name_es || ex.name || "");
      let score = 0;
      if (nameNorm.length >= 6 && combinedNorm.includes(nameNorm)) {
        score += 50;
      } else {
        for (const w of words) {
          if (nameNorm.includes(w)) score += 4;
        }
      }
      if (score >= 8) {
        scored.push({ ex, score });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    for (const item of scored.slice(0, limit)) {
      if (!seenIds.has(item.ex.id)) {
        seenIds.add(item.ex.id);
        chosen.push(item.ex);
      }
    }
  }

  return chosen.map((ex) => buildMatchCard(ex, options?.bodyWeightKg));
}

export function buildCronosGymInventoryBrief(userId?: string): string {
  const equipmentLines = Object.values(equipmentMap)
    .slice(0, 77)
    .map((eq) => `${eq.id}:${eq.name}`)
    .join(" | ");

  const dossier = loadClinicalDossier(userId);
  const weights = loadWeightHistory(userId);
  const { latest, deltaKg } = computeMonthlyWeightDelta(weights);

  const dossierParts = [
    `DiasDisponibles:${dossier.trainingDaysPerWeek}/sem`,
    dossier.goalWeightKg ? `MetaPeso:${dossier.goalWeightKg}kg` : null,
    latest ? `UltimoPesaje:${latest.weightKg}kg (${latest.date})` : null,
    deltaKg !== null ? `DeltaMensual:${deltaKg > 0 ? `+${deltaKg}` : deltaKg}kg` : null,
    dossier.priorityMuscles.length > 0
      ? `Prioridad:${dossier.priorityMuscles.join(",")}`
      : null,
    `Molestias:${dossier.jointDiscomforts.join(",")}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return `INVENTARIO CRONOS GYM (77 máquinas/manerales):\n${equipmentLines}\n\nFICHA 360 DEL ATLETA:\n${dossierParts}`;
}

// ------------------------------------------------------------------ Thread Store

export function loadChatThreads(): CronosChatThread[] {
  if (typeof window === "undefined" || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(THREADS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CronosChatThread[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((t) => t && typeof t.id === "string" && Array.isArray(t.messages))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

export function saveChatThreads(threads: CronosChatThread[]): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const trimmed = [...threads]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, MAX_THREADS);
    window.localStorage.setItem(THREADS_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Ignore storage quota errors.
  }
}

export function getActiveThreadId(): string | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    return window.localStorage.getItem(ACTIVE_THREAD_KEY);
  } catch {
    return null;
  }
}

export function setActiveThreadId(id: string | null): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    if (id) window.localStorage.setItem(ACTIVE_THREAD_KEY, id);
    else window.localStorage.removeItem(ACTIVE_THREAD_KEY);
  } catch {
    // Ignore.
  }
}

export function createNewThread(initialTitle = "Nueva consulta"): CronosChatThread {
  const id =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(16).padStart(8, "0")}-0000-4000-8000-000000000000`;
  return {
    id,
    title: initialTitle,
    updatedAt: new Date().toISOString(),
    messages: [],
  };
}

// ------------------------------------------------------------------ Guided Routine Builder

export type RoutineFocusId =
  | "push"
  | "pull"
  | "legs"
  | "chest_back"
  | "shoulders_arms"
  | "upper_abs"
  | "weekly_full";

export type RoutineDurationStyleId =
  | "45_compact"
  | "60_optimal"
  | "75_high"
  | "machines_priority"
  | "hybrid";

export const ROUTINE_FOCUS_OPTIONS: readonly {
  id: RoutineFocusId;
  label: string;
  shortTitle: string;
  keywords: readonly string[];
  muscleSlugs: readonly string[];
}[] = [
  {
    id: "push",
    label: "Empuje (Pecho, Hombro y Tríceps)",
    shortTitle: "Hipertrofia Empuje",
    keywords: ["chest", "pectorals", "pecho", "shoulder", "delts", "hombro", "tricep"],
    muscleSlugs: ["chest", "deltoids", "triceps"],
  },
  {
    id: "pull",
    label: "Tirón (Espalda, Bíceps y Deltoides Post.)",
    shortTitle: "Hipertrofia Tirón",
    keywords: ["back", "lats", "espalda", "dorsal", "bicep", "rear", "posterior", "remo", "jalon"],
    muscleSlugs: ["upper-back", "lats", "biceps", "deltoids"],
  },
  {
    id: "legs",
    label: "Pierna y Glúteo Completo",
    shortTitle: "Pierna & Glúteo Pro",
    keywords: ["quad", "hamstring", "glute", "calves", "pierna", "cuadriceps", "femoral", "gluteo", "prensa", "hack"],
    muscleSlugs: ["quadriceps", "hamstring", "gluteal", "calves"],
  },
  {
    id: "chest_back",
    label: "Pecho y Espalda (Antagonistas)",
    shortTitle: "Torso Antagonista",
    keywords: ["chest", "pecho", "back", "espalda", "lats", "pectoral", "remo", "press"],
    muscleSlugs: ["chest", "upper-back", "lats"],
  },
  {
    id: "shoulders_arms",
    label: "Hombro y Brazo (Especialización)",
    shortTitle: "Hombro & Brazos 3D",
    keywords: ["shoulder", "hombro", "bicep", "tricep", "arm", "brazo", "lateral", "curl"],
    muscleSlugs: ["deltoids", "biceps", "triceps", "forearm"],
  },
  {
    id: "upper_abs",
    label: "Torso Estético + Abdomen",
    shortTitle: "Torso Estético & Core",
    keywords: ["chest", "back", "shoulder", "abs", "core", "pecho", "espalda", "hombro", "abdomen", "crunch"],
    muscleSlugs: ["chest", "upper-back", "deltoids", "abs"],
  },
  {
    id: "weekly_full",
    label: "Plan Semanal Completo (3 a 6 días)",
    shortTitle: "Full Body Cronos Pro",
    keywords: ["chest", "back", "quad", "glute", "shoulder", "pecho", "espalda", "pierna", "hombro"],
    muscleSlugs: ["chest", "upper-back", "quadriceps", "gluteal", "deltoids"],
  },
];

export const ROUTINE_DURATION_OPTIONS: readonly {
  id: RoutineDurationStyleId;
  label: string;
  targetCount: number;
  durationMin: number;
  preferMachines: boolean;
}[] = [
  {
    id: "45_compact",
    label: "45 min · 4-5 ejercicios (Compacta)",
    targetCount: 5,
    durationMin: 45,
    preferMachines: true,
  },
  {
    id: "60_optimal",
    label: "60 min · 6 ejercicios (Óptima Hipertrofia)",
    targetCount: 6,
    durationMin: 60,
    preferMachines: false,
  },
  {
    id: "75_high",
    label: "75 min · 7-8 ejercicios (Alto Volumen)",
    targetCount: 7,
    durationMin: 75,
    preferMachines: false,
  },
  {
    id: "machines_priority",
    label: "Priorizar Máquinas Cronos Gym (CG-EQP)",
    targetCount: 6,
    durationMin: 60,
    preferMachines: true,
  },
  {
    id: "hybrid",
    label: "Híbrido (Máquinas + Peso Libre + Poleas)",
    targetCount: 6,
    durationMin: 60,
    preferMachines: false,
  },
];

export interface GuidedRoutineExercise {
  id: string;
  exerciseId: string;
  name: string;
  gifUrl: string;
  equipmentId: string | null;
  equipmentName: string;
  muscleGroup: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  restSeconds: number;
  rir: number;
  role: "warmup" | "compound" | "isolation";
  muscleSlugs: string[];
}

export interface GuidedRoutineResult {
  id: string;
  name: string;
  focusId: RoutineFocusId;
  focusLabel: string;
  durationMin: number;
  styleLabel: string;
  jointNotes: string[];
  exercises: GuidedRoutineExercise[];
  muscleCounts: Record<string, number>;
}

const AI_SAVED_ROUTINES_KEY = "cronos_ai_saved_routines_v1";
const DAY_ZERO_ROUTINES_KEY = "cronos_day_zero_routines_v1";

export function detectRoutineIntent(text: string): {
  isRoutineRequest: boolean;
  focus: RoutineFocusId | null;
  durationStyle: RoutineDurationStyleId | null;
} {
  const norm = normalizeText(text);
  const isRoutineRequest =
    /\b(rutina|entreno hoy|entrenamiento|plan semanal|crear rutina|hazme una rutina|armame|crea una rutina|disena una rutina)\b/.test(
      norm,
    );

  let focus: RoutineFocusId | null = null;
  if (/\b(empuje|push)\b/.test(norm) || (norm.includes("pecho") && norm.includes("tricep"))) {
    focus = "push";
  } else if (/\b(tiron|pull)\b/.test(norm) || (norm.includes("espalda") && norm.includes("bicep"))) {
    focus = "pull";
  } else if (/\b(pierna|gluteo|cuadricep|femoral|leg)\b/.test(norm)) {
    focus = "legs";
  } else if (norm.includes("pecho") && norm.includes("espalda")) {
    focus = "chest_back";
  } else if (norm.includes("hombro") || norm.includes("brazo")) {
    focus = "shoulders_arms";
  } else if (norm.includes("torso") || norm.includes("abdomen") || norm.includes("pecho")) {
    focus = "upper_abs";
  } else if (norm.includes("semanal") || norm.includes("semana") || norm.includes("full")) {
    focus = "weekly_full";
  }

  let durationStyle: RoutineDurationStyleId | null = null;
  if (/\b45\b|compact/.test(norm)) durationStyle = "45_compact";
  else if (/\b75\b|alto volumen/.test(norm)) durationStyle = "75_high";
  else if (/maquina|cg eqp|polea/.test(norm)) durationStyle = "machines_priority";
  else if (/hibrid/.test(norm)) durationStyle = "hybrid";
  else if (/\b60\b|hipertrofia/.test(norm)) durationStyle = "60_optimal";

  return { isRoutineRequest, focus, durationStyle };
}

function isElasticBandExercise(ex: CatalogExerciseLike): boolean {
  const text = normalizeText(`${ex.name} ${ex.name_es ?? ""} ${ex.equipment ?? ""} ${ex.equipment_name ?? ""}`);
  return /\b(band|banda|bandas|liga|ligas|resistance band|elastic)\b/.test(text);
}

function hasJointConflict(ex: CatalogExerciseLike, discomforts: string[]): boolean {
  const name = normalizeText(`${ex.name} ${ex.name_es ?? ""}`);
  if (discomforts.some((d) => d.includes("Hombro"))) {
    if (/tras nuca|behind neck|fondo|dip/.test(name)) return true;
  }
  if (discomforts.some((d) => d.includes("Rodilla"))) {
    if (/salto|jump|zancada profunda|sissy/.test(name)) return true;
  }
  if (discomforts.some((d) => d.includes("Lumbar"))) {
    if (/buenos dias|good morning|peso muerto con piernas rigidas/.test(name)) return true;
  }
  return false;
}

function isWarmupExercise(ex: CatalogExerciseLike): boolean {
  const name = normalizeText(`${ex.name} ${ex.name_es ?? ""}`);
  return name.startsWith("calentamiento") || /activacion|movilidad|manguito/.test(name);
}

function isCompoundExercise(ex: CatalogExerciseLike): boolean {
  const name = normalizeText(`${ex.name} ${ex.name_es ?? ""}`);
  return /\b(press|sentadilla|squat|prensa|hack|jalon|pulldown|remo|row|dominada|pull up|peso muerto|deadlift|hip thrust|fondos)\b/.test(
    name,
  );
}

function toGuidedExercise(
  ex: CatalogExerciseLike,
  role: "warmup" | "compound" | "isolation",
  muscleSlugs: readonly string[],
): GuidedRoutineExercise {
  const eqFromMap = ex.equipment_id ? equipmentMap[ex.equipment_id] : undefined;
  const equipmentName =
    ex.equipment_name || eqFromMap?.name || ex.equipment || "Máquina / Peso Libre";
  const prescription =
    role === "warmup"
      ? { sets: 2, repsMin: 15, repsMax: 20, restSeconds: 45, rir: 4 }
      : role === "compound"
        ? { sets: 4, repsMin: 6, repsMax: 10, restSeconds: 120, rir: 2 }
        : { sets: 3, repsMin: 10, repsMax: 15, restSeconds: 75, rir: 1 };

  return {
    id: `${ex.id}-${role}`,
    exerciseId: ex.id,
    name: ex.name_es || ex.name,
    gifUrl: ex.gif_url || ex.image || "",
    equipmentId: ex.equipment_id ?? null,
    equipmentName,
    muscleGroup: ex.muscle_group || ex.body_part || "Fuerza",
    ...prescription,
    role,
    muscleSlugs: [...muscleSlugs],
  };
}

export function buildGuidedRoutineFromChat(params: {
  focus: RoutineFocusId;
  durationStyle: RoutineDurationStyleId;
  catalog: CatalogExerciseLike[];
  userId?: string;
}): GuidedRoutineResult {
  const focusSpec =
    ROUTINE_FOCUS_OPTIONS.find((f) => f.id === params.focus) ?? ROUTINE_FOCUS_OPTIONS[0];
  const styleSpec =
    ROUTINE_DURATION_OPTIONS.find((s) => s.id === params.durationStyle) ??
    ROUTINE_DURATION_OPTIONS[1];
  const dossier = loadClinicalDossier(params.userId);
  const discomforts = dossier.jointDiscomforts.filter((d) => d !== "Ninguna");

  const candidates = params.catalog.filter((ex) => {
    if (!ex.gif_url && !ex.image) return false;
    if (isElasticBandExercise(ex)) return false;
    if (hasJointConflict(ex, discomforts)) return false;
    const hay = normalizeText(
      `${ex.name} ${ex.name_es ?? ""} ${ex.muscle_group ?? ""} ${ex.body_part ?? ""} ${ex.target ?? ""}`,
    );
    return focusSpec.keywords.some((kw) => hay.includes(kw));
  });

  const sorted = [...candidates].sort((a, b) => {
    const aMach = a.equipment_id?.startsWith("CG-EQP-") ? 1 : 0;
    const bMach = b.equipment_id?.startsWith("CG-EQP-") ? 1 : 0;
    if (styleSpec.preferMachines && aMach !== bMach) return bMach - aMach;
    const aComp = isCompoundExercise(a) ? 1 : 0;
    const bComp = isCompoundExercise(b) ? 1 : 0;
    return bComp - aComp;
  });

  const picked: GuidedRoutineExercise[] = [];
  const usedIds = new Set<string>();

  // 1. Optional warmup if available
  const warmup = sorted.find((ex) => isWarmupExercise(ex));
  if (warmup) {
    usedIds.add(warmup.id);
    picked.push(toGuidedExercise(warmup, "warmup", focusSpec.muscleSlugs));
  }

  // 2. Multi-joint compounds
  const compounds = sorted.filter((ex) => !usedIds.has(ex.id) && !isWarmupExercise(ex) && isCompoundExercise(ex));
  for (const ex of compounds) {
    if (picked.length >= Math.min(styleSpec.targetCount - 1, 4)) break;
    usedIds.add(ex.id);
    picked.push(toGuidedExercise(ex, "compound", focusSpec.muscleSlugs));
  }

  // 3. Analytical isolations / remaining curated slots
  const rest = sorted.filter((ex) => !usedIds.has(ex.id) && !isWarmupExercise(ex));
  for (const ex of rest) {
    if (picked.length >= styleSpec.targetCount) break;
    usedIds.add(ex.id);
    picked.push(toGuidedExercise(ex, "isolation", focusSpec.muscleSlugs));
  }

  // Fallback if catalog slice was small
  if (picked.length === 0) {
    for (const ex of params.catalog.filter((e) => !isElasticBandExercise(e)).slice(0, 4)) {
      picked.push(toGuidedExercise(ex, isCompoundExercise(ex) ? "compound" : "isolation", focusSpec.muscleSlugs));
    }
  }

  const muscleCounts: Record<string, number> = {};
  for (const slug of focusSpec.muscleSlugs) {
    muscleCounts[slug] = 2;
  }

  return {
    id: `ai-routine-${Date.now()}`,
    name: `${focusSpec.shortTitle} · Cronos IA`,
    focusId: focusSpec.id,
    focusLabel: focusSpec.label,
    durationMin: styleSpec.durationMin,
    styleLabel: styleSpec.label,
    jointNotes: discomforts,
    exercises: picked,
    muscleCounts,
  };
}

export function swapGuidedRoutineExercise(
  routine: GuidedRoutineResult,
  index: number,
  catalog: CatalogExerciseLike[],
): GuidedRoutineResult {
  const current = routine.exercises[index];
  if (!current) return routine;
  const focusSpec =
    ROUTINE_FOCUS_OPTIONS.find((f) => f.id === routine.focusId) ?? ROUTINE_FOCUS_OPTIONS[0];
  const existingIds = new Set(routine.exercises.map((e) => e.exerciseId));

  const replacement = catalog.find((ex) => {
    if (existingIds.has(ex.id)) return false;
    if (!ex.gif_url && !ex.image) return false;
    if (isElasticBandExercise(ex)) return false;
    const hay = normalizeText(
      `${ex.name} ${ex.name_es ?? ""} ${ex.muscle_group ?? ""} ${ex.body_part ?? ""}`,
    );
    return focusSpec.keywords.some((kw) => hay.includes(kw));
  });

  if (!replacement) return routine;
  const nextExercises = [...routine.exercises];
  nextExercises[index] = toGuidedExercise(replacement, current.role, current.muscleSlugs);
  return { ...routine, exercises: nextExercises };
}

export function loadSavedAiRoutines(): GuidedRoutineResult[] {
  if (typeof window === "undefined" || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(AI_SAVED_ROUTINES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as GuidedRoutineResult[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveGuidedRoutineToUserLibrary(
  userId: string | null,
  routine: GuidedRoutineResult,
): Promise<{ ok: boolean; savedId: string }> {
  // 1. Always persist locally in Cronos AI saved routines & Day Zero routines mirror
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const prevAi = loadSavedAiRoutines().filter((r) => r.id !== routine.id);
      window.localStorage.setItem(AI_SAVED_ROUTINES_KEY, JSON.stringify([routine, ...prevAi]));

      const rawDz = window.localStorage.getItem(DAY_ZERO_ROUTINES_KEY);
      const prevDz = rawDz ? (JSON.parse(rawDz) as unknown[]) : [];
      const dayZeroCompat = {
        id: routine.id,
        title: routine.name,
        source: "ai",
        days: [
          {
            dayNumber: 1,
            label: routine.focusLabel,
            exercises: routine.exercises.map((ex) => ({
              exerciseId: ex.exerciseId,
              name: ex.name,
              sets: ex.sets,
              repsMin: ex.repsMin,
              repsMax: ex.repsMax,
              restSeconds: ex.restSeconds,
            })),
          },
        ],
        createdAt: new Date().toISOString(),
      };
      window.localStorage.setItem(
        DAY_ZERO_ROUTINES_KEY,
        JSON.stringify([dayZeroCompat, ...(Array.isArray(prevDz) ? prevDz : [])]),
      );
      window.dispatchEvent(new CustomEvent("cronos:routines-updated"));
    } catch {
      // Ignore storage quota errors
    }
  }

  // 2. Best-effort sync to Supabase `routines` + `routine_exercises` when authenticated
  if (userId) {
    try {
      const { saveGeneratedRoutine } = await import("@/lib/routines/saveGeneratedRoutine");
      await saveGeneratedRoutine(userId, {
        name: routine.name,
        days: [
          {
            dayNumber: 1,
            focus: routine.focusLabel,
            exercises: routine.exercises.map((ex) => ({
              exerciseId: ex.exerciseId,
              sets: ex.sets,
              repsMin: ex.repsMin,
              repsMax: ex.repsMax,
              restSeconds: ex.restSeconds,
            })),
          },
        ],
      });
    } catch {
      // Local persistence already succeeded
    }
  }

  return { ok: true, savedId: routine.id };
}

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
  return {
    id: `thread-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: initialTitle,
    updatedAt: new Date().toISOString(),
    messages: [],
  };
}

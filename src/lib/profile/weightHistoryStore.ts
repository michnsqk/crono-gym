/**
 * weightHistoryStore.ts — Local persistent monthly bodyweight log & athlete 360°
 * clinical dossier (goal weight, training days, priority muscles, joint discomforts).
 *
 * Synced cleanly across `/perfil`, `Cronos Intelligence`, and `/coach -> Expedientes`.
 */

export interface WeightHistoryEntry {
  id: string;
  /** YYYY-MM */
  monthKey: string;
  /** YYYY-MM-DD */
  date: string;
  weightKg: number;
  note?: string;
}

export interface AthleteClinicalDossier {
  goalWeightKg: number | null;
  trainingDaysPerWeek: number;
  priorityMuscles: string[];
  jointDiscomforts: string[];
  updatedAt: string;
}

export const JOINT_DISCOMFORT_OPTIONS = [
  "Ninguna",
  "Hombro / Manguito",
  "Rodilla",
  "Lumbar",
  "Codo / Muñeca",
] as const;

export const PRIORITY_MUSCLE_OPTIONS = [
  "Pecho",
  "Espalda",
  "Pierna",
  "Glúteo",
  "Hombros",
  "Brazos",
  "Core",
] as const;

const WEIGHT_HISTORY_KEY = "cronos_weight_history_v1";
const CLINICAL_DOSSIER_KEY = "cronos_athlete_clinical_dossier_v1";

function storageKey(base: string, userId?: string): string {
  return userId && userId.trim().length > 0 ? `${base}:${userId}` : base;
}

function safeReadJson<T>(key: string): T | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function safeWriteJson(key: string, value: unknown): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore quota / private-browsing storage errors.
  }
}

export function normalizeDateIso(input?: string): string {
  if (input && /^\d{4}-\d{2}-\d{2}$/.test(input.trim())) {
    return input.trim();
  }
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function loadWeightHistory(userId?: string): WeightHistoryEntry[] {
  const key = storageKey(WEIGHT_HISTORY_KEY, userId);
  const parsed = safeReadJson<WeightHistoryEntry[]>(key)
    ?? (userId ? safeReadJson<WeightHistoryEntry[]>(WEIGHT_HISTORY_KEY) : null);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((e) => e && typeof e.weightKg === "number" && Number.isFinite(e.weightKg) && e.weightKg > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function saveWeightHistory(entries: WeightHistoryEntry[], userId?: string): void {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  safeWriteJson(storageKey(WEIGHT_HISTORY_KEY, userId), sorted);
  if (userId) {
    // Also mirror under default key so Coach / AI helpers without userId see the latest local snapshot.
    safeWriteJson(WEIGHT_HISTORY_KEY, sorted);
  }
}

export function recordWeightEntry(
  input: { weightKg: number; date?: string; note?: string },
  userId?: string,
): WeightHistoryEntry[] {
  const rounded = Math.round(input.weightKg * 10) / 10;
  if (!Number.isFinite(rounded) || rounded <= 0) {
    return loadWeightHistory(userId);
  }
  const date = normalizeDateIso(input.date);
  const monthKey = date.slice(0, 7);
  const existing = loadWeightHistory(userId);
  const entry: WeightHistoryEntry = {
    id: `wt-${date}-${Date.now()}`,
    monthKey,
    date,
    weightKg: rounded,
    note: input.note?.trim() || undefined,
  };
  const next = [...existing, entry];
  saveWeightHistory(next, userId);
  return next;
}

export function deleteWeightEntry(id: string, userId?: string): WeightHistoryEntry[] {
  const existing = loadWeightHistory(userId);
  const next = existing.filter((e) => e.id !== id);
  saveWeightHistory(next, userId);
  return next;
}

export function computeMonthlyWeightDelta(entries: WeightHistoryEntry[]): {
  latest: WeightHistoryEntry | null;
  previousMonth: WeightHistoryEntry | null;
  deltaKg: number | null;
} {
  if (entries.length === 0) {
    return { latest: null, previousMonth: null, deltaKg: null };
  }
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length - 1];
  const prevDifferentMonth = [...sorted]
    .reverse()
    .find((e) => e.monthKey !== latest.monthKey);
  const fallbackPrev = sorted.length >= 2 ? sorted[sorted.length - 2] : null;
  const previousMonth = prevDifferentMonth ?? fallbackPrev;
  const deltaKg = previousMonth
    ? Math.round((latest.weightKg - previousMonth.weightKg) * 10) / 10
    : null;
  return { latest, previousMonth, deltaKg };
}

const SHORT_MONTHS_ES = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

export function formatMonthLabelEs(monthKey: string): string {
  const parts = monthKey.split("-");
  if (parts.length < 2) return monthKey;
  const monthIndex = Number(parts[1]) - 1;
  return SHORT_MONTHS_ES[monthIndex] ?? monthKey;
}

export interface MonthlyChartPoint {
  monthKey: string;
  label: string;
  weightKg: number;
}

export function getMonthlyChartPoints(
  entries: WeightHistoryEntry[],
  maxMonths = 6,
): MonthlyChartPoint[] {
  if (entries.length === 0) return [];
  const byMonth = new Map<string, WeightHistoryEntry>();
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  for (const entry of sorted) {
    // Keep latest measurement within each month.
    byMonth.set(entry.monthKey, entry);
  }
  const monthly = Array.from(byMonth.values())
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
    .slice(-maxMonths);
  return monthly.map((e) => ({
    monthKey: e.monthKey,
    label: formatMonthLabelEs(e.monthKey),
    weightKg: e.weightKg,
  }));
}

export function defaultClinicalDossier(): AthleteClinicalDossier {
  return {
    goalWeightKg: null,
    trainingDaysPerWeek: 4,
    priorityMuscles: [],
    jointDiscomforts: ["Ninguna"],
    updatedAt: new Date().toISOString(),
  };
}

export function loadClinicalDossier(userId?: string): AthleteClinicalDossier {
  const key = storageKey(CLINICAL_DOSSIER_KEY, userId);
  const parsed = safeReadJson<Partial<AthleteClinicalDossier>>(key)
    ?? (userId ? safeReadJson<Partial<AthleteClinicalDossier>>(CLINICAL_DOSSIER_KEY) : null);
  const base = defaultClinicalDossier();
  if (!parsed || typeof parsed !== "object") return base;
  return {
    goalWeightKg:
      typeof parsed.goalWeightKg === "number" && Number.isFinite(parsed.goalWeightKg)
        ? parsed.goalWeightKg
        : null,
    trainingDaysPerWeek:
      typeof parsed.trainingDaysPerWeek === "number" &&
      parsed.trainingDaysPerWeek >= 2 &&
      parsed.trainingDaysPerWeek <= 6
        ? parsed.trainingDaysPerWeek
        : base.trainingDaysPerWeek,
    priorityMuscles: Array.isArray(parsed.priorityMuscles) ? parsed.priorityMuscles : [],
    jointDiscomforts:
      Array.isArray(parsed.jointDiscomforts) && parsed.jointDiscomforts.length > 0
        ? parsed.jointDiscomforts
        : ["Ninguna"],
    updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : base.updatedAt,
  };
}

export function saveClinicalDossier(dossier: AthleteClinicalDossier, userId?: string): void {
  const normalized: AthleteClinicalDossier = {
    ...dossier,
    updatedAt: new Date().toISOString(),
  };
  safeWriteJson(storageKey(CLINICAL_DOSSIER_KEY, userId), normalized);
  if (userId) {
    safeWriteJson(CLINICAL_DOSSIER_KEY, normalized);
  }
}

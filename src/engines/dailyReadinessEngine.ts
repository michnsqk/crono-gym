/**
 * dailyReadinessEngine.ts — Cronos Readiness Score (0–100%) & Today's Mission.
 *
 * Crosses 72h muscle recovery, weekly accumulated sets, and a 1-tap athlete
 * readiness check-in (Óptimo / Normal / Fatigado) to calibrate daily targets.
 */

export type ReadinessMood = "optimo" | "normal" | "fatigado";

export interface DailyReadinessInput {
  sessionsLast7Days: number;
  weeklyTargetDays: number;
  setsLast72h: number;
  mood: ReadinessMood;
}

export interface DailyReadinessResult {
  score: number; // 0..100
  label: "Óptimo" | "Listo" | "Moderado" | "Recuperación";
  volumeMultiplier: number; // e.g. 1.05, 1.0, 0.85
  guidance: string;
}

const MOOD_KEY = "cronos_daily_readiness_mood_v1";

export function loadTodayReadinessMood(): ReadinessMood {
  if (typeof window === "undefined") return "normal";
  try {
    const raw = window.localStorage.getItem(MOOD_KEY);
    if (!raw) return "normal";
    const parsed = JSON.parse(raw) as { date?: string; mood?: ReadinessMood };
    const today = new Date().toISOString().slice(0, 10);
    if (parsed.date === today && parsed.mood) return parsed.mood;
  } catch {
    // Fallback to normal
  }
  return "normal";
}

export function saveTodayReadinessMood(mood: ReadinessMood): void {
  if (typeof window === "undefined") return;
  try {
    const today = new Date().toISOString().slice(0, 10);
    window.localStorage.setItem(MOOD_KEY, JSON.stringify({ date: today, mood }));
  } catch {
    // Ignore storage errors
  }
}

export function computeDailyReadiness(input: DailyReadinessInput): DailyReadinessResult {
  const { sessionsLast7Days, weeklyTargetDays, setsLast72h, mood } = input;

  // Base 85, adjusted by recent 72h load and weekly frequency ratio
  let score = 86;
  if (setsLast72h > 45) score -= 18;
  else if (setsLast72h > 30) score -= 8;
  else if (setsLast72h < 12) score += 6;

  if (weeklyTargetDays > 0 && sessionsLast7Days > weeklyTargetDays) {
    score -= 6;
  }

  if (mood === "optimo") score += 10;
  else if (mood === "fatigado") score -= 20;

  score = Math.max(25, Math.min(100, Math.round(score)));

  if (score >= 85) {
    return {
      score,
      label: "Óptimo",
      volumeMultiplier: 1.0,
      guidance: "Recuperación completa. Día ideal para buscar nuevos récords.",
    };
  }
  if (score >= 68) {
    return {
      score,
      label: "Listo",
      volumeMultiplier: 1.0,
      guidance: "Carga equilibrada. Ejecuta tus series objetivo con RIR 1–2.",
    };
  }
  if (score >= 50) {
    return {
      score,
      label: "Moderado",
      volumeMultiplier: 0.9,
      guidance: "Fatiga acumulada moderada. Prioriza técnica y controla el descanso.",
    };
  }
  return {
    score,
    label: "Recuperación",
    volumeMultiplier: 0.8,
    guidance: "Fatiga alta en las últimas 72h. Sugerido reducir 1 serie por ejercicio.",
  };
}

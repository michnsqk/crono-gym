/**
 * hypertrophyAnalyticsEngine.ts — Stimulus Quality, 30-day e1RM Forecast & Body Symmetry Index.
 */

import { calculateEpley1RM } from "@/lib/engines/prCalculatorEngine";
import type { Exercise } from "@/types/supabase";

export interface AnalyticsSetInput {
  exerciseId: string;
  weightKg: number | null;
  reps: number | null;
  rpe: number | null;
  isWarmup: boolean;
  dateIso: string;
}

export interface E1rmForecastResult {
  exerciseId: string;
  exerciseName: string;
  currentBestE1rmKg: number;
  projected30dE1rmKg: number;
  weeklyGainKg: number;
}

export interface HypertrophyAnalyticsReport {
  totalWorkingSets: number;
  effectiveStimulusPercent: number; // % of working sets with RPE >= 7 (RIR 0-3)
  symmetryIndex: number; // 0..100%
  pushPullRatio: number;
  quadHamRatio: number;
  topForecasts: E1rmForecastResult[];
}

function classifyAntagonistGroup(ex: Exercise | undefined): "push" | "pull" | "quad" | "ham" | "other" {
  if (!ex) return "other";
  const body = (ex.body_part ?? "").toLowerCase();
  const target = (ex.target ?? "").toLowerCase();
  const name = (ex.name_es ?? ex.name ?? "").toLowerCase();

  if (body.includes("chest") || target.includes("pectoral") || name.includes("press")) {
    return "push";
  }
  if (body.includes("back") || target.includes("lats") || name.includes("remo") || name.includes("jalon")) {
    return "pull";
  }
  if (target.includes("quad") || name.includes("sentadilla") || name.includes("prensa") || name.includes("cuadriceps")) {
    return "quad";
  }
  if (target.includes("hamstring") || name.includes("femoral") || name.includes("rumano")) {
    return "ham";
  }
  return "other";
}

export function computeHypertrophyAnalytics(
  sets: readonly AnalyticsSetInput[],
  catalogMap: ReadonlyMap<string, Exercise>,
): HypertrophyAnalyticsReport {
  const working = sets.filter((s) => !s.isWarmup && (s.reps ?? 0) > 0);
  if (working.length === 0) {
    return {
      totalWorkingSets: 0,
      effectiveStimulusPercent: 0,
      symmetryIndex: 100,
      pushPullRatio: 1,
      quadHamRatio: 1,
      topForecasts: [],
    };
  }

  let effectiveCount = 0;
  let rpeCount = 0;
  let pushSets = 0;
  let pullSets = 0;
  let quadSets = 0;
  let hamSets = 0;

  const byExercise = new Map<string, Array<{ ts: number; e1rm: number }>>();

  for (const s of working) {
    if (s.rpe !== null) {
      rpeCount += 1;
      if (s.rpe >= 7) effectiveCount += 1;
    }

    const ex = catalogMap.get(s.exerciseId);
    const group = classifyAntagonistGroup(ex);
    if (group === "push") pushSets += 1;
    else if (group === "pull") pullSets += 1;
    else if (group === "quad") quadSets += 1;
    else if (group === "ham") hamSets += 1;

    if (s.weightKg && s.reps) {
      const e1rm = calculateEpley1RM(s.weightKg, s.reps);
      if (e1rm) {
        const list = byExercise.get(s.exerciseId) ?? [];
        list.push({ ts: new Date(s.dateIso).getTime(), e1rm });
        byExercise.set(s.exerciseId, list);
      }
    }
  }

  const effectiveStimulusPercent =
    rpeCount > 0 ? Math.round((effectiveCount / rpeCount) * 100) : 85;

  const pushPullRatio =
    pushSets + pullSets > 0 ? Number(((pushSets + 1) / (pullSets + 1)).toFixed(2)) : 1;
  const quadHamRatio =
    quadSets + hamSets > 0 ? Number(((quadSets + 1) / (hamSets + 1)).toFixed(2)) : 1;

  const pushPullDeviation = Math.min(1, Math.abs(1 - pushPullRatio));
  const quadHamDeviation = Math.min(1, Math.abs(1 - quadHamRatio));
  const symmetryIndex = Math.max(
    40,
    Math.round(100 - (pushPullDeviation * 28 + quadHamDeviation * 28)),
  );

  // 30-day linear projection on top 3 most-logged exercises
  const topForecasts: E1rmForecastResult[] = [];
  const sortedExercises = Array.from(byExercise.entries()).sort(
    (a, b) => b[1].length - a[1].length,
  );

  for (const [exerciseId, samples] of sortedExercises.slice(0, 3)) {
    const ordered = [...samples].sort((a, b) => a.ts - b.ts);
    const currentBest = Math.max(...ordered.map((x) => x.e1rm));
    const first = ordered[0].e1rm;
    const last = ordered[ordered.length - 1].e1rm;
    const weeksSpan = Math.max(
      1,
      (ordered[ordered.length - 1].ts - ordered[0].ts) / (1000 * 60 * 60 * 24 * 7),
    );
    const weeklyGain = Math.max(0, Math.min(2.5, (last - first) / weeksSpan));
    const projected30d = Number((currentBest + weeklyGain * 4.28).toFixed(1));
    const ex = catalogMap.get(exerciseId);

    topForecasts.push({
      exerciseId,
      exerciseName: ex?.name_es ?? ex?.name ?? exerciseId,
      currentBestE1rmKg: Number(currentBest.toFixed(1)),
      projected30dE1rmKg: projected30d,
      weeklyGainKg: Number(weeklyGain.toFixed(2)),
    });
  }

  return {
    totalWorkingSets: working.length,
    effectiveStimulusPercent,
    symmetryIndex,
    pushPullRatio,
    quadHamRatio,
    topForecasts,
  };
}

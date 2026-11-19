import { describe, expect, it } from "vitest";
import { buildRankMap, isMuscleClassified } from "./buildRankMap";
import type { ExerciseRow, SetRow } from "./muscleScore";
import { getNextRankProgress } from "./scoreToRank";
import {
  computeAscentGoal,
  computeSymmetryMetrics,
  estimatePercentile,
} from "./symmetry";

const NOW = new Date("2026-06-01T12:00:00.000Z");
const EXERCISES: ExerciseRow[] = [
  { id: "press", name: "Press de banca", target: "pectorals", body_part: "chest", equipment: "barbell" },
  { id: "row", name: "Remo con barra", target: "lats", body_part: "back", equipment: "barbell" },
  { id: "squat", name: "Sentadilla", target: "glutes", body_part: "upper legs", equipment: "barbell" },
];

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 86_400_000).toISOString();
}

function makeSets(exerciseId: string, weight: number, count = 8): SetRow[] {
  return Array.from({ length: count * 3 }, (_, i) => ({
    exerciseId,
    weight,
    reps: 5,
    isWarmup: false,
    performedAt: daysAgo(i * 3),
  }));
}

describe("Motor de Rangos v2 — Sub-tiers, Simetría y Simulador", () => {
  it("computes sub-tiers I, II, III for intermediate earned ranks", () => {
    const low = getNextRankProgress(47);
    const mid = getNextRankProgress(54);
    const high = getNextRankProgress(60);
    expect(low.subTier).toBe("I");
    expect(mid.subTier).toBe("II");
    expect(high.subTier).toBe("III");
    expect(low.displayLabel).toContain("Plata");
    expect(low.nextSubTierLabel).toContain("II");
    expect(getNextRankProgress(97).subTier).toBeNull();
  });

  it("computes dynamic percentile smoothly from globalScore", () => {
    expect(estimatePercentile(null)).toBeNull();
    const low = estimatePercentile(15)!;
    const high = estimatePercentile(75)!;
    expect(low).toBeGreaterThan(high);
    expect(high).toBeGreaterThanOrEqual(1);
    expect(low).toBeLessThanOrEqual(99);
  });

  it("computes biomechanical symmetry and a concrete 1-line insight", () => {
    const map = buildRankMap({
      sets: [...makeSets("press", 110, 10), ...makeSets("row", 45, 6), ...makeSets("squat", 120, 8)],
      exercises: EXERCISES,
      context: { bodyweightKg: 80, sex: "male", now: NOW },
    });
    const sym = computeSymmetryMetrics(map);
    expect(sym.symmetryIndex).not.toBeNull();
    expect(sym.pushPull.balancePercent).not.toBeNull();
    expect(sym.upperLower.balancePercent).not.toBeNull();
    expect(sym.insight.length).toBeGreaterThan(10);
  });

  it("computes an actionable ascent PR goal for a classified muscle", () => {
    const map = buildRankMap({
      sets: makeSets("press", 80, 6),
      exercises: EXERCISES,
      context: { bodyweightKg: 80, sex: "male", now: NOW },
    });
    const chest = map.muscles.get("chest")!;
    expect(isMuscleClassified(chest)).toBe(true);
    const goal = computeAscentGoal(chest, 80);
    expect(goal).not.toBeNull();
    expect(goal!.exerciseName).toBe("Press de banca");
    expect(goal!.summary).toContain("Press de banca");
  });
});

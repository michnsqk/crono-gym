/**
 * symmetry.ts — biomechanical symmetry index, dynamic percentile & ascent simulator.
 *
 * Pure functions over `RankMap` and `MuscleRank`. Zero DOM, zero network.
 */

import type { Slug } from "react-muscle-highlighter";
import { isMuscleClassified, type MuscleRank, type RankMap } from "./buildRankMap";
import { SCORE_WEIGHTS } from "./rankConfig";

const PUSH_SLUGS: readonly Slug[] = ["chest", "deltoids", "triceps"];
const PULL_SLUGS: readonly Slug[] = ["upper-back", "trapezius", "lower-back", "biceps", "forearm"];
const UPPER_SLUGS: readonly Slug[] = [
  "chest",
  "deltoids",
  "upper-back",
  "trapezius",
  "biceps",
  "triceps",
  "forearm",
];
const LOWER_SLUGS: readonly Slug[] = ["quadriceps", "hamstring", "gluteal", "calves", "adductors"];

export interface SymmetryAxis {
  leftLabel: string;
  rightLabel: string;
  leftScore: number | null;
  rightScore: number | null;
  /** 0-100% balance between both sides, or null when one side lacks classified data. */
  balancePercent: number | null;
}

export interface SymmetryMetrics {
  /** Overall biomechanical symmetry 0-100%, or null if fewer than 2 classified muscles. */
  symmetryIndex: number | null;
  pushPull: SymmetryAxis;
  upperLower: SymmetryAxis;
  /** Single-line concrete coaching insight based on real scores. */
  insight: string;
}

function meanClassifiedScore(map: RankMap, slugs: readonly Slug[]): number | null {
  const scores: number[] = [];
  for (const slug of slugs) {
    const entry = map.muscles.get(slug);
    if (entry && isMuscleClassified(entry)) {
      scores.push(entry.score);
    }
  }
  if (scores.length === 0) return null;
  return Math.round((scores.reduce((sum, s) => sum + s, 0) / scores.length) * 10) / 10;
}

function axisBalance(a: number | null, b: number | null): number | null {
  if (a === null || b === null) return null;
  const diff = Math.abs(a - b);
  return Math.max(0, Math.min(100, Math.round(100 - diff * 1.4)));
}

/**
 * Computes biomechanical balance (Empuje vs Tracción, Tren Superior vs Inferior)
 * and generates a 1-line actionable insight.
 */
export function computeSymmetryMetrics(map: RankMap): SymmetryMetrics {
  const pushScore = meanClassifiedScore(map, PUSH_SLUGS);
  const pullScore = meanClassifiedScore(map, PULL_SLUGS);
  const pushPullBalance = axisBalance(pushScore, pullScore);

  const upperScore = meanClassifiedScore(map, UPPER_SLUGS);
  const lowerScore = meanClassifiedScore(map, LOWER_SLUGS);
  const upperLowerBalance = axisBalance(upperScore, lowerScore);

  const balances = [pushPullBalance, upperLowerBalance].filter(
    (v): v is number => v !== null,
  );
  const symmetryIndex =
    balances.length === 0
      ? null
      : Math.round(balances.reduce((sum, v) => sum + v, 0) / balances.length);

  let insight = "Registra al menos 3 sesiones en varios grupos para medir tu balance.";
  if (map.classifiedCount >= 2) {
    if (pushScore !== null && pullScore !== null && Math.abs(pushScore - pullScore) >= 8) {
      const diff = Math.round(Math.abs(pushScore - pullScore));
      insight =
        pushScore > pullScore
          ? `Tu empuje supera a tu tracción por ${diff} pts; prioriza remo o jalón.`
          : `Tu tracción supera a tu empuje por ${diff} pts; refuerza press y deltoides.`;
    } else if (
      upperScore !== null &&
      lowerScore !== null &&
      Math.abs(upperScore - lowerScore) >= 8
    ) {
      const diff = Math.round(Math.abs(upperScore - lowerScore));
      insight =
        upperScore > lowerScore
          ? `El tren superior aventaja al inferior por ${diff} pts; suma trabajo de pierna.`
          : `El tren inferior lidera por ${diff} pts; equilibra con torso superior.`;
    } else if (upperScore !== null && lowerScore === null) {
      insight = "Faltan datos en tren inferior para evaluar tu simetría completa.";
    } else if (lowerScore !== null && upperScore === null) {
      insight = "Faltan datos en tren superior para evaluar tu simetría completa.";
    } else if (symmetryIndex !== null && symmetryIndex >= 85) {
      insight = `Desarrollo armónico (${symmetryIndex}% de simetría entre ejes).`;
    } else if (symmetryIndex !== null) {
      insight = `Balance general del ${symmetryIndex}%; prioriza tu grupo más rezagado.`;
    }
  }

  return {
    symmetryIndex,
    pushPull: {
      leftLabel: "Empuje",
      rightLabel: "Tracción",
      leftScore: pushScore,
      rightScore: pullScore,
      balancePercent: pushPullBalance,
    },
    upperLower: {
      leftLabel: "Tren superior",
      rightLabel: "Tren inferior",
      leftScore: upperScore,
      rightScore: lowerScore,
      balancePercent: upperLowerBalance,
    },
    insight,
  };
}

/**
 * Estimates Top-N% percentile from global score (0-100) using a smooth logistic
 * curve calibrated around intermediate gym averages (midpoint 38, scale 14).
 * Returns null when no muscles are classified.
 */
export function estimatePercentile(globalScore: number | null): number | null {
  if (globalScore === null || !Number.isFinite(globalScore)) return null;
  const z = (globalScore - 38) / 14;
  const cdf = 1 / (1 + Math.exp(-z));
  const topPercent = Math.round((1 - cdf) * 100);
  return Math.max(1, Math.min(99, topPercent));
}

export interface AscentGoal {
  targetLabel: string;
  pointsMissing: number;
  exerciseName: string;
  extraKg: number | null;
  extraReps: number | null;
  bestWeight: number | null;
  bestReps: number | null;
  summary: string;
}

/**
 * Computes a concrete 1-PR ascent recommendation ("+5 kg en Press de banca o +2 reps
 * con 80 kg → Oro III") from the muscle's primary contributing exercise.
 */
export function computeAscentGoal(
  entry: MuscleRank,
  bodyweightKg: number | null,
): AscentGoal | null {
  if (!isMuscleClassified(entry) || !entry.progress.nextSubTierLabel) return null;
  const targetLabel = entry.progress.nextSubTierLabel;
  const pointsMissing = entry.progress.pointsToNextSubTier;
  if (pointsMissing <= 0) return null;

  const primary =
    entry.detail.contributions.find((c) => c.counted && c.contributionWeight === 1) ??
    entry.detail.contributions.find((c) => c.counted) ??
    entry.detail.contributions[0];

  if (!primary || !bodyweightKg || bodyweightKg <= 0 || primary.estimatedOneRepMax <= 0) {
    return {
      targetLabel,
      pointsMissing,
      exerciseName: primary?.name ?? entry.label,
      extraKg: null,
      extraReps: null,
      bestWeight: null,
      bestReps: null,
      summary: `Suma ${pointsMissing} pts entre fuerza y constancia para alcanzar ${targetLabel}.`,
    };
  }

  // Inverse of strengthRatioToPercent: span = 2.1 - 0.4 = 1.7
  const neededStrengthGain = pointsMissing / SCORE_WEIGHTS.strength;
  const targetStrengthPercent = Math.min(100, primary.strengthPercent + neededStrengthGain);
  const span = 1.7;
  const targetRatio = primary.standardRatio * (0.4 + (targetStrengthPercent / 100) * span);
  const targetE1RM = Math.max(primary.estimatedOneRepMax + 1, targetRatio * bodyweightKg);

  const best = primary.bestSet;
  let extraKg: number | null = null;
  let extraReps: number | null = null;

  if (best && best.weight > 0 && best.reps > 0) {
    const neededWeight = targetE1RM / (1 + best.reps / 30);
    const rawDeltaKg = Math.max(2.5, neededWeight - best.weight);
    extraKg = Math.ceil(rawDeltaKg / 2.5) * 2.5;

    const neededReps = Math.ceil(((targetE1RM / best.weight - 1) * 30) - best.reps);
    if (neededReps >= 1 && neededReps <= 8) {
      extraReps = neededReps;
    }
  } else {
    extraKg = Math.max(2.5, Math.ceil((targetE1RM - primary.estimatedOneRepMax) / 2.5) * 2.5);
  }

  const parts: string[] = [];
  if (extraKg !== null) parts.push(`+${extraKg} kg en ${primary.name}`);
  if (extraReps !== null && best) {
    parts.push(`o +${extraReps} ${extraReps === 1 ? "rep" : "reps"} con ${best.weight} kg`);
  }

  const summary =
    parts.length > 0
      ? `${parts.join(" ")} → ${targetLabel}`
      : `Suma ${pointsMissing} pts en ${primary.name} → ${targetLabel}`;

  return {
    targetLabel,
    pointsMissing,
    exerciseName: primary.name,
    extraKg,
    extraReps,
    bestWeight: best?.weight ?? null,
    bestReps: best?.reps ?? null,
    summary,
  };
}

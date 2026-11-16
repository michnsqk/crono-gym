/**
 * progressiveOverloadEngine.ts — Progressive Overload Engine v3.0
 *
 * Implements athlete & coach intelligence:
 * 1. Double Progression (heavy barbell/press/smith compounds) vs.
 *    Triple Progression (cables, pin-loaded machines, isolation) vs.
 *    Calisthenics / Bodyweight progression (using athlete bodyweight from /perfil).
 * 2. Real-time Intra-Session Autoregulation (RIR & reps drift on Set 1 -> adjusts Sets 2 & 3).
 * 3. Plateau Breaker detector (3 consecutive sessions with flat e1RM/volume).
 * 4. Warmup Pyramid (50% x 8, 70% x 5, 85% x 2) + Visual Plate Breakdown per side.
 */

import { calculateEpley1RM } from "@/lib/engines/prCalculatorEngine";
import type { Exercise } from "@/types/supabase";

export type ProgressionProfile = "double" | "triple" | "calisthenics";

export interface SessionPerformanceSample {
  dateIso: string;
  weightKg: number;
  reps: number;
  rpe?: number | null;
  rir?: number | null;
}

export interface TargetRangeSpec {
  minReps: number;
  maxReps: number;
  targetRir: number;
}

export interface OverloadV3Recommendation {
  profile: ProgressionProfile;
  nextWeightKg: number;
  nextTargetReps: number;
  action: "increase_weight" | "increase_reps" | "consolidate_control" | "maintain";
  headline: string;
  rationale: string;
  bodyweightUsedKg?: number;
}

export interface IntraSessionDriftInput {
  setNumber: number;
  completedWeightKg: number;
  completedReps: number;
  reportedRir: number | null;
  target: TargetRangeSpec;
  isLowerBody: boolean;
}

export interface IntraSessionAdjustment {
  adjustedWeightKg: number;
  adjustedReps: number;
  deltaPercent: number;
  reason: string;
}

export interface PlateauStatus {
  isPlateaued: boolean;
  sessionsFlat: number;
  bestE1rmKg: number;
  suggestionType: "micro_deload" | "biomechanical_rotation" | "none";
  label: string;
  rotationCandidates: Exercise[];
}

export interface WarmupPyramidStep {
  label: string;
  percent: number;
  weightKg: number;
  reps: number;
}

export interface PlateSideBreakdown {
  barWeightKg: number;
  targetTotalKg: number;
  perSideKg: number;
  platesPerSide: Array<{ weightKg: number; count: number }>;
  remainderKg: number;
}

const STANDARD_PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25] as const;

export function classifyProgressionProfile(
  equipment?: string | null,
  equipmentId?: string | null,
  exerciseName?: string | null,
): ProgressionProfile {
  const eq = (equipment ?? "").toLowerCase();
  const name = (exerciseName ?? "").toLowerCase();
  if (
    eq.includes("body weight") ||
    eq.includes("peso corporal") ||
    name.includes("dominada") ||
    name.includes("pull-up") ||
    name.includes("pull up") ||
    name.includes("fondo") ||
    name.includes("dip")
  ) {
    return "calisthenics";
  }
  if (
    (equipmentId && equipmentId.startsWith("CG-EQP-")) ||
    eq.includes("cable") ||
    eq.includes("polea") ||
    eq.includes("machine") ||
    eq.includes("máquina") ||
    eq.includes("leverage")
  ) {
    return "triple";
  }
  return "double";
}

function roundToPlateStep(weightKg: number, step = 2.5): number {
  if (weightKg <= 0) return 0;
  return Math.round(weightKg / step) * step;
}

export function computeOverloadV3(params: {
  profile: ProgressionProfile;
  isLowerBody: boolean;
  athleteBodyweightKg?: number | null;
  lastSessionSets: SessionPerformanceSample[];
  target: TargetRangeSpec;
}): OverloadV3Recommendation {
  const { profile, isLowerBody, athleteBodyweightKg, lastSessionSets, target } = params;
  const working = lastSessionSets.filter((s) => s.weightKg >= 0 && s.reps > 0);
  if (working.length === 0) {
    return {
      profile,
      nextWeightKg: 0,
      nextTargetReps: target.minReps,
      action: "maintain",
      headline: `Objetivo inicial: ${target.minReps}–${target.maxReps} reps`,
      rationale: `Mantén RIR ${target.targetRir} para establecer tu línea base.`,
    };
  }

  const topWeight = Math.max(...working.map((s) => s.weightKg));
  const minRepsHit = Math.min(...working.map((s) => s.reps));
  const avgReps = working.reduce((sum, s) => sum + s.reps, 0) / working.length;
  const stepKg = isLowerBody ? 5 : 2.5;

  if (profile === "calisthenics") {
    const bw = athleteBodyweightKg ?? 75;
    if (minRepsHit >= target.maxReps) {
      return {
        profile,
        nextWeightKg: roundToPlateStep(topWeight + 2.5, 2.5),
        nextTargetReps: target.minReps,
        action: "increase_weight",
        headline: `+2.5 kg lastre · ${target.minReps} reps`,
        rationale: `Dominaste ${target.maxReps} reps con tu peso corporal (${bw} kg). Añade lastre o tempo 3-1-1.`,
        bodyweightUsedKg: bw,
      };
    }
    return {
      profile,
      nextWeightKg: topWeight,
      nextTargetReps: Math.min(target.maxReps, Math.round(avgReps) + 1),
      action: "increase_reps",
      headline: `Meta: ${Math.min(target.maxReps, Math.round(avgReps) + 1)} reps limpias`,
      rationale: `Calculado con tu peso corporal (${bw} kg). Consolida rango completo antes de lastrar.`,
      bodyweightUsedKg: bw,
    };
  }

  if (profile === "triple") {
    // Triple Progression: consolidate ceiling + 1-2 extra technical reps before jumping a pin/plate
    if (minRepsHit >= target.maxReps + 1) {
      const nextLoad = roundToPlateStep(topWeight + stepKg, 2.5);
      return {
        profile,
        nextWeightKg: nextLoad,
        nextTargetReps: target.minReps,
        action: "increase_weight",
        headline: `Subir placa a ${nextLoad} kg × ${target.minReps} reps`,
        rationale: "Consolidaste repeticiones extra con control técnico; listo para el salto de placa.",
      };
    }
    if (minRepsHit >= target.maxReps) {
      return {
        profile,
        nextWeightKg: topWeight,
        nextTargetReps: target.maxReps + 1,
        action: "consolidate_control",
        headline: `${topWeight} kg · +1–2 reps de control`,
        rationale: "Triple progresión: asegura 1–2 reps extra con pausa antes de subir placa.",
      };
    }
    return {
      profile,
      nextWeightKg: topWeight,
      nextTargetReps: Math.min(target.maxReps, Math.round(avgReps) + 1),
      action: "increase_reps",
      headline: `${topWeight} kg · busca ${Math.min(target.maxReps, Math.round(avgReps) + 1)} reps`,
      rationale: "Sube repeticiones gradualmente hasta dominar el tope del rango.",
    };
  }

  // Double Progression (heavy compounds)
  if (minRepsHit >= target.maxReps) {
    const nextLoad = roundToPlateStep(topWeight + stepKg, 2.5);
    return {
      profile,
      nextWeightKg: nextLoad,
      nextTargetReps: target.minReps,
      action: "increase_weight",
      headline: `${nextLoad} kg × ${target.minReps} reps (+${stepKg} kg)`,
      rationale: `Completaste todas las series en ${target.maxReps} reps; sube ${stepKg} kg y reinicia en ${target.minReps} reps.`,
    };
  }

  return {
    profile,
    nextWeightKg: topWeight,
    nextTargetReps: Math.min(target.maxReps, Math.round(avgReps) + 1),
    action: "increase_reps",
    headline: `${topWeight} kg · objetivo ${Math.min(target.maxReps, Math.round(avgReps) + 1)} reps`,
    rationale: `Doble progresión: mantén ${topWeight} kg hasta completar ${target.maxReps} reps en todas las series.`,
  };
}

/**
 * Real-time intra-session autoregulation after Set 1 (or early sets).
 */
export function evaluateIntraSessionDrift(
  input: IntraSessionDriftInput,
): IntraSessionAdjustment | null {
  const { completedWeightKg, completedReps, reportedRir, target, isLowerBody } = input;
  if (completedWeightKg <= 0 || completedReps <= 0) return null;

  const hitPrematureFailure = reportedRir !== null && reportedRir <= 0 && completedReps < target.maxReps;
  if (completedReps < target.minReps || hitPrematureFailure) {
    const adjusted = Math.max(2.5, roundToPlateStep(completedWeightKg * 0.935, 2.5));
    return {
      adjustedWeightKg: adjusted,
      adjustedReps: target.minReps,
      deltaPercent: -6.5,
      reason: "Ajuste de carga para mantener repeticiones efectivas",
    };
  }

  if (completedReps > target.maxReps && reportedRir !== null && reportedRir >= 3) {
    const step = isLowerBody ? 5 : 2.5;
    return {
      adjustedWeightKg: roundToPlateStep(completedWeightKg + step, 2.5),
      adjustedReps: target.minReps,
      deltaPercent: Number(((step / completedWeightKg) * 100).toFixed(1)),
      reason: `Micro-incremento (+${step} kg) por margen alto (RIR ${reportedRir})`,
    };
  }

  return null;
}

/**
 * Detects 3 consecutive sessions without e1RM or volume improvement.
 */
export function detectPlateauBreaker(
  historyBySession: Array<{
    dateIso: string;
    sets: Array<{ weightKg: number; reps: number }>;
  }>,
  currentExercise: Exercise | null,
  catalog: readonly Exercise[],
): PlateauStatus {
  if (historyBySession.length < 3) {
    return {
      isPlateaued: false,
      sessionsFlat: 0,
      bestE1rmKg: 0,
      suggestionType: "none",
      label: "",
      rotationCandidates: [],
    };
  }

  const ordered = [...historyBySession].sort(
    (a, b) => new Date(a.dateIso).getTime() - new Date(b.dateIso).getTime(),
  );
  const recent3 = ordered.slice(-3);

  const sessionMetrics = recent3.map((s) => {
    let best = 0;
    let vol = 0;
    for (const set of s.sets) {
      const e1rm = calculateEpley1RM(set.weightKg, set.reps) ?? 0;
      if (e1rm > best) best = e1rm;
      vol += set.weightKg * set.reps;
    }
    return { best, vol };
  });

  const [s1, s2, s3] = sessionMetrics;
  const flatE1rm = s2.best <= s1.best && s3.best <= s2.best;
  const flatVol = s2.vol <= s1.vol && s3.vol <= s2.vol;

  if (!flatE1rm || !flatVol || s1.best === 0) {
    return {
      isPlateaued: false,
      sessionsFlat: 0,
      bestE1rmKg: Math.max(s1.best, s2.best, s3.best),
      suggestionType: "none",
      label: "",
      rotationCandidates: [],
    };
  }

  const rotationCandidates = currentExercise
    ? catalog
        .filter(
          (ex) =>
            ex.id !== currentExercise.id &&
            ex.target === currentExercise.target &&
            !ex.is_hidden,
        )
        .slice(0, 3)
    : [];

  return {
    isPlateaued: true,
    sessionsFlat: 3,
    bestE1rmKg: Number(s3.best.toFixed(1)),
    suggestionType: rotationCandidates.length > 0 ? "biomechanical_rotation" : "micro_deload",
    label: "Estancamiento detectado (3 sesiones) · Sugerencia: Micro-descarga (-10%) o Rotación biomecánica",
    rotationCandidates,
  };
}

export function buildWarmupPyramid(workingWeightKg: number): WarmupPyramidStep[] {
  if (workingWeightKg <= 20) return [];
  return [
    {
      label: "Serie Aproximación 1",
      percent: 50,
      weightKg: Math.max(20, roundToPlateStep(workingWeightKg * 0.5, 2.5)),
      reps: 8,
    },
    {
      label: "Serie Aproximación 2",
      percent: 70,
      weightKg: Math.max(20, roundToPlateStep(workingWeightKg * 0.7, 2.5)),
      reps: 5,
    },
    {
      label: "Potenciación",
      percent: 85,
      weightKg: Math.max(20, roundToPlateStep(workingWeightKg * 0.85, 2.5)),
      reps: 2,
    },
  ];
}

export function computePlateBreakdown(
  targetTotalKg: number,
  barWeightKg = 20,
): PlateSideBreakdown {
  if (targetTotalKg <= barWeightKg) {
    return {
      barWeightKg,
      targetTotalKg,
      perSideKg: 0,
      platesPerSide: [],
      remainderKg: 0,
    };
  }

  let remainingPerSide = (targetTotalKg - barWeightKg) / 2;
  const platesPerSide: Array<{ weightKg: number; count: number }> = [];

  for (const plate of STANDARD_PLATES_KG) {
    if (remainingPerSide >= plate - 0.01) {
      const count = Math.floor((remainingPerSide + 0.01) / plate);
      if (count > 0) {
        platesPerSide.push({ weightKg: plate, count });
        remainingPerSide = Math.max(0, remainingPerSide - count * plate);
      }
    }
  }

  return {
    barWeightKg,
    targetTotalKg,
    perSideKg: Number(((targetTotalKg - barWeightKg) / 2).toFixed(2)),
    platesPerSide,
    remainderKg: Number((remainingPerSide * 2).toFixed(2)),
  };
}

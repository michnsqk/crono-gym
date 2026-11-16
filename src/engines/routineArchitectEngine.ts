/**
 * routineArchitectEngine.ts — Live Biomechanical Auditor & Routine Templates.
 *
 * Evaluates routines in real time:
 * - Effective Volume per Muscle (MEV / MAV / MRV thresholds)
 * - Estimated Floor Time in minutes (warmup + working sets + rest)
 * - 1-tap Biomechanical Order Optimizer (high-CNS compounds -> secondary -> isolation/core)
 * - 1-tap starter templates (Push/Pull/Legs, Upper/Lower, Full Body, Glúteo/Pierna)
 */

import type { Exercise } from "@/types/supabase";

export interface RoutineExerciseDraftItem {
  exerciseId: string;
  sets: number;
  restSeconds?: number;
}

export interface MuscleVolumeAudit {
  muscle: string;
  sets: number;
  zone: "MEV" | "MAV" | "MRV_WARNING";
}

export interface RoutineAuditReport {
  totalSets: number;
  estimatedMinutes: number;
  muscleBreakdown: MuscleVolumeAudit[];
  junkVolumeWarnings: string[];
}

export type RoutineTemplateId = "ppl" | "upper_lower" | "full_body" | "glute_legs";

export interface RoutineTemplatePreset {
  id: RoutineTemplateId;
  title: string;
  subtitle: string;
  dayLabels: string[];
  keywordsByDay: string[][];
}

export const ROUTINE_TEMPLATE_PRESETS: readonly RoutineTemplatePreset[] = [
  {
    id: "ppl",
    title: "Push / Pull / Legs",
    subtitle: "3 días · Empuje, Tirón y Pierna",
    dayLabels: ["Empuje", "Tirón", "Pierna"],
    keywordsByDay: [
      ["press de banca", "press inclinado", "elevaciones laterales", "fondos"],
      ["jalon al pecho", "remo sentado", "curl de biceps", "face pull"],
      ["sentadilla", "prensa", "curl femoral", "extension de cuadriceps"],
    ],
  },
  {
    id: "upper_lower",
    title: "Upper / Lower",
    subtitle: "4 días · Torso y Pierna",
    dayLabels: ["Torso A", "Pierna A", "Torso B", "Pierna B"],
    keywordsByDay: [
      ["press de banca", "remo", "press militar", "jalon"],
      ["sentadilla", "peso muerto rumano", "extension de cuadriceps", "gemelos"],
      ["press inclinado", "dominadas", "elevaciones laterales", "curl"],
      ["prensa", "hip thrust", "curl femoral", "zancadas"],
    ],
  },
  {
    id: "full_body",
    title: "Full Body",
    subtitle: "3 días · Cuerpo completo eficiente",
    dayLabels: ["Full Body A", "Full Body B", "Full Body C"],
    keywordsByDay: [
      ["sentadilla", "press de banca", "remo", "crunch"],
      ["peso muerto", "press inclinado", "jalon", "elevaciones laterales"],
      ["prensa", "press militar", "curl femoral", "curl de biceps"],
    ],
  },
  {
    id: "glute_legs",
    title: "Glúteo / Pierna",
    subtitle: "Enfoque tren inferior y simetría",
    dayLabels: ["Glúteo & Posterior", "Cuádriceps & Global"],
    keywordsByDay: [
      ["hip thrust", "peso muerto rumano", "patada de gluteo", "abductores"],
      ["sentadilla", "prensa", "extension de cuadriceps", "zancadas"],
    ],
  },
];

function cnsPriorityRank(ex: Exercise): number {
  const eq = (ex.equipment ?? "").toLowerCase();
  const name = (ex.name_es ?? ex.name ?? "").toLowerCase();
  const target = (ex.target ?? "").toLowerCase();

  if (target.includes("abs") || name.includes("crunch") || name.includes("plancha")) {
    return 4; // Core / finishers last
  }
  if (
    name.includes("sentadilla") ||
    name.includes("squat") ||
    name.includes("peso muerto") ||
    name.includes("deadlift") ||
    name.includes("press de banca") ||
    name.includes("bench press") ||
    name.includes("prensa")
  ) {
    return 1; // Primary high-CNS compounds first
  }
  if (eq.includes("barbell") || eq.includes("barra") || eq.includes("dumbbell") || eq.includes("mancuerna")) {
    return 2; // Secondary free-weight compounds
  }
  return 3; // Machines, cables & isolations
}

/**
 * Optimizes exercise order biomechanically: high-CNS multi-joint -> secondary -> isolations/core.
 */
export function optimizeBiomechanicalOrder<T extends { exerciseId: string }>(
  items: readonly T[],
  catalogMap: ReadonlyMap<string, Exercise>,
): T[] {
  return [...items].sort((a, b) => {
    const exA = catalogMap.get(a.exerciseId);
    const exB = catalogMap.get(b.exerciseId);
    const rankA = exA ? cnsPriorityRank(exA) : 3;
    const rankB = exB ? cnsPriorityRank(exB) : 3;
    return rankA - rankB;
  });
}

/**
 * Audits effective muscle volume (MEV/MAV/MRV) and floor duration in real time.
 */
export function auditRoutineSession(
  items: readonly RoutineExerciseDraftItem[],
  catalogMap: ReadonlyMap<string, Exercise>,
): RoutineAuditReport {
  let totalSets = 0;
  let totalSeconds = items.length > 0 ? 360 : 0; // 6 min general + ramp warmup
  const setsByMuscle = new Map<string, number>();

  for (const item of items) {
    const sets = Math.max(1, item.sets);
    const rest = item.restSeconds ?? 90;
    totalSets += sets;
    // ~45s execution per set + rest between sets
    totalSeconds += sets * 45 + Math.max(0, sets - 1) * rest + 60;

    const ex = catalogMap.get(item.exerciseId);
    const muscle = ex?.target ?? ex?.body_part ?? "General";
    setsByMuscle.set(muscle, (setsByMuscle.get(muscle) ?? 0) + sets);
  }

  const muscleBreakdown: MuscleVolumeAudit[] = [];
  const junkVolumeWarnings: string[] = [];

  for (const [muscle, sets] of setsByMuscle.entries()) {
    let zone: MuscleVolumeAudit["zone"] = "MAV";
    if (sets < 4) zone = "MEV";
    else if (sets > 10) {
      zone = "MRV_WARNING";
      junkVolumeWarnings.push(
        `Posible volumen basura en ${muscle} (${sets} series en una sola sesión).`,
      );
    }
    muscleBreakdown.push({ muscle, sets, zone });
  }

  return {
    totalSets,
    estimatedMinutes: Math.max(0, Math.round(totalSeconds / 60)),
    muscleBreakdown: muscleBreakdown.sort((a, b) => b.sets - a.sets),
    junkVolumeWarnings,
  };
}

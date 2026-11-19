import { supabase } from "@lib/supabase";
import type { RoutineWithExercises } from "@/hooks/useGymData";
import {
  draftFromRoutine,
  newDraftKey,
  type RoutineDayKind,
  type RoutineDraftV2,
} from "@/lib/routines/routineDayModel";
import { flushSave, saveRoutine, type SaveResult } from "@/lib/routines/saveRoutine";
import type { Json } from "@/types/supabase";

export interface SharedRoutineExerciseSnapshot {
  exerciseId: string;
  name: string;
  nameEs: string | null;
  bodyPart: string;
  target: string;
  equipment: string;
  gifUrl: string;
  targetSets: number;
  restSeconds: number;
  orderIndex: number;
  targetRepsMin: number | null;
  targetRepsMax: number | null;
}

export interface SharedRoutineDaySnapshot {
  order: number;
  weekday: number | null;
  label: string;
  kind: RoutineDayKind;
  exercises: SharedRoutineExerciseSnapshot[];
}

export interface SharedRoutinePayload {
  mode: "single" | "weekly";
  days: SharedRoutineDaySnapshot[];
}

export interface SharedRoutineRecord {
  code: string;
  routineId: string | null;
  ownerId: string;
  ownerName: string;
  title: string;
  description: string | null;
  payload: SharedRoutinePayload;
  cloneCount: number;
  createdAt: string;
}

function generateShareCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "CRN";
  for (let i = 0; i < 5; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function buildSharedRoutinePayload(routine: RoutineWithExercises): SharedRoutinePayload {
  const draft = draftFromRoutine(routine);
  return {
    mode: draft.mode === "weekly" ? "weekly" : "single",
    days: draft.days.map((day) => ({
      order: day.order,
      weekday: day.weekday ?? null,
      label: day.label,
      kind: day.kind,
      exercises: day.exercises.map((ex) => ({
        exerciseId: ex.exercise.id,
        name: ex.exercise.name,
        nameEs: ex.exercise.name_es ?? null,
        bodyPart: ex.exercise.body_part,
        target: ex.exercise.target,
        equipment: ex.exercise.equipment,
        gifUrl: ex.exercise.gif_url,
        targetSets: ex.target_sets,
        restSeconds: ex.rest_seconds,
        orderIndex: ex.order_index,
        targetRepsMin: ex.target_reps_min ?? null,
        targetRepsMax: ex.target_reps_max ?? null,
      })),
    })),
  };
}

export async function createOrGetSharedRoutine(
  routine: RoutineWithExercises,
  userId: string,
  ownerName: string,
): Promise<{ code: string; url: string } | null> {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://cronogym.vercel.app";
  const payload = buildSharedRoutinePayload(routine);
  const cleanOwner = ownerName.trim() || "Atleta Cronos";

  const { data: existing } = await supabase
    .from("shared_routines")
    .select("code")
    .eq("routine_id", routine.id)
    .eq("owner_id", userId)
    .maybeSingle();

  if (existing?.code) {
    await supabase
      .from("shared_routines")
      .update({
        title: routine.title,
        description: routine.description ?? null,
        owner_name: cleanOwner,
        payload: payload as unknown as Json,
      })
      .eq("code", existing.code)
      .eq("owner_id", userId);

    return { code: existing.code, url: `${origin}/rutina/${encodeURIComponent(existing.code)}` };
  }

  const code = generateShareCode();
  const { error } = await supabase.from("shared_routines").insert({
    code,
    routine_id: routine.id,
    owner_id: userId,
    owner_name: cleanOwner,
    title: routine.title,
    description: routine.description ?? null,
    payload: payload as unknown as Json,
  });

  if (error) return null;
  return { code, url: `${origin}/rutina/${encodeURIComponent(code)}` };
}

export async function fetchSharedRoutineByCode(
  code: string,
): Promise<SharedRoutineRecord | null> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;
  const { data, error } = await supabase
    .from("shared_routines")
    .select("*")
    .eq("code", normalized)
    .maybeSingle();
  if (error || !data) return null;

  const rawPayload = data.payload as unknown as Partial<SharedRoutinePayload> | null;
  return {
    code: data.code,
    routineId: data.routine_id,
    ownerId: data.owner_id,
    ownerName: data.owner_name,
    title: data.title,
    description: data.description,
    payload: {
      mode: rawPayload?.mode === "weekly" ? "weekly" : "single",
      days: Array.isArray(rawPayload?.days) ? rawPayload.days : [],
    },
    cloneCount: data.clone_count,
    createdAt: data.created_at,
  };
}

export async function cloneSharedRoutineToUser(
  shared: SharedRoutineRecord,
  userId: string,
): Promise<SaveResult> {
  const draft: RoutineDraftV2 = {
    draftKey: newDraftKey(),
    id: null,
    title: shared.title,
    description: shared.description ?? `Clonada de ${shared.ownerName} via Cronos`,
    mode: shared.payload.mode === "weekly" ? "weekly" : "single",
    days: shared.payload.days.map((day) => ({
      id: crypto.randomUUID(),
      order: day.order,
      weekday: day.weekday,
      label: day.label,
      kind: day.kind,
      exercises: day.exercises.map((ex, idx) => ({
        rowId: crypto.randomUUID(),
        order_index: ex.orderIndex ?? idx,
        target_sets: ex.targetSets || 3,
        rest_seconds: ex.restSeconds || 90,
        target_reps_min: ex.targetRepsMin ?? 8,
        target_reps_max: ex.targetRepsMax ?? 12,
        exercise: {
          id: ex.exerciseId,
          name: ex.name,
          name_es: ex.nameEs,
          body_part: ex.bodyPart,
          target: ex.target,
          equipment: ex.equipment,
          gif_url: ex.gifUrl,
          instructions: [],
          is_active: true,
          is_hidden: false,
        },
      })),
    })),
    snapshot: null,
    needsModeConfirmation: false,
  };

  const result = await saveRoutine(userId, draft, "duplicate");
  await flushSave(draft.draftKey);
  if (result.ok) {
    void supabase.rpc("increment_shared_routine_clone", { p_code: shared.code });
  }
  return result;
}

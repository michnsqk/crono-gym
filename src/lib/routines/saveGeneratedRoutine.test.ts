import { describe, expect, it, vi, beforeEach } from "vitest";
import type { GeneratedRoutine } from "@/lib/ai/routineGenerator";

const mocks = vi.hoisted(() => {
  const routineInsertSingle = vi.fn();
  const routineDeleteEq = vi.fn();
  const exercisesSelectIn = vi.fn();
  const routineExercisesInsert = vi.fn();

  return {
    routineInsertSingle,
    routineDeleteEq,
    exercisesSelectIn,
    routineExercisesInsert,
  };
});

vi.mock("@lib/supabase", () => ({
  supabase: {
    from: (table: string) => {
      if (table === "routines") {
        return {
          insert: () => ({
            select: () => ({
              single: mocks.routineInsertSingle,
            }),
          }),
          delete: () => ({
            eq: mocks.routineDeleteEq,
          }),
        };
      }
      if (table === "exercises") {
        return {
          select: () => ({
            in: mocks.exercisesSelectIn,
          }),
        };
      }
      if (table === "routine_exercises") {
        return {
          insert: mocks.routineExercisesInsert,
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  },
}));

import { saveGeneratedRoutine } from "./saveGeneratedRoutine";

describe("saveGeneratedRoutine · prevención de 409 Conflict", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.routineInsertSingle.mockResolvedValue({ data: { id: "routine-1" }, error: null });
    mocks.routineDeleteEq.mockResolvedValue({ error: null });
    mocks.exercisesSelectIn.mockResolvedValue({
      data: [{ id: "ex-1" }, { id: "ex-2" }, { id: "ex-3" }],
      error: null,
    });
    mocks.routineExercisesInsert.mockResolvedValue({ error: null });
  });

  it("deduplica exercise_id entre días y asigna order_index secuencial (0, 1, 2...)", async () => {
    const routine: GeneratedRoutine = {
      name: "Push Pull",
      days: [
        {
          dayNumber: 1,
          focus: "Push",
          exercises: [
            { exerciseId: "ex-1", sets: 4, repsMin: 8, repsMax: 10, restSeconds: 120 },
            { exerciseId: "ex-2", sets: 3, repsMin: 10, repsMax: 12, restSeconds: 90 },
          ],
        },
        {
          dayNumber: 2,
          focus: "Pull",
          exercises: [
            { exerciseId: "ex-2", sets: 3, repsMin: 10, repsMax: 12, restSeconds: 90 },
            { exerciseId: "ex-3", sets: 0, repsMin: 8, repsMax: 10, restSeconds: -10 },
          ],
        },
      ],
    };

    const ok = await saveGeneratedRoutine("user-1", routine);
    expect(ok).toBe(true);
    expect(mocks.routineExercisesInsert).toHaveBeenCalledTimes(1);

    const insertedRows = mocks.routineExercisesInsert.mock.calls[0][0];
    expect(insertedRows).toEqual([
      {
        routine_id: "routine-1",
        exercise_id: "ex-1",
        target_sets: 4,
        rest_seconds: 120,
        order_index: 0,
      },
      {
        routine_id: "routine-1",
        exercise_id: "ex-2",
        target_sets: 3,
        rest_seconds: 90,
        order_index: 1,
      },
      {
        routine_id: "routine-1",
        exercise_id: "ex-3",
        target_sets: 1,
        rest_seconds: 0,
        order_index: 2,
      },
    ]);
  });

  it("filtra exercise_id inexistentes en public.exercises para evitar FK 409", async () => {
    mocks.exercisesSelectIn.mockResolvedValue({
      data: [{ id: "ex-1" }],
      error: null,
    });

    const routine: GeneratedRoutine = {
      name: "Mix",
      days: [
        {
          dayNumber: 1,
          focus: "Full",
          exercises: [
            { exerciseId: "cg-mach-local-only", sets: 3, repsMin: 10, repsMax: 12, restSeconds: 90 },
            { exerciseId: "ex-1", sets: 4, repsMin: 8, repsMax: 10, restSeconds: 120 },
          ],
        },
      ],
    };

    const ok = await saveGeneratedRoutine("user-1", routine);
    expect(ok).toBe(true);
    const insertedRows = mocks.routineExercisesInsert.mock.calls[0][0];
    expect(insertedRows).toEqual([
      {
        routine_id: "routine-1",
        exercise_id: "ex-1",
        target_sets: 4,
        rest_seconds: 120,
        order_index: 0,
      },
    ]);
  });

  it("limpia la rutina creada y retorna false si ningún exercise_id existe en Supabase", async () => {
    mocks.exercisesSelectIn.mockResolvedValue({ data: [], error: null });

    const routine: GeneratedRoutine = {
      name: "Solo Local",
      days: [
        {
          dayNumber: 1,
          focus: "Full",
          exercises: [
            { exerciseId: "cg-mach-only", sets: 3, repsMin: 10, repsMax: 12, restSeconds: 90 },
          ],
        },
      ],
    };

    const ok = await saveGeneratedRoutine("user-1", routine);
    expect(ok).toBe(false);
    expect(mocks.routineExercisesInsert).not.toHaveBeenCalled();
    expect(mocks.routineDeleteEq).toHaveBeenCalledWith("id", "routine-1");
  });
});

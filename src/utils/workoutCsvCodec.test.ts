import { describe, expect, it } from "vitest";
import type { Exercise } from "@/types/supabase";
import {
  matchExerciseToCatalog,
  parseWorkoutCsv,
  serializeWorkoutsToCsv,
} from "./workoutCsvCodec";

const MOCK_CATALOG: Exercise[] = [
  {
    id: "ex-bench",
    name: "Barbell Bench Press",
    name_es: "Press de banca con barra",
    body_part: "chest",
    target: "pectorals",
    equipment: "barbell",
    gif_url: "",
    instructions: [],
    is_active: true,
    is_hidden: false,
  },
  {
    id: "ex-pulldown",
    name: "Lat Pulldown",
    name_es: "Jalón al pecho",
    body_part: "back",
    target: "lats",
    equipment: "cable",
    gif_url: "",
    instructions: [],
    is_active: true,
    is_hidden: false,
  },
];

describe("workoutCsvCodec", () => {
  it("parses Hevy CSV with quoted notes and maps set types", () => {
    const hevyCsv = [
      "title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe",
      '"Push Day",2026-11-10 18:00:00,2026-11-10 19:00:00,"Foco en pecho","Bench Press (Barbell)",,"Bajar controlado, pausa 1s",0,warmup,40,12,,,6',
      '"Push Day",2026-11-10 18:00:00,2026-11-10 19:00:00,"Foco en pecho","Bench Press (Barbell)",,"Serie efectiva",1,normal,80,8,,,8.5',
    ].join("\n");

    const res = parseWorkoutCsv(hevyCsv);
    expect(res.provider).toBe("hevy");
    expect(res.sessions).toHaveLength(1);
    expect(res.totalSets).toBe(2);
    expect(res.sessions[0].sets[0].setType).toBe("warmup");
    expect(res.sessions[0].sets[0].notes).toBe("Bajar controlado, pausa 1s");
    expect(res.sessions[0].sets[1].weightKg).toBe(80);
    expect(res.sessions[0].sets[1].rpe).toBe(8.5);
  });

  it("parses Symmetry CSV in Spanish with semicolon delimiter and DD/MM/YYYY dates", () => {
    const symmetryEs = [
      "Rutina;Fecha;Ejercicio;Serie;Peso;Repeticiones;RIR",
      "Torso A;12/11/2026 17:30;Jalón al pecho;1;65;10;2",
      "Torso A;12/11/2026 17:30;Jalón al pecho;2;70;8;1",
    ].join("\r\n");

    const res = parseWorkoutCsv(symmetryEs);
    expect(res.provider).toBe("symmetry");
    expect(res.delimiter).toBe(";");
    expect(res.sessions).toHaveLength(1);
    expect(res.sessions[0].sets[0].rpe).toBe(8);
    expect(res.sessions[0].sets[1].weightKg).toBe(70);
  });

  it("parses Symmetry CSV in English", () => {
    const symmetryEn = [
      "Workout Name,Date,Exercise,Set,Weight,Reps,RPE",
      "Upper Body,2026-11-14 10:00:00,Lat Pulldown,1,60,12,8",
    ].join("\n");

    const res = parseWorkoutCsv(symmetryEn);
    expect(res.provider).toBe("symmetry");
    expect(res.totalSets).toBe(1);
  });

  it("serializes Cronos Backup CSV with UTF-8 BOM and parses it back", () => {
    const csv = serializeWorkoutsToCsv(
      [
        {
          id: "log-1",
          title: "Empuje",
          startedAt: "2026-11-15T18:00:00.000Z",
          completedAt: "2026-11-15T18:50:00.000Z",
          description: "Buena sesión",
          sets: [
            {
              exerciseId: "ex-bench",
              exerciseTitle: "Press de banca con barra",
              muscleGroup: "Pecho",
              equipment: "Barra",
              setIndex: 0,
              setType: "normal",
              weightKg: 85,
              reps: 8,
              rpe: 9,
              notes: null,
              isPr: true,
            },
          ],
        },
      ],
      "cronos",
    );

    expect(csv.startsWith("\uFEFF")).toBe(true);
    const parsed = parseWorkoutCsv(csv);
    expect(parsed.provider).toBe("cronos");
    expect(parsed.sessions[0].sets[0].sourceExerciseId).toBe("ex-bench");
  });

  it("matches English exercise names to Spanish Cronos catalog entries", () => {
    const match = matchExerciseToCatalog("Bench Press (Barbell)", MOCK_CATALOG);
    expect(match.status).toBe("matched");
    expect(match.matchedExercise?.id).toBe("ex-bench");
  });
});

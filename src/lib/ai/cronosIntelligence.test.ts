// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  buildCronosGymInventoryBrief,
  buildGuidedRoutineFromChat,
  createNewThread,
  detectRoutineIntent,
  loadChatThreads,
  loadSavedAiRoutines,
  resolveRecommendedExercisesFromAIResponse,
  saveChatThreads,
  saveGuidedRoutineToUserLibrary,
  stripExerciseTags,
  type CatalogExerciseLike,
} from "./cronosIntelligence";

const MOCK_CATALOG: CatalogExerciseLike[] = [
  {
    id: "cg-mach-001",
    name: "Hack Squat",
    name_es: "Sentadilla Hack en máquina",
    muscle_group: "quads",
    equipment: "machine",
    equipment_id: "CG-EQP-0010",
    equipment_name: "Sentadilla Hack",
    gif_url: "videos/0743-Qa55kX1.gif",
    instructions: ["Pega la espalda al respaldo", "Desciende controlado"],
  },
  {
    id: "cg-mach-002",
    name: "Preacher Curl",
    name_es: "Curl predicador en máquina",
    muscle_group: "biceps",
    equipment: "machine",
    equipment_id: "CG-EQP-0020",
    equipment_name: "Predicador",
    gif_url: "videos/0575-q6y3OhV.gif",
  },
];

describe("cronosIntelligence", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("resolves [[EXERCISE:...]] tags to real catalog cards with GIF and rank", () => {
    const aiText =
      "[[EXERCISE:Sentadilla Hack en máquina]]\n\n1. Controla la bajada 3 segundos.";
    const matches = resolveRecommendedExercisesFromAIResponse(
      aiText,
      "pierna",
      MOCK_CATALOG,
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].id).toBe("cg-mach-001");
    expect(matches[0].gifUrl).toBe("videos/0743-Qa55kX1.gif");
    expect(matches[0].rankTier).toBeTruthy();
    expect(matches[0].sparklinePoints).toHaveLength(5);
    expect(stripExerciseTags(aiText)).toBe("1. Controla la bajada 3 segundos.");
  });

  it("falls back to fuzzy catalog matching when no explicit tag is emitted", () => {
    const matches = resolveRecommendedExercisesFromAIResponse(
      "Te recomiendo incluir Curl predicador en máquina para aislar el bíceps.",
      "biceps",
      MOCK_CATALOG,
    );
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches[0].id).toBe("cg-mach-002");
  });

  it("builds a 77-machine Cronos Gym inventory and dossier brief", () => {
    const brief = buildCronosGymInventoryBrief();
    expect(brief).toContain("INVENTARIO CRONOS GYM");
    expect(brief).toContain("CG-EQP-0001");
    expect(brief).toContain("FICHA 360 DEL ATLETA");
  });

  it("persists and loads multi-thread chat history", () => {
    const thread = createNewThread("Rutina de pierna");
    thread.messages.push({
      id: "m1",
      role: "user",
      content: "Dame un ejercicio de cuádriceps",
      createdAt: "2026-10-20T10:00:00.000Z",
    });
    saveChatThreads([thread]);
    const loaded = loadChatThreads();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].title).toBe("Rutina de pierna");
  });

  it("detects routine intent and builds a curated Cronos Gym routine without elastic bands", () => {
    const intent = detectRoutineIntent("Ármame una rutina de pecho y tríceps de 60 min en máquinas");
    expect(intent.isRoutineRequest).toBe(true);
    expect(intent.focus).toBe("push");

    const catalogWithBands: CatalogExerciseLike[] = [
      ...MOCK_CATALOG,
      {
        id: "band-chest-1",
        name: "Band Bench Press",
        name_es: "Press con banda elástica",
        muscle_group: "chest",
        equipment: "band",
        gif_url: "videos/1254-khlHMqs.gif",
      },
      {
        id: "cg-mach-010",
        name: "Machine Chest Press",
        name_es: "Press horizontal en máquina",
        muscle_group: "chest",
        equipment: "machine",
        equipment_id: "CG-EQP-0001",
        equipment_name: "Press de Pecho Convergente",
        gif_url: "videos/0577-T0yTjgW.gif",
      },
      {
        id: "cg-mach-011",
        name: "Rope Triceps Pushdown",
        name_es: "Extensión tríceps con cuerda",
        muscle_group: "triceps",
        equipment: "cable",
        equipment_id: "CG-EQP-0018",
        equipment_name: "Polea Alta",
        gif_url: "videos/0200-dU605di.gif",
      },
    ];

    const routine = buildGuidedRoutineFromChat({
      focus: "push",
      durationStyle: "machines_priority",
      catalog: catalogWithBands,
    });

    expect(routine.exercises.length).toBeGreaterThanOrEqual(2);
    expect(routine.exercises.every((ex) => Boolean(ex.gifUrl))).toBe(true);
    expect(routine.exercises.some((ex) => ex.exerciseId === "band-chest-1")).toBe(false);
    expect(routine.exercises[0].sets).toBeGreaterThan(0);
  });

  it("saves the generated routine into the user's routines library", async () => {
    const routine = buildGuidedRoutineFromChat({
      focus: "legs",
      durationStyle: "60_optimal",
      catalog: MOCK_CATALOG,
    });
    const res = await saveGuidedRoutineToUserLibrary(null, routine);
    expect(res.ok).toBe(true);
    const saved = loadSavedAiRoutines();
    expect(saved).toHaveLength(1);
    expect(saved[0].id).toBe(routine.id);
    const dzRaw = window.localStorage.getItem("cronos_day_zero_routines_v1");
    expect(dzRaw).toBeTruthy();
    expect(dzRaw).toContain(routine.name);
  });
});

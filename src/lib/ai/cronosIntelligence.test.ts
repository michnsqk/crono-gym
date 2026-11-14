// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  buildCronosGymInventoryBrief,
  createNewThread,
  loadChatThreads,
  resolveRecommendedExercisesFromAIResponse,
  saveChatThreads,
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
});

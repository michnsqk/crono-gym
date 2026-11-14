/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { CatalogExercise } from "@/lib/catalog/types";
import { DayZeroAssistant } from "./DayZeroAssistant";

const MUSCLE_CATALOG_GROUPS = [
  { muscle: "chest", pattern: "horizontal_push" },
  { muscle: "lats", pattern: "vertical_pull" },
  { muscle: "deltoids", pattern: "vertical_push" },
  { muscle: "biceps", pattern: "curl" },
  { muscle: "triceps", pattern: "extension" },
  { muscle: "abs", pattern: "anti_extension" },
  { muscle: "quadriceps", pattern: "squat" },
  { muscle: "hamstrings", pattern: "hinge" },
  { muscle: "glutes", pattern: "hinge" },
  { muscle: "calves", pattern: "isolation" },
] as const;

const MOCK_CATALOG: CatalogExercise[] = Array.from({ length: 60 }, (_, idx) => {
  const entry = MUSCLE_CATALOG_GROUPS[idx % MUSCLE_CATALOG_GROUPS.length];
  return {
    id: `mock-${idx + 1}`,
    name: `Mock ${entry.muscle} ${idx + 1}`,
    name_es: `Ejercicio ${entry.muscle} ${idx + 1}`,
    category: "strength",
    body_part: entry.muscle,
    equipment: "barbell",
    gif_url: "",
    image: "",
    muscle_group: entry.muscle,
    secondary_muscles: [],
    target: entry.muscle,
    availableInCronosGym: true,
    equipment_id: "CG-EQP-0001",
    movement_pattern: entry.pattern as CatalogExercise["movement_pattern"],
    instructions: {},
    instruction_steps: {},
    media_id: `m-${idx + 1}`,
    created_at: "2026-01-01T00:00:00.000Z",
    attribution: null,
  };
});

vi.mock("@/lib/catalog/catalogLoader", () => ({
  loadCatalog: vi.fn(async () => MOCK_CATALOG),
}));

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("DayZeroAssistant (2-to-6 days + anatomical day selector)", () => {
  it("supports 2-to-6 days, per-day anatomical customization, and routine generation", async () => {
    const onCreated = vi.fn();
    render(<DayZeroAssistant onCreated={onCreated} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "6 días" })).toBeTruthy();
    });

    for (const freq of [2, 3, 4, 5, 6]) {
      expect(screen.getByRole("button", { name: `${freq} días` })).toBeTruthy();
    }

    fireEvent.click(screen.getByRole("button", { name: "6 días" }));
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(6);

    fireEvent.click(tabs[3]);
    expect(screen.getByText("¿Qué quieres trabajar el Día 4?")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Pierna Completa" }));
    expect(screen.getByRole("button", { name: "Cuádriceps" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Isquiotibiales" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Glúteos" }).getAttribute("aria-pressed")).toBe("true");

    const abdomenBtn = screen.getByRole("button", { name: "Abdomen / Core" });
    fireEvent.click(abdomenBtn);
    expect(screen.getByRole("button", { name: "Abdomen / Core" }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Crear rutina · 6 días" }));
    expect(onCreated).toHaveBeenCalledTimes(1);
    const createdPlan = onCreated.mock.calls[0][0];
    expect(createdPlan.frequency).toBe(6);
    expect(createdPlan.days).toHaveLength(6);
  });
});

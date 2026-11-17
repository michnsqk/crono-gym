// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { NewUserQuestHud } from "./NewUserQuestHud";

describe("NewUserQuestHud", () => {
  it("renders the 4 onboarding quests with dynamic XP progress", () => {
    window.localStorage.clear();
    render(
      <MemoryRouter>
        <NewUserQuestHud hasRoutine={true} hasWorkout={false} onOpenTour={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Completa tus 4 misiones iniciales")).toBeTruthy();
    expect(screen.getByText("1 de 4 misiones · 250 / 1000 XP")).toBeTruthy();
    expect(screen.getByText("Crea o elige tu primera rutina")).toBeTruthy();
    expect(screen.getByText("Completa tu primer entrenamiento")).toBeTruthy();
    expect(screen.getByText("Desbloquea tus Rangos Anatómicos")).toBeTruthy();
    expect(screen.getByText("Domina Cronos IA y el modo Offline")).toBeTruthy();
  });
});

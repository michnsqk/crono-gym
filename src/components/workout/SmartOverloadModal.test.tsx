/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SmartOverloadModal } from "./SmartOverloadModal";

afterEach(cleanup);

describe("SmartOverloadModal (3-engine Apple submenu)", () => {
  it("opens on Sobrecarga tab by default and preserves overload controls", () => {
    const onApply = vi.fn();
    const onClose = vi.fn();

    render(
      <SmartOverloadModal
        isOpen
        onClose={onClose}
        exerciseName="Press de banca"
        weightKg={100}
        reps={8}
        isBodyweight={false}
        hasHistory
        category="barbell"
        movementPattern="horizontal_push"
        bodyPart="chest"
        onApply={onApply}
        pendingSetNumber={1}
      />,
    );

    expect(screen.getByRole("tablist")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Sobrecarga" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tab", { name: "Aproximación" }).getAttribute("aria-selected")).toBe("false");
    expect(screen.getByRole("tab", { name: "Calentamiento" }).getAttribute("aria-selected")).toBe("false");

    fireEvent.click(screen.getByRole("button", { name: "Aplicar sobrecarga" }));
    expect(onApply).toHaveBeenCalledWith({
      weightKg: 100,
      reps: 8,
      includeWarmup: false,
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("switches to Aproximación and injects live PAP warmup ramp sets", () => {
    const onApply = vi.fn();
    const onClose = vi.fn();

    render(
      <SmartOverloadModal
        isOpen
        onClose={onClose}
        exerciseName="Sentadilla trasera"
        weightKg={100}
        reps={8}
        isBodyweight={false}
        hasHistory
        category="barbell"
        movementPattern="squat"
        bodyPart="upper legs"
        onApply={onApply}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Aproximación" }));
    expect(screen.getByRole("tab", { name: "Aproximación" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText(/W1 · 50%/)).toBeTruthy();
    expect(screen.getByText(/W2 · 70%/)).toBeTruthy();
    expect(screen.getByText(/W3 · 85%/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Insertar 3 series de aproximación (W)" }));
    expect(onApply).toHaveBeenCalledWith({
      weightKg: 100,
      reps: 8,
      includeWarmup: true,
      customWarmupSets: [
        { weightKg: 50, reps: 8, type: "warmup" },
        { weightKg: 70, reps: 5, type: "warmup" },
        { weightKg: 85, reps: 2, type: "warmup" },
      ],
      onlyInsertWarmup: true,
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("switches to Calentamiento and injects W0 joint activation set", () => {
    const onApply = vi.fn();
    const onClose = vi.fn();

    render(
      <SmartOverloadModal
        isOpen
        onClose={onClose}
        exerciseName="Jalón al pecho"
        weightKg={60}
        reps={10}
        isBodyweight={false}
        hasHistory
        category="cable"
        movementPattern="vertical_pull"
        bodyPart="back"
        onApply={onApply}
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Calentamiento" }));
    expect(screen.getByText("Patrón de Tirón · Dorsal y Escápula")).toBeTruthy();
    expect(screen.getByText("W0 · Activación articular")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "+ Añadir serie de activación articular (W0)" }));
    expect(onApply).toHaveBeenCalledWith({
      weightKg: 60,
      reps: 10,
      customWarmupSets: [
        expect.objectContaining({
          weightKg: 18,
          reps: 12,
          type: "warmup",
        }),
      ],
      onlyInsertWarmup: true,
    });
    expect(onClose).toHaveBeenCalled();
  });
});

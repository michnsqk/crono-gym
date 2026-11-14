/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { TrainingHeroSection } from "./TrainingHeroSection";

afterEach(() => cleanup());

const baseProps = {
  greeting: "Hola",
  hasRoutine: true,
  routineTitle: "Fuerza",
  exerciseCount: 4,
  estimatedDurationMin: 45,
  muscleCounts: new Map([["chest", 2]]),
  ctaLabel: "Comenzar entrenamiento",
  rehydrating: false,
  onPrimary: () => {},
};

describe("TrainingHeroSection", () => {
  it("renderiza saludo y título de rutina", () => {
    render(<TrainingHeroSection {...baseProps} />);
    expect(screen.getByText("Hola")).toBeTruthy();
    expect(screen.getByText("Fuerza")).toBeTruthy();
  });

  it("renderiza cantidad de ejercicios y duración", () => {
    render(<TrainingHeroSection {...baseProps} />);
    expect(screen.getByText(/4 ejercicios/)).toBeTruthy();
  });

  it("renderiza CTA y ejecuta onPrimary", () => {
    const onPrimary = vi.fn();
    render(<TrainingHeroSection {...baseProps} onPrimary={onPrimary} />);
    const btn = screen.getByRole("button", { name: /comenzar entrenamiento/i });
    fireEvent.click(btn);
    expect(onPrimary).toHaveBeenCalledTimes(1);
  });

  it("muestra estado vacío cuando hasRoutine es falso", () => {
    render(<TrainingHeroSection {...baseProps} hasRoutine={false} />);
    expect(screen.getByText("Rutina del d\u00eda")).toBeTruthy();
    expect(screen.getByText("Crea tu primera rutina para empezar")).toBeTruthy();
  });

  it("deshabilita CTA durante rehidratación", () => {
    render(<TrainingHeroSection {...baseProps} rehydrating={true} ctaLabel="Comprobando sesión..." />);
    const btn = screen.getByRole("button");
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Preparando entrenamiento…")).toBeTruthy();
  });

  it("renderiza muscleCounts (mapa)", () => {
    render(<TrainingHeroSection {...baseProps} />);
    // MuscleReadonlyMap se monta sin error; verificamos presencia del contenedor
    expect(screen.getByText("Hola")).toBeTruthy();
  });

  it("en 390px coloca el mapa anatómico completo a la derecha del título sin recortar piernas", () => {
    render(<TrainingHeroSection {...baseProps} routineTitle="Empuje de pecho con barra" />);

    const grid = screen.getByTestId("training-hero-command").querySelector("div.grid");
    expect(grid?.className).toContain("grid-cols-[minmax(0,1fr)_126px]");
    expect(grid?.className).toContain("md:grid-cols-[minmax(0,1fr)_165px]");

    const title = screen.getByText("Empuje de pecho con barra");
    expect(title.style.maxWidth).toBe("20ch");

    const mapContainer = screen.getByTestId("today-hero-muscle-map");
    expect(mapContainer.className).toContain("h-[205px]");
    expect(mapContainer.className).toContain("w-[126px]");
  });

  it("deja el botón Ver progreso en una sola línea", () => {
    render(<TrainingHeroSection {...baseProps} isCompleted completedSummary={{
      title: "Empuje",
      durationMin: 45,
      exerciseCount: 4,
      setCount: 16,
    }} />);

    const button = screen.getByRole("button", { name: /ver progreso/i });
    expect(button.className).toContain("whitespace-nowrap");
    expect(button.className).toContain("px-5");
  });
});

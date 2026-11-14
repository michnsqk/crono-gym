// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BiomechanicalGripStanceModal } from "@/components/workout/BiomechanicalGripStanceModal";

vi.mock("@/components/MuscleReadonlyMap", () => ({
  MuscleReadonlyMap: ({ side, label }: { side: string; label?: string }) => (
    <div data-testid="mock-muscle-map" data-side={side} aria-label={label} />
  ),
}));

describe("BiomechanicalGripStanceModal lower-body zoom & auto-side", () => {
  it("frames the lower body inside lower-body-zoom-frame and auto-switches front/back side", () => {
    render(
      <BiomechanicalGripStanceModal
        open={true}
        onClose={() => undefined}
        exerciseTitle="Prensa 45°"
      />,
    );

    expect(screen.getByTestId("lower-body-zoom-frame")).toBeTruthy();
    expect(screen.getByTestId("mock-muscle-map")).toBeTruthy();

    // Selecting Pies Bajos auto-switches to front view (quadriceps)
    fireEvent.click(screen.getByRole("button", { name: "Pies Bajos" }));
    expect(screen.getByTestId("mock-muscle-map").getAttribute("data-side")).toBe("front");

    // Selecting Pies Altos auto-switches to back view (glutes / hamstrings)
    fireEvent.click(screen.getByRole("button", { name: "Pies Altos" }));
    expect(screen.getByTestId("mock-muscle-map").getAttribute("data-side")).toBe("back");
  });
});

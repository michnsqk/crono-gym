/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { GymSettingsProvider } from "@/context/GymSettingsContext";
import { PlateCalculatorSheet } from "./PlateCalculatorSheet";

describe("PlateCalculatorSheet", () => {
  it("calcula 100 kg en barra olímpica de 20 kg como 2 × 20 kg por lado y aplica el peso", () => {
    const onApplyWeight = vi.fn();
    const onClose = vi.fn();

    render(
      <GymSettingsProvider>
        <PlateCalculatorSheet
          isOpen={true}
          initialWeightKg={100}
          targetSetNumber={2}
          onClose={onClose}
          onApplyWeight={onApplyWeight}
        />
      </GymSettingsProvider>,
    );

    expect(screen.getByText(/Por lado: 2 × 20 kg/)).toBeTruthy();
    expect(screen.getByText(/Carga visual para Serie #2/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Aplicar 100 kg a la serie" }));
    expect(onApplyWeight).toHaveBeenCalledWith(100);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

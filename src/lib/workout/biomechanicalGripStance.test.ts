import { describe, expect, it } from "vitest";
import {
  CRONOS_ATTACHMENTS_GUIDE,
  FOOT_STANCE_MATRIX,
  UPPER_BODY_GRIP_MATRIX,
  countsMapFromSlugs,
  resolveInitialBiomechanicsTab,
} from "./biomechanicalGripStance";

describe("biomechanicalGripStance", () => {
  it("exposes real Cronos attachment entries with valid image paths and muscle slugs", () => {
    expect(CRONOS_ATTACHMENTS_GUIDE.length).toBeGreaterThanOrEqual(8);
    const ids = CRONOS_ATTACHMENTS_GUIDE.map((entry) => entry.equipmentId);
    expect(ids).toContain("CG-EQP-0038"); // Cuerda
    expect(ids).toContain("CG-EQP-0037"); // Barra recta
    expect(ids).toContain("CG-EQP-0039"); // Barra Z
    expect(ids).toContain("CG-EQP-0040"); // Estribo unilateral
    expect(ids).toContain("CG-EQP-0041"); // Barra larga jalón
    expect(ids).toContain("CG-EQP-0044"); // Triángulo cerrado

    for (const entry of CRONOS_ATTACHMENTS_GUIDE) {
      expect(entry.imageUrl).toMatch(/^\/images\/gym-equipment\/CG-EQP-\d{4}_.+\.jpg$/);
      expect(entry.primaryMuscles.length).toBeGreaterThan(0);
      expect(entry.muscleSlugs.length).toBeGreaterThan(0);
      expect(entry.recommendedExercises.length).toBeGreaterThan(0);
    }
  });

  it("differentiates low/narrow foot stance (quadriceps) from high/wide stance (glutes/hamstrings/adductors)", () => {
    expect(FOOT_STANCE_MATRIX).toHaveLength(5);
    const lowNarrow = FOOT_STANCE_MATRIX.find((z) => z.id === "low_narrow");
    const highNeutral = FOOT_STANCE_MATRIX.find((z) => z.id === "high_neutral");
    const highWideSumo = FOOT_STANCE_MATRIX.find((z) => z.id === "high_wide_sumo");

    expect(lowNarrow).toBeDefined();
    expect(lowNarrow!.muscleSlugs).toContain("quadriceps");
    expect(lowNarrow!.muscleSlugs).not.toContain("hamstring");

    expect(highNeutral).toBeDefined();
    expect(highNeutral!.muscleSlugs).toContain("gluteal");
    expect(highNeutral!.muscleSlugs).toContain("hamstring");

    expect(highWideSumo).toBeDefined();
    expect(highWideSumo!.muscleSlugs).toContain("gluteal");
    expect(highWideSumo!.muscleSlugs).toContain("adductors");
  });

  it("provides upper-body bench angles and elbow/shoulder trajectories with anatomical slugs", () => {
    expect(UPPER_BODY_GRIP_MATRIX.length).toBeGreaterThanOrEqual(7);
    const incline30 = UPPER_BODY_GRIP_MATRIX.find((e) => e.id === "bench_incline_30");
    const tuckedLats = UPPER_BODY_GRIP_MATRIX.find((e) => e.id === "elbows_tucked_lats");
    const flaredUpperBack = UPPER_BODY_GRIP_MATRIX.find((e) => e.id === "elbows_flared_upper_back");

    expect(incline30?.muscleSlugs).toContain("chest");
    expect(tuckedLats?.muscleSlugs).toContain("upper-back");
    expect(flaredUpperBack?.muscleSlugs).toContain("trapezius");

    const counts = countsMapFromSlugs(incline30!.muscleSlugs);
    expect(counts.get("chest")).toBe(3);
  });

  it("classifies the initial biomechanics tab from exercise context", () => {
    expect(
      resolveInitialBiomechanicsTab({
        bodyPart: "upper legs",
        exerciseName: "Prensa de pierna 45°",
      }),
    ).toBe("foot_stance");

    expect(
      resolveInitialBiomechanicsTab({
        bodyPart: "back",
        exerciseName: "Jalón al pecho en polea",
      }),
    ).toBe("attachments");

    expect(
      resolveInitialBiomechanicsTab({
        bodyPart: "chest",
        exerciseName: "Press inclinado con mancuernas",
      }),
    ).toBe("upper_angle");
  });
});

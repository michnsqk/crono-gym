import { describe, expect, it } from "vitest";
import {
  UNILATERAL_SIDE_REST_SECONDS,
  recommendSmartRest,
} from "./smartRestAdvisor";

describe("smartRestAdvisor", () => {
  it("detects unilateral arm exercise and recommends 40s between sides + 60s after both", () => {
    const rec = recommendSmartRest({
      name: "Single-arm dumbbell row",
      name_es: "Remo unilateral con mancuerna a un brazo",
      target: "lats",
      equipment: "dumbbell",
    });

    expect(rec.modality).toBe("unilateral");
    expect(rec.betweenSidesSeconds).toBe(UNILATERAL_SIDE_REST_SECONDS);
    expect(rec.betweenSetsSeconds).toBe(60);
  });

  it("detects unilateral leg exercise (búlgara / zancada) with 40s per leg and 90s full set", () => {
    const rec = recommendSmartRest({
      name: "Bulgarian Split Squat",
      name_es: "Sentadilla búlgara",
      target: "quads",
      equipment: "dumbbell",
    });

    expect(rec.modality).toBe("unilateral");
    expect(rec.region).toBe("leg");
    expect(rec.betweenSidesSeconds).toBe(40);
    expect(rec.betweenSetsSeconds).toBe(90);
  });

  it("detects unilateral core exercise with 40s per side and 45s full set", () => {
    const rec = recommendSmartRest({
      name: "Side Plank",
      name_es: "Plancha lateral",
      target: "obliques",
      equipment: "body weight",
    });

    expect(rec.modality).toBe("unilateral");
    expect(rec.region).toBe("core");
    expect(rec.betweenSidesSeconds).toBe(40);
    expect(rec.betweenSetsSeconds).toBe(45);
  });

  it("detects bilateral core exercise with 45s and no side rest", () => {
    const rec = recommendSmartRest({
      name: "Crunch abdominal",
      target: "abs",
      equipment: "body weight",
    });

    expect(rec.modality).toBe("bilateral");
    expect(rec.region).toBe("core");
    expect(rec.betweenSidesSeconds).toBeNull();
    expect(rec.betweenSetsSeconds).toBe(45);
  });

  it("detects machine leg press with 90s rest", () => {
    const rec = recommendSmartRest({
      name: "Prensa de pierna 45°",
      target: "quads",
      equipment: "sled machine",
    });

    expect(rec.modality).toBe("machine");
    expect(rec.region).toBe("leg");
    expect(rec.betweenSetsSeconds).toBe(90);
  });

  it("detects bilateral barbell leg compound with 150s rest", () => {
    const rec = recommendSmartRest({
      name: "Sentadilla con barra",
      target: "quads",
      equipment: "barbell",
    });

    expect(rec.modality).toBe("bilateral");
    expect(rec.region).toBe("leg");
    expect(rec.betweenSetsSeconds).toBe(150);
  });
});

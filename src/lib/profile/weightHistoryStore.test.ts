// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  computeMonthlyWeightDelta,
  deleteWeightEntry,
  getMonthlyChartPoints,
  loadClinicalDossier,
  loadWeightHistory,
  recordWeightEntry,
  saveClinicalDossier,
} from "./weightHistoryStore";

describe("weightHistoryStore", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("records monthly weigh-ins and computes delta vs previous month", () => {
    recordWeightEntry({ weightKg: 82.4, date: "2026-09-15" }, "user-1");
    const next = recordWeightEntry(
      { weightKg: 80.1, date: "2026-10-15", note: "En ayunas" },
      "user-1",
    );
    expect(next).toHaveLength(2);
    const { latest, previousMonth, deltaKg } = computeMonthlyWeightDelta(next);
    expect(latest?.weightKg).toBe(80.1);
    expect(previousMonth?.weightKg).toBe(82.4);
    expect(deltaKg).toBe(-2.3);
  });

  it("builds monthly chart points keeping latest entry per month", () => {
    recordWeightEntry({ weightKg: 84, date: "2026-08-05" }, "user-1");
    recordWeightEntry({ weightKg: 83.2, date: "2026-08-25" }, "user-1");
    recordWeightEntry({ weightKg: 81.5, date: "2026-09-10" }, "user-1");
    const points = getMonthlyChartPoints(loadWeightHistory("user-1"), 6);
    expect(points).toHaveLength(2);
    expect(points[0].weightKg).toBe(83.2);
    expect(points[1].weightKg).toBe(81.5);
  });

  it("deletes a weigh-in entry by id", () => {
    const after = recordWeightEntry({ weightKg: 79, date: "2026-10-01" }, "user-1");
    expect(after).toHaveLength(1);
    const remaining = deleteWeightEntry(after[0].id, "user-1");
    expect(remaining).toHaveLength(0);
  });

  it("persists and loads athlete 360 clinical dossier", () => {
    saveClinicalDossier(
      {
        goalWeightKg: 76,
        trainingDaysPerWeek: 5,
        priorityMuscles: ["Espalda", "Hombros"],
        jointDiscomforts: ["Hombro / Manguito"],
        updatedAt: "2026-10-20T00:00:00.000Z",
      },
      "user-1",
    );
    const loaded = loadClinicalDossier("user-1");
    expect(loaded.goalWeightKg).toBe(76);
    expect(loaded.trainingDaysPerWeek).toBe(5);
    expect(loaded.priorityMuscles).toEqual(["Espalda", "Hombros"]);
    expect(loaded.jointDiscomforts).toEqual(["Hombro / Manguito"]);
  });
});

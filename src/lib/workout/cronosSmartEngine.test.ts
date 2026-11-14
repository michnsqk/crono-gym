import { describe, expect, it } from "vitest";
import {
  BODYWEIGHT_LOAD_HINT,
  calibratePendingSets,
  classifyEquipmentCategory,
  computeExerciseRank,
  estimateSmartLoad,
  findStationAlternatives,
  generateMobilityWarmupProtocol,
  generateSmartWarmupSets,
  generateWarmupRamp,
  getAdaptiveRestSeconds,
  getLoadBreakdownHint,
  isBodyweightExercise,
  type AlternativeCandidate,
} from "./cronosSmartEngine";

describe("cronosSmartEngine", () => {
  it("increments overload after completing target reps", () => {
    expect(estimateSmartLoad({
      mode: "overload",
      targetReps: 8,
      weightHistory: [{ weightKg: 50, reps: 8, completed: true }],
    }).weightKg).toBe(52.5);
  });

  it("uses station-aware biometric day zero loads", () => {
    const legPress = estimateSmartLoad({
      mode: "biometric_day_0",
      weightKg: 80,
      targetStation: "leg_press_45",
      experienceLevel: "beginner",
    });
    const curl = estimateSmartLoad({
      mode: "biometric_day_0",
      weightKg: 80,
      targetStation: "free_weight_area",
      movementPattern: "isolation",
      experienceLevel: "beginner",
    });
    expect(legPress.weightKg).toBeGreaterThan(curl.weightKg);
  });

  it("returns zero for invalid negative body weight", () => {
    expect(estimateSmartLoad({
      mode: "biometric_day_0",
      weightKg: -20,
      experienceLevel: "beginner",
    }).weightKg).toBe(0);
  });

  it("keeps a bodyweight movement at zero load and bodyweight reps", () => {
    const pushUp = estimateSmartLoad({ mode: "bodyweight", targetReps: 8 });
    expect(pushUp.weightKg).toBe(0);
    expect(pushUp.suggestedReps).toBe(15);

    // A bodyweight exercise must never inherit the biometric multiplier: the
    // same 65 kg that load a bench would turn a push-up into a weighted one.
    const biometric = estimateSmartLoad({
      mode: "biometric_day_0",
      weightKg: 65,
      targetStation: "free_weight_area",
      movementPattern: "isolation",
      experienceLevel: "beginner",
    });
    expect(biometric.weightKg).toBeGreaterThan(0);
  });

  it("creates progressive warmup sets", () => {
    const sets = generateSmartWarmupSets(80, false);
    expect(sets).toHaveLength(3);
    expect(sets[0].weightKg).toBeLessThan(sets[2].weightKg);
  });

  it("calibrates only pending sets", () => {
    const sets = [{ weightKg: 50 }, { weightKg: 50 }, { weightKg: 50 }];
    const result = calibratePendingSets(sets, 0, "too_heavy");
    expect(result.map((set) => set.weightKg)).toEqual([50, 45, 45]);
  });

  it("returns adaptive rests", () => {
    expect(getAdaptiveRestSeconds("warmup", "squat")).toBe(45);
    expect(getAdaptiveRestSeconds("normal", "squat")).toBe(120);
    expect(getAdaptiveRestSeconds("normal", "isolation")).toBe(75);
  });
});

/**
 * The pull-up regression: the row is mapped to the pull-up bar, so it carries an
 * `CG-EQP-*` id, and a mapped id used to mean "loaded machine". The athlete was
 * told to load "Barra 7kg" for an exercise that only ever carries their body.
 */
describe("isBodyweightExercise", () => {
  it("recognises the pull-up bar, the decline ab bench and the hyperextension bench", () => {
    expect(isBodyweightExercise({ equipment_id: "CG-EQP-0051", name: "Dominadas" })).toBe(true);
    expect(isBodyweightExercise({ equipment_id: "CG-EQP-0028", name: "Abdominales" })).toBe(true);
    expect(isBodyweightExercise({ equipment_id: "CG-EQP-0015", name: "Hiperextensiones" })).toBe(true);
  });

  it("recognises a bodyweight row, whatever the catalog named the equipment", () => {
    expect(isBodyweightExercise({ equipment_id: "NONE" })).toBe(true);
    expect(isBodyweightExercise({ equipment: "body weight" })).toBe(true);
    expect(isBodyweightExercise({ equipment: "Assisted" })).toBe(true);
    expect(isBodyweightExercise({ name: "Push-up" })).toBe(true);
    expect(isBodyweightExercise({ name_es: "Elevación de piernas colgado" })).toBe(true);
    expect(isBodyweightExercise({ name: "Plancha abdominal" })).toBe(true);
  });

  it("leaves a loaded movement alone, even when it is named after a calisthenics one", () => {
    expect(isBodyweightExercise({ equipment_id: "CG-EQP-0012", name: "Press banca" })).toBe(false);
    expect(isBodyweightExercise({ name: "Crunch en polea" })).toBe(false);
    expect(isBodyweightExercise({ name: "Dominadas con lastre" })).toBe(false);
    expect(isBodyweightExercise({ name: "Fondos en máquina" })).toBe(false);
    expect(isBodyweightExercise({ equipment: "barbell" })).toBe(false);
    expect(isBodyweightExercise(null)).toBe(false);
  });
});

describe("prescripción sin carga externa", () => {
  it("never prescribes a bar breakdown for a pull-up", () => {
    expect(getLoadBreakdownHint(7, "pullup_dip_station", "body weight")).toBe(BODYWEIGHT_LOAD_HINT);
    expect(getLoadBreakdownHint(60, "flat_bench", "barbell")).toContain("Barra");
  });

  it("keeps a pull-up at zero load and bodyweight reps", () => {
    const pullUp = estimateSmartLoad({ mode: "bodyweight", targetReps: 15 });
    expect(pullUp.weightKg).toBe(0);
    expect(pullUp.suggestedReps).toBe(15);
    expect(pullUp.reason).toContain("Peso corporal");
  });
});

function candidate(overrides: Partial<AlternativeCandidate>): AlternativeCandidate {
  return {
    id: "ex-1",
    name: "Press de banca",
    body_part: "chest",
    target: "pectorals",
    equipment: "barbell",
    muscle_group: "chest",
    movement_pattern: "horizontal_push",
    equipment_id: "CG-EQP-0004",
    ...overrides,
  };
}

describe("findStationAlternatives", () => {
  const bench = candidate({ id: "bench" });

  it("nunca ofrece un abdominal para un press de pecho", () => {
    const abs = candidate({
      id: "crunch",
      name: "Crunch de abdomen",
      body_part: "abdominals",
      target: "abs",
      muscle_group: "abs",
      movement_pattern: "horizontal_push",
    });

    const alternatives = findStationAlternatives(bench, [abs, candidate({ id: "incline" })], 60);

    expect(alternatives.map((a) => a.exercise.id)).toEqual(["incline"]);
    expect(alternatives.some((a) => a.exercise.body_part === "abdominals")).toBe(false);
  });

  it("exige la misma región aunque el patrón coincida", () => {
    const row = candidate({
      id: "row",
      name: "Remo sentado",
      body_part: "back",
      target: "lats",
      muscle_group: "upper-back",
      movement_pattern: "horizontal_push",
    });

    expect(findStationAlternatives(bench, [row], 60)).toEqual([]);
  });

  it("no muestra el código CG-EQP en el nombre del equipo", () => {
    const onlyId = candidate({
      id: "pec-deck",
      name: "Pec deck",
      equipment: "machine",
      equipment_id: "CG-EQP-0040",
      equipment_name: null,
    });

    const [alternative] = findStationAlternatives(bench, [onlyId], 60);

    expect(alternative.cleanEquipmentName).not.toContain("CG-EQP");
    expect(alternative.cleanEquipmentName).toBe("machine");
  });
});

/**
 * The ramp is the difference between "a warm-up" and "the first set of my
 * session is a 40 kg jump". These tests are about how many touches a heavy bar
 * needs, and about the movements that need none.
 */
describe("generateWarmupRamp", () => {
  it("necesita tres aproximaciones cuando la barra pesa", () => {
    const ramp = generateWarmupRamp({ workingWeightKg: 100, targetReps: 8 });

    expect(ramp).toHaveLength(3);
    expect(ramp.map((set) => set.weightKg)).toEqual([50, 70, 85]);
    expect(ramp.every((set) => set.type === "warmup")).toBe(true);
    // Ascending, or it is not a ramp.
    expect(ramp[0].weightKg).toBeLessThan(ramp[1].weightKg);
    expect(ramp[1].weightKg).toBeLessThan(ramp[2].weightKg);
  });

  it("se conforma con dos toques en cargas medianas y una en ligeras", () => {
    expect(generateWarmupRamp({ workingWeightKg: 30, targetReps: 10 })).toHaveLength(2);
    expect(generateWarmupRamp({ workingWeightKg: 12, targetReps: 12 })).toHaveLength(1);
  });

  it("no inventa una barra para un movimiento de peso corporal", () => {
    const ramp = generateWarmupRamp({ workingWeightKg: 0, targetReps: 15, isBodyweight: true });

    expect(ramp).toHaveLength(1);
    expect(ramp[0].weightKg).toBe(0);
  });

  it("acorta la rampa cuando el músculo ya viene caliente", () => {
    const cold = generateWarmupRamp({ workingWeightKg: 100, targetReps: 8 });
    const warm = generateWarmupRamp({ workingWeightKg: 100, targetReps: 8, musclePreviouslyWorked: true });

    expect(warm).toHaveLength(1);
    expect(warm.length).toBeLessThan(cold.length);
  });

  it("genera una rampa coherente desde la serie de trabajo", () => {
    // 80 kg is the heavy end of the old three-step ladder: 40 < 68 must hold.
    const sets = generateSmartWarmupSets(80, false);
    expect(sets).toHaveLength(3);
    expect(sets[0].weightKg).toBeLessThan(sets[2].weightKg);
  });
});

describe("classifyEquipmentCategory", () => {
  it("reconoce el implemento con el que se escribe la carga", () => {
    expect(classifyEquipmentCategory({ equipment: "Mancuernas" })).toBe("dumbbell");
    expect(classifyEquipmentCategory({ equipment: "Barra / Discos" })).toBe("barbell");
    expect(classifyEquipmentCategory({ equipment: "Polea" })).toBe("cable");
    expect(classifyEquipmentCategory({ equipment: "Máquina Selectorizada" })).toBe("machine");
    expect(classifyEquipmentCategory({ equipment_id: "NONE" })).toBe("bodyweight");
  });

  it("usa la estación cuando el nombre del equipo no dice nada", () => {
    expect(classifyEquipmentCategory({ station: "cable_high_pulley", equipment: "Polea" })).toBe("cable");
    expect(classifyEquipmentCategory({ station: "squat_rack" })).toBe("barbell");
    expect(classifyEquipmentCategory({ station: "pullup_dip_station" })).toBe("bodyweight");
  });

  it("lee un jalón con acento como lo que es", () => {
    expect(classifyEquipmentCategory({ name: "Jalón al pecho" })).toBe("cable");
    expect(classifyEquipmentCategory({ name_es: "Jalón agarre abierto" })).toBe("cable");
    expect(getLoadBreakdownHint(50, "free_weight_area", "polea", classifyEquipmentCategory({ name: "Jalón al pecho" }))).toContain("Torre");
  });

  it("trata lo que no reconoce como máquina, no como barra", () => {
    expect(classifyEquipmentCategory(null)).toBe("machine");
    expect(classifyEquipmentCategory({ equipment: "algo raro" })).toBe("machine");
  });
});

describe("desglose de carga por implemento", () => {
  it("escribe la mancuerna por mano y dice el total", () => {
    const hint = getLoadBreakdownHint(25, "free_weight_area", "mancuerna", "dumbbell");
    expect(hint).toContain("por mano");
    expect(hint).toContain("25kg total");
  });

  it("no describe una barra cuando el movimiento es de peso corporal", () => {
    expect(getLoadBreakdownHint(0, "free_weight_area", "body weight", "bodyweight")).toBe(BODYWEIGHT_LOAD_HINT);
  });

  it("sigue describiendo la barra cuando el implemento no se clasificó", () => {
    expect(getLoadBreakdownHint(60, "flat_bench", "barbell")).toContain("Barra");
  });
});

/**
 * Ranking 2.0: the tier names are one vocabulary, but the scale has to fit the
 * movement. A lateral raise at a 0.3 bodyweight ratio used to be Diamante.
 */
describe("computeExerciseRank por familia", () => {
  it("deja el press de banca en su escalera compuesta", () => {
    const rank = computeExerciseRank({
      exerciseId: "bench",
      weightKg: 80,
      reps: 8,
      bodyWeightKg: 80,
      equipment: "Barra / Discos",
      equipmentId: "CG-EQP-0004",
    });

    expect(rank.family).toBe("compound");
    // 80×8 is a 101 kg e1RM on an 80 kg athlete: relative 1.26, mid-ladder.
    expect(rank.ratio).toBeGreaterThan(1.2);
    expect(rank.currentRank.tier).not.toBe("Titán Cronos");
  });

  it("mide con una escalera distinta según el implemento", () => {
    const cable = computeExerciseRank({
      exerciseId: "curl",
      weightKg: 24,
      reps: 12,
      bodyWeightKg: 80,
      equipment: "Polea",
      equipmentId: "CG-EQP-0022",
      category: "cable",
    });
    const barbell = computeExerciseRank({
      exerciseId: "curl-barra",
      weightKg: 24,
      reps: 12,
      bodyWeightKg: 80,
      equipment: "Barra / Discos",
    });

    // Same athlete, same ratio; the isolation ladder is the one that can price
    // it, the compound one cannot.
    expect(cable.ratio).toBe(barbell.ratio);
    expect(cable.family).toBe("isolation");
    expect(barbell.family).toBe("compound");
    expect(cable.currentRank.tier).not.toBe("Sin rango");
    expect(barbell.currentRank.tier).toBe("Sin rango");
    // The isolation floor is low enough for this ratio; the compound one is not.
    expect(cable.ratio).toBeGreaterThan(0.15);
    expect(barbell.ratio).toBeLessThan(0.6);
  });

  it("mide el peso corporal en repeticiones, no en barra", () => {
    const pullUp = computeExerciseRank({
      exerciseId: "pullup",
      weightKg: 0,
      reps: 12,
      bodyWeightKg: 80,
      isBodyweight: true,
    });

    expect(pullUp.family).toBe("bodyweight");
    expect(pullUp.score).toBe(12);
    expect(pullUp.nextRank.targetWeightKg).toBe(0);
    expect(pullUp.nextRank.targetReps).toBeGreaterThan(12);
  });

  it("pone precio a la mancuerna en incrementos de dos", () => {
    const rank = computeExerciseRank({
      exerciseId: "press-mancuerna",
      weightKg: 20,
      reps: 10,
      bodyWeightKg: 80,
      equipment: "Mancuernas",
    });

    expect(rank.category).toBe("dumbbell");
    expect(rank.nextRank.targetWeightKg % 2).toBe(0);
  });

  it("no cae en la escalera de aislamiento cuando no llega el implemento", () => {
    // The call site used to pass only id, weight and reps: every movement then
    // classified as a machine and was priced on the isolation ladder, so a bench
    // press came back as Titán Cronos with no next rung.
    const rank = computeExerciseRank({
      exerciseId: "bench",
      weightKg: 80,
      reps: 8,
      bodyWeightKg: 80,
      station: "flat_bench",
      equipment: "Barra / Discos",
      equipmentId: "CG-EQP-0004",
    });

    expect(rank.family).toBe("compound");
    expect(rank.currentRank.tier).not.toBe("Titán Cronos");
  });

  it("valora una prensa de piernas como compuesto, no como aislamiento", () => {
    const legPress = computeExerciseRank({
      exerciseId: "leg-press",
      weightKg: 160,
      reps: 10,
      bodyWeightKg: 80,
      station: "leg_press_45",
      equipment: "Máquina Selectorizada",
      equipmentId: "CG-EQP-0002",
    });

    expect(legPress.family).toBe("compound");
    expect(legPress.category).toBe("machine");
  });

  it("acepta workingReps y equipmentCategory en generateWarmupRamp", () => {
    const ramp = generateWarmupRamp({
      workingWeightKg: 100,
      workingReps: 8,
      equipmentCategory: "barbell",
    });
    expect(ramp.map((s) => [s.weightKg, s.reps])).toEqual([
      [50, 8],
      [70, 5],
      [85, 2],
    ]);
  });

  it("genera protocolos de movilidad específicos para empuje, tirón, pierna y core", () => {
    const push = generateMobilityWarmupProtocol({
      movementPattern: "horizontal_push",
      bodyPart: "chest",
      equipmentCategory: "barbell",
      exerciseName: "Press de banca",
      workingWeightKg: 100,
    });
    expect(push.family).toBe("push");
    expect(push.steps).toHaveLength(3);
    expect(push.steps[0].doseLabel.length).toBeGreaterThan(0);
    expect(push.activationSet).toMatchObject({
      weightKg: 30,
      reps: 12,
      type: "warmup",
    });

    const pull = generateMobilityWarmupProtocol({
      movementPattern: "vertical_pull",
      bodyPart: "back",
      exerciseName: "Jalón al pecho",
      workingWeightKg: 60,
    });
    expect(pull.family).toBe("pull");
    expect(pull.steps).toHaveLength(3);
    expect(pull.activationSet.weightKg).toBe(18);

    const legs = generateMobilityWarmupProtocol({
      movementPattern: "squat",
      bodyPart: "upper legs",
      exerciseName: "Sentadilla libre",
      workingWeightKg: 120,
    });
    expect(legs.family).toBe("legs");
    expect(legs.steps).toHaveLength(3);
    expect(legs.activationSet.weightKg).toBe(36);

    const core = generateMobilityWarmupProtocol({
      movementPattern: "anti_extension",
      bodyPart: "waist",
      equipmentCategory: "bodyweight",
      exerciseName: "Plancha abdominal",
      isBodyweight: true,
    });
    expect(core.family).toBe("core");
    expect(core.steps).toHaveLength(3);
    expect(core.activationSet.weightKg).toBe(0);
    expect(core.activationSet.type).toBe("warmup");
  });
});

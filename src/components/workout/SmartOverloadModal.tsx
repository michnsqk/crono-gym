import { useEffect, useId, useMemo, useState } from "react";
import { Activity, Dumbbell, Flame, Layers, Minus, Plus, Sparkles, X } from "lucide-react";
import {
  ACCENT,
  GLASS,
  MOTION,
  NUMERIC,
  RADIUS,
  SCRIM,
  SPACE,
  SURFACE,
  TEXT,
  TYPE,
  Z_INDEX,
} from "@/design/tokens";
import type { StationKey } from "@/lib/catalog/types";
import {
  CALIBRATION_PRESETS,
  generateMobilityWarmupProtocol,
  generateWarmupRamp,
  getLoadBreakdownHint,
  incrementForCategory,
  type CalibrationPresetId,
  type EquipmentCategory,
  type SmartWorkoutSet,
} from "@/lib/workout/cronosSmartEngine";

export type SmartModalEngineTab = "overload" | "ramp" | "mobility";

export interface SmartOverloadModalApplyPayload {
  weightKg: number;
  reps: number;
  includeWarmup?: boolean;
  customWarmupSets?: readonly { weightKg: number; reps: number }[];
  onlyInsertWarmup?: boolean;
}

export interface SmartOverloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  exerciseName: string;
  /** What the next set is loaded with today. */
  weightKg: number;
  reps: number;
  isBodyweight: boolean;
  /** False on a movement the athlete has never logged: the modal calibrates. */
  hasHistory: boolean;
  /** The transfer estimate, when there is no history of this movement. */
  coldStartReason?: string | null;
  /** Where the numbers came from, said plainly instead of implied. */
  coldStartSourceLabel?: string | null;
  /** How the implement is loaded, as the card is written. */
  category?: EquipmentCategory;
  /** "Mancuerna 12.5kg por mano · 25kg total", or the bodyweight line. */
  breakdownHint?: string | null;
  /** The clean name of the implement, for the badge. */
  equipmentLabel?: string | null;
  /** Biomechanical movement pattern for joint mobility and PAP warmup cues. */
  movementPattern?: string | null;
  /** Anatomical body part / muscle group for mobility matching. */
  bodyPart?: string | null;
  /** Active station for live implement breakdown hints inside the PAP tab. */
  station?: StationKey;
  /** The ramp that prepares this load, as the engine sizes it. */
  warmupRamp?: readonly SmartWorkoutSet[];
  /**
   * Applies a one-tap calibration. Returns the load the engine chose, so the
   * modal can show what was learned rather than a number the athlete typed.
   */
  onCalibrate?: (preset: CalibrationPresetId) => { weightKg: number; reps: number } | null;
  /** Writes the calibration to the model and/or injects warmup sets. */
  onApply: (next: SmartOverloadModalApplyPayload) => void;
  /** 1-based number of the set the load will land on. */
  pendingSetNumber?: number;
}

const CATEGORY_LABEL: Record<EquipmentCategory, string> = {
  bodyweight: "Peso corporal",
  dumbbell: "Mancuernas",
  barbell: "Barra",
  cable: "Polea",
  machine: "Máquina",
};

const RAMP_STAGE_PURPOSE = [
  "Lubricación articular y patrón motor",
  "Activación neuromuscular progresiva",
  "Potenciación post-activación (PAP) sin fatiga",
] as const;

function rampPurposeFor(index: number, total: number): string {
  if (total <= 1) return "Activación ligera y fijación técnica";
  if (index === 0) return RAMP_STAGE_PURPOSE[0];
  if (index === total - 1) return RAMP_STAGE_PURPOSE[2];
  return RAMP_STAGE_PURPOSE[1];
}

/**
 * Cronos 3-Engine Smart Assistant Modal:
 * Tab 1 — Sobrecarga (progressive overload + RPE cold-start calibration)
 * Tab 2 — Aproximación (live PAP warmup ramp + one-tap insertion)
 * Tab 3 — Calentamiento (movement-specific joint mobility + W0 activation set)
 */
export function SmartOverloadModal({
  isOpen,
  onClose,
  exerciseName,
  weightKg,
  reps,
  isBodyweight,
  hasHistory,
  coldStartReason,
  coldStartSourceLabel,
  category,
  breakdownHint,
  equipmentLabel,
  movementPattern,
  bodyPart,
  station,
  warmupRamp,
  onCalibrate,
  onApply,
  pendingSetNumber,
}: SmartOverloadModalProps) {
  const titleId = useId();
  const [activeTab, setActiveTab] = useState<SmartModalEngineTab>("overload");
  const [weight, setWeight] = useState(String(weightKg));
  const [repsValue, setRepsValue] = useState(String(reps));
  const [preset, setPreset] = useState<CalibrationPresetId | null>(null);
  const [includeWarmup, setIncludeWarmup] = useState(false);

  // The sheet is mounted once and reused across exercises, so it has to adopt
  // the new exercise's numbers and default back to Sobrecarga every time it opens.
  useEffect(() => {
    if (!isOpen) return;
    setActiveTab("overload");
    setWeight(String(weightKg));
    setRepsValue(String(reps));
    setPreset(null);
    setIncludeWarmup(false);
  }, [isOpen, weightKg, reps]);

  const resolvedCategory: EquipmentCategory = category ?? (isBodyweight ? "bodyweight" : "machine");
  const weightNumber = Number.parseFloat(weight);
  const repsNumber = Number.parseInt(repsValue, 10);
  const weightValid = Number.isFinite(weightNumber) && weightNumber >= 0;
  const repsValid = Number.isFinite(repsNumber) && repsNumber > 0;
  const canApply = weightValid && repsValid;
  const safeWorkingWeight = weightValid ? weightNumber : Math.max(0, weightKg);
  const safeWorkingReps = repsValid ? repsNumber : Math.max(1, reps || 8);

  const liveRamp = useMemo(() => {
    if (
      warmupRamp &&
      warmupRamp.length > 0 &&
      Math.abs(safeWorkingWeight - weightKg) < 0.001 &&
      safeWorkingReps === reps
    ) {
      return warmupRamp;
    }
    if (!isBodyweight && safeWorkingWeight <= 0) {
      return [];
    }
    return generateWarmupRamp({
      workingWeightKg: safeWorkingWeight,
      workingReps: safeWorkingReps,
      isBodyweight,
      equipmentCategory: resolvedCategory,
    });
  }, [warmupRamp, safeWorkingWeight, safeWorkingReps, weightKg, reps, isBodyweight, resolvedCategory]);

  const mobilityProtocol = useMemo(
    () =>
      generateMobilityWarmupProtocol({
        movementPattern,
        bodyPart,
        equipmentCategory: resolvedCategory,
        exerciseName,
        workingWeightKg: safeWorkingWeight,
        isBodyweight,
      }),
    [movementPattern, bodyPart, resolvedCategory, exerciseName, safeWorkingWeight, isBodyweight],
  );

  if (!isOpen) return null;

  const step = incrementForCategory(resolvedCategory);
  const ramp = liveRamp;
  const showRamp = ramp.length > 0;
  const CategoryIcon = resolvedCategory === "bodyweight" || resolvedCategory === "cable" ? Activity : Dumbbell;

  const nudge = (setter: (value: string) => void, current: string, delta: number, min: number) => {
    const parsed = Number.parseFloat(current);
    const base = Number.isFinite(parsed) ? parsed : min;
    setter(String(Math.max(min, Math.round((base + delta) * 10) / 10)));
  };

  const choosePreset = (id: CalibrationPresetId) => {
    setPreset(id);
    const next = onCalibrate?.(id) ?? null;
    if (!next) return;
    setWeight(String(next.weightKg));
    setRepsValue(String(next.reps));
  };

  const applyOverload = () => {
    if (!canApply) return;
    onApply({ weightKg: weightNumber, reps: repsNumber, includeWarmup: showRamp && includeWarmup });
    onClose();
  };

  const insertApproximationRamp = () => {
    if (ramp.length === 0) return;
    const editedLoad = Math.abs(safeWorkingWeight - weightKg) >= 0.001 || safeWorkingReps !== reps;
    onApply({
      weightKg: safeWorkingWeight,
      reps: safeWorkingReps,
      includeWarmup: true,
      customWarmupSets: ramp,
      onlyInsertWarmup: !editedLoad,
    });
    onClose();
  };

  const insertMobilityActivationSet = () => {
    onApply({
      weightKg: safeWorkingWeight,
      reps: safeWorkingReps,
      customWarmupSets: [mobilityProtocol.activationSet],
      onlyInsertWarmup: true,
    });
    onClose();
  };

  const headerTitle =
    activeTab === "overload"
      ? "Sobrecarga progresiva"
      : activeTab === "ramp"
        ? "Series de aproximación"
        : "Calentamiento articular";

  const HeaderIcon =
    activeTab === "overload" ? Sparkles : activeTab === "ramp" ? Layers : Flame;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: Z_INDEX.sheet,
        display: "flex",
        alignItems: "flex-end",
        background: SCRIM.modal,
        backdropFilter: GLASS.blurSubtle,
        WebkitBackdropFilter: GLASS.blurSubtle,
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
        className="max-h-[88vh] overflow-y-auto"
        style={{
          width: "100%",
          maxWidth: "560px",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: SPACE.md,
          padding: SPACE.card,
          borderTopLeftRadius: RADIUS.sheet,
          borderTopRightRadius: RADIUS.sheet,
          border: `1px solid ${GLASS.border}`,
          background: SURFACE.raised,
          boxShadow: GLASS.shadow,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: SPACE.sm }}>
          <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: SPACE.xs }}>
            <h3
              id={titleId}
              style={{
                margin: 0,
                fontSize: TYPE.title2.size,
                fontWeight: TYPE.title2.weight,
                color: TEXT.primary,
                display: "flex",
                alignItems: "center",
                gap: SPACE.xs,
              }}
            >
              <HeaderIcon size={18} strokeWidth={2} aria-hidden="true" style={{ color: ACCENT.text }} />
              {headerTitle}
            </h3>
            <p style={{ margin: 0, fontSize: TYPE.caption.size, color: TEXT.tertiary, overflowWrap: "break-word" }}>
              {exerciseName}
              {pendingSetNumber ? ` · serie ${pendingSetNumber}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: MOTION.minTouchTarget,
              minHeight: MOTION.minTouchTarget,
              borderRadius: RADIUS.pill,
              border: `1px solid ${GLASS.border}`,
              background: "transparent",
              color: TEXT.tertiary,
              cursor: "pointer",
            }}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {/* Apple Segmented Control: 3 Motores Cronos */}
        <div
          role="tablist"
          aria-label="Motores inteligentes de entrenamiento"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: SPACE.xs,
            padding: SPACE.xs,
            borderRadius: RADIUS.pill,
            background: SURFACE.sunken,
            border: `1px solid ${GLASS.border}`,
          }}
        >
          {(
            [
              { id: "overload", label: "Sobrecarga", Icon: Sparkles },
              { id: "ramp", label: "Aproximación", Icon: Layers },
              { id: "mobility", label: "Calentamiento", Icon: Flame },
            ] as const
          ).map(({ id, label, Icon }) => {
            const selected = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActiveTab(id)}
                className="flex min-h-10 items-center justify-center gap-1.5 rounded-full px-2 text-xs font-semibold transition-colors"
                style={{
                  background: selected ? GLASS.fillImmersive : "transparent",
                  color: selected ? TEXT.primary : TEXT.secondary,
                  border: `1px solid ${selected ? GLASS.borderStrong : "transparent"}`,
                  boxShadow: selected ? GLASS.shadow : undefined,
                  cursor: "pointer",
                }}
              >
                <Icon
                  size={13}
                  strokeWidth={2}
                  aria-hidden="true"
                  style={{ color: selected ? ACCENT.text : TEXT.tertiary }}
                />
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        {/* Equipment Context Pill */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: SPACE.xs }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              minHeight: 28,
              padding: `0 ${SPACE.sm}`,
              borderRadius: RADIUS.pill,
              border: `1px solid ${GLASS.border}`,
              background: SURFACE.sunken,
              color: TEXT.secondary,
              fontSize: TYPE.caption.size,
              fontWeight: 600,
            }}
          >
            <CategoryIcon size={13} strokeWidth={2} aria-hidden="true" />
            {CATEGORY_LABEL[resolvedCategory]}
            {equipmentLabel ? ` · ${equipmentLabel}` : ""}
          </span>
          {isBodyweight && (
            <span style={{ fontSize: TYPE.caption.size, color: TEXT.tertiary }}>El peso externo va a cero</span>
          )}
        </div>

        {/* MOTOR 1: SOBRECARGA */}
        {activeTab === "overload" && (
          <>
            {breakdownHint && (
              <p style={{ margin: 0, fontSize: TYPE.subhead.size, color: TEXT.secondary, overflowWrap: "break-word" }}>
                {breakdownHint}
              </p>
            )}

            {!hasHistory && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: SPACE.sm,
                  padding: SPACE.md,
                  borderRadius: RADIUS.control,
                  border: `1px solid ${ACCENT.border}`,
                  background: ACCENT.subtle,
                }}
              >
                <p style={{ margin: 0, fontSize: TYPE.subhead.size, fontWeight: 600, color: TEXT.primary }}>
                  Aún no tienes marcas en este ejercicio. ¿Cómo lo calibramos hoy?
                </p>
                {coldStartReason && (
                  <p style={{ margin: 0, fontSize: TYPE.caption.size, color: TEXT.secondary }}>
                    {coldStartReason}
                    {coldStartSourceLabel ? ` ${coldStartSourceLabel}.` : ""}
                  </p>
                )}
                <div
                  role="group"
                  aria-label="Nivel de exigencia"
                  style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: SPACE.xs }}
                >
                  {CALIBRATION_PRESETS.map((option) => {
                    const active = preset === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => choosePreset(option.id)}
                        aria-pressed={active}
                        title={option.label}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          minHeight: MOTION.minTouchTarget,
                          padding: `0 ${SPACE.sm}`,
                          borderRadius: RADIUS.control,
                          border: `1px solid ${active ? ACCENT.base : GLASS.border}`,
                          background: active ? ACCENT.subtle : SURFACE.sunken,
                          color: active ? TEXT.primary : TEXT.secondary,
                          fontSize: TYPE.caption.size,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        {option.short}
                      </button>
                    );
                  })}
                </div>
                {preset && (
                  <p style={{ margin: 0, fontSize: TYPE.caption.size, color: TEXT.tertiary }}>
                    {CALIBRATION_PRESETS.find((option) => option.id === preset)?.hint}
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span
                  style={{
                    fontSize: TYPE.label.size,
                    fontWeight: TYPE.label.weight,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: TEXT.tertiary,
                  }}
                >
                  {isBodyweight ? "Lastre (kg)" : "Peso (kg)"}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    aria-label="Bajar peso"
                    onClick={() => nudge(setWeight, weight, -step, 0)}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-neutral-900 text-neutral-200"
                  >
                    <Minus size={16} aria-hidden="true" />
                  </button>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.5"
                    min={0}
                    value={weight}
                    aria-label={isBodyweight ? "Lastre en kilogramos" : "Peso en kilogramos"}
                    onChange={(event) => setWeight(event.target.value)}
                    className="h-14 min-w-0 flex-1 rounded-xl border border-white/15 bg-neutral-950 text-center font-mono text-2xl font-extrabold text-white outline-none focus-visible:border-white/40"
                    style={{ fontVariantNumeric: NUMERIC.transform }}
                  />
                  <button
                    type="button"
                    aria-label="Subir peso"
                    onClick={() => nudge(setWeight, weight, step, 0)}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-neutral-900 text-neutral-200"
                  >
                    <Plus size={16} aria-hidden="true" />
                  </button>
                </div>
              </label>

              <label className="flex flex-col gap-1.5">
                <span
                  style={{
                    fontSize: TYPE.label.size,
                    fontWeight: TYPE.label.weight,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: TEXT.tertiary,
                  }}
                >
                  Repeticiones
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    aria-label="Bajar repeticiones"
                    onClick={() => nudge(setRepsValue, repsValue, -1, 1)}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-neutral-900 text-neutral-200"
                  >
                    <Minus size={16} aria-hidden="true" />
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    step="1"
                    min={1}
                    value={repsValue}
                    aria-label="Repeticiones"
                    onChange={(event) => setRepsValue(event.target.value)}
                    className="h-14 min-w-0 flex-1 rounded-xl border border-white/15 bg-neutral-950 text-center font-mono text-2xl font-extrabold text-white outline-none focus-visible:border-white/40"
                    style={{ fontVariantNumeric: NUMERIC.transform }}
                  />
                  <button
                    type="button"
                    aria-label="Subir repeticiones"
                    onClick={() => nudge(setRepsValue, repsValue, 1, 1)}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-neutral-900 text-neutral-200"
                  >
                    <Plus size={16} aria-hidden="true" />
                  </button>
                </div>
              </label>
            </div>

            {showRamp && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: SPACE.sm,
                  padding: SPACE.md,
                  borderRadius: RADIUS.control,
                  border: `1px solid ${GLASS.border}`,
                  background: SURFACE.sunken,
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: SPACE.sm }}>
                  <span style={{ fontSize: TYPE.subhead.size, fontWeight: 600, color: TEXT.primary }}>
                    Antes de {weight || 0} kg
                  </span>
                  <span style={{ fontSize: TYPE.caption.size, color: TEXT.tertiary }}>
                    {ramp.length} {ramp.length === 1 ? "serie" : "series"}
                  </span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: SPACE.xs }}>
                  {ramp.map((item, index) => (
                    <span
                      key={`${item.weightKg}-${index}`}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        minHeight: 28,
                        padding: `0 ${SPACE.sm}`,
                        borderRadius: RADIUS.pill,
                        border: `1px solid ${GLASS.border}`,
                        background: SURFACE.raised,
                        color: TEXT.secondary,
                        fontSize: TYPE.caption.size,
                        fontVariantNumeric: NUMERIC.transform,
                      }}
                    >
                      {item.weightKg > 0 ? `${item.weightKg} kg` : "Peso corporal"} × {item.reps}
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={includeWarmup}
                  onClick={() => setIncludeWarmup((value) => !value)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: SPACE.sm,
                    minHeight: MOTION.minTouchTarget,
                    padding: 0,
                    border: "none",
                    background: "transparent",
                    color: TEXT.primary,
                    cursor: "pointer",
                  }}
                >
                  <span style={{ fontSize: TYPE.subhead.size, fontWeight: 600 }}>Incluir Calentamiento</span>
                  <span
                    aria-hidden="true"
                    style={{
                      position: "relative",
                      width: 44,
                      height: 26,
                      flexShrink: 0,
                      borderRadius: RADIUS.pill,
                      border: `1px solid ${GLASS.border}`,
                      background: includeWarmup ? ACCENT.base : SURFACE.raised,
                      transition: `background ${MOTION.fast} ${MOTION.easeOut}`,
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        top: 2,
                        left: 2,
                        width: 20,
                        height: 20,
                        borderRadius: RADIUS.pill,
                        background: includeWarmup ? TEXT.onAccent : TEXT.tertiary,
                        transform: `translateX(${includeWarmup ? 18 : 0}px)`,
                        transition: `transform ${MOTION.fast} ${MOTION.spring}`,
                      }}
                    />
                  </span>
                </button>
              </div>
            )}

            <button
              type="button"
              disabled={!canApply}
              onClick={applyOverload}
              style={{
                minHeight: MOTION.minTouchTarget,
                borderRadius: RADIUS.control,
                border: "none",
                background: canApply ? ACCENT.base : SURFACE.sunken,
                color: canApply ? TEXT.onAccent : TEXT.disabled,
                fontSize: TYPE.subhead.size,
                fontWeight: 700,
                cursor: canApply ? "pointer" : "not-allowed",
              }}
            >
              Aplicar sobrecarga
            </button>
          </>
        )}

        {/* MOTOR 2: APROXIMACIÓN (RAMPA PAP) */}
        {activeTab === "ramp" && (
          <div className="flex flex-col gap-3">
            <div
              className="flex flex-wrap items-center justify-between gap-2 p-3"
              style={{
                borderRadius: RADIUS.control,
                background: SURFACE.sunken,
                border: `1px solid ${GLASS.border}`,
              }}
            >
              <div>
                <p style={{ margin: 0, fontSize: TYPE.label.size, fontWeight: TYPE.label.weight, color: TEXT.tertiary }}>
                  CARGA OBJETIVO DE TRABAJO
                </p>
                <p
                  className="mt-0.5 font-mono text-lg font-bold"
                  style={{ fontVariantNumeric: NUMERIC.transform, color: TEXT.primary }}
                >
                  {isBodyweight ? "Peso corporal" : `${safeWorkingWeight} kg`} × {safeWorkingReps} reps
                </p>
              </div>
              {!isBodyweight && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    aria-label="Bajar carga objetivo"
                    onClick={() => nudge(setWeight, weight, -step, 0)}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-neutral-900 text-neutral-200"
                  >
                    <Minus size={15} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label="Subir carga objetivo"
                    onClick={() => nudge(setWeight, weight, step, 0)}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-neutral-900 text-neutral-200"
                  >
                    <Plus size={15} aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>

            {showRamp ? (
              <div className="flex flex-col gap-2">
                {ramp.map((item, index) => {
                  const pct =
                    !isBodyweight && safeWorkingWeight > 0
                      ? Math.round((item.weightKg / safeWorkingWeight) * 100)
                      : null;
                  const stepHint =
                    station && item.weightKg > 0
                      ? getLoadBreakdownHint(item.weightKg, station, equipmentLabel ?? undefined, resolvedCategory)
                      : null;
                  return (
                    <div
                      key={`pap-${index}`}
                      className="flex items-start justify-between gap-3 p-3"
                      style={{
                        borderRadius: RADIUS.control,
                        background: GLASS.fillSubtle,
                        border: `1px solid ${GLASS.border}`,
                      }}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold"
                            style={{
                              fontVariantNumeric: NUMERIC.transform,
                              background: ACCENT.subtle,
                              color: ACCENT.text,
                              border: `1px solid ${ACCENT.border}`,
                            }}
                          >
                            W{index + 1}
                            {pct !== null ? ` · ${pct}%` : ""}
                          </span>
                          <span style={{ fontSize: TYPE.caption.size, color: TEXT.secondary }}>
                            {rampPurposeFor(index, ramp.length)}
                          </span>
                        </div>
                        {stepHint && (
                          <p className="mt-1" style={{ margin: 0, fontSize: TYPE.caption.size, color: TEXT.tertiary }}>
                            {stepHint}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <span
                          className="font-mono text-sm font-bold"
                          style={{ fontVariantNumeric: NUMERIC.transform, color: TEXT.primary }}
                        >
                          {item.weightKg > 0 ? `${item.weightKg} kg` : "Corporal"} × {item.reps}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                className="p-4 text-center"
                style={{
                  borderRadius: RADIUS.control,
                  background: SURFACE.sunken,
                  border: `1px solid ${GLASS.border}`,
                }}
              >
                <p style={{ margin: 0, fontSize: TYPE.subhead.size, color: TEXT.secondary }}>
                  Define tu carga objetivo arriba para calcular la rampa PAP automática.
                </p>
              </div>
            )}

            <button
              type="button"
              disabled={!showRamp}
              onClick={insertApproximationRamp}
              style={{
                minHeight: MOTION.minTouchTarget,
                borderRadius: RADIUS.control,
                border: "none",
                background: showRamp ? ACCENT.base : SURFACE.sunken,
                color: showRamp ? TEXT.onAccent : TEXT.disabled,
                fontSize: TYPE.subhead.size,
                fontWeight: 700,
                cursor: showRamp ? "pointer" : "not-allowed",
              }}
            >
              Insertar {ramp.length} {ramp.length === 1 ? "serie" : "series"} de aproximación (W)
            </button>
          </div>
        )}

        {/* MOTOR 3: CALENTAMIENTO ARTICULAR */}
        {activeTab === "mobility" && (
          <div className="flex flex-col gap-3">
            <div
              className="p-3"
              style={{
                borderRadius: RADIUS.control,
                background: SURFACE.sunken,
                border: `1px solid ${GLASS.border}`,
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span style={{ fontSize: TYPE.subhead.size, fontWeight: 700, color: TEXT.primary }}>
                  {mobilityProtocol.familyLabel}
                </span>
                <span
                  className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                  style={{
                    fontVariantNumeric: NUMERIC.transform,
                    background: ACCENT.subtle,
                    color: ACCENT.text,
                    border: `1px solid ${ACCENT.border}`,
                  }}
                >
                  {mobilityProtocol.durationBadge}
                </span>
              </div>
              <p className="mt-1" style={{ margin: 0, fontSize: TYPE.caption.size, color: TEXT.secondary }}>
                {mobilityProtocol.summary}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              {mobilityProtocol.steps.map((stepItem, idx) => (
                <div
                  key={stepItem.id}
                  className="p-3"
                  style={{
                    borderRadius: RADIUS.control,
                    background: GLASS.fillSubtle,
                    border: `1px solid ${GLASS.border}`,
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p style={{ margin: 0, fontSize: TYPE.subhead.size, fontWeight: 600, color: TEXT.primary }}>
                        <span
                          className="mr-1.5 font-mono"
                          style={{ fontVariantNumeric: NUMERIC.transform, color: ACCENT.text }}
                        >
                          0{idx + 1}
                        </span>
                        {stepItem.title}
                      </p>
                      <p className="mt-0.5" style={{ margin: 0, fontSize: TYPE.caption.size, color: TEXT.tertiary }}>
                        {stepItem.focusZone}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <span
                        className="rounded-full px-2 py-0.5 font-mono text-xs font-semibold"
                        style={{
                          fontVariantNumeric: NUMERIC.transform,
                          background: SURFACE.sunken,
                          color: TEXT.primary,
                          border: `1px solid ${GLASS.border}`,
                        }}
                      >
                        {stepItem.doseLabel}
                      </span>
                    </div>
                  </div>
                  <p className="mt-1.5" style={{ margin: 0, fontSize: TYPE.caption.size, color: TEXT.secondary }}>
                    {stepItem.cue} · {stepItem.tempoLabel}
                  </p>
                </div>
              ))}
            </div>

            <div
              className="flex items-center justify-between gap-2 p-3"
              style={{
                borderRadius: RADIUS.control,
                background: SURFACE.sunken,
                border: `1px solid ${ACCENT.border}`,
              }}
            >
              <div>
                <p style={{ margin: 0, fontSize: TYPE.caption.size, fontWeight: 700, color: ACCENT.text }}>
                  {mobilityProtocol.activationSet.label}
                </p>
                <p style={{ margin: 0, fontSize: TYPE.caption.size, color: TEXT.secondary }}>
                  Activación neuromuscular suave antes de las series efectivas
                </p>
              </div>
              <span
                className="shrink-0 font-mono text-sm font-bold"
                style={{ fontVariantNumeric: NUMERIC.transform, color: TEXT.primary }}
              >
                {mobilityProtocol.activationSet.weightKg > 0
                  ? `${mobilityProtocol.activationSet.weightKg} kg`
                  : "Corporal"}{" "}
                × {mobilityProtocol.activationSet.reps}
              </span>
            </div>

            <button
              type="button"
              onClick={insertMobilityActivationSet}
              style={{
                minHeight: MOTION.minTouchTarget,
                borderRadius: RADIUS.control,
                border: "none",
                background: ACCENT.base,
                color: TEXT.onAccent,
                fontSize: TYPE.subhead.size,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              + Añadir serie de activación articular (W0)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

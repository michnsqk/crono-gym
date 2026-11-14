import { useEffect, useId, useState } from "react";
import { Activity, Dumbbell, Minus, Plus, Sparkles, X } from "lucide-react";
import {
  ACCENT,
  GLASS,
  MOTION,
  RADIUS,
  SCRIM,
  SPACE,
  SURFACE,
  TEXT,
  TYPE,
  Z_INDEX,
} from "@/design/tokens";
import {
  CALIBRATION_PRESETS,
  incrementForCategory,
  type CalibrationPresetId,
  type EquipmentCategory,
  type SmartWorkoutSet,
} from "@/lib/workout/cronosSmartEngine";

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
  /** The ramp that prepares this load, as the engine sizes it. */
  warmupRamp?: readonly SmartWorkoutSet[];
  /**
   * Applies a one-tap calibration. Returns the load the engine chose, so the
   * modal can show what was learned rather than a number the athlete typed.
   */
  onCalibrate?: (preset: CalibrationPresetId) => { weightKg: number; reps: number } | null;
  /** Writes the calibration to the model and fills every pending set. */
  onApply: (next: { weightKg: number; reps: number; includeWarmup?: boolean }) => void;
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

/**
 * The load, decided with the athlete instead of for them.
 *
 * Two cases, and the modal never pretends they are the same one. With history
 * it shows the recommendation and lets it be edited. Without history there is
 * nothing to recommend from, so it says so and asks -- one tap, because a
 * question that needs typing is a question nobody answers at the rack.
 *
 * The numbers are the load; the ramp is the honest part. A 100 kg top set is
 * three sets, not one, and the modal says which three before the athlete
 * commits, then leaves the warm-up off by default so a quick session stays
 * quick.
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
  warmupRamp,
  onCalibrate,
  onApply,
  pendingSetNumber,
}: SmartOverloadModalProps) {
  const titleId = useId();
  const [weight, setWeight] = useState(String(weightKg));
  const [repsValue, setRepsValue] = useState(String(reps));
  const [preset, setPreset] = useState<CalibrationPresetId | null>(null);
  const [includeWarmup, setIncludeWarmup] = useState(false);

  // The sheet is mounted once and reused across exercises, so it has to adopt
  // the new exercise's numbers every time it opens.
  useEffect(() => {
    if (!isOpen) return;
    setWeight(String(weightKg));
    setRepsValue(String(reps));
    setPreset(null);
    setIncludeWarmup(false);
  }, [isOpen, weightKg, reps]);

  if (!isOpen) return null;

  const weightNumber = Number.parseFloat(weight);
  const repsNumber = Number.parseInt(repsValue, 10);
  const weightValid = Number.isFinite(weightNumber) && weightNumber >= 0;
  const repsValid = Number.isFinite(repsNumber) && repsNumber > 0;
  const canApply = weightValid && repsValid;

  const resolvedCategory: EquipmentCategory = category ?? (isBodyweight ? "bodyweight" : "machine");
  const step = incrementForCategory(resolvedCategory);
  const ramp = warmupRamp ?? [];
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

  const apply = () => {
    if (!canApply) return;
    onApply({ weightKg: weightNumber, reps: repsNumber, includeWarmup: showRamp && includeWarmup });
    onClose();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: Z_INDEX.sheet,
        display: "flex",
        alignItems: "flex-end",
        background: SCRIM.modal,
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
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
              style={{ margin: 0, fontSize: TYPE.title2.size, fontWeight: TYPE.title2.weight, color: TEXT.primary, display: "flex", alignItems: "center", gap: SPACE.xs }}
            >
              <Sparkles size={18} strokeWidth={2} aria-hidden="true" style={{ color: ACCENT.text }} />
              Sobrecarga progresiva
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

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: SPACE.xs }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              minHeight: 28,
              padding: `0 ${SPACE.sm}px`,
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
                      padding: `0 ${SPACE.sm}px`,
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
            <span style={{ fontSize: TYPE.label.size, fontWeight: TYPE.label.weight, letterSpacing: "0.08em", textTransform: "uppercase", color: TEXT.tertiary }}>
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
            <span style={{ fontSize: TYPE.label.size, fontWeight: TYPE.label.weight, letterSpacing: "0.08em", textTransform: "uppercase", color: TEXT.tertiary }}>
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
              {ramp.map((set, index) => (
                <span
                  key={`${set.weightKg}-${index}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    minHeight: 28,
                    padding: `0 ${SPACE.sm}px`,
                    borderRadius: RADIUS.pill,
                    border: `1px solid ${GLASS.border}`,
                    background: SURFACE.raised,
                    color: TEXT.secondary,
                    fontSize: TYPE.caption.size,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {set.weightKg > 0 ? `${set.weightKg} kg` : "Peso corporal"} × {set.reps}
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
          onClick={apply}
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
      </div>
    </div>
  );
}
import { useMemo, useState } from "react";
import { Check, Disc, X } from "lucide-react";
import type { SetEntry } from "@/lib/workout/types";
import type { OverloadTarget } from "@/lib/overload";
import { GLASS, SCRIM, SURFACE, TEXT, TYPE, Z_INDEX } from "@/design/tokens";

export interface SetTrackerTableProps {
  index: number;
  entry: SetEntry;
  previousKg?: number | null;
  previousReps?: number | null;
  formatWeight?: (kg: number) => string;
  previousLabel?: string;
  overloadTarget?: OverloadTarget | null;
  onChange: (index: number, entry: SetEntry) => void;
  onRemove: (index: number) => void;
  onFillFromPrevious?: (index: number) => void;
  onOpenPlates?: (index: number, currentWeight: string) => void;
  canRemove?: boolean;
  totalSets?: number;
}

const SET_TYPE_OPTIONS: Array<{
  kind: NonNullable<SetEntry["kind"]>;
  badge: string;
  title: string;
  color: string;
  bg: string;
  border: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  help: string;
}> = [
  {
    kind: "normal",
    badge: "1",
    title: "Serie Normal (Working Set)",
    color: TEXT.primary,
    bg: "rgba(44, 44, 46, 1)",
    border: "rgba(255, 255, 255, 0.10)",
    badgeBg: "#3F3F46",
    badgeText: "#FFFFFF",
    badgeBorder: "transparent",
    help: "Serie efectiva de trabajo con tu peso objetivo manteniendo entre 1 y 3 repeticiones en reserva (RIR 1–3).",
  },
  {
    kind: "warmup",
    badge: "W",
    title: "Calentamiento (Warm-up)",
    color: "#FF9F0A",
    bg: "rgba(255, 159, 10, 0.15)",
    border: "rgba(255, 159, 10, 0.40)",
    badgeBg: "rgba(255, 159, 10, 0.20)",
    badgeText: "#FF9F0A",
    badgeBorder: "rgba(255, 159, 10, 0.40)",
    help: "Serie de aproximación con menor peso (40%–70%) para lubricar articulaciones y activar el sistema nervioso sin generar fatiga. No cuenta como serie efectiva.",
  },
  {
    kind: "failure",
    badge: "F",
    title: "Al Fallo Muscular (Failure)",
    color: "#FF3B30",
    bg: "rgba(255, 59, 48, 0.15)",
    border: "rgba(255, 59, 48, 0.40)",
    badgeBg: "rgba(255, 59, 48, 0.20)",
    badgeText: "#FF3B30",
    badgeBorder: "rgba(255, 59, 48, 0.40)",
    help: "Serie llevada al límite donde no puedes completar ni una repetición más con buena técnica (RIR 0 / RPE 10). Úsala preferiblemente en la última serie del ejercicio.",
  },
  {
    kind: "drop",
    badge: "D",
    title: "Serie Descendente (Drop Set)",
    color: "#BF5AF2",
    bg: "rgba(191, 90, 242, 0.15)",
    border: "rgba(191, 90, 242, 0.40)",
    badgeBg: "rgba(191, 90, 242, 0.20)",
    badgeText: "#BF5AF2",
    badgeBorder: "rgba(191, 90, 242, 0.40)",
    help: "Al terminar tus repeticiones cerca del fallo, reduces el peso inmediatamente entre un 20% y 30% y continúas sin descanso para maximizar el estrés metabólico.",
  },
];

export function SetTrackerTable({
  index,
  entry,
  previousKg,
  previousReps,
  formatWeight,
  onChange,
  onRemove,
  onFillFromPrevious,
  onOpenPlates,
  canRemove = false,
  totalSets = 1,
}: SetTrackerTableProps) {
  const setNumber = index + 1;
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const [helpKind, setHelpKind] = useState<SetEntry["kind"] | null>(null);

  const currentOption = useMemo(() => {
    const kind = entry.kind ?? "normal";
    return SET_TYPE_OPTIONS.find((o) => o.kind === kind) ?? SET_TYPE_OPTIONS[0];
  }, [entry.kind]);

  const previousText =
    previousKg != null && previousReps != null
      ? formatWeight
        ? `${formatWeight(previousKg)} × ${previousReps}`
        : `${previousKg}kg × ${previousReps}`
      : "—";

  const hasPrevious = previousKg != null && previousReps != null;
  const isCompleted = entry.completed;

  const openTypeMenu = () => {
    setTypeMenuOpen(true);
    setHelpKind(null);
  };

  const selectKind = (kind: NonNullable<SetEntry["kind"]>) => {
    onChange(index, { ...entry, kind });
    setTypeMenuOpen(false);
    setHelpKind(null);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate([15]);
    }
  };

  const badgeLabel = (entry.kind ?? "normal") === "normal" ? String(setNumber) : currentOption.badge;

  const handleFillFromPrevious = () => {
    if (hasPrevious && onFillFromPrevious) {
      onFillFromPrevious(index);
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate([15]);
      }
    }
  };

  const handleRemove = () => {
    if (canRemove) {
      onRemove(index);
    }
  };

  return (
    <div
      role="group"
      aria-label={`Serie ${setNumber}`}
      style={{
        display: "grid",
        gridTemplateColumns: "30px 44px minmax(0, 1fr) minmax(0, 1fr) 36px 32px 32px",
        alignItems: "center",
        gap: 4,
        padding: "6px 6px",
        borderBottom: index > 0 ? "1px solid rgba(255, 255, 255, 0.06)" : "none",
        background: isCompleted ? "rgba(48, 209, 88, 0.06)" : "transparent",
        borderRadius: 10,
        transition: "background 200ms ease",
        minHeight: 44,
      }}
    >
      {/* Serie Badge - Tap to open type selector */}
      <button
        type="button"
        onClick={openTypeMenu}
        aria-label={`Serie ${setNumber} tipo: ${currentOption.title}. Toca para cambiar.`}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 32,
          height: 32,
          borderRadius: 10,
          background: currentOption.bg,
          border: `1px solid ${currentOption.border}`,
          color: currentOption.color,
          fontSize: "12px",
          fontWeight: 700,
          fontFamily: TYPE.mono.font,
          fontVariantNumeric: "tabular-nums",
          cursor: "pointer",
          flexShrink: 0,
          transition:
            "transform 150ms ease, box-shadow 150ms ease, background 150ms ease, border-color 150ms ease",
        }}
        className="active:scale-[0.95]"
        onMouseDown={(e) => {
          e.currentTarget.style.transform = "scale(0.92)";
        }}
        onMouseUp={(e) => {
          e.currentTarget.style.transform = "scale(1)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
        }}
      >
        {badgeLabel}
      </button>

      {typeMenuOpen && (
        <div
          role="dialog"
          aria-label="Selector de tipo de serie"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: Z_INDEX.modal,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            background: SCRIM.modal,
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            padding: "16px",
          }}
          onClick={() => {
            setTypeMenuOpen(false);
            setHelpKind(null);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="rounded-3xl border border-white/12 p-4 shadow-2xl"
            style={{
              backgroundColor: SURFACE.l1,
              width: "100%",
              maxWidth: 520,
              maxHeight: "80vh",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 12,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <h3 className="text-base font-bold text-white" style={{ margin: 0 }}>
                  Tipo de serie
                </h3>
                <p className="text-xs text-neutral-400" style={{ margin: "4px 0 0" }}>
                  Selecciona el estímulo de la serie #{setNumber}
                </p>
              </div>
              <button
                type="button"
                aria-label="Cerrar selector de tipo de serie"
                onClick={() => {
                  setTypeMenuOpen(false);
                  setHelpKind(null);
                }}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 9999,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.06)",
                  color: "#D4D4D8",
                  fontSize: 18,
                  lineHeight: 1,
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {SET_TYPE_OPTIONS.map((opt) => {
                const selected = (entry.kind ?? "normal") === opt.kind;
                const optionBadge = opt.kind === "normal" ? String(setNumber) : opt.badge;
                const helpOpen = helpKind === opt.kind;
                return (
                  <div
                    key={opt.kind}
                    className="rounded-2xl border border-white/8 p-3 transition-all"
                    style={{
                      borderColor: selected ? opt.border : "rgba(255,255,255,0.08)",
                      background: selected ? "rgba(44,44,46,0.95)" : "#2C2C2E",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <button
                        type="button"
                        onClick={() => selectKind(opt.kind)}
                        aria-label={`Seleccionar ${opt.title}`}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          background: "transparent",
                          border: "none",
                          padding: 0,
                          color: "inherit",
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        <span
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 8,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: opt.badgeBg,
                            color: opt.badgeText,
                            border: `1px solid ${opt.badgeBorder}`,
                            fontSize: "12px",
                            fontWeight: 700,
                            fontFamily: TYPE.mono.font,
                            flexShrink: 0,
                          }}
                        >
                          {optionBadge}
                        </span>
                        <span style={{ fontSize: "14px", fontWeight: 600, color: TEXT.primary }}>
                          {opt.title}
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-label={`Ayuda: ${opt.title}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setHelpKind((prev) => (prev === opt.kind ? null : opt.kind));
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-white/8 font-mono text-xs font-bold text-neutral-300"
                        style={{ cursor: "pointer", flexShrink: 0 }}
                      >
                        ?
                      </button>
                    </div>
                    {helpOpen && (
                      <div className="mt-2 border-t border-white/8 pt-2 text-xs leading-relaxed text-neutral-300">
                        {opt.help}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Anterior - Tap to fill from previous */}
      <button
        type="button"
        onClick={handleFillFromPrevious}
        disabled={!hasPrevious}
        aria-label={
          hasPrevious ? `Rellenar con valores anteriores: ${previousText}` : "Sin datos anteriores"
        }
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minWidth: 0,
          width: "100%",
          height: "100%",
          minHeight: 34,
          fontSize: "11px",
          fontFamily: TYPE.mono.font,
          fontVariantNumeric: "tabular-nums",
          color: hasPrevious ? TEXT.secondary : TEXT.disabled,
          background: "transparent",
          border: "none",
          padding: "0 4px",
          textAlign: "center",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          cursor: hasPrevious ? "pointer" : "not-allowed",
          opacity: hasPrevious ? 1 : 0.4,
          transition: "color 150ms ease, background 150ms ease",
          borderRadius: 8,
        }}
        onMouseEnter={(e) => {
          if (hasPrevious) e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
      >
        {previousText}
      </button>

      {/* KG/LB Input + optional plate diagram shortcut */}
      <div style={{ display: "flex", alignItems: "center", gap: 3, minWidth: 0 }}>
        <input
          type="number"
          inputMode="decimal"
          aria-label={`Peso serie ${setNumber}`}
          value={entry.weight}
          placeholder="0"
          onChange={(e) => onChange(index, { ...entry, weight: e.target.value })}
          onFocus={(e) => {
            e.target.select();
          }}
          className="cronos-set-input"
          style={{
            flex: 1,
            minWidth: 0,
            width: "100%",
            height: 42,
            background: "#2C2C2E",
            border: "1px solid rgba(255, 255, 255, 0.10)",
            borderRadius: 12,
            padding: "0 4px",
            textAlign: "center",
            color: TEXT.primary,
            fontSize: "15px",
            fontFamily: TYPE.mono.font,
            fontVariantNumeric: "tabular-nums",
            fontWeight: 700,
            outline: "none",
            transition: "border-color 150ms ease, background 150ms ease",
          }}
          onFocusCapture={(e) => {
            e.currentTarget.style.borderColor = "rgba(255, 59, 48, 0.6)";
          }}
          onBlurCapture={(e) => {
            e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.10)";
          }}
        />
        {onOpenPlates && (
          <button
            type="button"
            onClick={() => onOpenPlates(index, entry.weight)}
            aria-label={`Calcular discos serie ${setNumber}`}
            title="Calcular discos por lado"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 24,
              height: 42,
              borderRadius: 10,
              border: `1px solid ${GLASS.border}`,
              background: SURFACE.sunken,
              color: TEXT.secondary,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <Disc size={12} strokeWidth={2} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* REPS Input */}
      <input
        type="number"
        inputMode="numeric"
        aria-label={`Repeticiones serie ${setNumber}`}
        value={entry.reps}
        placeholder="10"
        onChange={(e) => onChange(index, { ...entry, reps: e.target.value })}
        onFocus={(e) => {
          e.target.select();
        }}
        className="cronos-set-input"
        style={{
          width: "100%",
          height: 42,
          background: "#2C2C2E",
          border: "1px solid rgba(255, 255, 255, 0.10)",
          borderRadius: 12,
          padding: "0 4px",
          textAlign: "center",
          color: TEXT.primary,
          fontSize: "15px",
          fontFamily: TYPE.mono.font,
          fontVariantNumeric: "tabular-nums",
          fontWeight: 700,
          outline: "none",
          transition: "border-color 150ms ease, background 150ms ease",
        }}
        onFocusCapture={(e) => {
          e.currentTarget.style.borderColor = "rgba(255, 59, 48, 0.6)";
        }}
        onBlurCapture={(e) => {
          e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.10)";
        }}
      />

      {/* RPE Button */}
      <button
        type="button"
        aria-label={`RPE serie ${setNumber}: ${entry.rpe || "—"}`}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: 42,
          borderRadius: 12,
          background: "#2C2C2E",
          border: "1px solid rgba(255, 255, 255, 0.10)",
          color: TEXT.tertiary,
          fontSize: "16px",
          fontFamily: TYPE.mono.font,
          fontVariantNumeric: "tabular-nums",
          fontWeight: 700,
          cursor: "pointer",
          flexShrink: 0,
          transition: "transform 150ms ease",
        }}
        className="active:scale-[0.95]"
        onMouseDown={(e) => {
          e.currentTarget.style.transform = "scale(0.95)";
        }}
        onMouseUp={(e) => {
          e.currentTarget.style.transform = "scale(1)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
        }}
      >
        {entry.rpe || "—"}
      </button>

      {/* Check Button */}
      <button
        type="button"
        aria-label={
          isCompleted
            ? `Marcar la serie ${setNumber} como no completada`
            : `Marcar la serie ${setNumber} como completada`
        }
        onClick={() => {
          if (typeof navigator !== "undefined" && "vibrate" in navigator) {
            navigator.vibrate(isCompleted ? [15] : [40, 60, 80]);
          }
          onChange(index, { ...entry, completed: !entry.completed });
        }}
        className="rounded-full transition-transform active:scale-95"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 32,
          height: 32,
          borderRadius: 9999,
          background: isCompleted ? "#30D158" : "#2C2C2E",
          color: isCompleted ? "#000" : "rgba(255, 255, 255, 0.45)",
          border: isCompleted ? "1px solid #30D158" : "1px solid rgba(255, 255, 255, 0.06)",
          cursor: "pointer",
          flexShrink: 0,
          transition: "all 150ms ease",
          boxShadow: isCompleted ? "0 0 14px rgba(48, 209, 88, 0.45)" : "none",
        }}
      >
        <Check size={15} strokeWidth={3} />
      </button>

      {/* Remove Button */}
      {canRemove && totalSets > 1 && (
        <button
          type="button"
          onClick={handleRemove}
          aria-label={`Eliminar serie ${setNumber}`}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 32,
            height: 32,
            borderRadius: 10,
            background: "rgba(122, 47, 61, 0.15)",
            border: "1px solid rgba(224, 141, 156, 0.3)",
            color: "#E08D9C",
            cursor: "pointer",
            flexShrink: 0,
            transition: "all 150ms ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(122, 47, 61, 0.3)";
            e.currentTarget.style.borderColor = "rgba(224, 141, 156, 0.6)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(122, 47, 61, 0.15)";
            e.currentTarget.style.borderColor = "rgba(224, 141, 156, 0.3)";
          }}
        >
          <X size={14} strokeWidth={2} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

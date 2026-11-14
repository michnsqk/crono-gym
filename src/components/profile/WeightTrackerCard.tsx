/**
 * WeightTrackerCard.tsx — Apple Health-inspired monthly bodyweight control card.
 *
 * Displays:
 *  - Current weight + delta vs previous month
 *  - Progress bar toward goal weight (when set)
 *  - `+ Registrar pesaje` inline form (kg, date, quick note)
 *  - Clean SVG monthly evolution chart (last 6 months)
 *  - Recent weigh-in log list with delete option
 */

import { useMemo, useState } from "react";
import { Plus, Scale, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import {
  ACCENT,
  GLASS,
  NUMERIC,
  SOLID,
  SPACE,
  STATUS,
  SURFACE,
  TEXT,
  TYPE,
} from "@/design/tokens";
import {
  computeMonthlyWeightDelta,
  deleteWeightEntry,
  getMonthlyChartPoints,
  normalizeDateIso,
  recordWeightEntry,
  type WeightHistoryEntry,
} from "@/lib/profile/weightHistoryStore";

interface WeightTrackerCardProps {
  userId?: string;
  currentProfileWeightKg: number | null;
  goalWeightKg: number | null;
  entries: WeightHistoryEntry[];
  onEntriesChange: (next: WeightHistoryEntry[]) => void;
  onSyncProfileWeight?: (weightKg: number) => void;
}

export function WeightTrackerCard({
  userId,
  currentProfileWeightKg,
  goalWeightKg,
  entries,
  onEntriesChange,
  onSyncProfileWeight,
}: WeightTrackerCardProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [weightInput, setWeightInput] = useState(
    currentProfileWeightKg ? String(currentProfileWeightKg) : "",
  );
  const [dateInput, setDateInput] = useState(() => normalizeDateIso());
  const [noteInput, setNoteInput] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { latest, deltaKg } = useMemo(
    () => computeMonthlyWeightDelta(entries),
    [entries],
  );
  const chartPoints = useMemo(() => getMonthlyChartPoints(entries, 6), [entries]);

  const effectiveWeight = latest?.weightKg ?? currentProfileWeightKg;

  const goalProgress = useMemo(() => {
    if (effectiveWeight === null || goalWeightKg === null || goalWeightKg <= 0) {
      return null;
    }
    const diff = Math.round((effectiveWeight - goalWeightKg) * 10) / 10;
    const startWeight = entries.length > 0 ? entries[0].weightKg : effectiveWeight;
    const totalSpan = Math.abs(startWeight - goalWeightKg);
    const covered = Math.abs(startWeight - effectiveWeight);
    const pct =
      totalSpan > 0.1
        ? Math.max(8, Math.min(100, Math.round((covered / totalSpan) * 100)))
        : Math.abs(diff) <= 0.3
          ? 100
          : 40;
    return { diff, pct };
  }, [effectiveWeight, goalWeightKg, entries]);

  const handleSave = () => {
    const parsed = Number(weightInput.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed < 25 || parsed > 300) {
      setErrorMsg("Ingresa un peso válido entre 25 y 300 kg.");
      return;
    }
    setErrorMsg(null);
    const next = recordWeightEntry(
      { weightKg: parsed, date: dateInput, note: noteInput },
      userId,
    );
    onEntriesChange(next);
    if (onSyncProfileWeight) {
      onSyncProfileWeight(Math.round(parsed * 10) / 10);
    }
    setNoteInput("");
    setFormOpen(false);
  };

  const handleDelete = (id: string) => {
    const next = deleteWeightEntry(id, userId);
    onEntriesChange(next);
  };

  return (
    <section
      aria-label="Control mensual de peso corporal"
      className="rounded-3xl p-4 sm:p-5 space-y-4"
      style={{
        backgroundColor: SOLID.card,
        border: `1px solid ${GLASS.border}`,
        marginBottom: SPACE.lg,
      }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className="h-9 w-9 shrink-0 rounded-full flex items-center justify-center"
            style={{ backgroundColor: ACCENT.subtle, color: ACCENT.text }}
          >
            <Scale className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3
              className="text-sm font-semibold tracking-tight truncate"
              style={{ color: TEXT.primary }}
            >
              Control Mensual de Peso
            </h3>
            <p className="text-xs truncate" style={{ color: TEXT.tertiary }}>
              Seguimiento mensual sincronizado con tu Coach
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setWeightInput(effectiveWeight ? String(effectiveWeight) : "");
            setDateInput(normalizeDateIso());
            setFormOpen((v) => !v);
          }}
          className="h-9 px-3 rounded-full inline-flex items-center gap-1.5 text-xs font-semibold shrink-0"
          style={{
            backgroundColor: formOpen ? GLASS.fillRaised : ACCENT.subtle,
            color: formOpen ? TEXT.secondary : ACCENT.text,
            border: `1px solid ${formOpen ? GLASS.border : ACCENT.base}`,
          }}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{formOpen ? "Cerrar" : "Registrar pesaje"}</span>
        </button>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 gap-2.5">
        <div
          className="rounded-2xl p-3"
          style={{
            backgroundColor: SURFACE.base,
            border: `1px solid ${GLASS.border}`,
          }}
        >
          <span className="text-[11px] uppercase tracking-wider" style={{ color: TEXT.tertiary }}>
            Peso actual
          </span>
          <p
            className="text-xl font-bold mt-0.5"
            style={{
              color: TEXT.primary,
              fontFamily: TYPE.mono.font,
              fontVariantNumeric: NUMERIC.align,
            }}
          >
            {effectiveWeight !== null ? `${effectiveWeight} kg` : "Sin registro"}
          </p>
        </div>

        <div
          className="rounded-2xl p-3"
          style={{
            backgroundColor: SURFACE.base,
            border: `1px solid ${GLASS.border}`,
          }}
        >
          <span className="text-[11px] uppercase tracking-wider" style={{ color: TEXT.tertiary }}>
            Cambio vs mes previo
          </span>
          <div className="flex items-center gap-1.5 mt-0.5">
            {deltaKg !== null ? (
              <>
                {deltaKg <= 0 ? (
                  <TrendingDown
                    className="h-4 w-4 shrink-0"
                    style={{ color: STATUS.progression.text }}
                    aria-hidden="true"
                  />
                ) : (
                  <TrendingUp
                    className="h-4 w-4 shrink-0"
                    style={{ color: STATUS.warning.text }}
                    aria-hidden="true"
                  />
                )}
                <span
                  className="text-xl font-bold"
                  style={{
                    color: deltaKg <= 0 ? STATUS.progression.text : STATUS.warning.text,
                    fontFamily: TYPE.mono.font,
                    fontVariantNumeric: NUMERIC.align,
                  }}
                >
                  {deltaKg > 0 ? `+${deltaKg}` : deltaKg} kg
                </span>
              </>
            ) : (
              <span
                className="text-sm font-medium"
                style={{ color: TEXT.secondary }}
              >
                Primer registro
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Goal progress bar */}
      {goalProgress !== null && goalWeightKg !== null ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span style={{ color: TEXT.secondary }}>
              Meta corporal:{" "}
              <strong style={{ color: TEXT.primary, fontFamily: TYPE.mono.font }}>
                {goalWeightKg} kg
              </strong>
            </span>
            <span
              style={{
                color: TEXT.tertiary,
                fontFamily: TYPE.mono.font,
                fontVariantNumeric: NUMERIC.align,
              }}
            >
              {goalProgress.diff === 0
                ? "Meta alcanzada"
                : `${goalProgress.diff > 0 ? `${goalProgress.diff} kg por bajar` : `${Math.abs(goalProgress.diff)} kg por subir`}`}
            </span>
          </div>
          <div
            className="h-2 w-full rounded-full overflow-hidden"
            style={{ backgroundColor: GLASS.fillRaised }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${goalProgress.pct}%`,
                backgroundColor: ACCENT.base,
              }}
            />
          </div>
        </div>
      ) : null}

      {/* Inline Weigh-In Form */}
      {formOpen ? (
        <div
          className="rounded-2xl p-3.5 space-y-3"
          style={{
            backgroundColor: SURFACE.base,
            border: `1px solid ${GLASS.borderStrong}`,
          }}
        >
          <div className="grid grid-cols-2 gap-2.5">
            <label className="block">
              <span className="text-[11px] block mb-1" style={{ color: TEXT.tertiary }}>
                Peso (kg)
              </span>
              <input
                type="number"
                step="0.1"
                min="25"
                max="300"
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                placeholder="78.5"
                className="w-full h-10 px-3 rounded-xl text-sm outline-none"
                style={{
                  backgroundColor: GLASS.fillRaised,
                  border: `1px solid ${GLASS.border}`,
                  color: TEXT.primary,
                  fontFamily: TYPE.mono.font,
                }}
              />
            </label>
            <label className="block">
              <span className="text-[11px] block mb-1" style={{ color: TEXT.tertiary }}>
                Fecha del pesaje
              </span>
              <input
                type="date"
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
                className="w-full h-10 px-3 rounded-xl text-sm outline-none"
                style={{
                  backgroundColor: GLASS.fillRaised,
                  border: `1px solid ${GLASS.border}`,
                  color: TEXT.primary,
                }}
              />
            </label>
          </div>
          <label className="block">
            <span className="text-[11px] block mb-1" style={{ color: TEXT.tertiary }}>
              Nota breve (opcional)
            </span>
            <input
              type="text"
              maxLength={80}
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              placeholder="Ej. En ayunas, post-descarga..."
              className="w-full h-10 px-3 rounded-xl text-sm outline-none"
              style={{
                backgroundColor: GLASS.fillRaised,
                border: `1px solid ${GLASS.border}`,
                color: TEXT.primary,
              }}
            />
          </label>
          {errorMsg ? (
            <p className="text-xs" style={{ color: STATUS.warning.text }}>
              {errorMsg}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="h-9 px-3.5 rounded-full text-xs font-medium"
              style={{
                backgroundColor: GLASS.fillRaised,
                color: TEXT.secondary,
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="h-9 px-4 rounded-full text-xs font-semibold"
              style={{
                backgroundColor: ACCENT.base,
                color: TEXT.onAccent,
              }}
            >
              Guardar pesaje
            </button>
          </div>
        </div>
      ) : null}

      {/* Apple Health-style Monthly SVG Line/Area Chart */}
      {chartPoints.length > 0 ? (
        <div
          className="rounded-2xl p-3"
          style={{
            backgroundColor: SURFACE.base,
            border: `1px solid ${GLASS.border}`,
          }}
        >
          <MonthlyWeightSvgChart points={chartPoints} />
        </div>
      ) : (
        <p className="text-xs py-2" style={{ color: TEXT.tertiary }}>
          Registra tu primer pesaje mensual para visualizar la gráfica de evolución.
        </p>
      )}

      {/* Recent Weigh-in Log */}
      {entries.length > 0 ? (
        <ul className="space-y-1.5" aria-label="Historial de pesajes">
          {[...entries]
            .reverse()
            .slice(0, 4)
            .map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl"
                style={{
                  backgroundColor: GLASS.fill,
                  border: `1px solid ${GLASS.border}`,
                }}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs font-semibold"
                      style={{
                        color: TEXT.primary,
                        fontFamily: TYPE.mono.font,
                        fontVariantNumeric: NUMERIC.align,
                      }}
                    >
                      {entry.weightKg} kg
                    </span>
                    <span className="text-[11px]" style={{ color: TEXT.tertiary }}>
                      {entry.date}
                    </span>
                  </div>
                  {entry.note ? (
                    <p className="text-[11px] truncate" style={{ color: TEXT.secondary }}>
                      {entry.note}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(entry.id)}
                  aria-label={`Eliminar pesaje del ${entry.date}`}
                  className="h-7 w-7 rounded-full flex items-center justify-center shrink-0"
                  style={{ color: TEXT.tertiary }}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </li>
            ))}
        </ul>
      ) : null}
    </section>
  );
}

function MonthlyWeightSvgChart({
  points,
}: {
  points: { monthKey: string; label: string; weightKg: number }[];
}) {
  const width = 320;
  const height = 104;
  const padX = 22;
  const padTop = 14;
  const padBottom = 24;
  const usableW = width - padX * 2;
  const usableH = height - padTop - padBottom;

  const weights = points.map((p) => p.weightKg);
  const minW = Math.min(...weights) - 1;
  const maxW = Math.max(...weights) + 1;
  const span = maxW - minW || 1;

  const coords = points.map((p, idx) => {
    const x =
      points.length === 1
        ? width / 2
        : padX + (idx / (points.length - 1)) * usableW;
    const y = padTop + (1 - (p.weightKg - minW) / span) * usableH;
    return { ...p, x, y };
  });

  const polyline = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const areaPath =
    coords.length > 1
      ? `M ${coords[0].x.toFixed(1)},${(height - padBottom).toFixed(1)} L ${coords
          .map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`)
          .join(" L ")} L ${coords[coords.length - 1].x.toFixed(1)},${(
          height - padBottom
        ).toFixed(1)} Z`
      : "";

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-24 overflow-visible"
      role="img"
      aria-label="Gráfica mensual de peso corporal"
    >
      <defs>
        <linearGradient id="cronosWeightGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={ACCENT.base} stopOpacity="0.28" />
          <stop offset="100%" stopColor={ACCENT.base} stopOpacity="0" />
        </linearGradient>
      </defs>

      {areaPath ? <path d={areaPath} fill="url(#cronosWeightGrad)" /> : null}
      {coords.length > 1 ? (
        <polyline
          fill="none"
          stroke={ACCENT.base}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={polyline}
        />
      ) : null}

      {coords.map((c, idx) => (
        <g key={c.monthKey}>
          <circle
            cx={c.x}
            cy={c.y}
            r={idx === coords.length - 1 ? 4.2 : 3}
            fill={idx === coords.length - 1 ? ACCENT.base : SOLID.card}
            stroke={ACCENT.base}
            strokeWidth="1.8"
          />
          <text
            x={c.x}
            y={c.y - 7}
            textAnchor="middle"
            fontSize="9"
            fill={TEXT.secondary}
            style={{ fontFamily: TYPE.mono.font }}
          >
            {c.weightKg}
          </text>
          <text
            x={c.x}
            y={height - 6}
            textAnchor="middle"
            fontSize="9"
            fill={TEXT.tertiary}
          >
            {c.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

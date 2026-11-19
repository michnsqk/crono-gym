/**
 * MuscleRankDetail.tsx — iOS 18 OLED bottom sheet for one muscle's rank breakdown.
 *
 * Pure presentation over `MuscleRank` + `RankHistoryRecord[]`: keeps the focus
 * trap, Escape/backdrop dismiss, accessible progressbar, and concrete ascent
 * simulator without nested glass cards.
 */

import { useEffect, useId, useMemo, useRef } from "react";
import { ArrowUpRight, Dumbbell, Flame, Sparkles, X } from "lucide-react";
import { ACCENT, GLASS, SURFACE, TEXT } from "@/design/tokens";
import { RANK_LABELS as T } from "@/lib/i18n";
import { isMuscleClassified, type MuscleRank } from "@/lib/ranks/buildRankMap";
import { CONFIDENCE_LABELS } from "@/lib/ranks/rankConfig";
import type { RankHistoryRecord } from "@/lib/ranks/rankHistory";
import { computeAscentGoal } from "@/lib/ranks/symmetry";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export interface MuscleRankDetailProps {
  entry: MuscleRank;
  history: RankHistoryRecord[];
  onClose: () => void;
  onBrowseExercises?: () => void;
  bodyweightKg?: number | null;
}

export function MuscleRankDetail({
  entry,
  history,
  onClose,
  onBrowseExercises,
  bodyweightKg = null,
}: MuscleRankDetailProps) {
  const titleId = useId();
  const resolvedTitleId = "muscle-rank-title";
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    return () => {
      openerRef.current?.focus();
    };
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab" || !dialogRef.current) return;
    const focusables = [...dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const classified = isMuscleClassified(entry);
  const { detail, progress } = entry;
  const ascent = useMemo(
    () => computeAscentGoal(entry, bodyweightKg),
    [entry, bodyweightKg],
  );
  const sortedHistory = useMemo(
    () =>
      [...history].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)),
    [history],
  );

  const strengthPct = Math.round(detail.strength?.volumePercent ?? 0);
  const volumePct = Math.round(detail.volume.volumePercent);
  const progressPct = Math.round(progress.percent * 100);
  const sets28d = detail.volume.sets28d ?? detail.volume.effectiveSets;
  const daysSince = detail.volume.daysSinceLastSet;

  const rankLabelMap = useMemo(() => {
    const map: Record<string, string> = {
      unranked: "Sin clasificar",
      bronze: "Hierro",
      silver: "Bronce",
      gold: "Plata",
      platinum: "Oro",
      diamond: "Platino",
      elite: "Diamante",
      obsidian: "Cronos (Élite)",
    };
    return map;
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={resolvedTitleId}
        aria-describedby={titleId}
        onKeyDown={handleKeyDown}
        className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-t-3xl border border-white/10 p-5 text-white shadow-2xl sm:rounded-2xl"
        style={{ backgroundColor: SURFACE.l1 }}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20 sm:hidden" aria-hidden="true" />

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                style={{
                  backgroundColor: SURFACE.l2,
                  color: entry.rank.oledColor,
                  borderColor: GLASS.border,
                }}
              >
                <span aria-hidden="true">{entry.rank.glyph}</span>
                {classified ? progress.displayLabel : entry.rank.label}
              </span>
              {detail.volume.coolingDown && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{ backgroundColor: SURFACE.l2, color: TEXT.secondary }}
                >
                  <Flame className="h-3 w-3" aria-hidden="true" />
                  {T.coolingDown}
                </span>
              )}
            </div>
            <h2 id={resolvedTitleId} className="mt-2 truncate text-xl font-bold tracking-tight">
              {entry.label}
            </h2>
            <p id={titleId} className="mt-0.5 text-xs text-neutral-400">
              {daysSince === null
                ? T.decayNever
                : detail.volume.coolingDown
                  ? `${T.decayDays(daysSince)} · ${T.decayLost(Math.round(detail.volume.decayFactor * 100))}`
                  : T.decayNone}
              {classified ? ` · ${T.confidence}: ${CONFIDENCE_LABELS[entry.confidence]}` : ""}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {classified && (
              <div className="text-right">
                <span
                  className="block font-mono text-2xl font-bold tabular-nums leading-none"
                  style={{ color: entry.rank.oledColor }}
                >
                  {entry.score}
                </span>
                <span className="text-[11px] font-mono tabular-nums text-neutral-500">
                  / 100
                </span>
              </div>
            )}
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label={T.close}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 text-neutral-300 transition-transform duration-150 active:scale-[0.98]"
              style={{ backgroundColor: SURFACE.l2 }}
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Unranked branch */}
        {!classified && (
          <div
            className="mt-5 rounded-xl border border-white/10 p-4"
            style={{ backgroundColor: SURFACE.l2 }}
          >
            <p className="text-sm font-medium text-white">
              {entry.unrankedReason === "no_data" && "Sin datos todavía"}
              {entry.unrankedReason === "insufficient_sessions" &&
                `Tienes ${entry.detail.sessions} ${entry.detail.sessions === 1 ? "sesión" : "sesiones"} registradas (mínimo 3)`}
              {entry.unrankedReason === "unknown_bodyweight" &&
                "Falta tu peso corporal"}
              {entry.unrankedReason === "no_strength_signal" && T.oneRepMaxNoSet}
            </p>
            <p className="mt-1 text-xs text-neutral-400">
              {entry.unrankedReason === "no_data" &&
                "Registra al menos 3 sesiones de este músculo para calcular su rango."}
              {entry.unrankedReason === "insufficient_sessions" &&
                "Necesitamos al menos 3 sesiones distintas para clasificar este músculo con precisión."}
              {entry.unrankedReason === "unknown_bodyweight" &&
                T.emptyNoBodyweight}
              {entry.unrankedReason === "no_strength_signal" &&
                "Registra series de hasta 10 reps con carga para estimar tu fuerza."}
            </p>
          </div>
        )}

        {/* Classified breakdown */}
        {classified && (
          <>
            {/* Progress bar */}
            <div className="mt-4">
              <div
                className="h-1.5 w-full overflow-hidden rounded-full"
                style={{ backgroundColor: SURFACE.l2 }}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progressPct}
                aria-label={T.progressAria(progress.next?.label ?? T.atMaxLabel)}
              >
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${progressPct}%`,
                    backgroundColor: entry.rank.oledColor,
                  }}
                />
              </div>
            </div>

            {/* 2-bar Breakdown: Strength 70% + Consistency 28d 30% */}
            <div className="mt-5 space-y-3">
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-neutral-200">
                    {T.strength} <span className="text-neutral-500">· {T.strengthWeight}</span>
                  </span>
                  <span className="font-mono font-semibold tabular-nums text-white">
                    {strengthPct}%
                  </span>
                </div>
                <div
                  className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full"
                  style={{ backgroundColor: SURFACE.l2 }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${strengthPct}%`,
                      backgroundColor: entry.rank.oledColor,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-neutral-200">
                    {T.volume} <span className="text-neutral-500">· {T.volumeWeight} · {sets28d} series (28d)</span>
                  </span>
                  <span className="font-mono font-semibold tabular-nums text-white">
                    {volumePct}%
                  </span>
                </div>
                <div
                  className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full"
                  style={{ backgroundColor: SURFACE.l2 }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${volumePct}%`,
                      backgroundColor: TEXT.secondary,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Ascent Simulator Card (elevated SURFACE.l2, single level) */}
            <div
              className="mt-5 rounded-xl border border-white/10 p-3.5"
              style={{ backgroundColor: SURFACE.l2 }}
            >
              <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                <Sparkles
                  className="h-3.5 w-3.5 shrink-0"
                  style={{ color: entry.rank.oledColor }}
                  aria-hidden="true"
                />
                <span>
                  {progress.next
                    ? `Cómo subir a ${progress.nextSubTierLabel ?? progress.next.label}`
                    : T.atMaxLabel}
                </span>
              </div>
              {progress.next ? (
                <>
                  <p className="mt-1 text-xs text-neutral-300">
                    {T.pointsToNext(progress.pointsToNext, progress.next.label)}
                  </p>
                  {ascent && (
                    <p className="mt-1 font-mono text-xs font-semibold tabular-nums text-white">
                      {ascent.summary}
                    </p>
                  )}
                </>
              ) : (
                <p className="mt-1 text-xs text-neutral-300">{T.atTopRank}</p>
              )}
              {(() => {
                const top = detail.contributions.find((c) => c.bestSet && c.estimatedOneRepMax > 0);
                if (!top || !top.bestSet) {
                  return <p className="mt-1.5 text-[11px] text-neutral-400">{T.oneRepMaxNoSet}</p>;
                }
                return (
                  <p className="mt-1.5 text-[11px] text-neutral-400">
                    {T.oneRepMaxTitle}:{" "}
                    <span className="font-mono tabular-nums text-neutral-300">
                      {T.oneRepMaxFormulaHint(top.bestSet.weight, top.bestSet.reps, top.estimatedOneRepMax)}
                    </span>
                  </p>
                );
              })()}
            </div>
          </>
        )}

        {/* Top 3 contributing exercises (flat list, divide-y) */}
        {detail.contributions.length > 0 && (
          <section className="mt-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              {T.contributionsTitle}
            </h3>
            <ul className="mt-2 divide-y divide-white/5">
              {detail.contributions.slice(0, 3).map((c) => (
                <li key={c.exerciseId} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{c.name}</p>
                    <p className="text-[11px] text-neutral-400">
                      {c.counted ? T.contributionCounted : T.contributionNotCounted} ·{" "}
                      {c.contributionWeight === 1
                        ? T.contributionPrimary
                        : T.contributionSecondary}
                    </p>
                  </div>
                  <span className="shrink-0 text-right font-mono text-xs font-semibold tabular-nums text-neutral-200">
                    {c.estimatedOneRepMax > 0
                      ? `${c.estimatedOneRepMax.toFixed(1)} kg 1RM`
                      : T.contributionSets(c.workingSets)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Rank history */}
        <section className="mt-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
            {T.historyLabel}
          </h3>
          {sortedHistory.length === 0 ? (
            <p className="mt-1.5 text-xs text-neutral-400">{T.historyEmpty}</p>
          ) : sortedHistory.length === 1 ? (
            <>
              <p className="mt-1.5 text-xs text-neutral-400">{T.historyFirst}</p>
              <ul aria-label={T.historyLabel} className="mt-2 divide-y divide-white/5">
                {sortedHistory.map((item) => (
                  <li key={item.id} className="flex items-center justify-between py-2 text-xs">
                    <span className="font-medium text-white">
                      {rankLabelMap[item.rank] ?? item.rank}
                    </span>
                    <span className="font-mono tabular-nums text-neutral-400">{item.day}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <ul aria-label={T.historyLabel} className="mt-2 divide-y divide-white/5">
              {sortedHistory.slice(0, 5).map((item) => (
                <li key={item.id} className="flex items-center justify-between py-2 text-xs">
                  <span className="font-medium text-white">
                    {rankLabelMap[item.rank] ?? item.rank}
                  </span>
                  <span className="font-mono tabular-nums text-neutral-400">{item.day}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Primary CTA */}
        {onBrowseExercises && (
          <button
            type="button"
            onClick={onBrowseExercises}
            className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-white transition-transform duration-150 active:scale-[0.98]"
            style={{ backgroundColor: ACCENT.base, color: TEXT.primary }}
          >
            <Dumbbell className="h-4 w-4" aria-hidden="true" />
            Entrenar {entry.label}
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}

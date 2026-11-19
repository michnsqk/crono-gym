/**
 * AnatomicalRanksView.tsx — Apple Fitness+ / Apple Health iOS 18 OLED ranks view.
 *
 * Renders the Hero Biometric OLED arc, Bento Strongest/Focus cards, iOS 18
 * segmented control (Rangos | Volumen | Simetría), interactive body map,
 * 2-column Apple Health muscle grid with filters, and MuscleRankDetail sheet.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Award, ChevronRight, Flame, Scale, Sparkles, TrendingUp } from "lucide-react";
import type { Slug } from "react-muscle-highlighter";
import { MuscleSelector } from "./MuscleSelector";
import { MuscleRankDetail } from "./MuscleRankDetail";
import { useMuscleRanks } from "../hooks/useMuscleRanks";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { RANK_LABELS as T } from "../lib/i18n";
import {
  isMuscleClassified,
  oledColorByMuscle,
  type MuscleRank,
  type RankMap,
} from "../lib/ranks/buildRankMap";
import { EARNABLE_RANKS } from "../lib/ranks/rankConfig";
import {
  bucketForWeeklySets,
  heatmapColorByMuscle,
  weeklySetsFor,
} from "../lib/ranks/heatmapColors";
import {
  computeSymmetryMetrics,
  estimatePercentile,
  type SymmetryAxis,
} from "../lib/ranks/symmetry";
import { ACCENT, GLASS, SURFACE, TEXT } from "@/design/tokens";

type ViewTab = "ranks" | "volume" | "symmetry";
type MuscleFilter = "all" | "nearly" | "unranked";

export interface AnatomicalRanksViewProps {
  userId: string | null;
  onBrowseMuscle?: (slug: Slug) => void;
  initialDetail?: string | null;
  readOnly?: boolean;
}

export function AnatomicalRanksView({
  userId,
  onBrowseMuscle,
  initialDetail = null,
  readOnly = false,
}: AnatomicalRanksViewProps) {
  const ranks = useMuscleRanks(userId, { readOnly });
  const reducedMotion = useReducedMotion();
  const [detailSlug, setDetailSlug] = useState<string | null>(initialDetail);
  const [seenPromotions, setSeenPromotions] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<ViewTab>("ranks");
  const [filter, setFilter] = useState<MuscleFilter>("all");

  const map = ranks.map;

  const colors = useMemo(() => {
    if (!map) return new Map<Slug, string>();
    if (activeTab === "volume") return heatmapColorByMuscle(map);
    return oledColorByMuscle(map);
  }, [map, activeTab]);

  const symmetry = useMemo(() => {
    if (!map) return null;
    return computeSymmetryMetrics(map);
  }, [map]);

  const percentile = useMemo(
    () => (map ? estimatePercentile(map.globalScore) : null),
    [map],
  );

  const banner = useMemo(() => {
    if (reducedMotion || ranks.promotions.length === 0) return [];
    return ranks.promotions.filter((m) => !seenPromotions.includes(m.slug));
  }, [ranks.promotions, seenPromotions, reducedMotion]);

  useEffect(() => {
    if (ranks.promotions.length === 0) return;
    setSeenPromotions((current) => {
      const next = new Set(current);
      for (const m of ranks.promotions) next.add(m.slug);
      return next.size === current.length ? current : [...next];
    });
  }, [ranks.promotions]);

  const openDetail = useCallback((slug: Slug) => {
    setDetailSlug(slug);
  }, []);

  const closeDetail = useCallback(() => {
    setDetailSlug(null);
  }, []);

  const detail = useMemo<MuscleRank | null>(() => {
    if (!map || !detailSlug) return null;
    return map.muscles.get(detailSlug as Slug) ?? null;
  }, [map, detailSlug]);

  const detailHistory = useMemo(
    () => (detail ? ranks.historyFor(detail.slug) : []),
    [detail, ranks],
  );

  const filteredMuscles = useMemo(() => {
    if (!map) return [];
    const all = [...map.muscles.values()];
    if (filter === "nearly") {
      return all.filter((m) => isMuscleClassified(m) && m.progress.nearlyThere);
    }
    if (filter === "unranked") {
      return all.filter((m) => !isMuscleClassified(m));
    }
    return all;
  }, [map, filter]);

  return (
    <div
      className="w-full max-w-full overflow-x-hidden px-4 pb-28 pt-4 text-white"
      style={{ backgroundColor: SURFACE.base }}
    >
      <header className="mb-5">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-500">
          Cronos · Biomecánica
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">
          {T.title}
        </h1>
      </header>

      {banner.length > 0 && (
        <div
          role="status"
          className="mb-4 flex items-center gap-2.5 rounded-2xl border px-4 py-3 text-sm"
          style={{
            backgroundColor: SURFACE.l1,
            borderColor: ACCENT.base,
          }}
        >
          <Sparkles className="h-4 w-4 shrink-0" style={{ color: ACCENT.base }} aria-hidden="true" />
          <span className="min-w-0 font-medium">
            {banner.length === 1
              ? T.promoted(banner[0].label, banner[0].progress.displayLabel)
              : T.promotionCount(banner.length)}
          </span>
        </div>
      )}

      {ranks.initialLoading && (
        <p className="text-sm text-neutral-400">{T.loading}</p>
      )}

      {ranks.error && !map && (
        <div
          className="rounded-2xl border border-white/10 px-4 py-4"
          style={{ backgroundColor: SURFACE.l1 }}
        >
          <p className="text-sm text-neutral-200">{T.loadError}</p>
          <button
            type="button"
            onClick={() => void ranks.refresh()}
            className="mt-3 flex h-11 items-center rounded-xl px-4 text-xs font-semibold text-white transition-transform duration-150 active:scale-[0.98]"
            style={{ backgroundColor: ACCENT.base }}
          >
            {T.retry}
          </button>
        </div>
      )}

      {map && ranks.empty && (
        <EmptyState
          sessionsNeeded={ranks.sessionsNeeded}
          bodyweightKg={ranks.bodyweightKg}
        />
      )}

      {map && !ranks.empty && symmetry && (
        <div className="space-y-6">
          {/* 1. Hero Biometrico OLED */}
          <BiometricHero
            map={map}
            symmetryIndex={symmetry.symmetryIndex}
            percentile={percentile}
          />

          {/* 2. Bento Strongest & Focus */}
          <BentoComparison map={map} onSelectMuscle={openDetail} />

          {/* 3. Segmented Control iOS 18 */}
          <div
            role="tablist"
            aria-label="Modo de análisis anatómico"
            className="grid grid-cols-3 gap-1 rounded-xl p-1"
            style={{ backgroundColor: SURFACE.l2 }}
          >
            {(
              [
                { id: "ranks", label: "Rangos", icon: Award },
                { id: "volume", label: "Volumen", icon: Flame },
                { id: "symmetry", label: "Simetría", icon: Scale },
              ] as const
            ).map(({ id, label, icon: Icon }) => {
              const selected = activeTab === id;
              return (
                <button
                  key={id}
                  role="tab"
                  type="button"
                  aria-selected={selected}
                  onClick={() => setActiveTab(id)}
                  className="flex h-11 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-transform duration-150 active:scale-[0.98]"
                  style={{
                    backgroundColor: selected ? SURFACE.l1 : "transparent",
                    color: selected ? TEXT.primary : TEXT.secondary,
                  }}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">{label}</span>
                </button>
              );
            })}
          </div>

          {/* 4. Symmetry Panel or Interactive Map */}
          {activeTab === "symmetry" ? (
            <SymmetryCard
              pushPull={symmetry.pushPull}
              upperLower={symmetry.upperLower}
              insight={symmetry.insight}
            />
          ) : (
            <section
              className="rounded-2xl border border-white/10 p-4"
              style={{ backgroundColor: SURFACE.l1 }}
            >
              <MuscleSelector
                selected={[]}
                onChange={() => undefined}
                readOnly
                onSelectMuscle={openDetail}
                colorByMuscle={colors}
                legendLabel={
                  activeTab === "volume" ? "Mapa de volumen" : "Mapa de rangos"
                }
                className=""
                renderBadge={(slug) => {
                  const entry = map.muscles.get(slug);
                  if (!entry) return null;
                  return (
                    <span
                      aria-hidden="true"
                      className="font-mono text-[10px]"
                      style={{ color: entry.rank.oledColor }}
                    >
                      {entry.rank.glyph}
                    </span>
                  );
                }}
              />
            </section>
          )}

          {/* 5. Metallic Tier Legend */}
          <TierLegend />

          {/* 6. Apple Health 2-Column Muscle Grid */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-white">
                {T.bodyMapLegend}
              </h2>
              <div className="flex items-center gap-1.5" role="group" aria-label="Filtrar músculos">
                {(
                  [
                    { id: "all", label: T.filterAll },
                    { id: "nearly", label: "Cerca de subir" },
                    { id: "unranked", label: "Sin clasificar" },
                  ] as const
                ).map((pill) => {
                  const active = filter === pill.id;
                  return (
                    <button
                      key={pill.id}
                      type="button"
                      onClick={() => setFilter(pill.id)}
                      className="h-11 rounded-xl px-3 text-xs font-medium transition-transform duration-150 active:scale-[0.98]"
                      style={{
                        backgroundColor: active ? ACCENT.base : SURFACE.l2,
                        color: active ? TEXT.primary : TEXT.secondary,
                      }}
                    >
                      {pill.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {filteredMuscles.length === 0 ? (
              <p
                className="rounded-2xl border border-white/10 p-4 text-center text-xs text-neutral-400"
                style={{ backgroundColor: SURFACE.l1 }}
              >
                {T.noRankFilterMatch}
              </p>
            ) : (
              <ul
                aria-label={T.bodyMapLegend}
                className="grid grid-cols-2 gap-3"
              >
                {filteredMuscles.map((entry) => (
                  <MuscleGridCard
                    key={entry.slug}
                    entry={entry}
                    mode={activeTab}
                    onSelect={() => openDetail(entry.slug)}
                  />
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {detail && (
        <MuscleRankDetail
          entry={detail}
          history={detailHistory}
          onClose={closeDetail}
          bodyweightKg={ranks.bodyweightKg}
          onBrowseExercises={
            onBrowseMuscle ? () => onBrowseMuscle(detail.slug) : undefined
          }
        />
      )}
    </div>
  );
}

// ----------------------------------------------------------------- Subcomponents

function BiometricHero({
  map,
  symmetryIndex,
  percentile,
}: {
  map: RankMap;
  symmetryIndex: number | null;
  percentile: number | null;
}) {
  const rank = map.globalRank;
  const score = map.globalScore ?? 0;
  const arcColor = rank?.oledColor ?? TEXT.tertiary;

  // Semicircle path math: radius 88, center (110, 102)
  const radius = 88;
  const circumference = Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const offset = circumference * (1 - clamped / 100);

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-white/10 p-5"
      style={{ backgroundColor: SURFACE.l1 }}
    >
      {/* Subtle 8-10% glow behind the arc */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-12 left-1/2 h-40 w-56 -translate-x-1/2 rounded-full blur-3xl"
        style={{ backgroundColor: arcColor, opacity: 0.1 }}
      />

      <div className="relative flex flex-col items-center text-center">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
          {T.globalRank}
        </p>

        <div className="relative mt-2 w-full max-w-[220px]">
          <svg
            viewBox="0 0 220 120"
            className="w-full overflow-visible"
            aria-hidden="true"
          >
            <path
              d="M 22 102 A 88 88 0 0 1 198 102"
              fill="none"
              stroke={GLASS.border}
              strokeWidth="10"
              strokeLinecap="round"
            />
            <path
              d="M 22 102 A 88 88 0 0 1 198 102"
              fill="none"
              stroke={arcColor}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          </svg>
          <div className=" -mt-14 flex flex-col items-center">
            <span className="font-mono text-4xl font-bold tabular-nums leading-none text-white">
              {map.globalScore !== null ? map.globalScore : "—"}
            </span>
            <span className="mt-1 font-mono text-xs tabular-nums text-neutral-400">
              de 100
            </span>
          </div>
        </div>

        {rank && (
          <div
            className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1 text-xs font-semibold"
            style={{ backgroundColor: SURFACE.l2, color: rank.oledColor }}
          >
            <span aria-hidden="true">{rank.glyph}</span>
            <span>{rank.label}</span>
          </div>
        )}

        {map.pendingCount > 0 && (
          <p className="mt-2 text-xs text-neutral-400">
            {T.pendingMuscles(map.pendingCount)}
          </p>
        )}
      </div>

      {/* 3 compact micro-metrics */}
      <div className="mt-5 grid grid-cols-3 gap-2 border-t border-white/10 pt-4 text-center">
        <div className="min-w-0">
          <p className="font-mono text-base font-bold tabular-nums text-white">
            {map.classifiedCount}/{map.totalCount}
          </p>
          <p className="truncate text-[11px] text-neutral-400">
            músculos clasificados
          </p>
        </div>
        <div className="min-w-0 border-x border-white/10 px-1">
          <p className="font-mono text-base font-bold tabular-nums text-white">
            {symmetryIndex !== null ? `${symmetryIndex}%` : "—"}
          </p>
          <p className="truncate text-[11px] text-neutral-400">Simetría</p>
        </div>
        <div className="min-w-0">
          <p className="font-mono text-base font-bold tabular-nums text-white">
            {percentile !== null ? `Top ${percentile}%` : "—"}
          </p>
          <p className="truncate text-[11px] text-neutral-400">Percentil</p>
        </div>
      </div>
    </section>
  );
}

function BentoComparison({
  map,
  onSelectMuscle,
}: {
  map: RankMap;
  onSelectMuscle: (slug: Slug) => void;
}) {
  const strongest = map.strongest;
  const weakest = map.weakest;

  return (
    <section className="grid grid-cols-2 gap-3">
      <div
        className="min-w-0 rounded-2xl border border-white/10 p-4"
        style={{ backgroundColor: SURFACE.l1 }}
      >
        <div className="flex items-center gap-1.5 text-neutral-400">
          <TrendingUp className="h-3.5 w-3.5 shrink-0" style={{ color: ACCENT.base }} aria-hidden="true" />
          <p className="truncate text-[11px] font-semibold uppercase tracking-wider">
            {T.strongest}
          </p>
        </div>
        {strongest ? (
          <button
            type="button"
            onClick={() => onSelectMuscle(strongest.slug)}
            className="mt-2 flex min-h-11 w-full items-center justify-between gap-2 text-left transition-transform duration-150 active:scale-[0.98]"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">
                {strongest.label}
              </p>
              <p
                className="mt-0.5 font-mono text-xs font-semibold tabular-nums"
                style={{ color: strongest.rank.oledColor }}
              >
                {strongest.progress.displayLabel} · {strongest.score}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-neutral-500" aria-hidden="true" />
          </button>
        ) : (
          <p className="mt-3 text-xs text-neutral-400">—</p>
        )}
      </div>

      <div
        className="min-w-0 rounded-2xl border border-white/10 p-4"
        style={{ backgroundColor: SURFACE.l1 }}
      >
        <div className="flex items-center gap-1.5 text-neutral-400">
          <Flame className="h-3.5 w-3.5 shrink-0" style={{ color: TEXT.secondary }} aria-hidden="true" />
          <p className="truncate text-[11px] font-semibold uppercase tracking-wider">
            {T.weakest}
          </p>
        </div>
        {weakest ? (
          <button
            type="button"
            onClick={() => onSelectMuscle(weakest.slug)}
            className="mt-2 flex min-h-11 w-full items-center justify-between gap-2 text-left transition-transform duration-150 active:scale-[0.98]"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">
                {weakest.label}
              </p>
              <p
                className="mt-0.5 font-mono text-xs font-semibold tabular-nums"
                style={{ color: weakest.rank.oledColor }}
              >
                {weakest.progress.displayLabel} · {weakest.score}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-neutral-500" aria-hidden="true" />
          </button>
        ) : (
          <p className="mt-2 text-xs leading-relaxed text-neutral-400">
            Entrena un segundo músculo para comparar.
          </p>
        )}
      </div>
    </section>
  );
}

function SymmetryCard({
  pushPull,
  upperLower,
  insight,
}: {
  pushPull: SymmetryAxis;
  upperLower: SymmetryAxis;
  insight: string;
}) {
  return (
    <section
      className="space-y-4 rounded-2xl border border-white/10 p-4"
      style={{ backgroundColor: SURFACE.l1 }}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-white">{T.symmetryTitle}</h2>
      </div>

      <AxisRow axis={pushPull} />
      <AxisRow axis={upperLower} />

      <p
        className="rounded-xl border border-white/10 px-3 py-2.5 text-xs text-neutral-200"
        style={{ backgroundColor: SURFACE.l2 }}
      >
        {insight}
      </p>
    </section>
  );
}

function AxisRow({ axis }: { axis: SymmetryAxis }) {
  const left = axis.leftScore ?? 0;
  const right = axis.rightScore ?? 0;
  const total = left + right;
  const leftRatio = total > 0 ? Math.round((left / total) * 100) : 50;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-neutral-200">
          {axis.leftLabel}{" "}
          <span className="font-mono tabular-nums text-neutral-400">
            {axis.leftScore !== null ? axis.leftScore : "—"}
          </span>
        </span>
        <span className="font-mono text-xs font-semibold tabular-nums text-white">
          {axis.balancePercent !== null ? `${axis.balancePercent}%` : "—"}
        </span>
        <span className="font-medium text-neutral-200">
          <span className="font-mono tabular-nums text-neutral-400">
            {axis.rightScore !== null ? axis.rightScore : "—"}
          </span>{" "}
          {axis.rightLabel}
        </span>
      </div>
      <div
        className="flex h-2 w-full overflow-hidden rounded-full"
        style={{ backgroundColor: SURFACE.l2 }}
      >
        <div
          className="h-full"
          style={{ width: `${leftRatio}%`, backgroundColor: ACCENT.base }}
        />
        <div
          className="h-full"
          style={{ width: `${100 - leftRatio}%`, backgroundColor: TEXT.secondary }}
        />
      </div>
    </div>
  );
}

function TierLegend() {
  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
        {T.legend}
      </h2>
      <div className="flex flex-wrap gap-2">
        {EARNABLE_RANKS.map((rank) => (
          <span
            key={rank.id}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 text-xs"
            style={{ backgroundColor: SURFACE.l1 }}
          >
            <span aria-hidden="true" style={{ color: rank.oledColor }}>
              {rank.glyph}
            </span>
            <span className="font-medium text-neutral-200">{rank.label}</span>
            <span className="font-mono text-[11px] tabular-nums text-neutral-500">
              {rank.minScore}+
            </span>
          </span>
        ))}
      </div>
    </section>
  );
}

function MuscleGridCard({
  entry,
  mode,
  onSelect,
}: {
  entry: MuscleRank;
  mode: ViewTab;
  onSelect: () => void;
}) {
  const classified = isMuscleClassified(entry);
  const weeklySets = weeklySetsFor(entry);
  const bucket = bucketForWeeklySets(weeklySets);
  const bucketLabel =
    bucket === "optimal"
      ? T.heatmapOptimal
      : bucket === "fatigue"
        ? T.heatmapFatigue
        : bucket === "maintenance"
          ? T.heatmapMaintenance
          : T.heatmapInactive;

  const barPercent =
    mode === "volume"
      ? Math.min(100, Math.round((weeklySets / 14) * 100))
      : classified
        ? Math.round(entry.progress.percent * 100)
        : 0;

  return (
    <li className="min-w-0">
      <button
        type="button"
        onClick={onSelect}
        className="flex h-full min-h-[96px] w-full flex-col justify-between rounded-2xl border border-white/10 p-3.5 text-left transition-transform duration-150 active:scale-[0.98]"
        style={{ backgroundColor: SURFACE.l1 }}
      >
        <div className="flex items-start justify-between gap-1.5">
          <span className="min-w-0 truncate text-sm font-semibold text-white">
            {entry.label}
          </span>
          <span
            aria-hidden="true"
            className="shrink-0 font-mono text-xs"
            style={{ color: entry.rank.oledColor }}
          >
            {entry.rank.glyph}
          </span>
        </div>

        <div className="mt-2">
          {mode === "volume" ? (
            <>
              <p className="font-mono text-xs font-semibold tabular-nums text-white">
                {weeklySets} series/sem
              </p>
              <p className="truncate text-[11px] text-neutral-400">
                {bucketLabel}
              </p>
            </>
          ) : classified ? (
            <div className="flex items-baseline justify-between gap-1">
              <span
                className="truncate text-xs font-semibold"
                style={{ color: entry.rank.oledColor }}
              >
                {entry.progress.displayLabel}
              </span>
              <span className="shrink-0 font-mono text-xs font-bold tabular-nums text-neutral-300">
                {entry.score}
              </span>
            </div>
          ) : (
            <p className="truncate text-[11px] text-neutral-500">
              {entry.optional ? "Opcional" : "Faltan datos"}
            </p>
          )}

          {entry.detail.volume.coolingDown && classified && (
            <p className="mt-0.5 truncate text-[10px] font-medium text-neutral-400">
              {T.coolingDown}
            </p>
          )}
        </div>

        <div
          className="mt-2.5 h-[3px] w-full overflow-hidden rounded-full"
          style={{ backgroundColor: SURFACE.l2 }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${barPercent}%`,
              backgroundColor: entry.rank.oledColor,
            }}
          />
        </div>
      </button>
    </li>
  );
}

function EmptyState({
  sessionsNeeded,
  bodyweightKg,
}: {
  sessionsNeeded: number;
  bodyweightKg: number | null;
}) {
  return (
    <section
      className="rounded-2xl border border-white/10 p-5"
      style={{ backgroundColor: SURFACE.l1 }}
    >
      <p className="text-base font-bold text-white">
        {T.emptyTitle}
      </p>
      <p className="mt-1.5 text-sm text-neutral-300">
        {T.emptyBody(sessionsNeeded)}
      </p>
      {(!bodyweightKg || bodyweightKg <= 0) && (
        <p className="mt-2 text-xs text-neutral-400">{T.emptyNoBodyweight}</p>
      )}
    </section>
  );
}

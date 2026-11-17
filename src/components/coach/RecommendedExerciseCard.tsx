/**
 * RecommendedExerciseCard.tsx — Symmetry-style interactive `RECOMENDADO` card
 * inside Cronos Intelligence responses.
 *
 * Displays:
 *  - Animated exercise GIF (`gif_url` / `image`)
 *  - Exercise name, Cronos Gym machine/equipment, and Rank badge
 *  - SVG hypertrophy/strength Sparkline + delta + ChevronRight
 *  - Tap-to-expand action menu (`Ver técnica y pasos`, `Reemplazar ejercicio actual en mi sesión`, `Usar este ejercicio`)
 */

import { useState } from "react";
import { Check, ChevronDown, ChevronRight, Dumbbell, Eye, RefreshCw } from "lucide-react";
import { ACCENT, GLASS, NUMERIC, SOLID, SURFACE, TEXT, TYPE } from "@/design/tokens";
import { translateEquipment } from "@/lib/i18n";
import type { RecommendedExerciseMatch } from "@/lib/ai/cronosIntelligence";

interface RecommendedExerciseCardProps {
  match: RecommendedExerciseMatch;
  hasActiveWorkout?: boolean;
  onReplaceActiveExercise?: (match: RecommendedExerciseMatch) => void;
  onSelectExercise?: (match: RecommendedExerciseMatch) => void;
}

export function RecommendedExerciseCard({
  match,
  hasActiveWorkout = false,
  onReplaceActiveExercise,
  onSelectExercise,
}: RecommendedExerciseCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showTechnique, setShowTechnique] = useState(false);
  const [appliedLabel, setAppliedLabel] = useState<string | null>(null);

  const gifSrc = match.gifUrl
    ? match.gifUrl.startsWith("http") || match.gifUrl.startsWith("/")
      ? match.gifUrl
      : `/${match.gifUrl}`
    : null;

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        backgroundColor: SOLID.card,
        border: `1px solid ${GLASS.borderStrong}`,
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full p-2.5 flex items-center gap-3 text-left"
        aria-expanded={expanded}
      >
        {/* Left: Live Exercise GIF */}
        <div
          className="h-14 w-14 shrink-0 rounded-xl overflow-hidden flex items-center justify-center"
          style={{
            backgroundColor: SURFACE.base,
            border: `1px solid ${GLASS.border}`,
          }}
        >
          {gifSrc ? (
            <img
              src={gifSrc}
              alt={match.name}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <Dumbbell className="h-5 w-5" style={{ color: TEXT.tertiary }} aria-hidden="true" />
          )}
        </div>

        {/* Middle: RECOMENDADO + Title + Equipment & Rank */}
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-center gap-1.5">
            <span
              className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: ACCENT.subtle,
                color: ACCENT.text,
              }}
            >
              RECOMENDADO
            </span>
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: GLASS.fillRaised,
                color: TEXT.secondary,
              }}
            >
              {match.rankTier}
            </span>
          </div>
          <p
            className="text-xs sm:text-sm font-semibold truncate"
            style={{ color: TEXT.primary }}
          >
            {match.name}
          </p>
          <p className="text-[11px] truncate" style={{ color: TEXT.tertiary }}>
            {translateEquipment(match.equipmentName)}
          </p>
        </div>

        {/* Right: SVG Sparkline + Delta + Chevron */}
        <div className="shrink-0 flex items-center gap-2">
          <div className="hidden sm:flex flex-col items-end">
            <MiniSparkline points={match.sparklinePoints} />
            <span
              className="text-[10px] font-semibold"
              style={{
                color: ACCENT.text,
                fontFamily: TYPE.mono.font,
                fontVariantNumeric: NUMERIC.align,
              }}
            >
              {match.deltaLabel}
            </span>
          </div>
          {expanded ? (
            <ChevronDown className="h-4 w-4" style={{ color: TEXT.tertiary }} aria-hidden="true" />
          ) : (
            <ChevronRight className="h-4 w-4" style={{ color: TEXT.tertiary }} aria-hidden="true" />
          )}
        </div>
      </button>

      {/* Expanded Action Drawer */}
      {expanded ? (
        <div
          className="px-3 pb-3 pt-2 space-y-2"
          style={{ borderTop: `1px solid ${GLASS.border}` }}
        >
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setShowTechnique((v) => !v)}
              className="h-8 px-3 rounded-full inline-flex items-center gap-1.5 text-xs font-medium"
              style={{
                backgroundColor: GLASS.fillRaised,
                color: TEXT.primary,
                border: `1px solid ${GLASS.border}`,
              }}
            >
              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{showTechnique ? "Ocultar técnica" : "Ver técnica y pasos"}</span>
            </button>

            {hasActiveWorkout && onReplaceActiveExercise ? (
              <button
                type="button"
                onClick={() => {
                  onReplaceActiveExercise(match);
                  setAppliedLabel("Reemplazado en tu sesión");
                }}
                className="h-8 px-3 rounded-full inline-flex items-center gap-1.5 text-xs font-semibold"
                style={{
                  backgroundColor: ACCENT.base,
                  color: TEXT.onAccent,
                }}
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Reemplazar ejercicio actual en mi sesión</span>
              </button>
            ) : null}

            {onSelectExercise ? (
              <button
                type="button"
                onClick={() => {
                  onSelectExercise(match);
                  setAppliedLabel("Ejercicio seleccionado");
                }}
                className="h-8 px-3 rounded-full inline-flex items-center gap-1.5 text-xs font-semibold"
                style={{
                  backgroundColor: hasActiveWorkout ? GLASS.fillRaised : ACCENT.base,
                  color: hasActiveWorkout ? TEXT.primary : TEXT.onAccent,
                  border: `1px solid ${hasActiveWorkout ? GLASS.border : ACCENT.base}`,
                }}
              >
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Usar este ejercicio</span>
              </button>
            ) : null}
          </div>

          {appliedLabel ? (
            <p className="text-[11px] font-medium" style={{ color: ACCENT.text }}>
              {appliedLabel}
            </p>
          ) : null}

          {showTechnique ? (
            <div
              className="rounded-xl p-2.5 space-y-1 text-xs"
              style={{
                backgroundColor: SURFACE.base,
                border: `1px solid ${GLASS.border}`,
                color: TEXT.secondary,
              }}
            >
              <p className="font-semibold" style={{ color: TEXT.primary }}>
                {match.muscleGroup} · {match.equipmentName}
              </p>
              {match.instructions.length > 0 ? (
                <ol className="list-decimal list-inside space-y-0.5">
                  {match.instructions.slice(0, 4).map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              ) : (
                <p>
                  Controla la fase excéntrica en 2–3 segundos, haz una breve pausa en el punto de
                  mayor estiramiento y empuja de forma explosiva manteniendo estabilidad escapular o
                  pélvica.
                </p>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function MiniSparkline({ points }: { points: number[] }) {
  const width = 56;
  const height = 20;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const coords = points
    .map((v, i) => {
      const x = (i / Math.max(1, points.length - 1)) * (width - 4) + 2;
      const y = height - 3 - ((v - min) / span) * (height - 6);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline
        fill="none"
        stroke={ACCENT.base}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={coords}
      />
    </svg>
  );
}

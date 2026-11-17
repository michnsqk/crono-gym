import { ArrowRight, Play, RotateCcw, Sparkles, Plus } from "lucide-react";

import { GlassButton } from "@/components/ui/GlassButton";
import { MuscleReadonlyMap } from "@/components/MuscleReadonlyMap";
import { formatSessionMeta } from "@/lib/dashboard/heroCardModel";
import { ACCENT, GLASS, MOTION, NUMERIC, RADIUS, SPACE, TEXT, TYPE } from "@/design/tokens";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import type { CompletedSessionSummary } from "@/lib/dashboard/dashboardMetrics";

export interface TrainingHeroSectionProps {
  greeting: string;
  hasRoutine: boolean;
  routineTitle: string;
  exerciseCount: number;
  estimatedDurationMin: number;
  muscleCounts: Map<string, number> | null;
  ctaLabel: string;
  rehydrating: boolean;
  onPrimary: () => void;
  focusLabel?: string | null;
  isCompleted?: boolean;
  isRecoverable?: boolean;
  completedSummary?: CompletedSessionSummary | null;
  onExtra?: () => void;
  coachAssigned?: boolean;
  /** Reduce altura y tamaño del mapa muscular en pantallas estrechas. */
  compact?: boolean;
}

export function TrainingHeroSection({
  greeting,
  hasRoutine,
  routineTitle,
  exerciseCount,
  estimatedDurationMin,
  muscleCounts,
  ctaLabel,
  rehydrating,
  onPrimary,
  focusLabel,
  isCompleted = false,
  isRecoverable = false,
  completedSummary = null,
  onExtra,
  coachAssigned = false,
  compact = false,
}: TrainingHeroSectionProps) {
  const reduce = useReducedMotion();
  const isCompact = compact;
  const meta = hasRoutine ? formatSessionMeta(exerciseCount, estimatedDurationMin) : null;
  const ctaInverse = exerciseCount > 0;
  const ctaIcon = isCompleted ? (
    <ArrowRight size={18} aria-hidden="true" />
  ) : isRecoverable ? (
    <RotateCcw size={18} aria-hidden="true" />
  ) : (
    <Play size={18} aria-hidden="true" />
  );
  const ctaDisabled = rehydrating;
  const resolvedLabel = rehydrating ? "Preparando entrenamiento…" : ctaLabel;

  return (
    <section
      data-testid="training-hero-command"
      aria-label="Entrenamiento de hoy"
      className="relative overflow-hidden min-w-0"
      style={{
        borderRadius: 0,
        padding: 0,
        border: "none",
        background: "transparent",
        boxShadow: "none",
      }}
    >
      {/* Glow crimson superior sutil, sin interferir con la legibilidad. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-[16px] left-1/2 -translate-x-1/2 w-[60vw] max-w-[600px] h-[260px]"
        style={{
          background: `radial-gradient(60% 40% at 50% 0%, ${ACCENT.glow}, transparent 70%)`,
          opacity: 0.35,
          filter: "blur(28px)",
          pointerEvents: "none",
        }}
      />

      {/* Grid de 2 columnas proporcionales desde móvil (390px): texto a la izquierda
          y mapa anatómico de cuerpo entero a la derecha sin recortar piernas. */}
      <div className="relative grid grid-cols-[minmax(0,1fr)_126px] sm:grid-cols-[minmax(0,1fr)_160px] md:grid-cols-[minmax(0,1fr)_165px] lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] items-center gap-2 lg:gap-8 px-3 pt-3 sm:px-4 md:px-4 lg:px-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {!isCompleted ? <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: `${SPACE.xs} ${SPACE.sm}`,
                borderRadius: RADIUS.pill,
                background: GLASS.fillSubtle,
                border: `1px solid ${GLASS.border}`,
                ...TYPE.label,
                color: TEXT.secondary,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              <Sparkles size={12} aria-hidden="true" />
              {isCompleted ? "COMPLETADO HOY" : "HOY"}
            </span> : null}
            {focusLabel && hasRoutine && focusLabel.trim() !== routineTitle.trim() ? (
              <span style={{ ...TYPE.caption, color: TEXT.tertiary }}>
                Enfoque: <span style={{ color: TEXT.secondary, fontWeight: 600 }}>{focusLabel}</span>
              </span>
            ) : null}
          </div>

          <p style={{ ...TYPE.callout, color: TEXT.secondary, margin: `${SPACE.sm} 0 0` }}>{greeting}</p>

          {isCompleted && completedSummary ? (
            <>
              <span className="mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold" style={{ border: `1px solid ${ACCENT.border}`, backgroundColor: GLASS.fillSubtle, color: TEXT.primary }}>
                ✓ COMPLETADO HOY
              </span>
              <h1 className="mt-2 text-2xl sm:text-3xl font-bold leading-tight tracking-tight text-white break-words">
                {completedSummary.title}
              </h1>
              <p className="mt-2 font-mono text-xs text-zinc-400">
                {completedSummary.durationMin} min · {completedSummary.exerciseCount} ejercicios
              </p>
            </>
          ) : hasRoutine ? (
            <>
              <h1
                className="mt-2 text-2xl sm:text-3xl font-bold leading-tight tracking-tight text-white break-words"
                style={{
                  color: TEXT.primary,
                  letterSpacing: "-0.025em",
                  maxWidth: "20ch",
                }}
              >
                {routineTitle}
              </h1>
              {coachAssigned ? (
                <span className="mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold" style={{ border: `1px solid ${ACCENT.border}`, backgroundColor: ACCENT.subtle, color: ACCENT.base }}>
                  Asignada por tu Coach
                </span>
              ) : null}
              {meta ? (
                <div style={{ marginTop: SPACE.sm }}>
                  <span
                    style={{
                      ...TYPE.mono,
                      fontVariantNumeric: NUMERIC.transform,
                      color: TEXT.secondary,
                      fontSize: TYPE.caption.size,
                    }}
                  >
                    {meta}
                  </span>
                </div>
              ) : null}
            </>
          ) : (
            <>
              <h1
                className="mt-2 text-2xl sm:text-3xl font-bold leading-tight tracking-tight text-white"
                style={{
                  color: TEXT.primary,
                  letterSpacing: "-0.025em",
                }}
              >
                Rutina del día
              </h1>
              <p style={{ ...TYPE.subhead, color: TEXT.secondary, margin: `${SPACE.sm} 0 0`, maxWidth: "42ch" }}>
                Crea tu primera rutina para empezar
              </p>
            </>
          )}
        </div>

        <div
          className="flex flex-col items-center justify-center self-center"
          style={{ backgroundColor: "transparent", overflow: "visible" }}
        >
          <div
            data-testid="today-hero-muscle-map"
            aria-hidden="true"
            className="h-[205px] w-[126px] sm:h-[230px] sm:w-[155px]"
            style={{
              backgroundColor: "transparent",
              overflow: "visible",
              height: isCompact ? 205 : 230,
              width: isCompact ? 126 : 155,
            }}
          >
            <MuscleReadonlyMap
              counts={muscleCounts ?? new Map()}
              label="Torso anatómico"
              aspectRatio={126 / 205}
              backgroundColor="transparent"
              inertFill={GLASS.borderStrong}
              litFill={ACCENT.base}
              mostLitFill={ACCENT.base}
              caption={null}
              overflow="visible"
            />
          </div>
        </div>

        <div
          className="col-span-2 w-full pb-3 lg:w-auto"
          style={{
            marginTop: SPACE.sm,
            maxWidth: "100%",
            transition: reduce ? undefined : `transform ${MOTION.fast} ${MOTION.easeOut}`,
          }}
        >
          <div className={isCompleted ? "flex items-center gap-2" : ""}>
            <GlassButton
              variant="primary"
              icon={isCompleted ? undefined : ctaIcon}
              onClick={onPrimary}
              disabled={ctaDisabled}
              className="btn-crimson-accessible h-11 whitespace-nowrap rounded-xl px-5 font-semibold active:scale-[0.98] transition-transform w-full lg:w-auto"
              style={{
                minHeight: 52,
                fontSize: TYPE.subhead.size,
                fontWeight: 700,
                paddingInline: SPACE.xl,
                color: ctaInverse ? TEXT.primary : undefined,
                boxShadow: ctaDisabled ? "none" : `0 12px 30px ${ACCENT.glow}`,
              }}
            >
              {isCompleted ? (
                <span className="inline-flex items-center justify-center gap-2 whitespace-nowrap">
                  <span>Ver progreso</span>
                  <ArrowRight size={18} aria-hidden="true" />
                </span>
              ) : (
                resolvedLabel
              )}
            </GlassButton>
            {isCompleted && onExtra ? (
              <button
                type="button"
                aria-label="Iniciar sesión extra"
                onClick={onExtra}
                className="inline-flex h-11 min-w-11 shrink-0 items-center justify-center rounded-xl px-3 text-white active:scale-[0.98] transition-transform"
                style={{ backgroundColor: GLASS.fillRaised, border: `1px solid ${GLASS.border}` }}
              >
                <Plus size={18} aria-hidden="true" />
                <span className="sr-only">Extra</span>
              </button>
            ) : null}
          </div>
          {ctaDisabled && (
            <p
              style={{
                ...TYPE.caption,
                color: TEXT.tertiary,
                margin: `${SPACE.xs} 0 0`,
                display: "flex",
                alignItems: "center",
                gap: SPACE.xs,
              }}
            >
              <span
                aria-hidden="true"
                className="w-3 h-3 rounded-full"
                style={{
                  backgroundColor: ACCENT.base,
                  animation: !reduce ? `cronos-pulse ${MOTION.loop.session} infinite` : "none",
                }}
              />
              {`${resolvedLabel}…`}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

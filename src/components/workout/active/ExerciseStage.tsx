import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Award,
  Bell,
  ChevronRight,
  Compass,
  Disc,
  Dumbbell,
  Info,
  Play,
  Plus,
  RefreshCw,
  Shield,
  Target,
} from "lucide-react";
import type { EquipmentEntry } from "@/data/equipmentCatalog";
import { ACCENT, GLASS, SPACE, TEXT, TYPE } from "@/design/tokens";
import { SET_LOGGER_LABELS } from "@/lib/i18n";
import { resolveMedia } from "@/lib/media/mediaResolver";
import { useMediaSrc } from "@/lib/media/useMediaSrc";
import { cleanEquipmentLabel, type ExerciseRankResult } from "@/lib/workout/cronosSmartEngine";
import type { Exercise } from "@/types/supabase";
import { getExerciseDisplayName } from "@/utils/exerciseTranslation";

function cleanExerciseName(name: string): string {
  return name.replace(/\s*[•·-]\s*\d{3,5}$/, "");
}

function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(Number.isFinite(totalSeconds) ? totalSeconds : 0));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export interface ExerciseStageProps {
  exercise: Exercise;
  completedSets: number;
  totalSets: number;
  lastSessionShort: string | null;
  equipment: EquipmentEntry | null;
  locationLabel: string;
  guidesOpen: boolean;
  onToggleGuides: () => void;
  onDemo?: () => void;
  onAdvance?: () => void;
  onChangeExercise: () => void;
  onAdjustEquipment: () => void;
  rank: ExerciseRankResult;
  onOpenRank: () => void;
  restSeconds: number;
  onAdjustRest: () => void;
  onAddWarmup: () => void;
  prBadge?: { e1rmKg: number; weightKg: number; reps: number } | null;
  onOpenBiomechanics?: () => void;
  biomechanicsNote?: string | null;
  onOpenPlates?: () => void;
  onRequestSpot?: () => void;
  onReportMachine?: () => void;
}

export function ExerciseStage({
  exercise,
  completedSets,
  totalSets,
  lastSessionShort,
  equipment,
  locationLabel,
  guidesOpen,
  onToggleGuides,
  onDemo,
  onAdvance,
  onChangeExercise,
  onAdjustEquipment,
  rank,
  onOpenRank,
  restSeconds,
  onAdjustRest,
  onAddWarmup,
  prBadge,
  onOpenBiomechanics,
  biomechanicsNote,
  onOpenPlates,
  onRequestSpot,
  onReportMachine,
}: ExerciseStageProps) {
  const media = resolveMedia("exercise-gif", exercise.id, exercise.gif_url);
  const { src, failed, onLoad, onError } = useMediaSrc(media);
  const cleanLocation = cleanEquipmentLabel(locationLabel);
  const displayName = cleanExerciseName(getExerciseDisplayName(exercise));

  return (
    <section
      style={{
        maxWidth: "560px",
        margin: "0 auto",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: SPACE.sm,
        alignItems: "center",
        padding: `0 ${SPACE.md}px`,
      }}
    >
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          maxWidth: 280,
          height: 190,
        }}
      >
        {media.url && !failed ? (
          <img
            src={src}
            alt={`Demo de ${cleanExerciseName(getExerciseDisplayName(exercise))}`}
            onLoad={onLoad}
            onError={onError}
            style={{
              maxWidth: "280px",
              height: "190px",
              objectFit: "contain",
              background: "transparent",
              filter: "invert(1) hue-rotate(180deg) contrast(125%) brightness(110%)",
              imageRendering: "-webkit-optimize-contrast",
            }}
            width={640}
            height={360}
          />
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              gap: 8,
              color: TEXT.tertiary,
              fontSize: TYPE.caption.size,
            }}
          >
            <Dumbbell size={32} strokeWidth={1.5} aria-hidden="true" />
            Sin demo disponible
          </div>
        )}

        {equipment && (
          <button
            type="button"
            onClick={onAdjustEquipment}
            aria-label={SET_LOGGER_LABELS.machineAriaLabel(cleanLocation)}
            className="absolute bottom-1 left-1/2 flex max-w-[92vw] -translate-x-1/2 items-center gap-2 rounded-full border border-white/15 bg-neutral-900/90 px-3.5 py-1.5 text-left shadow-lg backdrop-blur-md"
          >
            <Dumbbell
              size={14}
              strokeWidth={2}
              aria-hidden="true"
              style={{ color: ACCENT.base, flexShrink: 0 }}
            />
            <span className="min-w-0 truncate text-xs font-semibold text-white">
              {cleanLocation}
            </span>
            <span className="flex shrink-0 items-center gap-0.5 text-[11px] font-semibold text-neutral-200">
              Ver foto
              <ChevronRight size={12} strokeWidth={2.5} aria-hidden="true" />
            </span>
          </button>
        )}
      </div>

      <div className="flex w-full items-center justify-between gap-2.5 px-2">
        <h2
          className="min-w-0 flex-1 text-left text-lg font-bold leading-snug tracking-tight text-white"
          style={{ margin: 0, overflowWrap: "break-word" }}
        >
          {displayName}
        </h2>
        <button
          type="button"
          onClick={onOpenRank}
          aria-label={`Rango del ejercicio: ${rank.currentRank.tier}`}
          title={`${rank.currentRank.tier} · siguiente ${rank.nextRank.tier}`}
          className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-[11px] font-semibold backdrop-blur-md"
          style={{
            borderColor: rank.currentRank.colorHex,
            backgroundColor: GLASS.fillSubtle,
            color: rank.currentRank.colorHex,
          }}
        >
          <Shield size={12} strokeWidth={2} aria-hidden="true" />
          {rank.currentRank.tier}
        </button>
      </div>
      {lastSessionShort && (
        <p
          className="w-full px-2 text-left"
          style={{
            margin: 0,
            fontSize: TYPE.caption.size,
            fontFamily: TYPE.mono.font,
            fontVariantNumeric: "tabular-nums",
            color: TEXT.tertiary,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: "100%",
          }}
        >
          {lastSessionShort}
        </p>
      )}
      {prBadge && (
        <div className="w-full px-2">
          <div
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
            style={{
              background: ACCENT.subtle,
              color: ACCENT.text,
              border: `1px solid ${ACCENT.border}`,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <Award size={13} strokeWidth={2} aria-hidden="true" />
            <span>Nuevo PR · {prBadge.e1rmKg} kg e1RM</span>
          </div>
        </div>
      )}
      {biomechanicsNote && (
        <div className="w-full px-2">
          <button
            type="button"
            onClick={onOpenBiomechanics}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
            style={{
              backgroundColor: GLASS.fillSubtle,
              color: TEXT.primary,
              border: `1px solid ${ACCENT.border}`,
            }}
          >
            <Compass size={12} strokeWidth={2} aria-hidden="true" style={{ color: ACCENT.text }} />
            <span>{biomechanicsNote}</span>
          </button>
        </div>
      )}

      <div
        className="flex w-full items-center gap-1.5 overflow-x-auto rounded-full border border-white/[0.06] px-2 py-1.5 backdrop-blur-xl"
        style={{ backgroundColor: "rgba(28, 28, 30, 0.80)" }}
      >
        <span className="sr-only">
          {completedSets} / {totalSets} series
        </span>
        <DockButton
          label="Demo"
          onClick={onDemo ?? (() => {})}
          icon={<Play size={14} strokeWidth={2} aria-hidden="true" />}
        >
          Tutorial
        </DockButton>
        <DockButton
          label="Avance"
          onClick={onAdvance ?? (() => {})}
          icon={<Target size={14} strokeWidth={2} aria-hidden="true" />}
        >
          Notas
        </DockButton>
        <DockButton
          label="Cambiar"
          onClick={onChangeExercise}
          icon={<ArrowRight size={14} strokeWidth={2} aria-hidden="true" />}
        >
          Reemplazar
        </DockButton>
        <DockButton
          label="Ajustar"
          onClick={onAdjustRest}
          icon={<RefreshCw size={14} strokeWidth={2} aria-hidden="true" />}
        >
          {formatClock(restSeconds)}
        </DockButton>
        <DockButton
          label="+ Calentamiento (W)"
          onClick={onAddWarmup}
          icon={<Plus size={14} strokeWidth={2} aria-hidden="true" />}
        >
          Calentamiento
        </DockButton>
        {onOpenPlates && (
          <DockButton
            label="Calculadora de discos"
            onClick={onOpenPlates}
            icon={<Disc size={14} strokeWidth={2} aria-hidden="true" />}
          >
            Discos
          </DockButton>
        )}
        <DockButton
          label="Postura / Agarre"
          onClick={onOpenBiomechanics ?? (() => {})}
          icon={<Compass size={14} strokeWidth={2} aria-hidden="true" />}
        >
          Postura / Agarre
        </DockButton>
        {totalSets > 0 && (
          <DockButton
            label={SET_LOGGER_LABELS.guideAriaLabel}
            active={guidesOpen}
            onClick={onToggleGuides}
            icon={<Info size={14} strokeWidth={2} aria-hidden="true" />}
          >
            Guía
          </DockButton>
        )}
        {onRequestSpot && (
          <DockButton
            label="Pedir Spot o ayuda al coach en piso"
            onClick={onRequestSpot}
            icon={<Bell size={14} strokeWidth={2} aria-hidden="true" />}
          >
            Spot / Coach
          </DockButton>
        )}
        {onReportMachine && (
          <DockButton
            label="Reportar falla en esta máquina"
            onClick={onReportMachine}
            icon={<AlertTriangle size={14} strokeWidth={2} aria-hidden="true" />}
          >
            Reportar falla
          </DockButton>
        )}
      </div>
    </section>
  );
}

function DockButton({
  label,
  icon,
  onClick,
  active = false,
  children,
}: {
  label: string;
  icon: JSX.Element;
  onClick: () => void;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active || undefined}
      onClick={onClick}
      title={label}
      className={`flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-xs font-medium transition-colors ${
        active ? "bg-white/15 text-white" : "text-neutral-200 active:bg-white/10"
      }`}
    >
      <span aria-hidden="true" className="flex shrink-0 items-center">
        {icon}
      </span>
      {children}
    </button>
  );
}

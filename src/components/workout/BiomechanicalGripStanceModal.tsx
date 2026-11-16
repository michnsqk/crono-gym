import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  Check,
  Compass,
  Crosshair,
  Dumbbell,
  Footprints,
  Info,
  ShieldCheck,
  Sliders,
  X,
} from "lucide-react";
import { MuscleReadonlyMap } from "@/components/MuscleReadonlyMap";
import { ACCENT, GLASS, RADIUS, SCRIM, SOLID, STATUS, SURFACE, TEXT, Z_INDEX } from "@/design/tokens";
import {
  CRONOS_ATTACHMENTS_GUIDE,
  FOOT_STANCE_MATRIX,
  UPPER_BODY_GRIP_MATRIX,
  countsMapFromSlugs,
  resolveInitialBiomechanicsTab,
  type BiomechanicsAtlasTab,
  type BiomechanicsContextInput,
  type CronosAttachmentEntry,
  type FootStanceId,
  type UpperBodyTrajectoryId,
} from "@/lib/workout/biomechanicalGripStance";

export interface BiomechanicalSelectionPayload {
  tab: BiomechanicsAtlasTab;
  id: string;
  label: string;
  chipSummary: string;
  equipmentId?: string;
}

export interface BiomechanicalGripStanceModalProps {
  open: boolean;
  onClose: () => void;
  context?: BiomechanicsContextInput | null;
  exerciseTitle?: string | null;
  onApply?: (selection: BiomechanicalSelectionPayload) => void;
}

const COMPACT_STANCE_CHIPS: readonly { id: FootStanceId; label: string }[] = [
  { id: "low_narrow", label: "Pies Bajos" },
  { id: "standard_mid", label: "Media" },
  { id: "high_neutral", label: "Pies Altos" },
  { id: "high_wide_sumo", label: "Sumo" },
  { id: "bottom_edge_calves", label: "Pantorrilla" },
];

function shortGripBadge(entry: CronosAttachmentEntry): string {
  const g = entry.gripOrientation.toLowerCase();
  if (g.includes("tobillera")) return "Tobillera";
  if (entry.equipmentId === "CG-EQP-0040") return "Unilateral";
  if (entry.equipmentId === "CG-EQP-0038") return "Rotación Externa";
  if (g.includes("neutro")) return "Agarre Neutro";
  if (g.includes("semisupinado")) return "Semisupinado Z";
  return "Prono / Supino";
}

export function BiomechanicalGripStanceModal({
  open,
  onClose,
  context,
  exerciseTitle,
  onApply,
}: BiomechanicalGripStanceModalProps) {
  const [activeTab, setActiveTab] = useState<BiomechanicsAtlasTab>(() =>
    resolveInitialBiomechanicsTab(context),
  );
  const [selectedStanceId, setSelectedStanceId] = useState<FootStanceId>("high_neutral");
  const [stanceMapSide, setStanceMapSide] = useState<"front" | "back">("back");
  const [selectedAttachmentId, setSelectedAttachmentId] = useState<string>("CG-EQP-0038");
  const [selectedAttachmentDetailOpen, setSelectedAttachmentDetailOpen] = useState<boolean>(false);
  const [selectedTrajectoryId, setSelectedTrajectoryId] =
    useState<UpperBodyTrajectoryId>("bench_incline_30");
  const [attachmentFilter, setAttachmentFilter] = useState<
    "all" | "pull_back" | "arms_isolation" | "legs_glutes"
  >("all");

  useEffect(() => {
    if (!open) return;
    setActiveTab(resolveInitialBiomechanicsTab(context));
    setSelectedAttachmentDetailOpen(false);
    if (
      context?.equipmentId &&
      CRONOS_ATTACHMENTS_GUIDE.some((item) => item.equipmentId === context.equipmentId)
    ) {
      setSelectedAttachmentId(context.equipmentId);
    }
  }, [open, context]);

  const currentStance = useMemo(
    () => FOOT_STANCE_MATRIX.find((item) => item.id === selectedStanceId) ?? FOOT_STANCE_MATRIX[0],
    [selectedStanceId],
  );

  useEffect(() => {
    setStanceMapSide(currentStance.recommendedSide);
  }, [currentStance.recommendedSide]);

  const filteredAttachments = useMemo(() => {
    if (attachmentFilter === "all") return CRONOS_ATTACHMENTS_GUIDE;
    return CRONOS_ATTACHMENTS_GUIDE.filter((item) => item.family === attachmentFilter);
  }, [attachmentFilter]);

  const currentAttachment = useMemo(
    () =>
      CRONOS_ATTACHMENTS_GUIDE.find((item) => item.equipmentId === selectedAttachmentId) ??
      CRONOS_ATTACHMENTS_GUIDE[0],
    [selectedAttachmentId],
  );

  const currentTrajectory = useMemo(
    () =>
      UPPER_BODY_GRIP_MATRIX.find((item) => item.id === selectedTrajectoryId) ??
      UPPER_BODY_GRIP_MATRIX[0],
    [selectedTrajectoryId],
  );

  const activeMuscleCounts = useMemo(() => {
    if (activeTab === "foot_stance") {
      return countsMapFromSlugs(currentStance.muscleSlugs);
    }
    if (activeTab === "attachments") {
      return countsMapFromSlugs(currentAttachment.muscleSlugs);
    }
    return countsMapFromSlugs(currentTrajectory.muscleSlugs);
  }, [activeTab, currentStance, currentAttachment, currentTrajectory]);

  const handleSelectStance = (stanceId: FootStanceId) => {
    setSelectedStanceId(stanceId);
    if (stanceId === "high_neutral" || stanceId === "bottom_edge_calves") {
      setStanceMapSide("back");
    } else if (
      stanceId === "low_narrow" ||
      stanceId === "standard_mid" ||
      stanceId === "high_wide_sumo"
    ) {
      setStanceMapSide("front");
    }
  };

  if (!open) return null;

  const handleApply = () => {
    if (!onApply) {
      onClose();
      return;
    }
    if (activeTab === "foot_stance") {
      onApply({
        tab: "foot_stance",
        id: currentStance.id,
        label: currentStance.label,
        chipSummary: currentStance.chipSummary,
      });
    } else if (activeTab === "attachments") {
      onApply({
        tab: "attachments",
        id: currentAttachment.equipmentId,
        label: currentAttachment.name,
        chipSummary: currentAttachment.chipSummary,
        equipmentId: currentAttachment.equipmentId,
      });
    } else {
      onApply({
        tab: "upper_angle",
        id: currentTrajectory.id,
        label: currentTrajectory.label,
        chipSummary: currentTrajectory.chipSummary,
      });
    }
    onClose();
  };

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Atlas Biomecánico de Agarres, Manerales y Posturas"
      className="fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{
        backgroundColor: SCRIM.modal,
        backdropFilter: GLASS.blurPlain20,
        zIndex: Math.max(Z_INDEX.modal, 110),
      }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-4 pb-8 sm:p-5 space-y-3"
        style={{
          backgroundColor: SURFACE.elevated,
          border: `1px solid ${GLASS.borderStrong}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2.5">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <Compass className="h-3.5 w-3.5 shrink-0" style={{ color: ACCENT.text }} />
              <span
                className="text-[10px] font-bold uppercase tracking-widest truncate"
                style={{ color: ACCENT.text }}
              >
                CRONOS BIOMECHANICS ATLAS
              </span>
            </div>
            <h2
              className="text-sm sm:text-base font-bold tracking-tight mt-0.5"
              style={{ color: TEXT.primary }}
            >
              Atlas de Agarres, Manerales y Posturas
            </h2>
            {exerciseTitle ? (
              <p className="text-xs truncate mt-0.5" style={{ color: TEXT.secondary }}>
                Ejercicio activo: <span style={{ color: TEXT.primary }}>{exerciseTitle}</span>
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar Atlas Biomecánico"
            className="h-9 w-9 shrink-0 rounded-full flex items-center justify-center"
            style={{
              backgroundColor: GLASS.fillRaised,
              border: `1px solid ${GLASS.border}`,
              color: TEXT.secondary,
            }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 3-Tab Segmented Control — Short labels that never clip at 390px */}
        <div
          className="grid grid-cols-3 gap-1 p-1 rounded-2xl w-full"
          style={{
            backgroundColor: SURFACE.base,
            border: `1px solid ${GLASS.border}`,
          }}
        >
          {(
            [
              {
                id: "foot_stance" as const,
                label: "Pies y Prensa",
                sub: "Pierna",
                Icon: Footprints,
              },
              {
                id: "attachments" as const,
                label: "Manerales",
                sub: "Espalda / Brazo",
                Icon: Dumbbell,
              },
              {
                id: "upper_angle" as const,
                label: "Ángulo y Codos",
                sub: "Pecho / Hombro",
                Icon: Sliders,
              },
            ] as const
          ).map(({ id, label, sub, Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setActiveTab(id);
                  setSelectedAttachmentDetailOpen(false);
                }}
                className="flex flex-col items-center justify-center rounded-xl py-2 px-1 text-center min-w-0"
                style={{
                  backgroundColor: active ? SOLID.popover : "transparent",
                  border: active ? `1px solid ${ACCENT.border}` : "1px solid transparent",
                  color: active ? TEXT.primary : TEXT.secondary,
                }}
              >
                <div className="flex items-center justify-center gap-1 min-w-0 max-w-full">
                  <Icon
                    className="h-3.5 w-3.5 shrink-0"
                    style={{ color: active ? ACCENT.text : TEXT.tertiary }}
                  />
                  <span className="text-[11px] font-bold whitespace-nowrap">{label}</span>
                </div>
                <span className="text-[10px] truncate max-w-full" style={{ color: TEXT.tertiary }}>
                  {sub}
                </span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: PIES Y PRENSA — Side-by-side Platform SVG + Anatomical Body Map */}
        {activeTab === "foot_stance" && (
          <div className="space-y-2.5">
            {/* Compact Stance Chips — flex-wrap so labels never truncate with "..." */}
            <div className="flex flex-wrap justify-center gap-1.5">
              {COMPACT_STANCE_CHIPS.map((chip) => {
                const selected = chip.id === currentStance.id;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => handleSelectStance(chip.id)}
                    className="rounded-xl px-3 py-2 text-center transition-transform active:scale-95"
                    style={{
                      backgroundColor: selected ? ACCENT.subtle : GLASS.fill,
                      border: `1px solid ${selected ? ACCENT.border : GLASS.border}`,
                      color: selected ? TEXT.primary : TEXT.secondary,
                    }}
                  >
                    <span className="text-xs font-semibold block whitespace-nowrap">{chip.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Side-by-Side 2-Column Layout (Works on 390px mobile without scrolling) */}
            <div className="grid grid-cols-2 gap-2.5 items-stretch">
              {/* Left Column: Clean Interactive Footplate Vector (Zero overlapping text) */}
              <div
                className="rounded-2xl p-2.5 flex flex-col justify-between"
                style={{
                  backgroundColor: SURFACE.base,
                  border: `1px solid ${GLASS.border}`,
                }}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span
                    className="text-[11px] font-bold uppercase tracking-wider"
                    style={{ color: TEXT.secondary }}
                  >
                    Plataforma
                  </span>
                </div>

                <svg
                  viewBox="0 0 200 165"
                  className="w-full h-40 select-none"
                  role="img"
                  aria-label="Plataforma interactiva de posición de pies"
                >
                  {/* Platform Outer Frame */}
                  <rect
                    x="10"
                    y="6"
                    width="180"
                    height="152"
                    rx="14"
                    fill={SOLID.card}
                    stroke={GLASS.borderStrong}
                    strokeWidth="1.5"
                  />
                  {/* Non-slip subtle grid lines without text colliding with footprints */}
                  <line
                    x1="100"
                    y1="12"
                    x2="100"
                    y2="152"
                    stroke={GLASS.border}
                    strokeDasharray="3 3"
                  />
                  <line
                    x1="16"
                    y1="50"
                    x2="184"
                    y2="50"
                    stroke={GLASS.border}
                    strokeDasharray="3 3"
                  />
                  <line
                    x1="16"
                    y1="92"
                    x2="184"
                    y2="92"
                    stroke={GLASS.border}
                    strokeDasharray="3 3"
                  />
                  <line
                    x1="16"
                    y1="126"
                    x2="184"
                    y2="126"
                    stroke={GLASS.border}
                    strokeDasharray="2 2"
                  />

                  {/* Render clickable footprints for each stance */}
                  {FOOT_STANCE_MATRIX.map((zone) => {
                    const isSelected = zone.id === currentStance.id;
                    const lx = 10 + (zone.svgFootprint.leftX / 100) * 180;
                    const rx = 10 + (zone.svgFootprint.rightX / 100) * 180;
                    const cy = 6 + (zone.svgFootprint.y / 100) * 152;
                    const rot = zone.svgFootprint.toeRotationDeg;
                    const fill = isSelected ? ACCENT.base : GLASS.fillRaised;
                    const stroke = isSelected ? TEXT.primary : GLASS.borderStrong;
                    const opacity = isSelected ? 1 : 0.35;

                    return (
                      <g
                        key={zone.id}
                        onClick={() => handleSelectStance(zone.id)}
                        className="cursor-pointer"
                        opacity={opacity}
                      >
                        <g transform={`translate(${lx}, ${cy}) rotate(${-rot})`}>
                          <rect
                            x="-9"
                            y="-16"
                            width="18"
                            height="32"
                            rx="8"
                            fill={fill}
                            stroke={stroke}
                            strokeWidth={isSelected ? "1.8" : "1"}
                          />
                          <circle
                            cx="0"
                            cy="-9"
                            r="2.8"
                            fill={TEXT.primary}
                            opacity={isSelected ? 0.9 : 0.35}
                          />
                        </g>
                        <g transform={`translate(${rx}, ${cy}) rotate(${rot})`}>
                          <rect
                            x="-9"
                            y="-16"
                            width="18"
                            height="32"
                            rx="8"
                            fill={fill}
                            stroke={stroke}
                            strokeWidth={isSelected ? "1.8" : "1"}
                          />
                          <circle
                            cx="0"
                            cy="-9"
                            r="2.8"
                            fill={TEXT.primary}
                            opacity={isSelected ? 0.9 : 0.35}
                          />
                        </g>
                      </g>
                    );
                  })}
                </svg>

                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-lg text-center truncate"
                  style={{
                    backgroundColor: ACCENT.subtle,
                    color: ACCENT.text,
                    border: `1px solid ${ACCENT.border}`,
                  }}
                >
                  {currentStance.shortLabel}
                </span>
              </div>

              {/* Right Column: Live Anatomical Map right next to the Platform */}
              <div
                className="rounded-2xl p-2.5 flex flex-col justify-between"
                style={{
                  backgroundColor: SURFACE.base,
                  border: `1px solid ${GLASS.border}`,
                }}
              >
                <div className="flex items-center justify-between gap-1">
                  <span
                    className="text-[11px] font-bold uppercase tracking-wider"
                    style={{ color: TEXT.secondary }}
                  >
                    Mapa
                  </span>
                  <div
                    className="inline-flex rounded-lg p-0.5"
                    style={{ backgroundColor: GLASS.fill, border: `1px solid ${GLASS.border}` }}
                  >
                    {(["front", "back"] as const).map((side) => {
                      const active = stanceMapSide === side;
                      return (
                        <button
                          key={side}
                          type="button"
                          onClick={() => setStanceMapSide(side)}
                          className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase"
                          style={{
                            backgroundColor: active ? SOLID.popover : "transparent",
                            color: active ? TEXT.primary : TEXT.tertiary,
                          }}
                        >
                          {side === "front" ? "Frente" : "Espalda"}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div
                  className="w-full h-44 mx-auto my-1 overflow-hidden flex justify-center items-end rounded-xl"
                  data-testid="lower-body-zoom-frame"
                >
                  <div className="w-32 shrink-0 scale-[1.35] translate-y-[2%] origin-bottom">
                    <MuscleReadonlyMap
                      counts={activeMuscleCounts}
                      side={stanceMapSide}
                      caption={null}
                      label={`Activación anatómica para ${currentStance.label}`}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-1 justify-center">
                  {currentStance.primaryMuscles.slice(0, 2).map((muscle) => (
                    <span
                      key={muscle}
                      className="text-[11px] font-semibold px-2 py-0.5 rounded-md text-center"
                      style={{
                        backgroundColor: ACCENT.subtle,
                        color: TEXT.primary,
                        border: `1px solid ${ACCENT.border}`,
                      }}
                    >
                      {muscle}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Single Compact Card below the 2-column view */}
            <div
              className="rounded-2xl p-3 space-y-2"
              style={{
                backgroundColor: GLASS.fill,
                border: `1px solid ${GLASS.border}`,
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <h3 className="text-xs sm:text-sm font-bold" style={{ color: TEXT.primary }}>
                  {currentStance.label}
                </h3>
                <div className="flex items-center gap-1.5 text-[10px]" style={{ color: TEXT.secondary }}>
                  <span
                    className="px-2 py-0.5 rounded-md font-semibold"
                    style={{ backgroundColor: GLASS.fillRaised }}
                  >
                    Rodilla: {currentStance.kneeFlexionDeg}
                  </span>
                  <span
                    className="px-2 py-0.5 rounded-md font-semibold"
                    style={{ backgroundColor: GLASS.fillRaised }}
                  >
                    Cadera: {currentStance.hipFlexionDeg}
                  </span>
                </div>
              </div>
              <p className="text-[13px] leading-relaxed" style={{ color: TEXT.secondary }}>
                {currentStance.biomechanicalFocus}
              </p>
              <ul className="space-y-1.5">
                {currentStance.cues.slice(0, 2).map((cue) => (
                  <li
                    key={cue}
                    className="flex items-start gap-2 text-[13px] leading-snug"
                    style={{ color: TEXT.primary }}
                  >
                    <Check
                      className="h-3.5 w-3.5 shrink-0 mt-0.5"
                      style={{ color: STATUS.success.text }}
                    />
                    <span>{cue}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={handleApply}
                className="w-full py-2.5 px-3 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5"
                style={{
                  backgroundColor: ACCENT.base,
                  color: TEXT.onAccent,
                  borderRadius: RADIUS.button,
                }}
              >
                <Check className="h-3.5 w-3.5 shrink-0" />
                <span>Aplicar esta postura de pies</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: MANERALES — Clean Cards + Immediate Popover Detail View on Tap */}
        {activeTab === "attachments" && (
          <div className="space-y-3">
            {selectedAttachmentDetailOpen ? (
              /* Immediate Apple App Store Detail Sheet (No scrolling required) */
              <div
                className="rounded-2xl p-3.5 space-y-3"
                style={{
                  backgroundColor: SURFACE.base,
                  border: `1px solid ${ACCENT.border}`,
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedAttachmentDetailOpen(false)}
                    className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold"
                    style={{
                      backgroundColor: GLASS.fillRaised,
                      border: `1px solid ${GLASS.border}`,
                      color: TEXT.primary,
                    }}
                  >
                    <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
                    <span>Volver a los manerales</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedAttachmentDetailOpen(false)}
                    aria-label="Cerrar detalle de maneral"
                    className="h-8 w-8 rounded-full flex items-center justify-center"
                    style={{
                      backgroundColor: GLASS.fillRaised,
                      border: `1px solid ${GLASS.border}`,
                      color: TEXT.secondary,
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Side-by-Side Photo + Live Anatomical Body Map */}
                <div className="grid grid-cols-2 gap-3 items-center">
                  <div
                    className="rounded-2xl overflow-hidden flex flex-col items-center justify-center p-2"
                    style={{
                      backgroundColor: SOLID.card,
                      border: `1px solid ${GLASS.borderStrong}`,
                    }}
                  >
                    <img
                      src={currentAttachment.imageUrl}
                      alt={currentAttachment.name}
                      className="w-full h-32 object-cover rounded-xl"
                    />
                    <span
                      className="mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: ACCENT.subtle,
                        color: ACCENT.text,
                        border: `1px solid ${ACCENT.border}`,
                      }}
                    >
                      {currentAttachment.gripOrientation}
                    </span>
                  </div>

                  <div
                    className="rounded-2xl p-2 flex flex-col items-center justify-center"
                    style={{
                      backgroundColor: SOLID.card,
                      border: `1px solid ${GLASS.border}`,
                    }}
                  >
                    <span
                      className="text-[10px] font-bold uppercase tracking-wider mb-1"
                      style={{ color: TEXT.secondary }}
                    >
                      Músculos Reclutados
                    </span>
                    <div className="w-24 mx-auto">
                      <MuscleReadonlyMap
                        counts={activeMuscleCounts}
                        side={currentAttachment.recommendedSide}
                        label={`Mapa muscular para ${currentAttachment.shortName}`}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold" style={{ color: TEXT.primary }}>
                    {currentAttachment.name}
                  </h3>
                  <div
                    className="mt-1.5 rounded-xl p-2.5 space-y-1"
                    style={{ backgroundColor: GLASS.fill, border: `1px solid ${GLASS.border}` }}
                  >
                    <p
                      className="text-[11px] font-bold flex items-center gap-1.5"
                      style={{ color: TEXT.primary }}
                    >
                      <Info className="h-3.5 w-3.5 shrink-0" style={{ color: ACCENT.text }} />
                      ¿Para qué sirve este maneral?
                    </p>
                    <p className="text-xs leading-relaxed" style={{ color: TEXT.secondary }}>
                      {currentAttachment.biomechanicalFocus} {currentAttachment.whyUseIt}
                    </p>
                  </div>
                </div>

                <div className="space-y-1">
                  <p
                    className="text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: TEXT.tertiary }}
                  >
                    Músculos enfatizados
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {currentAttachment.primaryMuscles.map((m) => (
                      <span
                        key={m}
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-md"
                        style={{
                          backgroundColor: ACCENT.subtle,
                          color: TEXT.primary,
                          border: `1px solid ${ACCENT.border}`,
                        }}
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <p
                    className="text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: TEXT.tertiary }}
                  >
                    Ejercicios recomendados
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {currentAttachment.recommendedExercises.map((exName) => (
                      <span
                        key={exName}
                        className="text-[11px] px-2 py-0.5 rounded-lg"
                        style={{
                          backgroundColor: GLASS.fillRaised,
                          border: `1px solid ${GLASS.border}`,
                          color: TEXT.primary,
                        }}
                      >
                        {exName}
                      </span>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleApply}
                  className="w-full py-2.5 px-3 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5"
                  style={{
                    backgroundColor: ACCENT.base,
                    color: TEXT.onAccent,
                    borderRadius: RADIUS.button,
                  }}
                >
                  <Check className="h-3.5 w-3.5 shrink-0" />
                  <span>Aplicar este maneral a mi ejercicio</span>
                </button>
              </div>
            ) : (
              /* Attachment Gallery Grid — Tapping any card opens the detail view immediately */
              <>
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      { id: "all" as const, label: "Todos (10)" },
                      { id: "pull_back" as const, label: "Espalda / Jalón y Remo" },
                      { id: "arms_isolation" as const, label: "Bíceps / Tríceps / Hombro" },
                      { id: "legs_glutes" as const, label: "Glúteo (Tobillera)" },
                    ] as const
                  ).map((chip) => {
                    const active = attachmentFilter === chip.id;
                    return (
                      <button
                        key={chip.id}
                        type="button"
                        onClick={() => setAttachmentFilter(chip.id)}
                        className="rounded-full px-2.5 py-1 text-xs font-semibold"
                        style={{
                          backgroundColor: active ? ACCENT.subtle : GLASS.fill,
                          border: `1px solid ${active ? ACCENT.border : GLASS.border}`,
                          color: active ? TEXT.primary : TEXT.secondary,
                        }}
                      >
                        {chip.label}
                      </button>
                    );
                  })}
                </div>

                <p className="text-[11px]" style={{ color: TEXT.secondary }}>
                  Toca cualquier maneral para abrir su ficha biomecánica y ver los músculos que activa:
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {filteredAttachments.map((item) => {
                    const selected = item.equipmentId === currentAttachment.equipmentId;
                    return (
                      <button
                        key={item.equipmentId}
                        type="button"
                        onClick={() => {
                          setSelectedAttachmentId(item.equipmentId);
                          setSelectedAttachmentDetailOpen(true);
                        }}
                        className="rounded-2xl p-2 text-left flex flex-col gap-1.5 min-w-0 overflow-hidden"
                        style={{
                          backgroundColor: selected ? ACCENT.subtle : SURFACE.base,
                          border: `1px solid ${selected ? ACCENT.border : GLASS.border}`,
                        }}
                      >
                        <div
                          className="w-full h-20 rounded-xl overflow-hidden flex items-center justify-center"
                          style={{ backgroundColor: SOLID.card }}
                        >
                          <img
                            src={item.imageUrl}
                            alt={item.shortName}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </div>
                        <div className="min-w-0">
                          <span
                            className="text-[10px] font-semibold block truncate"
                            style={{ color: ACCENT.text }}
                          >
                            {shortGripBadge(item)}
                          </span>
                          <p className="text-xs font-bold truncate" style={{ color: TEXT.primary }}>
                            {item.shortName}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 3: ÁNGULO Y CODOS — Compact Selector + Side-by-Side Vector & Anatomical Map */}
        {activeTab === "upper_angle" && (
          <div className="space-y-2.5">
            <div className="grid grid-cols-3 gap-1.5">
              {UPPER_BODY_GRIP_MATRIX.map((entry) => {
                const selected = entry.id === currentTrajectory.id;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => setSelectedTrajectoryId(entry.id)}
                    className="rounded-xl px-2 py-2 text-left min-w-0"
                    style={{
                      backgroundColor: selected ? ACCENT.subtle : GLASS.fill,
                      border: `1px solid ${selected ? ACCENT.border : GLASS.border}`,
                    }}
                  >
                    <span
                      className="text-[10px] font-bold uppercase tracking-wider block truncate"
                      style={{ color: selected ? ACCENT.text : TEXT.tertiary }}
                    >
                      {entry.angleBadge}
                    </span>
                    <p className="text-[11px] font-bold truncate mt-0.5" style={{ color: TEXT.primary }}>
                      {entry.label}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Side-by-Side Vector Diagram + Anatomical Body Map */}
            <div className="grid grid-cols-2 gap-2.5 items-stretch">
              <div
                className="rounded-2xl p-3 flex flex-col justify-between"
                style={{
                  backgroundColor: SURFACE.base,
                  border: `1px solid ${GLASS.border}`,
                }}
              >
                <div className="flex items-center justify-between gap-1">
                  <span
                    className="text-[10px] font-bold uppercase tracking-wider truncate"
                    style={{ color: ACCENT.text }}
                  >
                    {currentTrajectory.angleBadge}
                  </span>
                  <Crosshair className="h-3.5 w-3.5 shrink-0" style={{ color: ACCENT.text }} />
                </div>

                {/* Vector SVG representation of bench/elbow angle */}
                <svg
                  viewBox="0 0 180 110"
                  className="w-full h-28 my-1 select-none"
                  role="img"
                  aria-label={`Esquema de ángulo para ${currentTrajectory.label}`}
                >
                  <line
                    x1="20"
                    y1="92"
                    x2="160"
                    y2="92"
                    stroke={GLASS.borderStrong}
                    strokeWidth="2"
                    strokeDasharray="4 3"
                  />
                  <circle cx="52" cy="92" r="4" fill={ACCENT.base} />
                  {(() => {
                    const degMap: Record<UpperBodyTrajectoryId, number> = {
                      bench_decline_15: 12,
                      bench_flat_0: 0,
                      bench_incline_30: -30,
                      bench_incline_45: -45,
                      bench_shoulder_75: -72,
                      elbows_tucked_lats: -18,
                      elbows_flared_upper_back: -58,
                      shoulder_hyperext_bayesian: -35,
                      shoulder_flexed_preacher: -50,
                    };
                    const deg = degMap[currentTrajectory.id] ?? -30;
                    const rad = (deg * Math.PI) / 180;
                    const x2 = 52 + Math.cos(rad) * 86;
                    const y2 = 88 + Math.sin(rad) * 86;
                    return (
                      <>
                        <line
                          x1="52"
                          y1="88"
                          x2={x2}
                          y2={y2}
                          stroke={ACCENT.base}
                          strokeWidth="5"
                          strokeLinecap="round"
                        />
                        <circle cx={x2} cy={y2} r="5" fill={TEXT.primary} />
                      </>
                    );
                  })()}
                </svg>

                <div
                  className="rounded-xl p-2 flex items-start gap-1.5"
                  style={{
                    backgroundColor: GLASS.fillRaised,
                    border: `1px solid ${GLASS.border}`,
                  }}
                >
                  <ShieldCheck
                    className="h-3.5 w-3.5 shrink-0 mt-0.5"
                    style={{ color: STATUS.success.text }}
                  />
                  <span className="text-[10px] leading-snug" style={{ color: TEXT.secondary }}>
                    {currentTrajectory.jointProtectionNote}
                  </span>
                </div>
              </div>

              <div
                className="rounded-2xl p-3 flex flex-col justify-between items-center"
                style={{
                  backgroundColor: SURFACE.base,
                  border: `1px solid ${GLASS.border}`,
                }}
              >
                <span
                  className="text-[10px] font-bold uppercase tracking-wider self-start"
                  style={{ color: TEXT.secondary }}
                >
                  Enfoque Muscular
                </span>
                <div className="w-24 mx-auto my-1">
                  <MuscleReadonlyMap
                    counts={activeMuscleCounts}
                    side={currentTrajectory.recommendedSide}
                    label={`Mapa muscular para ${currentTrajectory.label}`}
                  />
                </div>
                <div className="flex flex-wrap gap-1 justify-center">
                  {currentTrajectory.primaryMuscles.map((m) => (
                    <span
                      key={m}
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                      style={{
                        backgroundColor: ACCENT.subtle,
                        color: TEXT.primary,
                        border: `1px solid ${ACCENT.border}`,
                      }}
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div
              className="rounded-2xl p-3 space-y-2"
              style={{
                backgroundColor: GLASS.fill,
                border: `1px solid ${GLASS.border}`,
              }}
            >
              <h3 className="text-xs sm:text-sm font-bold" style={{ color: TEXT.primary }}>
                {currentTrajectory.label}
              </h3>
              <p className="text-xs leading-relaxed" style={{ color: TEXT.secondary }}>
                {currentTrajectory.biomechanicalFocus}
              </p>
              <ul className="space-y-1">
                {currentTrajectory.cues.map((cue) => (
                  <li
                    key={cue}
                    className="flex items-start gap-1.5 text-xs"
                    style={{ color: TEXT.primary }}
                  >
                    <Check
                      className="h-3.5 w-3.5 shrink-0 mt-0.5"
                      style={{ color: STATUS.success.text }}
                    />
                    <span>{cue}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={handleApply}
                className="w-full py-2.5 px-3 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5"
                style={{
                  backgroundColor: ACCENT.base,
                  color: TEXT.onAccent,
                  borderRadius: RADIUS.button,
                }}
              >
                <Check className="h-3.5 w-3.5 shrink-0" />
                <span>Aplicar este ángulo / trayectoria</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modalContent, document.body) : modalContent;
}

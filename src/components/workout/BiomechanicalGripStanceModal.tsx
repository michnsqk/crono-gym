import { useEffect, useMemo, useState } from "react";
import { Check, Compass, Crosshair, Dumbbell, Footprints, Info, ShieldCheck, Sliders, X } from "lucide-react";
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
  const [selectedAttachmentId, setSelectedAttachmentId] = useState<string>("CG-EQP-0038");
  const [selectedTrajectoryId, setSelectedTrajectoryId] =
    useState<UpperBodyTrajectoryId>("bench_incline_30");
  const [attachmentFilter, setAttachmentFilter] = useState<"all" | "pull_back" | "arms_isolation" | "legs_glutes">("all");

  useEffect(() => {
    if (!open) return;
    setActiveTab(resolveInitialBiomechanicsTab(context));
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Atlas Biomecánico de Agarres, Manerales y Posturas"
      className="fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{
        backgroundColor: SCRIM.modal,
        backdropFilter: GLASS.blurPlain20,
        zIndex: Z_INDEX.modal,
      }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-4 sm:p-6 space-y-4"
        style={{
          backgroundColor: SURFACE.elevated,
          border: `1px solid ${GLASS.borderStrong}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <Compass className="h-3.5 w-3.5 shrink-0" style={{ color: ACCENT.text }} />
              <span
                className="text-[10px] font-bold uppercase tracking-widest truncate"
                style={{ color: ACCENT.text }}
              >
                CRONOS BIOMECHANICS ATLAS · APPLE FITNESS+ GUIDE
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-bold tracking-tight mt-0.5" style={{ color: TEXT.primary }}>
              Mapa Interactivo de Agarres, Manerales y Posturas
            </h2>
            {exerciseTitle ? (
              <p className="text-xs truncate mt-0.5" style={{ color: TEXT.secondary }}>
                Ejercicio activo: <span style={{ color: TEXT.primary }}>{exerciseTitle}</span>
              </p>
            ) : (
              <p className="text-xs mt-0.5" style={{ color: TEXT.secondary }}>
                Descubre cómo la posición de los pies, el maneral o el ángulo del codo cambia las fibras reclutadas.
              </p>
            )}
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

        {/* 3-Tab Segmented Control */}
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
                label: "Posición de Pies",
                sub: "Pierna / Prensa",
                Icon: Footprints,
              },
              {
                id: "attachments" as const,
                label: "Manerales & Agarres",
                sub: "Espalda / Brazo",
                Icon: Dumbbell,
              },
              {
                id: "upper_angle" as const,
                label: "Ángulo & Codos",
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
                onClick={() => setActiveTab(id)}
                className="flex flex-col items-center justify-center rounded-xl py-2 px-1.5 text-center min-w-0"
                style={{
                  backgroundColor: active ? SOLID.popover : "transparent",
                  border: active ? `1px solid ${ACCENT.border}` : "1px solid transparent",
                  color: active ? TEXT.primary : TEXT.secondary,
                }}
              >
                <div className="flex items-center gap-1 min-w-0 max-w-full">
                  <Icon
                    className="h-3.5 w-3.5 shrink-0"
                    style={{ color: active ? ACCENT.text : TEXT.tertiary }}
                  />
                  <span className="text-[11px] font-bold truncate">{label}</span>
                </div>
                <span className="text-[10px] truncate max-w-full" style={{ color: TEXT.tertiary }}>
                  {sub}
                </span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: FOOT STANCE (PRENSA / HACK / SMITH / SENTADILLA) */}
        {activeTab === "foot_stance" && (
          <div className="space-y-3">
            {/* Quick selector pills */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
              {FOOT_STANCE_MATRIX.map((zone) => {
                const selected = zone.id === currentStance.id;
                return (
                  <button
                    key={zone.id}
                    type="button"
                    onClick={() => setSelectedStanceId(zone.id)}
                    className="rounded-xl px-2.5 py-2 text-left min-w-0"
                    style={{
                      backgroundColor: selected ? ACCENT.subtle : GLASS.fill,
                      border: `1px solid ${selected ? ACCENT.border : GLASS.border}`,
                      color: selected ? TEXT.primary : TEXT.secondary,
                    }}
                  >
                    <p className="text-[11px] font-bold truncate">{zone.shortLabel}</p>
                    <p className="text-[10px] truncate mt-0.5" style={{ color: TEXT.tertiary }}>
                      {zone.toeOutAngleDeg}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Interactive Platform SVG + Dual Anatomical Body Map */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Interactive Footplate Vector */}
              <div
                className="rounded-2xl p-3 flex flex-col justify-between"
                style={{
                  backgroundColor: SURFACE.base,
                  border: `1px solid ${GLASS.border}`,
                }}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: TEXT.secondary }}>
                    Plataforma de Prensa / Hack (Toca una postura)
                  </span>
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: ACCENT.subtle,
                      color: ACCENT.text,
                      border: `1px solid ${ACCENT.border}`,
                    }}
                  >
                    {currentStance.shortLabel}
                  </span>
                </div>

                <svg
                  viewBox="0 0 220 165"
                  className="w-full h-44 select-none"
                  role="img"
                  aria-label="Plataforma interactiva de posición de pies"
                >
                  {/* Platform Outer Frame */}
                  <rect
                    x="14"
                    y="8"
                    width="192"
                    height="148"
                    rx="14"
                    fill={SOLID.card}
                    stroke={GLASS.borderStrong}
                    strokeWidth="1.5"
                  />
                  {/* Non-slip grid lines */}
                  <line x1="110" y1="14" x2="110" y2="150" stroke={GLASS.border} strokeDasharray="3 3" />
                  <line x1="22" y1="54" x2="198" y2="54" stroke={GLASS.border} strokeDasharray="3 3" />
                  <line x1="22" y1="98" x2="198" y2="98" stroke={GLASS.border} strokeDasharray="3 3" />
                  <line x1="22" y1="132" x2="198" y2="132" stroke={GLASS.border} strokeDasharray="2 2" />

                  {/* Zone labels inside platform */}
                  <text x="110" y="22" textAnchor="middle" fill={TEXT.tertiary} className="text-[7px] font-bold">
                    ZONA SUPERIOR · GLÚTEO / ISQUIOS / SUMO
                  </text>
                  <text x="110" y="66" textAnchor="middle" fill={TEXT.tertiary} className="text-[7px] font-bold">
                    ZONA MEDIA · BALANCEADA
                  </text>
                  <text x="110" y="110" textAnchor="middle" fill={TEXT.tertiary} className="text-[7px] font-bold">
                    ZONA BAJA · ENFOQUE CUÁDRICEPS
                  </text>
                  <text x="110" y="151" textAnchor="middle" fill={TEXT.tertiary} className="text-[7px] font-bold">
                    BORDE INFERIOR · METATARSOS (PANTORRILLA)
                  </text>

                  {/* Render clickable footprints for each stance */}
                  {FOOT_STANCE_MATRIX.map((zone) => {
                    const isSelected = zone.id === currentStance.id;
                    const lx = 14 + (zone.svgFootprint.leftX / 100) * 192;
                    const rx = 14 + (zone.svgFootprint.rightX / 100) * 192;
                    const cy = 8 + (zone.svgFootprint.y / 100) * 148;
                    const rot = zone.svgFootprint.toeRotationDeg;
                    const fill = isSelected ? ACCENT.base : GLASS.fillRaised;
                    const stroke = isSelected ? TEXT.primary : GLASS.borderStrong;
                    const opacity = isSelected ? 1 : 0.42;

                    return (
                      <g
                        key={zone.id}
                        onClick={() => setSelectedStanceId(zone.id)}
                        className="cursor-pointer"
                        opacity={opacity}
                      >
                        {/* Left Foot */}
                        <g transform={`translate(${lx}, ${cy}) rotate(${-rot})`}>
                          <rect
                            x="-9"
                            y="-17"
                            width="18"
                            height="34"
                            rx="8"
                            fill={fill}
                            stroke={stroke}
                            strokeWidth={isSelected ? "1.6" : "1"}
                          />
                          <circle cx="0" cy="-10" r="3" fill={TEXT.primary} opacity={isSelected ? 0.85 : 0.35} />
                        </g>
                        {/* Right Foot */}
                        <g transform={`translate(${rx}, ${cy}) rotate(${rot})`}>
                          <rect
                            x="-9"
                            y="-17"
                            width="18"
                            height="34"
                            rx="8"
                            fill={fill}
                            stroke={stroke}
                            strokeWidth={isSelected ? "1.6" : "1"}
                          />
                          <circle cx="0" cy="-10" r="3" fill={TEXT.primary} opacity={isSelected ? 0.85 : 0.35} />
                        </g>
                      </g>
                    );
                  })}
                </svg>

                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div
                    className="rounded-xl p-2"
                    style={{ backgroundColor: GLASS.fill, border: `1px solid ${GLASS.border}` }}
                  >
                    <p className="text-[10px] uppercase" style={{ color: TEXT.tertiary }}>
                      Flexión de Rodilla
                    </p>
                    <p className="text-xs font-bold mt-0.5" style={{ color: TEXT.primary }}>
                      {currentStance.kneeFlexionDeg}
                    </p>
                  </div>
                  <div
                    className="rounded-xl p-2"
                    style={{ backgroundColor: GLASS.fill, border: `1px solid ${GLASS.border}` }}
                  >
                    <p className="text-[10px] uppercase" style={{ color: TEXT.tertiary }}>
                      Flexión de Cadera
                    </p>
                    <p className="text-xs font-bold mt-0.5" style={{ color: TEXT.primary }}>
                      {currentStance.hipFlexionDeg}
                    </p>
                  </div>
                </div>
              </div>

              {/* Live Anatomical Activation Map */}
              <div
                className="rounded-2xl p-3 flex flex-col justify-between"
                style={{
                  backgroundColor: SURFACE.base,
                  border: `1px solid ${GLASS.border}`,
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: TEXT.secondary }}>
                    Activación Anatómica
                  </span>
                  <span className="text-[10px]" style={{ color: TEXT.tertiary }}>
                    Vista {currentStance.recommendedSide === "front" ? "Frontal + Posterior" : "Posterior + Frontal"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 items-center my-2">
                  <div className="w-24 mx-auto">
                    <MuscleReadonlyMap
                      counts={activeMuscleCounts}
                      side="front"
                      label="Activación frontal de pierna"
                    />
                  </div>
                  <div className="w-24 mx-auto">
                    <MuscleReadonlyMap
                      counts={activeMuscleCounts}
                      side="back"
                      label="Activación posterior de pierna"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: ACCENT.text }}>
                    Músculos Primarios Enfatizados
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {currentStance.primaryMuscles.map((muscle) => (
                      <span
                        key={muscle}
                        className="text-[11px] font-semibold px-2 py-0.5 rounded-lg"
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
            </div>

            {/* Biomechanical Explanation & Cues */}
            <div
              className="rounded-2xl p-3.5 space-y-2"
              style={{
                backgroundColor: GLASS.fill,
                border: `1px solid ${GLASS.border}`,
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold" style={{ color: TEXT.primary }}>
                    {currentStance.label}
                  </h3>
                  <p className="text-xs" style={{ color: TEXT.secondary }}>
                    {currentStance.subtitle} · Separación: {currentStance.stanceWidthCm}
                  </p>
                </div>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: TEXT.secondary }}>
                {currentStance.biomechanicalFocus}
              </p>
              <ul className="space-y-1 pt-1">
                {currentStance.cues.map((cue) => (
                  <li key={cue} className="flex items-start gap-2 text-xs" style={{ color: TEXT.primary }}>
                    <Check className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: STATUS.success.text }} />
                    <span>{cue}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* TAB 2: MANERALES & AGARRES REALES DE CRONOS GYM */}
        {activeTab === "attachments" && (
          <div className="space-y-3">
            {/* Family Filter Chips */}
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: "all" as const, label: "Todos los Manerales (10)" },
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
                    className="rounded-full px-3 py-1 text-xs font-semibold"
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

            {/* Horizontal / Grid Gallery of Real Cronos Attachments */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {filteredAttachments.map((item) => {
                const selected = item.equipmentId === currentAttachment.equipmentId;
                return (
                  <button
                    key={item.equipmentId}
                    type="button"
                    onClick={() => setSelectedAttachmentId(item.equipmentId)}
                    className="rounded-2xl p-2 text-left flex flex-col gap-1.5 min-w-0 overflow-hidden"
                    style={{
                      backgroundColor: selected ? ACCENT.subtle : SURFACE.base,
                      border: `1px solid ${selected ? ACCENT.border : GLASS.border}`,
                    }}
                  >
                    <div
                      className="w-full h-16 rounded-xl overflow-hidden flex items-center justify-center"
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
                      <span className="text-[10px] font-mono block truncate" style={{ color: ACCENT.text }}>
                        {item.equipmentId}
                      </span>
                      <p className="text-xs font-bold truncate" style={{ color: TEXT.primary }}>
                        {item.shortName}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Selected Attachment Detail Card + Anatomical Map */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div
                className="sm:col-span-2 rounded-2xl p-3.5 space-y-2.5"
                style={{
                  backgroundColor: SURFACE.base,
                  border: `1px solid ${GLASS.border}`,
                }}
              >
                <div className="flex items-start gap-3">
                  <img
                    src={currentAttachment.imageUrl}
                    alt={currentAttachment.name}
                    className="h-16 w-16 rounded-xl object-cover shrink-0"
                    style={{ border: `1px solid ${GLASS.borderStrong}` }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md"
                        style={{ backgroundColor: GLASS.fillRaised, color: ACCENT.text }}
                      >
                        {currentAttachment.equipmentId}
                      </span>
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-md"
                        style={{ backgroundColor: GLASS.fill, color: TEXT.secondary }}
                      >
                        Agarre: {currentAttachment.gripOrientation}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold mt-1" style={{ color: TEXT.primary }}>
                      {currentAttachment.name}
                    </h3>
                  </div>
                </div>

                <div
                  className="rounded-xl p-2.5 space-y-1"
                  style={{ backgroundColor: GLASS.fill, border: `1px solid ${GLASS.border}` }}
                >
                  <p className="text-[11px] font-bold flex items-center gap-1.5" style={{ color: TEXT.primary }}>
                    <Info className="h-3.5 w-3.5 shrink-0" style={{ color: ACCENT.text }} />
                    ¿Para qué sirve este maneral?
                  </p>
                  <p className="text-xs leading-relaxed" style={{ color: TEXT.secondary }}>
                    {currentAttachment.biomechanicalFocus} {currentAttachment.whyUseIt}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: TEXT.tertiary }}>
                    Ejercicios recomendados en Cronos Gym
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {currentAttachment.recommendedExercises.map((exName) => (
                      <span
                        key={exName}
                        className="text-[11px] px-2.5 py-1 rounded-lg"
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
              </div>

              {/* Anatomical Map for Selected Attachment */}
              <div
                className="rounded-2xl p-3 flex flex-col justify-between"
                style={{
                  backgroundColor: SURFACE.base,
                  border: `1px solid ${GLASS.border}`,
                }}
              >
                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: TEXT.secondary }}>
                  Músculos Diana
                </span>
                <div className="w-28 mx-auto my-2">
                  <MuscleReadonlyMap
                    counts={activeMuscleCounts}
                    side={currentAttachment.recommendedSide}
                    label={`Mapa muscular para ${currentAttachment.shortName}`}
                  />
                </div>
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
            </div>
          </div>
        )}

        {/* TAB 3: ÁNGULO DE BANCA Y TRAYECTORIA DE CODOS */}
        {activeTab === "upper_angle" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {UPPER_BODY_GRIP_MATRIX.map((entry) => {
                const selected = entry.id === currentTrajectory.id;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => setSelectedTrajectoryId(entry.id)}
                    className="rounded-xl p-2.5 text-left min-w-0"
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
                    <p className="text-xs font-bold truncate mt-0.5" style={{ color: TEXT.primary }}>
                      {entry.label}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div
                className="sm:col-span-2 rounded-2xl p-3.5 space-y-2.5"
                style={{
                  backgroundColor: SURFACE.base,
                  border: `1px solid ${GLASS.border}`,
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span
                      className="text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: ACCENT.text }}
                    >
                      {currentTrajectory.angleBadge}
                    </span>
                    <h3 className="text-sm font-bold" style={{ color: TEXT.primary }}>
                      {currentTrajectory.label}
                    </h3>
                  </div>
                  <Crosshair className="h-4 w-4 shrink-0" style={{ color: ACCENT.text }} />
                </div>

                <p className="text-xs leading-relaxed" style={{ color: TEXT.secondary }}>
                  {currentTrajectory.biomechanicalFocus}
                </p>

                <div
                  className="rounded-xl p-2.5 flex items-start gap-2"
                  style={{
                    backgroundColor: GLASS.fillRaised,
                    border: `1px solid ${GLASS.borderStrong}`,
                  }}
                >
                  <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" style={{ color: STATUS.success.text }} />
                  <div className="text-xs">
                    <span className="font-bold block" style={{ color: TEXT.primary }}>
                      Protección Articular (Hombro y Codo)
                    </span>
                    <span style={{ color: TEXT.secondary }}>{currentTrajectory.jointProtectionNote}</span>
                  </div>
                </div>

                <ul className="space-y-1 pt-1">
                  {currentTrajectory.cues.map((cue) => (
                    <li key={cue} className="flex items-start gap-2 text-xs" style={{ color: TEXT.primary }}>
                      <Check className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: STATUS.success.text }} />
                      <span>{cue}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div
                className="rounded-2xl p-3 flex flex-col justify-between"
                style={{
                  backgroundColor: SURFACE.base,
                  border: `1px solid ${GLASS.border}`,
                }}
              >
                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: TEXT.secondary }}>
                  Enfoque Muscular
                </span>
                <div className="w-28 mx-auto my-2">
                  <MuscleReadonlyMap
                    counts={activeMuscleCounts}
                    side={currentTrajectory.recommendedSide}
                    label={`Mapa muscular para ${currentTrajectory.label}`}
                  />
                </div>
                <div className="flex flex-wrap gap-1">
                  {currentTrajectory.primaryMuscles.map((m) => (
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
            </div>
          </div>
        )}

        {/* Footer CTA */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-xs font-semibold rounded-xl"
            style={{
              backgroundColor: GLASS.fillRaised,
              border: `1px solid ${GLASS.border}`,
              color: TEXT.secondary,
              borderRadius: RADIUS.button,
            }}
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="px-4 py-2.5 text-xs font-bold rounded-xl flex items-center gap-1.5"
            style={{
              backgroundColor: ACCENT.base,
              color: TEXT.onAccent,
              borderRadius: RADIUS.button,
            }}
          >
            <Check className="h-3.5 w-3.5 shrink-0" />
            <span>Aplicar esta postura/maneral a mi ejercicio</span>
          </button>
        </div>
      </div>
    </div>
  );
}

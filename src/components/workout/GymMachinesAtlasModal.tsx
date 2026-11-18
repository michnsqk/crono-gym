import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import QRCode from "qrcode";
import {
  ArrowLeft,
  Camera,
  Check,
  ChevronRight,
  Download,
  Dumbbell,
  QrCode,
  X,
} from "lucide-react";
import { MACHINE_GUIDE_CATALOG, type MachineGuideEntry } from "@/data/machineGuideCatalog";
import { equipmentMap } from "@/data/equipmentMap";
import { CRONOS_MACHINERY_EXERCISES } from "@/lib/catalog/machinerySeedExercises";
import { resolveMediaUrl } from "@/lib/media/mediaResolver";
import { ACCENT, GLASS, SCRIM, STATUS, SURFACE, TEXT, Z_INDEX } from "@/design/tokens";

export interface GymMachinesAtlasModalProps {
  open: boolean;
  onClose: () => void;
  initialEquipmentId?: string | null;
}

export function GymMachinesAtlasModal({
  open,
  onClose,
  initialEquipmentId = null,
}: GymMachinesAtlasModalProps) {
  const [groupFilter, setGroupFilter] = useState<"Todas" | MachineGuideEntry["group"]>("Todas");
  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(initialEquipmentId);
  const [activeViewIdx, setActiveViewIdx] = useState(0);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [showQrPanel, setShowQrPanel] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedMachineId(initialEquipmentId ?? null);
    setActiveViewIdx(0);
    setShowQrPanel(false);
  }, [open, initialEquipmentId]);

  const selectedMachine = useMemo(
    () =>
      selectedMachineId
        ? MACHINE_GUIDE_CATALOG.find((m) => m.equipmentId === selectedMachineId) ?? null
        : null,
    [selectedMachineId],
  );

  const selectedEquipmentPhotos = useMemo(
    () => (selectedMachine ? equipmentMap[selectedMachine.equipmentId]?.views ?? [] : []),
    [selectedMachine],
  );

  const selectedMachineExercises = useMemo(() => {
    if (!selectedMachine) return [];
    return CRONOS_MACHINERY_EXERCISES.filter(
      (ex) => ex.equipment_id === selectedMachine.equipmentId,
    );
  }, [selectedMachine]);

  const machineQrUrl = useMemo(() => {
    if (!selectedMachine || typeof window === "undefined") return "";
    return `${window.location.origin}/rutinas?machine=${encodeURIComponent(
      selectedMachine.equipmentId,
    )}`;
  }, [selectedMachine]);

  useEffect(() => {
    if (!selectedMachine || !machineQrUrl) {
      setQrDataUrl(null);
      return;
    }
    let alive = true;
    void QRCode.toDataURL(machineQrUrl, {
      width: 320,
      margin: 2,
      color: { dark: "#000000", light: "#FFFFFF" },
    })
      .then((url) => {
        if (alive) setQrDataUrl(url);
      })
      .catch(() => {
        if (alive) setQrDataUrl(null);
      });
    return () => {
      alive = false;
    };
  }, [selectedMachine, machineQrUrl]);

  if (!open) return null;

  const handleDownloadQr = () => {
    if (!qrDataUrl || !selectedMachine) return;
    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = `cronos-qr-${selectedMachine.equipmentId}.png`;
    link.click();
  };

  const filteredMachines = MACHINE_GUIDE_CATALOG.filter(
    (m) => groupFilter === "Todas" || m.group === groupFilter,
  );

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Atlas de Máquinas del Gimnasio"
      className="fixed inset-0 flex items-end justify-center p-0 sm:items-center sm:p-4"
      style={{
        backgroundColor: SCRIM.modal,
        backdropFilter: GLASS.blurPlain20,
        zIndex: Math.max(Z_INDEX.modal, 110),
      }}
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl space-y-3.5 overflow-y-auto rounded-t-3xl p-4 pb-10 sm:rounded-3xl sm:p-5"
        style={{
          backgroundColor: SURFACE.elevated,
          border: `1px solid ${GLASS.borderStrong}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex min-w-0 items-center gap-2">
            {selectedMachine && (
              <button
                type="button"
                onClick={() => {
                  setSelectedMachineId(null);
                  setActiveViewIdx(0);
                  setShowQrPanel(false);
                }}
                aria-label="Volver a todas las máquinas"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                style={{
                  backgroundColor: GLASS.fillRaised,
                  border: `1px solid ${GLASS.border}`,
                  color: TEXT.primary,
                }}
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <Dumbbell className="h-3.5 w-3.5 shrink-0" style={{ color: ACCENT.text }} />
                <span
                  className="truncate text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: ACCENT.text }}
                >
                  CRONOS GYM · {MACHINE_GUIDE_CATALOG.length} EQUIPOS
                </span>
              </div>
              <h2
                className="mt-0.5 truncate text-sm font-bold tracking-tight sm:text-base"
                style={{ color: TEXT.primary }}
              >
                {selectedMachine ? selectedMachine.name : "Atlas de Máquinas del Gym"}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar Atlas de Máquinas"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            style={{
              backgroundColor: GLASS.fillRaised,
              border: `1px solid ${GLASS.border}`,
              color: TEXT.secondary,
            }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* VISTA DETALLE DE UNA MÁQUINA (Fotos + Ejercicios con GIF + QR) */}
        {selectedMachine ? (
          <div className="space-y-4">
            {/* Galería de Vistas Reales de la Máquina */}
            {selectedEquipmentPhotos.length > 0 && (
              <div className="space-y-2">
                <div
                  className="relative aspect-video w-full overflow-hidden rounded-2xl"
                  style={{
                    backgroundColor: SURFACE.base,
                    border: `1px solid ${GLASS.border}`,
                  }}
                >
                  <img
                    src={resolveMediaUrl(
                      selectedEquipmentPhotos[activeViewIdx]?.src ??
                        selectedEquipmentPhotos[0].src,
                    )}
                    alt={`${selectedMachine.name} vista ${activeViewIdx + 1}`}
                    className="h-full w-full object-contain"
                    loading="lazy"
                  />
                  <span
                    className="absolute left-3 top-3 rounded-full px-2.5 py-1 font-mono text-[10px] font-bold"
                    style={{
                      backgroundColor: "rgba(0,0,0,0.72)",
                      color: "#FFFFFF",
                      border: "1px solid rgba(255,255,255,0.15)",
                    }}
                  >
                    {selectedMachine.equipmentId} · Vista {activeViewIdx + 1}/
                    {selectedEquipmentPhotos.length}
                  </span>
                </div>

                {selectedEquipmentPhotos.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {selectedEquipmentPhotos.map((view, idx) => (
                      <button
                        key={view.id}
                        type="button"
                        onClick={() => setActiveViewIdx(idx)}
                        className="relative h-14 w-20 shrink-0 overflow-hidden rounded-xl transition"
                        style={{
                          border:
                            idx === activeViewIdx
                              ? `2px solid ${ACCENT.base}`
                              : `1px solid ${GLASS.border}`,
                          opacity: idx === activeViewIdx ? 1 : 0.65,
                        }}
                      >
                        <img
                          src={resolveMediaUrl(view.src)}
                          alt={`Miniatura ${idx + 1}`}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Músculos + Tip + Botón QR */}
            <div
              className="space-y-2.5 rounded-2xl p-3.5"
              style={{
                backgroundColor: SURFACE.base,
                border: `1px solid ${GLASS.border}`,
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1.5">
                  {selectedMachine.muscles.map((muscle) => (
                    <span
                      key={muscle}
                      className="rounded-md px-2 py-0.5 text-[10px] font-semibold"
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

                <button
                  type="button"
                  onClick={() => setShowQrPanel((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition"
                  style={{
                    backgroundColor: showQrPanel ? ACCENT.base : GLASS.fillRaised,
                    color: "#FFFFFF",
                    border: `1px solid ${showQrPanel ? ACCENT.base : GLASS.border}`,
                  }}
                >
                  <QrCode className="h-3.5 w-3.5" />
                  <span>{showQrPanel ? "Ocultar QR" : "QR de esta máquina"}</span>
                </button>
              </div>

              <p className="text-xs leading-relaxed" style={{ color: TEXT.secondary }}>
                <span className="font-semibold text-white">Tip biomecánico: </span>
                {selectedMachine.tip}
              </p>

              {showQrPanel && (
                <div
                  className="mt-2 flex flex-col items-center gap-3 rounded-2xl p-4 sm:flex-row"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.03)",
                    border: `1px solid ${GLASS.border}`,
                  }}
                >
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt={`QR ${selectedMachine.name}`}
                      className="h-36 w-36 shrink-0 rounded-xl bg-white p-2"
                    />
                  ) : (
                    <div className="flex h-36 w-36 items-center justify-center rounded-xl bg-white/10 text-xs text-neutral-400">
                      Generando QR…
                    </div>
                  )}
                  <div className="space-y-2 text-center sm:text-left">
                    <p className="text-xs font-bold text-white">
                      Código QR para pegar en {selectedMachine.name} ({selectedMachine.equipmentId})
                    </p>
                    <p className="text-[11px] text-neutral-400">
                      Al escanearlo con la cámara del celular, abre directamente esta máquina con sus
                      vistas y los GIFs de los ejercicios que se pueden hacer aquí.
                    </p>
                    <button
                      type="button"
                      onClick={handleDownloadQr}
                      disabled={!qrDataUrl}
                      className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold text-white"
                      style={{ backgroundColor: ACCENT.base }}
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Descargar QR PNG</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Ejercicios con sus GIFs animados en esta máquina */}
            <div className="space-y-2">
              <h3
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: TEXT.secondary }}
              >
                Ejercicios que puedes hacer en esta máquina ({selectedMachineExercises.length || selectedMachine.exercises.length})
              </h3>

              {selectedMachineExercises.length > 0 ? (
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {selectedMachineExercises.map((ex) => {
                    const gifSrc = resolveMediaUrl(ex.gif_url ?? ex.image ?? "");
                    return (
                      <div
                        key={ex.id}
                        className="flex items-center gap-3 rounded-2xl p-2.5"
                        style={{
                          backgroundColor: SURFACE.base,
                          border: `1px solid ${GLASS.border}`,
                        }}
                      >
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-black/50">
                          {gifSrc ? (
                            <img
                              src={gifSrc}
                              alt={ex.name_es ?? ex.name}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <Dumbbell className="h-5 w-5 text-neutral-500" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-bold text-white">
                            {ex.name_es ?? ex.name}
                          </p>
                          <p className="mt-0.5 line-clamp-2 text-[11px] text-neutral-400">
                            {Array.isArray(ex.instructions) && ex.instructions[0]
                              ? ex.instructions[0]
                              : selectedMachine.tip}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <ul className="space-y-1.5 rounded-2xl p-3" style={{ backgroundColor: SURFACE.base }}>
                  {selectedMachine.exercises.map((exName) => (
                    <li key={exName} className="flex items-center gap-2 text-xs text-white">
                      <Check className="h-3.5 w-3.5 shrink-0" style={{ color: STATUS.success.text }} />
                      <span>{exName}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : (
          /* LISTA / CUADRÍCULA DE LAS 31 MÁQUINAS CON SUS FOTOS */
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  "Todas",
                  "Pierna / Glúteo",
                  "Espalda / Torso",
                  "Pecho / Hombro",
                  "Brazos",
                  "General / Core",
                ] as const
              ).map((group) => {
                const active = groupFilter === group;
                return (
                  <button
                    key={group}
                    type="button"
                    onClick={() => setGroupFilter(group)}
                    className="rounded-full px-3 py-1.5 text-[11px] font-semibold transition"
                    style={{
                      backgroundColor: active ? ACCENT.base : SURFACE.base,
                      color: active ? "#FFFFFF" : TEXT.secondary,
                      border: `1px solid ${active ? ACCENT.base : GLASS.border}`,
                    }}
                  >
                    {group}
                  </button>
                );
              })}
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2">
              {filteredMachines.map((machine) => {
                const views = equipmentMap[machine.equipmentId]?.views ?? [];
                const thumbSrc = views[0] ? resolveMediaUrl(views[0].src) : null;
                const exCount =
                  CRONOS_MACHINERY_EXERCISES.filter(
                    (ex) => ex.equipment_id === machine.equipmentId,
                  ).length || machine.exercises.length;

                return (
                  <button
                    key={machine.equipmentId}
                    type="button"
                    onClick={() => {
                      setSelectedMachineId(machine.equipmentId);
                      setActiveViewIdx(0);
                      setShowQrPanel(false);
                    }}
                    className="group flex items-center gap-3 rounded-2xl p-3 text-left transition active:scale-[0.98]"
                    style={{
                      backgroundColor: SURFACE.base,
                      border: `1px solid ${GLASS.border}`,
                    }}
                  >
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-black/60">
                      {thumbSrc ? (
                        <img
                          src={thumbSrc}
                          alt={machine.name}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Dumbbell className="h-6 w-6 text-neutral-500" />
                        </div>
                      )}
                      {views.length > 0 && (
                        <span className="absolute bottom-1 right-1 inline-flex items-center gap-0.5 rounded bg-black/75 px-1.5 py-0.5 font-mono text-[9px] font-bold text-white">
                          <Camera className="h-2.5 w-2.5" />
                          {views.length}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <span
                        className="block text-[10px] font-bold uppercase tracking-wider"
                        style={{ color: ACCENT.text }}
                      >
                        {machine.group} · {machine.equipmentId}
                      </span>
                      <h3 className="truncate text-sm font-bold text-white">{machine.name}</h3>
                      <p className="truncate text-[11px] text-neutral-400">
                        {machine.muscles.join(" · ")}
                      </p>
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-white/80">
                        Ver {exCount} ejercicios con GIF y QR
                      </span>
                    </div>

                    <ChevronRight className="h-4 w-4 shrink-0 text-neutral-500 transition-transform group-hover:translate-x-0.5" />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modalContent, document.body) : modalContent;
}

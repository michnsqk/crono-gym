import { useEffect, useMemo, useState } from "react";
import { Disc, Minus, Plus, X } from "lucide-react";
import { ACCENT, GLASS, RADIUS, SCRIM, STATUS, SURFACE, TEXT, Z_INDEX } from "@/design/tokens";
import { useGymSettings } from "@/context/GymSettingsContext";
import {
  BAR_WEIGHTS,
  calculatePlates,
  nearestLoadable,
  warmupSets,
  type BarType,
  type PlateKg,
} from "@/lib/workout/weightUtils";

const BAR_OPTIONS: Array<{ id: BarType; label: string }> = [
  { id: "olympic", label: "Olímpica (20 kg)" },
  { id: "standard", label: "Estándar (15 kg)" },
  { id: "ez", label: "Barra EZ (10 kg)" },
  { id: "hex", label: "Hexagonal (18 kg)" },
  { id: "custom", label: "Libre / 0 kg" },
];

const QUICK_PRESETS = [40, 60, 80, 100, 120, 140] as const;

function plateVisualStyle(weight: PlateKg): { height: number; width: number; color: string; textColor: string } {
  switch (weight) {
    case 25:
      return { height: 76, width: 16, color: "#E53935", textColor: "#FFFFFF" };
    case 20:
      return { height: 72, width: 15, color: "#1E88E5", textColor: "#FFFFFF" };
    case 15:
      return { height: 64, width: 14, color: "#FDD835", textColor: "#000000" };
    case 10:
      return { height: 56, width: 13, color: "#43A047", textColor: "#FFFFFF" };
    case 5:
      return { height: 46, width: 12, color: "#E5E7EB", textColor: "#000000" };
    case 2.5:
      return { height: 38, width: 10, color: "#52525B", textColor: "#FFFFFF" };
    default:
      return { height: 30, width: 9, color: "#A1A1AA", textColor: "#000000" };
  }
}

export interface PlateCalculatorSheetProps {
  isOpen: boolean;
  initialWeightKg: number;
  targetSetNumber?: number | null;
  onClose: () => void;
  onApplyWeight?: (weightKg: number) => void;
}

export function PlateCalculatorSheet({
  isOpen,
  initialWeightKg,
  targetSetNumber,
  onClose,
  onApplyWeight,
}: PlateCalculatorSheetProps) {
  const gym = useGymSettings();
  const [targetKg, setTargetKg] = useState<number>(() =>
    Number.isFinite(initialWeightKg) && initialWeightKg > 0 ? initialWeightKg : 60,
  );
  const [barType, setBarType] = useState<BarType>(gym.barType);

  useEffect(() => {
    if (isOpen) {
      setTargetKg(Number.isFinite(initialWeightKg) && initialWeightKg > 0 ? initialWeightKg : 60);
    }
  }, [isOpen, initialWeightKg]);

  const barKg = barType === "custom" ? 0 : BAR_WEIGHTS[barType];

  const calculation = useMemo(
    () => calculatePlates(targetKg, barKg, gym.inventory),
    [targetKg, barKg, gym.inventory],
  );

  const suggestedExactKg = useMemo(
    () => nearestLoadable(targetKg, barKg, gym.inventory),
    [targetKg, barKg, gym.inventory],
  );

  const warmups = useMemo(
    () => warmupSets(calculation.totalWeight, barKg, gym.inventory),
    [barKg, calculation.totalWeight, gym.inventory],
  );

  const flatSidePlates = useMemo(() => {
    const plates: PlateKg[] = [];
    for (const item of calculation.platesPerSide) {
      for (let i = 0; i < item.count; i += 1) {
        plates.push(item.weight);
      }
    }
    return plates;
  }, [calculation.platesPerSide]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-label="Calculadora visual de discos"
      aria-modal="true"
      onClick={onClose}
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
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md space-y-4 rounded-3xl p-5 shadow-2xl"
        style={{
          backgroundColor: SURFACE.l1,
          border: `1px solid ${GLASS.borderStrong}`,
          borderRadius: RADIUS.modal,
          maxHeight: "88vh",
          overflowY: "auto",
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Disc size={18} style={{ color: ACCENT.base }} aria-hidden="true" />
            <div>
              <h3 className="text-base font-bold text-white">Calculadora de Discos</h3>
              <p className="text-xs" style={{ color: TEXT.secondary }}>
                {targetSetNumber
                  ? `Carga visual para Serie #${targetSetNumber}`
                  : "Discos necesarios por cada lado de la barra"}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Cerrar calculadora de discos"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full"
            style={{ backgroundColor: SURFACE.sunken, color: TEXT.secondary, border: `1px solid ${GLASS.border}` }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Target weight stepper */}
        <div
          className="flex items-center justify-between gap-2 rounded-2xl p-3"
          style={{ backgroundColor: SURFACE.sunken, border: `1px solid ${GLASS.border}` }}
        >
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setTargetKg((w) => Math.max(0, Math.round((w - 5) * 4) / 4))}
              className="h-9 rounded-xl px-2.5 font-mono text-xs font-bold text-white"
              style={{ backgroundColor: SURFACE.l1, border: `1px solid ${GLASS.border}` }}
            >
              -5
            </button>
            <button
              type="button"
              aria-label="Restar 2.5 kg"
              onClick={() => setTargetKg((w) => Math.max(0, Math.round((w - 2.5) * 4) / 4))}
              className="inline-flex h-9 items-center gap-0.5 rounded-xl px-2.5 font-mono text-xs font-bold text-white"
              style={{ backgroundColor: SURFACE.l1, border: `1px solid ${GLASS.border}` }}
            >
              <Minus size={11} />
              2.5
            </button>
          </div>

          <div className="flex items-baseline gap-1">
            <input
              type="number"
              step="0.5"
              min="0"
              max="500"
              inputMode="decimal"
              aria-label="Peso total objetivo en kg"
              value={targetKg}
              onChange={(e) => {
                const parsed = Number(e.target.value);
                setTargetKg(Number.isFinite(parsed) && parsed >= 0 ? parsed : 0);
              }}
              className="w-20 bg-transparent text-center font-mono text-2xl font-extrabold text-white outline-none"
            />
            <span className="font-mono text-xs font-semibold" style={{ color: TEXT.secondary }}>
              kg
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Sumar 2.5 kg"
              onClick={() => setTargetKg((w) => Math.min(500, Math.round((w + 2.5) * 4) / 4))}
              className="inline-flex h-9 items-center gap-0.5 rounded-xl px-2.5 font-mono text-xs font-bold text-white"
              style={{ backgroundColor: SURFACE.l1, border: `1px solid ${GLASS.border}` }}
            >
              <Plus size={11} />
              2.5
            </button>
            <button
              type="button"
              onClick={() => setTargetKg((w) => Math.min(500, Math.round((w + 5) * 4) / 4))}
              className="h-9 rounded-xl px-2.5 font-mono text-xs font-bold text-white"
              style={{ backgroundColor: SURFACE.l1, border: `1px solid ${GLASS.border}` }}
            >
              +5
            </button>
          </div>
        </div>

        {/* Presets */}
        <div className="flex flex-wrap gap-1.5">
          {QUICK_PRESETS.map((kg) => (
            <button
              key={kg}
              type="button"
              onClick={() => setTargetKg(kg)}
              className="h-8 rounded-full px-3 font-mono text-xs font-bold"
              style={{
                backgroundColor: targetKg === kg ? ACCENT.base : SURFACE.sunken,
                border: `1px solid ${targetKg === kg ? ACCENT.base : GLASS.border}`,
                color: TEXT.primary,
              }}
            >
              {kg} kg
            </button>
          ))}
        </div>

        {/* Bar selector */}
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Tipo de barra">
          {BAR_OPTIONS.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setBarType(b.id)}
              className="h-8 rounded-xl px-2.5 text-[11px] font-semibold"
              style={{
                backgroundColor: barType === b.id ? ACCENT.subtle : SURFACE.sunken,
                border: `1px solid ${barType === b.id ? ACCENT.border : GLASS.border}`,
                color: barType === b.id ? ACCENT.text : TEXT.secondary,
              }}
            >
              {b.label}
            </button>
          ))}
        </div>

        {/* Visual Barbell Graphic */}
        <div
          className="flex flex-col items-center justify-center rounded-2xl px-3 py-5"
          style={{ backgroundColor: SURFACE.base, border: `1px solid ${GLASS.border}` }}
          aria-label="Diagrama visual de discos en barra"
        >
          <div className="flex w-full items-center justify-center">
            {/* Left plates (mirrored) */}
            <div className="flex items-center justify-end gap-0.5">
              {[...flatSidePlates].reverse().map((plate, idx) => {
                const st = plateVisualStyle(plate);
                return (
                  <div
                    key={`l-${plate}-${idx}`}
                    title={`${plate} kg`}
                    style={{
                      height: st.height,
                      width: st.width,
                      backgroundColor: st.color,
                      color: st.textColor,
                      borderRadius: 4,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 8,
                      fontWeight: 800,
                      writingMode: "vertical-rl",
                    }}
                  >
                    {plate}
                  </div>
                );
              })}
            </div>

            {/* Center Barbell Shaft */}
            <div
              className="mx-1 flex h-3 min-w-[76px] items-center justify-center rounded-full font-mono text-[9px] font-bold"
              style={{ backgroundColor: "#A1A1AA", color: "#000000" }}
            >
              {barKg > 0 ? `${barKg}kg` : "0kg"}
            </div>

            {/* Right plates */}
            <div className="flex items-center justify-start gap-0.5">
              {flatSidePlates.map((plate, idx) => {
                const st = plateVisualStyle(plate);
                return (
                  <div
                    key={`r-${plate}-${idx}`}
                    title={`${plate} kg`}
                    style={{
                      height: st.height,
                      width: st.width,
                      backgroundColor: st.color,
                      color: st.textColor,
                      borderRadius: 4,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 8,
                      fontWeight: 800,
                      writingMode: "vertical-rl",
                    }}
                  >
                    {plate}
                  </div>
                );
              })}
            </div>
          </div>

          <p className="mt-4 text-center font-mono text-sm font-bold text-white">
            {calculation.platesPerSide.length > 0
              ? `Por lado: ${calculation.platesPerSide
                  .map((p) => `${p.count} × ${p.weight} kg`)
                  .join(" + ")}`
              : "Solo barra vacía (sin discos extra)"}
          </p>
          <p className="mt-1 text-center text-xs" style={{ color: TEXT.secondary }}>
            Total cargado: <strong className="text-white">{calculation.totalWeight} kg</strong>
            {!calculation.isExact && suggestedExactKg !== calculation.totalWeight
              ? ` · Más cercano disponible: ${suggestedExactKg} kg`
              : ""}
          </p>
        </div>

        {/* Warmup ramp */}
        {warmups.length > 0 && (
          <div
            className="rounded-2xl p-3"
            style={{ backgroundColor: SURFACE.sunken, border: `1px solid ${GLASS.border}` }}
          >
            <p className="text-[11px] font-semibold" style={{ color: TEXT.secondary }}>
              Rampa de calentamiento sugerida (40% · 60% · 80%)
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {warmups.map((kg) => (
                <button
                  key={kg}
                  type="button"
                  onClick={() => setTargetKg(kg)}
                  className="rounded-lg px-2.5 py-1 font-mono text-xs font-bold"
                  style={{
                    backgroundColor: STATUS.success.muted,
                    color: STATUS.success.text,
                  }}
                >
                  {kg} kg
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          {onApplyWeight && (
            <button
              type="button"
              onClick={() => {
                onApplyWeight(calculation.totalWeight);
                onClose();
              }}
              className="h-11 flex-1 rounded-2xl text-sm font-bold text-white"
              style={{ backgroundColor: ACCENT.base }}
            >
              Aplicar {calculation.totalWeight} kg a la serie
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-2xl px-4 text-xs font-semibold text-neutral-300"
            style={{ backgroundColor: SURFACE.sunken, border: `1px solid ${GLASS.border}` }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Body from "react-muscle-highlighter";
import type { ExtendedBodyPart, Slug } from "react-muscle-highlighter";
import { X } from "lucide-react";
import { ACCENT, DIAGRAM, GLASS, RADIUS, SURFACE, TEXT } from "@/design/tokens";
import { MUSCLE_DEFINITIONS } from "@/lib/muscleMap";

interface AnatomicalMusclePickerSheetProps {
  isOpen: boolean;
  selected: Slug[];
  counts: ReadonlyMap<Slug, number>;
  totalMatchingExercises: number;
  onChange: (next: Slug[]) => void;
  onClear: () => void;
  onClose: () => void;
}

const MUSCLE_PILLS: ReadonlyArray<{
  slug: Slug;
  label: string;
  side: "front" | "back";
}> = [
  { slug: "chest", label: "Pecho", side: "front" },
  { slug: "upper-back", label: "Espalda", side: "back" },
  { slug: "deltoids", label: "Hombros", side: "front" },
  { slug: "biceps", label: "Bíceps", side: "front" },
  { slug: "triceps", label: "Tríceps", side: "back" },
  { slug: "forearm", label: "Antebrazos", side: "front" },
  { slug: "abs", label: "Abdomen", side: "front" },
  { slug: "quadriceps", label: "Cuádriceps", side: "front" },
  { slug: "hamstring", label: "Isquiotibiales", side: "back" },
  { slug: "gluteal", label: "Glúteos", side: "back" },
  { slug: "calves", label: "Pantorrillas", side: "back" },
];

export function AnatomicalMusclePickerSheet({
  isOpen,
  selected,
  counts,
  totalMatchingExercises,
  onChange,
  onClear,
  onClose,
}: AnatomicalMusclePickerSheetProps) {
  const [side, setSide] = useState<"front" | "back">("front");

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const bodyData = useMemo<ExtendedBodyPart[]>(() => {
    return MUSCLE_DEFINITIONS.filter((def) => selectedSet.has(def.slug)).map((def) => ({
      slug: def.slug,
      intensity: 2,
      styles: {
        fill: ACCENT.base,
        stroke: "#FF6961",
      },
    }));
  }, [selectedSet]);

  if (!isOpen) return null;

  const toggleSlug = (slug: Slug) => {
    if (selectedSet.has(slug)) {
      onChange(selected.filter((s) => s !== slug));
    } else {
      onChange([...selected, slug]);
    }
  };

  const sheet = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Selector anatómico de músculos"
      className="fixed inset-0 z-[1200] flex items-end justify-center bg-black/80 sm:items-center sm:p-4"
    >
      <div
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-white/10 sm:rounded-3xl"
        style={{ backgroundColor: SURFACE.l1 }}
      >
        {/* Top bar + iOS Segmented Control */}
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div
            role="tablist"
            aria-label="Vista anatómica"
            className="grid grid-cols-2 gap-1 rounded-xl p-1"
            style={{ backgroundColor: "#09090B", border: `1px solid ${GLASS.border}` }}
          >
            {(
              [
                { id: "front", label: "Frontal" },
                { id: "back", label: "Posterior" },
              ] as const
            ).map((opt) => {
              const active = side === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSide(opt.id)}
                  className="h-9 rounded-lg px-4 text-xs font-semibold transition-colors"
                  style={{
                    backgroundColor: active ? "#2C2C2E" : "transparent",
                    color: active ? "#FFFFFF" : TEXT.secondary,
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar selector anatómico"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#2C2C2E] text-zinc-300 active:scale-95"
          >
            <X size={18} />
          </button>
        </div>

        {/* Full-body SVG Map (zero clipping) + Apple Pill Grid */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <div className="min-h-[320px] flex items-center justify-center overflow-visible">
            <Body
              data={bodyData}
              side={side}
              gender="male"
              scale={1.15}
              defaultFill={DIAGRAM.regionFill}
              defaultStroke={DIAGRAM.regionStroke}
              border="none"
              onBodyPartPress={(part) => {
                if (part?.slug) toggleSlug(part.slug);
              }}
            />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {MUSCLE_PILLS.map((item) => {
              const active = selectedSet.has(item.slug);
              const count = counts.get(item.slug) ?? 0;
              return (
                <button
                  key={item.slug}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setSide(item.side);
                    toggleSlug(item.slug);
                  }}
                  className="flex h-11 items-center justify-between rounded-xl border px-3 text-xs font-semibold active:scale-[0.98] transition-transform duration-150"
                  style={{
                    borderColor: active ? ACCENT.base : "rgba(255,255,255,0.10)",
                    backgroundColor: active ? "rgba(255,59,48,0.18)" : "#2C2C2E",
                    color: active ? "#FFFFFF" : TEXT.secondary,
                  }}
                >
                  <span className="truncate">{item.label}</span>
                  <span
                    className="ml-1.5 font-mono text-[11px] tabular-nums"
                    style={{ color: active ? "#FFFFFF" : TEXT.tertiary }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Fixed Thumb-Zone Action Bar */}
        <div
          className="flex items-center gap-3 border-t border-white/10 px-4 py-3"
          style={{ backgroundColor: "#1C1C1E", borderRadius: `0 0 ${RADIUS.modal} ${RADIUS.modal}` }}
        >
          <button
            type="button"
            onClick={onClear}
            className="h-12 rounded-xl border border-white/10 bg-[#2C2C2E] px-5 text-sm font-semibold text-zinc-200 active:scale-[0.98]"
          >
            Limpiar
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-12 flex-1 rounded-xl bg-[#FF3B30] px-4 text-sm font-semibold text-white active:scale-[0.98] transition-transform duration-150"
          >
            Ver <span className="font-mono tabular-nums">{totalMatchingExercises}</span> ejercicios
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(sheet, document.body) : sheet;
}

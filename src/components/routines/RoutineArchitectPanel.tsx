import { useMemo, useState } from "react";
import { Cpu, Sparkles } from "lucide-react";
import { ACCENT, TEXT } from "@/design/tokens";
import {
  ROUTINE_TEMPLATE_PRESETS,
  auditRoutineSession,
  type RoutineTemplatePreset,
} from "@/engines/routineArchitectEngine";
import { useExerciseCatalog } from "@/hooks/useExerciseCatalog";

interface RoutineArchitectPanelProps {
  onApplyTemplate?: (preset: RoutineTemplatePreset) => void;
}

export function RoutineArchitectPanel({ onApplyTemplate }: RoutineArchitectPanelProps) {
  const { exercises: catalog } = useExerciseCatalog();
  const [selectedPreset, setSelectedPreset] = useState<RoutineTemplatePreset>(
    ROUTINE_TEMPLATE_PRESETS[0],
  );

  const catalogMap = useMemo(
    () => new Map(catalog.map((ex) => [ex.id, ex])),
    [catalog],
  );

  const previewAudit = useMemo(() => {
    const sampleKeywords = selectedPreset.keywordsByDay[0] ?? [];
    const matchedItems = sampleKeywords
      .map((kw) =>
        catalog.find((ex) =>
          (ex.name_es ?? ex.name).toLowerCase().includes(kw),
        ),
      )
      .filter((ex): ex is NonNullable<typeof ex> => Boolean(ex))
      .map((ex) => ({ exerciseId: ex.id, sets: 3, restSeconds: 90 }));

    return auditRoutineSession(matchedItems, catalogMap);
  }, [selectedPreset, catalog, catalogMap]);

  return (
    <section className="rounded-2xl border border-white/10 bg-[#1C1C1E] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles size={16} color={ACCENT.base} aria-hidden="true" />
          <h2 className="text-sm font-bold text-white">
            Arquitecto Biomecánico · Plantillas 1-Toque
          </h2>
        </div>
        <span className="inline-flex items-center gap-1.5 font-mono text-xs tabular-nums text-zinc-400">
          <Cpu size={13} aria-hidden="true" />
          {catalog.length} ejercicios activos
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ROUTINE_TEMPLATE_PRESETS.map((preset) => {
          const active = selectedPreset.id === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                setSelectedPreset(preset);
                onApplyTemplate?.(preset);
              }}
              className="flex min-h-12 flex-col items-start justify-center rounded-xl border px-3 py-2 text-left active:scale-[0.98] transition-transform duration-150"
              style={{
                borderColor: active ? ACCENT.base : "rgba(255,255,255,0.10)",
                backgroundColor: active ? "rgba(255,59,48,0.14)" : "#09090B",
              }}
            >
              <span className="text-xs font-bold text-white">{preset.title}</span>
              <span className="mt-0.5 text-[11px]" style={{ color: TEXT.secondary }}>
                {preset.subtitle}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3 text-xs">
        <span style={{ color: TEXT.secondary }}>
          Auditor Día 1 ({selectedPreset.dayLabels[0]}):{" "}
          <strong className="font-mono tabular-nums text-white">
            {previewAudit.totalSets} series · ~{previewAudit.estimatedMinutes} min
          </strong>
        </span>
        <span className="font-mono text-xs tabular-nums" style={{ color: ACCENT.text }}>
          {previewAudit.junkVolumeWarnings.length === 0
            ? "Volumen efectivo óptimo (MEV/MAV)"
            : previewAudit.junkVolumeWarnings[0]}
        </span>
      </div>
    </section>
  );
}

import { useMemo, useState } from "react";
import { Cpu, Plus, Sparkles } from "lucide-react";
import { ACCENT, TEXT } from "@/design/tokens";
import {
  ROUTINE_TEMPLATE_PRESETS,
  auditRoutineSession,
  type RoutineTemplatePreset,
} from "@/engines/routineArchitectEngine";
import { useExerciseCatalog } from "@/hooks/useExerciseCatalog";
import type { DayZeroFrequency, DayZeroPlan, DayZeroPlanDay } from "@/lib/routines/dayZeroPlan";
import type { CatalogExercise } from "@/lib/catalog/types";
import type { Exercise } from "@/types/supabase";

interface RoutineArchitectPanelProps {
  onCreatePlan: (plan: DayZeroPlan) => void | Promise<void>;
}

function matchPresetDayExercises(
  keywords: readonly string[],
  catalog: readonly Exercise[],
): Exercise[] {
  const picked: Exercise[] = [];
  const usedIds = new Set<string>();
  for (const kw of keywords) {
    const found = catalog.find((ex) => {
      if (usedIds.has(ex.id) || ex.is_hidden || !ex.is_active) return false;
      return (ex.name_es ?? ex.name).toLowerCase().includes(kw);
    });
    if (found) {
      usedIds.add(found.id);
      picked.push(found);
    }
  }
  return picked;
}

export function RoutineArchitectPanel({ onCreatePlan }: RoutineArchitectPanelProps) {
  const { exercises: catalog } = useExerciseCatalog();
  const [selectedPreset, setSelectedPreset] = useState<RoutineTemplatePreset>(
    ROUTINE_TEMPLATE_PRESETS[0],
  );
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  const [saving, setSaving] = useState(false);

  const catalogMap = useMemo(
    () => new Map(catalog.map((ex) => [ex.id, ex])),
    [catalog],
  );

  const resolvedDays = useMemo(() => {
    return selectedPreset.dayLabels.map((label, idx) => {
      const keywords = selectedPreset.keywordsByDay[idx] ?? [];
      const exercises = matchPresetDayExercises(keywords, catalog);
      return { label, exercises };
    });
  }, [selectedPreset, catalog]);

  const activeDay = resolvedDays[selectedDayIdx] ?? resolvedDays[0];

  const dayAudit = useMemo(() => {
    const items = (activeDay?.exercises ?? []).map((ex) => ({
      exerciseId: ex.id,
      sets: 3,
      restSeconds: 90,
    }));
    return auditRoutineSession(items, catalogMap);
  }, [activeDay, catalogMap]);

  const toPlanDay = (label: string, idx: number, exercises: Exercise[]): DayZeroPlanDay => ({
    id: `arch-day-${idx + 1}`,
    label,
    exercises: exercises.map((ex) => ({
      row: ex as unknown as CatalogExercise,
      rowId: ex.id,
      sets: 3,
      reps: 10,
      weightKg: 20,
    })),
  });

  const handleSaveSingleDay = async () => {
    if (!activeDay || activeDay.exercises.length === 0 || saving) return;
    setSaving(true);
    try {
      await onCreatePlan({
        title: `${selectedPreset.title} · ${activeDay.label}`,
        frequency: 2,
        goal: "hypertrophy",
        level: "intermediate",
        days: [toPlanDay(activeDay.label, selectedDayIdx, activeDay.exercises)],
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveFullPlan = async () => {
    const validDays = resolvedDays
      .map((d, idx) => toPlanDay(d.label, idx, d.exercises))
      .filter((d) => d.exercises.length > 0);
    if (validDays.length === 0 || saving) return;
    const freq = Math.min(6, Math.max(2, validDays.length)) as DayZeroFrequency;
    setSaving(true);
    try {
      await onCreatePlan({
        title: selectedPreset.title,
        frequency: freq,
        goal: "hypertrophy",
        level: "intermediate",
        days: validDays,
      });
    } finally {
      setSaving(false);
    }
  };

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

      {/* Template selector */}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ROUTINE_TEMPLATE_PRESETS.map((preset) => {
          const active = selectedPreset.id === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                setSelectedPreset(preset);
                setSelectedDayIdx(0);
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

      {/* Day selector */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Días de la plantilla">
        {resolvedDays.map((day, idx) => {
          const active = idx === selectedDayIdx;
          return (
            <button
              key={day.label}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSelectedDayIdx(idx)}
              className="h-9 rounded-xl border px-3 text-xs font-semibold active:scale-[0.98]"
              style={{
                borderColor: active ? ACCENT.base : "rgba(255,255,255,0.10)",
                backgroundColor: active ? "#2C2C2E" : "#09090B",
                color: active ? "#FFFFFF" : TEXT.secondary,
              }}
            >
              Día {idx + 1} · {day.label}
            </button>
          );
        })}
      </div>

      {/* Real exercises preview list */}
      {activeDay && (
        <div className="mt-3 divide-y divide-white/10 rounded-xl border border-white/10 bg-[#09090B] px-3">
          {activeDay.exercises.map((ex, i) => (
            <div key={ex.id} className="flex items-center justify-between gap-2 py-2.5 text-xs">
              <div className="min-w-0">
                <span className="font-mono text-zinc-500">{i + 1}. </span>
                <span className="font-semibold text-white">{ex.name_es ?? ex.name}</span>
              </div>
              <span className="shrink-0 font-mono tabular-nums text-zinc-400">
                3 × 8–12 reps
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Auditor summary */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span style={{ color: TEXT.secondary }}>
          Auditor ({activeDay?.label}):{" "}
          <strong className="font-mono tabular-nums text-white">
            {dayAudit.totalSets} series · ~{dayAudit.estimatedMinutes} min
          </strong>
        </span>
        <span className="font-mono text-xs tabular-nums" style={{ color: ACCENT.text }}>
          {dayAudit.junkVolumeWarnings.length === 0
            ? "Volumen efectivo óptimo (MEV/MAV)"
            : dayAudit.junkVolumeWarnings[0]}
        </span>
      </div>

      {/* Real Save CTAs */}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={saving || !activeDay || activeDay.exercises.length === 0}
          onClick={() => void handleSaveSingleDay()}
          className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#FF3B30] px-4 text-sm font-semibold text-white active:scale-[0.98] transition-transform duration-150 disabled:opacity-50"
        >
          <Plus size={16} aria-hidden="true" />
          <span>{saving ? "Guardando…" : "Crear rutina en mi plan"}</span>
        </button>

        {resolvedDays.length > 1 && (
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSaveFullPlan()}
            className="inline-flex h-12 items-center justify-center rounded-xl border border-white/10 bg-[#2C2C2E] px-4 text-xs font-semibold text-white active:scale-[0.98] disabled:opacity-50"
          >
            Crear plan completo ({resolvedDays.length} días)
          </button>
        )}
      </div>
    </section>
  );
}

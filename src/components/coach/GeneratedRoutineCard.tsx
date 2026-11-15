/**
 * GeneratedRoutineCard.tsx — Apple Fitness+ / Symmetry-style interactive routine
 * card rendered inside `Cronos Intelligence` chat messages.
 *
 * Features:
 *  - Editable routine title + summary metrics (exercises, sets, ~duration)
 *  - Mini `MuscleReadonlyMap` highlighting targeted muscle groups
 *  - Live GIF exercise rows (`bg-white rounded-xl`) with `Cambiar` swap button
 *  - Direct `Guardar en Mis Rutinas` and `Entrenar ahora` actions
 */

import { useState, type ComponentProps } from "react";
import { Check, Dumbbell, Play, RefreshCw, Save, Sparkles } from "lucide-react";
import { MuscleReadonlyMap } from "@/components/MuscleReadonlyMap";
import {
  ACCENT,
  GLASS,
  NUMERIC,
  SOLID,
  STATUS,
  SURFACE,
  TEXT,
  TYPE,
} from "@/design/tokens";
import type { GuidedRoutineResult } from "@/lib/ai/cronosIntelligence";

interface GeneratedRoutineCardProps {
  routine: GuidedRoutineResult;
  onRename?: (nextName: string) => void;
  onSwapExercise?: (index: number) => void;
  onSaveToRoutines: (routine: GuidedRoutineResult) => Promise<void> | void;
  onStartNow: (routine: GuidedRoutineResult) => void;
  onGoToRoutines?: () => void;
}

export function GeneratedRoutineCard({
  routine,
  onRename,
  onSwapExercise,
  onSaveToRoutines,
  onStartNow,
  onGoToRoutines,
}: GeneratedRoutineCardProps) {
  const [title, setTitle] = useState(routine.name);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const totalSets = routine.exercises.reduce((sum, ex) => sum + ex.sets, 0);

  const handleSave = async () => {
    if (saving || saved) return;
    setSaving(true);
    try {
      await onSaveToRoutines({ ...routine, name: title.trim() || routine.name });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="rounded-3xl p-4 space-y-3.5"
      style={{
        backgroundColor: SOLID.card,
        border: `1px solid ${GLASS.borderStrong}`,
      }}
    >
      {/* Header: Badge + Editable Title + Mini Muscle Map */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
            style={{ backgroundColor: ACCENT.subtle, color: ACCENT.text }}
          >
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            <span>RUTINA DISEÑADA POR CRONOS IA</span>
          </div>

          <input
            type="text"
            value={title}
            aria-label="Nombre de la rutina"
            onChange={(e) => {
              setTitle(e.target.value);
              onRename?.(e.target.value);
            }}
            className="w-full bg-transparent text-base font-bold tracking-tight outline-none"
            style={{ color: TEXT.primary }}
          />

          <p
            className="text-xs"
            style={{
              color: TEXT.secondary,
              fontFamily: TYPE.mono.font,
              fontVariantNumeric: NUMERIC.align,
            }}
          >
            {routine.exercises.length} ejercicios · {totalSets} series · ~{routine.durationMin} min
          </p>

          {routine.jointNotes.length > 0 ? (
            <p className="text-[11px]" style={{ color: STATUS.warning.text }}>
              Adaptada por cuidado articular: {routine.jointNotes.join(", ")}
            </p>
          ) : null}
        </div>

        <div className="w-16 shrink-0 rounded-2xl p-1" style={{ backgroundColor: SURFACE.base }}>
          <MuscleReadonlyMap
            counts={
              new Map(Object.entries(routine.muscleCounts)) as ComponentProps<
                typeof MuscleReadonlyMap
              >["counts"]
            }
            side="front"
            label={`Músculos trabajados en ${title}`}
          />
        </div>
      </div>

      {/* Exercise List with Live GIFs */}
      <ul className="space-y-2">
        {routine.exercises.map((ex, idx) => {
          const gifSrc = ex.gifUrl
            ? ex.gifUrl.startsWith("http") || ex.gifUrl.startsWith("/")
              ? ex.gifUrl
              : `/${ex.gifUrl}`
            : null;
          return (
            <li
              key={`${ex.exerciseId}-${idx}`}
              className="flex items-center gap-2.5 p-2 rounded-2xl"
              style={{
                backgroundColor: SURFACE.base,
                border: `1px solid ${GLASS.border}`,
              }}
            >
              <div className="w-12 h-12 shrink-0 rounded-xl bg-white overflow-hidden flex items-center justify-center">
                {gifSrc ? (
                  <img
                    src={gifSrc}
                    alt={ex.name}
                    loading="lazy"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <Dumbbell className="h-5 w-5 text-zinc-700" aria-hidden="true" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold truncate" style={{ color: TEXT.primary }}>
                  {ex.name}
                </p>
                <p className="text-[11px] truncate" style={{ color: TEXT.tertiary }}>
                  {ex.equipmentName}
                </p>
                <p
                  className="text-[11px] mt-0.5"
                  style={{
                    color: ACCENT.text,
                    fontFamily: TYPE.mono.font,
                    fontVariantNumeric: NUMERIC.align,
                  }}
                >
                  {ex.sets} × {ex.repsMin}-{ex.repsMax} reps · {ex.restSeconds}s
                </p>
              </div>

              {onSwapExercise ? (
                <button
                  type="button"
                  onClick={() => onSwapExercise(idx)}
                  aria-label={`Cambiar ${ex.name}`}
                  className="h-8 px-2.5 rounded-full inline-flex items-center gap-1 text-[11px] font-medium shrink-0"
                  style={{
                    backgroundColor: GLASS.fillRaised,
                    color: TEXT.secondary,
                    border: `1px solid ${GLASS.border}`,
                  }}
                >
                  <RefreshCw className="h-3 w-3" aria-hidden="true" />
                  <span>Cambiar</span>
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>

      {/* Footer Actions */}
      <div className="flex flex-col sm:flex-row gap-2 pt-1">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="flex-1 h-10 px-4 rounded-full inline-flex items-center justify-center gap-1.5 text-xs font-semibold"
          style={{
            backgroundColor: saved ? STATUS.success.muted : GLASS.fillRaised,
            color: saved ? STATUS.success.text : TEXT.primary,
            border: `1px solid ${saved ? STATUS.success.border : GLASS.borderStrong}`,
          }}
        >
          {saved ? (
            <>
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Guardada en Mis Rutinas</span>
            </>
          ) : (
            <>
              <Save className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{saving ? "Guardando..." : "Guardar en Mis Rutinas"}</span>
            </>
          )}
        </button>

        {saved && onGoToRoutines ? (
          <button
            type="button"
            onClick={onGoToRoutines}
            className="h-10 px-4 rounded-full inline-flex items-center justify-center text-xs font-semibold"
            style={{
              backgroundColor: GLASS.fillRaised,
              color: ACCENT.text,
              border: `1px solid ${ACCENT.border}`,
            }}
          >
            Ir a /rutinas
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => onStartNow({ ...routine, name: title.trim() || routine.name })}
          className="flex-1 h-10 px-4 rounded-full inline-flex items-center justify-center gap-1.5 text-xs font-semibold"
          style={{
            backgroundColor: ACCENT.base,
            color: TEXT.onAccent,
          }}
        >
          <Play className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Entrenar ahora</span>
        </button>
      </div>
    </div>
  );
}

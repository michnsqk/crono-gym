/**
 * RoutineEditor.tsx — armador de rutinas (Apple HIG iOS 18)
 *
 * - `single`: rutina individual, un solo día
 * - `weekly`: estudio semanal con navegación horizontal de días
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, Moon, ChevronLeft, ChevronRight, Dumbbell, Flame } from "lucide-react";
import { useOutletContext } from "react-router-dom";
import type { WorkspaceOutletContext } from "@/App";
import type { RoutineWithExercises } from "@/hooks/useGymData";
import type { Exercise } from "@/types/supabase";
import type { RoutineDraftV2, RoutineDay, DraftExercise } from "@/lib/routines/routineDayModel";
import { draftFromRoutine, validateDraft, normalizeDays } from "@/lib/routines/routineDayModel";
import { saveRoutine, flushSave, subscribeSave, type SaveResult } from "@/lib/routines/saveRoutine";
import {
  estimateMinutes,
  getExerciseName,
  getRepLabel,
} from "@/lib/routines/routineDraftModel";
import { countMuscleSets } from "@/components/MuscleReadonlyMap";
import { UnifiedExerciseSelectorSheet, type SelectorTab } from "@/components/UnifiedExerciseSelectorSheet";
import { MuscleReadonlyMap } from "@/components/MuscleReadonlyMap";
import type { Slug } from "react-muscle-highlighter";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { hapticLight, hapticSuccess } from "@/lib/haptics";
import { translateBodyPart } from "@/lib/i18n";
import { loadCatalog } from "@/lib/catalog/catalogLoader";
import { resolveMediaUrl } from "@/lib/media/mediaResolver";
import { ACCENT, GLASS, MOTION, SOLID, SURFACE, TEXT } from "@/design/tokens";

const WEEKDAYS_SHORT = ["L", "M", "X", "J", "V", "S", "D"];
const WEEKDAYS_FULL = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

const QUICK_CHIPS_SINGLE = ["Push", "Pull", "Pierna", "Torso", "Full Body", "Espalda & Bíceps"] as const;
const QUICK_CHIPS_WEEKLY = ["Espalda & Bíceps", "Pecho & Tríceps", "Pierna Completa", "Hombro & Brazo", "Torso", "Glúteo & Femoral"] as const;

function emptyDay(order: number, weekday: number | null, kind: RoutineDay["kind"]): RoutineDay {
  return {
    id: crypto.randomUUID(),
    order,
    weekday,
    label: "",
    kind,
    exercises: [],
  };
}

function dayTotalSets(day: RoutineDay): number {
  return (day.exercises ?? []).reduce((sum, ex) => sum + ex.target_sets, 0);
}

function dayRestSeconds(day: RoutineDay): number {
  return (day.exercises ?? []).reduce((sum, ex) => sum + ex.rest_seconds, 0);
}

function dayMuscleCounts(day: RoutineDay): Map<Slug, number> {
  return countMuscleSets(
    (day.exercises ?? []).map((ex) => ({
      exercise: ex.exercise as { target: string; body_part: string },
      target_sets: ex.target_sets,
    })),
  );
}

type EditorMode = "single" | "weekly";

interface RoutineEditorProps {
  routine?: RoutineWithExercises | null;
  onSave?: (result: SaveResult) => void;
  onClose: () => void;
}

/**
 * DualMiniMuscleMap — Cápsula contenedora con dos mapas anatómicos escalados
 * FRONTAL (anterior) y POSTERIOR (espalda) en un contenedor de hasta 358x152px.
 */
export function DualMiniMuscleMap({ counts }: { counts: Map<Slug, number> }) {
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        maxWidth: 358,
        height: 152,
        flexShrink: 0,
        borderRadius: "20px",
        background: "#1C1C1E",
        border: "1px solid rgba(255, 255, 255, 0.06)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 44,
        padding: "10px 16px",
      }}
    >
      {/* Mapa Anterior (FRONTAL) */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
        }}
      >
        <div
          style={{
            width: 68,
            height: 112,
            position: "relative",
            overflow: "visible",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 150,
              height: 290,
              transform: "scale(0.38)",
              transformOrigin: "center center",
              pointerEvents: "none",
            }}
          >
            <MuscleReadonlyMap
              counts={counts}
              side="front"
              aspectRatio={150 / 290}
              label="Vista frontal"
              backgroundColor="transparent"
              caption={null}
              overflow="visible"
              inertFill="rgba(255,255,255,0.06)"
              litFill="#FF3B30"
              mostLitFill="rgba(255,59,48,0.35)"
            />
          </div>
        </div>
        <span
          style={{
            fontSize: "10px",
            fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "rgba(235, 235, 245, 0.30)",
          }}
        >
          FRONTAL
        </span>
      </div>

      {/* Mapa Posterior (POSTERIOR) */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
        }}
      >
        <div
          style={{
            width: 68,
            height: 112,
            position: "relative",
            overflow: "visible",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 150,
              height: 290,
              transform: "scale(0.38)",
              transformOrigin: "center center",
              pointerEvents: "none",
            }}
          >
            <MuscleReadonlyMap
              counts={counts}
              side="back"
              aspectRatio={150 / 290}
              label="Vista posterior"
              backgroundColor="transparent"
              caption={null}
              overflow="visible"
              inertFill="rgba(255,255,255,0.06)"
              litFill="#FF3B30"
              mostLitFill="rgba(255,59,48,0.35)"
            />
          </div>
        </div>
        <span
          style={{
            fontSize: "10px",
            fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "rgba(235, 235, 245, 0.30)",
          }}
        >
          POSTERIOR
        </span>
      </div>
    </div>
  );
}

export function RoutineEditor({ routine, onSave, onClose }: RoutineEditorProps) {
  const { userId } = useOutletContext<WorkspaceOutletContext>();
  const reducedMotion = useReducedMotion();

  const [mode, setMode] = useState<EditorMode>("single");
  const [title, setTitle] = useState(routine?.title ?? "");
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectorInitialTab, setSelectorInitialTab] = useState<SelectorTab>("all");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "dirty" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  const [days, setDays] = useState<RoutineDay[]>(() => {
    if (routine) {
      const draft = draftFromRoutine(routine as unknown as never);
      const draftDays = Array.isArray(draft.days) ? draft.days : [];
      if (draft.mode === "weekly" || draftDays.length === 7) {
        return Array.from({ length: 7 }, (_, i) => {
          const day = draftDays[i] ?? draftDays.find((d) => d.weekday === i);
          return day && Array.isArray(day.exercises)
            ? { ...day, exercises: [...day.exercises] }
            : emptyDay(i, i, "training");
        });
      }
      return draftDays.length > 0
        ? draftDays.map((d) => ({ ...d, exercises: Array.isArray(d.exercises) ? [...d.exercises] : [] }))
        : [emptyDay(0, null, "training")];
    }
    return mode === "weekly"
      ? WEEKDAYS_SHORT.map((_, i) => emptyDay(i, i, "empty"))
      : [emptyDay(0, null, "training")];
  });

  // Load catalog and build exercise media map for GIF rendering
  const [exerciseMediaMap, setExerciseMediaMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let cancelled = false;
    loadCatalog().then((catalog) => {
      if (cancelled) return;
      const map = new Map<string, string>();
      for (const ex of catalog) {
        const gifUrl = resolveMediaUrl(ex.gif_url) || resolveMediaUrl(ex.image);
        if (gifUrl) {
          map.set(ex.id, gifUrl);
          // Also index by normalized name as fallback
          const nameKey = ex.name.trim().toLowerCase().replace(/\s+/g, " ");
          if (!map.has(nameKey)) map.set(nameKey, gifUrl);
        }
      }
      setExerciseMediaMap(map);
    }).catch(() => {
      // Ignore errors, catalog is optional for GIF rendering
    });
    return () => { cancelled = true; };
  }, []);

  const safeDays = useMemo<RoutineDay[]>(() => {
    if (mode === "weekly") {
      return Array.from({ length: 7 }, (_, i) => {
        const day = days[i];
        if (day && Array.isArray(day.exercises)) {
          return { ...day, weekday: i, exercises: day.exercises };
        }
        return emptyDay(i, i, "empty");
      });
    }
    return days.length > 0
      ? days.map((d) => ({ ...d, exercises: Array.isArray(d?.exercises) ? d.exercises : [] }))
      : [emptyDay(0, null, "training")];
  }, [days, mode]);

  const activeDay = safeDays[activeDayIndex] ?? safeDays[0] ?? emptyDay(0, null, "training");
  const activeDayExercises = Array.isArray(activeDay?.exercises) ? activeDay.exercises : [];

  const activeTelemetry = useMemo(() => {
    const counts = dayMuscleCounts(activeDay);
    return {
      exerciseCount: Array.isArray(activeDayExercises) ? activeDayExercises.length : 0,
      totalSets: dayTotalSets(activeDay),
      minutes: estimateMinutes(Array.isArray(activeDayExercises) ? activeDayExercises.length : 0, dayRestSeconds(activeDay)),
      counts,
    };
  }, [activeDay, activeDayExercises]);

  const hasAnyExercise = safeDays.some((d) => Array.isArray(d.exercises) && d.exercises.length > 0);
  const canSave = hasAnyExercise;

  const isWeeklyMode = mode === "weekly";

  const draftKeyRef = useRef<string>(crypto.randomUUID());

  const handleSave = useCallback(async () => {
    if (!userId) return;
    // Normalizar título: vacío → fallback por modo.
    const finalTitle = title.trim() || (mode === "weekly" ? "Plan Semanal" : "Nueva Rutina");
    // Normalizar días: garantir kind consistente con exercises.length.
    const normalizedDays = normalizeDays(safeDays);
    const draft: RoutineDraftV2 = {
      draftKey: draftKeyRef.current,
      id: routine?.id ?? null,
      title: finalTitle,
      description: "",
      mode: mode === "weekly" ? "weekly" : "single",
      days: normalizedDays.map((d) => ({ ...d, exercises: Array.isArray(d.exercises) ? d.exercises.map((e) => ({ ...e })) : [] })),
      snapshot: null,
    };
    const problems = validateDraft(draft);
    if (problems.length > 0) {
      const msg = "No se puede guardar: " + problems.join(", ");
      setSaveError(msg);
      console.warn("[RoutineEditor] handleSave validation failed", problems);
      return;
    }
    setSaveError(null);
    setSaveStatus("saving");
    try {
      const result = await saveRoutine(userId, draft, "editor");
      if (!result.ok) {
        const msg = "Error al guardar: " + result.error;
        setSaveError(msg);
        console.warn("[RoutineEditor] handleSave saveRoutine failed", result.error);
        setSaveStatus("error");
        return;
      }
      await flushSave(draft.draftKey);
      setSaveStatus("idle");
      onSave?.(result);
      hapticSuccess();
    } catch {
      const msg = "Error inesperado al guardar la rutina.";
      setSaveError(msg);
      console.warn("[RoutineEditor] handleSave threw an exception");
      setSaveStatus("error");
    }
  }, [userId, canSave, title, mode, safeDays, routine?.id, onSave]);

  useEffect(() => {
    const unsub = subscribeSave(draftKeyRef.current, setSaveStatus);
    return () => unsub();
  }, []);

  // Garantizar exactamente 7 días en modo semanal (índices 0-6, Lunes a Domingo),
  // corrigiendo los weekdays de días existentes que hereden weekday: null del modo individual.
  useEffect(() => {
    if (mode !== "weekly") return;
    let next: RoutineDay[] = days.map((d, i) => ({ ...d, weekday: i }));
    let needsFix = next.some((d, i) => d.weekday !== i);
    while (next.length < 7) {
      const i = next.length;
      next = [...next, emptyDay(i, i, "empty")];
    }
    if (needsFix || next.length !== days.length) setDays(next);
  }, [days, mode]);

  const setDayLabel = useCallback((index: number, label: string) => {
    setDays((prev) =>
      prev.map((d, i) => (i === index ? { ...d, label } : d)),
    );
  }, []);

  const toggleRestDay = useCallback(() => {
    setDays((current) =>
      current.map((d, i) =>
        i === activeDayIndex ? { ...d, kind: d.kind === "rest" ? "training" : "rest" } : d,
      ),
    );
    hapticLight();
  }, [activeDayIndex]);

  const handleDayPress = useCallback((index: number) => {
    setActiveDayIndex(index);
    hapticLight();
  }, []);

  const addExercisesToDay = useCallback((exercises: Exercise[]) => {
    // Garantizar que `days` cubra al menos hasta activeDayIndex (crítico al alternar
    // de individual a semanal: el arreglo puede venir con 1 solo elemento).
    const nextDays = [...days];
    while (nextDays.length <= activeDayIndex) {
      const i = nextDays.length;
      nextDays.push(emptyDay(i, mode === "weekly" ? i : null, "empty"));
    }
    const next = exercises.map((ex) => ({
      rowId: crypto.randomUUID(),
      exercise: ex,
      target_sets: 3,
      target_reps_min: null,
      target_reps_max: null,
      rest_seconds: 90,
      order_index: nextDays[activeDayIndex].exercises.length,
    }));
    const dayExercises = [...(Array.isArray(nextDays[activeDayIndex].exercises) ? nextDays[activeDayIndex].exercises : []), ...next];
    nextDays[activeDayIndex] = {
      ...nextDays[activeDayIndex],
      kind: "training", // un día con ejercicios es un día de entrenamiento
      exercises: dayExercises,
    };
    setDays(nextDays);
    setSelectorOpen(false);
    hapticSuccess();
  }, [activeDayIndex, days, mode]);

  const removeExerciseFromDay = useCallback((dayIndex: number, exerciseIndex: number) => {
    setDays((prev) =>
      prev.map((d, i) => {
        if (i !== dayIndex) return d;
        const exercises = Array.isArray(d.exercises) ? [...d.exercises] : [];
        exercises.splice(exerciseIndex, 1);
        const nextKind = exercises.length === 0 && d.kind === "training" ? "empty" : d.kind;
        return { ...d, kind: nextKind, exercises: exercises.map((ex, idx) => ({ ...ex, order_index: idx })) };
      }),
    );
    hapticLight();
  }, []);

  const changeSets = useCallback((dayIndex: number, exerciseIndex: number, delta: number) => {
    setDays((prev) =>
      prev.map((d, i) => {
        if (i !== dayIndex) return d;
        const exercises = Array.isArray(d.exercises) ? [...d.exercises] : [];
        const ex = exercises[exerciseIndex];
        if (!ex) return d;
        exercises[exerciseIndex] = { ...ex, target_sets: Math.max(1, ex.target_sets + delta) };
        return { ...d, exercises };
      }),
    );
    hapticLight();
  }, []);

  const changeReps = useCallback((dayIndex: number, exerciseIndex: number, delta: number) => {
    setDays((prev) =>
      prev.map((d, i) => {
        if (i !== dayIndex) return d;
        const exercises = Array.isArray(d.exercises) ? [...d.exercises] : [];
        const ex = exercises[exerciseIndex];
        if (!ex) return d;
        const currentReps = ex.target_reps_min ?? ex.target_reps_max ?? 8;
        const newReps = Math.max(1, currentReps + delta);
        exercises[exerciseIndex] = {
          ...ex,
          target_reps_min: newReps,
          target_reps_max: newReps,
        };
        return { ...d, exercises };
      }),
    );
    hapticLight();
  }, []);

  const cardStyle = {
    borderRadius: "20px",
    border: "1px solid rgba(255,255,255,0.08)",
    background: "#1C1C1E",
  } as const;

  const weeklyStrip = isWeeklyMode ? (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 16 }}>
      {WEEKDAYS_SHORT.map((short, i) => {
        const day = safeDays[i] ?? emptyDay(i, i, "training");
        const hasExercises = Array.isArray(day?.exercises) ? day.exercises.length > 0 : false;
        const isActive = i === activeDayIndex;
        return (
          <button
            key={short}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-label={`${WEEKDAYS_FULL[i]} ${hasExercises ? "con ejercicios" : day?.kind === "rest" ? "día de descanso" : "sin ejercicios"}`}
            onClick={() => handleDayPress(i)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 40,
              borderRadius: "12px",
              background: isActive ? "#FF3B30" : "transparent",
              color: isActive ? "#FFFFFF" : "#A3A3A3",
              fontSize: "11px",
              fontWeight: isActive ? 700 : 600,
              textTransform: "uppercase",
              cursor: "pointer",
              transition: reducedMotion ? "none" : "all 150ms cubic-bezier(0.4, 0, 0.2, 1)",
              border: "none",
            }}
          >
            {short}
            {hasExercises && (
              <div
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: "50%",
                  background: isActive ? "#FFFFFF" : "#FF3B30",
                  marginTop: 2,
                }}
                aria-hidden="true"
              />
            )}
            {day?.kind === "rest" && !hasExercises && (
              <Moon size={10} style={{ color: "#71717A", marginTop: 2 }} aria-hidden="true" />
            )}
          </button>
        );
      })}
    </div>
  ) : null;

  const currentChips = isWeeklyMode ? QUICK_CHIPS_WEEKLY : QUICK_CHIPS_SINGLE;
  const handleChipClick = useCallback((chip: string) => {
    hapticLight();
    if (isWeeklyMode) {
      setDayLabel(activeDayIndex, chip);
    } else {
      setTitle(chip);
    }
  }, [isWeeklyMode, activeDayIndex]);

  const heroCard = (
    <div
      style={{
        background: "#1C1C1E",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "24px",
        padding: 20,
        overflow: "hidden",
      }}
    >
      {/* Top Row: Day Badge + Title Input (full width) */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        {isWeeklyMode && (
          <span
            style={{
              fontSize: "10px",
              fontFamily: "ui-monospace, SFMono-Regular, monospace",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "#FF3B30",
            }}
          >
            {WEEKDAYS_FULL[activeDayIndex].toUpperCase()}
          </span>
        )}

        <input
          type="text"
          value={isWeeklyMode ? activeDay.label : title}
          onChange={(e) => isWeeklyMode ? setDayLabel(activeDayIndex, e.target.value) : setTitle(e.target.value)}
          placeholder={isWeeklyMode ? "Enfoque del día (ej. Espalda)" : "Nombre de la rutina"}
          aria-label={isWeeklyMode ? "Enfoque del día" : "Nombre de la rutina"}
          style={{
            fontSize: "16px",
            fontWeight: 700,
            color: "#FFFFFF",
            background: "transparent",
            border: "none",
            outline: "none",
            padding: 0,
            width: "100%",
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            letterSpacing: "-0.02em",
          }}
        />
      </div>

      {/* Bottom Row: Metrics + Rest Toggle (left) | Dual Muscle Map (right) */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        {/* Left Column: Clean Horizontal Metric Pills & Rest Toggle */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Metrics Pills */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "4px 8px",
                borderRadius: "10px",
                background: SOLID.popover,
                border: `1px solid ${GLASS.border}`,
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
                fontSize: "11px",
                fontWeight: 600,
                color: TEXT.secondary,
                whiteSpace: "nowrap",
              }}
            >
              ~{activeTelemetry.minutes} min
            </span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "4px 8px",
                borderRadius: "10px",
                background: SOLID.popover,
                border: `1px solid ${GLASS.border}`,
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
                fontSize: "11px",
                fontWeight: 600,
                color: TEXT.secondary,
                whiteSpace: "nowrap",
              }}
            >
              {activeDayExercises.length} ejerc.
            </span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "4px 8px",
                borderRadius: "10px",
                background: ACCENT.subtle,
                border: `1px solid ${ACCENT.border}`,
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
                fontSize: "11px",
                fontWeight: 700,
                color: ACCENT.base,
                whiteSpace: "nowrap",
              }}
            >
              {dayTotalSets(activeDay)} series
            </span>
          </div>

          {/* Weekly Toggle: Día de descanso */}
          {isWeeklyMode && (
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                cursor: "pointer",
                userSelect: "none",
                paddingTop: 2,
              }}
            >
              <span style={{ fontSize: "13px", fontWeight: 500, color: TEXT.secondary }}>Día de descanso</span>
              <div style={{ position: "relative", width: 44, height: 26, flexShrink: 0 }}>
                <input
                  type="checkbox"
                  checked={activeDay?.kind === "rest"}
                  onChange={toggleRestDay}
                  style={{
                    appearance: "none",
                    width: "100%",
                    height: "100%",
                    borderRadius: "9999px",
                    background: activeDay?.kind === "rest" ? ACCENT.base : SOLID.popover,
                    border: "none",
                    outline: "none",
                    cursor: "pointer",
                    position: "relative",
                    transition: reducedMotion ? "none" : `background ${MOTION.fast} ${MOTION.easeOut}`,
                  }}
                />
                <span
                  style={{
                    position: "absolute",
                    top: 2,
                    left: activeDay?.kind === "rest" ? 24 : 2,
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: TEXT.primary,
                    boxShadow: GLASS.shadow,
                    transition: reducedMotion ? "none" : `left ${MOTION.fast} ${MOTION.easeOut}`,
                    pointerEvents: "none",
                  }}
                />
              </div>
            </label>
          )}
        </div>

        {/* Right Column: Dual Mini Muscle Map Capsule */}
        <DualMiniMuscleMap counts={activeTelemetry.counts} />
      </div>

      {/* Quick Name Chips */}
      <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {currentChips.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => handleChipClick(chip)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 10px",
                borderRadius: "9999px",
                border: "1px solid rgba(255,255,255,0.08)",
                background: "#2C2C2E",
                color: "#D4D4D4",
                fontSize: "10px",
                fontWeight: 500,
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: reducedMotion ? "none" : "all 150ms cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            >
              {chip}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const exerciseList = (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Section Header - NO "+ Añadir" button here anymore */}
      <h3 style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "#D4D4D4", textTransform: "uppercase", letterSpacing: "0.5px" }}>
        {isWeeklyMode ? `Ejercicios de ${WEEKDAYS_FULL[activeDayIndex]}` : "Ejercicios"}
      </h3>

      {activeDayExercises.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {activeDayExercises.map((ex, idx) => {
            const exerciseId = ex.exercise.id;
            const exerciseNameKey = ex.exercise.name.trim().toLowerCase().replace(/\s+/g, " ");
            const gifUrl = exerciseMediaMap.get(exerciseId) || exerciseMediaMap.get(exerciseNameKey) || ex.exercise.gif_url;
            return (
              <div
                key={ex.rowId ?? ex.exercise.id}
                style={{
                  ...cardStyle,
                  padding: "12px 16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "10px",
                        overflow: "hidden",
                        background: "#000000",
                        flexShrink: 0,
                        border: "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      {gifUrl ? (
                        <img
                          src={gifUrl}
                          alt={ex.exercise.name}
                          loading="lazy"
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            display: "block",
                          }}
                          onError={(e) => { e.currentTarget.style.display = "none"; }}
                        />
                      ) : (
                        <Dumbbell size={18} style={{ color: "#FFFFFF", margin: "auto", display: "block" }} aria-hidden="true" />
                      )}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "#FFFFFF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {getExerciseName(ex.exercise as Exercise)}
                      </p>
                      <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#71717A" }}>
                        {translateBodyPart(ex.exercise.body_part)} • {getRepLabel(ex as unknown as DraftExercise)}
                      </p>
                    </div>
                  </div>
                <button
                  type="button"
                  onClick={() => removeExerciseFromDay(isWeeklyMode ? activeDayIndex : 0, idx)}
                  aria-label="Eliminar ejercicio"
                  style={{
                    width: 32,
                    height: 32,
                    padding: 0,
                    borderRadius: "9999px",
                    border: "none",
                    background: "transparent",
                    color: "#FF3B30",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: reducedMotion ? "none" : "background 150ms cubic-bezier(0.4, 0, 0.2, 1)",
                  }}
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: "11px", color: "#71717A", minWidth: 40 }}>Series</span>
                  <button type="button" onClick={() => changeSets(isWeeklyMode ? activeDayIndex : 0, idx, -1)} aria-label="Quitar serie" style={{ width: 28, height: 28, padding: 0, borderRadius: "9999px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)", color: "#A3A3A3", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}>−</button>
                  <span style={{ fontFamily: "ui-monospace, SFMono-Regular, monospace", fontSize: "12px", fontWeight: 600, color: "#FFFFFF", minWidth: 28, textAlign: "center" }}>
                    {ex.target_sets}
                  </span>
                  <button type="button" onClick={() => changeSets(isWeeklyMode ? activeDayIndex : 0, idx, 1)} aria-label="Añadir serie" style={{ width: 28, height: 28, padding: 0, borderRadius: "9999px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)", color: "#A3A3A3", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}>+</button>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: "11px", color: "#71717A", minWidth: 40 }}>Reps</span>
                  <button type="button" onClick={() => changeReps(isWeeklyMode ? activeDayIndex : 0, idx, -1)} aria-label="Quitar repetición" style={{ width: 28, height: 28, padding: 0, borderRadius: "9999px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)", color: "#A3A3A3", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}>−</button>
                  <span style={{ fontFamily: "ui-monospace, SFMono-Regular, monospace", fontSize: "12px", fontWeight: 600, color: "#FFFFFF", minWidth: 28, textAlign: "center" }}>
                    {ex.target_reps_min ?? ex.target_reps_max ?? 8}
                  </span>
                  <button type="button" onClick={() => changeReps(isWeeklyMode ? activeDayIndex : 0, idx, 1)} aria-label="Añadir repetición" style={{ width: 28, height: 28, padding: 0, borderRadius: "9999px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)", color: "#A3A3A3", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}>+</button>
                </div>
              </div>
            </div>
          );})}
        </div>
      )}

      {/* "Añadir ejercicios a la sesión" action card - ALWAYS VISIBLE at the end */}
      <button
        type="button"
        onClick={() => {
          setSelectorInitialTab("all");
          setSelectorOpen(true);
        }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          padding: 16,
          borderRadius: "20px",
          border: `1px dashed ${GLASS.borderStrong}`,
          background: GLASS.fill,
          cursor: "pointer",
          transition: reducedMotion ? "none" : `all ${MOTION.fast} ${MOTION.easeOut}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 40,
              height: 40,
              borderRadius: "12px",
              background: ACCENT.subtle,
              color: ACCENT.base,
            }}
          >
            <Plus size={20} aria-hidden="true" />
          </div>
          <div style={{ textAlign: "left", flex: 1 }}>
            <p style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: TEXT.primary }}>Añadir ejercicios a la sesión</p>
            <p style={{ margin: "2px 0 0", fontSize: "12px", color: TEXT.tertiary }}>Toca para abrir el catálogo y seleccionar</p>
          </div>
        </div>
        <ChevronRight size={20} style={{ color: TEXT.tertiary, flexShrink: 0 }} aria-hidden="true" />
      </button>

      {/* Quick Warmup Button for this Day */}
      <button
        type="button"
        onClick={() => {
          setSelectorInitialTab("warmup");
          setSelectorOpen(true);
        }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          padding: "12px 16px",
          borderRadius: "16px",
          border: `1px solid ${GLASS.border}`,
          background: SOLID.card,
          cursor: "pointer",
          transition: reducedMotion ? "none" : `all ${MOTION.fast} ${MOTION.easeOut}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 34,
              height: 34,
              borderRadius: "10px",
              background: ACCENT.subtle,
              color: ACCENT.base,
            }}
          >
            <Flame size={17} aria-hidden="true" />
          </div>
          <div style={{ textAlign: "left", flex: 1 }}>
            <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: TEXT.primary }}>
              + Añadir calentamiento para este día
            </p>
            <p style={{ margin: "1px 0 0", fontSize: "11px", color: TEXT.tertiary }}>
              Movilidad articular y activación para los músculos del día
            </p>
          </div>
        </div>
        <ChevronRight size={18} style={{ color: TEXT.tertiary, flexShrink: 0 }} aria-hidden="true" />
      </button>
    </div>
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        background: SURFACE.sunken,
        color: TEXT.primary,
        paddingBottom: 128,
      }}
    >
      {saveError && (
        <div
          style={{
            padding: "8px 16px",
            background: ACCENT.subtle,
            border: `1px solid ${ACCENT.border}`,
            color: TEXT.primary,
            fontSize: "13px",
            fontWeight: 500,
            textAlign: "center",
          }}
          role="alert"
          aria-live="assertive"
        >
          {saveError}
        </div>
      )}
      <header
        className="flex items-center justify-between gap-1.5 w-full max-w-full overflow-hidden px-1 sm:px-3"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 30,
          height: 48,
          background: GLASS.fill,
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          borderBottom: `1px solid ${GLASS.border}`,
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Cancelar"
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs shrink-0 rounded-full"
          style={{
            border: "none",
            background: "transparent",
            color: TEXT.secondary,
            fontWeight: 600,
            cursor: "pointer",
            whiteSpace: "nowrap",
            transition: reducedMotion ? "none" : `color ${MOTION.fast} ${MOTION.easeOut}`,
          }}
        >
          <ChevronLeft size={15} aria-hidden="true" />
          <span>Cancelar</span>
        </button>

        <div
          className="inline-flex items-center p-0.5 text-xs shrink-0 rounded-xl"
          style={{
            border: `1px solid ${GLASS.border}`,
            background: SOLID.card,
          }}
          role="tablist"
          aria-label="Modo de rutina"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "single"}
            onClick={() => { hapticLight(); setMode("single"); }}
            className="px-2.5 py-1 text-xs font-semibold rounded-lg shrink-0"
            style={{
              border: "none",
              background: mode === "single" ? ACCENT.base : "transparent",
              color: mode === "single" ? TEXT.primary : TEXT.tertiary,
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: reducedMotion ? "none" : `all ${MOTION.fast} ${MOTION.easeOut}`,
            }}
          >
            Individual
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "weekly"}
            onClick={() => { hapticLight(); setMode("weekly"); }}
            className="px-2.5 py-1 text-xs font-semibold rounded-lg shrink-0"
            style={{
              border: "none",
              background: mode === "weekly" ? ACCENT.base : "transparent",
              color: mode === "weekly" ? TEXT.primary : TEXT.tertiary,
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: reducedMotion ? "none" : `all ${MOTION.fast} ${MOTION.easeOut}`,
            }}
          >
            Semanal
          </button>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave || saveStatus === "saving"}
          aria-label={canSave ? "Guardar rutina" : "Guardar rutina (requiere al menos un ejercicio)"}
          className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-bold shrink-0 rounded-xl uppercase"
          style={{
            border: "none",
            background: canSave ? ACCENT.base : SOLID.card,
            color: canSave ? TEXT.primary : TEXT.tertiary,
            letterSpacing: "0.4px",
            cursor: canSave ? "pointer" : "not-allowed",
            boxShadow: canSave ? `0 2px 10px ${ACCENT.glow}` : "none",
            whiteSpace: "nowrap",
            transition: reducedMotion ? "none" : `all ${MOTION.fast} ${MOTION.easeOut}`,
          }}
        >
          {saveStatus === "saving" ? "Guardando…" : "Guardar"}
        </button>
      </header>

      <main style={{ padding: "12px 16px 32px", flex: 1, overflowY: "auto" }}>
        {weeklyStrip}
        {heroCard}
        {exerciseList}

        <UnifiedExerciseSelectorSheet
          isOpen={selectorOpen}
          onClose={() => setSelectorOpen(false)}
          mode="multiple"
          onSelectMultiple={addExercisesToDay}
          initialTab={selectorInitialTab}
          title={selectorInitialTab === "warmup" ? "Seleccionar calentamiento" : "Seleccionar ejercicios"}
          dayContext={{
            dayIndex: activeDayIndex,
            dayLabel: isWeeklyMode ? (activeDay?.label ?? WEEKDAYS_FULL[activeDayIndex]) : title,
            dayExercises: Array.isArray(activeDay?.exercises) ? (activeDay.exercises.map((ex) => ex.exercise as Exercise)) : [],
          }}
        />
      </main>
    </div>
  );
}
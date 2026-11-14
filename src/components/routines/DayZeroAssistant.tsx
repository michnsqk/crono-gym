import { useEffect, useMemo, useState } from "react";
import { Check, RotateCw, Sparkles } from "lucide-react";
import { MuscleReadonlyMap } from "@/components/MuscleReadonlyMap";
import { ACCENT, GLASS, NUMERIC, RADIUS, SURFACE, TEXT } from "@/design/tokens";
import { loadCatalog } from "@/lib/catalog/catalogLoader";
import type { CatalogExercise } from "@/lib/catalog/types";
import {
  buildDayZeroPlan,
  DAY_ZERO_DAY_PRESETS,
  DAY_ZERO_MUSCLE_OPTIONS,
  defaultDaysFocusForFrequency,
  deriveDayFocusLabel,
  isAvailableForDayZero,
  muscleSlugsFromDayZeroSelection,
  resolveDayZeroMuscleIds,
  type DayZeroCustomDayFocus,
  type DayZeroFrequency,
  type DayZeroGoal,
  type DayZeroLevel,
  type DayZeroMuscleId,
  type DayZeroPlan,
} from "@/lib/routines/dayZeroPlan";

/**
 * Interactive Cronos Smart Day 0 builder:
 * supports 2–6 training days, per-day anatomical muscle targeting with
 * instant front/back mannequin highlighting, goal/level calibration, and
 * persistence hand-off to `RoutinesPage`.
 */

const DAY_ZERO_KEY = "cronos_day_zero_routines_v1";
const FREQUENCY_OPTIONS: readonly DayZeroFrequency[] = [2, 3, 4, 5, 6];

interface AnatomyHotspot {
  muscleId: DayZeroMuscleId;
  label: string;
  side: "front" | "back";
  style: {
    top: string;
    left: string;
    width: string;
    height: string;
  };
}

const ANATOMY_HOTSPOTS: readonly AnatomyHotspot[] = [
  { muscleId: "shoulders", label: "Hombros (frontal)", side: "front", style: { top: "20%", left: "22%", width: "56%", height: "9%" } },
  { muscleId: "chest", label: "Pecho", side: "front", style: { top: "27%", left: "30%", width: "40%", height: "12%" } },
  { muscleId: "biceps", label: "Bíceps", side: "front", style: { top: "30%", left: "14%", width: "72%", height: "13%" } },
  { muscleId: "core", label: "Abdomen / Core", side: "front", style: { top: "39%", left: "35%", width: "30%", height: "16%" } },
  { muscleId: "quads", label: "Cuádriceps", side: "front", style: { top: "55%", left: "26%", width: "48%", height: "20%" } },
  { muscleId: "calves", label: "Pantorrillas (frontal)", side: "front", style: { top: "77%", left: "28%", width: "44%", height: "15%" } },
  { muscleId: "back", label: "Espalda / Dorsal", side: "back", style: { top: "22%", left: "26%", width: "48%", height: "24%" } },
  { muscleId: "triceps", label: "Tríceps", side: "back", style: { top: "29%", left: "14%", width: "72%", height: "13%" } },
  { muscleId: "glutes", label: "Glúteos", side: "back", style: { top: "46%", left: "28%", width: "44%", height: "13%" } },
  { muscleId: "hamstrings", label: "Isquiotibiales", side: "back", style: { top: "59%", left: "27%", width: "46%", height: "16%" } },
  { muscleId: "calves", label: "Pantorrillas (posterior)", side: "back", style: { top: "77%", left: "28%", width: "44%", height: "15%" } },
];

/** Kept for callers that imported the old name of the plan. */
export type DayZeroRoutine = DayZeroPlan;

export type { DayZeroPlan };

export interface DayZeroAssistantProps {
  onCreated: (plan: DayZeroPlan) => void;
}

export function DayZeroAssistant({ onCreated }: DayZeroAssistantProps) {
  const [frequency, setFrequency] = useState<DayZeroFrequency>(3);
  const [daysFocus, setDaysFocus] = useState<DayZeroCustomDayFocus[]>(() =>
    defaultDaysFocusForFrequency(3),
  );
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [bodySide, setBodySide] = useState<"front" | "back">("front");
  const [goal, setGoal] = useState<DayZeroGoal>("general_fitness");
  const [level, setLevel] = useState<DayZeroLevel>("beginner");
  const [catalog, setCatalog] = useState<CatalogExercise[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    let alive = true;
    setStatus("loading");
    void loadCatalog()
      .then((rows) => {
        if (!alive) return;
        setCatalog(rows);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (!alive) return;
        console.error("[DayZeroAssistant] No se pudo cargar el catálogo", error);
        setStatus("error");
      });
    return () => {
      alive = false;
    };
  }, []);

  const available = useMemo(() => catalog.filter(isAvailableForDayZero), [catalog]);

  const safeActiveDayIndex = Math.min(activeDayIndex, frequency - 1);
  const activeDay = daysFocus[safeActiveDayIndex] ?? {
    dayIndex: safeActiveDayIndex,
    label: `Día ${safeActiveDayIndex + 1}`,
    muscles: [],
  };

  const activeMuscleIds = useMemo(
    () => resolveDayZeroMuscleIds(activeDay.muscles),
    [activeDay.muscles],
  );

  const selectedSlugsMap = useMemo(
    () => muscleSlugsFromDayZeroSelection(activeMuscleIds),
    [activeMuscleIds],
  );

  function selectFrequency(nextFrequency: DayZeroFrequency) {
    setFrequency(nextFrequency);
    setDaysFocus(defaultDaysFocusForFrequency(nextFrequency));
    setActiveDayIndex((prev) => Math.min(prev, nextFrequency - 1));
  }

  function updateActiveDayMuscles(nextMuscles: DayZeroMuscleId[], explicitLabel?: string) {
    setDaysFocus((prev) =>
      prev.map((entry, idx) =>
        idx === safeActiveDayIndex
          ? {
              ...entry,
              muscles: [...nextMuscles],
              label: explicitLabel ?? deriveDayFocusLabel(nextMuscles, `Día ${idx + 1}`),
            }
          : entry,
      ),
    );
  }

  function toggleMuscleForActiveDay(muscleId: DayZeroMuscleId) {
    const exists = activeMuscleIds.includes(muscleId);
    const next = exists
      ? activeMuscleIds.filter((id) => id !== muscleId)
      : [...activeMuscleIds, muscleId];
    if (!exists) {
      const option = DAY_ZERO_MUSCLE_OPTIONS.find((item) => item.id === muscleId);
      if (option) setBodySide(option.side);
    }
    updateActiveDayMuscles(next);
  }

  function applyPresetToActiveDay(muscles: readonly DayZeroMuscleId[], label: string) {
    updateActiveDayMuscles([...muscles], label);
    const primaryOption = DAY_ZERO_MUSCLE_OPTIONS.find((item) => item.id === muscles[0]);
    if (primaryOption) setBodySide(primaryOption.side);
  }

  function createRoutine() {
    if (available.length === 0) return;
    const plan = buildDayZeroPlan({
      catalog,
      frequency,
      daysPerWeek: frequency,
      goal,
      level,
      customDaysFocus: daysFocus,
    });
    if (plan.days.every((day) => day.exercises.length === 0)) return;
    try {
      const current = JSON.parse(window.localStorage.getItem(DAY_ZERO_KEY) ?? "[]");
      window.localStorage.setItem(
        DAY_ZERO_KEY,
        JSON.stringify([plan, ...(Array.isArray(current) ? current : [])]),
      );
    } catch {
      // The callback still lets the current screen confirm the generated routine.
    }
    onCreated(plan);
    setCollapsed(true);
  }

  if (collapsed) {
    return (
      <section
        className="mb-4 flex w-full flex-wrap items-center justify-between gap-3 p-4"
        style={{
          borderRadius: RADIUS.card,
          background: SURFACE.raised,
          border: `1px solid ${SURFACE.border}`,
        }}
      >
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: ACCENT.text }}>
            Cronos Smart Day 0
          </p>
          <p className="mt-1 text-sm" style={{ color: TEXT.secondary }}>
            Rutina generada. Ajusta los ejercicios cuando quieras.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="min-h-11 shrink-0 px-4 text-sm font-semibold"
          style={{ borderRadius: RADIUS.control, background: ACCENT.base, color: TEXT.onAccent }}
        >
          Crear otra rutina
        </button>
      </section>
    );
  }

  return (
    <section
      className="mb-4 w-full p-4 sm:p-5"
      style={{
        borderRadius: RADIUS.card,
        background: SURFACE.raised,
        border: `1px solid ${SURFACE.border}`,
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: ACCENT.text }}>
            Cronos Smart Day 0
          </p>
          <h2 className="mt-1 text-base font-bold" style={{ color: TEXT.primary }}>
            Crea tu rutina en 3 pasos
          </h2>
        </div>
        {status === "ready" && (
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
            style={{
              background: GLASS.fillSubtle,
              border: `1px solid ${GLASS.border}`,
              color: TEXT.secondary,
            }}
          >
            <span style={{ fontVariantNumeric: NUMERIC.transform }}>{frequency}</span> días · personalizado
          </span>
        )}
      </div>

      {status === "loading" && (
        <p className="mt-3 text-sm" style={{ color: TEXT.tertiary }} aria-live="polite">
          Cargando catálogo…
        </p>
      )}
      {status === "error" && (
        <p className="mt-3 text-sm" style={{ color: TEXT.secondary }} aria-live="polite">
          No se pudo cargar el catálogo. Revisa tu conexión y vuelve a intentarlo.
        </p>
      )}

      {status === "ready" && (
        <div className="mt-4 space-y-5">
          {/* Paso 1: Frecuencia 2 a 6 días */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: TEXT.secondary }}>
              1. ¿Cuántos días entrenas?
            </p>
            <div className="grid grid-cols-5 gap-1.5 sm:gap-2" role="group" aria-label="Días de entrenamiento por semana">
              {FREQUENCY_OPTIONS.map((value) => {
                const active = frequency === value;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => selectFrequency(value)}
                    className="flex min-h-11 flex-col items-center justify-center px-2 py-1.5 text-center transition-colors"
                    style={{
                      borderRadius: RADIUS.control,
                      background: active ? ACCENT.base : SURFACE.sunken,
                      color: active ? TEXT.onAccent : TEXT.secondary,
                      border: `1px solid ${active ? ACCENT.base : GLASS.border}`,
                    }}
                  >
                    <span className="text-sm font-bold leading-tight" style={{ fontVariantNumeric: NUMERIC.transform }}>
                      {value} días
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Barra de pestañas por día (Día 1 .. Día N) + Selector Anatómico */}
          <div
            className="p-3 sm:p-4"
            style={{
              borderRadius: RADIUS.surface,
              background: SURFACE.sunken,
              border: `1px solid ${GLASS.border}`,
            }}
          >
            <div
              className="flex gap-1.5 overflow-x-auto pb-1"
              role="tablist"
              aria-label="Configurar enfoque por día"
            >
              {daysFocus.slice(0, frequency).map((dayItem, idx) => {
                const active = idx === safeActiveDayIndex;
                const muscleCount = resolveDayZeroMuscleIds(dayItem.muscles).length;
                return (
                  <button
                    key={idx}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveDayIndex(idx)}
                    className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold transition-colors"
                    style={{
                      background: active ? GLASS.fillImmersive : GLASS.fillSubtle,
                      color: active ? TEXT.primary : TEXT.secondary,
                      border: `1px solid ${active ? ACCENT.border : GLASS.border}`,
                      boxShadow: active ? `0 0 0 1px ${ACCENT.glow}` : undefined,
                    }}
                  >
                    <span>Día {idx + 1}</span>
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs"
                      style={{
                        fontVariantNumeric: NUMERIC.transform,
                        background: active ? ACCENT.subtle : GLASS.fill,
                        color: active ? ACCENT.text : TEXT.tertiary,
                      }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: muscleCount > 0 ? ACCENT.base : TEXT.disabled }}
                      />
                      {muscleCount}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold" style={{ color: TEXT.primary }}>
                ¿Qué quieres trabajar el Día {safeActiveDayIndex + 1}?
              </h3>
              <span
                className="rounded-full px-2.5 py-1 text-xs font-medium"
                style={{
                  background: activeMuscleIds.length > 0 ? ACCENT.subtle : GLASS.fillSubtle,
                  color: activeMuscleIds.length > 0 ? ACCENT.text : TEXT.tertiary,
                }}
              >
                {activeMuscleIds.length > 0
                  ? deriveDayFocusLabel(activeMuscleIds, activeDay.label ?? `Día ${safeActiveDayIndex + 1}`)
                  : "Elige músculos"}
              </span>
            </div>

            {/* Opción A: Presets rápidos de 1 toque */}
            <div className="mt-2.5 flex flex-wrap gap-1.5" role="group" aria-label="Presets rápidos de músculos">
              {DAY_ZERO_DAY_PRESETS.map((preset) => {
                const isPresetSelected =
                  preset.muscles.length === activeMuscleIds.length &&
                  preset.muscles.every((m) => activeMuscleIds.includes(m));
                return (
                  <button
                    key={preset.id}
                    type="button"
                    aria-pressed={isPresetSelected}
                    onClick={() => applyPresetToActiveDay(preset.muscles, preset.shortLabel)}
                    className="min-h-9 rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
                    style={{
                      background: isPresetSelected ? ACCENT.subtle : GLASS.fill,
                      color: isPresetSelected ? ACCENT.text : TEXT.secondary,
                      border: `1px solid ${isPresetSelected ? ACCENT.border : GLASS.border}`,
                    }}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            {/* Opción B: Selector Anatómico Interactivo + Píldoras sincronizadas */}
            <div className="mt-4 grid gap-4 md:grid-cols-[200px_1fr] md:items-start">
              <div
                className="p-3"
                style={{
                  borderRadius: RADIUS.surface,
                  background: SURFACE.raised,
                  border: `1px solid ${GLASS.border}`,
                }}
              >
                <div
                  className="mb-2 grid grid-cols-2 gap-1 rounded-full p-1"
                  role="group"
                  aria-label="Vista del maniquí anatómico"
                  style={{ background: SURFACE.sunken, border: `1px solid ${GLASS.border}` }}
                >
                  {(["front", "back"] as const).map((sideOption) => {
                    const selected = bodySide === sideOption;
                    return (
                      <button
                        key={sideOption}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setBodySide(sideOption)}
                        className="min-h-8 rounded-full px-2 py-1 text-xs font-semibold transition-colors"
                        style={{
                          background: selected ? GLASS.fillImmersive : "transparent",
                          color: selected ? TEXT.primary : TEXT.tertiary,
                        }}
                      >
                        {sideOption === "front" ? "Vista Frontal" : "Vista Posterior"}
                      </button>
                    );
                  })}
                </div>

                <div className="relative mx-auto w-36 sm:w-40">
                  <MuscleReadonlyMap
                    counts={selectedSlugsMap}
                    side={bodySide}
                    label={`Mapa anatómico ${bodySide === "front" ? "frontal" : "posterior"} del Día ${safeActiveDayIndex + 1}`}
                    backgroundColor="transparent"
                    litFill={ACCENT.base}
                    mostLitFill={ACCENT.base}
                    caption={null}
                    overflow="visible"
                  />
                  {ANATOMY_HOTSPOTS.filter((spot) => spot.side === bodySide).map((spot) => {
                    const selected = activeMuscleIds.includes(spot.muscleId);
                    return (
                      <button
                        key={`${spot.side}-${spot.label}`}
                        type="button"
                        aria-label={`Alternar ${spot.label}`}
                        aria-pressed={selected}
                        onClick={() => toggleMuscleForActiveDay(spot.muscleId)}
                        className="absolute rounded-full bg-transparent hover:bg-white/10 focus-visible:outline focus-visible:outline-2"
                        style={spot.style}
                      />
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => setBodySide((prev) => (prev === "front" ? "back" : "front"))}
                  className="mt-2 inline-flex min-h-8 w-full items-center justify-center gap-1.5 text-xs font-medium"
                  style={{ color: TEXT.tertiary }}
                >
                  <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{bodySide === "front" ? "Girar a espalda" : "Girar a frente"}</span>
                </button>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium" style={{ color: TEXT.tertiary }}>
                  Toca músculos en el mapa o selecciona las zonas del Día {safeActiveDayIndex + 1}:
                </p>
                <div className="flex flex-wrap gap-2" role="group" aria-label={`Músculos del Día ${safeActiveDayIndex + 1}`}>
                  {DAY_ZERO_MUSCLE_OPTIONS.map((option) => {
                    const active = activeMuscleIds.includes(option.id);
                    return (
                      <button
                        key={option.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => toggleMuscleForActiveDay(option.id)}
                        className="inline-flex min-h-11 items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors"
                        style={{
                          borderRadius: RADIUS.control,
                          background: active ? ACCENT.subtle : SURFACE.raised,
                          color: active ? TEXT.primary : TEXT.secondary,
                          border: `1px solid ${active ? ACCENT.border : GLASS.border}`,
                        }}
                      >
                        <span
                          className="inline-flex h-4 w-4 items-center justify-center rounded-full"
                          style={{
                            background: active ? ACCENT.base : GLASS.fillSubtle,
                            color: active ? TEXT.onAccent : TEXT.tertiary,
                          }}
                        >
                          {active && <Check className="h-2.5 w-2.5" aria-hidden="true" />}
                        </span>
                        <span>{option.label}</span>
                      </button>
                    );
                  })}
                </div>
                {activeMuscleIds.length === 0 && (
                  <p className="mt-2.5 text-xs" style={{ color: ACCENT.text }}>
                    Elige al menos 1 grupo muscular o aplica un preset rápido para este día.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Paso 2 y Paso 3: Objetivo y Nivel */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: TEXT.secondary }}>
                2. ¿Cuál es tu objetivo?
              </p>
              <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Objetivo de entrenamiento">
                {(
                  [
                    { id: "strength", label: "Fuerza" },
                    { id: "hypertrophy", label: "Hipertrofia" },
                    { id: "general_fitness", label: "Fitness general" },
                  ] as const
                ).map((item) => {
                  const active = goal === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setGoal(item.id)}
                      className="min-h-11 px-2 py-2 text-center text-xs font-semibold transition-colors"
                      style={{
                        borderRadius: RADIUS.control,
                        background: active ? ACCENT.base : SURFACE.sunken,
                        color: active ? TEXT.onAccent : TEXT.secondary,
                        border: `1px solid ${active ? ACCENT.base : GLASS.border}`,
                      }}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: TEXT.secondary }}>
                3. ¿Cuál es tu nivel?
              </p>
              <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Nivel de experiencia">
                {(
                  [
                    { id: "beginner", label: "Principiante" },
                    { id: "intermediate", label: "Intermedio" },
                    { id: "advanced", label: "Avanzado" },
                  ] as const
                ).map((item) => {
                  const active = level === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setLevel(item.id)}
                      className="min-h-11 px-2 py-2 text-center text-xs font-semibold transition-colors"
                      style={{
                        borderRadius: RADIUS.control,
                        background: active ? ACCENT.base : SURFACE.sunken,
                        color: active ? TEXT.onAccent : TEXT.secondary,
                        border: `1px solid ${active ? ACCENT.base : GLASS.border}`,
                      }}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <p className="text-xs" style={{ color: TEXT.tertiary }}>
              {available.length} ejercicios disponibles en Cronos Gym
            </p>
            <button
              type="button"
              onClick={createRoutine}
              disabled={available.length === 0}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 px-5 text-sm font-semibold sm:w-auto"
              style={{
                borderRadius: RADIUS.control,
                background: ACCENT.base,
                color: TEXT.onAccent,
                opacity: available.length === 0 ? 0.5 : 1,
              }}
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              <span>Crear rutina · {frequency} días</span>
            </button>
          </div>
        </div>
      )}

      {status !== "ready" && (
        <p className="mt-3 text-xs" style={{ color: TEXT.tertiary }}>
          Preparando el catálogo…
        </p>
      )}
    </section>
  );
}

/**
 * ActiveWorkout.tsx — Rediseño Apple HIG / Apple Fitness+ para la pantalla de entrenamiento activo.
 *
 * Principios:
 *   - Fondo OLED puro (#000000) para que los GIFs se integren sin bordes.
 *   - Header telemetría: sticky, blur, timer con indicador verde pulsante (#30D158), botón "Terminar" iOS-style.
 *   - Carrusel de ejercicios: indicadores circulares pulidos, anillo Crimson (#FF3B30) en activo.
 *   - Área de identidad del ejercicio: GIF grande sobre negro, títulos limpios (regex strip IDs), jerarquía editorial Apple.
 *   - Toolbar unificada: grid único "Demo | Avance | Cambiar | Ajustar" en contenedor GlassCard.
 *   - Tabla de series Apple HIG: columnas SERIE | ANTERIOR | KG/LB | REPS | RPE | ✓ con styling Graphite L1/L2.
 *   - Padding inferior (pb-36) para evitar solapamiento con BottomNav y botón flotante Cronos IA.
 *
 * Se preserva toda la lógica de negocio: borrador, sincronía, supersets, recuperación, timer deadline-based.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  X,
  ArrowUp,
  ArrowDown,
  Check,
  Settings,
  Plus,
  Sparkles,
  Moon,
  FastForward,
  Minus,
} from "lucide-react";
import { GlassButton } from "@/components/ui/GlassButton";
import { requestFloorSpot, submitMachineReport } from "@/services/gymOperationsService";
import { loadRestSeconds, saveRestSeconds } from "../lib/workout/restPreferences";
import {
  recommendSmartRest,
  type SmartRestRecommendation,
} from "../lib/workout/smartRestAdvisor";
import type { SetEntry } from "../lib/workout/types";
import { GYM_LABELS } from "../lib/i18n";
import {
  ACCENT,
  GLASS,
  MOTION,
  RADIUS,
  SCRIM,
  SPACE,
  SOLID,
  STATUS,
  SURFACE,
  TEXT,
  TYPE,
  Z_INDEX,
} from "@/design/tokens";
import type { PlannedExercise } from "../hooks/useGymData";
import { ExerciseCarousel } from "./ExerciseCarousel";
import { UnifiedExerciseSelectorSheet } from "./UnifiedExerciseSelectorSheet";
import { DemoSheet } from "./workout/DemoSheet";
import { AvanceSheet } from "./workout/AvanceSheet";
import { AjustarSheet } from "./workout/AjustarSheet";
import { CambiarSheet } from "./workout/CambiarSheet";
import { BiomechanicalGripStanceModal } from "./workout/BiomechanicalGripStanceModal";
import type { Exercise } from "@/types/supabase";
import {
  EMPTY_PERFORMANCE,
  usePreviousPerformance,
} from "../hooks/usePreviousPerformance";
import { useOfflineSync } from "../hooks/useOfflineSync";
import {
  newSessionId,
  saveDraft,
  deleteDraft,
  type DraftExercise,
  type FinalizePayload,
} from "../lib/offlineStore";
import { queueAndSync } from "../lib/sessionSync";
import { useActiveSession } from "../context/ActiveSessionContext";
import { useGymSettings } from "../context/GymSettingsContext";
import { useBodyMetrics, useProfile } from "../hooks/useProfile";
import { BAR_WEIGHTS, nearestLoadable } from "../lib/workout/weightUtils";
import { EquipmentInspectionSheet } from "./workout/active/EquipmentInspectionSheet";
import { SetTrackerTable } from "./workout/active/SetTrackerTable";
import { ExerciseStage } from "./workout/active/ExerciseStage";
import { PreWorkoutCheckinCard } from "./workout/active/PreWorkoutCheckinCard";
import { PlateCalculatorSheet } from "./workout/active/PlateCalculatorSheet";
import { useElapsedMs, formatElapsed } from "../hooks/useElapsedMs";
import { RestTimer } from "./RestTimer";
import { SET_LOGGER_LABELS, UNDO_LABELS } from "../lib/i18n";
import { toWarmupColumn } from "../lib/workout/setKind";
import {
  cloneRoutineToSession,
  newSessionExercise,
  newSessionSet,
  templateFromPlanned,
  workingTemplateSets,
} from "../lib/workout/routineCloner";
import { kgToLb } from "../lib/profile";
import { getNextSupersetTargetIndex, getSupersetInfo } from "../lib/workout/supersetUtils";
import type { SupersetInfo } from "../lib/workout/supersetUtils";
import { SupersetBadge } from "./workout/SupersetBadge";
import { WorkoutPreStartView } from "./workout/WorkoutPreStartView";
import { suggestNextTarget, type OverloadTarget } from "../lib/overload";
import { getEquipmentSuggestionForExercise } from "@/data/equipmentCatalog";
import { useExerciseCatalog } from "@/hooks/useExerciseCatalog";
import { useCatalogOverridesVersion } from "@/hooks/useCatalogOverrides";
import { resolveCatalogExerciseWithOverrides } from "@/lib/catalog/resolveExercise";
import type { EquipmentEntry, EquipmentSuggestion } from "@/data/equipmentCatalog";
import { equipmentMap } from "@/data/equipmentMap";
import { getExerciseDisplayName } from "@/utils/exerciseTranslation";
import {
  BODYWEIGHT_LOAD_HINT,
  calibratePendingSets,
  classifyEquipmentCategory,
  cleanEquipmentLabel,
  computeExerciseRank,
  epley,
  estimateSmartLoad,
  findStationAlternatives,
  generateSmartWarmupSets,
  generateWarmupRamp,
  getAdaptiveRestSeconds,
  getLoadBreakdownHint,
  inferColdStartLoad,
  isBodyweightExercise,
  loadStrengthModel,
  readExerciseBest,
  recordSetAndTrainEngine,
  SET_TYPE_GUIDES,
  type CalibrationPresetId,
  type EquipmentCategory,
  type ExerciseRankResult,
  type StationAlternative,
} from "@/lib/workout/cronosSmartEngine";
import { ExerciseRankSheet } from "./workout/ExerciseRankSheet";
import { SmartOverloadModal } from "./workout/SmartOverloadModal";

const DEFAULT_REST = 90;
const PERSIST_DEBOUNCE_MS = 400;
export const UNDO_WINDOW_MS = 5000;

/** Strips catalog ID suffixes like " • 0028", " - 0123", "· 0045" from exercise names. */
function cleanExerciseName(name: string): string {
  return name.replace(/\s*[•·-]\s*\d{3,5}$/, "");
}

function toNumber(value: string): number | null {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * The next exercise that still has work, looking forward from `fromKey` and
 * wrapping around once. `-1` when the session has nothing left to do.
 *
 * The exercise the athlete is on is never a candidate: by the time this is
 * asked, it is finished.
 */
function nextIncompleteExerciseIndex(
  items: readonly { key: string; sets: readonly { completed: boolean }[] }[],
  fromKey: string,
): number {
  const from = items.findIndex((item) => item.key === fromKey);
  if (from === -1 || items.length < 2) return -1;
  for (let step = 1; step < items.length; step += 1) {
    const at = (from + step) % items.length;
    if (items[at].sets.some((set) => !set.completed)) return at;
  }
  return -1;
}

/** Seconds as the clock shows them: 90 -> "01:30". */
function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(Number.isFinite(totalSeconds) ? totalSeconds : 0));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** ------------------------------------------------------------------ Session Header (Fitness+ Telemetry) */

interface SessionHeaderProps {
  exerciseLabel: string;
  superset?: SupersetInfo | null;
  startedAt: string | null;
  onGear: () => void;
  onTerminate?: () => void;
}

function SessionHeader({
  exerciseLabel,
  superset,
  startedAt,
  onGear,
  onTerminate,
}: SessionHeaderProps) {
  const GEAR = GYM_LABELS.triggerAriaLabel(GYM_LABELS.defaultTriggerContext);
  const elapsedMs = useElapsedMs(startedAt);
  const elapsedStr = formatElapsed(elapsedMs);

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        padding: `calc(10px + env(safe-area-inset-top, 0px)) 12px 10px 12px`,
        background: "rgba(0, 0, 0, 0.85)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
      }}
    >
      {/* Left: Live Timer Capsule + Progress Text */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
        {startedAt && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 9px",
              borderRadius: 9999,
              background: "rgba(48, 209, 88, 0.15)",
              border: "1px solid rgba(48, 209, 88, 0.3)",
            }}
          >
            <span
              className="cronos-pulse-green"
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#30D158",
              }}
              aria-hidden="true"
            />
            <span
              style={{
                fontFamily: TYPE.mono.font,
                fontSize: TYPE.caption.size,
                fontWeight: 600,
                fontVariantNumeric: "tabular-nums",
                color: "#30D158",
                whiteSpace: "nowrap",
              }}
            >
              {elapsedStr}
            </span>
          </div>
        )}
        {exerciseLabel && (
          <div
            style={{
              fontSize: "11px",
              fontWeight: 600,
              fontFamily: TYPE.mono.font,
              fontVariantNumeric: "tabular-nums",
              color: TEXT.secondary,
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {exerciseLabel}
          </div>
        )}
        {superset && (
          <SupersetBadge
            label={superset.label}
            position={superset.position}
            total={superset.total}
            tone={superset.tone}
          />
        )}
      </div>

      {/* Right: Settings + Terminar Button */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <button
          type="button"
          aria-label={GEAR}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            borderRadius: RADIUS.round,
            border: `1px solid ${GLASS.border}`,
            background: "rgba(255, 255, 255, 0.05)",
            color: TEXT.secondary,
            cursor: "pointer",
          }}
          onClick={onGear}
        >
          <Settings size={18} strokeWidth={1.5} aria-hidden="true" />
        </button>
        {onTerminate && (
          <GlassButton
            variant="ghost"
            onClick={onTerminate}
            aria-label="Terminar entrenamiento"
          style={{
            height: 36,
            minHeight: 36,
            minWidth: 36,
            padding: "0 12px",
            borderRadius: 9999,
            background: "rgba(255, 59, 48, 0.12)",
            color: ACCENT.text,
            border: `1px solid ${ACCENT.border}`,
            fontSize: "13px",
            fontWeight: 600,
          }}
        >
          Terminar
        </GlassButton>
        )}
      </div>
    </header>
  );
}

/** ------------------------------------------------------------------ Undo Banner */

interface UndoBannerProps {
  setNumber: number;
  onUndo: () => void;
  onDismiss: () => void;
}

function UndoBanner({ setNumber, onUndo, onDismiss }: UndoBannerProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "sticky",
        top: SPACE.md,
        zIndex: Z_INDEX.sticky,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: SPACE.sm,
        overflow: "hidden",
        padding: "12px 16px",
        borderRadius: 14,
        border: `1px solid ${GLASS.borderStrong}`,
        background: "rgba(22, 22, 26, 0.95)",
        backdropFilter: "blur(20px)",
        boxShadow: GLASS.shadow,
      }}
    >
      <span style={{ fontSize: TYPE.body.size, color: TEXT.primary }}>
        Serie {setNumber} eliminada
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: SPACE.sm }}>
        <GlassButton
          variant="secondary"
          onClick={onUndo}
          aria-label={`Deshacer la eliminación de la serie ${setNumber}`}
          style={{
            minHeight: 36,
            padding: "0 14px",
            borderRadius: 9999,
            fontSize: TYPE.body.size,
            fontWeight: 600,
          }}
        >
          {UNDO_LABELS.undo}
        </GlassButton>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Cerrar aviso de eliminación"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: `1px solid ${GLASS.border}`,
            background: "transparent",
            color: TEXT.tertiary,
            cursor: "pointer",
          }}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      <span
        aria-hidden="true"
        className="cronos-undo--drain"
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          height: 2,
          width: "100%",
          transformOrigin: "left center",
          background: ACCENT.base,
          animation: `cronos-undo-drain ${UNDO_WINDOW_MS}ms linear forwards`,
        }}
      />
    </div>
  );
}

/** ------------------------------------------------------------------ Main ActiveWorkout Component */

interface ActiveWorkoutProps {
  userId: string;
  routineId: string | null;
  routineTitle: string;
  planned: PlannedExercise[];
  /**
   * Called once the session is closed, with the rows exactly as they were
   * finished -- including the ones that were never checked. The summary is the
   * only screen that can still say something about them, so they travel here.
   */
  onFinished: (exercises: readonly DraftExercise[]) => void;
  /** Optional exit handler when leaving the pre-start screen. */
  onExit?: () => void;
}

export function ActiveWorkout({
  userId,
  routineId,
  routineTitle,
  planned,
  onFinished,
  onExit,
}: ActiveWorkoutProps) {
  const [logId] = useState(() => newSessionId());
  const { exercises: catalogExercises } = useExerciseCatalog() as any;
  const catalog = useMemo(() => catalogExercises || [], [catalogExercises]);
  const overrideVersion = useCatalogOverridesVersion();
  const availableEquipmentList = useMemo(
    () => ["mancuernas", "polea", "barra", "maquina", "bandas", "cable"],
    [],
  );

  const {
    session,
    end,
    warmups,
    resolveWarmup,
    recoverableDraft,
    restoreDraft,
    discardDraft,
    recoveredLogId,
    pendingRestEndsAt,
  } = useActiveSession();

  const activeLogId = recoveredLogId ?? logId;

  const [fallbackStartedAt] = useState(() => new Date().toISOString());
  const startedAt = session?.startedAt ?? fallbackStartedAt;

  const [items, setItems] = useState<DraftExercise[]>(() =>
    cloneRoutineToSession(
      templateFromPlanned(planned, { id: routineId, title: routineTitle }),
    ).items,
  );
  const [notes, setNotes] = useState("");
  const [rest, setRest] = useState<{
    id: number;
    seconds: number;
    endsAt: number;
    exerciseKey?: string;
    exerciseName?: string;
    smartRecommendation?: SmartRestRecommendation;
  } | null>(null);
  const restIdRef = useRef(0);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [gearOpen, setGearOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<"add" | "replace">("add");
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<{
    itemKey: string;
    index: number;
    entry: SetEntry;
  } | null>(null);
  const [equipmentSheetOpen, setEquipmentSheetOpen] = useState(false);
  const [isDemoOpen, setIsDemoOpen] = useState(false);
  const [isAvanceOpen, setIsAvanceOpen] = useState(false);
  const [isCambiarOpen, setIsCambiarOpen] = useState(false);
  const [isAjustarOpen, setIsAjustarOpen] = useState(false);
  const [smartGuidesOpen, setSmartGuidesOpen] = useState(false);
  const [substituteOpen, setSubstituteOpen] = useState(false);
  const [machineReportOpen, setMachineReportOpen] = useState(false);
  /** The overload modal, and the rank sheet that explains the next goal. */
  const [overloadOpen, setOverloadOpen] = useState(false);
  const [rankSheetOpen, setRankSheetOpen] = useState(false);
  /** The rest the athlete chose for this session, used until the first set ends. */
  const [restPreset, setRestPreset] = useState(DEFAULT_REST);
  /**
   * Bumped whenever the engine learns something, so the rank is recomputed from
   * the model instead of from a render that happened before the set.
   */
  const [strengthRevision, setStrengthRevision] = useState(0);
  const [calibrationSetIndex, setCalibrationSetIndex] = useState<number | null>(null);
  const [appliedSmartLoadByExercise, setAppliedSmartLoadByExercise] = useState<Record<string, { weightKg: number; reps: number }>>({});
  const [sessionPrByExercise, setSessionPrByExercise] = useState<
    Record<string, { e1rmKg: number; weightKg: number; reps: number }>
  >({});
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentEntry | null>(
    null,
  );
  const gym = useGymSettings();
  /** The athlete's bodyweight, the denominator of every relative rank. */
  const { profile } = useProfile(userId);
  const { todayCheckin, logCheckin } = useBodyMetrics(userId);
  const [checkinDismissed, setCheckinDismissed] = useState(false);
  const [plateCalc, setPlateCalc] = useState<{
    open: boolean;
    setIndex: number | null;
    initialWeightKg: number;
  }>({ open: false, setIndex: null, initialWeightKg: 60 });

  const sync = useOfflineSync();

  const selected = useMemo(
    () => items.find((i) => i.key === selectedKey) ?? items[0] ?? null,
    [items, selectedKey],
  );

  const selectedIndex = useMemo(
    () => (selected ? items.findIndex((i) => i.key === selected.key) : -1),
    [items, selected],
  );

  /**
   * A coach's rename or machine change reaches the session without a reload.
   *
   * Only what is *shown* about an exercise is re-resolved: the identity, the gif
   * and the equipment. Sets already logged belong to the athlete, and the sync
   * payload carries ids, weights and reps — never a name — so nothing that was
   * written can be rewritten by a rename.
   */
  useEffect(() => {
    if (catalog.length === 0) return;
    setItems((previous) => {
      let changed = false;
      const next = previous.map((item) => {
        const resolved = resolveCatalogExerciseWithOverrides(item.exercise.id, catalog);
        if (!resolved) return item;
        const nameEs = resolved.nameEs;
        const gifUrl = resolved.effectiveGifUrl || item.exercise.gif_url;
        if (item.exercise.name_es === nameEs && item.exercise.gif_url === gifUrl) return item;
        changed = true;
        return { ...item, exercise: { ...item.exercise, name_es: nameEs, gif_url: gifUrl } };
      });
      return changed ? next : previous;
    });
  }, [catalog, overrideVersion]);

  const equipmentSuggestion = useMemo<EquipmentSuggestion>(() => {
    if (!selected) return { primary: null, alternatives: [] };
    return getEquipmentSuggestionForExercise(
      selected.exercise.name,
      selected.exercise.equipment,
    );
  }, [selected]);

  const selectedCatalogExercise = useMemo(
    () => (selected ? resolveCatalogExerciseWithOverrides(selected.exercise.id, catalog) : null),
    // `overrideVersion` is what makes a rename re-resolve without a new catalog.
    [catalog, selected?.exercise.id, overrideVersion],
  );
  const equipmentForSelected = useMemo<EquipmentEntry | null>(() => {
    const id = selectedCatalogExercise?.effectiveEquipmentId;
    // `NONE` is a decision: the exercise belongs to the floor, and falling back to
    // a guessed machine would put the athlete in front of the wrong station.
    if (!id || id === "NONE") return null;
    const mapped = equipmentMap[id];
    if (!mapped) return equipmentSuggestion.primary;
    return { ...mapped, id: mapped.id } as EquipmentEntry;
  }, [selectedCatalogExercise, equipmentSuggestion]);

  /**
   * The location pill: which machine, or the floor.
   *
   * The id is part of the text on purpose: a coach who reassigns a movement wants
   * to see the code the portal wrote, not just a friendly name that several
   * stations share.
   */
  const locationLabel = useMemo(() => {
    const resolved = selectedCatalogExercise;
    if (!resolved) return "";
    if (resolved.effectiveEquipmentId === "NONE") {
      return `${SET_LOGGER_LABELS.floorArea} · ${SET_LOGGER_LABELS.bodyweightLoad}`;
    }
    return `${resolved.effectiveEquipmentId} · ${resolved.effectiveEquipmentName}`;
  }, [selectedCatalogExercise]);

  const selectedSuperset = useMemo(() => {
    if (!selected) return null;
    return getSupersetInfo(
      items,
      items.findIndex((item) => item.key === selected.key),
    );
  }, [items, selected]);

  const [biomechanicsModalOpen, setBiomechanicsModalOpen] = useState(false);
  const [biomechanicsByExercise, setBiomechanicsByExercise] = useState<Record<string, string>>({});
  const carouselItems = useMemo(
    () =>
      items.map((item) => ({
        key: item.key,
        exercise: item.exercise,
        done: item.sets.filter((s) => s.completed).length,
        total: item.sets.length,
        groupId: item.groupId ?? null,
      })),
    [items],
  );

  function focusExercise(key: string) {
    setSelectedKey(key);
  }

  function handleReorder(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return;
    setItems((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }

  function handleAddExercise() {
    setPickerMode("add");
    setPickerOpen(true);
  }

  function handleExerciseSelected(exercise: Exercise) {
    const existingIndex = items.findIndex((i) => i.exercise.id === exercise.id);
    if (existingIndex !== -1) {
      setSelectedKey(items[existingIndex].key);
      setPickerOpen(false);
      return;
    }
    const loggerExercise: Exercise = {
      id: exercise.id,
      name: exercise.name,
      name_es: exercise.name_es,
      body_part: exercise.body_part,
      target: exercise.target,
      equipment: exercise.equipment,
      gif_url: exercise.gif_url,
      instructions: [],
      is_active: exercise.is_active,
      is_hidden: exercise.is_hidden,
    };
    setPickerOpen(false);
    setItems((prev) => {
      if (pickerMode === "replace" && selectedKey) {
        return prev.map((item) =>
          item.key === selectedKey ? { ...item, exercise: loggerExercise } : item,
        );
      }
      const newKey = exercise.id;
      setSelectedKey(newKey);
      const added = newSessionExercise({
        exercise: loggerExercise,
        restSeconds: DEFAULT_REST,
        groupId: null,
        sets: workingTemplateSets(3),
      });
      setSelectedKey(added.key);
      return [...prev, added];
    });

  }

  function restoreRecovered() {
    if (!recoverableDraft) return;
    setItems(recoverableDraft.items);
    setNotes(recoverableDraft.notes);
    if (recoverableDraft.selectedKey) setSelectedKey(recoverableDraft.selectedKey);
    restoreDraft();
    setStarted(true);
    setNotice("Sesión recuperada. Continúa donde lo dejaste.");
    if (pendingRestEndsAt) startRestUntil(pendingRestEndsAt);
  }

  function discardRecovered() {
    if (!recoverableDraft) return;
    discardDraft();
  }

  const persist = useCallback(
    (nextItems: DraftExercise[], nextNotes: string, finalized = false) => {
      void saveDraft({
        logId: activeLogId,
        userId,
        routineId,
        routineTitle,
        startedAt,
        items: nextItems,
        notes: nextNotes,
        finalized,
        updatedAt: Date.now(),
        restEndsAt: restRef.current?.endsAt,
        selectedKey: selectedKeyRef.current,
        routineDayId: session?.routineDayId ?? null,
        dayLabel: session?.dayLabel ?? null,
      });
    },
    [activeLogId, userId, routineId, routineTitle, startedAt, session],
  );

  const itemsRef = useRef(items);
  const notesRef = useRef(notes);
  itemsRef.current = items;
  notesRef.current = notes;
  const restRef = useRef(rest);
  restRef.current = rest;
  const selectedKeyRef = useRef<string | null>(null);
  selectedKeyRef.current = selected?.key ?? null;
  const finalizedRef = useRef(false);

  useEffect(() => {
    if (recoverableDraft || finalizedRef.current) return;
    const timer = window.setTimeout(() => {
      if (finalizedRef.current) return;
      persist(items, notes);
    }, PERSIST_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [items, notes, persist, recoverableDraft]);

  const exerciseIds = useMemo(() => items.map((i) => i.exercise.id), [items]);
  const { performance } = usePreviousPerformance(userId, exerciseIds);

  const overload = useMemo(() => {
    const map: Record<string, OverloadTarget> = {};
    for (const item of items) {
      map[item.key] = suggestNextTarget(
        performance[item.exercise.id] ?? EMPTY_PERFORMANCE,
        { exercise: item.exercise },
      );
    }
    return map;
  }, [items, performance]);

  function startRestUntil(
    endsAt: number,
    meta?: {
      exerciseKey?: string;
      exerciseName?: string;
      smartRecommendation?: SmartRestRecommendation;
    },
  ) {
    const remainingMs = endsAt - Date.now();
    if (remainingMs <= 0) return;
    const total = Math.max(Math.ceil(remainingMs / 1000), 1);
    restIdRef.current += 1;
    setRest({
      id: restIdRef.current,
      seconds: total,
      endsAt,
      exerciseKey: meta?.exerciseKey,
      exerciseName: meta?.exerciseName,
      smartRecommendation: meta?.smartRecommendation,
    });
  }

  function startRest(
    seconds: number,
    meta?: {
      exerciseKey?: string;
      exerciseName?: string;
      smartRecommendation?: SmartRestRecommendation;
    },
  ) {
    const total = Math.max(seconds, 10);
    startRestUntil(Date.now() + total * 1000, meta);
  }

  const closeRest = useCallback(() => setRest(null), []);

  useEffect(() => {
    if (!pendingRemoval) return;
    const timer = window.setTimeout(() => setPendingRemoval(null), UNDO_WINDOW_MS);
    return () => window.clearTimeout(timer);
  }, [pendingRemoval]);

  const displayKg = useCallback(
    (kg: number): string => {
      const shown = gym.weightUnit === "lb" ? kgToLb(kg) : Math.round(kg * 10) / 10;
      return Number.isInteger(shown) ? String(shown) : shown.toFixed(1);
    },
    [gym.weightUnit],
  );

  const lastSessionShort = useMemo(() => {
    if (!selected) return null;
    const prev = performance[selected.exercise.id]?.bestSet;
    if (!prev?.weight) return null;
    return `Ant: ${displayKg(prev.weight)}×${prev.reps}`;
  }, [selected, performance, displayKg]);

  const smartExercise = (
    selectedCatalogExercise
      ? {
        ...selectedCatalogExercise,
        equipment_id: selectedCatalogExercise.effectiveEquipmentId,
      }
      : selected?.exercise
  ) as (Exercise & {
    equipment_id?: string;
    station_key?: Parameters<typeof getLoadBreakdownHint>[1];
    movement_pattern?: string;
    image?: string;
    effectiveEquipmentId?: string;
    effectiveEquipmentName?: string;
    effectiveGifUrl?: string;
    effectiveImageUrl?: string;
  }) | undefined;

  /**
   * Whether the movement carries no external load at all.
   *
   * A push-up, a plank or a pull-up has no number to estimate: the smart load
   * would otherwise turn "body weight" into 9.75 kg and the athlete would load a
   * bar for an exercise that never had one. The rule lives in the engine, so the
   * estimate and the screen can never disagree about what is bodyweight.
   */
  const isBodyweightSelected = useMemo(() => {
    if (!selected) return false;
    return isBodyweightExercise({
      equipment_id: smartExercise?.equipment_id ?? smartExercise?.effectiveEquipmentId,
      equipment: smartExercise?.equipment ?? selected.exercise.equipment,
      name: smartExercise?.name ?? selected.exercise.name,
      name_es: smartExercise?.name_es ?? selected.exercise.name_es,
      movement_pattern: smartExercise?.movement_pattern,
    });
  }, [selected, smartExercise]);

  const smartLoad = useMemo(() => {
    if (!selected) return null;
    const history = performance[selected.exercise.id]?.bestSet;
    if (isBodyweightSelected) {
      return estimateSmartLoad({ mode: "bodyweight", targetReps: 15 });
    }
    return estimateSmartLoad({
      mode: history ? "overload" : "biometric_day_0",
      weightKg: history?.weight ?? Number(selected.sets.find((set) => set.kind === "normal")?.weight ?? 0),
      reps: history?.reps ?? undefined,
      targetReps: Number(selected.sets.find((set) => set.kind === "normal")?.reps ?? 8) || 8,
      weightHistory: history?.weight != null && history.reps != null
        ? [{ weightKg: history.weight, reps: history.reps, completed: true }]
        : [],
      targetStation: smartExercise?.station_key,
      movementPattern: smartExercise?.movement_pattern,
      experienceLevel: "beginner",
    });
  }, [
    performance,
    selected,
    selectedCatalogExercise,
    isBodyweightSelected,
    smartExercise?.movement_pattern,
    smartExercise?.station_key,
  ]);

  /**
   * How this implement is written down: per hand on a dumbbell, per side on a
   * bar, as a pin on a stack.
   *
   * One classification, three consumers -- the increment, the breakdown line
   * and the rank family -- so the card can never say "2.5 kg" on a movement
   * whose smallest jump is 2, or "Barra 60 kg" for a cable.
   */
  const smartCategory = useMemo<EquipmentCategory>(() => classifyEquipmentCategory({
    equipment_id: smartExercise?.equipment_id ?? smartExercise?.effectiveEquipmentId,
    equipment: smartExercise?.equipment ?? selected?.exercise.equipment,
    station: smartExercise?.station_key,
    isBodyweight: isBodyweightSelected,
  }), [smartExercise, selected, isBodyweightSelected]);

  const smartEquipmentLabel = useMemo(() => {
    const label = smartExercise?.effectiveEquipmentName ?? smartExercise?.equipment_name ?? smartExercise?.equipment ?? "";
    return cleanEquipmentLabel(label) || null;
  }, [smartExercise]);

  /** "Mancuerna 12.5kg por mano · 25kg total", or the bodyweight line. */
  const loadHint = useMemo(() => {
    if (!smartLoad) return null;
    return getLoadBreakdownHint(
      smartLoad.weightKg,
      smartExercise?.station_key ?? "free_weight_area",
      smartExercise?.equipment,
      smartCategory,
    );
  }, [smartLoad, smartExercise, smartCategory]);

  /**
   * The ramp that prepares this load.
   *
   * Sizing it here, once, is what lets both the offer in the card and the modal
   * agree on how many touches the lift needs: the athlete is never shown a
   * warm-up the engine would not have prescribed.
   */
  const warmupRamp = useMemo(() => {
    if (!smartLoad || isBodyweightSelected) return [];
    return generateWarmupRamp({
      workingWeightKg: smartLoad.weightKg,
      targetReps: smartLoad.suggestedReps,
      category: smartCategory,
      musclePreviouslyWorked: selected?.sets.some((set) => set.completed) ?? false,
    });
  }, [smartLoad, smartCategory, selected, isBodyweightSelected]);

  const stationAlternatives = useMemo<StationAlternative[]>(() => {
    if (!selected || !smartExercise || !smartLoad) return [];
    return findStationAlternatives(smartExercise, catalog, smartLoad.weightKg);
  }, [catalog, selected, smartExercise, smartLoad]);

  /**
   * Where the athlete stands on this movement.
   *
   * The rank is relative to their own bodyweight, so the number the sheet
   * promises ("27.5 × 8") is one their body can actually produce. It is read
   * from the best set they have logged here, and re-derived after every set the
   * engine learns from.
   */
  const exerciseRank = useMemo<ExerciseRankResult>(() => {
    if (!selected) {
      return computeExerciseRank({ exerciseId: "", weightKg: 0, reps: 0, bodyWeightKg: profile?.weight_kg ?? undefined });
    }
    const best = performance[selected.exercise.id]?.bestSet;
    const lastSet = [...selected.sets]
      .reverse()
      .find((set) => toNumber(set.weight) !== null && toNumber(set.reps) !== null);
    const weightKg = best?.weight ?? toNumber(lastSet?.weight ?? "") ?? smartLoad?.weightKg ?? 0;
    const reps = best?.reps ?? toNumber(lastSet?.reps ?? "") ?? smartLoad?.suggestedReps ?? 8;
    const targetReps = Number(selected.sets.find((set) => set.kind === "normal")?.reps ?? 0) || reps;
    return computeExerciseRank({
      exerciseId: selected.exercise.id,
      weightKg,
      reps,
      bodyWeightKg: profile?.weight_kg ?? undefined,
      isBodyweight: isBodyweightSelected,
      movementPattern: smartExercise?.movement_pattern ?? null,
      targetReps,
      equipment: smartExercise?.equipment,
      equipmentId: smartExercise?.equipment_id ?? smartExercise?.effectiveEquipmentId,
      station: smartExercise?.station_key,
      category: smartCategory,
    });
  }, [selected, performance, smartLoad, profile?.weight_kg, isBodyweightSelected, smartExercise?.movement_pattern, smartExercise?.station_key, smartExercise?.equipment, smartExercise?.equipment_id, smartExercise?.effectiveEquipmentId, smartCategory, strengthRevision]);

  /** The first set still waiting for a check mark, as the athlete counts them. */
  const nextPendingSetNumber = useMemo(() => {
    if (!selected) return 1;
    const index = selected.sets.findIndex((set) => !set.completed);
    return index === -1 ? selected.sets.length : index + 1;
  }, [selected]);

  /** Whether the athlete has ever logged this movement, here or on another device. */
  const hasExerciseHistory = useMemo(() => {
    if (!selected) return false;
    if (performance[selected.exercise.id]?.bestSet) return true;
    return readExerciseBest(loadStrengthModel(), selected.exercise.id) > 0;
  }, [selected, performance, strengthRevision]);

  /** What a cold exercise would be loaded with, said out loud in the modal. */
  const coldStartPreview = useMemo(() => {
    if (!selected || !smartExercise || hasExerciseHistory) return null;
    const targetReps = Number(selected.sets.find((set) => set.kind === "normal")?.reps ?? 0) || 8;
    return inferColdStartLoad({
      exerciseId: selected.exercise.id,
      movementPattern: smartExercise.movement_pattern ?? null,
      bodyPart: selected.exercise.body_part,
      equipment: smartExercise.equipment,
      equipmentId: smartExercise.equipment_id ?? null,
      station: smartExercise.station_key,
      bodyWeightKg: profile?.weight_kg ?? undefined,
      targetReps,
      isBodyweight: isBodyweightSelected,
      siblingExerciseIds: stationAlternatives.map((alternative) => alternative.exercise.id),
    });
  }, [selected, smartExercise, hasExerciseHistory, profile?.weight_kg, isBodyweightSelected, stationAlternatives]);

  function patchEntry(
    itemKey: string,
    setIndex: number,
    patch: (entry: SetEntry) => SetEntry,
  ) {
    setItems((prev) =>
      prev.map((item) =>
        item.key !== itemKey
          ? item
          : { ...item, sets: item.sets.map((s, i) => (i === setIndex ? patch(s) : s)) },
      ),
    );
  }

  function updateSet(itemKey: string, setIndex: number, entry: SetEntry) {
    patchEntry(itemKey, setIndex, () => entry);
    if (!entry.completed) return;
    if (entry.kind === "normal" && calibrationSetIndex === null) {
      setCalibrationSetIndex(setIndex);
    }
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate([40, 60, 80]);
    }
    /*
     * The engine learns from the set that was just done.
     *
     * This is the moment the athlete tells the truth about the load: the set is
     * finished, the number is real. Recording it here (and not when the session
     * ends) is what lets the next set be adjusted, and what lets a movement the
     * athlete has never logged be loaded from a sibling they have.
     */
    const item = items.find((candidate) => candidate.key === itemKey);
    const weightKg = toNumber(entry.weight) ?? 0;
    const reps = toNumber(entry.reps) ?? 0;
    if (item && weightKg > 0 && reps > 0) {
      const currentE1rm = Math.round(epley(weightKg, reps));
      const prevBest = performance[item.exercise.id]?.bestSet;
      const prevBestE1rm =
        prevBest?.weight != null &&
        prevBest?.reps != null &&
        prevBest.weight > 0 &&
        prevBest.reps > 0
          ? Math.round(epley(prevBest.weight, prevBest.reps))
          : 0;
      const currentSessionPr = sessionPrByExercise[item.exercise.id]?.e1rmKg ?? 0;
      if (currentE1rm > Math.max(prevBestE1rm, currentSessionPr)) {
        setSessionPrByExercise((prev) => ({
          ...prev,
          [item.exercise.id]: { e1rmKg: currentE1rm, weightKg, reps },
        }));
      }
      const targetReps = Number(item.sets.find((set) => set.kind === "normal")?.reps ?? 0) || reps;
      recordSetAndTrainEngine({
        exerciseId: item.exercise.id,
        movementPattern: smartExercise?.movement_pattern ?? null,
        bodyPart: item.exercise.body_part,
        weightKg,
        reps,
        rpe: toNumber(entry.rpe),
        targetReps,
        isBodyweight: isBodyweightExercise({
          equipment_id: smartExercise?.equipment_id ?? item.exercise.equipment_id,
          equipment: smartExercise?.equipment ?? item.exercise.equipment,
          name: item.exercise.name,
          name_es: item.exercise.name_es,
          movement_pattern: smartExercise?.movement_pattern,
        }),
      });
      setStrengthRevision((revision) => revision + 1);
    }
    const setKind = entry.kind === "drop" ? "dropset" : entry.kind;
    const smartRest = recommendSmartRest({
      name: item?.exercise.name,
      name_es: item?.exercise.name_es,
      target: item?.exercise.target,
      bodyPart: item?.exercise.body_part,
      equipment: smartExercise?.equipment ?? item?.exercise.equipment,
      equipment_id: smartExercise?.equipment_id ?? item?.exercise.equipment_id,
      movement_pattern: smartExercise?.movement_pattern,
      setType: setKind,
    });
    const routineRest = items.find((i) => i.key === itemKey)?.restSeconds;
    const baseSmartOrRoutine = routineRest ?? smartRest.betweenSetsSeconds;
    const configuredRest = loadRestSeconds(itemKey, baseSmartOrRoutine);
    const adaptiveFloor = getAdaptiveRestSeconds(
      setKind,
      smartExercise?.movement_pattern,
    );
    const restSeconds =
      routineRest !== undefined ||
      smartRest.modality === "unilateral" ||
      smartRest.region === "core"
        ? configuredRest
        : Math.max(configuredRest, adaptiveFloor);
    setRestPreset(restSeconds);
    startRest(restSeconds, {
      exerciseKey: itemKey,
      exerciseName: item ? cleanExerciseName(getExerciseDisplayName(item.exercise)) : undefined,
      smartRecommendation: smartRest,
    });
    advanceToSupersetPartner(itemKey);
    /*
     * Auto-advance: the last set of an exercise is the athlete's cue to move
     * on. The rotation above already handles supersets, where the next stop is
     * the partner; for a plain session the next stop is the next exercise that
     * still has work. Nothing moves while work is left on this one.
     */
    if (item && item.sets.every((set, at) => at === setIndex || set.completed)) {
      const nextIndex = nextIncompleteExerciseIndex(items, itemKey);
      if (nextIndex !== -1) setSelectedKey(items[nextIndex].key);
    }
  }

  function applySmartLoad() {
    if (!selected || !smartLoad) return;
    applyLoad(smartLoad.weightKg, smartLoad.suggestedReps);
  }

  /** Writes a load the athlete chose into every set still waiting. */
  function applyLoad(weightKg: number, reps: number) {
    if (!selected) return;
    setItems((current) => current.map((item) => item.key !== selected.key ? item : {
      ...item,
      sets: item.sets.map((set) => set.kind === "normal" && !set.completed
        ? { ...set, weight: String(weightKg), reps: String(reps) }
        : set),
    }));
    setAppliedSmartLoadByExercise((current) => ({
      ...current,
      [selected.exercise.id]: { weightKg, reps },
    }));
    // A load the athlete accepted is a measurement too: the model keeps it, so a
    // cold movement stops being cold the moment it is trained.
    recordSetAndTrainEngine({
      exerciseId: selected.exercise.id,
      movementPattern: smartExercise?.movement_pattern ?? null,
      bodyPart: selected.exercise.body_part,
      weightKg,
      reps,
      rpe: null,
      targetReps: reps,
      isBodyweight: isBodyweightSelected,
    });
    setStrengthRevision((revision) => revision + 1);
  }

  /**
   * Calibrate a cold exercise from the modal: the engine turns the one tap into
   * a load, and the athlete can still edit the number before accepting it.
   */
  const calibrateColdStart = useCallback(
    (preset: CalibrationPresetId): { weightKg: number; reps: number } | null => {
      if (!selected || !smartExercise) return null;
      const targetReps = Number(selected.sets.find((set) => set.kind === "normal")?.reps ?? 0) || 8;
      const cold = inferColdStartLoad({
        exerciseId: selected.exercise.id,
        movementPattern: smartExercise.movement_pattern ?? null,
        bodyPart: selected.exercise.body_part,
        equipment: smartExercise.equipment,
        equipmentId: smartExercise.equipment_id ?? null,
        station: smartExercise.station_key,
        bodyWeightKg: profile?.weight_kg ?? undefined,
        targetReps,
        isBodyweight: isBodyweightSelected,
        preset,
      });
      recordSetAndTrainEngine({
        exerciseId: selected.exercise.id,
        movementPattern: smartExercise.movement_pattern ?? null,
        bodyPart: selected.exercise.body_part,
        weightKg: cold.weightKg,
        reps: cold.suggestedReps,
        rpe: null,
        targetReps,
        isBodyweight: isBodyweightSelected,
      });
      setStrengthRevision((revision) => revision + 1);
      return { weightKg: cold.weightKg, reps: cold.suggestedReps };
    },
    [selected, smartExercise, profile?.weight_kg, isBodyweightSelected],
  );

  /** Writes the rank's target into the next set that is still waiting. */
  function applyRankTarget(weightKg: number, reps: number) {
    if (!selected) return;
    const index = selected.sets.findIndex((set) => !set.completed);
    if (index === -1) return;
    setItems((current) => current.map((item) => {
      if (item.key !== selected.key) return item;
      return {
        ...item,
        sets: item.sets.map((set, i) => (i === index ? { ...set, weight: String(weightKg), reps: String(reps) } : set)),
      };
    }));
  }

  /** Changes the rest the athlete rests between sets, running or not. */
  function adjustRestPreset(seconds: number) {
    const next = Math.max(15, Math.min(600, Math.round(seconds)));
    setRestPreset(next);
    if (rest) startRest(next);
  }

  function insertSmartWarmups() {
    if (!selected || !smartLoad) return;
    insertWarmupRamp(
      generateSmartWarmupSets(smartLoad.weightKg, selected.sets.some((set) => set.completed)),
    );
  }

  /** Puts a ramp in front of the work sets, renumbering what follows. */
  function insertWarmupRamp(ramp: readonly { weightKg: number; reps: number }[]) {
    if (!selected || ramp.length === 0) return;
    setItems((current) => current.map((item) => item.key !== selected.key ? item : {
      ...item,
      sets: [
        ...ramp.map((set, index) => newSessionSet({
          kind: "warmup",
          weight: String(set.weightKg),
          reps: String(set.reps),
        }, index)),
        ...item.sets.map((set, index) => ({ ...set, set_number: index + ramp.length + 1 })),
      ],
    }));
  }

  /**
   * The modal's accept: the load, and -- only if the athlete asked for it --
   * the ramp that gets them there.
   */
  function applySmartLoadFromModal(next: {
    weightKg: number;
    reps: number;
    includeWarmup?: boolean;
    customWarmupSets?: readonly { weightKg: number; reps: number }[];
    onlyInsertWarmup?: boolean;
  }) {
    if (!selected) return;
    if (!next.onlyInsertWarmup) {
      applyLoad(next.weightKg, next.reps);
    }
    if (next.customWarmupSets && next.customWarmupSets.length > 0) {
      insertWarmupRamp(next.customWarmupSets);
    } else if (next.includeWarmup) {
      insertWarmupRamp(warmupRamp);
    }
  }

  function applyCalibration(feedback: "too_light" | "perfect" | "too_heavy") {
    if (!selected || calibrationSetIndex === null) return;
    setItems((current) => current.map((item) => {
      if (item.key !== selected.key) return item;
      const calibrated = calibratePendingSets(
        item.sets.map((set) => ({ ...set, weightKg: Number(set.weight) || 0 })),
        calibrationSetIndex,
        feedback,
      );
      return { ...item, sets: calibrated.map(({ weightKg, ...set }) => ({ ...set, weight: String(weightKg) })) };
    }));
    setCalibrationSetIndex(null);
  }

  function replaceWithAlternative(alternative: StationAlternative) {
    if (!selected) return;
    const exercise = alternative.exercise;
    const resolved = resolveCatalogExerciseWithOverrides(exercise.id, catalog);
    const loggerExercise: Exercise = {
      id: exercise.id,
      name: exercise.name,
      name_es: resolved?.nameEs ?? exercise.customNameEs ?? exercise.name_es ?? null,
      body_part: exercise.body_part,
      target: exercise.target,
      equipment: exercise.equipment,
      gif_url: resolved?.effectiveGifUrl ?? exercise.gif_url ?? "",
      instructions: [],
      is_active: true,
      is_hidden: false,
    };
    setItems((current) => current.map((item) => item.key !== selected.key ? item : {
      ...item,
      exercise: loggerExercise,
      sets: item.sets.map((set) => set.kind === "normal" && !set.completed
        ? { ...set, weight: String(alternative.suggestedWeightKg) }
        : set),
    }));
    setSubstituteOpen(false);
  }

  function advanceToSupersetPartner(itemKey: string) {
    const current = itemsRef.current;
    const index = current.findIndex((item) => item.key === itemKey);
    if (index === -1) return;

    const target = getNextSupersetTargetIndex(current, index);
    if (target === -1) return;

    const partner = current[target];
    if (!partner) return;
    if (!partner.sets.some((set) => !set.completed)) return;

    setSelectedKey(partner.key);
  }

  function addSet(itemKey: string) {
    setItems((prev) =>
      prev.map((item) =>
        item.key !== itemKey
          ? item
          : { ...item, sets: [...item.sets, newSessionSet({ kind: "normal" }, item.sets.length)] },
      ),
    );
  }

  useEffect(() => {
    const pending = warmups[0];
    if (!pending) return;

    setItems((prev) => {
      const index = prev.findIndex((item) => item.exercise.name === pending.exerciseName);
      if (index === -1) return prev;

      const item = prev[index];
      const warmupEntries: DraftExercise["sets"] = pending.weights.map((weight, position) =>
        newSessionSet(
          { kind: "warmup", weight: String(weight) },
          item.sets.length + position,
        ),
      );

      return prev.map((entry, at) =>
        at === index ? { ...entry, sets: [...warmupEntries, ...entry.sets] } : entry,
      );
    });

    resolveWarmup(pending.id);
  }, [warmups, resolveWarmup]);

  function removeSet(itemKey: string, setIndex: number) {
    const target = itemsRef.current.find((i) => i.key === itemKey)?.sets[setIndex];
    if (!target) return;

    setItems((prev) =>
      prev.map((item) =>
        item.key !== itemKey
          ? item
          : { ...item, sets: item.sets.filter((_, i) => i !== setIndex) },
      ),
    );
    setPendingRemoval({ itemKey, index: setIndex, entry: target });
  }

  function undoRemoveSet() {
    const pending = pendingRemoval;
    if (!pending) return;
    setItems((prev) =>
      prev.map((item) => {
        if (item.key !== pending.itemKey) return item;
        const at = Math.min(pending.index, item.sets.length);
        const sets = [...item.sets];
        sets.splice(at, 0, pending.entry);
        return { ...item, sets };
      }),
    );
    setPendingRemoval(null);
  }

  async function finish() {
    const currentItems = itemsRef.current;
    const currentNotes = notesRef.current;

    finalizedRef.current = true;

    const payload: FinalizePayload = {
      logId: activeLogId,
      userId,
      routineId,
      startedAt,
      completedAt: new Date().toISOString(),
      notes: currentNotes.trim() === "" ? null : currentNotes,
      sets: currentItems.flatMap((item) =>
        item.sets
          .map((set, index) => ({ set, index }))
          .filter(({ set }) => set.completed)
          .map(({ set, index }) => ({
            exercise_id: item.exercise.id,
            set_number: index + 1,
            weight: toNumber(set.weight),
            reps: toNumber(set.reps),
            rpe: toNumber(set.rpe),
            is_warmup: toWarmupColumn(set.kind),
            notes: set.notes ?? null,
          })),
      ),
    };

    await saveDraft({
      logId: activeLogId,
      userId,
      routineId,
      routineTitle,
      startedAt,
      items: currentItems,
      notes: currentNotes,
      finalized: true,
      updatedAt: Date.now(),
    });

    void queueAndSync(payload);
    void deleteDraft(activeLogId);
    /*
     * The session is deliberately NOT ended here. Ending it clears
     * `ActiveSessionContext`, and `TrainView` answers a null session with
     * `<HomeView />` -- which unmounts this screen, and the summary with it,
     * before a single row of it can paint. The athlete finished the work; the
     * summary is the receipt. The session ends when the summary is saved or
     * dismissed (`ActiveWorkoutView`), not when the last set is logged.
     */
    onFinished(currentItems);
  }

  const showSummary = !started && !recoverableDraft && items.length > 0;

  return (
    <div
      className="w-full max-w-full overflow-x-hidden"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 0,
        flex: 1,
        overflowY: "auto",
        overflowX: "hidden",
        background: SURFACE.base,
        paddingBottom: 144, // pb-36 = 144px for BottomNav + Cronos IA clearance
      }}
    >
      {recoverableDraft && (
        <div
          style={{
            margin: SPACE.md,
            padding: SPACE.md,
            borderRadius: RADIUS.control,
            border: `1px solid ${ACCENT.border}`,
            background: ACCENT.subtle,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: SPACE.md,
          }}
        >
          <div>
            <p style={{ margin: 0, fontSize: TYPE.body.size, color: TEXT.primary }}>
              Encontramos una sesión sin terminar ({recoverableDraft.routineTitle})
            </p>
            <p style={{ margin: 0, fontSize: TYPE.caption.size, color: TEXT.secondary }}>
              {recoverableDraft.items.reduce(
                (n: number, i: DraftExercise) =>
                  n + i.sets.filter((s) => s.completed).length,
                0,
              )}{" "}
              series guardadas en este dispositivo.
            </p>
          </div>
          <div style={{ display: "flex", gap: SPACE.sm }}>
            <GlassButton variant="ghost" onClick={discardRecovered} style={{ minHeight: 36 }}>
              Descartar
            </GlassButton>
            <GlassButton variant="primary" onClick={restoreRecovered} style={{ minHeight: 36 }}>
              Recuperar
            </GlassButton>
          </div>
        </div>
      )}

      {notice && (
        <div
          role="status"
          aria-live="polite"
          style={{
            margin: `0 ${SPACE.md}px ${SPACE.md}px`,
            padding: `${SPACE.sm}px ${SPACE.md}px`,
            borderRadius: RADIUS.control,
            border: `1px solid ${GLASS.border}`,
            background: SOLID.popover,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: SPACE.md,
          }}
        >
          <span style={{ fontSize: TYPE.body.size, color: TEXT.primary }}>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Cerrar aviso"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 36,
              height: 36,
              borderRadius: "50%",
              border: "none",
              background: "transparent",
              color: TEXT.tertiary,
              cursor: "pointer",
            }}
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      )}

      {pendingRemoval && (
        <UndoBanner
          setNumber={pendingRemoval.index + 1}
          onUndo={undoRemoveSet}
          onDismiss={() => setPendingRemoval(null)}
        />
      )}

      {sync.error && !sync.online && (
        <p style={{ margin: `0 ${SPACE.md}px ${SPACE.md}px`, fontSize: TYPE.caption.size, color: TEXT.tertiary }}>
          Sin conexión: tu sesión está segura en este dispositivo y se sincronizará automáticamente.
        </p>
      )}

      {gearOpen && (
        <div
          role="dialog"
          aria-label={GYM_LABELS.title}
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: Z_INDEX.modal,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: SCRIM.modal,
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          <div
            style={{
              padding: "24px",
              borderRadius: 24,
              background: SCRIM.overlay,
              backdropFilter: GLASS.blurPlain20,
              WebkitBackdropFilter: GLASS.blurPlain20,
              border: "1px solid rgba(255, 255, 255, 0.1)",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.8)",
              maxWidth: 480,
              width: "90vw",
            }}
          >
            <h3
              style={{
                margin: `0 0 ${SPACE.md}`,
                fontSize: TYPE.title2.size,
                fontWeight: TYPE.title2.weight,
                color: TEXT.primary,
              }}
            >
              Configuración del gimnasio
            </h3>
            <div
              style={{
                display: "flex",
                background: GLASS.fill,
                borderRadius: RADIUS.control,
                border: `1px solid ${GLASS.border}`,
                padding: "4px",
                gap: "4px",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  gym.updateSettings({ weightUnit: "kg" });
                  setGearOpen(false);
                }}
                style={{
                  flex: 1,
                  minHeight: MOTION.minTouchTarget,
                  padding: `8px 16px`,
                  borderRadius: RADIUS.control,
                  border: gym.weightUnit === "kg" ? `1px solid ${ACCENT.border}` : "1px solid transparent",
                  background: gym.weightUnit === "kg" ? ACCENT.subtle : "transparent",
                  color: gym.weightUnit === "kg" ? ACCENT.text : TEXT.primary,
                  fontSize: TYPE.body.size,
                  fontWeight: gym.weightUnit === "kg" ? 600 : 500,
                  cursor: "pointer",
                  transition: MOTION.transitionStandard,
                }}
              >
                Kilogramos (kg)
              </button>
              <button
                type="button"
                onClick={() => {
                  gym.updateSettings({ weightUnit: "lb" });
                  setGearOpen(false);
                }}
                style={{
                  flex: 1,
                  minHeight: MOTION.minTouchTarget,
                  padding: `8px 16px`,
                  borderRadius: RADIUS.control,
                  border: gym.weightUnit === "lb" ? `1px solid ${ACCENT.border}` : "1px solid transparent",
                  background: gym.weightUnit === "lb" ? ACCENT.subtle : "transparent",
                  color: gym.weightUnit === "lb" ? ACCENT.text : TEXT.primary,
                  fontSize: TYPE.body.size,
                  fontWeight: gym.weightUnit === "lb" ? 600 : 500,
                  cursor: "pointer",
                  transition: MOTION.transitionStandard,
                }}
              >
                Libras (lb)
              </button>
            </div>
          </div>
        </div>
      )}

      {showSummary ? (
        <WorkoutPreStartView
          routineTitle={routineTitle}
          planned={planned}
          onStart={() => setStarted(true)}
          onExit={onExit ?? end}
        />
      ) : items.length === 0 ? (
        <section
          role="region"
          aria-label="Estado vacío"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: SPACE.md,
            padding: SPACE.card,
            borderRadius: RADIUS.surface,
            border: `1px dashed ${GLASS.borderStrong}`,
            background: SOLID.card,
            textAlign: "center",
            maxWidth: "560px",
            margin: `${SPACE.xl}px auto`,
          }}
        >
          <X aria-hidden="true" size={32} style={{ color: TEXT.disabled }} />
          <p style={{ margin: 0, fontSize: TYPE.body.size, color: TEXT.tertiary }}>
            Esta sesión todavía no tiene ejercicios.
          </p>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: SPACE.sm,
              minHeight: MOTION.minTouchTarget,
              padding: `${SPACE.sm}px ${SPACE.lg}px`,
              borderRadius: RADIUS.control,
              border: `1px solid ${ACCENT.base}`,
              background: ACCENT.base,
              color: TEXT.onAccent,
              fontSize: TYPE.subhead.size,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Agregar ejercicio
          </button>
        </section>
      ) : (
        <>
          <SessionHeader
            exerciseLabel={
              selectedIndex >= 0 ? `Ejercicio ${selectedIndex + 1} de ${items.length}` : ""
            }
            superset={selectedSuperset}
            startedAt={session?.startedAt ?? null}
            onGear={() => setGearOpen(true)}
            onTerminate={finish}
          />

          {!todayCheckin && !checkinDismissed && (
            <div style={{ padding: `${SPACE.sm}px ${SPACE.md}px 0` }}>
              <PreWorkoutCheckinCard
                onSave={logCheckin}
                onDismiss={() => setCheckinDismissed(true)}
                onApplyRecoveryLoad={() => {
                  const barKg =
                    gym.barType === "custom" ? gym.customBarKg : BAR_WEIGHTS[gym.barType];
                  setItems((prev) =>
                    prev.map((item) => ({
                      ...item,
                      sets: item.sets.map((s) => {
                        if (s.completed || s.kind === "warmup") return s;
                        const w = toNumber(s.weight);
                        if (w == null || w <= 0) return s;
                        const scaled = nearestLoadable(w * 0.9, barKg, gym.inventory);
                        return { ...s, weight: String(scaled > 0 ? scaled : Math.round(w * 0.9 * 2) / 2) };
                      }),
                    })),
                  );
                  setNotice("Descarga del 10% aplicada según tu check-in de hoy.");
                }}
              />
            </div>
          )}

          {carouselItems.length > 0 && (
            <div className="mx-auto mt-3 flex w-full max-w-md items-center justify-center px-4 pb-2">
              <ExerciseCarousel
                items={carouselItems}
                selectedKey={selectedKey ?? null}
                onSelect={focusExercise}
                onReorder={handleReorder}
                onAdd={handleAddExercise}
              />
            </div>
          )}

          {selected && (
            <>
              {/*
                The demonstration, where it happens and the dock come first: the
                athlete sees the movement, then what to do, and the set table
                follows without scrolling.
              */}
              <ExerciseStage
                exercise={selected.exercise}
                completedSets={selected.sets.filter((s) => s.completed).length}
                totalSets={selected.sets.length}
                lastSessionShort={lastSessionShort}
                equipment={equipmentForSelected}
                locationLabel={locationLabel}
                guidesOpen={smartGuidesOpen}
                onToggleGuides={() => setSmartGuidesOpen((open) => !open)}
                onDemo={() => setIsDemoOpen(true)}
                onAdvance={() => setIsAvanceOpen(true)}
                onChangeExercise={() => setSubstituteOpen((open) => !open)}
                onAdjustEquipment={() => {
                  setSelectedEquipment(
                    equipmentForSelected ?? equipmentSuggestion.primary ?? {
                      id: "default",
                      name: "Sin equipo",
                      category: "Accesorio",
                      views: [],
                      exerciseTypes: [],
                    },
                  );
                  setEquipmentSheetOpen(true);
                }}
                rank={exerciseRank}
                onOpenRank={() => setRankSheetOpen(true)}
                restSeconds={restPreset}
                onAdjustRest={() => adjustRestPreset(restPreset >= 180 ? 90 : restPreset + 30)}
                onAddWarmup={insertSmartWarmups}
                prBadge={sessionPrByExercise[selected.exercise.id] ?? null}
                onOpenBiomechanics={() => setBiomechanicsModalOpen(true)}
                biomechanicsNote={biomechanicsByExercise[selected.exercise.id] ?? null}
                onOpenPlates={() => {
                  const pendingIdx = selected.sets.findIndex((s) => !s.completed);
                  const fallbackIdx = pendingIdx >= 0 ? pendingIdx : 0;
                  const targetSet = selected.sets[fallbackIdx];
                  const initialW =
                    (targetSet ? toNumber(targetSet.weight) : null) ?? smartLoad?.weightKg ?? 60;
                  setPlateCalc({
                    open: true,
                    setIndex: targetSet ? fallbackIdx : null,
                    initialWeightKg: initialW,
                  });
                }}
                onRequestSpot={() => {
                  const station = equipmentForSelected?.name || locationLabel;
                  const exName = cleanExerciseName(getExerciseDisplayName(selected.exercise));
                  void requestFloorSpot({
                    userId,
                    athleteName: profile?.display_name || "Atleta Cronos",
                    exerciseName: exName,
                    stationLabel: station,
                  }).then(() => {
                    setNotice("¡Alerta enviada al coach en piso! Ya va en camino.");
                  });
                }}
                onReportMachine={() => setMachineReportOpen((prev) => !prev)}
              />

              {machineReportOpen && (
                <section
                  className="mx-auto w-full max-w-[560px] space-y-2 rounded-2xl border border-amber-500/30 bg-[#1C1C1E] p-3.5"
                  aria-label="Reportar falla de máquina"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-amber-300">
                      Reportar falla en {equipmentForSelected?.name ?? locationLabel}
                    </span>
                    <button
                      type="button"
                      onClick={() => setMachineReportOpen(false)}
                      className="text-xs text-neutral-400"
                    >
                      Cerrar
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {["Cable o polea dañada", "Asiento o pin atorado", "Falta maneral / discos", "Ruido o daño"].map((reason) => (
                      <button
                        key={reason}
                        type="button"
                        onClick={() => {
                          const eqId =
                            equipmentForSelected?.id ??
                            selectedCatalogExercise?.effectiveEquipmentId ??
                            "GENERAL";
                          const eqName = equipmentForSelected?.name ?? locationLabel;
                          void submitMachineReport({
                            equipmentId: eqId,
                            equipmentName: eqName,
                            reportedBy: userId,
                            reason,
                          }).then(() => {
                            setMachineReportOpen(false);
                            setNotice(`Reporte enviado para ${eqName}. ¡Gracias!`);
                          });
                        }}
                        className="min-h-10 rounded-full border border-white/10 bg-black/50 px-3 text-xs font-semibold text-white active:scale-95"
                      >
                        {reason}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {substituteOpen && (
                <section
                  className="mx-auto w-full max-w-[560px] space-y-2 bg-black px-4 py-3"
                  aria-label="Alternativas biomecánicas"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-white">Mismo músculo, otra máquina</h3>
                    <button type="button" className="min-h-11 px-3 text-sm text-neutral-400" onClick={() => setSubstituteOpen(false)}>Cerrar</button>
                  </div>
                  {stationAlternatives.map((alternative) => (
                    <button
                      key={alternative.exercise.id}
                      type="button"
                      className="flex min-h-11 w-full items-center gap-3 rounded-xl bg-neutral-900 p-3 text-left"
                      onClick={() => replaceWithAlternative(alternative)}
                    >
                      <img
                        src={alternative.exercise.image || alternative.exercise.gif_url || ""}
                        alt=""
                        className="h-11 w-11 rounded-lg object-cover"
                      />
                      <span className="min-w-0 flex-1">
                        <strong className="block truncate text-sm text-white">{alternative.displayName}</strong>
                        <span className="block truncate text-[11px] text-neutral-400">
                          {alternative.cleanEquipmentName || "Peso libre / Piso"}
                        </span>
                        <span className="block text-[11px] text-neutral-500">
                          {alternative.suggestedWeightKg > 0 ? `≈ ${alternative.suggestedWeightKg} kg` : "Sin carga externa"}
                        </span>
                      </span>
                    </button>
                  ))}
                  {stationAlternatives.length === 0 && (
                    <p className="text-sm text-neutral-400">
                      No hay otro ejercicio que entrene lo mismo con el equipo de este gym.
                    </p>
                  )}
                </section>
              )}

              {equipmentSheetOpen && selectedEquipment && (
                <EquipmentInspectionSheet
                  equipment={selectedEquipment}
                  alternatives={equipmentSuggestion.alternatives}
                  onClose={() => {
                    setEquipmentSheetOpen(false);
                    setSelectedEquipment(null);
                  }}
                />
              )}

              {/*
                Dynamic coaching bar: the engine's one recommendation for this
                exercise. It used to be a second block between the demo and the
                table, which pushed the first set below the fold on a phone held
                in one hand -- the table is what the athlete came for. The
                recommendation is still here, and still operable (apply, add
                warm-ups, swap the station); it is simply not chrome the athlete
                has to read past. Screen readers keep it in full.
              */}
              <div className="sr-only">
                {smartLoad && appliedSmartLoadByExercise[selected.exercise.id] ? (
                  <div className="mx-auto flex w-full max-w-md items-center gap-2 rounded-2xl border border-white/10 bg-neutral-900/90 px-3.5 py-2.5">
                    <span
                      aria-hidden="true"
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: ACCENT.base }}
                    />
                    <span className="min-w-0 flex-1 truncate font-mono text-xs font-semibold text-white">
                      ✓ Meta activa: {appliedSmartLoadByExercise[selected.exercise.id].weightKg} kg × {appliedSmartLoadByExercise[selected.exercise.id].reps}
                    </span>
                    <button type="button" className="min-h-11 shrink-0 rounded-full px-3 text-xs font-semibold text-neutral-200" onClick={insertSmartWarmups}>+ W</button>
                    <button type="button" aria-label="⇄ Ocupada" className="min-h-11 shrink-0 rounded-full px-3 text-xs text-neutral-300" onClick={() => setSubstituteOpen(true)}>Ocupada</button>
                  </div>
                ) : smartLoad ? (
                  <section
                    aria-label="Recomendación de carga"
                    className="mx-auto w-full max-w-md rounded-2xl border border-white/10 bg-neutral-900/90 px-3.5 py-2.5"
                  >
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-neutral-300">
                          <span
                            className="rounded-full px-2 py-0.5 text-[11px]"
                            style={
                              isBodyweightSelected
                                ? { background: STATUS.success.muted, color: STATUS.success.text }
                                : { background: ACCENT.subtle, color: ACCENT.text }
                            }
                          >
                            {isBodyweightSelected ? "Peso corporal" : "Subir carga"}
                          </span>
                          <span className="truncate">{smartExercise?.effectiveEquipmentName ?? "Equipo Cronos Gym"}</span>
                        </p>
                        <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
                          <span className="font-mono text-sm font-semibold text-white">
                            {isBodyweightSelected ? `Peso corporal × ${smartLoad.suggestedReps}` : `${smartLoad.weightKg} kg × ${smartLoad.suggestedReps}`}
                          </span>
                          <span className="font-mono text-[11px] text-neutral-400">
                            {isBodyweightSelected ? BODYWEIGHT_LOAD_HINT : loadHint}
                          </span>
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button type="button" className="min-h-11 rounded-full bg-white/10 px-3 text-xs font-semibold text-white" onClick={applySmartLoad}>Aplicar</button>
                        <button type="button" aria-label="+ Calentamiento (W)" title="+ Calentamiento (W)" className="min-h-11 rounded-full px-3 text-xs text-neutral-200" onClick={insertSmartWarmups}>+ W</button>
                        <button type="button" aria-label="Máquina ocupada" title="Máquina ocupada" className="min-h-11 rounded-full px-3 text-xs text-neutral-200" onClick={() => setSubstituteOpen(true)}>Ocupada</button>
                      </div>
                    </div>
                  </section>
                ) : null}
              </div>

          {selected.sets.length > 0 && (
                <div className="mx-auto w-full max-w-md px-4 pb-6">
              {smartGuidesOpen && (
                <div className="mb-3 space-y-1 rounded-xl bg-neutral-900 p-3 text-xs text-neutral-400">
                  <p>{SET_TYPE_GUIDES.warmup}</p><p>{SET_TYPE_GUIDES.normal}</p><p>{SET_TYPE_GUIDES.dropset}</p><p>{SET_TYPE_GUIDES.failure}</p>
                </div>
              )}
              {calibrationSetIndex !== null && (
                <div className="mb-3 flex flex-wrap gap-2 rounded-xl bg-neutral-900 p-3">
                  <button type="button" className="flex min-h-11 items-center gap-1.5 rounded-xl bg-neutral-800 px-3 text-xs text-white" onClick={() => applyCalibration("too_light")}>
                    <ArrowUp size={14} strokeWidth={2} aria-hidden="true" />
                    Muy ligero · +2.5kg
                  </button>
                  <button type="button" className="flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold" style={{ background: "#30D158", color: "#000" }} onClick={() => applyCalibration("perfect")}>
                    <Check size={14} strokeWidth={3} aria-hidden="true" />
                    Perfecto
                  </button>
                  <button type="button" className="flex min-h-11 items-center gap-1.5 rounded-xl bg-neutral-800 px-3 text-xs text-white" onClick={() => applyCalibration("too_heavy")}>
                    <ArrowDown size={14} strokeWidth={2} aria-hidden="true" />
                    Muy pesado · -2.5kg
                  </button>
                </div>
              )}
                  <div
                    style={{
                      borderRadius: 24,
                      padding: 14,
                      background: "#1C1C1E",
                      border: "1px solid rgba(255, 255, 255, 0.10)",
                      boxShadow: "none",
                    }}
                  >
                    {/* Table Header */}
                    <div className="mb-1 flex items-center justify-between gap-2 px-1">
                      <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-neutral-500">
                        Series
                      </span>
                      <button
                        type="button"
                        onClick={() => setOverloadOpen(true)}
                        aria-label="Sobrecarga progresiva inteligente"
                        title="Sobrecarga progresiva inteligente"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-neutral-800 text-white"
                      >
                        <Sparkles size={16} strokeWidth={2} aria-hidden="true" />
                      </button>
                    </div>
                    {/*
                      Six numbers and two 32px controls, sized so the row still
                      fits a 390px phone without the check and the remove
                      touching: the two flexible columns shrink first, the
                      controls never do.
                    */}
                    <div
                      className="grid grid-cols-[28px_1fr_1fr_44px] items-center gap-2.5 px-1.5 pb-1.5"
                      style={{
                        borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
                        marginBottom: 4,
                      }}
                    >
                      <div style={{ fontSize: "10px", fontWeight: 700, color: TEXT.tertiary, textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "center" }}>#</div>
                      <div style={{ fontSize: "10px", fontWeight: 700, color: TEXT.tertiary, textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "center" }}>KG/LB</div>
                      <div style={{ fontSize: "10px", fontWeight: 700, color: TEXT.tertiary, textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "center" }}>REPS</div>
                      <div style={{ fontSize: "10px", fontWeight: 700, color: TEXT.tertiary, textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "center" }}>✓</div>
                    </div>

                    {(() => {
                      const activeSetIdx = selected.sets.findIndex((s) => !s.completed);
                      return selected.sets.map((entry, index) => (
                        <SetTrackerTable
                          key={index}
                          index={index}
                          entry={entry}
                          isActiveSet={index === activeSetIdx}
                          hideRepeatedPrevious={Boolean(lastSessionShort) || index > 0}
                          previousKg={performance[selected.exercise.id]?.bestSet?.weight ?? null}
                          previousReps={performance[selected.exercise.id]?.bestSet?.reps ?? null}
                          formatWeight={displayKg}
                          overloadTarget={overload[selected.key] ?? null}
                          previousLabel={
                            performance[selected.exercise.id]?.bestSet?.weight != null &&
                            performance[selected.exercise.id]?.bestSet?.reps != null
                              ? `Repetir la última vez: ${displayKg(
                                  performance[selected.exercise.id]?.bestSet?.weight ?? 0,
                                )} kilos por ${performance[selected.exercise.id]?.bestSet?.reps ?? 0} repeticiones`
                              : undefined
                          }
                          onChange={(i, e) => updateSet(selected.key, i, e)}
                          onRemove={(i) => removeSet(selected.key, i)}
                          onOpenPlates={(setIdx, weightStr) => {
                            const w = toNumber(weightStr) ?? smartLoad?.weightKg ?? 60;
                            setPlateCalc({ open: true, setIndex: setIdx, initialWeightKg: w });
                          }}
                          onFillFromPrevious={(i: number) => {
                            const prev = performance[selected.exercise.id]?.bestSet;
                            if (prev?.weight != null && prev?.reps != null) {
                              updateSet(selected.key, i, {
                                ...entry,
                                weight: String(prev.weight),
                                reps: String(prev.reps),
                              });
                            }
                          }}
                          canRemove={true}
                          totalSets={selected.sets.length}
                        />
                      ));
                    })()}

                    {(() => {
                      const pendingIdx = selected.sets.findIndex((s) => !s.completed);
                      const pendingEntry = pendingIdx >= 0 ? selected.sets[pendingIdx] : null;
                      const prevBest = performance[selected.exercise.id]?.bestSet;
                      const prevSetInList = pendingIdx > 0 ? selected.sets[pendingIdx - 1] : null;
                      const matchSource =
                        pendingEntry && prevSetInList && (toNumber(prevSetInList.weight) != null || toNumber(prevSetInList.reps) != null)
                          ? { weight: prevSetInList.weight, reps: prevSetInList.reps }
                          : pendingEntry && prevBest?.weight != null && prevBest?.reps != null
                            ? { weight: String(prevBest.weight), reps: String(prevBest.reps) }
                            : null;
                      const nudgePendingWeight = (delta: number) => {
                        if (!pendingEntry || pendingIdx < 0) return;
                        const base = toNumber(pendingEntry.weight) ?? 0;
                        const nextWeight = Math.max(0, Math.round((base + delta) * 10) / 10);
                        updateSet(selected.key, pendingIdx, { ...pendingEntry, weight: String(nextWeight) });
                      };
                      const nudgePendingReps = (delta: number) => {
                        if (!pendingEntry || pendingIdx < 0) return;
                        const base = toNumber(pendingEntry.reps) ?? 0;
                        const nextReps = Math.max(1, Math.round(base + delta));
                        updateSet(selected.key, pendingIdx, { ...pendingEntry, reps: String(nextReps) });
                      };
                      return (
                        <div className="mt-3 space-y-2.5">
                          {pendingEntry && (
                            <div
                              className="grid w-full grid-cols-4 gap-1.5"
                              role="group"
                              aria-label="Ajuste rápido a una mano"
                            >
                              <button
                                type="button"
                                onClick={() => nudgePendingWeight(-2.5)}
                                className="inline-flex h-10 items-center justify-center gap-0.5 whitespace-nowrap rounded-xl border border-white/10 px-1 font-mono text-[11px] font-semibold tabular-nums text-white transition-transform duration-150 active:scale-[0.98]"
                                style={{ backgroundColor: "rgb(44, 44, 46)" }}
                              >
                                <Minus size={11} aria-hidden="true" />
                                2.5 kg
                              </button>
                              <button
                                type="button"
                                onClick={() => nudgePendingWeight(2.5)}
                                className="inline-flex h-10 items-center justify-center gap-0.5 whitespace-nowrap rounded-xl border border-white/10 px-1 font-mono text-[11px] font-semibold tabular-nums text-white transition-transform duration-150 active:scale-[0.98]"
                                style={{ backgroundColor: "rgb(44, 44, 46)" }}
                              >
                                <Plus size={11} aria-hidden="true" />
                                2.5 kg
                              </button>
                              <button
                                type="button"
                                onClick={() => nudgePendingReps(-1)}
                                className="inline-flex h-10 items-center justify-center gap-0.5 whitespace-nowrap rounded-xl border border-white/10 px-1 font-mono text-[11px] font-semibold tabular-nums text-white transition-transform duration-150 active:scale-[0.98]"
                                style={{ backgroundColor: "rgb(44, 44, 46)" }}
                              >
                                <Minus size={11} aria-hidden="true" />
                                1 rep
                              </button>
                              <button
                                type="button"
                                onClick={() => nudgePendingReps(1)}
                                className="inline-flex h-10 items-center justify-center gap-0.5 whitespace-nowrap rounded-xl border border-white/10 px-1 font-mono text-[11px] font-semibold tabular-nums text-white transition-transform duration-150 active:scale-[0.98]"
                                style={{ backgroundColor: "rgb(44, 44, 46)" }}
                              >
                                <Plus size={11} aria-hidden="true" />
                                1 rep
                              </button>
                            </div>
                          )}
                          <div className="flex items-center gap-2.5">
                            {matchSource && pendingEntry && pendingIdx >= 0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  updateSet(selected.key, pendingIdx, {
                                    ...pendingEntry,
                                    weight: matchSource.weight,
                                    reps: matchSource.reps,
                                  })
                                }
                                className="inline-flex h-11 flex-1 items-center justify-center whitespace-nowrap rounded-xl border border-white/10 px-3 text-xs font-semibold text-white transition-transform duration-150 active:scale-[0.98]"
                                style={{ backgroundColor: "rgb(44, 44, 46)" }}
                              >
                                Igualar anterior
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => addSet(selected.key)}
                              aria-label="+ Agregar serie"
                              className="flex h-11 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-white/10 px-3 text-xs font-semibold text-white transition-transform duration-150 active:scale-[0.98]"
                              style={{
                                background: SOLID.popover,
                                borderColor: GLASS.border,
                              }}
                            >
                              <Plus size={14} strokeWidth={2} aria-hidden="true" />
                              Agregar serie
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {selected && (
        <>
          <SmartOverloadModal
            isOpen={overloadOpen}
            onClose={() => setOverloadOpen(false)}
            exerciseName={cleanExerciseName(getExerciseDisplayName(selected.exercise))}
            weightKg={smartLoad?.weightKg ?? 0}
            reps={smartLoad?.suggestedReps ?? 8}
            isBodyweight={isBodyweightSelected}
            hasHistory={hasExerciseHistory}
            coldStartReason={coldStartPreview?.reason ?? null}
            coldStartSourceLabel={coldStartPreview?.sourceLabel ?? null}
            category={smartCategory}
            breakdownHint={loadHint}
            equipmentLabel={smartEquipmentLabel}
            movementPattern={smartExercise?.movement_pattern ?? null}
            bodyPart={selected.exercise.body_part}
            station={smartExercise?.station_key}
            bodyweightKg={profile?.weight_kg ?? undefined}
            warmupRamp={warmupRamp}
            onCalibrate={calibrateColdStart}
            onApply={applySmartLoadFromModal}
            pendingSetNumber={nextPendingSetNumber}
          />
          <ExerciseRankSheet
            isOpen={rankSheetOpen}
            onClose={() => setRankSheetOpen(false)}
            exerciseName={cleanExerciseName(getExerciseDisplayName(selected.exercise))}
            rank={exerciseRank}
            pendingSetNumber={nextPendingSetNumber}
            isBodyweight={isBodyweightSelected}
            onUseTarget={applyRankTarget}
          />
          <BiomechanicalGripStanceModal
            open={biomechanicsModalOpen}
            onClose={() => setBiomechanicsModalOpen(false)}
            exerciseTitle={cleanExerciseName(getExerciseDisplayName(selected.exercise))}
            context={{
              bodyPart: selected.exercise.body_part,
              muscleGroup: selected.exercise.target,
              movementPattern: smartExercise?.movement_pattern ?? null,
              exerciseName: getExerciseDisplayName(selected.exercise),
              equipmentId: selectedCatalogExercise?.effectiveEquipmentId ?? null,
            }}
            onApply={(selection) => {
              setBiomechanicsByExercise((prev) => ({
                ...prev,
                [selected.exercise.id]: selection.chipSummary,
              }));
            }}
          />
          <PlateCalculatorSheet
            isOpen={plateCalc.open}
            initialWeightKg={plateCalc.initialWeightKg}
            targetSetNumber={plateCalc.setIndex != null ? plateCalc.setIndex + 1 : null}
            onClose={() => setPlateCalc((prev) => ({ ...prev, open: false }))}
            onApplyWeight={(nextKg) => {
              const targetIdx =
                plateCalc.setIndex ??
                Math.max(
                  0,
                  selected.sets.findIndex((s) => !s.completed),
                );
              const existing = selected.sets[targetIdx];
              if (existing) {
                updateSet(selected.key, targetIdx, { ...existing, weight: String(nextKg) });
                setNotice(`Cargado ${nextKg} kg en la Serie ${targetIdx + 1}.`);
              }
            }}
          />
        </>
      )}

      {rest && (
        <RestTimer
          key={rest.id}
          seconds={rest.seconds}
          endsAt={rest.endsAt}
          exerciseName={rest.exerciseName}
          smartRecommendation={rest.smartRecommendation}
          onUpdateSeconds={(nextSeconds) => {
            setRestPreset(nextSeconds);
            if (rest.exerciseKey) {
              saveRestSeconds(rest.exerciseKey, nextSeconds);
              setItems((current) =>
                current.map((it) =>
                  it.key === rest.exerciseKey ? { ...it, restSeconds: nextSeconds } : it,
                ),
              );
            }
          }}
          onClose={closeRest}
          onFinished={closeRest}
        />
      )}

      {isDemoOpen && (
        <DemoSheet
          isOpen={isDemoOpen}
          onClose={() => setIsDemoOpen(false)}
          exerciseName={selected?.exercise.name ?? ""}
          primaryMuscle={selected?.exercise.target ?? ""}
          secondaryMuscles={[]}
        />
      )}
      {isAvanceOpen && (
        <AvanceSheet
          isOpen={isAvanceOpen}
          onClose={() => setIsAvanceOpen(false)}
          exerciseName={selected?.exercise.name ?? ""}
          history={[]}
        />
      )}
      {isCambiarOpen && (
        <CambiarSheet
          isOpen={isCambiarOpen}
          onClose={() => setIsCambiarOpen(false)}
          currentExercise={(selected?.exercise as any) ?? { id: "", name: "" }}
          availableEquipment={availableEquipmentList}
          exerciseCatalog={catalog}
          onReplace={(ex) => {
            if (selected) {
              setItems((prev) =>
                prev.map((it) =>
                  it.key === selected.key ? { ...it, exercise: ex as any } : it,
                ),
              );
            }
            setIsCambiarOpen(false);
          }}
        />
      )}
      {isAjustarOpen && (
        <AjustarSheet
          isOpen={isAjustarOpen}
          onClose={() => setIsAjustarOpen(false)}
          equipmentName={equipmentForSelected?.name ?? "Sin equipo"}
          equipmentImage={equipmentForSelected?.views?.[0]?.src}
          notes=""
          onNotesChange={() => {}}
        />
      )}
      {pickerOpen && (
        <UnifiedExerciseSelectorSheet
          isOpen={pickerOpen}
          mode="single"
          onClose={() => setPickerOpen(false)}
          onSelectSingle={handleExerciseSelected}
        />
      )}

      {/*
        Smart Workout Dock - the rest timer, floating over the session.

        It used to be a sticky footer inside the scroll flow, which meant it
        could sit below the fold while the athlete was resting and looking at
        the exercise above. A rest timer the athlete cannot see is a rest timer
        they have to guess, so it is pinned to the viewport instead: same
        capsule, always on screen, never wider than a phone.
      */}
      <div
        style={{
          position: "fixed",
          bottom: 16,
          left: 16,
          right: 16,
          zIndex: 40,
          margin: "0 auto",
          maxWidth: "28rem",
        }}
      >
        {rest ? (
          /* State A: Rest Timer Active */
          <div
            style={{
              height: 56,
              borderRadius: 28,
              background: "rgba(28, 28, 30, 0.95)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              boxShadow: "0 8px 30px rgba(0, 0, 0, 0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 12px",
            }}
          >
            <>
              {/* Left: what is running, and for how long. */}
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{
                    background: "#30D158",
                    boxShadow: "0 0 8px #30D158",
                    animation: "cronos-rest-pulse 1.5s ease-in-out infinite",
                  }}
                />
                <div className="min-w-0">
                  <p className="flex items-center gap-1 truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-400">
                    <Moon size={11} strokeWidth={2} aria-hidden="true" />
                    Descanso
                  </p>
                  <p
                    className="font-mono text-2xl font-bold leading-none text-white"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {formatClock(Math.max(0, Math.ceil((rest.endsAt - Date.now()) / 1000)))}
                  </p>
                </div>
              </div>

              {/* Right: -15s, +15s, Skip */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button
                  type="button"
                  onClick={() => startRestUntil(rest.endsAt - 15000)}
                  aria-label="Restar 15 segundos"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "6px 10px",
                    borderRadius: 16,
                    background: "#2C2C2E",
                    border: "1px solid rgba(255, 255, 255, 0.10)",
                    color: "#D4D4D8",
                    fontSize: "11px",
                    fontFamily: TYPE.mono.font,
                    fontWeight: 700,
                    fontVariantNumeric: "tabular-nums",
                    cursor: "pointer",
                    height: 36,
                    transition: "background 150ms ease, transform 150ms ease",
                  }}
                  onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.95)"; }}
                  onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                >
                  -15s
                </button>
                <button
                  type="button"
                  onClick={() => startRestUntil(rest.endsAt + 15000)}
                  aria-label="Sumar 15 segundos"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "6px 10px",
                    borderRadius: 16,
                    background: "#2C2C2E",
                    border: "1px solid rgba(255, 255, 255, 0.10)",
                    color: "#D4D4D8",
                    fontSize: "11px",
                    fontFamily: TYPE.mono.font,
                    fontWeight: 700,
                    fontVariantNumeric: "tabular-nums",
                    cursor: "pointer",
                    height: 36,
                    transition: "background 150ms ease, transform 150ms ease",
                  }}
                  onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.95)"; }}
                  onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                >
                  +15s
                </button>
                <button
                  type="button"
                  onClick={closeRest}
                  aria-label="Saltar descanso"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                    padding: "5px 9px",
                    borderRadius: 16,
                    background: ACCENT.base,
                    border: "none",
                    color: "#FFFFFF",
                    fontSize: "11px",
                    fontWeight: 700,
                    cursor: "pointer",
                    height: 36,
                    transition: "background 150ms ease, transform 150ms ease",
                  }}
                  onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.95)"; }}
                  onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                >
                  <FastForward size={13} strokeWidth={2.5} aria-hidden="true" />
                  Saltar
                </button>
              </div>
            </>
          </div>
        ) : (
          /*
           * State B: idle. The session has exercises left to move between, but
           * the strip that draws them is the carousel above the exercise, and a
           * second one floating at the bottom of the screen was a bar of chrome
           * the athlete scrolled past on every set. The controls stay in the
           * document -- a screen reader still has a way to step, rest and
           * finish -- they are simply not painted.
           */
          <div className="sr-only">
            <>
              {/* Previous */}
              <button
                type="button"
                onClick={() => {
                  if (selectedIndex > 0) {
                    focusExercise(items[selectedIndex - 1].key);
                  }
                }}
                disabled={selectedIndex <= 0}
                aria-label="Ejercicio anterior"
              >
                Anterior
              </button>

              {/* Rest */}
              <button
                type="button"
                onClick={() => startRest(DEFAULT_REST)}
                aria-label="Iniciar descanso de 90 segundos"
              >
                90s
              </button>

              {/* Next, or finish */}
              {selectedIndex >= 0 && selectedIndex < items.length - 1 ? (
                <button
                  type="button"
                  onClick={() => {
                    if (selectedIndex < items.length - 1) {
                      focusExercise(items[selectedIndex + 1].key);
                    }
                  }}
                  aria-label="Siguiente ejercicio"
                >
                  Siguiente
                </button>
              ) : (
                <button
                  type="button"
                  onClick={finish}
                  aria-label="Finalizar entrenamiento"
                >
                  Finalizar
                </button>
              )}
            </>
          </div>
        )}
      </div>
    </div>
  );
}
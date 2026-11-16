/**
 * DashboardPage.tsx — Cronos Gym home dashboard (Command Center / Today).
 *
 * Instrumento Editorial Cronos: negro profundo, un solo acento crimson,
 * jerarquía clara, números tabulares y sin tarjetas anidadas innecesarias.
 *
 * Layout:
 * - Escritorio: fila superior Hero (8 cols) + lateral PR y Cronos IA (4 cols);
 *   fila inferior Semana (8 cols) + Historial (4 cols).
 * - Móvil: una sola columna en orden de lectura: Header, Hero, Esta semana,
 *   Récords, Historial, Cronos IA, Navegación inferior.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { RefreshCw, AlertTriangle, Menu, ChevronDown, Megaphone, Zap, X } from "lucide-react";
import { useAdvancedMode } from "@/hooks/useAdvancedMode";
import { TopMenuDrawer } from "@/components/shell/TopMenuDrawer";
import { WelcomeTourModal, hasSeenWelcomeTour } from "@/components/onboarding/WelcomeTourModal";

import { useDashboardHome } from "@/lib/dashboard/dashboardHomeModel";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { resolveTrainingIntent } from "@/lib/workout/trainingIntent";
import { getWeekdayIndex } from "@/lib/dashboard/heroCardModel";
import { draftFromRoutine } from "@/lib/routines/routineDayModel";
import type { RoutineDay } from "@/lib/routines/routineDayModel";
import { PROFILE_PATH, PROGRESS_PATH, TRAIN_PATH } from "@/components/shell/navItems";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { useAnnouncements } from "@/hooks/useAnnouncements";
import { CoachBanner } from "@/components/coach/portal/CoachBanner";
import { WeeklyProgressSection } from "@/components/dashboard/sections/WeeklyProgressSection";
import { DailyReadinessBanner } from "@/components/dashboard/sections/DailyReadinessBanner";
import { TipSection } from "@/components/dashboard/sections/TipSection";
import { TrainingHeroSection } from "@/components/dashboard/sections/TrainingHeroSection";
import { PRSection } from "@/components/dashboard/sections/PRSection";
import { HistorySection } from "@/components/dashboard/sections/HistorySection";
import { RecoverableDraftSection } from "@/components/dashboard/sections/RecoverableDraftSection";
import { RequestRoutineModal } from "@/components/coach/portal/RequestRoutineModal";
import { GymClubHubSection } from "@/components/dashboard/sections/GymClubHubSection";
import { UserAvatar } from "@/components/common/UserAvatar";
import {
  ACCENT,
  GLASS,
  RADIUS,
  SPACE,
  STATUS,
  TEXT,
  TYPE,
} from "@/design/tokens";

/**
 * Canvas contextual de Today (Command Center). No modifica SURFACE.base global.
 * Se apoya en negro profundo + glass existente para integrarse con AppShell/body.
 */
const TODAY_CANVAS = "#000000";

/** Videogame-loading-screen style tips for the empty feed state. */
interface Tip {
  id: string;
  text: string;
  icon: "lightbulb" | "zap";
  category: "entrenamiento" | "rir-rpe" | "nutricion" | "descanso";
}

const TIP_CATALOG: Tip[] = [
  {
    id: "tip-1",
    text: "Deja 1-2 reps en la reserva (RIR 1-2) para la mayoria de las series.",
    icon: "zap",
    category: "rir-rpe",
  },
  {
    id: "tip-2",
    text: "Descansa 2-3 min entre series de fuerza para recuperar ATP.",
    icon: "zap",
    category: "descanso",
  },
  {
    id: "tip-3",
    text: "Consume 1.6-2.2g de proteinas por kg de peso corporal.",
    icon: "lightbulb",
    category: "nutricion",
  },
  {
    id: "tip-4",
    text: "Duerme 7-9 horas para maximizar la recuperacion.",
    icon: "lightbulb",
    category: "descanso",
  },
  {
    id: "tip-5",
    text: "No entrenes el mismo grupo muscular dos dias seguidos.",
    icon: "zap",
    category: "entrenamiento",
  },
  {
    id: "tip-6",
    text: "Lleva un registro de tus series y pesos para progresar.",
    icon: "lightbulb",
    category: "entrenamiento",
  },
  {
    id: "tip-7",
    text: "El RPE mide el esfuerzo percibido del 1 al 10.",
    icon: "zap",
    category: "rir-rpe",
  },
  {
    id: "tip-8",
    text: "Hidratate antes, durante y despues del entrenamiento.",
    icon: "lightbulb",
    category: "nutricion",
  },
  {
    id: "tip-9",
    text: "Calienta 5-10 min antes de cargas pesadas.",
    icon: "zap",
    category: "entrenamiento",
  },
  {
    id: "tip-10",
    text: "La sobrecarga progresiva es la clave del crecimiento.",
    icon: "lightbulb",
    category: "entrenamiento",
  },
  {
    id: "tip-11",
    text: "Descansa 48h entre sesiones del mismo musculo.",
    icon: "lightbulb",
    category: "descanso",
  },
  {
    id: "tip-12",
    text: "Un RPE de 8-9 es ideal para hipertrofia.",
    icon: "zap",
    category: "rir-rpe",
  },
];

interface DashboardPageProps {
  userId: string;
}

type SessionState = "idle" | "scheduled" | "in-progress" | "completed";

/** Resolves the hero routine title: falls back to day label when raw title is invalid. */
function resolveRoutineTitle(
  routine: { title: string | null | undefined } | null,
  dayLabel: string | null | undefined,
): string {
  const raw = routine?.title?.trim();
  if (!raw || raw.toLowerCase() === "xd" || raw.length <= 1) {
    return dayLabel ?? "Entrenamiento de Hoy";
  }
  return raw;
}

export function DashboardPage({ userId }: DashboardPageProps) {
  const navigate = useNavigate();
  const data = useDashboardHome(userId);
  const isMobile = useMediaQuery("(max-width: 639px)");

  const { announcements, remove: deleteAnnouncement } = useAnnouncements();
  const [tipIndex, setTipIndex] = useState(0);
  const coachId: string | null = null;
  const [requestOpen, setRequestOpen] = useState(false);
  const [advancedMode] = useAdvancedMode();
  const [menuOpen, setMenuOpen] = useState(false);
  const [storeOpen, setStoreOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(() => !hasSeenWelcomeTour());
  const [metricsExpanded, setMetricsExpanded] = useState(() => advancedMode);
  const [announcementImagePreview, setAnnouncementImagePreview] = useState<{
    url: string;
    title: string;
  } | null>(null);

  useEffect(() => {
    setMetricsExpanded(advancedMode);
  }, [advancedMode]);

  const sessionState = useMemo<SessionState>(() => {
    if (data.isSessionActive) return "in-progress";
    if (data.completedToday) return "completed";
    return data.dailyFocus.isRestDay ? "scheduled" : "idle";
  }, [data.isSessionActive, data.completedToday, data.dailyFocus.isRestDay]);

  const routine = data.heroRoutineSummary;
  const suggested = data.scheduledRoutine ?? data.suggestedRoutine;
  const hasRoutine = routine !== null;

  // Resuelve los ejercicios del día de hoy para la rutina sugerida/programada.
  // Devuelve null cuando no hay rutina, no hay días de entrenamiento, o hoy es descanso.
  const todayPlan = useMemo(() => {
    if (!suggested) return null;
    const fullRoutine = data.routines.find((r) => r.id === suggested.id);
    if (!fullRoutine) return null;
    const weekday = getWeekdayIndex(Date.now());
    const draft = draftFromRoutine(fullRoutine);
    const trainingDays = draft.days.filter((d) => d.kind === "training");
    if (trainingDays.length === 0) return null;
    let todayDay: RoutineDay | undefined;
    if (fullRoutine.routineMode === "weekly") {
      todayDay = trainingDays.find((d) => d.weekday === weekday);
    } else {
      todayDay = trainingDays[weekday % trainingDays.length];
    }
    if (!todayDay || todayDay.exercises.length === 0) return null;
    return { day: todayDay, exercises: todayDay.exercises };
  }, [suggested, data.routines]);

  const ctaLabel = useMemo(() => {
    if (data.rehydrating) return "Comprobando sesión...";
    if (data.recoverableDraft) {
      return `Recuperar entrenamiento: ${data.recoverableDraft.routineTitle ?? "Entrenamiento"}`;
    }
    if (sessionState === "completed") return "Ver progreso →";
    if (sessionState === "in-progress") {
      const activeTitle = data.activeSession?.title?.trim();
      return activeTitle ? `Continuar: ${activeTitle}` : "Continuar entrenamiento";
    }
    if (routine?.exerciseCount && routine.exerciseCount > 0) return "Iniciar entreno →";
    if (!todayPlan) return "Sin sesión programada";
    return "Iniciar entreno →";
  }, [
    sessionState,
    data.rehydrating,
    data.recoverableDraft,
    data.activeSession?.title,
    todayPlan,
    routine?.exerciseCount,
  ]);

  const weeklyCompleted = data.weeklyProgress.completed;
  const weeklyGoal = data.weeklyProgress.goal;

  const handlePrimary = useCallback(() => {
    const target = suggested ? { id: suggested.id, title: suggested.title } : null;
    const intent = resolveTrainingIntent({
      rehydrating: data.rehydrating,
      session: data.activeSession
        ? { routineId: data.activeSession.routineId, title: data.activeSession.title }
        : null,
      recoverableDraft: data.recoverableDraft
        ? { routineId: data.recoverableDraft.routineId, routineTitle: data.recoverableDraft.routineTitle }
        : null,
      targetRoutineId: target?.id ?? null,
      targetRoutineTitle: target?.title ?? null,
      allowFreeStart: false,
    });

    if (intent.action === "wait") return;
    if (sessionState === "completed") {
      navigate(PROGRESS_PATH);
      return;
    }
    if (intent.action === "restore") {
      data.restoreDraft();
      navigate(TRAIN_PATH);
      return;
    }
    if (intent.action === "continue") {
      navigate(TRAIN_PATH);
      return;
    }
    if (intent.action !== "start" || !target) return;
    if (!todayPlan) return; // Día de descanso: no se inicia sesión

    const { day, exercises } = todayPlan;
    const planned = exercises.map((ex) => ({
      exercise: ex.exercise,
      target_sets: ex.target_sets,
      rest_seconds: ex.rest_seconds,
      rowId: ex.rowId ?? "",
      order_index: ex.order_index,
      target_reps_min: ex.target_reps_min,
      target_reps_max: ex.target_reps_max,
      dayIndex: day.weekday ?? day.order,
      dayLabel: day.label,
      groupId: ex.groupId,
    }));
    const result = data.startSession({
      routine: { id: target.id, title: target.title },
      routineDayId: day.id,
      dayLabel: day.label || undefined,
      planned,
    });
    if (result?.ok) navigate(TRAIN_PATH);
  }, [
    sessionState,
    suggested,
    data.startSession,
    navigate,
    data.rehydrating,
    data.recoverableDraft,
    data.restoreDraft,
    data.activeSession,
    todayPlan,
  ]);

  const nextTip = useCallback(() => {
    setTipIndex((i) => (i + 1) % TIP_CATALOG.length);
  }, []);

  const firstError = useMemo(() => {
    for (const value of Object.values(data.errors)) {
      if (value !== null) return value;
    }
    return null;
  }, [data.errors]);

  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("es-MX", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }).format(new Date()),
    [],
  );

  const showConflictNotice =
    !!data.activeSession &&
    !!suggested &&
    data.activeSession.routineId !== suggested.id &&
    !data.recoverableDraft;

  // Cualquier origen cargando: esqueletos, sin CTA ni datos a medio renderizar.
  if (data.loading) {
    return (
      <div className="w-full flex flex-col gap-4 md:gap-6 p-4 md:p-6">
        <GlassCard raised>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: SPACE.sm,
            }}
          >
            <div
              style={{
                height: "20px",
                width: "100%",
                borderRadius: RADIUS.sm,
                background: GLASS.fill,
              }}
            />
            <div
              style={{
                height: "20px",
                width: "60%",
                borderRadius: RADIUS.sm,
                background: GLASS.fill,
              }}
            />
            <div
              style={{
                height: "20px",
                width: "40%",
                borderRadius: RADIUS.sm,
                background: GLASS.fill,
              }}
            />
          </div>
        </GlassCard>
      </div>
    );
  }

  return (
    <div
      data-testid="today-command-center-root"
      className="w-full min-w-0 flex flex-col gap-5 md:gap-6"
      style={{
        backgroundColor: TODAY_CANVAS,
        backgroundImage: `radial-gradient(120% 70% at 50% -10%, ${ACCENT.subtle} 0%, transparent 58%)`,
        paddingInline: 20,
        paddingTop: SPACE.md,
        paddingBottom: SPACE.lg,
      }}
    >
      <header
        className="flex items-center justify-between gap-3"
        aria-label="Encabezado de Today"
      >
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold tracking-tight text-white sm:text-2xl">
            {data.greeting}
          </h1>
          <p style={{ ...TYPE.caption, color: TEXT.tertiary, margin: 0, textTransform: "capitalize" }}>
            {todayLabel}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Abrir menú principal"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-[#1C1C1E] text-white active:scale-[0.98] transition-transform duration-150"
          >
            <Menu size={20} aria-hidden="true" />
          </button>
          <Link
            to={PROFILE_PATH}
            aria-label="Abrir perfil"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: SPACE.sm,
              textDecoration: "none",
              color: TEXT.primary,
              padding: `${SPACE.xs} ${SPACE.sm}`,
              borderRadius: RADIUS.pill,
              border: `1px solid ${GLASS.border}`,
              background: GLASS.fill,
            }}
          >
            <UserAvatar name={data.displayName ?? userId} size={32} />
          </Link>
        </div>
      </header>

      {/* 1. Avisos del Gimnasio (Estilo Apple + Google Pixel At-a-Glance con foto opcional) */}
      {announcements.length > 0 && (
        <section className="rounded-3xl border border-white/[0.06] bg-[#1C1C1E] p-4">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Megaphone size={15} color={ACCENT.base} aria-hidden="true" />
              <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Avisos del Gimnasio
              </span>
            </div>
            <span className="font-mono text-[11px] tabular-nums text-zinc-500">
              {announcements.length}
            </span>
          </div>
          <div className="divide-y divide-white/[0.06]">
            {announcements.slice(0, 2).map((a) => (
              <div
                key={a.id}
                className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold tracking-tight text-white">{a.title}</p>
                  {a.body && <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">{a.body}</p>}
                </div>
                {a.imageUrl && (
                  <button
                    type="button"
                    onClick={() =>
                      setAnnouncementImagePreview({ url: a.imageUrl!, title: a.title })
                    }
                    aria-label={`Ver imagen del aviso ${a.title}`}
                    className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-white/[0.06] bg-black transition-transform active:scale-95"
                  >
                    <img
                      src={a.imageUrl}
                      alt={a.title}
                      width={56}
                      height={56}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 2. CTA Principal en Thumb Zone */}
      <button
        type="button"
        onClick={() => {
          if (hasRoutine || todayPlan || data.isSessionActive || data.recoverableDraft) {
            handlePrimary();
          } else {
            navigate("/rutinas");
          }
        }}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#FF3B30] px-5 text-base font-bold text-white active:scale-[0.98] transition-transform duration-150"
      >
        <Zap size={20} fill="currentColor" aria-hidden="true" />
        <span>Empezar entrenamiento de hoy</span>
      </button>

      {/* 3. Tienda / Productos (Vista Previa) */}
      <GymClubHubSection
        userId={userId}
        compactPreview
        onViewAll={() => setStoreOpen(true)}
      />

      {firstError !== null && (
        <GlassCard raised style={{ border: `1px solid ${STATUS.error.border}` }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: SPACE.md,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: SPACE.sm,
                color: STATUS.error.text,
                fontSize: TYPE.body.size,
              }}
            >
              <span aria-hidden="true" style={{ display: "inline-flex" }}>
                <AlertTriangle size={20} />
              </span>
              <span>{firstError}</span>
            </div>
            <GlassButton
              variant="primary"
              icon={<RefreshCw size={16} />}
              onClick={() => void data.refreshAll()}
            >
              Reintentar
            </GlassButton>
          </div>
        </GlassCard>
      )}

      {/* 4. Métricas Avanzadas Plegadas (siempre colapsable, full-width sin tarjetas anidadas) */}
      <section className="flex w-full flex-col gap-4">
        <button
          type="button"
          aria-expanded={metricsExpanded}
          onClick={() => setMetricsExpanded((prev) => !prev)}
          className="flex min-h-12 w-full items-center justify-between gap-3 rounded-3xl border border-white/[0.06] bg-[#1C1C1E] px-4 py-3 text-left text-sm font-semibold tracking-tight text-white transition-transform active:scale-[0.98]"
        >
          <span>Ver resumen de rendimiento</span>
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-xs font-medium tabular-nums text-zinc-400">
              {weeklyCompleted}/{weeklyGoal} ses.
            </span>
            <ChevronDown
              size={18}
              className={`text-zinc-400 transition-transform duration-200 ${
                metricsExpanded ? "rotate-180" : "rotate-0"
              }`}
              aria-hidden="true"
            />
          </div>
        </button>

        {metricsExpanded && (
          <div
            data-testid="today-command-center"
            className="grid w-full grid-cols-1 gap-4 pb-6 md:gap-6 xl:grid-cols-12 items-start"
          >
            <div className="flex flex-col gap-5 md:gap-6 min-w-0 xl:col-span-8">
              <DailyReadinessBanner
                sessionsLast7Days={weeklyCompleted}
                weeklyTargetDays={weeklyGoal}
                workoutsThisMonth={data.recentSessions.length}
              />
              <TrainingHeroSection
                greeting={data.greeting}
                hasRoutine={hasRoutine}
                routineTitle={resolveRoutineTitle(routine, data.dailyFocus.dayLabel)}
                exerciseCount={hasRoutine ? routine!.exerciseCount : 0}
                estimatedDurationMin={hasRoutine ? routine!.estimatedDurationMin : 0}
                muscleCounts={data.muscleCounts}
                ctaLabel={ctaLabel}
                rehydrating={data.rehydrating}
                onPrimary={handlePrimary}
                focusLabel={hasRoutine ? data.dailyFocus.dayLabel : null}
                isCompleted={sessionState === "completed"}
                completedSummary={data.completedToday}
                coachAssigned={Boolean(data.heroRoutineSummary?.assignedByCoach)}
                onExtra={() => navigate(TRAIN_PATH)}
                isRecoverable={!!data.recoverableDraft}
                compact={isMobile}
              />
              {coachId && (
                <>
                  <CoachBanner coachId={coachId} onRequestRoutine={() => setRequestOpen(true)} />
                  <RequestRoutineModal
                    coachId={coachId}
                    open={requestOpen}
                    onClose={() => setRequestOpen(false)}
                    onSuccess={() => setRequestOpen(false)}
                  />
                </>
              )}
              {showConflictNotice && data.activeSession && (
                <GlassCard raised style={{ padding: SPACE.card, border: `1px solid ${GLASS.borderStrong}` }}>
                  <p style={{ ...TYPE.body, color: TEXT.secondary, margin: 0 }}>
                    Entrenamiento activo: <strong style={{ color: TEXT.primary }}>{data.activeSession.title}</strong>.
                    La rutina programada no se ha iniciado para proteger la sesión actual.
                  </p>
                </GlassCard>
              )}
              {data.recoverableDraft && (
                <RecoverableDraftSection
                  routineTitle={data.recoverableDraft.routineTitle}
                  onContinue={() => {
                    data.restoreDraft();
                    navigate(TRAIN_PATH);
                  }}
                  onDiscard={data.discardDraft}
                />
              )}
              <WeeklyProgressSection
                weeklyCompleted={weeklyCompleted}
                weeklyGoal={weeklyGoal}
                weeklyPlan={data.weeklyPlan}
                streakStats={data.streakStats}
              />
            </div>

            <div className="flex flex-col gap-5 md:gap-6 min-w-0 xl:col-span-4">
              <HistorySection
                sessions={data.recentSessions}
                maxVisible={isMobile ? 3 : 4}
              />
              <PRSection topRecords={data.topRecords} recentPRs={data.recentPRs} compact={isMobile} />
              <TipSection
                tip={TIP_CATALOG[tipIndex]}
                onNext={nextTip}
                announcements={announcements}
                onDelete={deleteAnnouncement}
              />
            </div>
          </div>
        )}
      </section>

      <TopMenuDrawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onOpenStore={() => setStoreOpen(true)}
        onOpenTour={() => setTourOpen(true)}
      />

      <WelcomeTourModal open={tourOpen} onClose={() => setTourOpen(false)} />

      {storeOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Tienda y Clases del Gimnasio"
          className="fixed inset-0 z-[95] flex items-end justify-center bg-black/85 p-4 sm:items-center"
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/10 bg-[#09090B] p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-base font-bold text-white">Tienda y Clases</span>
              <button
                type="button"
                onClick={() => setStoreOpen(false)}
                aria-label="Cerrar tienda"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#1C1C1E] text-zinc-300"
              >
                <X size={18} />
              </button>
            </div>
            <GymClubHubSection userId={userId} />
          </div>
        </div>
      )}

      {announcementImagePreview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Imagen del aviso: ${announcementImagePreview.title}`}
          onClick={() => setAnnouncementImagePreview(null)}
          className="fixed inset-0 z-[98] flex items-center justify-center bg-black/90 p-4 backdrop-blur-xl"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md overflow-hidden rounded-3xl border border-white/[0.06] bg-[#1C1C1E] p-3"
          >
            <div className="mb-2.5 flex items-center justify-between gap-2 px-1">
              <span className="truncate text-sm font-semibold tracking-tight text-white">
                {announcementImagePreview.title}
              </span>
              <button
                type="button"
                onClick={() => setAnnouncementImagePreview(null)}
                aria-label="Cerrar imagen del aviso"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#2C2C2E] text-zinc-300"
              >
                <X size={16} />
              </button>
            </div>
            <img
              src={announcementImagePreview.url}
              alt={announcementImagePreview.title}
              className="max-h-[75vh] w-full rounded-2xl bg-black object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}

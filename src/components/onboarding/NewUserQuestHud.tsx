import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  ChevronRight,
  Compass,
  Dumbbell,
  Flame,
  Shield,
  Sparkles,
  Trophy,
  X,
} from "lucide-react";

const QUEST_DISMISSED_KEY = "cronos_quest_hud_dismissed_v1";
const QUEST_VISITED_KEY = "cronos_quest_hud_visited_v1";

interface NewUserQuestHudProps {
  hasRoutine: boolean;
  hasWorkout: boolean;
  onOpenTour: () => void;
}

interface QuestStep {
  id: "routine" | "workout" | "ranks" | "tour";
  number: string;
  title: string;
  controlHint: string;
  reward: string;
  completed: boolean;
  icon: typeof Dumbbell;
  onAction: () => void;
}

function readBooleanFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function readVisitedSet(): Record<string, boolean> {
  try {
    const raw = window.localStorage.getItem(QUEST_VISITED_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, boolean>)
      : {};
  } catch {
    return {};
  }
}

function writeVisited(id: string) {
  try {
    const next = { ...readVisitedSet(), [id]: true };
    window.localStorage.setItem(QUEST_VISITED_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota / private mode failures.
  }
}

export function NewUserQuestHud({
  hasRoutine,
  hasWorkout,
  onOpenTour,
}: NewUserQuestHudProps) {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState<boolean>(() =>
    readBooleanFlag(QUEST_DISMISSED_KEY),
  );
  const [visited, setVisited] = useState<Record<string, boolean>>(() =>
    readVisitedSet(),
  );

  const markVisited = (id: string) => {
    writeVisited(id);
    setVisited((prev) => ({ ...prev, [id]: true }));
  };

  const quests: QuestStep[] = useMemo(
    () => [
      {
        id: "routine",
        number: "01",
        title: "Crea o elige tu primera rutina",
        controlHint: "Pulsa para armar tu plan semanal",
        reward: "+250 XP",
        completed: hasRoutine,
        icon: Dumbbell,
        onAction: () => {
          markVisited("routine");
          navigate("/rutinas");
        },
      },
      {
        id: "workout",
        number: "02",
        title: "Completa tu primer entrenamiento",
        controlHint: "Registra series y descanso en vivo",
        reward: "+250 XP",
        completed: hasWorkout,
        icon: Flame,
        onAction: () => {
          markVisited("workout");
          navigate(hasRoutine ? "/entrenar" : "/rutinas");
        },
      },
      {
        id: "ranks",
        number: "03",
        title: "Desbloquea tus Rangos Anatómicos",
        controlHint: "Mira qué grupos musculares suben de nivel",
        reward: "+250 XP",
        completed: Boolean(visited.ranks || hasWorkout),
        icon: Shield,
        onAction: () => {
          markVisited("ranks");
          navigate("/rangos");
        },
      },
      {
        id: "tour",
        number: "04",
        title: "Domina Cronos IA y el modo Offline",
        controlHint: "Abre la guía rápida de controles",
        reward: "+250 XP",
        completed: Boolean(visited.tour),
        icon: Sparkles,
        onAction: () => {
          markVisited("tour");
          onOpenTour();
        },
      },
    ],
    [hasRoutine, hasWorkout, navigate, onOpenTour, visited.ranks, visited.tour],
  );

  const completedCount = quests.filter((q) => q.completed).length;
  const allCompleted = completedCount === quests.length;

  if (dismissed) return null;

  const nextQuest = quests.find((q) => !q.completed) ?? quests[quests.length - 1];
  const progressPercent = Math.round((completedCount / quests.length) * 100);

  const handleDismiss = () => {
    try {
      window.localStorage.setItem(QUEST_DISMISSED_KEY, "1");
    } catch {
      // Ignore storage errors.
    }
    setDismissed(true);
  };

  return (
    <section
      aria-label="Misiones de inicio"
      className="rounded-[24px] border border-white/10 bg-[#0D0D11]/95 p-4 shadow-xl backdrop-blur-xl sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[#D70015]/30 bg-[#D70015]/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-[#FF6B6B]">
            <Compass className="h-3 w-3" aria-hidden="true" />
            {allCompleted ? "Tutorial completado" : "Modo Tutorial · Paso a paso"}
          </div>
          <h2 className="mt-2 text-base font-semibold tracking-tight text-white">
            {allCompleted
              ? "¡Ya dominas Cronos Gym!"
              : "Completa tus 4 misiones iniciales"}
          </h2>
          <p className="mt-0.5 text-xs text-neutral-400">
            {allCompleted
              ? "Desbloqueaste los controles clave para entrenar con o sin conexión."
              : `${completedCount} de ${quests.length} misiones · ${completedCount * 250} / 1000 XP`}
          </p>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Ocultar guía de misiones"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-neutral-400 transition hover:bg-white/[0.1] hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* XP Progress Bar */}
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#D70015] to-[#FF5A36] transition-all duration-300"
          style={{ width: `${Math.max(progressPercent, 8)}%` }}
        />
      </div>

      {allCompleted ? (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-3.5 py-2.5">
          <div className="flex items-center gap-2.5 text-xs text-emerald-200">
            <Trophy className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
            <span>1000 XP ganados. Puedes ocultar esta tarjeta cuando quieras.</span>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="shrink-0 rounded-xl bg-emerald-500/20 px-3 py-1.5 text-[11px] font-semibold text-emerald-200 transition hover:bg-emerald-500/30"
          >
            Listo
          </button>
        </div>
      ) : (
        <div className="mt-3.5 grid gap-2 sm:grid-cols-2">
          {quests.map((quest) => {
            const Icon = quest.icon;
            const isNext = nextQuest.id === quest.id;
            return (
              <button
                key={quest.id}
                type="button"
                onClick={quest.onAction}
                className={`group flex items-center justify-between gap-3 rounded-2xl border px-3.5 py-2.5 text-left transition active:scale-[0.98] ${
                  quest.completed
                    ? "border-emerald-500/20 bg-emerald-500/[0.06] text-neutral-300"
                    : isNext
                      ? "border-[#D70015]/50 bg-[#D70015]/[0.10] text-white shadow-sm"
                      : "border-white/10 bg-white/[0.02] text-neutral-300 hover:border-white/20 hover:bg-white/[0.05]"
                }`}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${
                      quest.completed
                        ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
                        : isNext
                          ? "border-[#D70015]/50 bg-[#D70015]/20 text-[#FF6B6B]"
                          : "border-white/10 bg-white/[0.04] text-neutral-400"
                    }`}
                  >
                    {quest.completed ? (
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[10px] text-neutral-500">
                        {quest.number}
                      </span>
                      <span
                        className={`truncate text-xs font-semibold ${
                          quest.completed ? "line-through text-neutral-400" : "text-white"
                        }`}
                      >
                        {quest.title}
                      </span>
                    </div>
                    <p className="truncate text-[11px] text-neutral-400">
                      {quest.completed ? `Completada · ${quest.reward}` : quest.controlHint}
                    </p>
                  </div>
                </div>

                {!quest.completed && (
                  <ChevronRight
                    className="h-4 w-4 shrink-0 text-neutral-500 transition-transform group-hover:translate-x-0.5 group-hover:text-white"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

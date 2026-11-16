import { useEffect, useMemo, useState } from "react";
import { Flame, Sparkles } from "lucide-react";
import { ACCENT, TEXT } from "@/design/tokens";
import {
  computeDailyReadiness,
  loadTodayReadinessMood,
  saveTodayReadinessMood,
  type ReadinessMood,
} from "@/engines/dailyReadinessEngine";
import { listGymChallenges, type GymChallenge } from "@/services/gymOperationsService";

interface DailyReadinessBannerProps {
  sessionsLast7Days: number;
  weeklyTargetDays: number;
  workoutsThisMonth: number;
}

const MOODS: ReadonlyArray<{ id: ReadinessMood; label: string }> = [
  { id: "optimo", label: "Óptimo" },
  { id: "normal", label: "Normal" },
  { id: "fatigado", label: "Fatigado" },
];

export function DailyReadinessBanner({
  sessionsLast7Days,
  weeklyTargetDays,
  workoutsThisMonth,
}: DailyReadinessBannerProps) {
  const [mood, setMood] = useState<ReadinessMood>(() => loadTodayReadinessMood());
  const [activeChallenge, setActiveChallenge] = useState<GymChallenge | null>(null);

  useEffect(() => {
    void listGymChallenges().then((list) => {
      setActiveChallenge(list.find((c) => c.active) ?? list[0] ?? null);
    });
  }, []);

  const readiness = useMemo(
    () =>
      computeDailyReadiness({
        sessionsLast7Days,
        weeklyTargetDays,
        setsLast72h: sessionsLast7Days * 14,
        mood,
      }),
    [sessionsLast7Days, weeklyTargetDays, mood],
  );

  return (
    <section className="rounded-2xl border border-white/10 bg-[#1C1C1E] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Sparkles size={18} color={ACCENT.base} aria-hidden="true" />
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              Cronos Readiness Score
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-2xl font-bold tabular-nums text-white">
                {readiness.score}%
              </span>
              <span className="text-xs font-semibold" style={{ color: ACCENT.text }}>
                {readiness.label}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5" role="group" aria-label="Estado diario">
          {MOODS.map((m) => {
            const active = mood === m.id;
            return (
              <button
                key={m.id}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setMood(m.id);
                  saveTodayReadinessMood(m.id);
                }}
                className="h-11 rounded-xl border px-3 text-xs font-semibold active:scale-[0.98] transition-transform duration-150"
                style={{
                  borderColor: active ? ACCENT.base : "rgba(255,255,255,0.10)",
                  backgroundColor: active ? "rgba(255,59,48,0.16)" : "#09090B",
                  color: active ? "#FFFFFF" : TEXT.secondary,
                }}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      <p className="mt-2.5 text-xs leading-relaxed" style={{ color: TEXT.secondary }}>
        {readiness.guidance}
      </p>

      {activeChallenge && (
        <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 text-xs">
          <div className="flex items-center gap-2 text-white">
            <Flame size={15} color={ACCENT.base} aria-hidden="true" />
            <span className="font-semibold">Reto del mes: {activeChallenge.title}</span>
          </div>
          <span className="font-mono font-bold tabular-nums" style={{ color: ACCENT.text }}>
            {workoutsThisMonth}/{activeChallenge.targetSessions}
          </span>
        </div>
      )}
    </section>
  );
}

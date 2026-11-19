import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Flame, QrCode, Sparkles, Trophy } from "lucide-react";
import { ACCENT, GLASS, SURFACE, TEXT } from "@/design/tokens";
import {
  computeDailyReadiness,
  loadTodayReadinessMood,
  saveTodayReadinessMood,
  type ReadinessMood,
} from "@/engines/dailyReadinessEngine";
import { listGymChallenges, type GymChallenge } from "@/services/gymOperationsService";
import {
  getMonthlyChallengeLeaderboard,
  type ChallengeLeaderboardRow,
} from "@/services/attendanceAndClubService";

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
  const navigate = useNavigate();
  const [mood, setMood] = useState<ReadinessMood>(() => loadTodayReadinessMood());
  const [activeChallenge, setActiveChallenge] = useState<GymChallenge | null>(null);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [leaderboard, setLeaderboard] = useState<ChallengeLeaderboardRow[]>([]);

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
        <div className="mt-3 space-y-2.5 border-t border-white/10 pt-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-white">
              <Flame size={15} color={ACCENT.base} aria-hidden="true" />
              <span className="font-semibold">Reto del mes: {activeChallenge.title}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold tabular-nums" style={{ color: ACCENT.text }}>
                {workoutsThisMonth}/{activeChallenge.targetSessions}
              </span>
              <button
                type="button"
                onClick={() => {
                  const next = !leaderboardOpen;
                  setLeaderboardOpen(next);
                  if (next && leaderboard.length === 0) {
                    void getMonthlyChallengeLeaderboard().then(setLeaderboard);
                  }
                }}
                className="inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold text-white"
                style={{ backgroundColor: SURFACE.sunken, border: `1px solid ${GLASS.border}` }}
              >
                <Trophy size={12} color={ACCENT.base} aria-hidden="true" />
                <span>{leaderboardOpen ? "Ocultar" : "Ranking"}</span>
              </button>
              <button
                type="button"
                onClick={() => navigate("/checkin")}
                className="inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold text-white"
                style={{ backgroundColor: ACCENT.subtle, border: `1px solid ${ACCENT.border}`, color: ACCENT.text }}
              >
                <QrCode size={12} aria-hidden="true" />
                <span>Check-in</span>
              </button>
            </div>
          </div>

          {leaderboardOpen && (
            <div
              className="space-y-1 rounded-xl p-2.5"
              style={{ backgroundColor: SURFACE.sunken, border: `1px solid ${GLASS.border}` }}
            >
              {leaderboard.length === 0 ? (
                <p className="text-[11px]" style={{ color: TEXT.tertiary }}>
                  Aún no hay actividad registrada en el ranking de este mes.
                </p>
              ) : (
                leaderboard.slice(0, 5).map((row, idx) => (
                  <div key={row.userId} className="flex items-center justify-between text-[11px]">
                    <span className="truncate text-white">
                      <strong className="font-mono" style={{ color: idx < 3 ? ACCENT.text : TEXT.secondary }}>
                        #{idx + 1}
                      </strong>{" "}
                      {row.displayName}
                    </span>
                    <span className="font-mono font-bold tabular-nums text-white">
                      {row.sessionsCount} ses.
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

import { useCallback, useEffect, useState } from "react";
import { useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import { CheckCircle2, Flame, QrCode, Trophy } from "lucide-react";
import type { WorkspaceOutletContext } from "@/App";
import { ACCENT, GLASS, RADIUS, STATUS, SURFACE, TEXT } from "@/design/tokens";
import { useProfile } from "@/hooks/useProfile";
import { listGymChallenges, type GymChallenge } from "@/services/gymOperationsService";
import {
  checkInAtReception,
  getMonthlyChallengeLeaderboard,
  type ChallengeLeaderboardRow,
  type CheckinResult,
} from "@/services/attendanceAndClubService";

export function ReceptionCheckinPage() {
  const outlet = useOutletContext<WorkspaceOutletContext | undefined>();
  const userId = outlet?.userId ?? "";
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const gate = searchParams.get("gate");

  const { profile } = useProfile(userId || null);
  const [checkinResult, setCheckinResult] = useState<CheckinResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [leaderboard, setLeaderboard] = useState<ChallengeLeaderboardRow[]>([]);
  const [challenge, setChallenge] = useState<GymChallenge | null>(null);

  const performCheckin = useCallback(
    async (source = "qr_reception") => {
      if (!userId || busy) return;
      setBusy(true);
      try {
        const res = await checkInAtReception(
          userId,
          profile?.display_name || "Atleta Cronos",
          source,
        );
        setCheckinResult(res);
        const lb = await getMonthlyChallengeLeaderboard();
        setLeaderboard(lb);
      } finally {
        setBusy(false);
      }
    },
    [busy, profile?.display_name, userId],
  );

  useEffect(() => {
    void Promise.all([getMonthlyChallengeLeaderboard(), listGymChallenges()]).then(([lb, ch]) => {
      setLeaderboard(lb);
      setChallenge(ch.find((c) => c.active) ?? ch[0] ?? null);
    });
  }, []);

  useEffect(() => {
    if (gate && userId && !checkinResult && !busy) {
      void performCheckin(gate);
    }
  }, [busy, checkinResult, gate, performCheckin, userId]);

  const targetSessions = challenge?.targetSessions ?? 16;

  return (
    <main
      className="min-h-screen w-full px-4 pb-32 pt-5 text-white"
      style={{ backgroundColor: SURFACE.base }}
    >
      <div className="mx-auto max-w-xl space-y-5">
        <section
          className="space-y-4 p-5"
          style={{
            backgroundColor: SURFACE.l1,
            border: `1px solid ${checkinResult ? STATUS.success.border : GLASS.border}`,
            borderRadius: RADIUS.card,
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
              style={{
                backgroundColor: checkinResult ? STATUS.success.muted : ACCENT.subtle,
                color: checkinResult ? STATUS.success.text : ACCENT.base,
              }}
            >
              {checkinResult ? <CheckCircle2 size={24} /> : <QrCode size={24} />}
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: ACCENT.text }}>
                CRONOS GYM · RECEPCIÓN
              </p>
              <h1 className="text-lg font-extrabold text-white">
                {checkinResult
                  ? checkinResult.alreadyCheckedIn
                    ? "Tu asistencia de hoy ya estaba registrada"
                    : "¡Check-in registrado! Buen entreno"
                  : "Registro de asistencia diaria"}
              </h1>
            </div>
          </div>

          {checkinResult ? (
            <div className="grid grid-cols-2 gap-3">
              <div
                className="rounded-2xl p-3"
                style={{ backgroundColor: SURFACE.sunken, border: `1px solid ${GLASS.border}` }}
              >
                <span className="text-[11px]" style={{ color: TEXT.tertiary }}>
                  Racha actual
                </span>
                <p className="mt-1 font-mono text-xl font-bold text-white">
                  {checkinResult.streakDays} {checkinResult.streakDays === 1 ? "día" : "días"}
                </p>
              </div>
              <div
                className="rounded-2xl p-3"
                style={{ backgroundColor: SURFACE.sunken, border: `1px solid ${GLASS.border}` }}
              >
                <span className="text-[11px]" style={{ color: TEXT.tertiary }}>
                  Visitas del mes
                </span>
                <p className="mt-1 font-mono text-xl font-bold" style={{ color: ACCENT.text }}>
                  {checkinResult.visitsThisMonth}/{targetSessions}
                </p>
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={busy || !userId}
              onClick={() => void performCheckin("manual_checkin")}
              className="h-12 w-full rounded-2xl text-sm font-bold text-white disabled:opacity-50"
              style={{ backgroundColor: ACCENT.base }}
            >
              {busy ? "Registrando entrada…" : "Registrar asistencia hoy"}
            </button>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => navigate("/rutinas")}
              className="h-10 flex-1 rounded-xl text-xs font-bold text-white"
              style={{ backgroundColor: SURFACE.sunken, border: `1px solid ${GLASS.border}` }}
            >
              Elegir rutina
            </button>
            <button
              type="button"
              onClick={() => navigate("/inicio")}
              className="h-10 flex-1 rounded-xl text-xs font-semibold"
              style={{
                backgroundColor: SURFACE.sunken,
                border: `1px solid ${GLASS.border}`,
                color: TEXT.secondary,
              }}
            >
              Ir al Inicio
            </button>
          </div>
        </section>

        {/* Live Monthly Challenge Leaderboard */}
        <section
          className="space-y-3 p-5"
          style={{
            backgroundColor: SURFACE.l1,
            border: `1px solid ${GLASS.border}`,
            borderRadius: RADIUS.card,
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Trophy size={18} style={{ color: ACCENT.base }} />
              <div>
                <h2 className="text-sm font-bold text-white">Ranking en vivo del mes</h2>
                <p className="text-[11px]" style={{ color: TEXT.secondary }}>
                  {challenge?.title ?? `Meta: ${targetSessions} asistencias o sesiones`}
                </p>
              </div>
            </div>
            <Flame size={16} style={{ color: ACCENT.text }} />
          </div>

          {leaderboard.length === 0 ? (
            <p className="text-xs" style={{ color: TEXT.tertiary }}>
              Sé el primero en sumar una visita o entrenamiento este mes.
            </p>
          ) : (
            <ol className="space-y-1.5">
              {leaderboard.slice(0, 10).map((entry, idx) => {
                const isMe = entry.userId === userId;
                return (
                  <li
                    key={entry.userId}
                    className="flex items-center justify-between rounded-xl px-3 py-2 text-xs"
                    style={{
                      backgroundColor: isMe ? ACCENT.subtle : SURFACE.sunken,
                      border: `1px solid ${isMe ? ACCENT.border : GLASS.border}`,
                    }}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className="font-mono font-bold tabular-nums"
                        style={{ color: idx < 3 ? ACCENT.text : TEXT.tertiary }}
                      >
                        #{idx + 1}
                      </span>
                      <span className="truncate font-semibold text-white">
                        {entry.displayName} {isMe ? "(Tú)" : ""}
                      </span>
                    </div>
                    <span className="font-mono font-bold tabular-nums text-white">
                      {entry.sessionsCount} d
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>
    </main>
  );
}

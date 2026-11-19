import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, CopyPlus, Dumbbell, Users } from "lucide-react";
import { supabase } from "@lib/supabase";
import { ACCENT, GLASS, RADIUS, STATUS, SURFACE, TEXT } from "@/design/tokens";
import { resolveMediaUrl } from "@/lib/media/mediaResolver";
import {
  cloneSharedRoutineToUser,
  fetchSharedRoutineByCode,
  type SharedRoutineRecord,
} from "@/services/sharedRoutineService";

export function SharedRoutinePage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();

  const [shared, setShared] = useState<SharedRoutineRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [cloning, setCloning] = useState(false);
  const [cloned, setCloned] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (alive) setUserId(data.session?.user.id ?? null);
      })
      .catch(() => undefined);

    if (code) {
      void fetchSharedRoutineByCode(code)
        .then((rec) => {
          if (!alive) return;
          setShared(rec);
          setLoading(false);
        })
        .catch(() => {
          if (alive) setLoading(false);
        });
    } else {
      setLoading(false);
    }

    return () => {
      alive = false;
    };
  }, [code]);

  const handleClone = async () => {
    if (!shared) return;
    if (!userId) {
      navigate("/inicio");
      return;
    }
    if (cloning || cloned) return;
    setCloning(true);
    setError(null);
    try {
      const res = await cloneSharedRoutineToUser(shared, userId);
      if (res.ok) {
        setCloned(true);
        setShared((prev) => (prev ? { ...prev, cloneCount: prev.cloneCount + 1 } : prev));
      } else {
        setError("No se pudo clonar la rutina en tu cuenta.");
      }
    } finally {
      setCloning(false);
    }
  };

  if (loading) {
    return (
      <main
        className="flex min-h-screen items-center justify-center p-4 text-xs"
        style={{ backgroundColor: SURFACE.base, color: TEXT.secondary }}
      >
        Cargando rutina compartida…
      </main>
    );
  }

  if (!shared) {
    return (
      <main
        className="flex min-h-screen items-center justify-center px-4 py-12 text-white"
        style={{ backgroundColor: SURFACE.base }}
      >
        <section
          className="w-full max-w-md space-y-4 rounded-3xl p-6 text-center"
          style={{ backgroundColor: SURFACE.l1, border: `1px solid ${GLASS.border}` }}
        >
          <Dumbbell className="mx-auto h-10 w-10" style={{ color: ACCENT.base }} />
          <h1 className="text-lg font-bold text-white">Rutina compartida no encontrada</h1>
          <p className="text-xs" style={{ color: TEXT.secondary }}>
            El enlace o código QR expiró o no existe en Cronos Gym.
          </p>
          <button
            type="button"
            onClick={() => navigate(userId ? "/rutinas" : "/inicio")}
            className="h-11 w-full rounded-2xl text-sm font-bold text-white"
            style={{ backgroundColor: ACCENT.base }}
          >
            {userId ? "Ver Mis Rutinas" : "Ir a Cronos Gym"}
          </button>
        </section>
      </main>
    );
  }

  const trainingDays = shared.payload.days.filter((d) => d.kind === "training" && d.exercises.length > 0);
  const totalExercises = trainingDays.reduce((sum, d) => sum + d.exercises.length, 0);

  return (
    <main
      className="min-h-screen w-full px-4 pb-28 pt-4 text-white"
      style={{ backgroundColor: SURFACE.base }}
    >
      <div className="mx-auto max-w-2xl space-y-4">
        <header className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate(userId ? "/rutinas" : "/inicio")}
            className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-white"
            style={{ backgroundColor: GLASS.fillRaised, border: `1px solid ${GLASS.border}` }}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>{userId ? "Rutinas" : "Cronos Gym"}</span>
          </button>
          <span
            className="inline-flex items-center gap-1 rounded-full px-3 py-1 font-mono text-[11px] font-bold"
            style={{ backgroundColor: ACCENT.subtle, border: `1px solid ${ACCENT.border}`, color: ACCENT.text }}
          >
            <Users className="h-3 w-3" />
            {shared.cloneCount} clonaciones
          </span>
        </header>

        <section
          className="space-y-3 p-5"
          style={{
            backgroundColor: SURFACE.l1,
            border: `1px solid ${GLASS.border}`,
            borderRadius: RADIUS.card,
          }}
        >
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: ACCENT.text }}>
              Compartida por {shared.ownerName}
            </p>
            <h1 className="mt-1 text-2xl font-extrabold text-white">{shared.title}</h1>
            <p className="mt-1 text-xs" style={{ color: TEXT.secondary }}>
              {trainingDays.length} {trainingDays.length === 1 ? "día" : "días"} · {totalExercises} ejercicios
            </p>
          </div>

          {error && (
            <p className="rounded-xl px-3 py-2 text-xs" style={{ backgroundColor: ACCENT.subtle, color: ACCENT.text }}>
              {error}
            </p>
          )}

          {cloned ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <div
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl text-xs font-bold"
                style={{ backgroundColor: STATUS.success.muted, color: STATUS.success.text }}
              >
                <Check className="h-4 w-4" />
                <span>¡Clonada a Mis Rutinas!</span>
              </div>
              <button
                type="button"
                onClick={() => navigate("/rutinas")}
                className="h-12 rounded-2xl px-5 text-sm font-bold text-white"
                style={{ backgroundColor: ACCENT.base }}
              >
                Abrir Mis Rutinas
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={cloning}
              onClick={() => void handleClone()}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-bold text-white"
              style={{ backgroundColor: ACCENT.base, boxShadow: `0 4px 18px ${ACCENT.glow}` }}
            >
              <CopyPlus className="h-4 w-4" />
              <span>
                {cloning
                  ? "Clonando rutina…"
                  : userId
                    ? "Clonar a Mis Rutinas en 1 toque"
                    : "Inicia sesión para clonar en 1 toque"}
              </span>
            </button>
          )}
        </section>

        <div className="space-y-3">
          {trainingDays.map((day, dIdx) => (
            <section
              key={`${day.order}-${dIdx}`}
              className="space-y-2.5 p-4"
              style={{
                backgroundColor: SURFACE.l1,
                border: `1px solid ${GLASS.border}`,
                borderRadius: RADIUS.surface,
              }}
            >
              <h2 className="text-sm font-bold text-white">{day.label || `Día ${day.order + 1}`}</h2>
              <ul className="space-y-2">
                {day.exercises.map((ex, idx) => (
                  <li
                    key={`${ex.exerciseId}-${idx}`}
                    className="flex items-center gap-3 rounded-xl p-2"
                    style={{ backgroundColor: SURFACE.sunken }}
                  >
                    {ex.gifUrl ? (
                      <img
                        src={resolveMediaUrl(ex.gifUrl)}
                        alt={ex.nameEs ?? ex.name}
                        className="h-12 w-12 shrink-0 rounded-lg bg-black object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-black">
                        <Dumbbell className="h-4 w-4 text-neutral-500" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-white">
                        {idx + 1}. {ex.nameEs ?? ex.name}
                      </p>
                      <p className="text-[11px]" style={{ color: TEXT.secondary }}>
                        {ex.targetSets} series × {ex.targetRepsMin ?? 8}–{ex.targetRepsMax ?? 12} reps · {ex.restSeconds}s desc.
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}

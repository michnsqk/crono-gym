import { useState } from "react";
import { Activity, Sparkles, X } from "lucide-react";
import { ACCENT, GLASS, STATUS, SURFACE, TEXT } from "@/design/tokens";
import type { SessionCheckinInput } from "@/hooks/useProfile";

const SLEEP_CHOICES = [5, 6, 7, 8, 9] as const;
const JOINT_TAGS = ["Ninguna", "Hombro", "Rodilla", "Lumbar"] as const;

export interface PreWorkoutCheckinCardProps {
  onSave: (input: SessionCheckinInput) => Promise<boolean>;
  onDismiss: () => void;
  onApplyRecoveryLoad: () => void;
}

export function PreWorkoutCheckinCard({
  onSave,
  onDismiss,
  onApplyRecoveryLoad,
}: PreWorkoutCheckinCardProps) {
  const [energy, setEnergy] = useState(4);
  const [sleepHours, setSleepHours] = useState(7);
  const [soreness, setSoreness] = useState(2);
  const [discomfort, setDiscomfort] = useState<string>("Ninguna");
  const [saving, setSaving] = useState(false);
  const [savedRecoveryMode, setSavedRecoveryMode] = useState(false);

  const isLowReadiness = energy <= 2 || sleepHours < 6 || soreness >= 4;

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const notes = discomfort !== "Ninguna" ? `Molestia: ${discomfort}` : null;
      await onSave({ energy, sleepHours, soreness, notes });
      if (isLowReadiness) {
        setSavedRecoveryMode(true);
      } else {
        onDismiss();
      }
    } finally {
      setSaving(false);
    }
  };

  if (savedRecoveryMode) {
    return (
      <section
        aria-label="Ajuste automático por check-in"
        className="mx-auto mb-3 w-full max-w-[560px] rounded-2xl p-3.5"
        style={{ backgroundColor: SURFACE.l1, border: `1px solid ${ACCENT.border}` }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <Sparkles size={16} style={{ color: ACCENT.text, flexShrink: 0, marginTop: 2 }} />
            <div>
              <p className="text-xs font-bold text-white">
                Check-in guardado · Hoy conviene autorregular
              </p>
              <p className="mt-0.5 text-xs" style={{ color: TEXT.secondary }}>
                Reportaste energía baja, poco sueño o fatiga alta. Cronos IA ya tiene este dato; si quieres, bajamos 10% tus cargas de hoy.
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Cerrar recomendación de recuperación"
            onClick={onDismiss}
            className="text-xs text-neutral-400"
          >
            <X size={15} />
          </button>
        </div>
        <div className="mt-2.5 flex gap-2">
          <button
            type="button"
            onClick={() => {
              onApplyRecoveryLoad();
              onDismiss();
            }}
            className="h-9 flex-1 rounded-xl text-xs font-bold text-white"
            style={{ backgroundColor: ACCENT.base }}
          >
            Aplicar -10% de descarga hoy
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="h-9 rounded-xl px-3 text-xs font-semibold text-neutral-300"
            style={{ backgroundColor: SURFACE.sunken, border: `1px solid ${GLASS.border}` }}
          >
            Mantener cargas
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label="Check-in rápido pre-entreno"
      className="mx-auto mb-3 w-full max-w-[560px] rounded-2xl p-3.5"
      style={{ backgroundColor: SURFACE.l1, border: `1px solid ${GLASS.border}` }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity size={15} style={{ color: ACCENT.text }} aria-hidden="true" />
          <span className="text-xs font-bold text-white">Check-in 5s · ¿Cómo llegaste hoy?</span>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Omitir check-in previo"
          className="rounded-lg px-2 py-1 text-xs text-neutral-400"
        >
          Omitir
        </button>
      </div>

      <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
        <div>
          <span className="text-[11px]" style={{ color: TEXT.secondary }}>
            Energía (1–5)
          </span>
          <div className="mt-1 grid grid-cols-5 gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setEnergy(n)}
                className="h-8 rounded-lg font-mono text-xs font-bold"
                style={{
                  backgroundColor: energy === n ? ACCENT.base : SURFACE.sunken,
                  border: `1px solid ${energy === n ? ACCENT.base : GLASS.border}`,
                  color: TEXT.primary,
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="text-[11px]" style={{ color: TEXT.secondary }}>
            Sueño (horas)
          </span>
          <div className="mt-1 grid grid-cols-5 gap-1">
            {SLEEP_CHOICES.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setSleepHours(h)}
                className="h-8 rounded-lg font-mono text-xs font-bold"
                style={{
                  backgroundColor: sleepHours === h ? ACCENT.base : SURFACE.sunken,
                  border: `1px solid ${sleepHours === h ? ACCENT.base : GLASS.border}`,
                  color: TEXT.primary,
                }}
              >
                {h === 9 ? "9+" : `${h}h`}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div>
          <span className="text-[11px]" style={{ color: TEXT.secondary }}>
            Fatiga / dolor (1–5)
          </span>
          <div className="mt-1 grid grid-cols-5 gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setSoreness(n)}
                className="h-8 rounded-lg font-mono text-xs font-bold"
                style={{
                  backgroundColor:
                    soreness === n
                      ? n >= 4
                        ? STATUS.warning.base
                        : ACCENT.base
                      : SURFACE.sunken,
                  border: `1px solid ${soreness === n ? ACCENT.base : GLASS.border}`,
                  color: TEXT.primary,
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="text-[11px]" style={{ color: TEXT.secondary }}>
            Molestia articular
          </span>
          <div className="mt-1 grid grid-cols-4 gap-1">
            {JOINT_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setDiscomfort(tag)}
                className="h-8 truncate rounded-lg px-1 text-[11px] font-semibold"
                style={{
                  backgroundColor: discomfort === tag ? ACCENT.subtle : SURFACE.sunken,
                  border: `1px solid ${discomfort === tag ? ACCENT.border : GLASS.border}`,
                  color: discomfort === tag ? ACCENT.text : TEXT.secondary,
                }}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        type="button"
        disabled={saving}
        onClick={() => void handleSave()}
        className="mt-2.5 h-9 w-full rounded-xl text-xs font-bold text-white"
        style={{ backgroundColor: ACCENT.base }}
      >
        {saving ? "Guardando…" : "Guardar check-in y entrenar"}
      </button>
    </section>
  );
}

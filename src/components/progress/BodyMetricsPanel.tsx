import { useMemo, useState, type FormEvent } from "react";
import { Activity, Check, Ruler, Scale, Sparkles } from "lucide-react";
import { ACCENT, GLASS, RADIUS, STATUS, SURFACE, TEXT, TYPE } from "@/design/tokens";
import { useBodyMetrics } from "@/hooks/useProfile";
import type { BodyMeasurement } from "@/types/supabase";

type MetricsTab = "weight" | "measurements" | "checkin";

const MEASUREMENT_FIELDS: Array<{
  key: keyof Pick<
    BodyMeasurement,
    "waist_cm" | "chest_cm" | "arm_cm" | "thigh_cm" | "hips_cm" | "shoulder_cm" | "calf_cm" | "body_fat_pct"
  >;
  inputKey:
    | "waistCm"
    | "chestCm"
    | "armCm"
    | "thighCm"
    | "hipsCm"
    | "shoulderCm"
    | "calfCm"
    | "bodyFatPct";
  label: string;
  unit: string;
  placeholder: string;
}> = [
  { key: "waist_cm", inputKey: "waistCm", label: "Cintura", unit: "cm", placeholder: "80" },
  { key: "chest_cm", inputKey: "chestCm", label: "Pecho", unit: "cm", placeholder: "102" },
  { key: "arm_cm", inputKey: "armCm", label: "Brazo", unit: "cm", placeholder: "37" },
  { key: "thigh_cm", inputKey: "thighCm", label: "Muslo", unit: "cm", placeholder: "58" },
  { key: "hips_cm", inputKey: "hipsCm", label: "Cadera", unit: "cm", placeholder: "95" },
  { key: "shoulder_cm", inputKey: "shoulderCm", label: "Hombro", unit: "cm", placeholder: "118" },
  { key: "calf_cm", inputKey: "calfCm", label: "Pantorrilla", unit: "cm", placeholder: "38" },
  { key: "body_fat_pct", inputKey: "bodyFatPct", label: "% Grasa", unit: "%", placeholder: "15.5" },
];

const SLEEP_OPTIONS = [5, 6, 7, 8, 9] as const;

export function BodyMetricsPanel({ userId }: { userId: string }) {
  const {
    weights,
    latestWeight,
    changeLast30Days,
    measurements,
    checkins,
    todayCheckin,
    loading,
    error,
    logWeight,
    logMeasurement,
    logCheckin,
  } = useBodyMetrics(userId);

  const [tab, setTab] = useState<MetricsTab>("weight");
  const [weightInput, setWeightInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [measureDraft, setMeasureDraft] = useState<Record<string, string>>({});
  const [measureNote, setMeasureNote] = useState("");
  const [showMeasureForm, setShowMeasureForm] = useState(false);

  const [energy, setEnergy] = useState<number>(() => todayCheckin?.energy ?? 4);
  const [sleepHours, setSleepHours] = useState<number>(() => todayCheckin?.sleep_hours ?? 7);
  const [soreness, setSoreness] = useState<number>(() => todayCheckin?.soreness ?? 2);
  const [checkinNotes, setCheckinNotes] = useState("");

  const chartSeries = useMemo(() => {
    const slice = [...weights].slice(0, 14).reverse();
    if (slice.length < 2) return null;
    const minW = Math.min(...slice.map((w) => w.weight_kg));
    const maxW = Math.max(...slice.map((w) => w.weight_kg));
    const span = Math.max(0.5, maxW - minW);
    const width = 280;
    const height = 72;
    const points = slice
      .map((entry, idx) => {
        const x = (idx / Math.max(1, slice.length - 1)) * width;
        const y = height - 8 - ((entry.weight_kg - minW) / span) * (height - 16);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
    return { slice, points, width, height, minW, maxW };
  }, [weights]);

  const latestMeasurement = measurements[0] ?? null;
  const prevMeasurement = measurements[1] ?? null;

  const showSuccess = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3500);
  };

  const handleWeightSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = Number(weightInput.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed < 20 || parsed > 350 || saving) return;
    setSaving(true);
    try {
      const ok = await logWeight(Math.round(parsed * 10) / 10);
      if (ok) {
        setWeightInput("");
        showSuccess("Peso registrado para hoy.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleMeasurementsSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const num = (k: string): number | null => {
      const raw = measureDraft[k]?.trim().replace(",", ".");
      if (!raw) return null;
      const val = Number(raw);
      return Number.isFinite(val) && val > 0 ? Math.round(val * 10) / 10 : null;
    };
    const payload = {
      waistCm: num("waistCm"),
      chestCm: num("chestCm"),
      armCm: num("armCm"),
      thighCm: num("thighCm"),
      hipsCm: num("hipsCm"),
      shoulderCm: num("shoulderCm"),
      calfCm: num("calfCm"),
      bodyFatPct: num("bodyFatPct"),
      note: measureNote,
    };
    if (Object.values(payload).every((v) => v === null || v === "")) return;
    setSaving(true);
    try {
      const ok = await logMeasurement(payload);
      if (ok) {
        setMeasureDraft({});
        setMeasureNote("");
        setShowMeasureForm(false);
        showSuccess("Medidas guardadas en tu historial.");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCheckinSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const ok = await logCheckin({
        energy,
        sleepHours,
        soreness,
        notes: checkinNotes || null,
      });
      if (ok) {
        setCheckinNotes("");
        showSuccess("Check-in guardado. Cronos IA ajustará tus recomendaciones de hoy.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      className="space-y-4 p-4 sm:p-5"
      style={{
        backgroundColor: SURFACE.l1,
        border: `1px solid ${GLASS.border}`,
        borderRadius: RADIUS.card,
      }}
      aria-label="Peso corporal, medidas y estado diario"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p
            className="font-bold uppercase"
            style={{
              fontSize: TYPE.label.size,
              letterSpacing: TYPE.label.tracking,
              color: ACCENT.text,
            }}
          >
            Biometría &amp; Readiness
          </p>
          <h3 className="mt-0.5 text-base font-bold text-white">
            Peso, medidas y check-in diario
          </h3>
        </div>

        <div
          className="grid grid-cols-3 gap-1 rounded-xl p-1"
          style={{ backgroundColor: SURFACE.sunken, border: `1px solid ${GLASS.border}` }}
          role="tablist"
        >
          {(
            [
              { id: "weight", label: "Peso", icon: Scale },
              { id: "measurements", label: "Medidas", icon: Ruler },
              { id: "checkin", label: "Check-in", icon: Activity },
            ] as const
          ).map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(id)}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-colors"
                style={{
                  backgroundColor: active ? ACCENT.base : "transparent",
                  color: active ? TEXT.primary : TEXT.secondary,
                }}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <p className="rounded-xl px-3 py-2 text-xs" style={{ backgroundColor: ACCENT.subtle, color: ACCENT.text }}>
          {error}
        </p>
      )}
      {feedback && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold"
          style={{ backgroundColor: STATUS.success.muted, color: STATUS.success.text }}
        >
          <Check className="h-3.5 w-3.5 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {tab === "weight" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div
              className="rounded-2xl p-3"
              style={{ backgroundColor: SURFACE.sunken, border: `1px solid ${GLASS.border}` }}
            >
              <span className="text-[11px]" style={{ color: TEXT.tertiary }}>
                Peso actual
              </span>
              <p className="mt-1 font-mono text-xl font-bold tabular-nums text-white">
                {latestWeight != null ? `${latestWeight.toFixed(1)} kg` : "Sin registro"}
              </p>
            </div>
            <div
              className="rounded-2xl p-3"
              style={{ backgroundColor: SURFACE.sunken, border: `1px solid ${GLASS.border}` }}
            >
              <span className="text-[11px]" style={{ color: TEXT.tertiary }}>
                Cambio 30 días
              </span>
              <p
                className="mt-1 font-mono text-xl font-bold tabular-nums"
                style={{
                  color:
                    changeLast30Days == null
                      ? TEXT.secondary
                      : changeLast30Days <= 0
                        ? STATUS.success.text
                        : ACCENT.text,
                }}
              >
                {changeLast30Days != null
                  ? `${changeLast30Days > 0 ? "+" : ""}${changeLast30Days.toFixed(1)} kg`
                  : "—"}
              </p>
            </div>
          </div>

          {chartSeries && (
            <div
              className="rounded-2xl p-3"
              style={{ backgroundColor: SURFACE.sunken, border: `1px solid ${GLASS.border}` }}
            >
              <div className="mb-1 flex items-center justify-between text-[11px]" style={{ color: TEXT.tertiary }}>
                <span>Tendencia ({chartSeries.slice.length} pesajes)</span>
                <span className="font-mono tabular-nums">
                  {chartSeries.minW.toFixed(1)} – {chartSeries.maxW.toFixed(1)} kg
                </span>
              </div>
              <svg
                viewBox={`0 0 ${chartSeries.width} ${chartSeries.height}`}
                className="h-18 w-full overflow-visible"
                role="img"
                aria-label="Gráfica de peso corporal reciente"
              >
                <polyline
                  fill="none"
                  stroke={ACCENT.base}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={chartSeries.points}
                />
              </svg>
            </div>
          )}

          <form onSubmit={(e) => void handleWeightSubmit(e)} className="flex gap-2">
            <input
              type="number"
              step="0.1"
              min="20"
              max="350"
              inputMode="decimal"
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              placeholder={latestWeight != null ? `Ej. ${latestWeight.toFixed(1)} kg` : "Ej. 74.5 kg"}
              aria-label="Peso corporal en kg"
              className="h-11 flex-1 rounded-xl border border-white/10 bg-black/50 px-3 font-mono text-sm text-white placeholder:text-neutral-500"
            />
            <button
              type="submit"
              disabled={saving || !weightInput.trim()}
              className="h-11 rounded-xl px-4 text-xs font-bold text-white disabled:opacity-40"
              style={{ backgroundColor: ACCENT.base }}
            >
              {saving ? "Guardando…" : "Registrar hoy"}
            </button>
          </form>

          {weights.length > 0 && (
            <div className="space-y-1">
              {weights.slice(0, 5).map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between rounded-xl px-3 py-2 text-xs"
                  style={{ backgroundColor: SURFACE.sunken }}
                >
                  <span style={{ color: TEXT.secondary }}>{entry.measured_on}</span>
                  <span className="font-mono font-bold tabular-nums text-white">
                    {entry.weight_kg.toFixed(1)} kg
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "measurements" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs" style={{ color: TEXT.secondary }}>
              {latestMeasurement
                ? `Último registro: ${latestMeasurement.measured_on}`
                : "Sin medidas corporales registradas aún."}
            </span>
            <button
              type="button"
              onClick={() => setShowMeasureForm((prev) => !prev)}
              className="h-9 rounded-xl px-3 text-xs font-bold text-white"
              style={{ backgroundColor: showMeasureForm ? GLASS.fillRaised : ACCENT.base }}
            >
              {showMeasureForm ? "Cerrar" : "+ Registrar medidas"}
            </button>
          </div>

          {showMeasureForm && (
            <form
              onSubmit={(e) => void handleMeasurementsSubmit(e)}
              className="space-y-3 rounded-2xl p-3.5"
              style={{ backgroundColor: SURFACE.sunken, border: `1px solid ${GLASS.border}` }}
            >
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {MEASUREMENT_FIELDS.map((field) => (
                  <label key={field.inputKey} className="grid gap-1">
                    <span className="text-[11px]" style={{ color: TEXT.secondary }}>
                      {field.label} ({field.unit})
                    </span>
                    <input
                      type="number"
                      step="0.1"
                      inputMode="decimal"
                      value={measureDraft[field.inputKey] ?? ""}
                      onChange={(e) =>
                        setMeasureDraft((prev) => ({ ...prev, [field.inputKey]: e.target.value }))
                      }
                      placeholder={
                        latestMeasurement?.[field.key] != null
                          ? String(latestMeasurement[field.key])
                          : field.placeholder
                      }
                      className="h-10 rounded-xl border border-white/10 bg-black/50 px-2.5 font-mono text-xs text-white placeholder:text-neutral-500"
                    />
                  </label>
                ))}
              </div>
              <input
                type="text"
                value={measureNote}
                onChange={(e) => setMeasureNote(e.target.value)}
                placeholder="Nota opcional (ej. en ayunas)"
                className="h-10 w-full rounded-xl border border-white/10 bg-black/50 px-3 text-xs text-white placeholder:text-neutral-500"
              />
              <button
                type="submit"
                disabled={saving}
                className="h-11 w-full rounded-xl text-xs font-bold text-white"
                style={{ backgroundColor: ACCENT.base }}
              >
                {saving ? "Guardando…" : "Guardar medidas de hoy"}
              </button>
            </form>
          )}

          {latestMeasurement && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {MEASUREMENT_FIELDS.map((field) => {
                const val = latestMeasurement[field.key];
                if (val == null) return null;
                const prevVal = prevMeasurement?.[field.key];
                const delta =
                  prevVal != null ? Math.round((Number(val) - Number(prevVal)) * 10) / 10 : null;
                return (
                  <div
                    key={field.key}
                    className="rounded-xl p-2.5"
                    style={{ backgroundColor: SURFACE.sunken, border: `1px solid ${GLASS.border}` }}
                  >
                    <span className="text-[11px]" style={{ color: TEXT.tertiary }}>
                      {field.label}
                    </span>
                    <div className="mt-0.5 flex items-baseline justify-between gap-1">
                      <span className="font-mono text-sm font-bold tabular-nums text-white">
                        {Number(val).toFixed(1)} {field.unit}
                      </span>
                      {delta != null && delta !== 0 && (
                        <span
                          className="font-mono text-[10px] font-semibold tabular-nums"
                          style={{ color: ACCENT.text }}
                        >
                          {delta > 0 ? "+" : ""}
                          {delta.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === "checkin" && (
        <div className="space-y-4">
          {todayCheckin && (
            <div
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl p-3 text-xs"
              style={{ backgroundColor: STATUS.success.muted, color: STATUS.success.text }}
            >
              <span className="inline-flex items-center gap-1.5 font-bold">
                <Sparkles className="h-3.5 w-3.5" />
                Check-in de hoy listo: Energía {todayCheckin.energy ?? "—"}/5 · Sueño{" "}
                {todayCheckin.sleep_hours ?? "—"}h · Fatiga {todayCheckin.soreness ?? "—"}/5
              </span>
            </div>
          )}

          <form
            onSubmit={(e) => void handleCheckinSubmit(e)}
            className="space-y-3 rounded-2xl p-3.5"
            style={{ backgroundColor: SURFACE.sunken, border: `1px solid ${GLASS.border}` }}
          >
            <div>
              <span className="block text-[11px] font-semibold" style={{ color: TEXT.secondary }}>
                Energía hoy (1 = agotado · 5 = al 100%)
              </span>
              <div className="mt-1.5 grid grid-cols-5 gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setEnergy(n)}
                    className="h-10 rounded-xl font-mono text-xs font-bold"
                    style={{
                      backgroundColor: energy === n ? ACCENT.base : SURFACE.l1,
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
              <span className="block text-[11px] font-semibold" style={{ color: TEXT.secondary }}>
                Horas de sueño anoche
              </span>
              <div className="mt-1.5 grid grid-cols-5 gap-1.5">
                {SLEEP_OPTIONS.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setSleepHours(h)}
                    className="h-10 rounded-xl font-mono text-xs font-bold"
                    style={{
                      backgroundColor: sleepHours === h ? ACCENT.base : SURFACE.l1,
                      border: `1px solid ${sleepHours === h ? ACCENT.base : GLASS.border}`,
                      color: TEXT.primary,
                    }}
                  >
                    {h === 9 ? "9h+" : `${h}h`}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="block text-[11px] font-semibold" style={{ color: TEXT.secondary }}>
                Dolor / molestias musculares (1 = cero · 5 = muy adolorido)
              </span>
              <div className="mt-1.5 grid grid-cols-5 gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setSoreness(n)}
                    className="h-10 rounded-xl font-mono text-xs font-bold"
                    style={{
                      backgroundColor: soreness === n ? ACCENT.base : SURFACE.l1,
                      border: `1px solid ${soreness === n ? ACCENT.base : GLASS.border}`,
                      color: TEXT.primary,
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <input
              type="text"
              value={checkinNotes}
              onChange={(e) => setCheckinNotes(e.target.value)}
              placeholder="Molestia articular u observación (opcional)"
              className="h-10 w-full rounded-xl border border-white/10 bg-black/50 px-3 text-xs text-white placeholder:text-neutral-500"
            />

            <button
              type="submit"
              disabled={saving}
              className="h-11 w-full rounded-xl text-xs font-bold text-white"
              style={{ backgroundColor: ACCENT.base }}
            >
              {saving ? "Guardando…" : todayCheckin ? "Actualizar check-in de hoy" : "Guardar check-in diario"}
            </button>
          </form>

          {checkins.length > 0 && (
            <div className="space-y-1">
              {checkins.slice(0, 5).map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs"
                  style={{ backgroundColor: SURFACE.sunken }}
                >
                  <span style={{ color: TEXT.secondary }}>{item.checked_on}</span>
                  <span className="font-mono text-white">
                    E:{item.energy ?? "—"} · S:{item.sleep_hours ?? "—"}h · M:{item.soreness ?? "—"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {loading && weights.length === 0 && measurements.length === 0 && (
        <p className="text-xs" style={{ color: TEXT.tertiary }}>
          Cargando registros biométricos…
        </p>
      )}
    </section>
  );
}

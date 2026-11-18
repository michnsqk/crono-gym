import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  Check,
  Dumbbell,
  Flame,
  Sparkles,
} from "lucide-react";
import { MACHINE_GUIDE_CATALOG } from "@/data/machineGuideCatalog";
import { CRONOS_ATTACHMENTS_GUIDE } from "@/lib/workout/biomechanicalGripStance";
import { equipmentMap } from "@/data/equipmentMap";
import { CRONOS_MACHINERY_EXERCISES } from "@/lib/catalog/machinerySeedExercises";
import { resolveMediaUrl } from "@/lib/media/mediaResolver";
import { supabase } from "@lib/supabase";
import { submitMachineReport } from "@/services/gymOperationsService";
import { ACCENT, GLASS, STATUS, SURFACE, TEXT } from "@/design/tokens";

const REPORT_REASONS = [
  "Cable o polea dañada",
  "Asiento o pin atorado",
  "Falta maneral / discos",
  "Ruido mecánico o desgaste",
] as const;

export function PublicMachinePage() {
  const { equipmentId } = useParams<{ equipmentId: string }>();
  const navigate = useNavigate();
  const normalizedId = (equipmentId ?? "").trim().toUpperCase();

  const [userId, setUserId] = useState<string | null>(null);
  const [activeViewIdx, setActiveViewIdx] = useState(0);
  const [expandedExId, setExpandedExId] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<string>(REPORT_REASONS[0]);
  const [customReason, setCustomReason] = useState("");
  const [reportSent, setReportSent] = useState(false);
  const [reporting, setReporting] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (alive) setUserId(data.session?.user.id ?? null);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const machine = useMemo(
    () =>
      MACHINE_GUIDE_CATALOG.find((m) => m.equipmentId.toUpperCase() === normalizedId) ?? null,
    [normalizedId],
  );

  const attachment = useMemo(
    () =>
      !machine
        ? CRONOS_ATTACHMENTS_GUIDE.find((a) => a.equipmentId.toUpperCase() === normalizedId) ?? null
        : null,
    [machine, normalizedId],
  );

  const equipmentEntry = equipmentMap[normalizedId];
  const views = useMemo(() => {
    if (equipmentEntry?.views?.length) return equipmentEntry.views.map((v) => v.src);
    if (attachment?.imageUrl) return [attachment.imageUrl];
    return [];
  }, [attachment, equipmentEntry]);

  const matchingExercises = useMemo(
    () =>
      CRONOS_MACHINERY_EXERCISES.filter(
        (ex) => (ex.equipment_id ?? "").toUpperCase() === normalizedId,
      ),
    [normalizedId],
  );

  const displayName =
    machine?.name ?? attachment?.name ?? equipmentEntry?.name ?? null;
  const displayGroup = machine?.group ?? (attachment ? "Maneral / Accesorio" : "Cronos Gym");
  const displayMuscles = machine?.muscles ?? [...(attachment?.primaryMuscles ?? [])];
  const displayTip = machine?.tip ?? attachment?.whyUseIt ?? "";

  if (!displayName) {
    return (
      <main
        className="flex min-h-screen w-full items-center justify-center px-4 py-12 text-white"
        style={{ backgroundColor: SURFACE.base }}
      >
        <section
          className="w-full max-w-md rounded-3xl p-6 text-center"
          style={{ backgroundColor: SURFACE.l1, border: `1px solid ${GLASS.border}` }}
        >
          <Dumbbell className="mx-auto mb-3 h-10 w-10" style={{ color: ACCENT.base }} />
          <p className="font-mono text-xs font-bold uppercase tracking-widest" style={{ color: ACCENT.text }}>
            {normalizedId || "QR CRONOS GYM"}
          </p>
          <h1 className="mt-1 text-lg font-bold text-white">Equipo no encontrado</h1>
          <p className="mt-2 text-xs leading-relaxed" style={{ color: TEXT.secondary }}>
            Este código no coincide con una estación activa de Cronos Gym. Explora las máquinas
            disponibles desde la app.
          </p>
          <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
            <button
              type="button"
              onClick={() => navigate("/rutinas")}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-2xl px-4 text-sm font-bold text-white"
              style={{ backgroundColor: ACCENT.base }}
            >
              Ver Atlas y Rutinas
            </button>
            <button
              type="button"
              onClick={() => navigate("/inicio")}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-2xl px-4 text-sm font-semibold text-white"
              style={{ backgroundColor: GLASS.fillRaised, border: `1px solid ${GLASS.border}` }}
            >
              Ir al Inicio
            </button>
          </div>
        </section>
      </main>
    );
  }

  const handleSubmitReport = async () => {
    const finalReason = customReason.trim() || reportReason;
    if (!finalReason || reporting) return;
    setReporting(true);
    try {
      await submitMachineReport({
        equipmentId: normalizedId,
        equipmentName: displayName,
        reportedBy: userId ?? "",
        reason: finalReason,
      });
      setReportSent(true);
      setReportOpen(false);
      setCustomReason("");
    } finally {
      setReporting(false);
    }
  };

  return (
    <main
      className="min-h-screen w-full px-4 pb-28 pt-4 text-white"
      style={{ backgroundColor: SURFACE.base }}
    >
      <div className="mx-auto max-w-2xl space-y-4">
        {/* Top bar */}
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
            className="rounded-full px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-wider"
            style={{
              backgroundColor: ACCENT.subtle,
              border: `1px solid ${ACCENT.border}`,
              color: ACCENT.text,
            }}
          >
            {normalizedId} · {displayGroup}
          </span>
        </header>

        {/* Hero Title */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: ACCENT.text }}>
            CRONOS GYM · ESTACIÓN OFICIAL
          </p>
          <h1 className="mt-0.5 text-2xl font-extrabold tracking-tight text-white">
            {displayName}
          </h1>
        </div>

        {/* Real Gym Equipment Gallery */}
        {views.length > 0 && (
          <div className="space-y-2">
            <div
              className="relative aspect-video w-full overflow-hidden rounded-3xl"
              style={{ backgroundColor: SURFACE.l1, border: `1px solid ${GLASS.border}` }}
            >
              <img
                src={resolveMediaUrl(views[activeViewIdx] ?? views[0])}
                alt={`${displayName} vista ${activeViewIdx + 1}`}
                className="h-full w-full object-contain"
              />
              <span
                className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold text-white"
                style={{ backgroundColor: SURFACE.overlay, border: `1px solid ${GLASS.border}` }}
              >
                <Camera className="h-3 w-3" />
                Vista {activeViewIdx + 1} / {views.length}
              </span>
            </div>

            {views.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {views.map((src, idx) => (
                  <button
                    key={src}
                    type="button"
                    onClick={() => setActiveViewIdx(idx)}
                    className="h-14 w-20 shrink-0 overflow-hidden rounded-xl"
                    style={{
                      border: idx === activeViewIdx ? `2px solid ${ACCENT.base}` : `1px solid ${GLASS.border}`,
                      opacity: idx === activeViewIdx ? 1 : 0.65,
                    }}
                  >
                    <img
                      src={resolveMediaUrl(src)}
                      alt={`Miniatura ${idx + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Target muscles & Biomechanical tip */}
        <section
          className="space-y-2.5 rounded-2xl p-4"
          style={{ backgroundColor: SURFACE.l1, border: `1px solid ${GLASS.border}` }}
        >
          {displayMuscles.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {displayMuscles.map((muscle) => (
                <span
                  key={muscle}
                  className="rounded-lg px-2.5 py-1 text-[11px] font-semibold text-white"
                  style={{ backgroundColor: ACCENT.subtle, border: `1px solid ${ACCENT.border}` }}
                >
                  {muscle}
                </span>
              ))}
            </div>
          )}
          {displayTip && (
            <p className="text-xs leading-relaxed" style={{ color: TEXT.secondary }}>
              <strong className="text-white">Tip del Coach Cronos: </strong>
              {displayTip}
            </p>
          )}
        </section>

        {/* Primary CTA */}
        <button
          type="button"
          onClick={() =>
            navigate(
              userId
                ? `/rutinas?machine=${encodeURIComponent(normalizedId)}`
                : "/inicio",
            )
          }
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-bold text-white active:scale-[0.99]"
          style={{ backgroundColor: ACCENT.base, boxShadow: `0 4px 18px ${ACCENT.glow}` }}
        >
          {userId ? <Flame className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
          <span>
            {userId
              ? "Entrenar / Armar rutina en esta máquina"
              : "Únete gratis a Cronos Gym y registra tus pesos"}
          </span>
        </button>

        {/* Exercises & Animated GIFs */}
        <section className="space-y-2.5">
          <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: TEXT.secondary }}>
            Ejercicios disponibles ({matchingExercises.length || machine?.exercises.length || attachment?.recommendedExercises.length || 0})
          </h2>

          {matchingExercises.length > 0 ? (
            <div className="grid gap-2.5 sm:grid-cols-2">
              {matchingExercises.map((ex) => {
                const gifSrc = resolveMediaUrl(ex.gif_url ?? ex.image ?? "");
                const expanded = expandedExId === ex.id;
                const steps = Array.isArray(ex.instructions) && ex.instructions.length > 0
                  ? ex.instructions
                  : displayTip
                    ? [displayTip]
                    : [];
                return (
                  <button
                    key={ex.id}
                    type="button"
                    onClick={() => setExpandedExId((prev) => (prev === ex.id ? null : ex.id))}
                    className="flex flex-col gap-2.5 rounded-2xl p-3 text-left"
                    style={{
                      backgroundColor: SURFACE.l1,
                      border: `1px solid ${expanded ? ACCENT.border : GLASS.border}`,
                    }}
                  >
                    <div className="flex w-full items-center gap-3">
                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-black">
                        {gifSrc ? (
                          <img
                            src={gifSrc}
                            alt={ex.name_es ?? ex.name}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Dumbbell className="h-5 w-5 text-neutral-500" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-white">
                          {ex.name_es ?? ex.name}
                        </p>
                        {steps[0] && (
                          <p className="mt-0.5 line-clamp-2 text-[11px] text-neutral-400">
                            {steps[0]}
                          </p>
                        )}
                        <span className="mt-1 inline-block text-[10px] font-bold" style={{ color: ACCENT.text }}>
                          {expanded ? "Ocultar técnica ▲" : "Ver GIF y pasos ▼"}
                        </span>
                      </div>
                    </div>

                    {expanded && (
                      <div
                        className="w-full space-y-2 rounded-xl p-2.5"
                        style={{ backgroundColor: GLASS.fillFaint, border: `1px solid ${GLASS.border}` }}
                      >
                        {gifSrc && (
                          <div className="mx-auto aspect-square w-44 overflow-hidden rounded-xl bg-black">
                            <img
                              src={gifSrc}
                              alt={ex.name_es ?? ex.name}
                              className="h-full w-full object-contain"
                            />
                          </div>
                        )}
                        <ol className="list-decimal space-y-1 pl-4 text-[11px] text-neutral-200">
                          {steps.map((s, idx) => (
                            <li key={idx}>{s}</li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <ul
              className="space-y-1.5 rounded-2xl p-3.5"
              style={{ backgroundColor: SURFACE.l1, border: `1px solid ${GLASS.border}` }}
            >
              {(machine?.exercises ?? attachment?.recommendedExercises ?? []).map((item) => (
                <li key={item} className="flex items-center gap-2 text-xs text-white">
                  <Check className="h-3.5 w-3.5 shrink-0" style={{ color: STATUS.success.text }} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Report maintenance issue */}
        <section
          className="rounded-2xl p-3.5"
          style={{ backgroundColor: SURFACE.l1, border: `1px solid ${GLASS.border}` }}
        >
          {reportSent ? (
            <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: STATUS.success.text }}>
              <Check className="h-4 w-4 shrink-0" />
              <span>¡Gracias! Reporte enviado en vivo a administración de Cronos Gym.</span>
            </div>
          ) : !reportOpen ? (
            <button
              type="button"
              onClick={() => setReportOpen(true)}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-xs font-semibold text-neutral-300"
            >
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              <span>Reportar falla o mantenimiento en esta máquina</span>
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-xs font-bold text-white">¿Qué falla presenta {displayName}?</p>
              <div className="flex flex-wrap gap-1.5">
                {REPORT_REASONS.map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setReportReason(reason)}
                    className="rounded-full px-3 py-1.5 text-[11px] font-semibold"
                    style={{
                      backgroundColor: reportReason === reason ? ACCENT.subtle : GLASS.fill,
                      border: `1px solid ${reportReason === reason ? ACCENT.border : GLASS.border}`,
                      color: reportReason === reason ? ACCENT.text : TEXT.secondary,
                    }}
                  >
                    {reason}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Detalle opcional (ej. cable suelto, tornillo flojo)"
                className="h-10 w-full rounded-xl border border-white/10 bg-black/50 px-3 text-xs text-white placeholder:text-neutral-500"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void handleSubmitReport()}
                  disabled={reporting}
                  className="h-10 flex-1 rounded-xl text-xs font-bold text-white"
                  style={{ backgroundColor: ACCENT.base }}
                >
                  {reporting ? "Enviando…" : "Enviar reporte"}
                </button>
                <button
                  type="button"
                  onClick={() => setReportOpen(false)}
                  className="h-10 rounded-xl border border-white/10 px-4 text-xs font-semibold text-neutral-300"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

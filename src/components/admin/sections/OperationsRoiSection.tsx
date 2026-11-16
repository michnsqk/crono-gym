import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Download,
  Flame,
  PauseCircle,
  Printer,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";
import { supabase } from "@lib/supabase";
import { ACCENT, GLASS, STATUS, TEXT } from "@/design/tokens";
import { equipmentMap } from "@/data/equipmentMap";
import {
  createGymChallenge,
  exportFullGymDatabaseCsv,
  getGymServiceStatus,
  listAdminAuditLogs,
  listDemandIntents,
  listGymChallenges,
  listMachineReports,
  openPrintableMachineQrSheet,
  setGymServiceStatus,
  updateMachineReportStatus,
  type AdminAuditEntry,
  type DemandIntent,
  type GymChallenge,
  type GymServiceMode,
  type MachineReport,
} from "@/services/gymOperationsService";

interface VipSummary {
  activeVips: number;
  expiringSoon7d: number;
}

export function OperationsRoiSection() {
  const [vipSummary, setVipSummary] = useState<VipSummary>({
    activeVips: 0,
    expiringSoon7d: 0,
  });
  const [challenges, setChallenges] = useState<GymChallenge[]>([]);
  const [reports, setReports] = useState<MachineReport[]>([]);
  const [intents, setIntents] = useState<DemandIntent[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditEntry[]>([]);
  const [serviceStatus, setServiceStatusState] = useState<GymServiceMode>("active");

  const [challengeTitle, setChallengeTitle] = useState("Completa 16 sesiones este mes");
  const [challengeTarget, setChallengeTarget] = useState(16);
  const [notice, setNotice] = useState<string | null>(null);
  const [actorId, setActorId] = useState("admin");

  const loadAll = useCallback(async () => {
    const [{ data: authData }, chgs, reps, ints, auds, status] = await Promise.all([
      supabase.auth.getUser(),
      listGymChallenges(),
      listMachineReports(),
      listDemandIntents(),
      listAdminAuditLogs(),
      getGymServiceStatus(),
    ]);

    if (authData.user?.id) setActorId(authData.user.id);
    setChallenges(chgs);
    setReports(reps);
    setIntents(ints);
    setAuditLogs(auds);
    setServiceStatusState(status);

    const { data: vips } = await supabase
      .from("coach_session_requests")
      .select("status,created_at,updated_at")
      .eq("status", "active");

    const now = Date.now();
    const cycleMs = 30 * 24 * 60 * 60 * 1000;
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    let activeVips = 0;
    let expiringSoon7d = 0;
    for (const v of vips ?? []) {
      activeVips += 1;
      const startMs = new Date(v.updated_at || v.created_at).getTime();
      const exp = startMs + cycleMs;
      if (exp >= now && exp - now <= sevenDaysMs) expiringSoon7d += 1;
    }
    setVipSummary({ activeVips, expiringSoon7d });
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // Top demand ranking from store/class intents
  const topDemand = useMemo(() => {
    const counts = new Map<string, { title: string; kind: string; count: number }>();
    for (const item of intents) {
      const prev = counts.get(item.itemId);
      counts.set(item.itemId, {
        title: item.itemTitle,
        kind: item.kind === "store" ? "Tienda" : "Clase",
        count: (prev?.count ?? 0) + 1,
      });
    }
    return Array.from(counts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [intents]);

  const estimatedVipRevenueMxn = vipSummary.activeVips * 400;
  const softwareMonthlyMxn = 750;
  const roiRatio =
    softwareMonthlyMxn > 0
      ? (estimatedVipRevenueMxn / softwareMonthlyMxn).toFixed(1)
      : "0.0";

  return (
    <div className="space-y-6">
      {/* Service Status Banner */}
      {serviceStatus !== "active" && (
        <div
          className="flex items-center gap-3 rounded-2xl p-4"
          style={{
            backgroundColor:
              serviceStatus === "paused_day7"
                ? "rgba(255, 59, 48, 0.14)"
                : "rgba(245, 158, 11, 0.14)",
            border: `1px solid ${serviceStatus === "paused_day7" ? ACCENT.base : "#F59E0B"}`,
          }}
        >
          <ShieldAlert
            size={20}
            color={serviceStatus === "paused_day7" ? ACCENT.base : "#F59E0B"}
          />
          <div className="text-xs text-white">
            {serviceStatus === "warning_day5"
              ? "Aviso Día 5: Recuerda cubrir la mensualidad del servicio antes del Día 7 para evitar Modo Pausa."
              : "Modo Pausa Día 7 activo: Plataforma en resguardo administrativo (datos conservados por 60 días)."}
          </div>
        </div>
      )}

      {notice && (
        <div
          role="status"
          className="rounded-2xl border border-white/10 bg-[#1C1C1E] p-3 text-xs text-white"
        >
          {notice}
        </div>
      )}

      {/* 1. Radar de Ingresos VIP en Recepción y ROI en Vivo */}
      <section className="rounded-2xl border border-white/10 bg-[#1C1C1E] p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} color={ACCENT.base} />
            <h2 className="text-sm font-bold text-white">
              1. Radar VIP en Recepción &amp; ROI en Vivo
            </h2>
          </div>
          <span className="font-mono text-xs tabular-nums" style={{ color: STATUS.progression.text }}>
            0% comisiones
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-[#09090B] p-3">
            <div className="text-[11px]" style={{ color: TEXT.secondary }}>
              VIP Activos
            </div>
            <div className="mt-1 font-mono text-lg font-bold tabular-nums text-white">
              {vipSummary.activeVips}
            </div>
          </div>
          <div className="rounded-xl bg-[#09090B] p-3">
            <div className="text-[11px]" style={{ color: TEXT.secondary }}>
              Por vencer (7d)
            </div>
            <div className="mt-1 font-mono text-lg font-bold tabular-nums" style={{ color: "#F59E0B" }}>
              {vipSummary.expiringSoon7d}
            </div>
          </div>
          <div className="rounded-xl bg-[#09090B] p-3">
            <div className="text-[11px]" style={{ color: TEXT.secondary }}>
              Retorno vs Sistema
            </div>
            <div className="mt-1 font-mono text-lg font-bold tabular-nums" style={{ color: ACCENT.text }}>
              {roiRatio}x
            </div>
          </div>
        </div>
        <p className="mt-3 text-xs" style={{ color: TEXT.secondary }}>
          Ingreso VIP estimado en efectivo:{" "}
          <strong className="font-mono tabular-nums text-white">
            ${estimatedVipRevenueMxn.toLocaleString("es-MX")} MXN/mes
          </strong>{" "}
          frente a mensualidad base de{" "}
          <strong className="font-mono tabular-nums text-white">${softwareMonthlyMxn} MXN</strong>.
        </p>
      </section>

      {/* 2. Pulso de Demanda de Tienda y Clases */}
      <section className="rounded-2xl border border-white/10 bg-[#1C1C1E] p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <Activity size={18} color={ACCENT.base} />
          <h2 className="text-sm font-bold text-white">
            2. Pulso de Demanda (Tienda &amp; Clases)
          </h2>
        </div>
        {topDemand.length === 0 ? (
          <p className="text-xs" style={{ color: TEXT.secondary }}>
            Aún no hay toques registrados en &ldquo;Apartar / Preguntar en recepción&rdquo;.
          </p>
        ) : (
          <div className="divide-y divide-white/10">
            {topDemand.map((row) => (
              <div key={row.title} className="flex items-center justify-between py-2.5 text-xs">
                <div>
                  <span className="font-semibold text-white">{row.title}</span>
                  <span className="ml-2 text-[11px]" style={{ color: TEXT.secondary }}>
                    ({row.kind})
                  </span>
                </div>
                <span className="font-mono font-bold tabular-nums" style={{ color: ACCENT.text }}>
                  {row.count} solicitudes
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 3. Lanzador de Retos del Gimnasio */}
      <section className="rounded-2xl border border-white/10 bg-[#1C1C1E] p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <Flame size={18} color={ACCENT.base} />
          <h2 className="text-sm font-bold text-white">
            3. Lanzador de Retos del Gimnasio
          </h2>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={challengeTitle}
            onChange={(e) => setChallengeTitle(e.target.value)}
            placeholder="Título del reto mensual"
            className="h-11 flex-1 rounded-xl border border-white/10 bg-[#09090B] px-3 text-sm text-white"
          />
          <input
            type="number"
            min={1}
            max={31}
            value={challengeTarget}
            onChange={(e) => setChallengeTarget(Number(e.target.value) || 16)}
            className="h-11 w-24 rounded-xl border border-white/10 bg-[#09090B] px-3 font-mono text-sm tabular-nums text-white"
          />
          <button
            type="button"
            onClick={async () => {
              const created = await createGymChallenge(challengeTitle, challengeTarget, actorId);
              setChallenges((prev) => [created, ...prev.map((c) => ({ ...c, active: false }))]);
              setNotice(`Reto activo publicado en /inicio: "${created.title}"`);
            }}
            className="h-11 rounded-xl px-4 text-sm font-semibold text-white active:scale-[0.98] transition-transform duration-150"
            style={{ backgroundColor: ACCENT.base }}
          >
            Activar reto
          </button>
        </div>
        {challenges.length > 0 && (
          <div className="mt-3 text-xs" style={{ color: TEXT.secondary }}>
            Reto vigente:{" "}
            <strong className="text-white">
              {challenges.find((c) => c.active)?.title ?? challenges[0].title}
            </strong>
          </div>
        )}
      </section>

      {/* 4. Inteligencia de Maquinaria, Mantenimiento y 77 QRs */}
      <section className="rounded-2xl border border-white/10 bg-[#1C1C1E] p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} color={ACCENT.base} />
            <h2 className="text-sm font-bold text-white">
              4. Maquinaria, Fallas &amp; {Object.keys(equipmentMap).length} QRs Imprimibles
            </h2>
          </div>
          <button
            type="button"
            onClick={() => openPrintableMachineQrSheet()}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-[#09090B] px-3 text-xs font-semibold text-white active:scale-[0.98]"
          >
            <Printer size={15} />
            <span>Imprimir QRs ({Object.keys(equipmentMap).length} máquinas)</span>
          </button>
        </div>

        {reports.length === 0 ? (
          <p className="text-xs" style={{ color: TEXT.secondary }}>
            Sin reportes de falla enviados desde piso. Todas las máquinas operativas.
          </p>
        ) : (
          <div className="divide-y divide-white/10">
            {reports.slice(0, 8).map((rep) => (
              <div key={rep.id} className="flex items-center justify-between gap-2 py-2.5 text-xs">
                <div>
                  <span className="font-mono font-bold text-white">{rep.equipmentId}</span>{" "}
                  <span style={{ color: TEXT.secondary }}>· {rep.reason}</span>
                </div>
                <select
                  value={rep.status}
                  onChange={async (e) => {
                    const next = e.target.value as MachineReport["status"];
                    await updateMachineReportStatus(rep.id, next, actorId);
                    setReports((prev) =>
                      prev.map((r) => (r.id === rep.id ? { ...r, status: next } : r)),
                    );
                  }}
                  className="h-9 rounded-lg border border-white/10 bg-[#09090B] px-2 text-xs text-white"
                >
                  <option value="open">Abierto</option>
                  <option value="maintenance">En mantenimiento</option>
                  <option value="resolved">Operativa</option>
                </select>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 5. Cumplimiento Operativo COT-CG-001 */}
      <section className="rounded-2xl border border-white/10 bg-[#1C1C1E] p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <PauseCircle size={18} color={ACCENT.base} />
            <h2 className="text-sm font-bold text-white">
              5. Cumplimiento Operativo COT-CG-001
            </h2>
          </div>
          <button
            type="button"
            onClick={async () => {
              const rows = await exportFullGymDatabaseCsv(actorId);
              setNotice(`Base completa exportada (${rows} registros en CSV).`);
            }}
            className="inline-flex h-11 items-center gap-2 rounded-xl px-4 text-xs font-semibold text-white active:scale-[0.98]"
            style={{ backgroundColor: ACCENT.base }}
          >
            <Download size={15} />
            <span>Exportar Base Completa (.CSV)</span>
          </button>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {(
            [
              { id: "active", label: "Servicio Activo" },
              { id: "warning_day5", label: "Aviso Día 5" },
              { id: "paused_day7", label: "Modo Pausa Día 7" },
            ] as const
          ).map((mode) => {
            const active = serviceStatus === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={async () => {
                  await setGymServiceStatus(mode.id, actorId);
                  setServiceStatusState(mode.id);
                  setNotice(`Estado del servicio actualizado a: ${mode.label}`);
                }}
                className="h-10 rounded-xl border px-3 text-xs font-semibold"
                style={{
                  borderColor: active ? ACCENT.base : GLASS.border,
                  backgroundColor: active ? "rgba(255,59,48,0.16)" : "#09090B",
                  color: active ? ACCENT.text : TEXT.secondary,
                }}
              >
                {mode.label}
              </button>
            );
          })}
        </div>

        <div className="text-xs font-semibold text-white">Bitácora de Auditoría Reciente</div>
        <div className="mt-2 divide-y divide-white/10">
          {auditLogs.length === 0 ? (
            <p className="py-2 text-xs" style={{ color: TEXT.secondary }}>
              Sin eventos recientes registrados.
            </p>
          ) : (
            auditLogs.slice(0, 6).map((log) => (
              <div key={log.id} className="flex items-center justify-between py-2 text-xs">
                <span className="text-white">
                  <strong>{log.action}</strong> · {log.target}
                </span>
                <span className="font-mono text-[11px]" style={{ color: TEXT.secondary }}>
                  {log.details}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

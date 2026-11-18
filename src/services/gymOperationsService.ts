/**
 * gymOperationsService.ts — Executive Operations, COT-CG-001 Compliance & Fallbacks.
 *
 * Provides resilient client+Supabase persistence for:
 * - Gym Challenges (retos mensuales en /inicio y /admin)
 * - Machine Maintenance Reports (reportes desde piso <-> /admin)
 * - Store & Class Demand Pulse ("Apartar / Preguntar en recepción")
 * - Floor Spot / Technique Requests (ActiveWorkout -> /coach)
 * - Admin Audit Logs (`admin_audit_logs`)
 * - Gym Service Status (`gym_service_status`: 'active' | 'warning_day5' | 'paused_day7')
 * - Full Gym CSV Export & Printable 77-Machine QR Sheet
 */

import QRCode from "qrcode";
import { supabase } from "@lib/supabase";
import { equipmentMap } from "@/data/equipmentMap";
import { MACHINE_GUIDE_CATALOG } from "@/data/machineGuideCatalog";
import { downloadCsvFile, escapeCsvCell } from "@/utils/workoutCsvCodec";

export type GymServiceMode = "active" | "warning_day5" | "paused_day7";

export interface GymChallenge {
  id: string;
  title: string;
  targetSessions: number;
  monthLabel: string;
  active: boolean;
  createdAt: string;
}

export interface MachineReport {
  id: string;
  equipmentId: string;
  equipmentName: string;
  reportedBy: string;
  reason: string;
  status: "open" | "maintenance" | "resolved";
  createdAt: string;
}

export interface DemandIntent {
  id: string;
  kind: "store" | "class";
  itemId: string;
  itemTitle: string;
  userId: string;
  createdAt: string;
}

export interface SpotRequest {
  id: string;
  userId: string;
  athleteName: string;
  exerciseName: string;
  stationLabel: string;
  status: "pending" | "attending" | "done";
  createdAt: string;
}

export interface AdminAuditEntry {
  id: string;
  actorId: string;
  action: string;
  target: string;
  details: string;
  createdAt: string;
}

const KEYS = {
  challenges: "cronos_gym_challenges_v1",
  reports: "cronos_machine_reports_v1",
  intents: "cronos_demand_intents_v1",
  spots: "cronos_spot_requests_v1",
  audit: "cronos_admin_audit_logs_v1",
  status: "cronos_gym_service_status_v1",
} as const;

function readLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocal<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors
  }
}

// Helper for additive tables that may not yet be in generated Database types
function dynamicTable(table: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any).from(table);
}

// ------------------------------------------------------------------ Challenges

export async function listGymChallenges(): Promise<GymChallenge[]> {
  const local = readLocal<GymChallenge[]>(KEYS.challenges, []);
  try {
    const { data, error } = await dynamicTable("gym_challenges")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && Array.isArray(data)) {
      const mapped: GymChallenge[] = data.map((r: Record<string, unknown>) => ({
        id: String(r.id),
        title: String(r.title ?? ""),
        targetSessions: Number(r.target_sessions ?? 16),
        monthLabel: String(r.month_label ?? "Mes actual"),
        active: Boolean(r.active),
        createdAt: String(r.created_at ?? new Date().toISOString()),
      }));
      writeLocal(KEYS.challenges, mapped);
      return mapped;
    }
  } catch {
    // Fallback to local
  }
  return local;
}

export async function createGymChallenge(
  title: string,
  targetSessions: number,
  actorId: string,
): Promise<GymChallenge> {
  const monthLabel = new Date().toLocaleDateString("es-MX", {
    month: "long",
    year: "numeric",
  });
  const entry: GymChallenge = {
    id: `chg-${Date.now()}`,
    title,
    targetSessions,
    monthLabel,
    active: true,
    createdAt: new Date().toISOString(),
  };

  const current = readLocal<GymChallenge[]>(KEYS.challenges, []).map((c) => ({
    ...c,
    active: false,
  }));
  writeLocal(KEYS.challenges, [entry, ...current]);

  try {
    await dynamicTable("gym_challenges").update({ active: false }).eq("active", true);
    await dynamicTable("gym_challenges").insert({
      id: entry.id,
      title: entry.title,
      target_sessions: entry.targetSessions,
      month_label: entry.monthLabel,
      active: true,
      created_by: actorId,
    });
  } catch {
    // Fallback saved locally
  }

  await appendAdminAudit(actorId, "challenge_activated", title, `${targetSessions} sesiones`);
  return entry;
}

// ------------------------------------------------------------------ Machine Reports

export async function listMachineReports(): Promise<MachineReport[]> {
  const local = readLocal<MachineReport[]>(KEYS.reports, []);
  try {
    const { data, error } = await dynamicTable("machine_reports")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && Array.isArray(data)) {
      const mapped: MachineReport[] = data.map((r: Record<string, unknown>) => ({
        id: String(r.id),
        equipmentId: String(r.equipment_id ?? ""),
        equipmentName: String(r.equipment_name ?? ""),
        reportedBy: String(r.reported_by ?? ""),
        reason: String(r.reason ?? ""),
        status: (r.status as MachineReport["status"]) ?? "open",
        createdAt: String(r.created_at ?? new Date().toISOString()),
      }));
      writeLocal(KEYS.reports, mapped);
      return mapped;
    }
  } catch {
    // Fallback local
  }
  return local;
}

export async function submitMachineReport(input: {
  equipmentId: string;
  equipmentName: string;
  reportedBy: string;
  reason: string;
}): Promise<MachineReport> {
  const entry: MachineReport = {
    id: `rep-${Date.now()}`,
    ...input,
    status: "open",
    createdAt: new Date().toISOString(),
  };
  const current = readLocal<MachineReport[]>(KEYS.reports, []);
  writeLocal(KEYS.reports, [entry, ...current]);

  try {
    await dynamicTable("machine_reports").insert({
      id: entry.id,
      equipment_id: entry.equipmentId,
      equipment_name: entry.equipmentName,
      reported_by: entry.reportedBy,
      reason: entry.reason,
      status: "open",
    });
  } catch {
    // Fallback saved locally
  }
  return entry;
}

export async function updateMachineReportStatus(
  id: string,
  status: MachineReport["status"],
  actorId: string,
): Promise<void> {
  const current = readLocal<MachineReport[]>(KEYS.reports, []).map((r) =>
    r.id === id ? { ...r, status } : r,
  );
  writeLocal(KEYS.reports, current);
  try {
    await dynamicTable("machine_reports").update({ status }).eq("id", id);
  } catch {
    // Local fallback applied
  }
  await appendAdminAudit(actorId, "machine_report_status", id, status);
}

// ------------------------------------------------------------------ Demand Pulse (Store & Classes)

export async function recordDemandIntent(
  kind: "store" | "class",
  itemId: string,
  itemTitle: string,
  userId: string,
): Promise<void> {
  const entry: DemandIntent = {
    id: `int-${Date.now()}`,
    kind,
    itemId,
    itemTitle,
    userId,
    createdAt: new Date().toISOString(),
  };
  const current = readLocal<DemandIntent[]>(KEYS.intents, []);
  writeLocal(KEYS.intents, [entry, ...current].slice(0, 500));

  try {
    await dynamicTable("store_intents").insert({
      id: entry.id,
      kind: entry.kind,
      item_id: entry.itemId,
      item_title: entry.itemTitle,
      user_id: entry.userId,
    });
  } catch {
    // Fallback saved locally
  }
}

export async function listDemandIntents(): Promise<DemandIntent[]> {
  const local = readLocal<DemandIntent[]>(KEYS.intents, []);
  try {
    const { data, error } = await dynamicTable("store_intents")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (!error && Array.isArray(data)) {
      const mapped: DemandIntent[] = data.map((r: Record<string, unknown>) => ({
        id: String(r.id),
        kind: (r.kind as "store" | "class") ?? "store",
        itemId: String(r.item_id ?? ""),
        itemTitle: String(r.item_title ?? ""),
        userId: String(r.user_id ?? ""),
        createdAt: String(r.created_at ?? new Date().toISOString()),
      }));
      writeLocal(KEYS.intents, mapped);
      return mapped;
    }
  } catch {
    // Fallback local
  }
  return local;
}

// ------------------------------------------------------------------ Spot / Coach Floor Alerts

export async function requestFloorSpot(input: {
  userId: string;
  athleteName: string;
  exerciseName: string;
  stationLabel: string;
}): Promise<SpotRequest> {
  const entry: SpotRequest = {
    id: `spot-${Date.now()}`,
    ...input,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  const current = readLocal<SpotRequest[]>(KEYS.spots, []);
  writeLocal(KEYS.spots, [entry, ...current].slice(0, 50));

  try {
    await dynamicTable("spot_requests").insert({
      id: entry.id,
      user_id: entry.userId,
      athlete_name: entry.athleteName,
      exercise_name: entry.exerciseName,
      station_label: entry.stationLabel,
      status: "pending",
    });
  } catch {
    // Fallback saved locally
  }
  return entry;
}

export async function listSpotRequests(): Promise<SpotRequest[]> {
  const local = readLocal<SpotRequest[]>(KEYS.spots, []);
  try {
    const { data, error } = await dynamicTable("spot_requests")
      .select("*")
      .neq("status", "done")
      .order("created_at", { ascending: false })
      .limit(25);
    if (!error && Array.isArray(data)) {
      const mapped: SpotRequest[] = data.map((r: Record<string, unknown>) => ({
        id: String(r.id),
        userId: String(r.user_id ?? ""),
        athleteName: String(r.athlete_name ?? "Socio"),
        exerciseName: String(r.exercise_name ?? ""),
        stationLabel: String(r.station_label ?? "Piso"),
        status: (r.status as SpotRequest["status"]) ?? "pending",
        createdAt: String(r.created_at ?? new Date().toISOString()),
      }));
      writeLocal(KEYS.spots, mapped);
      return mapped;
    }
  } catch {
    // Fallback local
  }
  return local.filter((s) => s.status !== "done");
}

export async function resolveSpotRequest(id: string): Promise<void> {
  const current = readLocal<SpotRequest[]>(KEYS.spots, []).map((s) =>
    s.id === id ? { ...s, status: "done" as const } : s,
  );
  writeLocal(KEYS.spots, current);
  try {
    await dynamicTable("spot_requests").update({ status: "done" }).eq("id", id);
  } catch {
    // Local fallback applied
  }
}

// ------------------------------------------------------------------ Audit Logs & Service Status

export async function appendAdminAudit(
  actorId: string,
  action: string,
  target: string,
  details: string,
): Promise<void> {
  const entry: AdminAuditEntry = {
    id: `aud-${Date.now()}`,
    actorId,
    action,
    target,
    details,
    createdAt: new Date().toISOString(),
  };
  const current = readLocal<AdminAuditEntry[]>(KEYS.audit, []);
  writeLocal(KEYS.audit, [entry, ...current].slice(0, 100));

  try {
    await dynamicTable("admin_audit_logs").insert({
      id: entry.id,
      actor_id: actorId,
      action,
      target,
      details,
    });
  } catch {
    // Fallback saved locally
  }
}

export async function listAdminAuditLogs(): Promise<AdminAuditEntry[]> {
  const local = readLocal<AdminAuditEntry[]>(KEYS.audit, []);
  try {
    const { data, error } = await dynamicTable("admin_audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(40);
    if (!error && Array.isArray(data)) {
      const mapped: AdminAuditEntry[] = data.map((r: Record<string, unknown>) => ({
        id: String(r.id),
        actorId: String(r.actor_id ?? ""),
        action: String(r.action ?? ""),
        target: String(r.target ?? ""),
        details: String(r.details ?? ""),
        createdAt: String(r.created_at ?? new Date().toISOString()),
      }));
      writeLocal(KEYS.audit, mapped);
      return mapped;
    }
  } catch {
    // Fallback local
  }
  return local;
}

export async function getGymServiceStatus(): Promise<GymServiceMode> {
  const local = readLocal<GymServiceMode>(KEYS.status, "active");
  try {
    const { data, error } = await dynamicTable("gym_service_status")
      .select("status")
      .eq("id", "primary")
      .maybeSingle();
    if (!error && data && typeof data.status === "string") {
      const status = data.status as GymServiceMode;
      writeLocal(KEYS.status, status);
      return status;
    }
  } catch {
    // Fallback local
  }
  return local;
}

export async function setGymServiceStatus(
  status: GymServiceMode,
  actorId: string,
): Promise<void> {
  writeLocal(KEYS.status, status);
  try {
    await dynamicTable("gym_service_status").upsert({
      id: "primary",
      status,
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    });
  } catch {
    // Local fallback applied
  }
  await appendAdminAudit(actorId, "service_status_changed", "gym_service_status", status);
}

// ------------------------------------------------------------------ COT-CG-001 Full Export & 77 QRs

export async function exportFullGymDatabaseCsv(actorId: string): Promise<number> {
  const [{ data: profiles }, { data: routines }, { data: logs }] = await Promise.all([
    supabase.from("profiles").select("user_id,display_name,goal,experience_level,created_at"),
    supabase.from("routines").select("id,user_id,title,created_at"),
    supabase.from("workout_logs").select("id,user_id,started_at,completed_at"),
  ]);

  const lines: string[] = [
    "section,id,name_or_title,meta_a,meta_b,timestamp",
  ];

  for (const p of profiles ?? []) {
    lines.push(
      [
        "member",
        escapeCsvCell(p.user_id),
        escapeCsvCell(p.display_name ?? "Socio"),
        escapeCsvCell(p.goal),
        escapeCsvCell(p.experience_level),
        escapeCsvCell(p.created_at),
      ].join(","),
    );
  }

  for (const eqId of Object.keys(equipmentMap)) {
    lines.push(
      ["equipment", escapeCsvCell(eqId), escapeCsvCell(eqId), "CG-EQP", "Operativa", ""].join(","),
    );
  }

  for (const r of routines ?? []) {
    lines.push(
      [
        "routine",
        escapeCsvCell(r.id),
        escapeCsvCell(r.title),
        escapeCsvCell(r.user_id),
        "",
        escapeCsvCell(r.created_at),
      ].join(","),
    );
  }

  for (const l of logs ?? []) {
    lines.push(
      [
        "workout_log",
        escapeCsvCell(l.id),
        escapeCsvCell(l.user_id),
        escapeCsvCell(l.started_at),
        escapeCsvCell(l.completed_at ?? ""),
        escapeCsvCell(l.started_at),
      ].join(","),
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  downloadCsvFile(`\uFEFF${lines.join("\r\n")}`, `cronos-gym-full-export-${today}.csv`);
  await appendAdminAudit(actorId, "full_database_export", "CSV", `${lines.length - 1} filas`);
  return lines.length - 1;
}

export function openPrintableMachineQrSheet(baseOrigin?: string): void {
  if (typeof window === "undefined") return;
  const origin = baseOrigin ?? window.location.origin;
  const w = window.open("", "_blank");
  if (!w) return;

  w.document.write(
    "<!doctype html><html lang='es'><head><meta charset='utf-8'/><title>Generando QRs Cronos Gym...</title></head><body style='font-family:system-ui,sans-serif;padding:24px;'>Generando códigos QR oficiales de las 31 máquinas de Cronos Gym...</body></html>",
  );

  void (async () => {
    const cards = await Promise.all(
      MACHINE_GUIDE_CATALOG.map(async (m) => {
        const url = `${origin}/rutinas?machine=${encodeURIComponent(m.equipmentId)}`;
        let qrDataUrl = "";
        try {
          qrDataUrl = await QRCode.toDataURL(url, {
            width: 220,
            margin: 1,
            color: { dark: "#000000", light: "#FFFFFF" },
          });
        } catch {
          qrDataUrl = "";
        }
        return `
      <div class="card">
        <div class="brand">CRONOS GYM · ESCANEA PARA VER EJERCICIOS Y GIFS</div>
        ${qrDataUrl ? `<img class="qr" src="${qrDataUrl}" alt="QR ${m.equipmentId}" />` : ""}
        <div class="name">${m.name}</div>
        <div class="group">${m.group} · ${m.equipmentId}</div>
        <div class="url">${url}</div>
      </div>`;
      }),
    );

    const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Cronos Gym · QRs Maquinaria (${MACHINE_GUIDE_CATALOG.length} máquinas)</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 20px; color: #111; }
    .toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid #e11d48; }
    .toolbar h1 { font-size: 18px; margin: 0; }
    .print-btn { background: #e11d48; color: #fff; border: none; border-radius: 8px; padding: 8px 16px; font-weight: 700; cursor: pointer; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
    .card { border: 2px solid #111; border-radius: 14px; padding: 12px; text-align: center; break-inside: avoid; page-break-inside: avoid; }
    .brand { font-size: 9px; font-weight: 800; letter-spacing: 0.08em; color: #e11d48; margin-bottom: 6px; }
    .qr { width: 150px; height: 150px; display: block; margin: 0 auto 6px; }
    .name { font-size: 13px; font-weight: 800; margin-bottom: 2px; }
    .group { font-size: 10px; font-weight: 600; color: #444; margin-bottom: 4px; }
    .url { font-size: 8px; color: #666; word-break: break-all; }
    @media print {
      .toolbar { display: none; }
      body { margin: 8px; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <h1>Cronos Gym · Plantilla de Códigos QR (${MACHINE_GUIDE_CATALOG.length} máquinas)</h1>
    <button class="print-btn" onclick="window.print()">Imprimir / Guardar PDF</button>
  </div>
  <div class="grid">${cards.join("")}</div>
</body>
</html>`;

    w.document.open();
    w.document.write(html);
    w.document.close();
  })();
}

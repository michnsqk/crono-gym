import QRCode from "qrcode";
import { supabase } from "@lib/supabase";
import type { ClassBookingRow, GymAttendanceRow } from "@/types/supabase";

export interface CheckinResult {
  alreadyCheckedIn: boolean;
  streakDays: number;
  visitsThisMonth: number;
}

export interface ChallengeLeaderboardRow {
  userId: string;
  displayName: string;
  sessionsCount: number;
  lastActivityAt: string;
}

export interface AttendanceRadarRow {
  userId: string;
  displayName: string;
  visits30d: number;
  lastVisitAt: string;
  daysInactive: number;
  atRisk: boolean;
}

export interface BookClassResult {
  ok: boolean;
  bookingId?: string;
  confirmedCount?: number;
  capacity?: number;
  error?: string;
}

export function mxDateKey(date: Date = new Date()): string {
  try {
    return date.toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export function computeAttendanceStreakDays(datesDesc: string[], referenceDate = mxDateKey()): number {
  const unique = [...new Set(datesDesc)].sort((a, b) => b.localeCompare(a));
  if (unique.length === 0) return 0;

  const parseDay = (iso: string) => new Date(`${iso}T12:00:00Z`).getTime();
  const refMs = parseDay(referenceDate);
  const newestMs = parseDay(unique[0]);
  const gapDays = Math.round((refMs - newestMs) / 86_400_000);
  if (gapDays > 1 || gapDays < -1) return 0;

  let streak = 1;
  let prevMs = newestMs;
  for (let i = 1; i < unique.length; i += 1) {
    const curMs = parseDay(unique[i]);
    const diff = Math.round((prevMs - curMs) / 86_400_000);
    if (diff === 1) {
      streak += 1;
      prevMs = curMs;
    } else if (diff > 1) {
      break;
    }
  }
  return streak;
}

export async function checkInAtReception(
  userId: string,
  displayName: string,
  source = "qr_reception",
): Promise<CheckinResult> {
  const today = mxDateKey();
  const monthPrefix = today.slice(0, 7);

  let alreadyCheckedIn = false;
  try {
    const { data: existing } = await supabase
      .from("gym_attendance")
      .select("id")
      .eq("user_id", userId)
      .eq("checked_in_on", today)
      .maybeSingle();
    alreadyCheckedIn = Boolean(existing?.id);

    await supabase.from("gym_attendance").upsert(
      {
        user_id: userId,
        checked_in_on: today,
        source,
        display_name: displayName.trim() || "Atleta Cronos",
      },
      { onConflict: "user_id,checked_in_on" },
    );

    const { data: rows } = await supabase
      .from("gym_attendance")
      .select("checked_in_on")
      .eq("user_id", userId)
      .order("checked_in_on", { ascending: false })
      .limit(90);

    const days = (rows ?? []).map((r) => r.checked_in_on);
    return {
      alreadyCheckedIn,
      streakDays: computeAttendanceStreakDays(days, today),
      visitsThisMonth: days.filter((d) => d.startsWith(monthPrefix)).length,
    };
  } catch {
    return { alreadyCheckedIn, streakDays: 1, visitsThisMonth: 1 };
  }
}

export async function listTodayAttendance(dateKey = mxDateKey()): Promise<GymAttendanceRow[]> {
  try {
    const { data, error } = await supabase
      .from("gym_attendance")
      .select("*")
      .eq("checked_in_on", dateKey)
      .order("checked_in_at", { ascending: false })
      .limit(50);
    return !error && Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function getMonthlyChallengeLeaderboard(): Promise<ChallengeLeaderboardRow[]> {
  if (typeof (supabase as { rpc?: unknown }).rpc !== "function") return [];
  try {
    const { data, error } = await supabase.rpc("get_monthly_challenge_leaderboard");
    if (error || !Array.isArray(data)) return [];
    return data.map((row) => ({
      userId: row.user_id,
      displayName: row.display_name || "Atleta Cronos",
      sessionsCount: Number(row.sessions_count ?? 0),
      lastActivityAt: row.last_activity_at,
    }));
  } catch {
    return [];
  }
}

export async function getAdminAttendanceRadar(): Promise<AttendanceRadarRow[]> {
  if (typeof (supabase as { rpc?: unknown }).rpc !== "function") return [];
  try {
    const { data, error } = await supabase.rpc("get_admin_attendance_radar");
    if (error || !Array.isArray(data)) return [];
    return data.map((row) => ({
      userId: row.user_id,
      displayName: row.display_name || "Atleta Cronos",
      visits30d: Number(row.visits_30d ?? 0),
      lastVisitAt: row.last_visit_at,
      daysInactive: Number(row.days_inactive ?? 0),
      atRisk: Boolean(row.at_risk),
    }));
  } catch {
    return [];
  }
}

export async function getClassSeatCounts(
  bookingDate = mxDateKey(),
): Promise<Record<string, number>> {
  if (typeof (supabase as { rpc?: unknown }).rpc !== "function") return {};
  try {
    const { data, error } = await supabase.rpc("get_class_seat_counts", {
      p_booking_date: bookingDate,
    });
    if (error || !Array.isArray(data)) return {};
    const counts: Record<string, number> = {};
    for (const row of data) {
      counts[row.class_id] = Number(row.confirmed_count ?? 0);
    }
    return counts;
  } catch {
    return {};
  }
}

export async function listUserClassBookings(
  userId: string,
  bookingDate = mxDateKey(),
): Promise<ClassBookingRow[]> {
  try {
    const { data, error } = await supabase
      .from("class_bookings")
      .select("*")
      .eq("user_id", userId)
      .eq("booking_date", bookingDate)
      .in("status", ["confirmed", "attended"]);
    return !error && Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function bookClassSeat(input: {
  classId: string;
  scheduleId?: string | null;
  bookingDate?: string;
  athleteName: string;
}): Promise<BookClassResult> {
  if (typeof (supabase as { rpc?: unknown }).rpc !== "function") {
    return { ok: false, error: "Servicio no disponible" };
  }
  try {
    const { data, error } = await supabase.rpc("book_gym_class", {
      p_class_id: input.classId,
      p_schedule_id: input.scheduleId ?? undefined,
      p_booking_date: input.bookingDate ?? mxDateKey(),
      p_athlete_name: input.athleteName.trim() || "Atleta Cronos",
    });
    if (error || !data || typeof data !== "object") {
      return { ok: false, error: error?.message ?? "No se pudo reservar" };
    }
    const obj = data as Record<string, unknown>;
    return {
      ok: Boolean(obj.ok),
      bookingId: typeof obj.booking_id === "string" ? obj.booking_id : undefined,
      confirmedCount: typeof obj.confirmed_count === "number" ? obj.confirmed_count : undefined,
      capacity: typeof obj.capacity === "number" ? obj.capacity : undefined,
      error: typeof obj.error === "string" ? obj.error : undefined,
    };
  } catch {
    return { ok: false, error: "Error de conexión" };
  }
}

export async function cancelClassSeat(bookingId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("class_bookings")
      .update({ status: "cancelled" })
      .eq("id", bookingId);
    return !error;
  } catch {
    return false;
  }
}

export async function listAdminClassBookings(
  bookingDate = mxDateKey(),
): Promise<ClassBookingRow[]> {
  try {
    const { data, error } = await supabase
      .from("class_bookings")
      .select("*")
      .eq("booking_date", bookingDate)
      .in("status", ["confirmed", "attended"])
      .order("created_at", { ascending: false });
    return !error && Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function markBookingAttended(bookingId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("class_bookings")
      .update({ status: "attended" })
      .eq("id", bookingId);
    return !error;
  } catch {
    return false;
  }
}

export function openPrintableAttendanceQrSheet(baseOrigin?: string): void {
  const origin =
    baseOrigin ||
    (typeof window !== "undefined" ? window.location.origin : "https://cronogym.vercel.app");
  const checkinUrl = `${origin}/checkin?gate=cronos-main`;
  const popup = window.open("", "_blank");
  if (!popup) return;

  popup.document.write(
    `<html><head><title>QR Asistencia Recepción · Cronos Gym</title></head><body style="margin:0;padding:40px;font-family:Inter,Arial,sans-serif;text-align:center;background:#fff;color:#000"><p style="font-size:12px;font-weight:700;letter-spacing:2px;color:#FF3B30;margin:0">CRONOS GYM · RECEPCIÓN</p><h1 style="margin:8px 0 12px;font-size:28px">Registra tu Asistencia</h1><p style="color:#444;font-size:14px;max-width:420px;margin:0 auto 24px">Escanea este código al entrar al gimnasio para sumar días a tu racha y subir en el Ranking Mensual.</p><div id="qr" style="min-height:320px;display:flex;align-items:center;justify-content:center">Generando QR…</div><p style="margin-top:20px;font-family:monospace;font-size:12px;color:#666">${checkinUrl}</p></body></html>`,
  );
  popup.document.close();

  void QRCode.toDataURL(checkinUrl, {
    width: 340,
    margin: 2,
    errorCorrectionLevel: "H",
  }).then((dataUrl) => {
    const target = popup.document.getElementById("qr");
    if (target) {
      target.innerHTML = `<img src="${dataUrl}" alt="QR Asistencia Cronos" width="320" height="320" />`;
    }
    setTimeout(() => popup.print(), 300);
  });
}

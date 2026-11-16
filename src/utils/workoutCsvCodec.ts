import type { Exercise } from "@/types/supabase";

export type CsvProvider = "hevy" | "symmetry" | "cronos" | "unknown";
export type ExportFormat = "hevy" | "cronos";
export type CsvSetType = "normal" | "warmup" | "failure" | "dropset";

export interface ExportableWorkoutSet {
  exerciseId: string;
  exerciseTitle: string;
  muscleGroup: string;
  equipment: string;
  setIndex: number;
  setType: CsvSetType;
  weightKg: number | null;
  reps: number | null;
  rpe: number | null;
  notes: string | null;
  isPr: boolean;
}

export interface ExportableWorkoutSession {
  id: string;
  title: string;
  startedAt: string;
  completedAt: string | null;
  description: string | null;
  sets: ExportableWorkoutSet[];
}

export interface ParsedWorkoutSet {
  sourceExerciseName: string;
  sourceExerciseId?: string;
  setIndex: number;
  setType: CsvSetType;
  weightKg: number | null;
  reps: number | null;
  rpe: number | null;
  notes: string | null;
}

export interface ParsedWorkoutSession {
  key: string;
  title: string;
  startedAt: string;
  completedAt: string;
  description: string | null;
  sets: ParsedWorkoutSet[];
}

export interface ParsedCsvResult {
  provider: CsvProvider;
  delimiter: "," | ";";
  sessions: ParsedWorkoutSession[];
  totalSets: number;
  dateRange: { start: string; end: string } | null;
  warnings: string[];
}

export interface ExerciseMatchCandidate {
  exercise: Exercise;
  score: number;
}

export interface ExerciseMatchResult {
  sourceName: string;
  status: "matched" | "review";
  matchedExercise: Exercise | null;
  confidence: number;
  candidates: ExerciseMatchCandidate[];
}

const HEVY_COLUMNS = [
  "title",
  "start_time",
  "end_time",
  "description",
  "exercise_title",
  "superset_id",
  "exercise_notes",
  "set_index",
  "set_type",
  "weight_kg",
  "reps",
  "distance_km",
  "duration_seconds",
  "rpe",
] as const;

const CRONOS_EXTRA_COLUMNS = [
  "exercise_id",
  "muscle_group",
  "equipment",
  "volume_kg",
  "is_pr",
] as const;

/**
 * Decodes an ArrayBuffer as UTF-8 when valid, falling back to Windows-1252
 * when byte sequences indicate legacy Excel/Windows CSV exports.
 */
export function decodeCsvBuffer(buffer: ArrayBuffer): string {
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
  if (utf8.includes("\uFFFD")) {
    return new TextDecoder("windows-1252").decode(buffer);
  }
  return utf8;
}

export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export function detectDelimiter(headerLine: string): "," | ";" {
  let commas = 0;
  let semis = 0;
  let inQuotes = false;
  for (let i = 0; i < headerLine.length; i += 1) {
    const ch = headerLine[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes) {
      if (ch === ",") commas += 1;
      else if (ch === ";") semis += 1;
    }
  }
  return semis > commas ? ";" : ",";
}

/**
 * RFC-4180 compliant CSV parser supporting BOM, CRLF/LF, commas/semicolons,
 * escaped quotes (`""`), and multiline quoted notes.
 */
export function parseCsvMatrix(rawText: string): {
  delimiter: "," | ";";
  headers: string[];
  rows: string[][];
} {
  const clean = stripBom(rawText);
  const firstBreak = clean.search(/\r?\n/);
  const firstLine = firstBreak === -1 ? clean : clean.slice(0, firstBreak);
  const delimiter = detectDelimiter(firstLine);

  const matrix: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field.trim());
      field = "";
    } else if (ch === "\r") {
      if (clean[i + 1] === "\n") i += 1;
      row.push(field.trim());
      if (row.some((cell) => cell.length > 0)) matrix.push(row);
      row = [];
      field = "";
    } else if (ch === "\n") {
      row.push(field.trim());
      if (row.some((cell) => cell.length > 0)) matrix.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.trim());
    if (row.some((cell) => cell.length > 0)) matrix.push(row);
  }

  if (matrix.length === 0) {
    return { delimiter, headers: [], rows: [] };
  }

  const [headers, ...rows] = matrix;
  return { delimiter, headers, rows };
}

function normHeader(h: string): string {
  return h
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_");
}

export function detectCsvProvider(headers: readonly string[]): CsvProvider {
  const set = new Set(headers.map(normHeader));
  if (
    set.has("exercise_id") &&
    (set.has("volume_kg") || set.has("is_pr")) &&
    set.has("exercise_title")
  ) {
    return "cronos";
  }
  if (
    set.has("exercise_title") &&
    set.has("start_time") &&
    (set.has("weight_kg") || set.has("reps"))
  ) {
    return "hevy";
  }
  if (
    (set.has("exercise") || set.has("ejercicio")) &&
    (set.has("weight") || set.has("peso")) &&
    (set.has("reps") || set.has("repeticiones"))
  ) {
    return "symmetry";
  }
  return "unknown";
}

function parseNumberOrNull(raw: string | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(",", ".").replace(/[^\d.-]/g, "");
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function normalizeSetType(raw: string | undefined): CsvSetType {
  const val = (raw ?? "").toLowerCase().trim();
  if (val === "warmup" || val === "w" || val === "calentamiento") return "warmup";
  if (val === "failure" || val === "f" || val === "fallo") return "failure";
  if (val === "dropset" || val === "d" || val === "drop") return "dropset";
  return "normal";
}

/**
 * Parses Hevy (`15 Nov 2026, 18:30` or `2026-11-15 18:30:00`), Symmetry, or ISO dates
 * into a valid ISO-8601 timestamp string.
 */
export function parseFlexibleDateToIso(raw: string | undefined): string {
  const val = (raw ?? "").trim();
  if (!val) return new Date().toISOString();

  // ISO or YYYY-MM-DD HH:mm(:ss)
  if (/^\d{4}-\d{2}-\d{2}/.test(val)) {
    const normalized = val.includes("T") ? val : val.replace(" ", "T");
    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }

  // DD/MM/YYYY (common in Spanish Symmetry exports)
  const dmy = val.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]) - 1;
    const yearRaw = Number(dmy[3]);
    const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
    const hour = Number(dmy[4] ?? 12);
    const min = Number(dmy[5] ?? 0);
    const sec = Number(dmy[6] ?? 0);
    const parsed = new Date(year, month, day, hour, min, sec);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }

  const fallback = new Date(val);
  if (!Number.isNaN(fallback.getTime())) return fallback.toISOString();
  return new Date().toISOString();
}

export function formatCsvTimestamp(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function parseWorkoutCsv(rawText: string): ParsedCsvResult {
  const { delimiter, headers, rows } = parseCsvMatrix(rawText);
  const provider = detectCsvProvider(headers);
  const warnings: string[] = [];

  if (headers.length === 0 || rows.length === 0) {
    return {
      provider,
      delimiter,
      sessions: [],
      totalSets: 0,
      dateRange: null,
      warnings: ["El archivo CSV está vacío o no contiene filas válidas."],
    };
  }

  const idx = new Map<string, number>();
  headers.forEach((h, i) => idx.set(normHeader(h), i));
  const cell = (r: string[], ...keys: string[]): string => {
    for (const k of keys) {
      const pos = idx.get(k);
      if (pos !== undefined && r[pos] !== undefined) return r[pos];
    }
    return "";
  };

  if (provider === "unknown") {
    warnings.push(
      "Formato no reconocido automáticamente; se intentó lectura por columnas estándar.",
    );
  }

  const grouped = new Map<string, ParsedWorkoutSession>();

  for (let i = 0; i < rows.length; i += 1) {
    const r = rows[i];
    const exName = cell(
      r,
      "exercise_title",
      "exercise",
      "ejercicio",
      "exercise_name",
    );
    if (!exName) continue;

    const title =
      cell(r, "title", "workout_name", "rutina", "nombre_rutina") ||
      "Entrenamiento importado";
    const startRaw = cell(r, "start_time", "date", "fecha", "started_at");
    const endRaw = cell(r, "end_time", "completed_at");
    const startedAt = parseFlexibleDateToIso(startRaw);
    const completedAt = endRaw ? parseFlexibleDateToIso(endRaw) : startedAt;
    const description = cell(r, "description", "notes", "notas") || null;

    // Group by minute-precision timestamp + title
    const sessionKey = `${startedAt.slice(0, 16)}::${title.toLowerCase()}`;
    let session = grouped.get(sessionKey);
    if (!session) {
      session = {
        key: sessionKey,
        title,
        startedAt,
        completedAt,
        description,
        sets: [],
      };
      grouped.set(sessionKey, session);
    }

    const setIndexRaw = parseNumberOrNull(cell(r, "set_index", "set", "serie"));
    const setNumber =
      setIndexRaw !== null
        ? provider === "hevy" || provider === "cronos"
          ? Math.max(1, Math.round(setIndexRaw) + (setIndexRaw === 0 ? 1 : 0))
          : Math.max(1, Math.round(setIndexRaw))
        : session.sets.length + 1;

    const rpeVal = parseNumberOrNull(cell(r, "rpe"));
    const rirVal = parseNumberOrNull(cell(r, "rir"));
    const resolvedRpe =
      rpeVal !== null ? rpeVal : rirVal !== null ? Math.max(5, Math.min(10, 10 - rirVal)) : null;

    session.sets.push({
      sourceExerciseName: exName,
      sourceExerciseId: cell(r, "exercise_id") || undefined,
      setIndex: setNumber,
      setType: normalizeSetType(cell(r, "set_type", "tipo_serie")),
      weightKg: parseNumberOrNull(cell(r, "weight_kg", "weight", "peso")),
      reps: parseNumberOrNull(cell(r, "reps", "repeticiones")),
      rpe: resolvedRpe,
      notes: cell(r, "exercise_notes", "set_notes", "notas_serie") || null,
    });
  }

  const sessions = Array.from(grouped.values()).sort(
    (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
  );
  const totalSets = sessions.reduce((sum, s) => sum + s.sets.length, 0);
  const dateRange =
    sessions.length > 0
      ? {
          start: sessions[0].startedAt,
          end: sessions[sessions.length - 1].startedAt,
        }
      : null;

  return {
    provider,
    delimiter,
    sessions,
    totalSets,
    dateRange,
    warnings,
  };
}

// ------------------------------------------------------------------ Fuzzy Exercise Matching

const BILINGUAL_ALIASES: Record<string, string> = {
  "bench press barbell": "press de banca con barra",
  "barbell bench press": "press de banca con barra",
  "bench press": "press de banca",
  "incline bench press barbell": "press de banca inclinado con barra",
  "incline bench press dumbbell": "press inclinado con mancuernas",
  "incline bench press": "press inclinado",
  "lat pulldown": "jalon al pecho",
  "lat pulldown cable": "jalon al pecho",
  "squat barbell": "sentadilla con barra",
  "barbell squat": "sentadilla con barra",
  "squat": "sentadilla",
  "deadlift barbell": "peso muerto con barra",
  "deadlift": "peso muerto",
  "romanian deadlift": "peso muerto rumano",
  "shoulder press dumbbell": "press de hombros con mancuernas",
  "overhead press": "press militar",
  "leg press": "prensa de piernas",
  "leg extension": "extension de cuadriceps",
  "seated leg curl": "curl femoral sentado",
  "lying leg curl": "curl femoral acostado",
  "leg curl": "curl femoral",
  "bicep curl dumbbell": "curl de biceps con mancuernas",
  "bicep curl barbell": "curl de biceps con barra",
  "bicep curl": "curl de biceps",
  "tricep pushdown": "extension de triceps en polea",
  "triceps pushdown": "extension de triceps en polea",
  "seated row": "remo sentado",
  "cable row": "remo en polea",
  "lateral raise": "elevaciones laterales",
  "calf raise": "elevacion de talones",
  "chest fly": "aperturas",
  "pec deck": "peck deck",
  "pull up": "dominadas",
  "chin up": "dominadas supinas",
  "dip": "fondos",
  "tricep dip": "fondos de triceps",
  "crunch": "crunch abdominal",
  "hip thrust": "empuje de cadera",
  "lunge": "zancadas",
};

export function normalizeMatchText(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[()[\]{}.,/\\_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenJaccard(a: string, b: string): number {
  const ta = new Set(a.split(" ").filter((t) => t.length > 1));
  const tb = new Set(b.split(" ").filter((t) => t.length > 1));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const tok of ta) {
    if (tb.has(tok)) inter += 1;
  }
  return inter / (ta.size + tb.size - inter);
}

export function matchExerciseToCatalog(
  sourceName: string,
  catalog: readonly Exercise[],
  sourceId?: string,
): ExerciseMatchResult {
  if (sourceId) {
    const byId = catalog.find((ex) => ex.id === sourceId);
    if (byId) {
      return {
        sourceName,
        status: "matched",
        matchedExercise: byId,
        confidence: 1,
        candidates: [{ exercise: byId, score: 1 }],
      };
    }
  }

  const normSource = normalizeMatchText(sourceName);
  const aliasTarget = BILINGUAL_ALIASES[normSource] ?? normSource;

  const scored: ExerciseMatchCandidate[] = [];
  for (const ex of catalog) {
    const es = normalizeMatchText(ex.name_es ?? "");
    const en = normalizeMatchText(ex.name ?? "");
    if (es === normSource || en === normSource || es === aliasTarget) {
      return {
        sourceName,
        status: "matched",
        matchedExercise: ex,
        confidence: 1,
        candidates: [{ exercise: ex, score: 1 }],
      };
    }

    const score = Math.max(
      tokenJaccard(normSource, es),
      tokenJaccard(normSource, en),
      tokenJaccard(aliasTarget, es),
      es.includes(aliasTarget) || aliasTarget.includes(es) ? 0.78 : 0,
      en.includes(normSource) || normSource.includes(en) ? 0.78 : 0,
    );
    if (score >= 0.28) {
      scored.push({ exercise: ex, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 5);
  const best = top[0] ?? null;

  if (best && best.score >= 0.62) {
    return {
      sourceName,
      status: "matched",
      matchedExercise: best.exercise,
      confidence: best.score,
      candidates: top,
    };
  }

  return {
    sourceName,
    status: "review",
    matchedExercise: null,
    confidence: best ? best.score : 0,
    candidates: top,
  };
}

// ------------------------------------------------------------------ CSV Serialization

export function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\r\n;]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function serializeWorkoutsToCsv(
  sessions: readonly ExportableWorkoutSession[],
  format: ExportFormat,
): string {
  const headers =
    format === "cronos"
      ? [...HEVY_COLUMNS, ...CRONOS_EXTRA_COLUMNS]
      : [...HEVY_COLUMNS];

  const lines: string[] = [headers.join(",")];

  for (const session of sessions) {
    const startStr = formatCsvTimestamp(session.startedAt);
    const endStr = formatCsvTimestamp(session.completedAt ?? session.startedAt);

    for (const set of session.sets) {
      const baseCells = [
        escapeCsvCell(session.title),
        escapeCsvCell(startStr),
        escapeCsvCell(endStr),
        escapeCsvCell(session.description ?? ""),
        escapeCsvCell(set.exerciseTitle),
        "", // superset_id
        escapeCsvCell(set.notes ?? ""),
        escapeCsvCell(set.setIndex),
        escapeCsvCell(set.setType),
        escapeCsvCell(set.weightKg ?? ""),
        escapeCsvCell(set.reps ?? ""),
        "", // distance_km
        "", // duration_seconds
        escapeCsvCell(set.rpe ?? ""),
      ];

      if (format === "cronos") {
        const volume =
          set.weightKg !== null && set.reps !== null
            ? Number((set.weightKg * set.reps).toFixed(2))
            : "";
        baseCells.push(
          escapeCsvCell(set.exerciseId),
          escapeCsvCell(set.muscleGroup),
          escapeCsvCell(set.equipment),
          escapeCsvCell(volume),
          escapeCsvCell(set.isPr ? "true" : "false"),
        );
      }

      lines.push(baseCells.join(","));
    }
  }

  return `\uFEFF${lines.join("\r\n")}`;
}

export function downloadCsvFile(csvContent: string, filename: string): void {
  const withBom = csvContent.startsWith("\uFEFF") ? csvContent : `\uFEFF${csvContent}`;
  const blob = new Blob([withBom], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

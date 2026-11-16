import { useCallback, useMemo, useRef, useState, type CSSProperties } from "react";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Plus, Upload, X } from "lucide-react";
import { supabase } from "@lib/supabase";
import { ACCENT, RADIUS, SPACE, SURFACE, TEXT, TYPE } from "@/design/tokens";
import { useExerciseCatalog } from "@/hooks/useExerciseCatalog";
import { addCustomExercise } from "@/lib/catalog/customExercises";
import { metricsCache } from "@/lib/cache";
import { deterministicUuid } from "@/lib/import/commit";
import { notifyTrainingDataChanged } from "@/lib/trainingEvents";
import type { Exercise } from "@/types/supabase";
import {
  decodeCsvBuffer,
  matchExerciseToCatalog,
  parseWorkoutCsv,
  type CsvProvider,
  type ExerciseMatchResult,
  type ParsedCsvResult,
} from "@/utils/workoutCsvCodec";

interface ImportWorkoutCsvModalProps {
  userId: string;
  onClose: () => void;
  onImported: (summary: { sessions: number; sets: number }) => void;
}

const PROVIDER_LABEL: Record<CsvProvider, string> = {
  hevy: "Hevy",
  symmetry: "Symmetry",
  cronos: "Respaldo Cronos",
  unknown: "CSV Estándar",
};

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

export function ImportWorkoutCsvModal({
  userId,
  onClose,
  onImported,
}: ImportWorkoutCsvModalProps) {
  const { exercises: catalog, refresh: refreshCatalog } = useExerciseCatalog();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedCsvResult | null>(null);
  const [overrides, setOverrides] = useState<Record<string, Exercise>>({});
  const [avoidDuplicates, setAvoidDuplicates] = useState(true);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);

  const matchResults = useMemo<ExerciseMatchResult[]>(() => {
    if (!parsed) return [];
    const seen = new Map<string, string | undefined>();
    for (const s of parsed.sessions) {
      for (const set of s.sets) {
        if (!seen.has(set.sourceExerciseName)) {
          seen.set(set.sourceExerciseName, set.sourceExerciseId);
        }
      }
    }
    return Array.from(seen.entries()).map(([name, id]) => {
      const manual = overrides[name];
      if (manual) {
        return {
          sourceName: name,
          status: "matched",
          matchedExercise: manual,
          confidence: 1,
          candidates: [{ exercise: manual, score: 1 }],
        };
      }
      return matchExerciseToCatalog(name, catalog, id);
    });
  }, [parsed, catalog, overrides]);

  const resolvedMap = useMemo(() => {
    const map = new Map<string, Exercise>();
    for (const m of matchResults) {
      if (m.matchedExercise) map.set(m.sourceName, m.matchedExercise);
    }
    return map;
  }, [matchResults]);

  const unresolvedCount = useMemo(
    () => matchResults.filter((m) => !m.matchedExercise).length,
    [matchResults],
  );

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setDoneMessage(null);
    try {
      const buf = await file.arrayBuffer();
      const text = decodeCsvBuffer(buf);
      const res = parseWorkoutCsv(text);
      if (res.sessions.length === 0) {
        setError("No se encontraron sesiones ni series válidas en el archivo.");
        return;
      }
      setFileName(file.name);
      setParsed(res);
      setOverrides({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo leer el archivo CSV.");
    }
  }, []);

  const handleCreateCustom = useCallback(
    async (sourceName: string) => {
      const customId = `custom-${deterministicUuid(`${userId}:${sourceName}`).slice(0, 12)}`;
      const customExercise: Exercise = {
        id: customId,
        name: sourceName,
        name_es: sourceName,
        body_part: "chest",
        target: "pectorals",
        equipment: "other",
        gif_url: "",
        instructions: [],
        is_active: true,
        is_hidden: false,
      };
      addCustomExercise(customExercise);
      setOverrides((prev) => ({ ...prev, [sourceName]: customExercise }));
      try {
        await supabase.from("exercises").upsert({
          id: customExercise.id,
          name: customExercise.name,
          name_es: customExercise.name_es,
          body_part: customExercise.body_part,
          target: customExercise.target,
          equipment: customExercise.equipment,
          gif_url: customExercise.gif_url,
          instructions: customExercise.instructions,
          is_active: true,
          is_hidden: false,
        });
      } catch {
        // Offline-first: localStorage mirror already holds the custom exercise.
      }
      await refreshCatalog();
    },
    [userId, refreshCatalog],
  );

  const handleImport = useCallback(async () => {
    if (!parsed || importing) return;
    setImporting(true);
    setProgress(5);
    setError(null);

    try {
      const existingKeys = new Set<string>();
      if (avoidDuplicates) {
        const { data: existingLogs } = await supabase
          .from("workout_logs")
          .select("started_at,journal_notes")
          .eq("user_id", userId);
        for (const row of existingLogs ?? []) {
          const minute = row.started_at.slice(0, 16);
          const noteTitle = (row.journal_notes ?? "").split("\n")[0].toLowerCase().trim();
          existingKeys.add(`${minute}::${noteTitle}`);
          existingKeys.add(minute);
        }
      }

      const toInsert = parsed.sessions.filter((session) => {
        if (!avoidDuplicates) return true;
        const minute = session.startedAt.slice(0, 16);
        return (
          !existingKeys.has(session.key) &&
          !existingKeys.has(minute)
        );
      });

      let importedSessions = 0;
      let importedSets = 0;
      const total = Math.max(1, toInsert.length);

      for (let i = 0; i < toInsert.length; i += 1) {
        const session = toInsert[i];
        const validSets = session.sets
          .map((s) => {
            const target = resolvedMap.get(s.sourceExerciseName);
            if (!target) return null;
            return { ...s, exerciseId: target.id };
          })
          .filter((s): s is NonNullable<typeof s> => s !== null);

        if (validSets.length === 0) continue;

        const logId = deterministicUuid(`${userId}::${session.key}`);
        const notesBlock = session.description
          ? `${session.title}\n${session.description}`
          : session.title;

        const { error: logErr } = await supabase.from("workout_logs").upsert({
          id: logId,
          user_id: userId,
          routine_id: null,
          started_at: session.startedAt,
          completed_at: session.completedAt,
          journal_notes: notesBlock,
        });
        if (logErr) throw new Error(logErr.message);

        const setsPayload = validSets.map((s, idx) => ({
          id: deterministicUuid(`${logId}::${idx}::${s.exerciseId}`),
          log_id: logId,
          exercise_id: s.exerciseId,
          set_number: s.setIndex || idx + 1,
          weight: s.weightKg,
          reps: s.reps,
          rpe: s.rpe,
          is_warmup: s.setType === "warmup",
          notes: s.notes,
        }));

        const { error: setsErr } = await supabase
          .from("completed_sets")
          .upsert(setsPayload);
        if (setsErr) throw new Error(setsErr.message);

        importedSessions += 1;
        importedSets += setsPayload.length;
        setProgress(Math.round(((i + 1) / total) * 100));
      }

      metricsCache.clear();
      notifyTrainingDataChanged();
      setDoneMessage(
        `Importación completada: ${importedSessions} entrenamientos y ${importedSets} series guardadas.`,
      );
      onImported({ sessions: importedSessions, sets: importedSets });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar la importación.");
    } finally {
      setImporting(false);
    }
  }, [parsed, importing, avoidDuplicates, userId, resolvedMap, onImported]);

  return (
    <div style={backdropStyle} role="dialog" aria-modal="true" aria-label="Importar historial CSV">
      <div style={modalStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <div>
            <div style={eyebrowStyle}>IMPORTADOR HISTÓRICO</div>
            <h2 style={titleStyle}>Importar desde Hevy, Symmetry o Cronos</h2>
          </div>
          <button type="button" onClick={onClose} style={closeBtnStyle} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        {/* Dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) void handleFile(file);
          }}
          onClick={() => fileInputRef.current?.click()}
          style={{
            ...dropzoneStyle,
            borderColor: dragging ? ACCENT.base : SURFACE.border,
            backgroundColor: dragging ? "rgba(255, 59, 48, 0.08)" : SURFACE.sunken,
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
          <Upload size={22} color={ACCENT.base} />
          <div style={{ fontSize: TYPE.body.size, fontWeight: 600, color: TEXT.primary }}>
            {fileName ? fileName : "Arrastra tu archivo .csv o haz clic para seleccionarlo"}
          </div>
          <div style={{ fontSize: TYPE.caption.size, color: TEXT.secondary }}>
            Soporta UTF-8, Windows-1252, separador por coma o punto y coma.
          </div>
        </div>

        {error && (
          <div style={errorBoxStyle} role="alert">
            {error}
          </div>
        )}

        {doneMessage && (
          <div style={successBoxStyle} role="status">
            <CheckCircle2 size={18} />
            <span>{doneMessage}</span>
          </div>
        )}

        {/* Preview */}
        {parsed && (
          <div style={previewContainerStyle}>
            <div style={summaryGridStyle}>
              <div style={summaryCellStyle}>
                <span style={summaryLabelStyle}>Formato</span>
                <strong style={{ color: ACCENT.text }}>{PROVIDER_LABEL[parsed.provider]}</strong>
              </div>
              <div style={summaryCellStyle}>
                <span style={summaryLabelStyle}>Entrenamientos</span>
                <strong>{parsed.sessions.length}</strong>
              </div>
              <div style={summaryCellStyle}>
                <span style={summaryLabelStyle}>Series totales</span>
                <strong>{parsed.totalSets}</strong>
              </div>
              <div style={summaryCellStyle}>
                <span style={summaryLabelStyle}>Rango</span>
                <strong style={{ fontSize: 12 }}>
                  {parsed.dateRange
                    ? `${formatDateShort(parsed.dateRange.start)} – ${formatDateShort(parsed.dateRange.end)}`
                    : "—"}
                </strong>
              </div>
            </div>

            <label style={checkboxRowStyle}>
              <input
                type="checkbox"
                checked={avoidDuplicates}
                onChange={(e) => setAvoidDuplicates(e.target.checked)}
              />
              <span>Evitar duplicados (omitir sesiones con la misma fecha y título)</span>
            </label>

            <div style={listHeaderStyle}>
              <span>Ejercicios detectados ({matchResults.length})</span>
              {unresolvedCount > 0 && (
                <span style={{ color: "#F59E0B", fontSize: 12 }}>
                  {unresolvedCount} requieren revisión
                </span>
              )}
            </div>

            <div style={matchListStyle}>
              {matchResults.map((item) => {
                const isMatched = item.matchedExercise !== null;
                return (
                  <div key={item.sourceName} style={matchRowStyle}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {isMatched ? (
                          <CheckCircle2 size={15} color="#30D158" />
                        ) : (
                          <AlertTriangle size={15} color="#F59E0B" />
                        )}
                        <span style={{ fontWeight: 600, color: TEXT.primary, fontSize: 13 }}>
                          {item.sourceName}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: TEXT.secondary, marginTop: 2 }}>
                        {isMatched
                          ? `Cronos: ${item.matchedExercise?.name_es ?? item.matchedExercise?.name}`
                          : "Sin coincidencia automática"}
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <select
                        value={item.matchedExercise?.id ?? ""}
                        onChange={(e) => {
                          const found = catalog.find((ex) => ex.id === e.target.value);
                          if (found) {
                            setOverrides((prev) => ({ ...prev, [item.sourceName]: found }));
                          }
                        }}
                        style={selectStyle}
                        aria-label={`Asignar ejercicio para ${item.sourceName}`}
                      >
                        <option value="">Elegir del catálogo…</option>
                        {item.candidates.map((c) => (
                          <option key={c.exercise.id} value={c.exercise.id}>
                            ★ {c.exercise.name_es ?? c.exercise.name}
                          </option>
                        ))}
                        {catalog.slice(0, 120).map((ex) => (
                          <option key={ex.id} value={ex.id}>
                            {ex.name_es ?? ex.name}
                          </option>
                        ))}
                      </select>

                      {!isMatched && (
                        <button
                          type="button"
                          onClick={() => void handleCreateCustom(item.sourceName)}
                          style={customBtnStyle}
                          title="Crear como ejercicio personalizado"
                        >
                          <Plus size={14} />
                          <span>Crear</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Progress Bar */}
        {importing && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={progressTrackStyle}>
              <div style={{ ...progressFillStyle, width: `${progress}%` }} />
            </div>
            <span style={{ fontSize: 12, color: TEXT.secondary, textAlign: "right" }}>
              Guardando historial… {progress}%
            </span>
          </div>
        )}

        {/* Footer */}
        <div style={footerStyle}>
          <button type="button" onClick={onClose} style={secondaryBtnStyle} disabled={importing}>
            Cerrar
          </button>
          <button
            type="button"
            onClick={() => void handleImport()}
            disabled={!parsed || importing || resolvedMap.size === 0}
            style={{
              ...primaryBtnStyle,
              opacity: !parsed || importing || resolvedMap.size === 0 ? 0.5 : 1,
            }}
          >
            <FileSpreadsheet size={16} />
            <span>{importing ? "Importando…" : "Confirmar importación"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

const backdropStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 60,
  backgroundColor: "rgba(0, 0, 0, 0.82)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: SPACE.md,
};

const modalStyle: CSSProperties = {
  width: "100%",
  maxWidth: 640,
  maxHeight: "90vh",
  overflowY: "auto",
  backgroundColor: "#121215",
  border: `1px solid ${SURFACE.border}`,
  borderRadius: RADIUS.modal,
  padding: SPACE.lg,
  display: "flex",
  flexDirection: "column",
  gap: SPACE.md,
};

const headerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: SPACE.md,
};

const eyebrowStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.12em",
  color: ACCENT.base,
};

const titleStyle: CSSProperties = {
  margin: "4px 0 0 0",
  fontSize: 18,
  fontWeight: 700,
  color: TEXT.primary,
};

const closeBtnStyle: CSSProperties = {
  background: "transparent",
  border: `1px solid ${SURFACE.border}`,
  borderRadius: RADIUS.control,
  color: TEXT.secondary,
  padding: 6,
  cursor: "pointer",
};

const dropzoneStyle: CSSProperties = {
  border: `1.5px dashed ${SURFACE.border}`,
  borderRadius: RADIUS.card,
  padding: SPACE.lg,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  textAlign: "center",
  gap: 8,
  cursor: "pointer",
};

const previewContainerStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: SPACE.sm,
};

const summaryGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
  gap: SPACE.xs,
};

const summaryCellStyle: CSSProperties = {
  backgroundColor: "#09090B",
  border: `1px solid ${SURFACE.border}`,
  borderRadius: RADIUS.control,
  padding: "10px 12px",
  display: "flex",
  flexDirection: "column",
  gap: 2,
  fontSize: 14,
  color: TEXT.primary,
};

const summaryLabelStyle: CSSProperties = {
  fontSize: 11,
  color: TEXT.secondary,
};

const checkboxRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 13,
  color: TEXT.secondary,
  cursor: "pointer",
};

const listHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  fontSize: 13,
  fontWeight: 600,
  color: TEXT.primary,
  marginTop: 4,
};

const matchListStyle: CSSProperties = {
  maxHeight: 240,
  overflowY: "auto",
  border: `1px solid ${SURFACE.border}`,
  borderRadius: RADIUS.control,
  backgroundColor: "#09090B",
};

const matchRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  padding: "10px 12px",
  borderBottom: `1px solid ${SURFACE.border}`,
};

const selectStyle: CSSProperties = {
  backgroundColor: "#121215",
  color: TEXT.primary,
  border: `1px solid ${SURFACE.border}`,
  borderRadius: RADIUS.control,
  padding: "6px 8px",
  fontSize: 12,
  maxWidth: 210,
};

const customBtnStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "6px 10px",
  borderRadius: RADIUS.control,
  border: `1px solid ${ACCENT.base}`,
  backgroundColor: "rgba(255, 59, 48, 0.14)",
  color: ACCENT.text,
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};

const progressTrackStyle: CSSProperties = {
  height: 6,
  borderRadius: 999,
  backgroundColor: "#09090B",
  overflow: "hidden",
};

const progressFillStyle: CSSProperties = {
  height: "100%",
  backgroundColor: ACCENT.base,
};

const errorBoxStyle: CSSProperties = {
  padding: "10px 12px",
  borderRadius: RADIUS.control,
  backgroundColor: "rgba(255, 59, 48, 0.12)",
  border: `1px solid ${ACCENT.base}`,
  color: ACCENT.text,
  fontSize: 13,
};

const successBoxStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 12px",
  borderRadius: RADIUS.control,
  backgroundColor: "rgba(48, 209, 88, 0.12)",
  border: "1px solid #30D158",
  color: "#30D158",
  fontSize: 13,
};

const footerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: SPACE.sm,
  marginTop: 4,
};

const secondaryBtnStyle: CSSProperties = {
  padding: "10px 16px",
  borderRadius: RADIUS.control,
  border: `1px solid ${SURFACE.border}`,
  backgroundColor: "transparent",
  color: TEXT.primary,
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
};

const primaryBtnStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 18px",
  borderRadius: RADIUS.control,
  border: "none",
  backgroundColor: ACCENT.base,
  color: "#FFFFFF",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
};

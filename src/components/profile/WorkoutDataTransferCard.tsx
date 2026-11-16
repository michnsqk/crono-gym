import { useCallback, useState, type CSSProperties } from "react";
import { Download, Upload } from "lucide-react";
import { supabase } from "@lib/supabase";
import { ACCENT, RADIUS, SPACE, SURFACE, TEXT, TYPE } from "@/design/tokens";
import { useExerciseCatalog } from "@/hooks/useExerciseCatalog";
import {
  downloadCsvFile,
  serializeWorkoutsToCsv,
  type ExportableWorkoutSession,
  type ExportFormat,
} from "@/utils/workoutCsvCodec";
import { ImportWorkoutCsvModal } from "./ImportWorkoutCsvModal";

interface WorkoutDataTransferCardProps {
  userId: string;
}

export function WorkoutDataTransferCard({ userId }: WorkoutDataTransferCardProps) {
  const { exercises: catalog } = useExerciseCatalog();
  const [format, setFormat] = useState<ExportFormat>("hevy");
  const [exporting, setExporting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleExport = useCallback(async () => {
    setExporting(true);
    setStatusMessage(null);
    try {
      const { data: logs, error: logErr } = await supabase
        .from("workout_logs")
        .select("id,routine_id,started_at,completed_at,journal_notes")
        .eq("user_id", userId)
        .order("started_at", { ascending: true });

      if (logErr) throw new Error(logErr.message);
      if (!logs || logs.length === 0) {
        setStatusMessage("Aún no tienes entrenamientos registrados para exportar.");
        return;
      }

      const logIds = logs.map((l) => l.id);
      const [{ data: sets, error: setsErr }, { data: routines }] = await Promise.all([
        supabase
          .from("completed_sets")
          .select("log_id,exercise_id,set_number,weight,reps,rpe,is_warmup,notes")
          .in("log_id", logIds)
          .order("set_number", { ascending: true }),
        supabase.from("routines").select("id,title").eq("user_id", userId),
      ]);

      if (setsErr) throw new Error(setsErr.message);

      const routineMap = new Map((routines ?? []).map((r) => [r.id, r.title]));
      const exerciseMap = new Map(catalog.map((ex) => [ex.id, ex]));
      const setsByLog = new Map<string, NonNullable<typeof sets>>();
      for (const s of sets ?? []) {
        const list = setsByLog.get(s.log_id) ?? [];
        list.push(s);
        setsByLog.set(s.log_id, list);
      }

      const maxWeightByExercise = new Map<string, number>();
      const exportSessions: ExportableWorkoutSession[] = logs.map((log) => {
        const logSets = setsByLog.get(log.id) ?? [];
        const fallbackTitle = log.journal_notes?.split("\n")[0]?.trim() || "Entrenamiento Cronos";
        const title = (log.routine_id && routineMap.get(log.routine_id)) || fallbackTitle;

        return {
          id: log.id,
          title,
          startedAt: log.started_at,
          completedAt: log.completed_at,
          description: log.journal_notes,
          sets: logSets.map((s) => {
            const ex = exerciseMap.get(s.exercise_id);
            const prevMax = maxWeightByExercise.get(s.exercise_id) ?? 0;
            const currentW = s.weight ?? 0;
            const isPr = !s.is_warmup && currentW > prevMax;
            if (isPr) maxWeightByExercise.set(s.exercise_id, currentW);

            return {
              exerciseId: s.exercise_id,
              exerciseTitle: ex?.name_es ?? ex?.name ?? s.exercise_id,
              muscleGroup: ex?.target ?? "",
              equipment: ex?.equipment ?? "",
              setIndex: Math.max(0, s.set_number - 1),
              setType: s.is_warmup ? "warmup" : "normal",
              weightKg: s.weight,
              reps: s.reps,
              rpe: s.rpe,
              notes: s.notes,
              isPr,
            };
          }),
        };
      });

      const csv = serializeWorkoutsToCsv(exportSessions, format);
      const today = new Date().toISOString().slice(0, 10);
      const filename =
        format === "hevy"
          ? `cronos-workouts-hevy-${today}.csv`
          : `cronos-backup-${today}.csv`;

      downloadCsvFile(csv, filename);
      setStatusMessage(`Exportado: ${filename} (${logs.length} sesiones).`);
    } catch (err) {
      setStatusMessage(
        err instanceof Error ? err.message : "No se pudo exportar el historial.",
      );
    } finally {
      setExporting(false);
    }
  }, [userId, catalog, format]);

  return (
    <div style={cardStyle}>
      <div style={headerRowStyle}>
        <div>
          <div style={titleStyle}>Historial de Entrenamientos (CSV)</div>
          <p style={descStyle}>
            Exporta o importa tus sesiones y series en formato compatible con Hevy, Symmetry y
            respaldo completo Cronos Gym.
          </p>
        </div>
      </div>

      {/* Format segmented selector */}
      <div style={segmentedStyle} role="radiogroup" aria-label="Formato de exportación CSV">
        {(
          [
            { id: "hevy", label: "Compatible Hevy" },
            { id: "cronos", label: "Respaldo Cronos" },
          ] as const
        ).map((opt) => {
          const active = format === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setFormat(opt.id)}
              style={{
                ...segmentBtnStyle,
                backgroundColor: active ? ACCENT.base : "transparent",
                color: active ? "#FFFFFF" : TEXT.secondary,
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Action buttons */}
      <div style={actionsRowStyle}>
        <button
          type="button"
          onClick={() => void handleExport()}
          disabled={exporting}
          style={primaryBtnStyle}
        >
          <Download size={16} />
          <span>{exporting ? "Exportando…" : "Exportar historial (CSV)"}</span>
        </button>

        <button
          type="button"
          onClick={() => setImportOpen(true)}
          style={secondaryBtnStyle}
        >
          <Upload size={16} />
          <span>Importar desde Hevy / Symmetry (.csv)</span>
        </button>
      </div>

      {statusMessage && (
        <div style={statusStyle} role="status">
          {statusMessage}
        </div>
      )}

      {importOpen && (
        <ImportWorkoutCsvModal
          userId={userId}
          onClose={() => setImportOpen(false)}
          onImported={({ sessions, sets }) => {
            setStatusMessage(
              `Historial actualizado: ${sessions} entrenamientos y ${sets} series importadas.`,
            );
          }}
        />
      )}
    </div>
  );
}

const cardStyle: CSSProperties = {
  backgroundColor: "#121215",
  border: `1px solid ${SURFACE.border}`,
  borderRadius: RADIUS.card,
  padding: SPACE.md,
  display: "flex",
  flexDirection: "column",
  gap: SPACE.sm,
};

const headerRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
};

const titleStyle: CSSProperties = {
  fontSize: TYPE.body.size,
  fontWeight: 600,
  color: TEXT.primary,
};

const descStyle: CSSProperties = {
  margin: "4px 0 0 0",
  fontSize: TYPE.caption.size,
  color: TEXT.secondary,
  lineHeight: 1.4,
};

const segmentedStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  padding: 4,
  borderRadius: RADIUS.control,
  backgroundColor: "#09090B",
  border: `1px solid ${SURFACE.border}`,
  gap: 4,
};

const segmentBtnStyle: CSSProperties = {
  padding: "8px 12px",
  borderRadius: RADIUS.input,
  border: "none",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const actionsRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: SPACE.xs,
};

const primaryBtnStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 14px",
  borderRadius: RADIUS.control,
  border: "none",
  backgroundColor: ACCENT.base,
  color: "#FFFFFF",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const secondaryBtnStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 14px",
  borderRadius: RADIUS.control,
  border: `1px solid ${SURFACE.border}`,
  backgroundColor: "#09090B",
  color: TEXT.primary,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const statusStyle: CSSProperties = {
  fontSize: 12,
  color: TEXT.secondary,
};

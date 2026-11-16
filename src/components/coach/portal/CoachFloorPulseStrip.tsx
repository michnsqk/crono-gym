import { useEffect, useState } from "react";
import { AlertCircle, Check, Users } from "lucide-react";
import { ACCENT, TEXT } from "@/design/tokens";
import {
  listSpotRequests,
  resolveSpotRequest,
  type SpotRequest,
} from "@/services/gymOperationsService";

export type RetentionFilter = "all" | "active" | "at_risk" | "inactive";

interface CoachFloorPulseStripProps {
  activeAthletesCount: number;
  retentionFilter: RetentionFilter;
  onRetentionFilterChange: (next: RetentionFilter) => void;
}

export function CoachFloorPulseStrip({
  activeAthletesCount,
  retentionFilter,
  onRetentionFilterChange,
}: CoachFloorPulseStripProps) {
  const [spots, setSpots] = useState<SpotRequest[]>([]);

  useEffect(() => {
    void listSpotRequests().then(setSpots);
  }, []);

  return (
    <section className="rounded-2xl border border-white/10 bg-[#1C1C1E] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users size={16} color="#30D158" aria-hidden="true" />
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            Socios en piso ahora:
          </span>
          <span className="font-mono text-sm font-bold tabular-nums text-white">
            {activeAthletesCount}
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Radar de retención">
          {(
            [
              { id: "all", label: "Todos" },
              { id: "active", label: "Activos" },
              { id: "at_risk", label: "En Riesgo (5–9d)" },
              { id: "inactive", label: "Inactivos (10+d)" },
            ] as const
          ).map((f) => {
            const active = retentionFilter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                aria-pressed={active}
                onClick={() => onRetentionFilterChange(f.id)}
                className="h-9 rounded-xl border px-3 text-xs font-semibold active:scale-[0.98]"
                style={{
                  borderColor: active ? ACCENT.base : "rgba(255,255,255,0.10)",
                  backgroundColor: active ? "rgba(255,59,48,0.16)" : "#09090B",
                  color: active ? "#FFFFFF" : TEXT.secondary,
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {spots.length > 0 && (
        <div className="mt-3 divide-y divide-white/10 border-t border-white/10 pt-2">
          {spots.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-2 py-2 text-xs">
              <div className="flex items-center gap-2 text-white">
                <AlertCircle size={14} color={ACCENT.base} aria-hidden="true" />
                <span>
                  <strong>{s.athleteName}</strong> pide apoyo/spot en{" "}
                  <strong>{s.exerciseName}</strong> ({s.stationLabel})
                </span>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await resolveSpotRequest(s.id);
                  setSpots((prev) => prev.filter((item) => item.id !== s.id));
                }}
                className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#30D158]/20 px-2.5 text-xs font-semibold text-[#30D158]"
              >
                <Check size={13} /> Atendido
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

import { useCallback, useEffect, useState } from "react";
import { Check, Cpu, Dumbbell } from "lucide-react";
import { GlassCard } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { coachEcosystemService } from "@/lib/coach/coachEcosystemService";
import { equipmentMap } from "@/data/equipmentMap";
import { CRONOS_MACHINERY_EXERCISES } from "@/lib/catalog/machinerySeedExercises";
import { ACCENT, GLASS, RADIUS, SPACE, STATUS, SURFACE, TEXT, TYPE } from "@/design/tokens";

type RequestRow = {
  id: string;
  name: string;
  body_part: string;
  equipment: string;
  notes: string;
  status: string;
};

export function ExerciseRequestsManager() {
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const data = await coachEcosystemService.loadAllExerciseRequests();
      setRows(
        data.map((row) => ({
          id: row.id,
          name: row.name,
          body_part: row.bodyPart,
          equipment: row.equipment,
          notes: row.notes,
          status: row.status,
        })),
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "No se pudieron cargar las solicitudes",
      );
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const approve = async (row: RequestRow) => {
    const { error: insertError } = await (supabase as any).from("exercises").insert({
      id: crypto.randomUUID(),
      name: row.name,
      name_es: row.name,
      body_part: row.body_part || "general",
      target: row.body_part || "general",
      equipment: row.equipment || "Gym",
      gif_url: "",
      instructions: row.notes ? [row.notes] : [],
      is_active: true,
      is_hidden: false,
    });
    if (insertError) {
      setError(insertError.message);
      return;
    }
    const { error: updateError } = await (supabase as any)
      .from("coach_exercise_requests")
      .update({ status: "approved" })
      .eq("id", row.id);
    if (updateError) setError(updateError.message);
    else setRows((current) => current.filter((item) => item.id !== row.id));
  };

  const machineCount = Object.keys(equipmentMap).length;
  const curatedMachineryCount = CRONOS_MACHINERY_EXERCISES.length;

  return (
    <div className="grid gap-4 pb-24">
      <GlassCard style={{ padding: SPACE.lg }}>
        <div className="mb-3 flex items-center gap-2">
          <Cpu size={18} style={{ color: ACCENT.text }} aria-hidden="true" />
          <h3
            className="m-0 font-bold"
            style={{ fontSize: TYPE.headline.size, color: TEXT.primary }}
          >
            Ecosistema del Catálogo · Base y 77 Máquinas
          </h3>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <div
            className="rounded-xl p-3"
            style={{ backgroundColor: GLASS.fill, border: `1px solid ${GLASS.border}` }}
          >
            <span className="block text-xs" style={{ color: TEXT.secondary }}>
              Maquinaria Física Cronos
            </span>
            <strong
              className="mt-1 block font-mono tabular-nums"
              style={{ fontSize: TYPE.title2.size, color: TEXT.primary }}
            >
              {machineCount}
            </strong>
            <span className="text-xs" style={{ color: TEXT.tertiary }}>
              CG-EQP-0001 a CG-EQP-{String(machineCount).padStart(4, "0")}
            </span>
          </div>
          <div
            className="rounded-xl p-3"
            style={{ backgroundColor: GLASS.fill, border: `1px solid ${GLASS.border}` }}
          >
            <span className="block text-xs" style={{ color: TEXT.secondary }}>
              Nuevos & Maquinaria (ES)
            </span>
            <strong
              className="mt-1 block font-mono tabular-nums"
              style={{ fontSize: TYPE.title2.size, color: STATUS.progression.text }}
            >
              {curatedMachineryCount}
            </strong>
            <span className="text-xs" style={{ color: TEXT.tertiary }}>
              Curados sin duplicados
            </span>
          </div>
          <div
            className="rounded-xl p-3"
            style={{ backgroundColor: GLASS.fill, border: `1px solid ${GLASS.border}` }}
          >
            <span className="block text-xs" style={{ color: TEXT.secondary }}>
              Solicitudes Pendientes
            </span>
            <strong
              className="mt-1 block font-mono tabular-nums"
              style={{ fontSize: TYPE.title2.size, color: rows.length > 0 ? ACCENT.text : TEXT.primary }}
            >
              {rows.length}
            </strong>
            <span className="text-xs" style={{ color: TEXT.tertiary }}>
              Enviadas por coaches
            </span>
          </div>
        </div>
      </GlassCard>

      <GlassCard style={{ padding: SPACE.lg }}>
        <div className="mb-2 flex items-center gap-2">
          <Dumbbell size={18} style={{ color: TEXT.secondary }} aria-hidden="true" />
          <h3
            className="m-0 font-bold"
            style={{ fontSize: TYPE.headline.size, color: TEXT.primary }}
          >
            Solicitudes de Ejercicios de Coaches
          </h3>
        </div>
        {error && (
          <p role="alert" className="my-2 text-xs" style={{ color: STATUS.error.text }}>
            {error}
          </p>
        )}
        {rows.length === 0 ? (
          <p className="mt-2 text-sm" style={{ color: TEXT.secondary }}>
            No hay solicitudes pendientes.
          </p>
        ) : (
          <div className="mt-3 grid gap-2.5">
            {rows.map((row) => (
              <div
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 p-3"
                style={{
                  borderRadius: RADIUS.surface,
                  backgroundColor: SURFACE.l1,
                  border: `1px solid ${GLASS.border}`,
                }}
              >
                <div className="min-w-0 flex-1">
                  <strong className="block truncate" style={{ color: TEXT.primary }}>
                    {row.name}
                  </strong>
                  <span
                    className="mt-0.5 block"
                    style={{ color: TEXT.secondary, fontSize: TYPE.caption.size }}
                  >
                    {row.body_part} · {row.equipment}
                  </span>
                  {row.notes && (
                    <span
                      className="mt-1 block"
                      style={{ color: TEXT.tertiary, fontSize: TYPE.caption.size }}
                    >
                      {row.notes}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void approve(row)}
                  className="inline-flex min-h-[44px] items-center gap-1.5 px-3 text-xs font-bold"
                  style={{
                    borderRadius: RADIUS.control,
                    backgroundColor: STATUS.success.base,
                    color: TEXT.onAccent,
                  }}
                >
                  <Check size={14} aria-hidden="true" />
                  Aprobar y Agregar al Catálogo
                </button>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}

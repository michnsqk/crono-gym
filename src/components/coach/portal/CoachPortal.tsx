import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CoachFloorPulseStrip, type RetentionFilter } from "./CoachFloorPulseStrip";
import { Check, ChevronDown, ChevronUp, CloudUpload, Compass, Dumbbell, ImageIcon, Loader2, LogOut, Pencil, Plus, RotateCcw, Search, Sparkles, Trash2, X } from "lucide-react";
import { BiomechanicalGripStanceModal } from "@/components/workout/BiomechanicalGripStanceModal";
import { CRONOS_ATTACHMENTS_GUIDE, FOOT_STANCE_MATRIX } from "@/lib/workout/biomechanicalGripStance";
import { useOutletContext } from "react-router-dom";
import type { WorkspaceOutletContext } from "@/App";
import { usePermissions } from "@/hooks/usePermissions";
import { CoachPinGate } from "@/lib/coach/CoachAccessGate";
import { useCoachAuth } from "@/lib/coach/useCoachAuth";
import { useCoachEcosystem } from "@/hooks/useCoachEcosystem";
import { coachEcosystemService } from "@/lib/coach/coachEcosystemService";
import { supabase } from "@lib/supabase";
import { GlassButton } from "@/components/ui";
import { CoachAthleteSearch, type CoachAthlete } from "./CoachAthleteSearch";
import { AthleteCRM } from "./AthleteCRM";
import { VipRoutineBuilder } from "./VipRoutineBuilder";
import { getExerciseDisplayName } from "@/utils/exerciseTranslation";
import { translateBodyPart } from "@/lib/i18n";
import {
  addCustomExercise,
  normaliseExerciseId,
  readCatalogOverride,
  readCustomExercises,
  readDeletedExerciseIds,
  readOverridesSnapshot,
  subscribeCatalogOverrides,
} from "@/lib/catalog/customExercises";
import { loadCatalog } from "@/lib/catalog/catalogLoader";
import {
  ANATOMICAL_GIF_PRESETS,
  CRONOS_MACHINERY_EXERCISES,
  matchesSemanticExerciseSearch,
} from "@/lib/catalog/machinerySeedExercises";
import { BODYWEIGHT_EQUIPMENT_NAME } from "@/lib/catalog/types";
import {
  NO_EQUIPMENT_ID,
  normaliseExerciseName,
  resolveCatalogExercises,
  type ResolvedCatalogExercise,
} from "@/lib/catalog/resolveExercise";
import {
  countPendingOverrides,
  deleteCoachExercise,
  hydrateOverridesFromSupabase,
  persistCoachExerciseChange,
  restoreCoachExercise,
  syncPendingOverrides,
  uploadOrResolveCoachGif,
} from "@/lib/catalog/coachCatalogSync";
import { equipmentMap } from "@/data/equipmentMap";
import { equipmentCatalog } from "@/data/equipmentCatalog";
import { ACCENT, GLASS, STATUS, TEXT } from "@/design/tokens";

type CoachTab = "clients" | "expediente" | "templates" | "exercises";
type ExerciseRow = {
  id: string;
  name: string;
  name_es: string | null;
  body_part: string;
  target: string;
  equipment: string;
  gif_url?: string | null;
  equipment_id?: string;
  /** The coach's own name, when there is one. */
  customNameEs?: string;
  available?: boolean;
};

/** Which cards the chips keep. Presentation only: no query changes. */
type ExerciseFilter = "all" | "with_machine" | "free_weight" | "coach_edited" | "deleted";

const EXERCISE_FILTERS: { id: ExerciseFilter; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "with_machine", label: "Con máquina" },
  { id: "free_weight", label: "Peso libre" },
  { id: "coach_edited", label: "Editados por coach" },
  { id: "deleted", label: "Eliminados" },
];

/** What the last write to Supabase did, in the coach's words. */
type SyncState =
  | { kind: "idle" }
  | { kind: "working" }
  | { kind: "online"; detail?: string }
  | { kind: "local"; detail?: string }
  | { kind: "offline" };

/** Machine categories the picker groups by, in catalog order. */
const MACHINE_CATEGORIES = [
  "Polea",
  "Máquina Selectorizada",
  "Banco",
  "Mancuernas",
  "Barra / Discos",
  "Peso Corporal",
  "Accesorio",
] as const;

const card = "rounded-2xl border border-white/10 bg-zinc-900/90 p-4";
const control = "rounded-xl border border-white/10 bg-zinc-800/80";

/** Cards mounted per page: enough to browse, few enough to open instantly. */
const EXERCISES_PAGE_SIZE = 60;

function translateLevelLabel(level?: string | null): string {
  const key = (level ?? "").trim().toLowerCase();
  if (key === "beginner") return "Principiante";
  if (key === "intermediate") return "Intermedio";
  if (key === "advanced") return "Avanzado";
  return level || "General";
}

/** One resolved catalog row, in the shape the panel renders. */
function toRow(row: ResolvedCatalogExercise): ExerciseRow {
  return {
    id: row.id,
    name: row.name,
    name_es: row.nameEs,
    body_part: row.body_part,
    target: row.target,
    equipment: row.equipment,
    gif_url: row.effectiveGifUrl || row.effectiveImageUrl,
    equipment_id: row.effectiveEquipmentId,
    customNameEs: row.customNameEs,
    available: row.availableInCronosGym,
  };
}

export function CoachPortal() {
  const { userId } = useOutletContext<WorkspaceOutletContext>();
  const { loading, hasRole } = usePermissions();
  const auth = useCoachAuth();
  if (loading)
    return <div className="min-h-60 animate-pulse rounded-2xl bg-[#1C1C1E]" />;
  const content = <PortalPanel userId={userId} onExit={auth.lock} />;
  return hasRole(["coach", "admin", "developer"]) ? (
    content
  ) : (
    <CoachPinGate>{content}</CoachPinGate>
  );
}

export function PortalPanel({
  userId,
  onExit,
}: {
  userId: string;
  onExit?: () => void;
}) {
  const [tab, setTab] = useState<CoachTab>("clients");
  const [selectedAthlete, setSelectedAthlete] = useState<CoachAthlete | null>(
    null,
  );
  const [expedienteTab, setExpedienteTab] = useState<
    "ficha" | "builder" | "chat"
  >("ficha");
  const [offerEditing, setOfferEditing] = useState(false);
  const ecosystem = useCoachEcosystem(userId);
  const [offerDraft, setOfferDraft] = useState(ecosystem.offer);
  const [filter, setFilter] = useState<"all" | "cash" | "vip">("all");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => setOfferDraft(ecosystem.offer), [ecosystem.offer]);
  const activeCount = ecosystem.requests.filter(
    (request) => request.status === "active",
  ).length;
  const visibleRequests = ecosystem.requests.filter((request) =>
    filter === "all"
      ? true
      : filter === "cash"
        ? request.status === "pending_cash_payment"
        : request.status === "active",
  );

  const activate = useCallback(
    async (athleteId: string) => {
    if (!ecosystem.offer) return;
    try {
        await ecosystem.activateAthleteVipCash(
          athleteId,
          ecosystem.offer.priceMxn,
        );
      setMessage("VIP activo · efectivo");
      await ecosystem.refresh();
    } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "No se pudo activar el VIP",
        );
    }
    },
    [ecosystem],
  );

  const [retentionFilter, setRetentionFilter] = useState<RetentionFilter>("all");
  const selectAthlete = useCallback((athlete: CoachAthlete) => {
    setSelectedAthlete(athlete);
    setTab("expediente");
    setExpedienteTab("ficha");
  }, []);

  return (
    <main className="w-full max-w-full overflow-x-hidden bg-black px-4 pt-3 pb-28">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <header
          className={`${card} flex min-w-0 flex-wrap items-center justify-between gap-3`}
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FF3B30]/15 text-[#FF3B30]">
              <Sparkles size={20} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-bold tracking-tight text-white">
                Panel Coach
              </p>
              <p className="truncate text-xs text-zinc-400">
                Coach · COACH PRO
              </p>
            </div>
          </div>
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
            <span className="rounded-full border border-[#30D158]/30 bg-[#30D158]/15 px-3 py-2 text-xs font-semibold text-[#30D158]">
              {activeCount} atletas activos
            </span>
            <span className="rounded-full bg-[#2C2C2E] px-3 py-2 text-xs text-zinc-300">
              14:00 a 22:00
            </span>
            <button
              type="button"
              onClick={onExit}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-zinc-800 px-3 text-sm text-white active:scale-[0.98]"
            >
              <LogOut size={16} aria-hidden="true" /> Salir
            </button>
          </div>
        </header>

        <CoachFloorPulseStrip
          activeAthletesCount={activeCount}
          retentionFilter={retentionFilter}
          onRetentionFilterChange={setRetentionFilter}
        />

        <nav
          aria-label="Secciones del portal"
          className={`${card} flex items-center gap-1 overflow-x-auto p-1`}
        >
          {(
            [
              ["clients", "Clientes"],
              ["expediente", "Expedientes"],
              ["templates", "Plantillas"],
              ["exercises", "Ejercicios"],
            ] as const
          ).map(([value, label]) => {
            const active = tab === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={active}
                onClick={() => setTab(value)}
                className="min-h-[44px] flex-1 shrink-0 whitespace-nowrap rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors"
                style={{
                  backgroundColor: active ? ACCENT.base : "transparent",
                  color: active ? TEXT.primary : TEXT.secondary,
                }}
              >
                {label}
              </button>
            );
          })}
        </nav>

        {message && (
          <p role="status" className={`${card} text-sm text-zinc-200`}>
            {message}
          </p>
        )}

        {tab === "clients" && (
          <ClientsPanel
            offer={offerDraft}
            editing={offerEditing}
            setEditing={setOfferEditing}
            setOffer={setOfferDraft}
            saveOffer={async () => {
              if (!offerDraft) return;
              await ecosystem.saveOffer(offerDraft);
              setOfferEditing(false);
              setMessage("Oferta guardada");
            }}
            requests={visibleRequests}
            filter={filter}
            setFilter={setFilter}
            activate={activate}
            openAthlete={(request: any) =>
              selectAthlete({
                user_id: request.athleteId,
                display_name: request.athleteName,
              })
            }
          />
        )}

        {tab === "expediente" && (
          <section className="flex min-w-0 flex-col gap-4">
            <CoachAthleteSearch onSelect={selectAthlete} />
            {selectedAthlete ? (
              <>
                <div
                  className={`${card} flex min-w-0 flex-wrap items-center justify-between gap-3`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-lg font-bold text-white">
                      {selectedAthlete.display_name || "Atleta"}
                    </p>
                    <p className="truncate text-xs text-zinc-400">
                      {selectedAthlete.goal || "Ficha 360°"} ·{" "}
                      {selectedAthlete.weight_kg ?? "—"} kg
                    </p>
                  </div>
                  <button
                    type="button"
                    className="h-11 rounded-xl bg-[#2C2C2E] px-4 text-sm text-white"
                    onClick={() => setSelectedAthlete(null)}
                  >
                    Cambiar atleta
                  </button>
                </div>
                <div className={`${card} grid grid-cols-3 gap-1 p-1`}>
                  {(["ficha", "builder", "chat"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setExpedienteTab(value)}
                      className={`min-h-11 rounded-lg text-xs font-semibold ${expedienteTab === value ? "bg-[#2C2C2E] text-white" : "text-zinc-400"}`}
                    >
                      {value === "ficha"
                        ? "Ficha 360°"
                        : value === "builder"
                          ? "Constructor 1:1"
                          : "Chat"}
                    </button>
                  ))}
                </div>
                {expedienteTab === "ficha" && (
                  <AthleteCRM athleteId={selectedAthlete.user_id} />
                )}
                {expedienteTab === "builder" && (
                  <VipRoutineBuilder
                    athleteId={selectedAthlete.user_id}
                    onSaved={setMessage}
                  />
                )}
                {expedienteTab === "chat" && (
                  <div className={card}>
                    Chat disponible desde la ficha del atleta.
                  </div>
                )}
              </>
            ) : (
              <div className={`${card} text-sm text-zinc-400`}>
                Selecciona un atleta para abrir su ficha 360°.
              </div>
            )}
          </section>
        )}

        {tab === "templates" && (
          <TemplatesPanel
            templates={ecosystem.templates}
            onClone={(templateId) =>
              ecosystem.cloneTemplate(templateId, userId)
            }
            onRefresh={ecosystem.refresh}
          />
        )}
        {tab === "exercises" && (
          <ExercisesPanel
            coachId={userId}
            requests={ecosystem.exerciseRequests}
          />
        )}
      </div>
    </main>
  );
}

function ClientsPanel({
  offer,
  editing,
  setEditing,
  setOffer,
  saveOffer,
  requests,
  filter,
  setFilter,
  activate,
  openAthlete,
}: any) {
  return (
    <section className="flex min-w-0 flex-col gap-4">
      <div className={card}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold text-white">
              Mi Oferta Comercial VIP
            </h2>
            <p className="text-xs text-zinc-400">Visible para tus atletas.</p>
        </div>
          <button
            type="button"
            className="h-11 rounded-xl bg-[#2C2C2E] px-4 text-sm text-white"
            onClick={() => setEditing(!editing)}
          >
            {editing ? "Cerrar" : "Editar"}
          </button>
        </div>
        {offer &&
          (editing ? (
          <div className="mt-4 grid gap-3">
              <input
                className={`${control} h-11 px-3 text-white`}
                value={offer.coachName ?? ""}
                onChange={(e) =>
                  setOffer({ ...offer, coachName: e.target.value })
                }
                aria-label="Nombre público del Coach"
                placeholder="Nombre público del Coach (ej. Coach Mich)"
              />
              <input
                className={`${control} h-11 px-3 text-white`}
                type="number"
                value={offer.priceMxn}
                onChange={(e) =>
                  setOffer({ ...offer, priceMxn: Number(e.target.value) })
                }
                aria-label="Precio MXN"
              />
              <input
                className={`${control} h-11 px-3 text-white`}
                value={offer.specialty}
                onChange={(e) =>
                  setOffer({ ...offer, specialty: e.target.value })
                }
                aria-label="Especialidad"
              />
              <input
                className={`${control} h-11 px-3 text-white`}
                value={offer.shift}
                onChange={(e) => setOffer({ ...offer, shift: e.target.value })}
                aria-label="Turno"
              />
              <select
                className={`${control} h-11 px-3 text-white`}
                value={offer.billingCycle}
                onChange={(e) =>
                  setOffer({
                    ...offer,
                    billingCycle: e.target.value as
                      "mensual" | "por_rutina" | "trimestral",
                  })
                }
                aria-label="Modalidad"
              >
              <option value="mensual">Mensual</option>
              <option value="por_rutina">Por rutina</option>
              <option value="trimestral">Trimestral</option>
            </select>
              <textarea
                className={`${control} min-h-24 p-3 text-sm text-white`}
                value={offer.benefits.join("\n")}
                onChange={(e) =>
                  setOffer({
                    ...offer,
                    benefits: e.target.value.split("\n").filter(Boolean),
                  })
                }
                aria-label="Beneficios"
              />
              <GlassButton variant="primary" onClick={() => void saveOffer()}>
                Guardar oferta
              </GlassButton>
            </div>
          ) : (
            <div className="mt-4 grid gap-2 text-sm text-zinc-300">
              <strong className="text-white">
                {offer.coachName || "Coach Mich"}
              </strong>
              <strong className="font-mono text-white">
                ${offer.priceMxn} MXN / {offer.billingCycle}
              </strong>
              <span>
                {offer.specialty} · {offer.shift}
              </span>
              {offer.benefits.map((benefit: string) => (
                <span key={benefit}>· {benefit}</span>
              ))}
          </div>
          ))}
      </div>
      <div className={card}>
        <div className="flex flex-wrap gap-2">
          {(["all", "cash", "vip"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`h-11 rounded-full px-4 text-xs font-semibold ${filter === value ? "bg-[#FF3B30] text-white" : "bg-[#2C2C2E] text-zinc-400"}`}
            >
              {value === "all"
                ? "Todos"
                : value === "cash"
                  ? "Por cobrar en efectivo"
                  : "VIP Activos"}
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-2">
          {requests.length === 0 && (
            <p className="text-sm text-zinc-400">
              No hay solicitudes en este filtro.
            </p>
          )}
          {requests.map((request: any) => (
            <div
              key={request.id}
              className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl bg-[#2C2C2E] p-3"
            >
              <div className="min-w-0">
                <strong className="block truncate text-white">
                  {request.athleteName}
                </strong>
                <span className="text-xs text-zinc-400">
                  {request.status === "active"
                    ? "VIP ACTIVO · EFECTIVO"
                    : "Por cobrar en efectivo"}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {request.status !== "active" && (
                  <button
                    type="button"
                    onClick={() => void activate(request.athleteId)}
                    className="min-h-11 rounded-xl bg-[#30D158] px-3 text-xs font-bold text-black"
                  >
                    Confirmar Pago en Efectivo
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => openAthlete(request)}
                  className="min-h-11 rounded-xl bg-[#1C1C1E] px-3 text-xs text-white"
                >
                  Ir al Expediente
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TemplatesPanel({
  templates,
  onClone,
  onRefresh,
}: {
  templates: any[];
  onClone: (id: string) => Promise<string>;
  onRefresh: () => Promise<void>;
}) {
  const [builderOpen, setBuilderOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  return (
    <section className="grid min-w-0 gap-4">
      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-white">
              Rutinas Base Oficiales
            </h2>
            <p className="text-xs text-zinc-400">
              Plantillas base que puedes asignar a tus atletas.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setBuilderOpen(true)}
              className="inline-flex min-h-11 items-center gap-1 rounded-xl px-4 text-xs font-bold text-white active:scale-[0.98]"
              style={{ backgroundColor: ACCENT.base }}
            >
              <Plus size={14} aria-hidden="true" /> Crear Rutina Base
            </button>
            <button
              type="button"
              onClick={() => void onRefresh()}
              className="h-11 rounded-xl bg-zinc-800 px-3 text-xs text-white"
            >
              Actualizar
            </button>
          </div>
        </div>
        {note && (
          <p role="status" className="mt-3 text-sm" style={{ color: STATUS.success.text }}>
            {note}
          </p>
        )}
        <div className="mt-4 grid gap-2.5">
          {templates.length === 0 && (
            <p className="text-sm text-zinc-400">
              No hay plantillas publicadas todavía.
            </p>
          )}
          {templates.map((template) => {
            const isExpanded = expandedId === template.id;
            const detailItems: any[] = Array.isArray(template.items)
              ? template.items
              : Array.isArray(template.routine_exercises)
                ? template.routine_exercises
                : [];
            return (
              <div
                key={template.id}
                className="grid gap-2.5 rounded-xl bg-zinc-800/80 p-3"
                style={{ border: `1px solid ${GLASS.border}` }}
              >
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <strong className="block truncate text-white">
                      {template.title}
                    </strong>
                    <span className="font-mono text-xs tabular-nums text-zinc-400">
                      {template.days} días · {template.exercises} ejercicios ·{" "}
                      {translateLevelLabel(template.level)}
                      {template.category ? ` · ${template.category}` : ""}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : template.id)}
                      className="inline-flex min-h-11 items-center gap-1 rounded-xl px-3 text-xs font-semibold text-zinc-200"
                      style={{
                        backgroundColor: GLASS.fillRaised,
                        border: `1px solid ${GLASS.border}`,
                      }}
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp size={14} aria-hidden="true" /> Ocultar detalle
                        </>
                      ) : (
                        <>
                          <ChevronDown size={14} aria-hidden="true" /> Ver ejercicios
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => void onClone(template.id)}
                      className="min-h-11 rounded-xl px-3 text-xs font-bold text-white"
                      style={{ backgroundColor: ACCENT.base }}
                    >
                      Asignar a mi cuenta
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div
                    className="grid gap-1.5 rounded-xl p-2.5 text-xs text-zinc-300"
                    style={{
                      backgroundColor: GLASS.fillSubtle,
                      border: `1px solid ${GLASS.border}`,
                    }}
                  >
                    {template.description ? (
                      <p className="text-zinc-300">{template.description}</p>
                    ) : null}
                    {detailItems.length > 0 ? (
                      <ul className="grid gap-1">
                        {detailItems.map((item: any, idx: number) => (
                          <li key={item.id ?? idx} className="flex items-center justify-between gap-2">
                            <span className="truncate font-medium text-white">
                              {idx + 1}. {item.name_es ?? item.name ?? item.exercise_name ?? "Ejercicio"}
                            </span>
                            <span className="shrink-0 font-mono text-zinc-400 tabular-nums">
                              {item.target_sets ?? item.sets ?? 3}×{item.target_reps ?? item.reps ?? "8-12"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-zinc-400">
                        Estructura de {template.days} días con {template.exercises} ejercicios programados para nivel{" "}
                        {translateLevelLabel(template.level)}. Listo para asignar y personalizar en tu cuenta.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {builderOpen && (
        <div
          role="presentation"
          onClick={() => setBuilderOpen(false)}
          className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-white/10 bg-black p-4 sm:rounded-3xl"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-base font-bold text-white">
                Crear Rutina Base
              </h3>
              <button
                type="button"
                onClick={() => setBuilderOpen(false)}
                className="h-11 rounded-xl bg-zinc-800 px-4 text-sm text-white"
              >
                Cerrar
              </button>
            </div>
          <VipRoutineBuilder
            athleteId={null}
            isTemplate
            onSaved={(title) => {
              setBuilderOpen(false);
                setNote(
                  `«${title}» creada. Aparece en tu lista y en el catálogo del atleta.`,
                );
              void onRefresh();
            }}
          />
        </div>
      </div>
    )}
    </section>
  );
}

/**
 * Whether the catalog is talking to Supabase, in the coach's words.
 *
 * "Conectado" means the remote read answered; "Solo local" means the device is
 * working but the change is not on the server yet; "Sin conexión" means neither.
 * A coach who cannot tell those apart cannot trust the panel.
 */
function SyncBadge({ state }: { state: SyncState }) {
  if (state.kind === "working") {
    return (
      <span className="inline-flex items-center gap-1 text-zinc-400">
        <Loader2 size={12} className="animate-spin" aria-hidden="true" /> Guardando…
      </span>
    );
  }
  if (state.kind === "online") {
    return (
      <span className="inline-flex items-center gap-1" style={{ color: STATUS.success.text }} role="status">
        <Check size={12} aria-hidden="true" /> Conectado a Supabase
      </span>
    );
  }
  if (state.kind === "local") {
    return (
      <span className="inline-flex items-center gap-1 text-zinc-400" role="status">
        Solo local{state.detail ? `: ${state.detail}` : ""}
      </span>
    );
  }
  if (state.kind === "offline") {
    return (
      <span className="inline-flex items-center gap-1" style={{ color: STATUS.warning.text }} role="status">
        Sin conexión · se sincronizará al volver
      </span>
    );
  }
  return null;
}

/**
 * The machine picker: search first, because 77 machines is too many to scan.
 *
 * A select was the previous answer and it was the wrong one: 77 options in a
 * native list give no picture of the machine, and the coach picks by picture.
 * Matching ignores accents and case, so "press banca" finds "Press de Banca".
 */
function MachinePicker({
  row,
  onClose,
  onSelect,
}: {
  row: ExerciseRow;
  onClose: () => void;
  onSelect: (equipmentId: string | null) => void;
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const machines = useMemo(() => {
    const wanted = normaliseExerciseName(search);
    return Object.entries(equipmentMap)
      .map(([id, machine]) => ({
        id,
        name: machine.name,
        image: machine.views?.[0]?.src ?? "",
        category: equipmentCatalog[id]?.category ?? "Accesorio",
      }))
      .filter((machine) => (category === "all" ? true : machine.category === category))
      .filter((machine) =>
        wanted === ""
          ? true
          : normaliseExerciseName(`${machine.id} ${machine.name}`).includes(wanted),
      );
  }, [category, search]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Máquina para ${row.name}`}
        className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900 p-3"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{row.name}</p>
            <p className="text-xs text-zinc-500">Elige la máquina donde se hace</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar el selector de máquina"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-zinc-300"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <label className={`${control} mt-3 flex h-11 items-center gap-2 px-3`}>
          <Search size={16} className="text-zinc-400" />
          <input
            autoFocus
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar máquina o código"
            aria-label="Buscar máquina"
            className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none"
          />
        </label>

        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {(["all", ...MACHINE_CATEGORIES] as const).map((option) => {
            const active = category === option;
            return (
              <button
                key={option}
                type="button"
                aria-pressed={active}
                onClick={() => setCategory(option)}
                className="min-h-9 shrink-0 rounded-full px-3 text-xs font-semibold"
                style={{
                  backgroundColor: active ? ACCENT.base : GLASS.fillRaised,
                  color: active ? TEXT.primary : TEXT.secondary,
                }}
              >
                {option === "all" ? "Todas" : option}
              </button>
            );
          })}
        </div>

        <div className="mt-2 grid max-h-72 gap-2 overflow-y-auto">
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="flex min-h-14 items-center gap-3 rounded-xl border border-white/10 bg-zinc-800/80 p-2 text-left"
          >
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-zinc-400">
              <Dumbbell size={20} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm text-white">Sin máquina</span>
              <span className="block truncate text-xs text-zinc-500">Peso libre / Piso</span>
            </span>
          </button>

          {machines.map((machine) => (
            <button
              key={machine.id}
              type="button"
              onClick={() => onSelect(machine.id)}
              className="flex min-h-14 items-center gap-3 rounded-xl border border-white/10 bg-zinc-800/80 p-2 text-left"
            >
              <ExerciseThumb
                src={machine.image}
                alt=""
                className="h-14 w-14 bg-white"
                fallbackLabel={machine.id.slice(-4)}
              />
              <span className="min-w-0">
                <span className="block truncate text-sm text-white">{machine.name}</span>
                <span className="block truncate font-mono text-xs text-zinc-500">
                  {machine.id} · {machine.category}
                </span>
              </span>
            </button>
          ))}

          {machines.length === 0 && (
            <p className="p-2 text-sm text-zinc-400">Ninguna máquina coincide.</p>
          )}
        </div>
      </div>
    </div>
  );
}

const GIF_MUSCLE_TABS = ["Todos", "Pecho", "Espalda", "Pierna", "Hombros", "Brazos", "Core"] as const;

/**
 * The GIF manager: a URL, a curated anatomical GIF preset, or a file the coach has on the phone.
 *
 * The file is uploaded and the public URL is written as the override, so the
 * demonstration follows the coach to every device instead of dying with one
 * browser's cache.
 */
function GifManager({
  row,
  url,
  status,
  busy,
  onUrlChange,
  onSave,
  onFile,
  onClose,
}: {
  row: ExerciseRow;
  url: string;
  status: string | null;
  busy: boolean;
  onUrlChange: (value: string) => void;
  onSave: () => void;
  onFile: (file: File) => void;
  onClose: () => void;
}) {
  const [muscleTab, setMuscleTab] = useState<(typeof GIF_MUSCLE_TABS)[number]>("Todos");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const presets = useMemo(
    () =>
      muscleTab === "Todos"
        ? ANATOMICAL_GIF_PRESETS
        : ANATOMICAL_GIF_PRESETS.filter((preset) => preset.muscleGroup === muscleTab),
    [muscleTab],
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Cambiar GIF de ${row.name}`}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-zinc-900 p-3"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{row.name}</p>
            <p className="text-xs text-zinc-500">GIF anatómico, URL o archivo · hasta 4 MB</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar el gestor de GIF"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-zinc-300"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <ExerciseThumb src={url} alt="" className="h-20 w-20 bg-white" fit="object-contain" />
          <div className="min-w-0 flex-1">
            <input
              value={url}
              onChange={(event) => onUrlChange(event.target.value)}
              placeholder="https://…/demostracion.gif"
              aria-label="URL de la demostración"
              className={`${control} h-11 w-full px-3 text-sm text-white`}
            />
          </div>
        </div>

        <div className="mt-3">
          <p className="text-xs font-semibold text-zinc-300">
            Galería anatómica por grupo muscular
          </p>
          <div className="mt-1.5 flex gap-1.5 overflow-x-auto pb-1">
            {GIF_MUSCLE_TABS.map((tabLabel) => {
              const active = muscleTab === tabLabel;
              return (
                <button
                  key={tabLabel}
                  type="button"
                  onClick={() => setMuscleTab(tabLabel)}
                  className="min-h-8 shrink-0 rounded-full px-2.5 text-xs font-semibold"
                  style={{
                    backgroundColor: active ? ACCENT.base : GLASS.fillRaised,
                    color: active ? TEXT.primary : TEXT.secondary,
                  }}
                >
                  {tabLabel}
                </button>
              );
            })}
          </div>
          <div className="mt-2 grid max-h-40 grid-cols-3 gap-2 overflow-y-auto pr-0.5">
            {presets.map((preset) => {
              const selected = url.trim() === preset.gif_url;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onUrlChange(preset.gif_url)}
                  className="flex flex-col items-center gap-1 rounded-xl p-1.5 text-center transition-colors"
                  style={{
                    border: `1px solid ${selected ? ACCENT.base : GLASS.border}`,
                    backgroundColor: selected ? ACCENT.subtle : GLASS.fill,
                  }}
                >
                  <ExerciseThumb
                    src={preset.gif_url}
                    alt={preset.label}
                    className="h-12 w-12 bg-white"
                    fit="object-contain"
                  />
                  <span className="line-clamp-2 text-xs leading-tight text-zinc-200">
                    {preset.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <label className={`${control} mt-3 flex h-11 cursor-pointer items-center justify-center gap-2 px-3 text-sm text-white`}>
          <ImageIcon size={16} aria-hidden="true" />
          Subir archivo
          <input
            type="file"
            accept="image/gif,image/webp,image/png,image/jpeg"
            className="sr-only"
            aria-label="Subir archivo de demostración"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onFile(file);
              event.target.value = "";
            }}
          />
        </label>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={onSave}
            disabled={busy}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl px-3 text-xs font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: ACCENT.base }}
          >
            Guardar URL
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-zinc-800 px-3 text-xs text-zinc-300"
          >
            Cancelar
          </button>
        </div>

        {busy && (
          <p className="mt-2 flex items-center gap-1 text-xs text-zinc-400" role="status">
            <Loader2 size={12} className="animate-spin" aria-hidden="true" /> Guardando la demostración…
          </p>
        )}
        {status && !busy && (
          <p className="mt-2 text-xs text-zinc-300" role="status">
            {status}
          </p>
        )}
      </div>
    </div>
  );
}

function ExercisesPanel({
  coachId,
  requests,
}: {
  coachId: string;
  requests: any[];
}) {
  const [rows, setRows] = useState<ExerciseRow[]>([]);
  const [query, setQuery] = useState("");
  const [renameId, setRenameId] = useState<string | null>(null);
  const [rename, setRename] = useState("");
  const [requestOpen, setRequestOpen] = useState(false);
  const [request, setRequest] = useState({
    name: "",
    bodyPart: "",
    equipment: "",
    notes: "",
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [createStatus, setCreateStatus] = useState<string | null>(null);
  const [catalogSubTab, setCatalogSubTab] = useState<"base" | "machinery">("base");
  const [machineFilter, setMachineFilter] = useState<string>("");
  const [machineryFamilyFilter, setMachineryFamilyFilter] = useState<"all" | "press" | "legs" | "back" | "arms" | "core">("all");
  const [biomechanicsModalOpen, setBiomechanicsModalOpen] = useState(false);
  const [newExercise, setNewExercise] = useState({
    name: "",
    muscle: "",
    equipment: "",
    equipmentId: "",
    gifUrl: "",
    notes: "",
  });
  const [equipmentOverrides, setEquipmentOverrides] = useState<
    Record<string, string>
  >({});
  const [limit, setLimit] = useState(EXERCISES_PAGE_SIZE);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ExerciseFilter>("all");
  const [pickerFor, setPickerFor] = useState<ExerciseRow | null>(null);
  const [gifFor, setGifFor] = useState<ExerciseRow | null>(null);
  const [gifUrl, setGifUrl] = useState("");
  const [gifStatus, setGifStatus] = useState<string | null>(null);
  const [gifBusy, setGifBusy] = useState(false);
  const [sync, setSync] = useState<SyncState>({ kind: "idle" });
  /**
   * The resolved catalog, kept so a write can carry the real row.
   *
   * `rows` is the display shape; the server needs `body_part`, `target`,
   * `equipment` and the GIF to be able to create the row when the exercise is
   * still only in the shipped catalog.
   */
  const resolvedRef = useRef<ResolvedCatalogExercise[]>([]);
  /** Ids the coach has touched, so "Editados por coach" can filter on them. */
  const [edited, setEdited] = useState<Set<string>>(new Set());
  /**
   * Changes this device has not confirmed with Supabase.
   *
   * The number is the point: a coach who renames three exercises and loses the
   * network has to be able to see that the work is not everywhere yet, and to
   * finish the job without redoing it.
   */
  const [pending, setPending] = useState(() => countPendingOverrides());
  const [syncing, setSyncing] = useState(false);
  const [pendingNote, setPendingNote] = useState<string | null>(null);
  /** The exercises the coach removed, so the list and the chips can show them. */
  const [deletedIds, setDeletedIds] = useState<Set<string>>(() => readDeletedExerciseIds());
  /** The card waiting for a "sí, eliminar": a removal is one tap away, not two. */
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [overrideTick, setOverrideTick] = useState(0);

  const findResolved = useCallback(
    (id: string) =>
      resolvedRef.current.find((candidate) => candidate.id === id) ??
      resolveCatalogExercises(CRONOS_MACHINERY_EXERCISES).find((candidate) => candidate.id === id) ??
      null,
    [],
  );

  const syncPending = async () => {
    setSyncing(true);
    setSync({ kind: "working" });
    setPendingNote(null);
    try {
      const result = await syncPendingOverrides();
      setPending(result.stillPending);
      if (result.attempted === 0) {
        setPendingNote("No hay cambios pendientes.");
        setSync({ kind: "online" });
      } else if (result.stillPending === 0) {
        setPendingNote(`${result.synced} ${result.synced === 1 ? "cambio guardado" : "cambios guardados"} globalmente.`);
        setSync({ kind: "online" });
      } else {
        setPendingNote(
          `${result.synced} de ${result.attempted} guardados; ${result.stillPending} siguen solo en este dispositivo.`,
        );
        setSync({ kind: "local", detail: "pendientes" });
      }
    } catch {
      setPendingNote("No se pudo contactar con Supabase. Los cambios siguen en este dispositivo.");
      setSync({ kind: "offline" });
    } finally {
      setSyncing(false);
    }
  };
  /**
   * Takes one exercise out of the catalog, for every athlete.
   *
   * The row disappears from this list in the same frame, because the coach is
   * looking at it; the server is told afterwards, and the card says which of the
   * two happened.
   */
  const removeExercise = async (row: ExerciseRow) => {
    setRemovingId(row.id);
    setConfirmDeleteId(null);
    setPendingNote(null);
    try {
      const result = await deleteCoachExercise(row.id);
      setDeletedIds(readDeletedExerciseIds());
      setPending(countPendingOverrides());
      setEdited((current) => new Set(current).add(row.id));
      if (result.remote === "marked_deleted") {
        setSync({ kind: "online" });
        setPendingNote(`"${row.customNameEs || row.name_es || row.name}" se eliminó del catálogo. Puedes restaurarlo desde el filtro Eliminados.`);
      } else if (result.remote === "offline" || result.remote === "skipped") {
        setSync({ kind: "offline" });
        setPendingNote("Sin conexión: el ejercicio se eliminó en este dispositivo y se sincronizará al reconectar.");
      } else {
        setSync({ kind: "local", detail: result.detail });
        setPendingNote(result.detail ?? "La eliminación solo se guardó en este dispositivo.");
      }
    } catch {
      setSync({ kind: "offline" });
      setPendingNote("No se pudo eliminar el ejercicio. Sigue en el catálogo.");
    } finally {
      setRemovingId(null);
    }
  };

  /** Undoes a removal. The row, its routines and its history were never destroyed. */
  const restoreExercise = async (row: ExerciseRow) => {
    setRemovingId(row.id);
    setPendingNote(null);
    try {
      const resolved = findResolved(row.id);
      const result = await restoreCoachExercise(row.id, resolved);
      setDeletedIds(readDeletedExerciseIds());
      setPending(countPendingOverrides());
      setEdited((current) => new Set(current).add(row.id));
      if (result.remote === "updated") {
        setSync({ kind: "online" });
        setPendingNote(`"${row.customNameEs || row.name_es || row.name}" volvió al catálogo.`);
      } else {
        setSync({ kind: "local", detail: result.detail });
        setPendingNote(result.detail ?? "La restauración solo se guardó en este dispositivo.");
      }
    } catch {
      setSync({ kind: "offline" });
      setPendingNote("No se pudo restaurar el ejercicio.");
    } finally {
      setRemovingId(null);
    }
  };

  const createExercise = async () => {
    const name = newExercise.name.trim();
    if (!name) {
      setCreateStatus("Escribe el nombre del ejercicio.");
      return;
    }
    const muscle = newExercise.muscle.trim();
    const chosenMachine = newExercise.equipmentId ? equipmentMap[newExercise.equipmentId] : undefined;
    const equipmentLabel = chosenMachine?.name || newExercise.equipment.trim() || "other";
    const exercise = {
      id: `custom-${Date.now()}`,
      name,
      name_es: name,
      body_part: muscle || "other",
      target: muscle || "other",
      equipment: equipmentLabel,
      equipment_id: newExercise.equipmentId || NO_EQUIPMENT_ID,
      equipment_name: chosenMachine?.name,
      gif_url: newExercise.gifUrl.trim() || "",
      instructions: newExercise.notes.trim() ? [newExercise.notes.trim()] : ([] as string[]),
      is_active: true,
      is_hidden: false,
    };
    try {
      await (supabase as any).from("exercises").insert({
        id: exercise.id,
        name: exercise.name,
        name_es: exercise.name_es,
        body_part: exercise.body_part,
        target: exercise.target,
        equipment: exercise.equipment,
        gif_url: exercise.gif_url,
        instructions: exercise.instructions,
        is_active: true,
        is_hidden: false,
      });
      setCreateStatus("Ejercicio creado y disponible en el catálogo.");
    } catch {
      setCreateStatus("Ejercicio guardado localmente (sin conexión).");
    }
    addCustomExercise(exercise);
    setRows((current) => [
      {
        ...exercise,
        available: true,
      } as ExerciseRow,
      ...current,
    ]);
    setNewExercise({
      name: "",
      muscle: "",
      equipment: "",
      equipmentId: "",
      gifUrl: "",
      notes: "",
    });
    setCreateOpen(false);
    setCatalogSubTab("machinery");
  };
  useEffect(() => {
    let alive = true;

    const applyOverrides = () => {
      const snapshot = readOverridesSnapshot();
      setEquipmentOverrides(
        Object.fromEntries(
          Object.entries(snapshot.catalog).map(([id, value]) => [id, value.equipment_id ?? ""]),
        ),
      );
      setEdited(
        new Set([
          ...Object.keys(snapshot.catalog),
          ...Object.keys(snapshot.names),
        ]),
      );
      setPending(countPendingOverrides());
      setDeletedIds(readDeletedExerciseIds());
      setOverrideTick((tick) => tick + 1);
    };

    const load = async () => {
      // The portal is the one screen that has to see the rows the coach removed:
      // the filter "Eliminados" is where a removal is undone.
      const catalog = await loadCatalog({ includeDeleted: true });
      if (!alive) return;
      // The shipped catalog is the list: 1,324 rows, each one already carrying
      // its Spanish name, its real GIF and the machine it is mapped to. The
      // Supabase table is a fallback for a device that cannot read the asset.
      const resolved = resolveCatalogExercises(catalog);
      resolvedRef.current = resolved;
      setRows(resolved.map(toRow));
      applyOverrides();
    };

    applyOverrides();
    void load().catch(() => {
      if (!alive) return;
      setLoadError("No se pudo leer el catálogo local. Mostrando los ejercicios del servidor.");
      void (supabase as any)
        .from("exercises")
        .select("id,name,name_es,body_part,target,equipment,gif_url")
        .eq("is_active", true)
        .order("name")
        .then(({ data }: any) => {
          if (alive) setRows(data ?? []);
        });
    });

    // The remote catalog is the other copy of the coach's work: a rename made on
    // another device has to land here too, or the two would drift apart.
    void hydrateOverridesFromSupabase()
      .then((result) => {
        if (!alive) return;
        if (result.remote === "unavailable") {
          setSync({ kind: "local", detail: result.detail });
        } else {
          setSync({ kind: "online" });
        }
        applyOverrides();
      })
      .catch(() => {
        if (alive) setSync({ kind: "offline" });
      });

    // A rename or a machine change made in another tab has to reach this list too.
    const unsubscribe = subscribeCatalogOverrides(() => {
      void load().catch(() => undefined);
      applyOverrides();
    });

    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  const machineOptions = useMemo(
    () =>
      Object.entries(equipmentMap).map(([id, machine]) => ({
        id,
        name: machine.name,
      })),
    [],
  );

  const baseRows = useMemo(
    () =>
      rows.filter(
        (row) => !row.id.startsWith("cg-mach-") && !row.id.startsWith("custom-"),
      ),
    [rows],
  );

  const machineryRows = useMemo(() => {
    const snapshot = readOverridesSnapshot();
    const seedResolved = resolveCatalogExercises(CRONOS_MACHINERY_EXERCISES).map(toRow);
    const customRows: ExerciseRow[] = readCustomExercises().map((ex: any) => {
      const override = snapshot.catalog[ex.id];
      const nameOverride = snapshot.names[ex.id];
      const customName = nameOverride || override?.customNameEs;
      return {
        id: ex.id,
        name: ex.name,
        name_es: customName ?? ex.name_es ?? ex.name,
        body_part: ex.body_part ?? "other",
        target: ex.target ?? ex.body_part ?? "other",
        equipment: ex.equipment ?? "other",
        gif_url: override?.gif_url ?? ex.gif_url ?? null,
        equipment_id:
          equipmentOverrides[ex.id] ??
          override?.equipment_id ??
          ex.equipment_id ??
          NO_EQUIPMENT_ID,
        customNameEs: customName,
        available: override?.availableInCronosGym ?? true,
      };
    });
    const existingMachinery = rows.filter(
      (row) => row.id.startsWith("cg-mach-") || row.id.startsWith("custom-"),
    );
    const byId = new Map<string, ExerciseRow>();
    for (const item of [...existingMachinery, ...customRows, ...seedResolved]) {
      if (!byId.has(item.id)) byId.set(item.id, item);
    }
    return [...byId.values()];
  }, [equipmentOverrides, overrideTick, rows]);

  const activeSourceRows = catalogSubTab === "base" ? baseRows : machineryRows;

  const filtered = useMemo(() => {
    const query_ = normaliseExerciseName(query);
    return activeSourceRows.filter((row) => {
      // The chips are a lens on the list, never a second query: the same rows,
      // seen from the angle the coach is working from.
      const removed = deletedIds.has(normaliseExerciseId(row.id));
      if (filter === "deleted") {
        if (!removed) return false;
      } else if (removed) {
        // A removed exercise belongs to its own filter: it must not be offered as
        // if it were still part of the catalog.
        return false;
      }
      const effectiveEqId = equipmentOverrides[row.id] ?? row.equipment_id ?? "";
      if (machineFilter && effectiveEqId !== machineFilter) return false;
      if (catalogSubTab === "machinery" && machineryFamilyFilter !== "all") {
        const bp = (row.body_part ?? "").toLowerCase();
        const label = normaliseExerciseName(`${row.name} ${row.name_es ?? ""} ${row.target ?? ""}`);
        if (machineryFamilyFilter === "press" && !bp.includes("chest") && !bp.includes("shoulder") && !label.includes("press") && !label.includes("pecho")) return false;
        if (machineryFamilyFilter === "legs" && !bp.includes("leg") && !bp.includes("calf") && !bp.includes("calves") && !label.includes("glute") && !label.includes("pierna") && !label.includes("prensa") && !label.includes("sentadilla") && !label.includes("femoral")) return false;
        if (machineryFamilyFilter === "back" && !bp.includes("back") && !bp.includes("neck") && !label.includes("remo") && !label.includes("jalon") && !label.includes("dorsal") && !label.includes("espalda")) return false;
        if (machineryFamilyFilter === "arms" && !bp.includes("arm") && !label.includes("bicep") && !label.includes("tricep") && !label.includes("bayesian") && !label.includes("predicador") && !label.includes("curl") && !label.includes("katana")) return false;
        if (machineryFamilyFilter === "core" && !bp.includes("waist") && !bp.includes("abs") && !label.includes("dragon") && !label.includes("crunch") && !label.includes("abdom") && !label.includes("pallof")) return false;
      }
      if (filter === "with_machine" && (!effectiveEqId || effectiveEqId === "NONE")) return false;
      if (filter === "free_weight" && effectiveEqId && effectiveEqId !== "NONE") {
        return false;
      }
      if (filter === "coach_edited" && !edited.has(row.id)) return false;
      if (query_ === "") return true;
      return (
        normaliseExerciseName(`${row.id} ${row.name} ${row.name_es ?? ""}`).includes(query_) ||
        translateBodyPart(row.body_part).toLowerCase().includes(query_) ||
        matchesSemanticExerciseSearch(row, query)
      );
    });
  }, [
    activeSourceRows,
    deletedIds,
    edited,
    equipmentOverrides,
    filter,
    machineFilter,
    machineryFamilyFilter,
    catalogSubTab,
    query,
  ]);

  // 1,324 cards with two images each is not a list to mount at once: the panel
  // opens on the first page and asks for more.
  const visible = filtered.slice(0, limit);
  useEffect(() => {
    setLimit(EXERCISES_PAGE_SIZE);
  }, [catalogSubTab, filter, machineFilter, machineryFamilyFilter, query]);

  const markEdited = (id: string) =>
    setEdited((current) => {
      if (current.has(id)) return current;
      const next = new Set(current);
      next.add(id);
      return next;
    });

  const renameExercise = async (id: string) => {
    const nextName = rename.trim();
    if (!nextName) return;
    const row = findResolved(id);
    setRows((current) =>
      current.map((candidate) =>
        candidate.id === id
          ? { ...candidate, name_es: nextName, customNameEs: nextName }
          : candidate,
      ),
    );
    setRenameId(null);
    markEdited(id);

    // One call, two tiers: the store first, Supabase second.
    setSync({ kind: "working" });
    const result = await persistCoachExerciseChange(id, { customNameEs: nextName }, row);
    setSync(
      result.remote === "offline"
        ? { kind: "offline" }
        : result.remote === "unavailable"
          ? { kind: "local", detail: result.detail }
          : { kind: "online" },
    );
    setPending(countPendingOverrides());
    setOverrideTick((tick) => tick + 1);
  };

  /**
   * Assigns a machine from the spotlight picker.
   *
   * The choice is the whole override: a machine means the exercise can be
   * trained here, and no machine means the athlete does it on the floor.
   *
   * "No machine" is written as `NONE`, never as nothing: an empty assignment is
   * indistinguishable from "this exercise was never decided", and the resolver
   * used to read that silence as "keep the machine the row shipped with".
   */
  const assignMachine = async (row: ExerciseRow, equipmentId: string | null) => {
    const id = equipmentId || "";
    const machine = id ? equipmentMap[id] : undefined;
    const isFloor = !id;
    setPickerFor(null);
    setRows((current) =>
      current.map((candidate) =>
        candidate.id === row.id
          ? {
              ...candidate,
              equipment_id: isFloor ? NO_EQUIPMENT_ID : id,
              equipment_name: isFloor ? BODYWEIGHT_EQUIPMENT_NAME : machine?.name,
              available: !isFloor,
            }
          : candidate,
      ),
    );
    setEquipmentOverrides((current) => ({
      ...current,
      [row.id]: isFloor ? NO_EQUIPMENT_ID : id,
    }));
    markEdited(row.id);

    setSync({ kind: "working" });
    const result = await persistCoachExerciseChange(
      row.id,
      {
        equipment_id: isFloor ? NO_EQUIPMENT_ID : id,
        equipment_name: isFloor ? BODYWEIGHT_EQUIPMENT_NAME : machine?.name,
        station_key: isFloor ? "floor_mat_area" : undefined,
        availableInCronosGym: !isFloor,
      },
      findResolved(row.id),
    );
    setSync(
      result.remote === "offline"
        ? { kind: "offline" }
        : result.remote === "unavailable"
          ? { kind: "local", detail: result.detail }
          : { kind: "online" },
    );
    setPending(countPendingOverrides());
    setOverrideTick((tick) => tick + 1);
  };
  /**
   * Saves the demonstration the coach chose, from a pasted URL or an uploaded file.
   *
   * The uploaded file is the interesting case: it leaves the coach's phone once and
   * then every athlete sees the same picture, instead of one browser caching a blob.
   */
  const saveGif = async (row: ExerciseRow, file?: File) => {
    const input = file ?? gifUrl;
    if (!String(input).trim()) {
      setGifStatus("Pega una URL o elige un archivo.");
      return;
    }
    setGifBusy(true);
    setGifStatus(null);
    setSync({ kind: "working" });
    const result = await uploadOrResolveCoachGif(input, row.id);
    setGifBusy(false);
    if (!result.ok) {
      setGifStatus(result.error);
      setSync({ kind: "online" });
      return;
    }

    const url = result.url;
    setGifUrl(url);
    setRows((current) =>
      current.map((candidate) =>
        candidate.id === row.id ? { ...candidate, gif_url: url } : candidate,
      ),
    );
    markEdited(row.id);

    // The upload path already wrote the change; only the badge is ours to set.
    setGifStatus("Demostración guardada.");
    setGifFor(null);
    setSync(
      result.remote === "offline"
        ? { kind: "offline" }
        : result.remote === "skipped"
          ? { kind: "local", detail: "sin-cliente" }
          : { kind: "online" },
    );
    setPending(countPendingOverrides());
    setOverrideTick((tick) => tick + 1);
  };

  return (
    <section className="grid w-full max-w-full min-w-0 gap-4 overflow-x-hidden">
      <div className={`${card} w-full max-w-full min-w-0 overflow-hidden`}>
        <div className="flex flex-col gap-2.5 w-full min-w-0">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <h2 className="text-base font-bold text-white truncate">
              Gobernanza de ejercicios
            </h2>
            <button
              type="button"
              onClick={() => setBiomechanicsModalOpen(true)}
              className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold truncate"
              style={{
                backgroundColor: GLASS.fillRaised,
                border: `1px solid ${GLASS.border}`,
                color: TEXT.primary,
              }}
            >
              <Compass size={14} className="shrink-0" style={{ color: ACCENT.text }} />
              <span className="truncate">Guía de Manerales y Posturas</span>
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 w-full min-w-0">
            <button
              type="button"
              onClick={() => setRequestOpen(!requestOpen)}
              className="min-h-11 rounded-xl px-3 py-2.5 text-xs font-semibold truncate flex items-center justify-center gap-1"
              style={{
                backgroundColor: GLASS.fillRaised,
                border: `1px solid ${GLASS.border}`,
                color: TEXT.primary,
              }}
            >
              <Plus size={14} className="shrink-0" />
              <span className="truncate">Solicitar ejercicio</span>
            </button>
            <button
              type="button"
              onClick={() => setCreateOpen(!createOpen)}
              className="min-h-11 rounded-xl px-3 py-2.5 text-xs font-bold truncate flex items-center justify-center gap-1"
              style={{ backgroundColor: ACCENT.base, color: TEXT.onAccent }}
            >
              <Plus size={14} className="shrink-0" />
              <span className="truncate">Crear ejercicio</span>
            </button>
          </div>
        </div>

        <div
          role="tablist"
          aria-label="Tipo de catálogo"
          className="mt-3 grid grid-cols-2 gap-1 w-full rounded-2xl p-1"
          style={{ backgroundColor: GLASS.fill, border: `1px solid ${GLASS.border}` }}
        >
          {(
            [
              ["base", `Catálogo Base (${baseRows.length})`],
              ["machinery", `Nuevos & Maquinaria (${machineryRows.length})`],
            ] as const
          ).map(([key, label]) => {
            const active = catalogSubTab === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setCatalogSubTab(key)}
                className="min-h-10 w-full min-w-0 truncate rounded-xl px-2 text-xs font-semibold"
                style={{
                  backgroundColor: active ? ACCENT.base : "transparent",
                  color: active ? TEXT.primary : TEXT.secondary,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {requestOpen && (
          <div className="mt-3 grid gap-2">
            <input
              className={`${control} h-11 px-3 text-white`}
              placeholder="Nombre del ejercicio"
              value={request.name}
              onChange={(e) => setRequest({ ...request, name: e.target.value })}
            />
            <input
              className={`${control} h-11 px-3 text-white`}
              placeholder="Músculo principal"
              value={request.bodyPart}
              onChange={(e) =>
                setRequest({ ...request, bodyPart: e.target.value })
              }
            />
            <input
              className={`${control} h-11 px-3 text-white`}
              placeholder="Equipo"
              value={request.equipment}
              onChange={(e) =>
                setRequest({ ...request, equipment: e.target.value })
              }
            />
            <textarea
              className={`${control} min-h-20 p-3 text-white`}
              placeholder="Notas biomecánicas"
              value={request.notes}
              onChange={(e) =>
                setRequest({ ...request, notes: e.target.value })
              }
            />
            <button
              type="button"
              className="h-11 rounded-xl font-semibold"
              style={{ backgroundColor: STATUS.success.base, color: TEXT.onAccent }}
              onClick={async () => {
                await coachEcosystemService.requestExercise(coachId, request);
                setRequest({
                  name: "",
                  bodyPart: "",
                  equipment: "",
                  notes: "",
                });
                setRequestOpen(false);
              }}
            >
              Enviar solicitud
            </button>
          </div>
        )}
        {createOpen && (
          <div
            className="mt-3 grid gap-2.5 rounded-2xl p-3"
            style={{ backgroundColor: GLASS.fill, border: `1px solid ${GLASS.border}` }}
          >
            <input
              className={`${control} h-11 px-3 text-white`}
              placeholder="Nombre del ejercicio (español)"
              value={newExercise.name}
              onChange={(e) =>
                setNewExercise({ ...newExercise, name: e.target.value })
              }
              aria-label="Nombre del ejercicio"
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                className={`${control} h-11 px-3 text-white`}
                placeholder="Músculo principal (ej. chest, back, upper legs)"
                value={newExercise.muscle}
                onChange={(e) =>
                  setNewExercise({ ...newExercise, muscle: e.target.value })
                }
                aria-label="Músculo principal"
              />
              <input
                className={`${control} h-11 px-3 text-white`}
                placeholder="Equipo"
                value={newExercise.equipment}
                onChange={(e) =>
                  setNewExercise({ ...newExercise, equipment: e.target.value })
                }
                aria-label="Equipo"
              />
            </div>
            <select
              aria-label="Máquina asignada CG-EQP"
              className={`${control} h-11 px-3 text-xs text-white`}
              value={newExercise.equipmentId}
              onChange={(e) => {
                const eqId = e.target.value;
                const mapped = eqId ? equipmentMap[eqId] : undefined;
                setNewExercise({
                  ...newExercise,
                  equipmentId: eqId,
                  equipment: mapped?.name ?? newExercise.equipment,
                });
              }}
            >
              <option value="">NONE · Peso libre / Piso</option>
              {machineOptions.map((machine) => (
                <option key={machine.id} value={machine.id}>
                  {machine.id} · {machine.name}
                </option>
              ))}
            </select>
            <div className="grid gap-1.5">
              <p className="text-xs font-medium text-zinc-300">
                Demostración anatómica (elige un GIF o pega una URL)
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {ANATOMICAL_GIF_PRESETS.slice(0, 12).map((preset) => {
                  const selected = newExercise.gifUrl === preset.gif_url;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() =>
                        setNewExercise({ ...newExercise, gifUrl: preset.gif_url })
                      }
                      className="flex w-20 shrink-0 flex-col items-center gap-1 rounded-xl p-1.5 text-center"
                      style={{
                        border: `1px solid ${selected ? ACCENT.base : GLASS.border}`,
                        backgroundColor: selected ? ACCENT.subtle : GLASS.fillRaised,
                      }}
                    >
                      <ExerciseThumb
                        src={preset.gif_url}
                        alt={preset.label}
                        className="h-10 w-10 bg-white"
                        fit="object-contain"
                      />
                      <span className="line-clamp-2 text-xs leading-tight text-zinc-200">
                        {preset.label}
                      </span>
                    </button>
                  );
                })}
              </div>
              <input
                className={`${control} h-11 px-3 text-xs text-white`}
                placeholder="URL de GIF (opcional)"
                value={newExercise.gifUrl}
                onChange={(e) =>
                  setNewExercise({ ...newExercise, gifUrl: e.target.value })
                }
                aria-label="URL de GIF del nuevo ejercicio"
              />
            </div>
            <textarea
              className={`${control} min-h-20 p-3 text-white`}
              placeholder="Notas técnicas (opcional)"
              value={newExercise.notes}
              onChange={(e) =>
                setNewExercise({ ...newExercise, notes: e.target.value })
              }
              aria-label="Notas"
            />
            <select
              aria-label="Maneral o postura biomecánica recomendada (opcional)"
              className={`${control} h-11 w-full min-w-0 truncate px-3 text-xs text-white`}
              defaultValue=""
              onChange={(e) => {
                const value = e.target.value;
                if (!value) return;
                setNewExercise((current) => ({
                  ...current,
                  notes: current.notes ? `${current.notes} · ${value}` : value,
                }));
              }}
            >
              <option value="">+ Añadir maneral o postura recomendada (opcional)...</option>
              {CRONOS_ATTACHMENTS_GUIDE.map((att) => (
                <option key={att.equipmentId} value={att.chipSummary}>
                  {att.equipmentId} · {att.shortName} ({att.gripOrientation})
                </option>
              ))}
              {FOOT_STANCE_MATRIX.map((stance) => (
                <option key={stance.id} value={stance.chipSummary}>
                  {stance.label} ({stance.shortLabel})
                </option>
              ))}
            </select>
            <button
              type="button"
              className="h-11 rounded-xl font-semibold"
              style={{ backgroundColor: STATUS.success.base, color: TEXT.onAccent }}
              onClick={() => void createExercise()}
            >
              Crear ejercicio
            </button>
          </div>
        )}
        {createStatus && (
          <p role="status" className="mt-2 text-sm text-zinc-300">
            {createStatus}
          </p>
        )}
        <label className={`${control} mt-4 flex h-11 items-center gap-2 px-3`}>
          <Search size={16} className="text-zinc-400" />
          <input
            className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none"
            placeholder="Buscar ejercicio"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>

        <div className="mt-2 flex flex-col sm:flex-row gap-2 w-full min-w-0">
          <select
            aria-label="Filtrar por máquina CG-EQP"
            value={machineFilter}
            onChange={(event) => setMachineFilter(event.target.value)}
            className={`${control} h-11 w-full min-w-0 flex-1 truncate px-3 text-xs text-white`}
          >
            <option value="">
              Todas las {machineOptions.length} máquinas (CG-EQP)
            </option>
            {machineOptions.map((machine) => (
              <option key={machine.id} value={machine.id}>
                {machine.id} · {machine.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              const chosen = machineFilter ? equipmentMap[machineFilter] : undefined;
              setNewExercise((current) => ({
                ...current,
                equipmentId: machineFilter,
                equipment: chosen?.name ?? current.equipment,
              }));
              setCreateOpen(true);
            }}
            className="inline-flex min-h-11 w-full sm:w-auto shrink-0 items-center justify-center gap-1 rounded-xl px-3 text-xs font-semibold text-white truncate"
            style={{
              backgroundColor: GLASS.fillRaised,
              border: `1px solid ${GLASS.border}`,
            }}
          >
            <Plus size={14} aria-hidden="true" />
            {machineFilter ? `Crear en ${machineFilter}` : "Crear ejercicio en esta máquina"}
          </button>
        </div>

        {catalogSubTab === "machinery" && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtro rápido por familia muscular">
            {(
              [
                { id: "all" as const, label: "Todos" },
                { id: "press" as const, label: "Press & Pecho" },
                { id: "legs" as const, label: "Pierna & Glúteo" },
                { id: "back" as const, label: "Espalda & Poleas" },
                { id: "arms" as const, label: "Brazo (Bayesian/Predicador)" },
                { id: "core" as const, label: "Abdomen & Dragon Flag" },
              ] as const
            ).map((chip) => {
              const active = machineryFamilyFilter === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setMachineryFamilyFilter(chip.id)}
                  className="min-h-8 rounded-full px-2.5 py-1 text-xs font-semibold"
                  style={{
                    backgroundColor: active ? ACCENT.subtle : GLASS.fill,
                    border: `1px solid ${active ? ACCENT.border : GLASS.border}`,
                    color: active ? TEXT.primary : TEXT.secondary,
                  }}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {EXERCISE_FILTERS.map((option) => {
            const active = filter === option.id;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(option.id)}
                className="min-h-9 rounded-full px-3 text-xs font-semibold"
                style={{
                  backgroundColor: active ? ACCENT.base : GLASS.fillRaised,
                  color: active ? TEXT.primary : TEXT.secondary,
                }}
              >
                {option.id === "deleted" ? `Eliminados (${deletedIds.size})` : option.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          <span className="font-mono tabular-nums">
            {filtered.length} de {activeSourceRows.length} ejercicios del catálogo local
          </span>
          <SyncBadge state={sync} />
        </p>
        {/*
          The coach's own save bar: it appears only when there is something to
          finish, it says how much, and it is the one action that settles it.
        */}
        {pending > 0 && (
          <div
            className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-2xl p-3"
            style={{
              border: `1px solid ${STATUS.warning.border}`,
              backgroundColor: STATUS.warning.muted,
            }}
          >
            <p className="text-xs font-semibold" style={{ color: STATUS.warning.text }} role="status">
              {pending} {pending === 1 ? "cambio sin confirmar" : "cambios sin confirmar"} en Supabase
            </p>
            <button
              type="button"
              onClick={() => void syncPending()}
              disabled={syncing}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-xs font-bold disabled:opacity-60"
              style={{ backgroundColor: STATUS.warning.base, color: TEXT.onAccent }}
            >
              {syncing ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <CloudUpload size={14} aria-hidden="true" />}
              Guardar y sincronizar cambios ({pending})
            </button>
          </div>
        )}
        {pendingNote && (
          <p className="mt-2 text-xs text-zinc-300" role="status">
            {pendingNote}
          </p>
        )}
        <div className="mt-3 grid gap-2">
          {loadError && (
            <p role="status" className="text-xs text-zinc-400">
              {loadError}
            </p>
          )}
          {visible.map((row) => {
            const selectedEquipmentId = equipmentOverrides[row.id] ?? row.equipment_id ?? "";
            const selectedEquipment =
              selectedEquipmentId && selectedEquipmentId !== "NONE"
                ? equipmentMap[selectedEquipmentId]
                : undefined;
            const overrideState = readCatalogOverride(row.id);
            const synced = overrideState?.syncStatus === "synced";
            const pendingRow = Boolean(overrideState) && !synced;
            const removed = deletedIds.has(normaliseExerciseId(row.id));
            return (
              <div key={row.id} className="w-full max-w-full min-w-0 space-y-3 overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/90 p-3">
                {/* Row 1: the real GIF, the full name, the catalog id and muscle. */}
                <div className="flex w-full min-w-0 items-start gap-3">
                  <ExerciseThumb
                    src={row.gif_url}
                    alt={`Demostración de ${getExerciseDisplayName({ name: row.name, name_es: row.name_es })}`}
                    className="h-16 w-16 bg-white"
                    fit="object-contain"
                  />
                  <div className="min-w-0 flex-1">
                    <strong className="block break-words line-clamp-2 text-sm font-bold leading-snug text-white">
                      {getExerciseDisplayName({ name: row.name, name_es: row.name_es })}
                    </strong>
                    <span className="mt-1 block break-words font-mono text-xs leading-snug text-zinc-400">
                      {row.id} · {translateBodyPart(row.body_part)}
                    </span>
                    {/* Where the change stands: everywhere, or only on this device. */}
                    {synced && (
                      <span
                        className="mt-1 inline-flex items-center gap-1 text-xs font-semibold"
                        style={{ color: STATUS.success.text }}
                      >
                        <Check size={12} aria-hidden="true" /> Guardado globalmente
                      </span>
                    )}
                    {pendingRow && (
                      <span
                        className="mt-1 inline-flex items-center gap-1 text-xs font-semibold"
                        style={{ color: STATUS.warning.text }}
                      >
                        <CloudUpload size={12} aria-hidden="true" /> Guardado en este dispositivo
                      </span>
                    )}
                  </div>
                </div>

                {/* Row 2: the machine this exercise is performed on. */}
                <div className="flex min-w-0 items-center gap-3">
                  <ExerciseThumb
                    src={selectedEquipment?.views?.[0]?.src}
                    alt={selectedEquipment ? `Máquina ${selectedEquipment.name}` : "Sin máquina"}
                    className="h-12 w-12"
                    fallbackLabel={selectedEquipment ? selectedEquipment.id.slice(-4) : undefined}
                  />
                  <button
                    type="button"
                    aria-label={`Máquina para ${row.name}`}
                    onClick={() => setPickerFor(row)}
                    className={`${control} flex h-11 min-w-0 flex-1 items-center gap-2 px-2 text-left text-xs text-white`}
                  >
                    {selectedEquipment ? (
                      <>
                        <Dumbbell className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden="true" />
                        <span className="min-w-0 flex-1 truncate text-left">
                          {selectedEquipment.id} · {selectedEquipment.name}
                        </span>
                      </>
                    ) : (
                      <span className="min-w-0 flex-1 truncate text-left text-zinc-300">
                        NONE · Peso libre / Piso
                      </span>
                    )}
                  </button>
                </div>

                {/* Row 3: rename, the demonstration, and whether the gym can host it. */}
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                  {renameId === row.id ? (
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <input
                        autoFocus
                        aria-label={`Nuevo nombre para ${row.name}`}
                        className={`${control} h-11 min-w-0 flex-1 px-2 text-sm text-white`}
                        value={rename}
                        onChange={(event) => setRename(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") void renameExercise(row.id);
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => void renameExercise(row.id)}
                        className="inline-flex h-11 shrink-0 items-center rounded-xl px-3 text-xs font-semibold text-white"
                        style={{ backgroundColor: ACCENT.base }}
                      >
                        Guardar
                      </button>
                      <button
                        type="button"
                        onClick={() => setRenameId(null)}
                        className="inline-flex h-11 shrink-0 items-center rounded-xl bg-zinc-800 px-3 text-xs text-zinc-300"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setRenameId(row.id);
                          setRename(row.customNameEs || row.name_es || row.name);
                        }}
                        className="inline-flex min-h-11 items-center gap-1 rounded-xl bg-zinc-800 px-3 text-xs text-white"
                      >
                        <Pencil size={14} aria-hidden="true" /> Renombrar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setGifFor(row);
                          setGifUrl(row.gif_url ?? "");
                          setGifStatus(null);
                        }}
                        aria-label={`Cambiar GIF de ${row.name}`}
                        className="inline-flex min-h-11 items-center gap-1 rounded-xl bg-zinc-800 px-3 text-xs text-white"
                      >
                        <ImageIcon size={14} aria-hidden="true" /> GIF
                      </button>
                    </>
                  )}
                  <span
                    className="inline-flex min-h-7 items-center rounded-full px-2.5 py-1 text-xs font-semibold"
                    style={
                      removed || row.available === false
                        ? { backgroundColor: STATUS.error.muted, color: STATUS.error.text }
                        : { backgroundColor: STATUS.success.muted, color: STATUS.success.text }
                    }
                  >
                    {removed ? "Eliminado" : row.available === false ? "No disponible" : "Disponible"}
                  </span>
                </div>

                {/*
                  Row 4: taking the exercise out of the catalog.
                  One tap asks, the second one confirms: a removal is not a
                  checkbox the coach can hit by accident, but it is not a modal
                  that hides the row either.
                */}
                <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 border-t border-white/10 pt-2">
                  {removed ? (
                    <button
                      type="button"
                      onClick={() => void restoreExercise(row)}
                      disabled={removingId === row.id}
                      className="inline-flex min-h-11 items-center gap-1 rounded-xl px-3 text-xs font-semibold disabled:opacity-60"
                      style={{ backgroundColor: STATUS.success.muted, color: STATUS.success.text }}
                    >
                      {removingId === row.id ? (
                        <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                      ) : (
                        <RotateCcw size={14} aria-hidden="true" />
                      )}
                      Restaurar
                    </button>
                  ) : confirmDeleteId === row.id ? (
                    <>
                      <span className="text-xs text-zinc-300">¿Eliminar del catálogo?</span>
                      <button
                        type="button"
                        onClick={() => void removeExercise(row)}
                        disabled={removingId === row.id}
                        className="inline-flex min-h-11 items-center gap-1 rounded-xl px-3 text-xs font-semibold text-white disabled:opacity-60"
                        style={{ backgroundColor: ACCENT.base }}
                      >
                        {removingId === row.id ? (
                          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                        ) : (
                          <Trash2 size={14} aria-hidden="true" />
                        )}
                        Sí, eliminar
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="inline-flex min-h-11 items-center rounded-xl bg-zinc-800 px-3 text-xs text-zinc-300"
                      >
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(row.id)}
                      aria-label={`Eliminar ${row.name} del catálogo`}
                      className="inline-flex min-h-11 items-center gap-1 rounded-xl bg-zinc-800 px-3 text-xs"
                      style={{ color: STATUS.error.text }}
                    >
                      <Trash2 size={14} aria-hidden="true" /> Eliminar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-sm text-zinc-400">
              {filter === "deleted"
                ? "No has eliminado ejercicios del catálogo."
                : "No hay ejercicios que coincidan con la búsqueda."}
            </p>
          )}
          {visible.length < filtered.length && (
            <button
              type="button"
              onClick={() => setLimit((current) => current + EXERCISES_PAGE_SIZE)}
              className="min-h-11 rounded-xl bg-zinc-800 px-4 text-sm font-semibold text-white"
            >
              Mostrar más ({filtered.length - visible.length} restantes)
            </button>
          )}
        </div>
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Mis solicitudes enviadas
          </p>
          {requests.map((item) => (
            <p key={item.id} className="mt-2 text-sm text-zinc-300">
              {item.name} ·{" "}
              {item.status === "approved" ? "Aprobado" : "Pendiente"}
            </p>
          ))}
        </div>
      </div>

      {pickerFor && (
        <MachinePicker
          row={pickerFor}
          onClose={() => setPickerFor(null)}
          onSelect={(equipmentId) => void assignMachine(pickerFor, equipmentId)}
        />
      )}

      {gifFor && (
        <GifManager
          row={gifFor}
          url={gifUrl}
          status={gifStatus}
          busy={gifBusy}
          onUrlChange={(value) => {
            setGifUrl(value);
            setGifStatus(null);
          }}
          onSave={() => void saveGif(gifFor)}
          onFile={(file) => void saveGif(gifFor, file)}
          onClose={() => setGifFor(null)}
        />
      )}

      <BiomechanicalGripStanceModal
        open={biomechanicsModalOpen}
        onClose={() => setBiomechanicsModalOpen(false)}
      />
    </section>
  );
}

function ExerciseThumb({
  src,
  alt = "",
  className = "h-12 w-12",
  fit = "object-cover",
  fallbackLabel,
}: {
  src?: string | null;
  alt?: string;
  className?: string;
  fit?: string;
  /** Shown instead of a broken picture: the tail of the machine's code. */
  fallbackLabel?: string;
}) {
  const [broken, setBroken] = useState(!src);
  useEffect(() => {
    setBroken(!src);
  }, [src]);
  if (broken)
    return (
      <span className={`flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border border-white/10 bg-zinc-800 text-zinc-400 ${className}`}>
        <Dumbbell size={20} aria-hidden="true" />
        {fallbackLabel && (
          <span className="font-mono text-xs leading-none tracking-wider text-zinc-500">
            {fallbackLabel}
          </span>
        )}
      </span>
    );
  return (
    <img
      src={src ?? undefined}
      alt={alt}
      loading="lazy"
      onError={() => setBroken(true)}
      className={`shrink-0 rounded-xl ${fit} ${className}`}
    />
  );
}

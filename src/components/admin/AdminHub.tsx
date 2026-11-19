import { useState } from "react";
import { Cpu, Dumbbell, Shield } from "lucide-react";
import { ACCENT, RADIUS, STATUS, SURFACE, TEXT } from "@/design/tokens";
import { equipmentMap } from "@/data/equipmentMap";
import { CRONOS_MACHINERY_EXERCISES } from "@/lib/catalog/machinerySeedExercises";
import { readCustomExercises } from "@/lib/catalog/customExercises";
import { useExerciseCatalog } from "@/hooks/useExerciseCatalog";
import { AnnouncementsManager } from "./sections/AnnouncementsManager";
import { StoreManager } from "./sections/StoreManager";
import { ClassesManager } from "./sections/ClassesManager";
import { UsersRolesManager } from "./sections/UsersRolesManager";
import { ExerciseRequestsManager } from "./sections/ExerciseRequestsManager";
import { OperationsRoiSection } from "./sections/OperationsRoiSection";
import { PwaQrShareCard } from "./sections/PwaQrShareCard";

const TABS = [
  ["avisos", "Avisos"],
  ["tienda", "Tienda"],
  ["clases", "Clases"],
  ["usuarios", "Usuarios"],
  ["ejercicios", "Catálogo"],
  ["operacion", "Operación"],
  ["qr", "QR App"],
] as const;
type AdminTab = (typeof TABS)[number][0];

export function AdminHub() {
  const [tab, setTab] = useState<AdminTab>("avisos");
  const { exercises: catalog } = useExerciseCatalog();
  const machineCount = Object.keys(equipmentMap).length;
  const totalExercises = catalog.length > 0
    ? catalog.length
    : CRONOS_MACHINERY_EXERCISES.length + readCustomExercises().length;

  return (
    <main
      className="min-h-screen w-full max-w-full overflow-x-hidden px-4 pb-36 pt-4 text-white"
      style={{ backgroundColor: SURFACE.base }}
    >
      <div className="mx-auto flex w-full max-w-5xl min-w-0 flex-col space-y-6">
        <header className="flex min-w-0 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: ACCENT.subtle, color: ACCENT.base }}
            >
              <Shield size={22} aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-bold leading-tight text-white">Command Center · Admin</h1>
              <p className="text-xs" style={{ color: TEXT.secondary }}>
                Gestión del ecosistema Cronos
              </p>
            </div>
          </div>
        </header>

        {/* Tira Bento compacta de 3 KPIs rápidos del Ecosistema */}
        <div className="grid min-w-0 grid-cols-2 gap-2.5 sm:grid-cols-3">
          <div
            className="flex min-w-0 flex-col justify-between rounded-2xl border border-white/10 bg-[#1C1C1E] p-3.5"
          >
            <span className="flex items-center gap-1.5 text-[11px] font-medium" style={{ color: TEXT.secondary }}>
              <Cpu size={13} aria-hidden="true" className="shrink-0" /> Máquinas CG-EQP
            </span>
            <strong className="mt-1.5 font-mono text-base font-bold tabular-nums text-white">
              {machineCount} <span className="text-xs font-medium text-zinc-400">equipos</span>
            </strong>
          </div>

          <div
            className="flex min-w-0 flex-col justify-between rounded-2xl border border-white/10 bg-[#1C1C1E] p-3.5"
          >
            <span className="flex items-center gap-1.5 text-[11px] font-medium" style={{ color: TEXT.secondary }}>
              <Dumbbell size={13} aria-hidden="true" className="shrink-0" /> Catálogo Activo
            </span>
            <strong
              className="mt-1.5 font-mono text-base font-bold tabular-nums"
              style={{ color: STATUS.progression.text }}
            >
              {totalExercises} <span className="text-xs font-medium text-zinc-400">ejercicios</span>
            </strong>
          </div>

          <div
            className="col-span-2 flex min-w-0 flex-col justify-between rounded-2xl border border-white/10 bg-[#1C1C1E] p-3.5 sm:col-span-1"
          >
            <span className="flex items-center gap-1.5 text-[11px] font-medium" style={{ color: TEXT.secondary }}>
              <Shield size={13} aria-hidden="true" className="shrink-0" /> Nivel de Acceso
            </span>
            <strong className="mt-1.5 text-sm font-bold" style={{ color: ACCENT.text }}>
              Rol: Admin Pro
            </strong>
          </div>
        </div>

        {/* Barra de Pestañas horizontal scrollable sin recortes en 360px */}
        <nav
          className="no-scrollbar flex w-full min-w-0 items-center gap-1.5 overflow-x-auto rounded-2xl border border-white/10 bg-[#1C1C1E] p-1.5"
          style={{
            borderRadius: RADIUS.surface,
          }}
          aria-label="Secciones de administración"
        >
          {TABS.map(([value, label]) => {
            const active = tab === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={active}
                onClick={() => setTab(value)}
                className="h-11 shrink-0 whitespace-nowrap rounded-xl px-3.5 text-xs font-semibold tracking-tight transition-transform duration-150 active:scale-[0.98]"
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

        <section className="min-w-0 w-full max-w-full">
          {tab === "avisos" && <AnnouncementsManager />}
          {tab === "tienda" && <StoreManager />}
          {tab === "clases" && <ClassesManager />}
          {tab === "usuarios" && <UsersRolesManager />}
          {tab === "ejercicios" && <ExerciseRequestsManager />}
          {tab === "operacion" && <OperationsRoiSection />}
          {tab === "qr" && <PwaQrShareCard />}
        </section>
      </div>
    </main>
  );
}

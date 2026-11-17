import { useState } from "react";
import { Cpu, Dumbbell, Shield } from "lucide-react";
import { ACCENT, GLASS, RADIUS, STATUS, SURFACE, TEXT, TYPE } from "@/design/tokens";
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
      <div className="mx-auto grid w-full max-w-5xl gap-3.5">
        <header className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: ACCENT.subtle, color: ACCENT.base }}
            >
              <Shield size={22} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold text-white">Command Center · Admin</h1>
              <p className="truncate text-xs" style={{ color: TEXT.secondary }}>
                Gestión del ecosistema Cronos
              </p>
            </div>
          </div>
        </header>

        {/* Tira Bento de 3 KPIs rápidos del Ecosistema */}
        <div className="grid grid-cols-3 gap-2">
          <div
            className="flex min-w-0 flex-col justify-between rounded-2xl p-2.5"
            style={{
              backgroundColor: SURFACE.l1,
              border: `1px solid ${GLASS.border}`,
            }}
          >
            <span className="flex items-center gap-1 truncate text-xs" style={{ color: TEXT.secondary, fontSize: TYPE.label.size }}>
              <Cpu size={12} aria-hidden="true" /> Máquinas CG-EQP
            </span>
            <strong className="mt-1 truncate font-mono text-sm font-bold tabular-nums text-white">
              {machineCount} Máquinas
            </strong>
          </div>

          <div
            className="flex min-w-0 flex-col justify-between rounded-2xl p-2.5"
            style={{
              backgroundColor: SURFACE.l1,
              border: `1px solid ${GLASS.border}`,
            }}
          >
            <span className="flex items-center gap-1 truncate text-xs" style={{ color: TEXT.secondary, fontSize: TYPE.label.size }}>
              <Dumbbell size={12} aria-hidden="true" /> Catálogo Activo
            </span>
            <strong
              className="mt-1 truncate font-mono text-sm font-bold tabular-nums"
              style={{ color: STATUS.progression.text }}
            >
              {totalExercises} Ejercicios
            </strong>
          </div>

          <div
            className="flex min-w-0 flex-col justify-between rounded-2xl p-2.5"
            style={{
              backgroundColor: SURFACE.l1,
              border: `1px solid ${GLASS.border}`,
            }}
          >
            <span className="flex items-center gap-1 truncate text-xs" style={{ color: TEXT.secondary, fontSize: TYPE.label.size }}>
              <Shield size={12} aria-hidden="true" /> Nivel de Acceso
            </span>
            <strong className="mt-1 truncate text-sm font-bold" style={{ color: ACCENT.text }}>
              Rol: Admin Pro
            </strong>
          </div>
        </div>

        {/* Barra de 5 Pestañas Apple Segmented Control visible al 100% en 390px */}
        <nav
          className="grid w-full grid-cols-6 gap-1 rounded-2xl p-1"
          style={{
            borderRadius: RADIUS.surface,
            border: `1px solid ${GLASS.border}`,
            backgroundColor: SURFACE.l1,
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
                className="min-h-[42px] min-w-0 truncate rounded-xl px-1 text-center font-semibold tracking-tight transition-colors"
                style={{
                  fontSize: TYPE.label.size,
                  backgroundColor: active ? ACCENT.base : "transparent",
                  color: active ? TEXT.primary : TEXT.secondary,
                }}
              >
                {label}
              </button>
            );
          })}
        </nav>

        <section className="min-w-0">
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

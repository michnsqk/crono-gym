import { useState } from "react";
import { Shield } from "lucide-react";
import { ACCENT, GLASS, RADIUS, SURFACE, TEXT } from "@/design/tokens";
import { AnnouncementsManager } from "./sections/AnnouncementsManager";
import { StoreManager } from "./sections/StoreManager";
import { ClassesManager } from "./sections/ClassesManager";
import { UsersRolesManager } from "./sections/UsersRolesManager";
import { ExerciseRequestsManager } from "./sections/ExerciseRequestsManager";

const TABS = [
  ["avisos", "Avisos"],
  ["tienda", "Tienda"],
  ["clases", "Clases"],
  ["usuarios", "Usuarios"],
  ["ejercicios", "Catálogo"],
] as const;
type AdminTab = (typeof TABS)[number][0];

export function AdminHub() {
  const [tab, setTab] = useState<AdminTab>("avisos");
  return (
    <main
      className="min-h-screen px-4 pb-36 pt-4 text-white"
      style={{ backgroundColor: SURFACE.base }}
    >
      <div className="mx-auto grid max-w-5xl gap-4">
        <header className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: ACCENT.subtle, color: ACCENT.base }}
          >
            <Shield size={22} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-white">Command Center · Admin</h1>
            <p className="text-xs" style={{ color: TEXT.secondary }}>
              Gestión del ecosistema Cronos
            </p>
          </div>
        </header>

        <nav
          className="flex items-center gap-1 overflow-x-auto p-1"
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
                className="min-h-[44px] flex-1 shrink-0 whitespace-nowrap rounded-xl px-3 text-xs font-semibold transition-colors"
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

        <section>
          {tab === "avisos" && <AnnouncementsManager />}
          {tab === "tienda" && <StoreManager />}
          {tab === "clases" && <ClassesManager />}
          {tab === "usuarios" && <UsersRolesManager />}
          {tab === "ejercicios" && <ExerciseRequestsManager />}
        </section>
      </div>
    </main>
  );
}

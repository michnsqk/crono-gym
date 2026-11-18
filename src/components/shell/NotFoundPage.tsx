import { Compass, Dumbbell, Home } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ACCENT, GLASS, SURFACE, TEXT } from "@/design/tokens";
import { HOME_PATH, ROUTINES_PATH } from "./navItems";

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <main
      className="flex min-h-[80vh] w-full items-center justify-center px-4 py-12 text-white"
      style={{ backgroundColor: SURFACE.base }}
    >
      <section
        className="w-full max-w-md rounded-3xl p-6 text-center"
        style={{
          backgroundColor: "#1C1C1E",
          border: `1px solid ${GLASS.border}`,
        }}
      >
        <div
          className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ backgroundColor: ACCENT.subtle, color: ACCENT.base }}
        >
          <Compass size={26} aria-hidden="true" />
        </div>
        <p
          className="font-mono text-[11px] font-bold uppercase tracking-widest"
          style={{ color: ACCENT.text }}
        >
          404 · CRONOS GYM
        </p>
        <h1 className="mt-1 text-xl font-bold tracking-tight" style={{ color: TEXT.primary }}>
          Página no encontrada
        </h1>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: TEXT.secondary }}>
          La ruta que buscas no existe o fue movida. Vuelve al inicio o entra directo a tus rutinas.
        </p>

        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
          <button
            type="button"
            onClick={() => navigate(HOME_PATH)}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-bold text-white active:scale-[0.98]"
            style={{ backgroundColor: ACCENT.base }}
          >
            <Home size={16} aria-hidden="true" />
            <span>Ir al Inicio</span>
          </button>
          <button
            type="button"
            onClick={() => navigate(ROUTINES_PATH)}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold text-white active:scale-[0.98]"
            style={{
              backgroundColor: "rgba(255,255,255,0.06)",
              border: `1px solid ${GLASS.border}`,
            }}
          >
            <Dumbbell size={16} aria-hidden="true" />
            <span>Ver Rutinas</span>
          </button>
        </div>
      </section>
    </main>
  );
}

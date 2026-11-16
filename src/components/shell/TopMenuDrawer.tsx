import { useNavigate } from "react-router-dom";
import {
  Award,
  BookOpen,
  Shield,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  User,
  X,
} from "lucide-react";
import { useAdvancedMode } from "@/hooks/useAdvancedMode";
import { usePermissions } from "@/hooks/usePermissions";
import { PROFILE_PATH, RANGES_PATH } from "@/components/shell/navItems";

interface TopMenuDrawerProps {
  open: boolean;
  onClose: () => void;
  onOpenStore?: () => void;
  onOpenTour?: () => void;
}

export function TopMenuDrawer({
  open,
  onClose,
  onOpenStore,
  onOpenTour,
}: TopMenuDrawerProps) {
  const navigate = useNavigate();
  const [advancedMode, setAdvancedMode] = useAdvancedMode();
  const permissions = usePermissions();

  if (!open) return null;

  const go = (path: string) => {
    onClose();
    navigate(path);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Menú principal"
      className="fixed inset-0 z-[90] flex justify-end bg-black/80"
    >
      <div className="cronos-drawer-transition flex h-full w-full max-w-xs flex-col border-l border-white/[0.06] bg-black p-5">
        <div className="flex items-center justify-between">
          <span className="text-base font-bold tracking-tight text-white">
            Menú Cronos
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar menú"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.06] bg-[#1C1C1E] text-zinc-300 transition-transform active:scale-[0.98]"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="mt-6 flex flex-1 flex-col gap-3" aria-label="Accesos secundarios">
          <div className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/[0.06] bg-[#1C1C1E]">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenStore?.();
              }}
              className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[#2C2C2E] active:scale-[0.99]"
            >
              <ShoppingBag size={18} className="mt-0.5 shrink-0 text-[#FF3B30]" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold tracking-tight text-white">Tienda y Clases</div>
                <div className="mt-0.5 text-xs leading-snug text-zinc-400">
                  Reserva clases grupales, suplementos y equipo oficial del club.
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => go(PROFILE_PATH)}
              className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[#2C2C2E] active:scale-[0.99]"
            >
              <User size={18} className="mt-0.5 shrink-0 text-zinc-300" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold tracking-tight text-white">Mi Perfil</div>
                <div className="mt-0.5 text-xs leading-snug text-zinc-400">
                  Ajusta tus objetivos, unidades de peso, historial CSV y preferencias.
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => go(RANGES_PATH)}
              className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[#2C2C2E] active:scale-[0.99]"
            >
              <Award size={18} className="mt-0.5 shrink-0 text-zinc-300" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold tracking-tight text-white">Rangos Anatómicos</div>
                <div className="mt-0.5 text-xs leading-snug text-zinc-400">
                  Explora tu nivel de fuerza y volumen acumulado por grupo muscular.
                </div>
              </div>
            </button>

            {onOpenTour && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenTour();
                }}
                className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[#2C2C2E] active:scale-[0.99]"
              >
                <BookOpen size={18} className="mt-0.5 shrink-0 text-zinc-300" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold tracking-tight text-white">Guía Rápida del Sistema</div>
                  <div className="mt-0.5 text-xs leading-snug text-zinc-400">
                    Aprende cómo funcionan las series, RPE, descansos y Cronos IA.
                  </div>
                </div>
              </button>
            )}
          </div>

          {/* Switch Modo Avanzado */}
          <div className="flex items-center justify-between rounded-2xl border border-white/[0.06] bg-[#1C1C1E] px-4 py-3">
            <div className="flex items-center gap-3">
              <SlidersHorizontal size={18} className="text-zinc-300" aria-hidden="true" />
              <div>
                <div className="text-sm font-semibold text-white">Modo Avanzado</div>
                <div className="text-[11px] text-zinc-400">
                  Métricas MEV/MAV y Arquitecto
                </div>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={advancedMode}
              onClick={() => setAdvancedMode(!advancedMode)}
              className="h-8 w-14 rounded-full p-1 transition-colors"
              style={{
                backgroundColor: advancedMode ? "#FF3B30" : "#2C2C2E",
              }}
            >
              <span
                className="block h-6 w-6 rounded-full bg-white transition-transform"
                style={{
                  transform: advancedMode ? "translateX(24px)" : "translateX(0px)",
                }}
              />
            </button>
          </div>

          {(permissions.canAccessCoach || permissions.canAccessAdmin) && (
            <div className="mt-4 flex flex-col gap-2 border-t border-white/10 pt-4">
              {permissions.canAccessCoach && (
                <button
                  type="button"
                  onClick={() => go("/coach/portal")}
                  className="flex h-12 items-center gap-3 rounded-2xl border border-white/10 bg-[#1C1C1E] px-4 text-sm font-semibold text-white active:scale-[0.98]"
                >
                  <Sparkles size={18} className="text-[#FF3B30]" aria-hidden="true" />
                  <span>Portal Coach</span>
                </button>
              )}
              {permissions.canAccessAdmin && (
                <button
                  type="button"
                  onClick={() => go("/admin")}
                  className="flex h-12 items-center gap-3 rounded-2xl border border-white/10 bg-[#1C1C1E] px-4 text-sm font-semibold text-white active:scale-[0.98]"
                >
                  <Shield size={18} className="text-[#FF3B30]" aria-hidden="true" />
                  <span>Panel Admin</span>
                </button>
              )}
            </div>
          )}
        </nav>
      </div>
    </div>
  );
}

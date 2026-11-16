import { useState } from "react";
import { useInRouterContext, useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  ChevronLeft,
  Dumbbell,
  Home,
  Layers,
  Menu,
  Sparkles,
  TrendingUp,
  X,
} from "lucide-react";

const WELCOME_TOUR_KEY = "cronos_welcome_tour_seen_v2";

export function hasSeenWelcomeTour(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(WELCOME_TOUR_KEY) === "1";
  } catch {
    return true;
  }
}

export function markWelcomeTourSeen(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(WELCOME_TOUR_KEY, "1");
  } catch {
    // Ignore storage errors
  }
}

interface WelcomeTourModalProps {
  open: boolean;
  onClose: () => void;
}

const GUIDE_STEPS = [
  {
    icon: Home,
    eyebrow: "PASO 1 DE 6 · INICIO",
    title: "Tu centro de mando diario",
    description:
      "Al abrir Cronos ves los avisos del gimnasio (toca cualquier foto para ampliarla), productos de recepción y tu botón principal para entrenar al instante.",
    actions: [
      { label: "Empezar entrenamiento", detail: "Lanza tu sesión de hoy en 1 toque" },
      { label: "Ver resumen de rendimiento", detail: "Despliega o colapsa tu racha, readiness y PRs" },
    ],
    route: "/",
    routeLabel: "Ir a Inicio",
  },
  {
    icon: Menu,
    eyebrow: "PASO 2 DE 6 · MENÚ CRONOS (☰)",
    title: "Accesos rápidos y respaldo",
    description:
      "Toca el botón ☰ arriba a la derecha en Inicio para abrir tu centro de herramientas y configuración sin llenar la pantalla principal.",
    actions: [
      { label: "Mi Perfil", detail: "Importa/exporta tu historial CSV (Hevy, Symmetry)" },
      { label: "Modo Avanzado", detail: "Activa métricas MEV/MAV y herramientas de Arquitecto" },
    ],
    route: "/perfil",
    routeLabel: "Abrir Mi Perfil",
  },
  {
    icon: Layers,
    eyebrow: "PASO 3 DE 6 · RUTINAS",
    title: "Crea o filtra tus planes",
    description:
      "Separa rutinas Individuales de Semanales para no hacer scroll. Arriba tienes tres asistentes y la guía biomecánica del club.",
    actions: [
      { label: "Cronos Smart & Arquitecto", detail: "Arma semanas de 2–6 días o intercambia ejercicios" },
      { label: "Atlas de Agarres & Coach VIP", detail: "Consulta posturas de pies/manerales o pide rutina 1-a-1" },
    ],
    route: "/rutinas",
    routeLabel: "Explorar Rutinas",
  },
  {
    icon: Dumbbell,
    eyebrow: "PASO 4 DE 6 · ENTRENO ACTIVO",
    title: "Registra series con una mano",
    description:
      "Usa el carrusel superior para cambiar de ejercicio, registra KG / REPS / RPE y ajusta cargas al instante sin soltar la barra.",
    actions: [
      { label: "±2.5 kg / ±1 rep", detail: "Botones rápidos debajo de tu serie pendiente" },
      { label: "Icono ✨ (Motores Cronos)", detail: "Calcula Sobrecarga Progresiva, Aproximación y Calentamiento" },
    ],
    route: "/entrenar",
    routeLabel: "Ver Entrenamiento",
  },
  {
    icon: TrendingUp,
    eyebrow: "PASO 5 DE 6 · PROGRESO Y RANGOS",
    title: "Mide tu fuerza y consistencia",
    description:
      "Revisa tu volumen semanal, historial de sesiones, récords personales (1RM) y tu nivel anatómico por cada grupo muscular.",
    actions: [
      { label: "Progreso", detail: "Gráficas de carga, racha y marcas históricas" },
      { label: "Rangos Anatómicos", detail: "Mapa frontal/posterior con tu nivel (Bronce a Élite)" },
    ],
    route: "/progreso",
    routeLabel: "Ver Progreso",
  },
  {
    icon: Sparkles,
    eyebrow: "PASO 6 DE 6 · CRONOS IA & OFFLINE",
    title: "Asistente en piso y guardado seguro",
    description:
      "La píldora flotante Cronos IA responde dudas sobre máquinas y sustituciones. Toda tu sesión se guarda offline y se sincroniza automáticamente.",
    actions: [
      { label: "Cronos IA", detail: "Pregúntale variantes o qué máquina usar en el gym" },
      { label: "Modo Offline", detail: "Nunca pierdes tus series aunque baje la señal" },
    ],
    route: null,
    routeLabel: null,
  },
] as const;

function GuideRouteButton({
  route,
  label,
  onDone,
}: {
  route: string;
  label: string;
  onDone: () => void;
}) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => {
        onDone();
        navigate(route);
      }}
      className="mt-3 flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-white/[0.06] bg-[#2C2C2E] px-3 text-xs font-semibold text-white transition-transform active:scale-[0.98]"
    >
      <span>{label}</span>
      <ArrowRight size={14} aria-hidden="true" />
    </button>
  );
}

export function WelcomeTourModal({ open, onClose }: WelcomeTourModalProps) {
  const [step, setStep] = useState(0);
  const inRouter = useInRouterContext();

  if (!open) return null;

  const slide = GUIDE_STEPS[step];
  const Icon = slide.icon;
  const isFirst = step === 0;
  const isLast = step === GUIDE_STEPS.length - 1;

  const finish = () => {
    markWelcomeTourSeen();
    setStep(0);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Guía interactiva de Cronos Gym"
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/85 p-4 backdrop-blur-md sm:items-center"
    >
      <div className="w-full max-w-md rounded-3xl border border-white/[0.06] bg-[#1C1C1E] p-5 sm:p-6">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-[#FF3B30]">
            <Activity size={13} aria-hidden="true" />
            {slide.eyebrow}
          </span>
          <button
            type="button"
            onClick={finish}
            aria-label="Cerrar guía"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.06] bg-[#2C2C2E] text-zinc-300 transition-transform active:scale-95"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 flex items-center gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#FF3B30]/15 text-[#FF3B30]">
            <Icon size={24} aria-hidden="true" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white">
            {slide.title}
          </h2>
        </div>

        <p className="mt-3 text-[13px] leading-relaxed text-zinc-300">
          {slide.description}
        </p>

        {/* Qué puedes hacer aquí (tarjetas limpias con divisores 1px) */}
        <div className="mt-4 divide-y divide-white/[0.06] rounded-2xl border border-white/[0.06] bg-black/40 px-3.5">
          {slide.actions.map((act) => (
            <div key={act.label} className="py-2.5">
              <div className="text-xs font-semibold text-white">{act.label}</div>
              <div className="mt-0.5 text-[11px] text-zinc-400">{act.detail}</div>
            </div>
          ))}
        </div>

        {inRouter && slide.route && slide.routeLabel && (
          <GuideRouteButton route={slide.route} label={slide.routeLabel} onDone={finish} />
        )}

        {/* Progress dots */}
        <div className="mt-5 flex items-center justify-center gap-1.5">
          {GUIDE_STEPS.map((s, idx) => (
            <button
              key={s.eyebrow}
              type="button"
              aria-label={`Ir al paso ${idx + 1}`}
              onClick={() => setStep(idx)}
              className="h-1.5 rounded-full transition-all duration-200"
              style={{
                width: idx === step ? 24 : 8,
                backgroundColor: idx === step ? "#FF3B30" : "#2C2C2E",
              }}
            />
          ))}
        </div>

        <div className="mt-5 flex items-center gap-2.5">
          {!isFirst ? (
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              className="inline-flex h-12 items-center justify-center gap-1 rounded-2xl border border-white/[0.06] bg-[#2C2C2E] px-4 text-sm font-semibold text-zinc-200 transition-transform active:scale-[0.98]"
            >
              <ChevronLeft size={16} aria-hidden="true" />
              <span>Atrás</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={finish}
              className="h-12 rounded-2xl border border-white/[0.06] bg-[#2C2C2E] px-4 text-sm font-semibold text-zinc-300 transition-transform active:scale-[0.98]"
            >
              Saltar
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (isLast) finish();
              else setStep((s) => s + 1);
            }}
            className="h-12 flex-1 rounded-2xl bg-[#FF3B30] px-4 text-sm font-semibold text-white transition-transform active:scale-[0.98]"
          >
            {isLast ? "Empezar" : "Siguiente"}
          </button>
        </div>
      </div>
    </div>
  );
}

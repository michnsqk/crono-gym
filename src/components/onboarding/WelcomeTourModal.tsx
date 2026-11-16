import { useState } from "react";
import { Home, Layers, Sparkles, X } from "lucide-react";

const WELCOME_TOUR_KEY = "cronos_welcome_tour_seen_v1";

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

const SLIDES = [
  {
    icon: Home,
    eyebrow: "PASO 1 DE 3 · INICIO",
    title: "Tus avisos y entrenamiento hoy",
    description:
      "Al abrir Cronos Gym ves al instante los avisos del gimnasio, los productos disponibles y el botón directo para empezar tu sesión.",
  },
  {
    icon: Layers,
    eyebrow: "PASO 2 DE 3 · RUTINAS",
    title: "Elige plantilla o mapa muscular",
    description:
      "Usa una plantilla rápida en 1 toque o toca el selector anatómico frontal y posterior para armar tu rutina sin complicaciones.",
  },
  {
    icon: Sparkles,
    eyebrow: "PASO 3 DE 3 · CRONOS IA",
    title: "Tu entrenador flotante al instante",
    description:
      "Toca el botón Cronos IA en cualquier pantalla para preguntar cómo usar una máquina, pedir variantes o saber qué te toca hoy.",
  },
] as const;

export function WelcomeTourModal({ open, onClose }: WelcomeTourModalProps) {
  const [step, setStep] = useState(0);

  if (!open) return null;

  const slide = SLIDES[step];
  const Icon = slide.icon;
  const isLast = step === SLIDES.length - 1;

  const finish = () => {
    markWelcomeTourSeen();
    setStep(0);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Guía rápida de Cronos Gym"
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/85 p-4 sm:items-center"
    >
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#1C1C1E] p-6">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#FF3B30]">
            {slide.eyebrow}
          </span>
          <button
            type="button"
            onClick={finish}
            aria-label="Cerrar guía"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#2C2C2E] text-zinc-300 active:scale-[0.98] transition-transform duration-150"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FF3B30]/15 text-[#FF3B30]">
          <Icon size={30} aria-hidden="true" />
        </div>

        <h2 className="mt-5 text-2xl font-bold tracking-tight text-white">
          {slide.title}
        </h2>

        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          {slide.description}
        </p>

        {/* Progress dots */}
        <div className="mt-6 flex items-center gap-2">
          {SLIDES.map((s, idx) => (
            <span
              key={s.eyebrow}
              className="h-1.5 rounded-full transition-all duration-200"
              style={{
                width: idx === step ? 28 : 8,
                backgroundColor: idx === step ? "#FF3B30" : "#2C2C2E",
              }}
            />
          ))}
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={finish}
            className="h-12 rounded-xl border border-white/10 bg-[#2C2C2E] px-4 text-sm font-semibold text-zinc-200 active:scale-[0.98] transition-transform duration-150"
          >
            Saltar
          </button>
          <button
            type="button"
            onClick={() => {
              if (isLast) finish();
              else setStep((prev) => prev + 1);
            }}
            className="h-12 flex-1 rounded-xl bg-[#FF3B30] px-4 text-sm font-semibold text-white active:scale-[0.98] transition-transform duration-150"
          >
            {isLast ? "Empezar" : "Siguiente"}
          </button>
        </div>
      </div>
    </div>
  );
}

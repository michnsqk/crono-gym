import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import { supabase } from "@lib/supabase";
import { AuthModal } from "./components/AuthModal";
import { BrandLockup } from "./components/shell/BrandLockup";
import { SegmentedControl } from "./components/ui/SegmentedControl";

const Onboarding = lazy(() =>
  import("./components/Onboarding").then((m) => ({ default: m.Onboarding })),
);

const DashboardPage = lazy(() =>
  import("./components/dashboard/DashboardPage").then((m) => ({ default: m.DashboardPage })),
);

const ActiveWorkoutView = lazy(() =>
  import("./components/workout/ActiveWorkoutView").then((m) => ({ default: m.ActiveWorkoutView })),
);
const ProgressCharts = lazy(() =>
  import("./components/progress/ProgressCharts").then((m) => ({ default: m.ProgressCharts })),
);
const ConsistencyTracker = lazy(() =>
  import("./components/progress/ConsistencyTracker").then((m) => ({ default: m.ConsistencyTracker })),
);
const WorkoutHistory = lazy(() =>
  import("./components/progress/WorkoutHistory").then((m) => ({ default: m.WorkoutHistory })),
);
const AnatomicalRanksPage = lazy(() =>
  import("./components/ranks/AnatomicalRanksPage").then((m) => ({ default: m.AnatomicalRanksPage })),
);
const CoachHub = lazy(() =>
  import("./components/coach/CoachHub").then((m) => ({ default: m.CoachHub })),
);
import { useActiveSession } from "./context/ActiveSessionContext";
import { HOME_PATH, NAV_DESTINATIONS } from "./components/shell/navItems";
import { MUSCLE_PARAM } from "./lib/muscleFilter";
import {
  useProgress,
  useRoutines,
} from "./hooks/useGymData";
import { useProfile } from "./hooks/useProfile";
import { useOfflineSync } from "./hooks/useOfflineSync";
import { AuthModalProvider } from "./context/AuthModalContext";
import { TEXT, TYPE } from "@/design/tokens";
import { PROGRESS_LABELS, RANK_LABELS } from "@/lib/i18n";

/**
 * Exact-path comparison, so `/` does not claim to be active on every route.
 *
 * The header routes are literals with no parameters, so a prefix match would be
 * more machinery than the problem deserves.
 */
export function isTabActive(path: string, pathname: string): boolean {
  return pathname === path;
}

/**
 * The authenticated workspace.
 *
 * A layout route element rather than a component: it renders the chrome and the
 * gate, and the router decides which view lands in its `<Outlet />`. This is what
 * replaced the `useState<View>` switch, and it is why the session state below
 * survives navigating between views -- a layout is not unmounted by its children
 * changing.
 *
 * Fase 7 removed the header tab row that used to live here (`APP_TABS`,
 * `isTabActive` and `TabButton`, all gone). It advertised four routes *on top of*
 * the navigation bar, so two of them appeared twice under two different names and
 * two existed nowhere else. What is left of the header is the mobile brand, which
 * `SideRail` renders from 768px up -- one bar, five destinations, one name each.
 */
export function AuthGate() {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const { ready, userId, email } = useAuthSession();
  const { rehydrate, isActive } = useActiveSession();
  const {
    profile,
    loading: profileLoading,
    update: updateProfile,
  } = useProfile(userId);
  const location = useLocation();
  const navigate = useNavigate();
  /** Track the last userId we rehydrated for, to prevent duplicate calls. */
  const lastRehydratedUserIdRef = useRef<string | null>(null);

  /**
   * Look for a session that never finished, before anything decides there is
   * no session.
   *
   * The lookup lives in the session provider, one level above the router, and
   * this is where it is triggered: the gate is the one place that knows who
   * is signed in. A reload used to land on the dashboard with a session still
   * running on the device, because the lookup happened inside the workout --
   * a component that only mounts once the app has already decided.
   */
  useEffect(() => {
    if (!userId) {
      lastRehydratedUserIdRef.current = null;
      return;
    }
    // Prevent duplicate rehydration for the same user
    if (lastRehydratedUserIdRef.current === userId) {
      if (import.meta.env.DEV) {
        console.log("[CRONOS-REHYDRATE] AuthGate: already rehydrated for this user, skipping");
      }
      return;
    }
    if (import.meta.env.DEV) {
      console.log(
        "[CRONOS-REHYDRATE] AuthGate: recovery start, userId present:",
        Boolean(userId),
      );
    }
    if (import.meta.env.DEV) {
      console.log("[CRONOS-REHYDRATE] AuthGate: calling rehydrate");
    }
    lastRehydratedUserIdRef.current = userId;
    rehydrate(userId);
  }, [userId, rehydrate]);

  // Mounted app-wide, not just inside a workout: a session finished offline has
  // to reach the server on reconnect even if the user never starts another one.
  const sync = useOfflineSync(Boolean(userId));

  // A signed-in user without a completed onboarding goes straight into the
  // wizard; every other view stays unreachable until then.
  const needsOnboarding =
    Boolean(userId) && profile !== null && profile.onboarding_completed_at === null;

  
  const closeAuthModal = useCallback(() => setIsAuthModalOpen(false), []);
  // Stable identity, so the provider's memoised value does not change every render.
  const openAuthModal = useCallback(() => setIsAuthModalOpen(true), []);

  /*
   * Which destination the athlete was refused, so `Welcome` can name it: "inicia
   * sesión para ver Rutinas" beats "inicia sesión", which is what a signed-out user
   * tapping the navigation used to get.
   *
   * Read from `NAV_DESTINATIONS` rather than the list this file used to own, so the
   * name can never again be one the navigation does not show. `HOME_PATH` is
   * excluded because the dashboard is the one destination a signed-out visitor may
   * see, and saying "inicia sesión para ver Inicio" while showing them Inicio would
   * be nonsense.
   */
  const requestedDestination = NAV_DESTINATIONS.find(
    (destination) => destination.path !== HOME_PATH && destination.path === location.pathname,
  );

  return (
    <AuthModalProvider open={openAuthModal}>
      <div className="min-h-screen bg-neutral-950 text-neutral-100">
      {/*
        Brand-only since Fase 7 removed the header tab row. The destinations live
        in `BottomNav` and `SideRail`, so this bar exists to put the mark on screen
        below 768px -- where the rail is `display: none` -- and nothing else.
      */}
      {!isActive && userId && (
        <header
          className="hidden sticky top-0 z-40 border-b border-white/10 bg-neutral-900/60 backdrop-blur-md"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <h1 className="flex items-center gap-2.5">
              {/*
                Ocultado en móvil: la navegación inferior (MobileNav) es la única
                estructura fija que debe existir por debajo de 768px. El desktop
                SideRail ya renderiza la marca desde 768px arriba, así que este
                header no aporta nada en ningún breakpoint y se mantiene oculto
                para que Today arranque desde el safe-area-inset-top.
              */}
              <BrandLockup className="hidden max-md:flex" size={30} />
            </h1>
          </div>
        </header>
      )}

      <main className={`mx-auto max-w-6xl px-6 ${isActive ? "py-0" : "py-8"}`}>
        {sync.pending > 0 && !sync.online && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5">
            <p className="text-xs text-amber-200">
              Sin conexión: {sync.pending === 1 ? "1 sesión" : `${sync.pending} sesiones`}{" "}
              esperando sincronizar. Están guardadas en este dispositivo y se
              enviarán solas al recuperar la red.
            </p>
            <button
              type="button"
              onClick={() => void sync.syncNow()}
              className="rounded-lg border border-amber-500/40 px-3 py-1 text-[11px] text-amber-200 transition hover:bg-amber-500/10"
            >
              Reintentar
            </button>
          </div>
        )}
        {!ready ? (
          <div className="space-y-4" aria-busy="true" aria-label="Cargando Cronos Gym">
            <div className="h-32 rounded-3xl border border-white/10 bg-[#0d0d0f] p-5">
              <div className="h-4 w-28 rounded bg-white/10" />
              <div className="mt-3 h-7 w-52 rounded bg-white/10" />
              <div className="mt-2 h-3 w-40 rounded bg-white/5" />
            </div>
            <button
              type="button"
              onClick={() => navigate("/entrenar")}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#FF3B30] px-5 text-base font-bold text-white"
            >
              <span>Empezar entrenamiento de hoy</span>
            </button>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="h-28 rounded-3xl border border-white/10 bg-[#0d0d0f]" />
              <div className="h-28 rounded-3xl border border-white/10 bg-[#0d0d0f]" />
            </div>
          </div>
        ) : !userId ? (
          <Welcome
            requestedLabel={requestedDestination?.label ?? null}
            onOpenAuth={() => setIsAuthModalOpen(true)}
          />
        ) : needsOnboarding ? (
          profileLoading || profile === null ? (
            <p className="text-neutral-500">Cargando tu perfil…</p>
          ) : (
            <Suspense fallback={<div className="min-h-screen bg-black" />}>
              <Onboarding
                profile={profile}
                onSave={updateProfile}
                // Finishing the wizard drops the user on the daily log, which is
                // the one view that is never locked.
                onFinish={() => navigate("/")}
              />
            </Suspense>
          )
        ) : (
          <div key={location.pathname} className="cronos-page-transition w-full">
            {/* Only the user id and email travel through outlet context now: the
                session lives in `ActiveSessionContext` because `AppShell` has to
                read it too. */}
            <Outlet context={{ userId, email }} />
          </div>
        )}
      </main>

      {/* Rendered outside the gate so it stays reachable in both auth states. */}
      <AuthModal
        open={isAuthModalOpen}
        onClose={closeAuthModal}
        onAuthenticated={closeAuthModal}
      />
      </div>
    </AuthModalProvider>
  );
}

/**
 * The slice of workspace state the routed views need.
 *
 * Read through `useOutletContext` rather than a global, so a view that does not
 * train has no way to reach the session and no test has to mock a module.
 *
 * `userId` is here rather than passed to each route element because the router
 * cannot know it: it comes from the Supabase session, which `AuthGate` resolves.
 * Passing it down as a prop would mean the route table had to be built per user,
 * and the table is created once at module scope.
 *
 * `email` rides along for the same reason and the same reason it is *not* re-read
 * from Supabase downstream: a second `getSession()` is a second source of truth
 * that can disagree with the gate's, and the profile is the screen where that
 * disagreement would be visible.
 */
export interface WorkspaceOutletContext {
  userId: string;
  email: string;
}

function readCachedAuthSession(): { userId: string | null; email: string } {
  if (typeof window === "undefined") return { userId: null, email: "" };
  try {
    const raw = window.localStorage.getItem("cronos_auth_token");
    if (!raw) return { userId: null, email: "" };
    const parsed = JSON.parse(raw) as {
      user?: { id?: unknown; email?: unknown };
      currentSession?: { user?: { id?: unknown; email?: unknown } };
    };
    const user = parsed?.user ?? parsed?.currentSession?.user;
    if (typeof user?.id === "string" && user.id.length > 0) {
      return {
        userId: user.id,
        email: typeof user.email === "string" ? user.email : "",
      };
    }
  } catch {
    // Ignore malformed local cache and let Supabase resolve asynchronously.
  }
  return { userId: null, email: "" };
}

/** Tracks the Supabase session; onAuthStateChange keeps the UI in sync after login. */
function useAuthSession() {
  const [cached] = useState(readCachedAuthSession);
  const [ready, setReady] = useState(() => cached.userId !== null);
  const [userId, setUserId] = useState<string | null>(() => cached.userId);
  const [email, setEmail] = useState(() => cached.email);

  useEffect(() => {
    let alive = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!alive) return;
        const nextId = data.session?.user.id ?? null;
        // Offline resilience: if network refresh failed while offline, keep cached userId.
        if (nextId !== null || typeof navigator === "undefined" || navigator.onLine) {
          setUserId(nextId);
          setEmail(data.session?.user.email ?? "");
        }
        setReady(true);
      })
      .catch(() => {
        if (alive) setReady(true);
      });
    const { data: listener } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === "SIGNED_OUT") {
        setUserId(null);
        setEmail("");
        setReady(true);
        return;
      }
      setUserId(next?.user.id ?? null);
      setEmail(next?.user.email ?? "");
      setReady(true);
    });
    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  return { ready, userId, email };
}

function Welcome({
  requestedLabel: _requestedLabel,
  onOpenAuth,
}: {
  requestedLabel: string | null;
  onOpenAuth: () => void;
}) {
  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogle() {
    setLoading(true);
    setError(null);
    try {
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error inesperado";
      setError(msg);
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error inesperado";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[75vh] items-center justify-center px-2">
      <div className="w-full max-w-sm rounded-[28px] border border-white/10 bg-[#0A0A0C]/95 p-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.85)] backdrop-blur-2xl">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-black shadow-[0_0_32px_rgba(215,0,21,0.22)]">
          <img
            src="/logo.jpg"
            alt="Cronos Gym"
            width={48}
            height={48}
            className="h-12 w-12 rounded-lg object-contain"
            style={{ filter: "invert(1)", mixBlendMode: "screen" }}
          />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-white">CRONOS GYM</h2>
        <p className="mb-7 mt-1 text-sm text-zinc-400">Tu templo. Tus marcas. Tu progreso.</p>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={loading}
          className="mb-3 flex h-[52px] w-full items-center justify-center gap-3 rounded-full bg-white px-5 text-[15px] font-semibold text-[#1F1F1F] shadow-[0_2px_12px_rgba(255,255,255,0.12)] transition hover:bg-neutral-100 active:scale-[0.98] disabled:opacity-50"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z" />
            <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z" />
            <path fill="#FBBC05" d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z" />
            <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z" />
          </svg>
          <span>Continuar con Google</span>
        </button>

        <button
          type="button"
          onClick={() => setShowEmail((v) => !v)}
          className="mb-4 flex h-12 w-full items-center justify-center rounded-full border border-white/10 bg-[#1C1C1E] px-5 text-sm font-medium text-neutral-200 transition hover:bg-[#2C2C2E] active:scale-[0.98]"
        >
          Iniciar con correo electrónico
        </button>

        {showEmail && (
          <form className="mb-4 space-y-3" onSubmit={handleSubmit}>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              className="w-full rounded-lg border border-white/10 bg-neutral-950/60 px-3 py-2 text-sm text-white placeholder:text-neutral-600"
            />
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="........"
              className="w-full rounded-lg border border-white/10 bg-neutral-950/60 px-3 py-2 text-sm text-white placeholder:text-neutral-600"
            />
            {error && <p className="text-xs text-red-300">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-neutral-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:opacity-50"
            >
              {loading ? "Cargando..." : "Iniciar Sesión"}
            </button>
          </form>
        )}

        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            onOpenAuth();
          }}
          className="text-xs text-neutral-400 hover:text-white"
        >
          Explorar como invitado
        </a>

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-neutral-300">
            ⚡ Mapeo de máquinas
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-neutral-300">
            📊 Registro de series y RPE
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-neutral-300">
            🤖 Coach con IA integrada
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * The home screen: the dashboard.
 *
 * Always the dashboard, never the workout itself. Training lives at `/entrenar`
 * so that the session has one address: the pill, the deep link and the routine
 * builder all arrive at the same screen, and reloading mid-session returns to the
 * workout rather than to a menu with a session silently running behind it.
 */
export function HomeView() {
  const { userId } = useOutletContext<WorkspaceOutletContext>();

  if (!userId) {
    return (
      <Welcome
        requestedLabel={null}
        onOpenAuth={() => {}}
      />
    );
  }

  return (
    <Suspense fallback={<div className="min-h-[60vh] animate-pulse rounded-3xl border border-white/10 bg-[#0d0d0f]" />}>
      <DashboardPage userId={userId} />
    </Suspense>
  );
}

/**
 * The workout itself.
 *
 * Falls back to the picker when no session is running, so a deep link, a
 * bookmark or the pill arriving after the session already ended all land on
 * something usable instead of an empty route.
 */
export function TrainView() {
  const { userId } = useOutletContext<WorkspaceOutletContext>();
  const { session, end, rehydrating } = useActiveSession();
  const { loading } = useRoutines(userId);
  /**
   * True once the routine library has finished a load. `loading` starts
   * false -- the first read happens in an effect, after the first paint --
   * so "not loading" on its own cannot tell a library that arrived from one
   * that has not been asked for yet. ActiveWorkout seeds its exercises from
   * the first render it mounts with and never re-seeds, so a session that
   * names a routine must not mount it until the library is in: mounting it
   * with an empty plan is a session with no exercises, and the library
   * landing a beat later does not fill it back in.
   */
const [libraryLoaded, setLibraryLoaded] = useState(false);
   /**
    * True once a load has completed at least once. `loading` starts false, so
    * gating on it alone would mark the library loaded on first render before
    * the first effect ever ran -- the exact bug this ref exists to prevent.
    * The effect below sets both together, so the two cannot disagree.
    */
   const loadedOnceRef = useRef(false);
   useEffect(() => {
     if (!loading && !loadedOnceRef.current) {
       loadedOnceRef.current = true;
       setLibraryLoaded(true);
     }
   }, [loading]);

  if (!session) {
    /*
     * The lookup has not answered yet. Answering "there is no session"
     * before the question has been asked is what sent the athlete home with
     * a session still running, so the screen waits for the answer instead.
     */
    if (rehydrating) {
      return <p className="text-neutral-500">Restaurando tu sesión…</p>;
    }
    return <HomeView />;
  }

  // A free session (no routine) is empty by design -- the picker is the
  // point -- so only a routine-backed session waits for the library. The
  // gate opens once and stays open: `loading` only rises again on a
  // re-fetch this screen does not trigger, so the workout is never
  // unmounted mid-session.
  if (session.routineId !== null && !(libraryLoaded && !loading)) {
    return <p className="text-neutral-500">Cargando…</p>;
  }

  return (
    <Suspense fallback={<p className="text-sm text-neutral-500">Cargando entrenamiento…</p>}>
      <ActiveWorkoutView
        userId={userId}
        routineId={session.routineId}
        routineTitle={session.title}
        planned={session.planned ?? []}
        onFinished={end}
      />
    </Suspense>
  );
}

export function ProgressView() {
  const { userId } = useOutletContext<WorkspaceOutletContext>();
  const { stats, loading, error } = useProgress(userId);
  const navigate = useNavigate();
  const [tab, setTab] = useState<"progreso" | "rangos">("progreso");

  return (
    <>
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}
      {loading ? (
        <p className="text-sm text-neutral-500">{PROGRESS_LABELS.loading}</p>
      ) : (
        <div className="pb-36 space-y-6">
          <div>
            <h2 style={pageTitleStyle}>{PROGRESS_LABELS.title}</h2>
            <p style={pageSubtitleStyle}>{PROGRESS_LABELS.subtitle(stats.recent.length)}</p>
          </div>
          <SegmentedControl
            value={tab}
            options={[
              { value: "progreso", label: "Progreso" },
              { value: "rangos", label: "Rangos" },
            ]}
            onChange={(value) => {
              setTab(value as "progreso" | "rangos");
              if (value === "rangos") navigate("/rangos", { replace: true });
            }}
            ariaLabel="Vista de progreso"
          />
          <Suspense fallback={<p className="text-sm text-neutral-500">Cargando gráficas…</p>}>
            <ProgressCharts stats={stats} />
            <div className="grid gap-5 lg:grid-cols-[1fr_360px] lg:items-start">
              <ConsistencyTracker week={stats.week} />
              <WorkoutHistory recent={stats.recent} />
            </div>
          </Suspense>
        </div>
      )}
    </>
  );
}

const pageTitleStyle: React.CSSProperties = {
  fontSize: TYPE.title2.size,
  lineHeight: TYPE.title2.lineHeight,
  fontWeight: TYPE.title2.weight,
  color: TEXT.primary,
};

const pageSubtitleStyle: React.CSSProperties = {
  fontSize: TYPE.caption.size,
  lineHeight: TYPE.caption.lineHeight,
  fontWeight: TYPE.caption.weight,
  color: TEXT.secondary,
};

/**
 * The anatomical ranks, on their own route.
 *
 * Split out of `ProgressView` rather than kept as a tab inside it. A tab was fine
 * while the tab was the only way in; now that the bottom navigation has its own
 * Rangos destination, the ranks view needs an address, so that a deep link, the
 * pill and the navigation item all land on the same screen.
 */
export function RangosView() {
  const { userId } = useOutletContext<WorkspaceOutletContext>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"progreso" | "rangos">("rangos");

  const browseMuscle = useCallback(
    (slug: string) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          next.set(MUSCLE_PARAM, slug);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  return (
    <div className="pb-36 space-y-6">
      <div>
        <h2 style={pageTitleStyle}>{PROGRESS_LABELS.title}</h2>
        <p style={pageSubtitleStyle}>{RANK_LABELS.subtitle}</p>
      </div>
      <SegmentedControl
        value={tab}
        options={[
          { value: "progreso", label: "Progreso" },
          { value: "rangos", label: "Rangos" },
        ]}
        onChange={(value) => {
          setTab(value as "progreso" | "rangos");
          if (value === "progreso") navigate("/progreso", { replace: true });
        }}
        ariaLabel="Vista de rangos"
      />
      {searchParams.get(MUSCLE_PARAM) && (
        <p
          role="status"
          className="rounded-lg border border-accent/30 bg-accent/10 px-4 py-2.5 text-xs text-accent"
        >
          Filtro aplicado. Abre el catálogo desde Rutinas para ver los
          ejercicios de este músculo.
        </p>
      )}
      <Suspense fallback={<p className="text-sm text-neutral-500">Cargando rangos…</p>}>
        <AnatomicalRanksPage userId={userId} onBrowseMuscle={browseMuscle} />
      </Suspense>
    </div>
  );
}

/**
 * The coach workspace, on its own route.
 *
 * Thin on purpose, exactly like `RangosView`: the route's whole job is to read the
 * user id out of the auth gate and hand it to the screen. Anything the coach knows
 * is derived inside the hub, so there is no state for a route wrapper to own and
 * nothing here that a refresh could lose.
 *
 * Reachable, but not navigable: `COACH_PATH` is a route without a destination, and the
 * profile's premium-services card is the way in. See `navItems.ts` for why it left the
 * bar rather than redirecting.
 */
export function CoachView() {
  const { userId } = useOutletContext<WorkspaceOutletContext>();
  return (
    <Suspense fallback={<p className="text-sm text-neutral-500">Cargando Coach IA…</p>}>
      <CoachHub userId={userId} />
    </Suspense>
  );
}
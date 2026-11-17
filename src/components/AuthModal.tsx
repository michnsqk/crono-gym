import { useState } from "react";
import { supabase } from "@lib/supabase";
import { X, Mail, Lock, User, CheckCircle2, AlertCircle } from "lucide-react";
import { RoleSelector } from "./RoleSelector";
import { useAuth } from "@/context/AuthContext";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  onAuthenticated: () => void;
}

export function AuthModal({ open, onClose, onAuthenticated }: AuthModalProps) {
  const { setActiveRole } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [availableRoles, setAvailableRoles] = useState<string[] | null>(null);
  const [pendingName, setPendingName] = useState<string | null>(null);

  if (!open) return null;

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
    setMessage(null);
    try {
      if (mode === "login") {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
        const { data: rolesData } = await supabase.rpc("my_roles");
        const roles = (rolesData ?? []).map((r: unknown) => String(r));
        if (roles.length > 1) {
          setAvailableRoles(roles);
          setPendingName(displayName.trim() || null);
          return;
        }
        onAuthenticated();
      } else {
        const { error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: displayName.trim() ? { data: { display_name: displayName.trim() } } : undefined,
        });
        if (authError) throw authError;
        setMessage("Cuenta creada. Inicia sesión.");
        setMode("login");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error inesperado";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  if (availableRoles && availableRoles.length > 1) {

  return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true">
        <div className="bg-neutral-900/80 backdrop-blur-2xl rounded-3xl border border-white/10 p-8 max-w-sm w-full mx-auto shadow-2xl">
          <RoleSelector
            availableRoles={availableRoles}
            activeRole="athlete"
            displayName={pendingName}
            onSelect={(role) => {
              setActiveRole(role as any);
              setAvailableRoles(null);
              onAuthenticated();
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Bienvenido a Cronos"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative mx-auto w-full max-w-sm rounded-[28px] border border-white/10 bg-[#0A0A0C]/95 p-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.85)] backdrop-blur-2xl">
        <button type="button" onClick={onClose} aria-label="Cerrar" className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-neutral-400 transition hover:bg-white/10 hover:text-white">
          <X className="h-4 w-4" />
        </button>
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-black shadow-[0_0_32px_rgba(215,0,21,0.22)]">
          <img src="/logo.jpg" alt="Cronos Gym" width={48} height={48} className="h-12 w-12 object-contain rounded-lg" style={{ filter: "invert(1)", mixBlendMode: "screen" }} />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-white">Bienvenido a Cronos</h2>
        <p className="mt-1 mb-7 text-sm text-zinc-400">Entrena, progresa y supera tus límites.</p>

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
          onClick={() => setShowEmailForm((v) => !v)}
          className="mb-4 flex h-12 w-full items-center justify-center rounded-full border border-white/10 bg-[#1C1C1E] px-5 text-sm font-medium text-neutral-200 transition hover:bg-[#2C2C2E] active:scale-[0.98]"
        >
          Iniciar con correo electrónico
        </button>

        {showEmailForm && (
          <form className="space-y-3 mb-4" onSubmit={handleSubmit}>
            {mode === "signup" && (
              <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-neutral-950/60 px-3 py-2">
                <User className="h-4 w-4 text-neutral-500" />
                <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Tu nombre" className="w-full bg-transparent text-sm text-white placeholder:text-neutral-600" />
              </div>
            )}
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-neutral-950/60 px-3 py-2">
              <Mail className="h-4 w-4 text-neutral-500" />
              <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" className="w-full bg-transparent text-sm text-white placeholder:text-neutral-600" />
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-neutral-950/60 px-3 py-2">
              <Lock className="h-4 w-4 text-neutral-500" />
              <input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="........" className="w-full bg-transparent text-sm text-white placeholder:text-neutral-600" />
            </div>
            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-neutral-700 bg-neutral-800/50 px-3 py-2 text-sm text-neutral-300">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {message && (
              <div className="flex items-start gap-2 rounded-lg border border-neutral-700 bg-neutral-800/50 px-3 py-2 text-sm text-neutral-300">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{message}</span>
              </div>
            )}
            <button type="submit" disabled={loading} className="w-full rounded-lg bg-neutral-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:opacity-50">
              {loading ? "Cargando..." : mode === "login" ? "Iniciar Sesión" : "Crear Cuenta"}
            </button>
            <button type="button" onClick={() => setMode(mode === "login" ? "signup" : "login")} className="text-xs text-neutral-400 hover:text-white">
              {mode === "login" ? "¿No tienes cuenta? Crear una" : "¿Ya tienes cuenta? Iniciar sesión"}
            </button>
          </form>
        )}

        <a href="#" onClick={(e) => { e.preventDefault(); onClose(); }} className="text-neutral-400 hover:text-white text-xs">
          Explorar como invitado
        </a>
      </div>
    </div>
  );
}

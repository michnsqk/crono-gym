import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { GlassButton, GlassCard, Skeleton } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { GLASS, RADIUS, SPACE, STATUS, TEXT, TYPE } from "@/design/tokens";

const USERS_CACHE_KEY = "cronos_admin_users_cache_v1";

interface AdminUser {
  user_id: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  roles: string[];
  granted_at: string | null;
}

function readCachedUsers(): AdminUser[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(USERS_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AdminUser[]) : [];
  } catch {
    return [];
  }
}

export function UsersRolesManager() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<AdminUser[]>(() => readCachedUsers());
  const [email, setEmail] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("coach");
  const [status, setStatus] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [{ data: profiles, error: profilesError }, { data: roleRows, error: rolesError }] = await Promise.all([
        (supabase as any).from("profiles").select("id,display_name,email,avatar_url"),
        (supabase as any).from("user_roles").select("user_id,role,granted_at"),
      ]);
      if (profilesError) throw profilesError;
      if (rolesError) throw rolesError;
      const rolesByUser = new Map<string, { roles: string[]; grantedAt: string | null }>();
      (roleRows ?? []).forEach((row: any) => {
        const existing = rolesByUser.get(row.user_id) ?? { roles: [], grantedAt: null };
        existing.roles.push(row.role);
        existing.grantedAt = row.granted_at ?? existing.grantedAt;
        rolesByUser.set(row.user_id, existing);
      });
      const mapped: AdminUser[] = (profiles ?? []).map((profile: any) => ({
        user_id: profile.id,
        display_name: profile.display_name ?? null,
        email: profile.email ?? null,
        avatar_url: profile.avatar_url ?? null,
        roles: rolesByUser.get(profile.id)?.roles ?? [],
        granted_at: rolesByUser.get(profile.id)?.grantedAt ?? null,
      }));
      setUsers(mapped);
      try {
        window.localStorage.setItem(USERS_CACHE_KEY, JSON.stringify(mapped));
      } catch {
        // Ignore storage quota error
      }
    } catch (error) {
      const fallback = readCachedUsers();
      if (fallback.length > 0) {
        setUsers(fallback);
        setErr("Mostrando caché local (no se pudo sincronizar usuarios con Supabase).");
      } else {
        setErr(error instanceof Error ? error.message : "Error al cargar usuarios.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const grant = useCallback(async () => {
    if (!email.trim()) {
      setErr("Ingresa el correo del usuario antes de asignar un rol.");
      return;
    }
    setErr(null);
    setStatus(null);
    try {
      const { error } = await (supabase as any).rpc("grant_user_role", {
        target_email: email.trim(),
        new_role: role,
      });
      if (error) throw error;
      setEmail("");
      setStatus("Rol asignado correctamente.");
      await load();
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Error al asignar rol.");
    }
  }, [email, role, load]);

  const revoke = useCallback(async (userId: string, targetRole: string) => {
    setErr(null);
    setStatus(null);
    const { error } = await (supabase as any).rpc("admin_revoke_role", {
      target_user_id: userId,
      target_role: targetRole,
    });
    if (error) {
      setErr(error.message);
      return;
    }
    setStatus("Rol revocado.");
    await load();
  }, [load]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return users;
    return users.filter((user) =>
      `${user.display_name ?? ""} ${user.email ?? ""}`.toLowerCase().includes(query),
    );
  }, [search, users]);

  if (loading && users.length === 0) return <Skeleton variant="block" height="160px" />;

  return (
    <GlassCard style={{ padding: SPACE.lg }}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 style={{ fontSize: TYPE.subhead.size, fontWeight: TYPE.subhead.weight, color: TEXT.primary, margin: 0 }}>
          Gestor de Usuarios y Roles
        </h3>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl px-3 text-xs font-semibold"
          style={{
            backgroundColor: GLASS.fillRaised,
            border: `1px solid ${GLASS.border}`,
            color: TEXT.secondary,
          }}
        >
          <RefreshCw size={13} aria-hidden="true" /> Actualizar
        </button>
      </div>

      <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <label className="grid gap-1">
          <span className="text-xs font-medium" style={{ color: TEXT.secondary }}>
            Correo electrónico
          </span>
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="atleta@cronosgym.com"
            className="min-h-[44px] w-full rounded-xl px-3 text-sm outline-none"
            style={{
              borderRadius: RADIUS.control,
              border: `1px solid ${GLASS.border}`,
              backgroundColor: GLASS.fill,
              color: TEXT.primary,
            }}
          />
        </label>

        <label className="grid gap-1">
          <span className="text-xs font-medium" style={{ color: TEXT.secondary }}>
            Rol a otorgar
          </span>
          <select
            value={role}
            onChange={(event) => setRole(event.target.value)}
            className="min-h-[44px] rounded-xl px-3 text-sm outline-none"
            style={{
              borderRadius: RADIUS.control,
              border: `1px solid ${GLASS.border}`,
              backgroundColor: GLASS.fill,
              color: TEXT.primary,
            }}
          >
            <option value="athlete">Atleta</option>
            <option value="coach">Entrenador</option>
            <option value="admin">Administrador</option>
          </select>
        </label>

        <div className="flex items-end">
          <GlassButton variant="primary" onClick={() => void grant()}>
            Asignar rol
          </GlassButton>
        </div>
      </div>

      <label className="mb-3 grid gap-1">
        <span className="text-xs font-medium" style={{ color: TEXT.secondary }}>
          Filtrar usuarios
        </span>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por nombre o correo"
          className="min-h-[44px] w-full rounded-xl px-3 text-sm outline-none"
          style={{
            borderRadius: RADIUS.control,
            border: `1px solid ${GLASS.border}`,
            backgroundColor: GLASS.fill,
            color: TEXT.primary,
          }}
        />
      </label>

      {status && (
        <p className="mb-2 text-xs font-medium" style={{ color: STATUS.success.text }} role="status">
          {status}
        </p>
      )}
      {err && (
        <div
          className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs"
          style={{
            backgroundColor: STATUS.warning.muted,
            border: `1px solid ${STATUS.warning.border}`,
            color: STATUS.warning.text,
          }}
          role="alert"
        >
          <span>{err}</span>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg px-2.5 py-1 font-semibold underline"
          >
            Reintentar
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {filteredUsers.length === 0 ? (
          <p className="py-4 text-center text-xs" style={{ color: TEXT.secondary }}>
            No hay usuarios para mostrar con este filtro.
          </p>
        ) : (
          filteredUsers.map((user) => (
            <div
              key={user.user_id}
              className="flex flex-wrap items-center gap-3 px-3 py-2.5"
              style={{
                borderRadius: RADIUS.control,
                border: `1px solid ${GLASS.border}`,
                backgroundColor: GLASS.fill,
              }}
            >
              {user.avatar_url ? (
                <img src={user.avatar_url} alt="" width={32} height={32} className="rounded-full object-cover" />
              ) : (
                <span
                  aria-hidden="true"
                  className="inline-block h-8 w-8 shrink-0 rounded-full"
                  style={{ backgroundColor: GLASS.border }}
                />
              )}
              <div className="min-w-0 flex-1">
                <strong className="block truncate text-sm" style={{ color: TEXT.primary }}>
                  {user.display_name || "Sin nombre"}
                </strong>
                <span className="block truncate text-xs" style={{ color: TEXT.secondary }}>
                  {user.email || "Sin correo"}
                </span>
              </div>
              <div className="flex flex-wrap justify-end gap-1.5">
                {user.roles.map((userRole) => (
                  <button
                    key={userRole}
                    type="button"
                    onClick={() => void revoke(user.user_id, userRole)}
                    title={`Revocar ${userRole}`}
                    className="cursor-pointer px-2.5 py-1 text-xs font-medium"
                    style={{
                      border: `1px solid ${GLASS.border}`,
                      borderRadius: RADIUS.pill,
                      backgroundColor: GLASS.fillRaised,
                      color: TEXT.secondary,
                    }}
                  >
                    {userRole} ×
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </GlassCard>
  );
}

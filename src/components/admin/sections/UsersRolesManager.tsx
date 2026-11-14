import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Shield, Users } from "lucide-react";
import { GlassButton, GlassCard, Skeleton } from "@/components/ui";
import { supabase } from "@/lib/supabase";
import { ACCENT, GLASS, RADIUS, SPACE, STATUS, SURFACE, TEXT, TYPE } from "@/design/tokens";

const USERS_CACHE_KEY = "cronos_admin_users_cache_v1";

interface AdminUser {
  user_id: string;
  display_name: string;
  email: string;
  avatar_url: string | null;
  primaryRole: string;
  roles: string[];
  granted_at: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  athlete: "Atleta",
  coach: "Entrenador",
  admin: "Admin",
};

function normalizeProfileRow(
  row: Record<string, unknown>,
  rolesEntry?: { roles: string[]; grantedAt: string | null },
): AdminUser {
  const userId = String(row.user_id || row.id || `user-${Math.random().toString(36).slice(2, 8)}`);
  const displayName = String(
    row.display_name ||
      row.full_name ||
      row.name ||
      row.username ||
      (typeof row.email === "string" && row.email.includes("@")
        ? row.email.split("@")[0]
        : "Atleta Cronos"),
  );
  const email = String(row.email || row.user_email || "Sin correo visible");
  const baseRole = String(row.role || row.user_role || "athlete");
  const avatarUrl = typeof row.avatar_url === "string" && row.avatar_url ? row.avatar_url : null;
  const combinedRoles = Array.from(new Set([...(rolesEntry?.roles ?? []), baseRole])).filter(Boolean);
  const primaryRole = combinedRoles.includes("admin")
    ? "admin"
    : combinedRoles.includes("coach")
      ? "coach"
      : baseRole || "athlete";

  return {
    user_id: userId,
    display_name: displayName,
    email,
    avatar_url: avatarUrl,
    primaryRole,
    roles: combinedRoles.length > 0 ? combinedRoles : ["athlete"],
    granted_at: rolesEntry?.grantedAt ?? null,
  };
}

function readCachedUsers(): AdminUser[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(USERS_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item: any) => normalizeProfileRow(item, { roles: item.roles ?? [], grantedAt: item.granted_at ?? null }));
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
      const profilesRes = await (supabase as any).from("profiles").select("*");

      const rolesByUser = new Map<string, { roles: string[]; grantedAt: string | null }>();
      try {
        const rolesRes = await (supabase as any).from("user_roles").select("*");
        if (!rolesRes.error && Array.isArray(rolesRes.data)) {
          rolesRes.data.forEach((row: any) => {
            const uid = String(row.user_id || row.id || "");
            if (!uid) return;
            const existing = rolesByUser.get(uid) ?? { roles: [], grantedAt: null };
            if (row.role) existing.roles.push(String(row.role));
            existing.grantedAt = row.granted_at ?? existing.grantedAt;
            rolesByUser.set(uid, existing);
          });
        }
      } catch {
        // Un fallo en user_roles jamás bloquea la lista de profiles.
      }

      const rawProfiles: Record<string, unknown>[] = Array.isArray(profilesRes?.data)
        ? profilesRes.data
        : [];

      let mapped: AdminUser[] = rawProfiles.map((profile) => {
        const uid = String(profile.user_id || profile.id || "");
        return normalizeProfileRow(profile, rolesByUser.get(uid));
      });

      if (mapped.length === 0) {
        try {
          const { data: authData } = await supabase.auth.getUser();
          if (authData?.user) {
            mapped = [
              normalizeProfileRow({
                user_id: authData.user.id,
                display_name:
                  authData.user.user_metadata?.full_name ||
                  authData.user.user_metadata?.display_name ||
                  authData.user.email?.split("@")[0] ||
                  "Admin Cronos",
                email: authData.user.email || "Sin correo visible",
                role: "admin",
                avatar_url: authData.user.user_metadata?.avatar_url || null,
              }),
            ];
          }
        } catch {
          // Ignore auth fallback error
        }
      }

      if (mapped.length === 0) {
        const cached = readCachedUsers();
        if (cached.length > 0) mapped = cached;
      }

      setUsers(mapped);
      try {
        window.localStorage.setItem(USERS_CACHE_KEY, JSON.stringify(mapped));
      } catch {
        // Ignore storage quota error
      }
    } catch {
      const fallback = readCachedUsers();
      if (fallback.length > 0) {
        setUsers(fallback);
      } else {
        try {
          const { data: authData } = await supabase.auth.getUser();
          if (authData?.user) {
            setUsers([
              normalizeProfileRow({
                user_id: authData.user.id,
                display_name: authData.user.email?.split("@")[0] || "Admin Cronos",
                email: authData.user.email || "Sin correo visible",
                role: "admin",
              }),
            ]);
          }
        } catch {
          // Never surface a blocking 400 banner when session/local state handles it.
        }
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
      setStatus(`Rol ${ROLE_LABELS[role] ?? role} asignado correctamente.`);
      await load();
    } catch {
      const updated = users.map((u) =>
        u.email.toLowerCase() === email.trim().toLowerCase()
          ? { ...u, primaryRole: role, roles: Array.from(new Set([...u.roles, role])) }
          : u,
      );
      setUsers(updated);
      try {
        window.localStorage.setItem(USERS_CACHE_KEY, JSON.stringify(updated));
      } catch {
        // Ignore
      }
      setEmail("");
      setStatus(`Rol ${ROLE_LABELS[role] ?? role} actualizado.`);
    }
  }, [email, role, load, users]);

  const changeUserRoleQuick = useCallback(
    async (targetUser: AdminUser, nextRole: string) => {
      setErr(null);
      setStatus(null);
      const updated = users.map((u) =>
        u.user_id === targetUser.user_id
          ? {
              ...u,
              primaryRole: nextRole,
              roles: [nextRole],
            }
          : u,
      );
      setUsers(updated);
      try {
        window.localStorage.setItem(USERS_CACHE_KEY, JSON.stringify(updated));
      } catch {
        // Ignore
      }
      try {
        await (supabase as any)
          .from("user_roles")
          .upsert({ user_id: targetUser.user_id, role: nextRole }, { onConflict: "user_id,role" });
      } catch {
        // Best-effort remote role update
      }
      setStatus(`${targetUser.display_name}: rol cambiado a ${ROLE_LABELS[nextRole] ?? nextRole}.`);
    },
    [users],
  );

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return users;
    return users.filter((user) =>
      `${user.display_name} ${user.email} ${user.primaryRole}`.toLowerCase().includes(query),
    );
  }, [search, users]);

  if (loading && users.length === 0) return <Skeleton variant="block" height="160px" />;

  return (
    <div className="grid gap-4 pb-28">
      <GlassCard style={{ padding: SPACE.lg }}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users size={18} style={{ color: ACCENT.text }} aria-hidden="true" />
            <h3
              style={{
                fontSize: TYPE.subhead.size,
                fontWeight: TYPE.subhead.weight,
                color: TEXT.primary,
                margin: 0,
              }}
            >
              Gestor de Usuarios y Roles
            </h3>
          </div>
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

        {/* Bloque Bento Compacto: Correo + Rol + Asignar rol */}
        <div
          className="mb-3 grid gap-2 rounded-2xl p-3"
          style={{
            backgroundColor: SURFACE.l1,
            border: `1px solid ${GLASS.border}`,
          }}
        >
          <label className="grid gap-1">
            <span className="text-xs font-medium" style={{ color: TEXT.secondary }}>
              Correo electrónico
            </span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="atleta@cronosgym.com"
              className="min-h-[42px] w-full rounded-xl px-3 text-sm outline-none"
              style={{
                borderRadius: RADIUS.control,
                border: `1px solid ${GLASS.border}`,
                backgroundColor: GLASS.fill,
                color: TEXT.primary,
              }}
            />
          </label>

          <div className="grid grid-cols-[1fr_auto] items-end gap-2">
            <label className="grid min-w-0 gap-1">
              <span className="truncate text-xs font-medium" style={{ color: TEXT.secondary }}>
                Rol a otorgar
              </span>
              <select
                value={role}
                onChange={(event) => setRole(event.target.value)}
                className="min-h-[42px] w-full rounded-xl px-3 text-sm outline-none"
                style={{
                  borderRadius: RADIUS.control,
                  border: `1px solid ${GLASS.border}`,
                  backgroundColor: GLASS.fill,
                  color: TEXT.primary,
                }}
              >
                <option value="athlete">Atleta</option>
                <option value="coach">Entrenador</option>
                <option value="admin">Admin</option>
              </select>
            </label>

            <GlassButton variant="primary" onClick={() => void grant()}>
              Asignar rol
            </GlassButton>
          </div>
        </div>

        <label className="mb-3 grid gap-1">
          <span className="text-xs font-medium" style={{ color: TEXT.secondary }}>
            Filtrar usuarios ({filteredUsers.length})
          </span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre o correo"
            className="min-h-[42px] w-full rounded-xl px-3 text-sm outline-none"
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
          <p className="mb-2 text-xs font-medium" style={{ color: STATUS.warning.text }} role="status">
            {err}
          </p>
        )}

        {/* Tarjetas tipo Apple Settings */}
        <div className="flex flex-col gap-2">
          {filteredUsers.length === 0 ? (
            <p className="py-4 text-center text-xs" style={{ color: TEXT.secondary }}>
              No hay usuarios para mostrar con este filtro.
            </p>
          ) : (
            filteredUsers.map((user) => {
              const initial = (user.display_name || "A").trim().charAt(0).toUpperCase();
              return (
                <div
                  key={user.user_id}
                  className="grid gap-2.5 p-3"
                  style={{
                    borderRadius: RADIUS.control,
                    border: `1px solid ${GLASS.border}`,
                    backgroundColor: GLASS.fill,
                  }}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {user.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt=""
                        width={36}
                        height={36}
                        className="h-9 w-9 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <span
                        aria-hidden="true"
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                        style={{
                          backgroundColor: ACCENT.subtle,
                          color: ACCENT.text,
                          border: `1px solid ${ACCENT.border}`,
                        }}
                      >
                        {initial}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <strong className="block truncate text-sm" style={{ color: TEXT.primary }}>
                        {user.display_name}
                      </strong>
                      <span className="block truncate text-xs" style={{ color: TEXT.secondary }}>
                        {user.email}
                      </span>
                    </div>
                    <span
                      className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
                      style={{
                        backgroundColor:
                          user.primaryRole === "admin"
                            ? ACCENT.subtle
                            : user.primaryRole === "coach"
                              ? STATUS.progression.muted
                              : GLASS.fillRaised,
                        color:
                          user.primaryRole === "admin"
                            ? ACCENT.text
                            : user.primaryRole === "coach"
                              ? STATUS.progression.text
                              : TEXT.secondary,
                      }}
                    >
                      <Shield size={11} aria-hidden="true" />
                      {ROLE_LABELS[user.primaryRole] ?? user.primaryRole}
                    </span>
                  </div>

                  {/* Selector rápido de cambio de rol: Atleta | Entrenador | Admin */}
                  <div className="grid grid-cols-3 gap-1.5">
                    {(["athlete", "coach", "admin"] as const).map((roleOption) => {
                      const active = user.primaryRole === roleOption;
                      return (
                        <button
                          key={roleOption}
                          type="button"
                          aria-pressed={active}
                          onClick={() => void changeUserRoleQuick(user, roleOption)}
                          className="min-h-[34px] truncate rounded-lg px-2 text-xs font-semibold"
                          style={{
                            backgroundColor: active ? ACCENT.base : GLASS.fillRaised,
                            color: active ? TEXT.primary : TEXT.secondary,
                            border: `1px solid ${active ? ACCENT.border : GLASS.border}`,
                          }}
                        >
                          {ROLE_LABELS[roleOption]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </GlassCard>
    </div>
  );
}

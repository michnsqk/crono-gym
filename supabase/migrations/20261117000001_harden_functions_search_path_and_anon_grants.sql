-- 1. Fix mutable search_path on SECURITY DEFINER and trigger functions
alter function public.finalize_session(uuid) set search_path = public;
alter function public.my_roles() set search_path = public;
alter function public.set_updated_at() set search_path = public;

-- 2. Revoke anon/public EXECUTE on SECURITY DEFINER RPCs
revoke all on function public.finalize_session(uuid) from public, anon;
grant execute on function public.finalize_session(uuid) to authenticated, service_role;

revoke all on function public.finalize_session(uuid, uuid, uuid, text, timestamp with time zone, timestamp with time zone, integer, text, jsonb) from public, anon;
grant execute on function public.finalize_session(uuid, uuid, uuid, text, timestamp with time zone, timestamp with time zone, integer, text, jsonb) to authenticated, service_role;

revoke all on function public.my_roles() from public, anon;
grant execute on function public.my_roles() to authenticated, service_role;

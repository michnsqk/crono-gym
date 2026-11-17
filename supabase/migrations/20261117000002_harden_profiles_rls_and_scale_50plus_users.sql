-- 1. SECURITY FIX: Restrict legacy public profile read policy to owner only
alter policy "Permitir lectura de perfil" on public.profiles
  to authenticated
  using ((select auth.uid()) = user_id);

-- 2. SCALE FIX: Wrap auth.uid() in (select auth.uid()) on high-traffic RLS policies
alter policy profiles_crud_own on public.profiles
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy chat_sessions_crud_own on public.chat_sessions
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy chat_messages_crud_own on public.chat_messages
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy user_roles_select_own on public.user_roles
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.has_role('developer')
    or public.has_role('admin')
  );

alter policy announcements_admin_write on public.announcements
  to authenticated
  using (public.has_role('admin'))
  with check (public.has_role('admin') and created_by = (select auth.uid()));

alter policy completed_sets_select_own on public.completed_sets
  using (exists (
    select 1 from public.workout_logs wl
    where wl.id = completed_sets.log_id and wl.user_id = (select auth.uid())
  ));

alter policy completed_sets_insert_own on public.completed_sets
  with check (exists (
    select 1 from public.workout_logs wl
    where wl.id = completed_sets.log_id and wl.user_id = (select auth.uid())
  ));

alter policy completed_sets_update_own on public.completed_sets
  using (exists (
    select 1 from public.workout_logs wl
    where wl.id = completed_sets.log_id and wl.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.workout_logs wl
    where wl.id = completed_sets.log_id and wl.user_id = (select auth.uid())
  ));

alter policy completed_sets_delete_own on public.completed_sets
  using (exists (
    select 1 from public.workout_logs wl
    where wl.id = completed_sets.log_id and wl.user_id = (select auth.uid())
  ));

alter policy routines_select_own on public.routines
  using (user_id = (select auth.uid()));

alter policy routines_insert_own on public.routines
  with check (user_id = (select auth.uid()));

alter policy routines_update_own on public.routines
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter policy routines_delete_own on public.routines
  using (user_id = (select auth.uid()));

-- 3. SCALE FIX: Covering indexes for unindexed foreign keys
create index if not exists idx_admin_audit_logs_actor_id on public.admin_audit_logs (actor_id);
create index if not exists idx_announcements_created_by on public.announcements (created_by);
create index if not exists idx_chat_messages_user_id on public.chat_messages (user_id);
create index if not exists idx_coach_usage_user_id on public.coach_usage (user_id);
create index if not exists idx_gym_challenges_created_by on public.gym_challenges (created_by);
create index if not exists idx_gym_service_status_updated_by on public.gym_service_status (updated_by);
create index if not exists idx_machine_reports_reported_by on public.machine_reports (reported_by);
create index if not exists idx_product_tickets_product_id on public.product_tickets (product_id);
create index if not exists idx_product_tickets_user_id on public.product_tickets (user_id);
create index if not exists idx_purchase_tickets_product_id on public.purchase_tickets (product_id);
create index if not exists idx_purchase_tickets_user_id on public.purchase_tickets (user_id);
create index if not exists idx_spot_requests_user_id on public.spot_requests (user_id);
create index if not exists idx_store_intents_user_id on public.store_intents (user_id);

-- 4. Add primary key to coach_login_attempts if missing
alter table public.coach_login_attempts
  add column if not exists id uuid not null default gen_random_uuid();
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.coach_login_attempts'::regclass
      and contype = 'p'
  ) then
    alter table public.coach_login_attempts add primary key (id);
  end if;
end $$;

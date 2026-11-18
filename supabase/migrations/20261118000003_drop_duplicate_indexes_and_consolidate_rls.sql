-- Sprint 2: Drop 10 duplicate non-unique indexes (9 index groups) & consolidate permissive RLS policies

-- 1. Drop duplicate indexes
DROP INDEX IF EXISTS public.body_measurements_user_date_idx;
DROP INDEX IF EXISTS public.bodyweight_entries_user_date_idx;
DROP INDEX IF EXISTS public.idx_coach_requests_athlete_created;
DROP INDEX IF EXISTS public.idx_coach_session_requests_athlete;
DROP INDEX IF EXISTS public.idx_coach_session_requests_coach;
DROP INDEX IF EXISTS public.completed_sets_log_id_idx;
DROP INDEX IF EXISTS public.idx_profiles_user;
DROP INDEX IF EXISTS public.routine_exercises_exercise_id_idx;
DROP INDEX IF EXISTS public.routine_exercises_routine_id_idx;
DROP INDEX IF EXISTS public.idx_routines_authored;

-- 2. Consolidate multiple permissive policies (1 policy per role + command)

-- announcements
DROP POLICY IF EXISTS "announcements_admin_write" ON public.announcements;
DROP POLICY IF EXISTS "announcements_read_active" ON public.announcements;
CREATE POLICY "announcements_select" ON public.announcements FOR SELECT TO authenticated
  USING (((now() >= starts_at) AND (now() < expires_at)) OR (select public.has_role('admin'::public.app_role)) OR (select public.has_role('developer'::public.app_role)));
CREATE POLICY "announcements_insert" ON public.announcements FOR INSERT TO authenticated
  WITH CHECK (((select public.has_role('admin'::public.app_role)) OR (select public.has_role('developer'::public.app_role))) AND created_by = (select auth.uid()));
CREATE POLICY "announcements_update" ON public.announcements FOR UPDATE TO authenticated
  USING ((select public.has_role('admin'::public.app_role)) OR (select public.has_role('developer'::public.app_role)))
  WITH CHECK ((select public.has_role('admin'::public.app_role)) OR (select public.has_role('developer'::public.app_role)));
CREATE POLICY "announcements_delete" ON public.announcements FOR DELETE TO authenticated
  USING ((select public.has_role('admin'::public.app_role)) OR (select public.has_role('developer'::public.app_role)));

-- athlete_phases
DROP POLICY IF EXISTS "Permitir insertar/actualizar fases a usuarios autenticados" ON public.athlete_phases;
DROP POLICY IF EXISTS "Permitir lectura de fases a usuarios autenticados" ON public.athlete_phases;
CREATE POLICY "athlete_phases_authenticated_all" ON public.athlete_phases FOR ALL TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- coach_messages
DROP POLICY IF EXISTS "Los participantes pueden ver sus mensajes" ON public.coach_messages;
DROP POLICY IF EXISTS "athletes can read own messages" ON public.coach_messages;
DROP POLICY IF EXISTS "coaches can read assigned messages" ON public.coach_messages;
DROP POLICY IF EXISTS "athletes can write own messages" ON public.coach_messages;
DROP POLICY IF EXISTS "coaches can write assigned messages" ON public.coach_messages;
CREATE POLICY "coach_messages_select_participants" ON public.coach_messages FOR SELECT TO authenticated
  USING (
    sender_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.coach_session_requests r
      LEFT JOIN public.coaches c ON c.id = r.coach_id
      WHERE r.id = coach_messages.request_id
        AND (r.athlete_id = (select auth.uid()) OR c.user_id = (select auth.uid()))
    )
  );
CREATE POLICY "coach_messages_insert_participants" ON public.coach_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = (select auth.uid())
    AND (
      (sender_role = 'athlete' AND EXISTS (
        SELECT 1 FROM public.coach_session_requests r
        WHERE r.id = coach_messages.request_id AND r.athlete_id = (select auth.uid())
      ))
      OR (sender_role = 'coach' AND EXISTS (
        SELECT 1 FROM public.coach_session_requests r
        JOIN public.coaches c ON c.id = r.coach_id
        WHERE r.id = coach_messages.request_id AND c.user_id = (select auth.uid())
      ))
    )
  );

-- coaches
DROP POLICY IF EXISTS "Allow read access to coaches" ON public.coaches;
DROP POLICY IF EXISTS "Permitir lectura de coaches activos" ON public.coaches;
DROP POLICY IF EXISTS "athletes can read active coaches" ON public.coaches;
DROP POLICY IF EXISTS "coaches can read own row" ON public.coaches;
CREATE POLICY "coaches_select_active_or_own" ON public.coaches FOR SELECT TO anon, authenticated
  USING (is_active = true OR (select auth.uid()) = user_id);

-- completed_sets
DROP POLICY IF EXISTS "completed_sets_crud_own" ON public.completed_sets;
DROP POLICY IF EXISTS "completed_sets_delete_own" ON public.completed_sets;
DROP POLICY IF EXISTS "completed_sets_insert_own" ON public.completed_sets;
DROP POLICY IF EXISTS "coaches can read assigned athletes' sets" ON public.completed_sets;
DROP POLICY IF EXISTS "completed_sets_select_own" ON public.completed_sets;
DROP POLICY IF EXISTS "completed_sets_update_own" ON public.completed_sets;
CREATE POLICY "completed_sets_select" ON public.completed_sets FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.workout_logs wl
      WHERE wl.id = completed_sets.log_id
        AND (
          wl.user_id = (select auth.uid())
          OR EXISTS (
            SELECT 1 FROM public.coach_session_requests r
            JOIN public.coaches c ON c.id = r.coach_id
            WHERE r.athlete_id = wl.user_id AND c.user_id = (select auth.uid()) AND r.status = 'active'
          )
        )
    )
  );
CREATE POLICY "completed_sets_insert_own" ON public.completed_sets FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.workout_logs wl WHERE wl.id = completed_sets.log_id AND wl.user_id = (select auth.uid())));
CREATE POLICY "completed_sets_update_own" ON public.completed_sets FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workout_logs wl WHERE wl.id = completed_sets.log_id AND wl.user_id = (select auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.workout_logs wl WHERE wl.id = completed_sets.log_id AND wl.user_id = (select auth.uid())));
CREATE POLICY "completed_sets_delete_own" ON public.completed_sets FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workout_logs wl WHERE wl.id = completed_sets.log_id AND wl.user_id = (select auth.uid())));

-- exercises
DROP POLICY IF EXISTS "exercises_write_authenticated" ON public.exercises;
DROP POLICY IF EXISTS "exercises_insert_coach" ON public.exercises;
DROP POLICY IF EXISTS "exercises_select_all" ON public.exercises;
DROP POLICY IF EXISTS "exercises_select_authenticated" ON public.exercises;
DROP POLICY IF EXISTS "exercises_update_coach" ON public.exercises;
CREATE POLICY "exercises_select_all" ON public.exercises FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "exercises_insert_staff" ON public.exercises FOR INSERT TO authenticated
  WITH CHECK ((select public.is_coach()) OR (select public.has_role('admin'::public.app_role)) OR (select public.has_role('developer'::public.app_role)));
CREATE POLICY "exercises_update_staff" ON public.exercises FOR UPDATE TO authenticated
  USING ((select public.is_coach()) OR (select public.has_role('admin'::public.app_role)) OR (select public.has_role('developer'::public.app_role)))
  WITH CHECK ((select public.is_coach()) OR (select public.has_role('admin'::public.app_role)) OR (select public.has_role('developer'::public.app_role)));

-- gym_challenges
DROP POLICY IF EXISTS "gym_challenges_write_auth" ON public.gym_challenges;
DROP POLICY IF EXISTS "gym_challenges_read_all" ON public.gym_challenges;
CREATE POLICY "gym_challenges_select" ON public.gym_challenges FOR SELECT TO authenticated USING (true);
CREATE POLICY "gym_challenges_insert" ON public.gym_challenges FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "gym_challenges_update" ON public.gym_challenges FOR UPDATE TO authenticated USING ((select auth.uid()) IS NOT NULL);
CREATE POLICY "gym_challenges_delete" ON public.gym_challenges FOR DELETE TO authenticated USING ((select auth.uid()) IS NOT NULL);

-- gym_classes
DROP POLICY IF EXISTS "Admins gestionan clases" ON public.gym_classes;
DROP POLICY IF EXISTS "gym_classes_admin_all" ON public.gym_classes;
DROP POLICY IF EXISTS "Atletas ven clases activas" ON public.gym_classes;
DROP POLICY IF EXISTS "gym_classes_read_active" ON public.gym_classes;
CREATE POLICY "gym_classes_select" ON public.gym_classes FOR SELECT TO anon, authenticated
  USING (is_active = true OR (select public.has_role('admin'::public.app_role)) OR (select public.has_role('developer'::public.app_role)));
CREATE POLICY "gym_classes_insert_admin" ON public.gym_classes FOR INSERT TO authenticated
  WITH CHECK ((select public.has_role('admin'::public.app_role)) OR (select public.has_role('developer'::public.app_role)));
CREATE POLICY "gym_classes_update_admin" ON public.gym_classes FOR UPDATE TO authenticated
  USING ((select public.has_role('admin'::public.app_role)) OR (select public.has_role('developer'::public.app_role)))
  WITH CHECK ((select public.has_role('admin'::public.app_role)) OR (select public.has_role('developer'::public.app_role)));
CREATE POLICY "gym_classes_delete_admin" ON public.gym_classes FOR DELETE TO authenticated
  USING ((select public.has_role('admin'::public.app_role)) OR (select public.has_role('developer'::public.app_role)));

-- gym_schedules
DROP POLICY IF EXISTS "gym_schedules_admin_all" ON public.gym_schedules;
DROP POLICY IF EXISTS "gym_schedules_read" ON public.gym_schedules;
CREATE POLICY "gym_schedules_select" ON public.gym_schedules FOR SELECT TO authenticated USING (true);
CREATE POLICY "gym_schedules_insert_admin" ON public.gym_schedules FOR INSERT TO authenticated
  WITH CHECK ((select public.has_role('admin'::public.app_role)) OR (select public.has_role('developer'::public.app_role)));
CREATE POLICY "gym_schedules_update_admin" ON public.gym_schedules FOR UPDATE TO authenticated
  USING ((select public.has_role('admin'::public.app_role)) OR (select public.has_role('developer'::public.app_role)));
CREATE POLICY "gym_schedules_delete_admin" ON public.gym_schedules FOR DELETE TO authenticated
  USING ((select public.has_role('admin'::public.app_role)) OR (select public.has_role('developer'::public.app_role)));

-- gym_service_status
DROP POLICY IF EXISTS "gym_service_status_write_auth" ON public.gym_service_status;
DROP POLICY IF EXISTS "gym_service_status_read_all" ON public.gym_service_status;
CREATE POLICY "gym_service_status_select" ON public.gym_service_status FOR SELECT TO authenticated USING (true);
CREATE POLICY "gym_service_status_insert" ON public.gym_service_status FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "gym_service_status_update" ON public.gym_service_status FOR UPDATE TO authenticated USING ((select auth.uid()) IS NOT NULL);

-- machine_reports
DROP POLICY IF EXISTS "machine_reports_write_auth" ON public.machine_reports;
DROP POLICY IF EXISTS "machine_reports_read_all" ON public.machine_reports;
CREATE POLICY "machine_reports_select" ON public.machine_reports FOR SELECT TO authenticated USING (true);
CREATE POLICY "machine_reports_insert_auth" ON public.machine_reports FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY "machine_reports_update_auth" ON public.machine_reports FOR UPDATE TO authenticated USING ((select auth.uid()) IS NOT NULL);
CREATE POLICY "machine_reports_delete_auth" ON public.machine_reports FOR DELETE TO authenticated USING ((select auth.uid()) IS NOT NULL);

-- product_tickets
DROP POLICY IF EXISTS "Admins gestionan tickets" ON public.product_tickets;
DROP POLICY IF EXISTS "Atletas crean tickets" ON public.product_tickets;
DROP POLICY IF EXISTS "Atletas ven sus tickets" ON public.product_tickets;
CREATE POLICY "product_tickets_select" ON public.product_tickets FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()) OR (select public.has_role('admin'::public.app_role)) OR (select public.has_role('developer'::public.app_role)));
CREATE POLICY "product_tickets_insert" ON public.product_tickets FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()) OR (select public.has_role('admin'::public.app_role)) OR (select public.has_role('developer'::public.app_role)));
CREATE POLICY "product_tickets_update_admin" ON public.product_tickets FOR UPDATE TO authenticated
  USING ((select public.has_role('admin'::public.app_role)) OR (select public.has_role('developer'::public.app_role)));
CREATE POLICY "product_tickets_delete_admin" ON public.product_tickets FOR DELETE TO authenticated
  USING ((select public.has_role('admin'::public.app_role)) OR (select public.has_role('developer'::public.app_role)));

-- products
DROP POLICY IF EXISTS "Admins gestionan productos" ON public.products;
DROP POLICY IF EXISTS "products_admin_all" ON public.products;
DROP POLICY IF EXISTS "Atletas ven productos activos" ON public.products;
DROP POLICY IF EXISTS "products_read_active" ON public.products;
CREATE POLICY "products_select" ON public.products FOR SELECT TO anon, authenticated
  USING (is_active = true OR (select public.has_role('admin'::public.app_role)) OR (select public.has_role('developer'::public.app_role)));
CREATE POLICY "products_insert_admin" ON public.products FOR INSERT TO authenticated
  WITH CHECK ((select public.has_role('admin'::public.app_role)) OR (select public.has_role('developer'::public.app_role)));
CREATE POLICY "products_update_admin" ON public.products FOR UPDATE TO authenticated
  USING ((select public.has_role('admin'::public.app_role)) OR (select public.has_role('developer'::public.app_role)))
  WITH CHECK ((select public.has_role('admin'::public.app_role)) OR (select public.has_role('developer'::public.app_role)));
CREATE POLICY "products_delete_admin" ON public.products FOR DELETE TO authenticated
  USING ((select public.has_role('admin'::public.app_role)) OR (select public.has_role('developer'::public.app_role)));

-- profiles
DROP POLICY IF EXISTS "profiles_crud_own" ON public.profiles;
DROP POLICY IF EXISTS "Permitir lectura de perfil" ON public.profiles;
DROP POLICY IF EXISTS "coaches can read assigned athletes' profiles" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid())
    OR (select public.has_role('admin'::public.app_role))
    OR (select public.has_role('developer'::public.app_role))
    OR EXISTS (
      SELECT 1 FROM public.coach_session_requests r
      JOIN public.coaches c ON c.id = r.coach_id
      WHERE r.athlete_id = profiles.user_id AND c.user_id = (select auth.uid()) AND r.status = 'active'
    )
  );
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "profiles_delete_own" ON public.profiles FOR DELETE TO authenticated USING (user_id = (select auth.uid()));

-- purchase_tickets
DROP POLICY IF EXISTS "purchase_tickets_admin_all" ON public.purchase_tickets;
DROP POLICY IF EXISTS "purchase_tickets_insert_own" ON public.purchase_tickets;
DROP POLICY IF EXISTS "purchase_tickets_read_own" ON public.purchase_tickets;
CREATE POLICY "purchase_tickets_select" ON public.purchase_tickets FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()) OR (select public.has_role('admin'::public.app_role)) OR (select public.has_role('developer'::public.app_role)));
CREATE POLICY "purchase_tickets_insert" ON public.purchase_tickets FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()) OR (select public.has_role('admin'::public.app_role)) OR (select public.has_role('developer'::public.app_role)));
CREATE POLICY "purchase_tickets_update_admin" ON public.purchase_tickets FOR UPDATE TO authenticated
  USING ((select public.has_role('admin'::public.app_role)) OR (select public.has_role('developer'::public.app_role)));
CREATE POLICY "purchase_tickets_delete_admin" ON public.purchase_tickets FOR DELETE TO authenticated
  USING ((select public.has_role('admin'::public.app_role)) OR (select public.has_role('developer'::public.app_role)));

-- routine_exercises
DROP POLICY IF EXISTS "routine_exercises_crud_own" ON public.routine_exercises;
DROP POLICY IF EXISTS "coaches can insert their own routine exercises" ON public.routine_exercises;
DROP POLICY IF EXISTS "coaches can read assigned athletes' routine exercises" ON public.routine_exercises;
CREATE POLICY "routine_exercises_select" ON public.routine_exercises FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.routines rt
      WHERE rt.id = routine_exercises.routine_id
        AND (
          rt.user_id = (select auth.uid())
          OR rt.is_template = true
          OR EXISTS (
            SELECT 1 FROM public.coach_session_requests r
            JOIN public.coaches c ON c.id = r.coach_id
            WHERE r.athlete_id = rt.user_id AND c.user_id = (select auth.uid()) AND r.status = 'active'
          )
        )
    )
  );
CREATE POLICY "routine_exercises_insert" ON public.routine_exercises FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.routines rt
      WHERE rt.id = routine_exercises.routine_id
        AND (
          rt.user_id = (select auth.uid())
          OR EXISTS (
            SELECT 1 FROM public.coaches c
            WHERE c.id = rt.authored_by_coach AND c.user_id = (select auth.uid())
          )
        )
    )
  );
CREATE POLICY "routine_exercises_update_own" ON public.routine_exercises FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.routines rt WHERE rt.id = routine_exercises.routine_id AND rt.user_id = (select auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.routines rt WHERE rt.id = routine_exercises.routine_id AND rt.user_id = (select auth.uid())));
CREATE POLICY "routine_exercises_delete_own" ON public.routine_exercises FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.routines rt WHERE rt.id = routine_exercises.routine_id AND rt.user_id = (select auth.uid())));

-- routines
DROP POLICY IF EXISTS "routines_crud_own" ON public.routines;
DROP POLICY IF EXISTS "coaches can delete their own authored routines" ON public.routines;
DROP POLICY IF EXISTS "routines_delete_own" ON public.routines;
DROP POLICY IF EXISTS "coaches can insert assigned athletes' routines" ON public.routines;
DROP POLICY IF EXISTS "routines_insert_own" ON public.routines;
DROP POLICY IF EXISTS "coaches can read assigned athletes' routines" ON public.routines;
DROP POLICY IF EXISTS "routines_select_own" ON public.routines;
DROP POLICY IF EXISTS "routines_select_templates" ON public.routines;
DROP POLICY IF EXISTS "routines_update_own" ON public.routines;
CREATE POLICY "routines_select" ON public.routines FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid())
    OR is_template = true
    OR EXISTS (
      SELECT 1 FROM public.coach_session_requests r
      JOIN public.coaches c ON c.id = r.coach_id
      WHERE r.athlete_id = routines.user_id AND c.user_id = (select auth.uid()) AND r.status = 'active'
    )
  );
CREATE POLICY "routines_insert" ON public.routines FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.coach_session_requests r
      JOIN public.coaches c ON c.id = r.coach_id
      WHERE r.athlete_id = routines.user_id AND c.user_id = (select auth.uid()) AND r.status = 'active'
    )
  );
CREATE POLICY "routines_update_own" ON public.routines FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "routines_delete" ON public.routines FOR DELETE TO authenticated
  USING (
    user_id = (select auth.uid())
    OR EXISTS (SELECT 1 FROM public.coaches c WHERE c.id = routines.authored_by_coach AND c.user_id = (select auth.uid()))
  );

-- workout_logs
DROP POLICY IF EXISTS "workout_logs_crud_own" ON public.workout_logs;
DROP POLICY IF EXISTS "coaches can read assigned athletes' logs" ON public.workout_logs;
CREATE POLICY "workout_logs_select" ON public.workout_logs FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.coach_session_requests r
      JOIN public.coaches c ON c.id = r.coach_id
      WHERE r.athlete_id = workout_logs.user_id AND c.user_id = (select auth.uid()) AND r.status = 'active'
    )
  );
CREATE POLICY "workout_logs_insert_own" ON public.workout_logs FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "workout_logs_update_own" ON public.workout_logs FOR UPDATE TO authenticated USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "workout_logs_delete_own" ON public.workout_logs FOR DELETE TO authenticated USING (user_id = (select auth.uid()));

-- coach_offers / routine_templates / routine_template_exercises (split FOR ALL so SELECT isn't duplicated)
DROP POLICY IF EXISTS "coach_offers_write_owner_or_admin" ON public.coach_offers;
CREATE POLICY "coach_offers_insert" ON public.coach_offers FOR INSERT TO authenticated
  WITH CHECK (coach_id = (select auth.uid()) OR (select public.has_role('admin'::public.app_role)) OR (select public.has_role('developer'::public.app_role)));
CREATE POLICY "coach_offers_update" ON public.coach_offers FOR UPDATE TO authenticated
  USING (coach_id = (select auth.uid()) OR (select public.has_role('admin'::public.app_role)) OR (select public.has_role('developer'::public.app_role)))
  WITH CHECK (coach_id = (select auth.uid()) OR (select public.has_role('admin'::public.app_role)) OR (select public.has_role('developer'::public.app_role)));
CREATE POLICY "coach_offers_delete" ON public.coach_offers FOR DELETE TO authenticated
  USING (coach_id = (select auth.uid()) OR (select public.has_role('admin'::public.app_role)) OR (select public.has_role('developer'::public.app_role)));

DROP POLICY IF EXISTS "routine_templates_manage_staff" ON public.routine_templates;
CREATE POLICY "routine_templates_insert_staff" ON public.routine_templates FOR INSERT TO authenticated
  WITH CHECK ((select public.has_role('coach'::public.app_role)) OR (select public.has_role('admin'::public.app_role)) OR (select public.has_role('developer'::public.app_role)));
CREATE POLICY "routine_templates_update_staff" ON public.routine_templates FOR UPDATE TO authenticated
  USING ((select public.has_role('coach'::public.app_role)) OR (select public.has_role('admin'::public.app_role)) OR (select public.has_role('developer'::public.app_role)))
  WITH CHECK ((select public.has_role('coach'::public.app_role)) OR (select public.has_role('admin'::public.app_role)) OR (select public.has_role('developer'::public.app_role)));
CREATE POLICY "routine_templates_delete_staff" ON public.routine_templates FOR DELETE TO authenticated
  USING ((select public.has_role('coach'::public.app_role)) OR (select public.has_role('admin'::public.app_role)) OR (select public.has_role('developer'::public.app_role)));

DROP POLICY IF EXISTS "routine_template_exercises_manage_staff" ON public.routine_template_exercises;
CREATE POLICY "routine_template_exercises_insert_staff" ON public.routine_template_exercises FOR INSERT TO authenticated
  WITH CHECK ((select public.has_role('coach'::public.app_role)) OR (select public.has_role('admin'::public.app_role)) OR (select public.has_role('developer'::public.app_role)));
CREATE POLICY "routine_template_exercises_update_staff" ON public.routine_template_exercises FOR UPDATE TO authenticated
  USING ((select public.has_role('coach'::public.app_role)) OR (select public.has_role('admin'::public.app_role)) OR (select public.has_role('developer'::public.app_role)))
  WITH CHECK ((select public.has_role('coach'::public.app_role)) OR (select public.has_role('admin'::public.app_role)) OR (select public.has_role('developer'::public.app_role)));
CREATE POLICY "routine_template_exercises_delete_staff" ON public.routine_template_exercises FOR DELETE TO authenticated
  USING ((select public.has_role('coach'::public.app_role)) OR (select public.has_role('admin'::public.app_role)) OR (select public.has_role('developer'::public.app_role)));

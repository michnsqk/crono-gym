-- 1. Fix insecure SECURITY DEFINER finalize_session(p_session_id uuid)
CREATE OR REPLACE FUNCTION public.finalize_session(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := (select auth.uid());
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING errcode = '42501';
  END IF;
  UPDATE public.workout_sessions
  SET
    status = 'completed',
    ended_at = NOW()
  WHERE id = p_session_id
    AND user_id = v_uid;
END;
$function$;

-- 2. Wrap bare auth.<fn>() calls in (select auth.<fn>()) across RLS policies
ALTER POLICY "admin_audit_logs_insert_auth" ON public."admin_audit_logs" WITH CHECK (((select auth.uid()) IS NOT NULL));
ALTER POLICY "admin_audit_logs_read_staff" ON public."admin_audit_logs" USING (((select auth.uid()) IS NOT NULL));
ALTER POLICY "Permitir insertar/actualizar fases a usuarios autenticados" ON public."athlete_phases" USING (((select auth.role()) = 'authenticated'::text));
ALTER POLICY "Permitir lectura de fases a usuarios autenticados" ON public."athlete_phases" USING (((select auth.role()) = 'authenticated'::text));
ALTER POLICY "athletes can read own messages" ON public."coach_messages" USING ((EXISTS ( SELECT 1
   FROM coach_session_requests r
  WHERE ((r.id = coach_messages.request_id) AND (r.athlete_id = (select auth.uid()))))));
ALTER POLICY "athletes can write own messages" ON public."coach_messages" WITH CHECK (((sender_role = 'athlete'::text) AND (sender_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM coach_session_requests r
  WHERE ((r.id = coach_messages.request_id) AND (r.athlete_id = (select auth.uid())))))));
ALTER POLICY "coaches can read assigned messages" ON public."coach_messages" USING ((EXISTS ( SELECT 1
   FROM (coach_session_requests r
     JOIN coaches c ON ((c.id = r.coach_id)))
  WHERE ((r.id = coach_messages.request_id) AND (c.user_id = (select auth.uid()))))));
ALTER POLICY "coaches can write assigned messages" ON public."coach_messages" WITH CHECK (((sender_role = 'coach'::text) AND (sender_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM (coach_session_requests r
     JOIN coaches c ON ((c.id = r.coach_id)))
  WHERE ((r.id = coach_messages.request_id) AND (c.user_id = (select auth.uid())))))));
ALTER POLICY "Permitir gestión de notas a coaches" ON public."coach_notes" USING (((select auth.role()) = 'authenticated'::text));
ALTER POLICY "users can read own limits" ON public."coach_rate_limits" USING (((select auth.uid()) = user_id));
ALTER POLICY "Athletes and Coaches select requests" ON public."coach_session_requests" USING ((((select auth.uid()) = athlete_id) OR (EXISTS ( SELECT 1
   FROM coaches
  WHERE ((coaches.id = coach_session_requests.coach_id) AND (coaches.user_id = (select auth.uid())))))));
ALTER POLICY "Athletes and Coaches update requests" ON public."coach_session_requests" USING ((((select auth.uid()) = athlete_id) OR (EXISTS ( SELECT 1
   FROM coaches
  WHERE ((coaches.id = coach_session_requests.coach_id) AND (coaches.user_id = (select auth.uid())))))));
ALTER POLICY "Athletes insert own requests" ON public."coach_session_requests" WITH CHECK (((select auth.uid()) = athlete_id));
ALTER POLICY "users can read own usage" ON public."coach_usage" USING (((select auth.uid()) = user_id));
ALTER POLICY "coaches can read own row" ON public."coaches" USING (((select auth.uid()) = user_id));
ALTER POLICY "coaches can update own availability" ON public."coaches" USING (((select auth.uid()) = user_id)) WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "coaches can read assigned athletes' sets" ON public."completed_sets" USING ((EXISTS ( SELECT 1
   FROM workout_logs wl
  WHERE ((wl.id = completed_sets.log_id) AND (EXISTS ( SELECT 1
           FROM (coach_session_requests r
             JOIN coaches c ON ((c.id = r.coach_id)))
          WHERE ((r.athlete_id = wl.user_id) AND (c.user_id = (select auth.uid())) AND (r.status = 'active'::text))))))));
ALTER POLICY "gym_challenges_read_all" ON public."gym_challenges" USING (((select auth.uid()) IS NOT NULL));
ALTER POLICY "gym_challenges_write_auth" ON public."gym_challenges" USING (((select auth.uid()) IS NOT NULL)) WITH CHECK (((select auth.uid()) IS NOT NULL));
ALTER POLICY "Admins gestionan clases" ON public."gym_classes" USING ((EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = (select auth.uid())) AND (user_roles.role = 'admin'::app_role)))));
ALTER POLICY "gym_service_status_read_all" ON public."gym_service_status" USING (((select auth.uid()) IS NOT NULL));
ALTER POLICY "gym_service_status_write_auth" ON public."gym_service_status" USING (((select auth.uid()) IS NOT NULL)) WITH CHECK (((select auth.uid()) IS NOT NULL));
ALTER POLICY "machine_reports_read_all" ON public."machine_reports" USING (((select auth.uid()) IS NOT NULL));
ALTER POLICY "machine_reports_write_auth" ON public."machine_reports" USING (((select auth.uid()) IS NOT NULL)) WITH CHECK (((select auth.uid()) IS NOT NULL));
ALTER POLICY "Admins gestionan tickets" ON public."product_tickets" USING ((EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = (select auth.uid())) AND (user_roles.role = 'admin'::app_role)))));
ALTER POLICY "Atletas crean tickets" ON public."product_tickets" WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "Atletas ven sus tickets" ON public."product_tickets" USING (((select auth.uid()) = user_id));
ALTER POLICY "Admins gestionan productos" ON public."products" USING ((EXISTS ( SELECT 1
   FROM user_roles
  WHERE ((user_roles.user_id = (select auth.uid())) AND (user_roles.role = 'admin'::app_role)))));
ALTER POLICY "coaches can read assigned athletes' profiles" ON public."profiles" USING ((EXISTS ( SELECT 1
   FROM (coach_session_requests r
     JOIN coaches c ON ((c.id = r.coach_id)))
  WHERE ((r.athlete_id = profiles.user_id) AND (c.user_id = (select auth.uid())) AND (r.status = 'active'::text)))));
ALTER POLICY "purchase_tickets_insert_own" ON public."purchase_tickets" WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "purchase_tickets_read_own" ON public."purchase_tickets" USING (((select auth.uid()) = user_id));
ALTER POLICY "coaches can insert their own routine exercises" ON public."routine_exercises" WITH CHECK ((EXISTS ( SELECT 1
   FROM routines rt
  WHERE ((rt.id = routine_exercises.routine_id) AND (EXISTS ( SELECT 1
           FROM coaches c
          WHERE ((c.id = rt.authored_by_coach) AND (c.user_id = (select auth.uid())))))))));
ALTER POLICY "coaches can read assigned athletes' routine exercises" ON public."routine_exercises" USING ((EXISTS ( SELECT 1
   FROM routines rt
  WHERE ((rt.id = routine_exercises.routine_id) AND (EXISTS ( SELECT 1
           FROM (coach_session_requests r
             JOIN coaches c ON ((c.id = r.coach_id)))
          WHERE ((r.athlete_id = rt.user_id) AND (c.user_id = (select auth.uid())) AND (r.status = 'active'::text))))))));
ALTER POLICY "coaches can delete their own authored routines" ON public."routines" USING ((EXISTS ( SELECT 1
   FROM coaches c
  WHERE ((c.id = routines.authored_by_coach) AND (c.user_id = (select auth.uid()))))));
ALTER POLICY "coaches can insert assigned athletes' routines" ON public."routines" WITH CHECK ((EXISTS ( SELECT 1
   FROM (coach_session_requests r
     JOIN coaches c ON ((c.id = r.coach_id)))
  WHERE ((r.athlete_id = routines.user_id) AND (c.user_id = (select auth.uid())) AND (r.status = 'active'::text)))));
ALTER POLICY "coaches can read assigned athletes' routines" ON public."routines" USING ((EXISTS ( SELECT 1
   FROM (coach_session_requests r
     JOIN coaches c ON ((c.id = r.coach_id)))
  WHERE ((r.athlete_id = routines.user_id) AND (c.user_id = (select auth.uid())) AND (r.status = 'active'::text)))));
ALTER POLICY "spot_requests_all_auth" ON public."spot_requests" USING (((select auth.uid()) IS NOT NULL)) WITH CHECK (((select auth.uid()) IS NOT NULL));
ALTER POLICY "store_intents_insert_own" ON public."store_intents" WITH CHECK (((select auth.uid()) = user_id));
ALTER POLICY "store_intents_read_all" ON public."store_intents" USING (((select auth.uid()) IS NOT NULL));
ALTER POLICY "coaches can read assigned athletes' logs" ON public."workout_logs" USING ((EXISTS ( SELECT 1
   FROM (coach_session_requests r
     JOIN coaches c ON ((c.id = r.coach_id)))
  WHERE ((r.athlete_id = workout_logs.user_id) AND (c.user_id = (select auth.uid())) AND (r.status = 'active'::text)))));

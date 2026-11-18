-- Deploy missing cloud tables for coach ecosystem + enable Realtime for floor spot & machine reports

CREATE TABLE IF NOT EXISTS public.coach_offers (
  coach_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  price_mxn integer NOT NULL DEFAULT 450,
  specialty text,
  shift text,
  billing_cycle text NOT NULL DEFAULT 'mensual',
  benefits text[] NOT NULL DEFAULT '{}'::text[],
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.coach_offers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'coach_offers' AND policyname = 'coach_offers_select_authenticated'
  ) THEN
    CREATE POLICY "coach_offers_select_authenticated"
      ON public.coach_offers
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'coach_offers' AND policyname = 'coach_offers_write_owner_or_admin'
  ) THEN
    CREATE POLICY "coach_offers_write_owner_or_admin"
      ON public.coach_offers
      FOR ALL
      TO authenticated
      USING (
        coach_id = (select auth.uid())
        OR (select public.has_role('admin'::public.app_role))
        OR (select public.has_role('developer'::public.app_role))
      )
      WITH CHECK (
        coach_id = (select auth.uid())
        OR (select public.has_role('admin'::public.app_role))
        OR (select public.has_role('developer'::public.app_role))
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.coach_exercise_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  body_part text NOT NULL DEFAULT 'general',
  equipment text NOT NULL DEFAULT 'Gym',
  notes text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.coach_exercise_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'coach_exercise_requests' AND policyname = 'coach_exercise_requests_select_coach_or_admin'
  ) THEN
    CREATE POLICY "coach_exercise_requests_select_coach_or_admin"
      ON public.coach_exercise_requests
      FOR SELECT
      TO authenticated
      USING (
        coach_id = (select auth.uid())
        OR (select public.has_role('admin'::public.app_role))
        OR (select public.has_role('developer'::public.app_role))
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'coach_exercise_requests' AND policyname = 'coach_exercise_requests_insert_coach'
  ) THEN
    CREATE POLICY "coach_exercise_requests_insert_coach"
      ON public.coach_exercise_requests
      FOR INSERT
      TO authenticated
      WITH CHECK (
        coach_id = (select auth.uid())
        AND (
          (select public.has_role('coach'::public.app_role))
          OR (select public.has_role('admin'::public.app_role))
          OR (select public.has_role('developer'::public.app_role))
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'coach_exercise_requests' AND policyname = 'coach_exercise_requests_update_admin'
  ) THEN
    CREATE POLICY "coach_exercise_requests_update_admin"
      ON public.coach_exercise_requests
      FOR UPDATE
      TO authenticated
      USING (
        (select public.has_role('admin'::public.app_role))
        OR (select public.has_role('developer'::public.app_role))
      )
      WITH CHECK (
        (select public.has_role('admin'::public.app_role))
        OR (select public.has_role('developer'::public.app_role))
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.routine_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  level text NOT NULL DEFAULT 'beginner',
  goal text,
  category text DEFAULT 'Oficial',
  is_published boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.routine_template_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.routine_templates(id) ON DELETE CASCADE,
  exercise_id text NOT NULL,
  day_index integer NOT NULL DEFAULT 0,
  day_label text,
  order_index integer NOT NULL DEFAULT 0,
  target_sets integer NOT NULL DEFAULT 3,
  target_reps_min integer DEFAULT 8,
  target_reps_max integer DEFAULT 12,
  rest_seconds integer DEFAULT 90
);

ALTER TABLE public.routine_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routine_template_exercises ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'routine_templates' AND policyname = 'routine_templates_select_published'
  ) THEN
    CREATE POLICY "routine_templates_select_published"
      ON public.routine_templates
      FOR SELECT
      TO authenticated
      USING (
        is_published = true
        OR (select public.has_role('coach'::public.app_role))
        OR (select public.has_role('admin'::public.app_role))
        OR (select public.has_role('developer'::public.app_role))
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'routine_templates' AND policyname = 'routine_templates_manage_staff'
  ) THEN
    CREATE POLICY "routine_templates_manage_staff"
      ON public.routine_templates
      FOR ALL
      TO authenticated
      USING (
        (select public.has_role('coach'::public.app_role))
        OR (select public.has_role('admin'::public.app_role))
        OR (select public.has_role('developer'::public.app_role))
      )
      WITH CHECK (
        (select public.has_role('coach'::public.app_role))
        OR (select public.has_role('admin'::public.app_role))
        OR (select public.has_role('developer'::public.app_role))
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'routine_template_exercises' AND policyname = 'routine_template_exercises_select_published'
  ) THEN
    CREATE POLICY "routine_template_exercises_select_published"
      ON public.routine_template_exercises
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.routine_templates rt
          WHERE rt.id = routine_template_exercises.template_id
            AND (
              rt.is_published = true
              OR (select public.has_role('coach'::public.app_role))
              OR (select public.has_role('admin'::public.app_role))
              OR (select public.has_role('developer'::public.app_role))
            )
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'routine_template_exercises' AND policyname = 'routine_template_exercises_manage_staff'
  ) THEN
    CREATE POLICY "routine_template_exercises_manage_staff"
      ON public.routine_template_exercises
      FOR ALL
      TO authenticated
      USING (
        (select public.has_role('coach'::public.app_role))
        OR (select public.has_role('admin'::public.app_role))
        OR (select public.has_role('developer'::public.app_role))
      )
      WITH CHECK (
        (select public.has_role('coach'::public.app_role))
        OR (select public.has_role('admin'::public.app_role))
        OR (select public.has_role('developer'::public.app_role))
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'machine_reports' AND policyname = 'machine_reports_anon_insert_floor_qr'
  ) THEN
    CREATE POLICY "machine_reports_anon_insert_floor_qr"
      ON public.machine_reports
      FOR INSERT
      TO anon
      WITH CHECK (reported_by IS NULL);
  END IF;
END $$;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.spot_requests;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.machine_reports;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

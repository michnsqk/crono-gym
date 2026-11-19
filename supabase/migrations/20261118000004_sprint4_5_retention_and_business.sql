-- Sprint 4 & 5: Shared routines (link/QR clone), gym attendance, real-capacity class bookings,
-- live monthly leaderboard & churn radar RPCs, and Realtime publications (non-destructive).

-- 1. Shared routines for link / QR sharing & 1-tap cloning
CREATE TABLE IF NOT EXISTS public.shared_routines (
  code text PRIMARY KEY,
  routine_id uuid REFERENCES public.routines(id) ON DELETE SET NULL,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_name text NOT NULL DEFAULT 'Atleta Cronos',
  title text NOT NULL,
  description text,
  payload jsonb NOT NULL,
  clone_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shared_routines_owner_id
  ON public.shared_routines (owner_id);
CREATE INDEX IF NOT EXISTS idx_shared_routines_routine_id
  ON public.shared_routines (routine_id);

ALTER TABLE public.shared_routines ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'shared_routines' AND policyname = 'shared_routines_select_all'
  ) THEN
    CREATE POLICY "shared_routines_select_all"
      ON public.shared_routines
      FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'shared_routines' AND policyname = 'shared_routines_insert_own'
  ) THEN
    CREATE POLICY "shared_routines_insert_own"
      ON public.shared_routines
      FOR INSERT
      TO authenticated
      WITH CHECK (owner_id = (select auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'shared_routines' AND policyname = 'shared_routines_update_own'
  ) THEN
    CREATE POLICY "shared_routines_update_own"
      ON public.shared_routines
      FOR UPDATE
      TO authenticated
      USING (owner_id = (select auth.uid()))
      WITH CHECK (owner_id = (select auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'shared_routines' AND policyname = 'shared_routines_delete_own'
  ) THEN
    CREATE POLICY "shared_routines_delete_own"
      ON public.shared_routines
      FOR DELETE
      TO authenticated
      USING (owner_id = (select auth.uid()));
  END IF;
END $$;

-- 2. Reception QR attendance log (1 check-in per user per calendar day)
CREATE TABLE IF NOT EXISTS public.gym_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  checked_in_on date NOT NULL DEFAULT CURRENT_DATE,
  checked_in_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'qr_reception',
  display_name text,
  UNIQUE (user_id, checked_in_on)
);

CREATE INDEX IF NOT EXISTS idx_gym_attendance_checked_in_on
  ON public.gym_attendance (checked_in_on DESC);
CREATE INDEX IF NOT EXISTS idx_gym_attendance_user_date
  ON public.gym_attendance (user_id, checked_in_on DESC);

ALTER TABLE public.gym_attendance ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'gym_attendance' AND policyname = 'gym_attendance_select'
  ) THEN
    CREATE POLICY "gym_attendance_select"
      ON public.gym_attendance
      FOR SELECT
      TO authenticated
      USING (
        user_id = (select auth.uid())
        OR (select public.has_role('admin'::public.app_role))
        OR (select public.has_role('developer'::public.app_role))
        OR (select public.is_coach())
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'gym_attendance' AND policyname = 'gym_attendance_insert'
  ) THEN
    CREATE POLICY "gym_attendance_insert"
      ON public.gym_attendance
      FOR INSERT
      TO authenticated
      WITH CHECK (
        user_id = (select auth.uid())
        OR (select public.has_role('admin'::public.app_role))
        OR (select public.has_role('developer'::public.app_role))
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'gym_attendance' AND policyname = 'gym_attendance_update'
  ) THEN
    CREATE POLICY "gym_attendance_update"
      ON public.gym_attendance
      FOR UPDATE
      TO authenticated
      USING (
        user_id = (select auth.uid())
        OR (select public.has_role('admin'::public.app_role))
        OR (select public.has_role('developer'::public.app_role))
      )
      WITH CHECK (
        user_id = (select auth.uid())
        OR (select public.has_role('admin'::public.app_role))
        OR (select public.has_role('developer'::public.app_role))
      );
  END IF;
END $$;

-- 3. Class bookings with real seat limits
CREATE TABLE IF NOT EXISTS public.class_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.gym_classes(id) ON DELETE CASCADE,
  schedule_id uuid REFERENCES public.gym_schedules(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  athlete_name text NOT NULL DEFAULT 'Atleta Cronos',
  booking_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'attended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, user_id, booking_date)
);

CREATE INDEX IF NOT EXISTS idx_class_bookings_class_date
  ON public.class_bookings (class_id, booking_date);
CREATE INDEX IF NOT EXISTS idx_class_bookings_user_id
  ON public.class_bookings (user_id);

ALTER TABLE public.class_bookings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'class_bookings' AND policyname = 'class_bookings_select'
  ) THEN
    CREATE POLICY "class_bookings_select"
      ON public.class_bookings
      FOR SELECT
      TO authenticated
      USING (
        user_id = (select auth.uid())
        OR (select public.has_role('admin'::public.app_role))
        OR (select public.has_role('developer'::public.app_role))
        OR (select public.is_coach())
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'class_bookings' AND policyname = 'class_bookings_insert'
  ) THEN
    CREATE POLICY "class_bookings_insert"
      ON public.class_bookings
      FOR INSERT
      TO authenticated
      WITH CHECK (
        user_id = (select auth.uid())
        OR (select public.has_role('admin'::public.app_role))
        OR (select public.has_role('developer'::public.app_role))
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'class_bookings' AND policyname = 'class_bookings_update'
  ) THEN
    CREATE POLICY "class_bookings_update"
      ON public.class_bookings
      FOR UPDATE
      TO authenticated
      USING (
        user_id = (select auth.uid())
        OR (select public.has_role('admin'::public.app_role))
        OR (select public.has_role('developer'::public.app_role))
      )
      WITH CHECK (
        user_id = (select auth.uid())
        OR (select public.has_role('admin'::public.app_role))
        OR (select public.has_role('developer'::public.app_role))
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'class_bookings' AND policyname = 'class_bookings_delete'
  ) THEN
    CREATE POLICY "class_bookings_delete"
      ON public.class_bookings
      FOR DELETE
      TO authenticated
      USING (
        user_id = (select auth.uid())
        OR (select public.has_role('admin'::public.app_role))
        OR (select public.has_role('developer'::public.app_role))
      );
  END IF;
END $$;

-- 4. RPCs for Sprint 4 & 5
CREATE OR REPLACE FUNCTION public.increment_shared_routine_clone(p_code text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.shared_routines
     SET clone_count = clone_count + 1
   WHERE code = UPPER(trim(p_code))
  RETURNING clone_count INTO v_count;
  RETURN COALESCE(v_count, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_shared_routine_clone(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_monthly_challenge_leaderboard(
  p_month_start date DEFAULT date_trunc('month', CURRENT_DATE)::date
)
RETURNS TABLE (
  user_id uuid,
  display_name text,
  sessions_count integer,
  last_activity_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  RETURN QUERY
  WITH activity AS (
    SELECT
      wl.user_id,
      (wl.completed_at AT TIME ZONE 'America/Mexico_City')::date AS active_day,
      wl.completed_at AS activity_ts
    FROM public.workout_logs wl
    WHERE wl.completed_at IS NOT NULL
      AND (wl.completed_at AT TIME ZONE 'America/Mexico_City')::date >= p_month_start
      AND (wl.completed_at AT TIME ZONE 'America/Mexico_City')::date < (p_month_start + interval '1 month')::date
    UNION ALL
    SELECT
      ga.user_id,
      ga.checked_in_on AS active_day,
      ga.checked_in_at AS activity_ts
    FROM public.gym_attendance ga
    WHERE ga.checked_in_on >= p_month_start
      AND ga.checked_in_on < (p_month_start + interval '1 month')::date
  ),
  agg AS (
    SELECT
      a.user_id,
      COUNT(DISTINCT a.active_day)::integer AS sessions_count,
      MAX(a.activity_ts) AS last_activity_at
    FROM activity a
    GROUP BY a.user_id
  )
  SELECT
    agg.user_id,
    COALESCE(NULLIF(trim(p.display_name), ''), 'Atleta Cronos') AS display_name,
    agg.sessions_count,
    agg.last_activity_at
  FROM agg
  LEFT JOIN public.profiles p ON p.user_id = agg.user_id
  ORDER BY agg.sessions_count DESC, agg.last_activity_at DESC
  LIMIT 25;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_monthly_challenge_leaderboard(date) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_admin_attendance_radar()
RETURNS TABLE (
  user_id uuid,
  display_name text,
  visits_30d integer,
  last_visit_at timestamptz,
  days_inactive integer,
  at_risk boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.has_role('admin'::public.app_role)
    OR public.has_role('developer'::public.app_role)
    OR public.is_coach()
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  WITH activity AS (
    SELECT
      ga.user_id,
      ga.checked_in_on AS active_day,
      ga.checked_in_at AS activity_ts
    FROM public.gym_attendance ga
    UNION ALL
    SELECT
      wl.user_id,
      (wl.completed_at AT TIME ZONE 'America/Mexico_City')::date AS active_day,
      wl.completed_at AS activity_ts
    FROM public.workout_logs wl
    WHERE wl.completed_at IS NOT NULL
  ),
  agg AS (
    SELECT
      p.user_id,
      COALESCE(NULLIF(trim(p.display_name), ''), 'Atleta Cronos') AS display_name,
      COUNT(DISTINCT CASE WHEN a.active_day >= (CURRENT_DATE - 30) THEN a.active_day END)::integer AS visits_30d,
      COALESCE(MAX(a.activity_ts), p.created_at) AS last_visit_at
    FROM public.profiles p
    LEFT JOIN activity a ON a.user_id = p.user_id
    GROUP BY p.user_id, p.display_name, p.created_at
  )
  SELECT
    agg.user_id,
    agg.display_name,
    agg.visits_30d,
    agg.last_visit_at,
    GREATEST(0, ((CURRENT_TIMESTAMP AT TIME ZONE 'America/Mexico_City')::date - (agg.last_visit_at AT TIME ZONE 'America/Mexico_City')::date))::integer AS days_inactive,
    (((CURRENT_TIMESTAMP AT TIME ZONE 'America/Mexico_City')::date - (agg.last_visit_at AT TIME ZONE 'America/Mexico_City')::date) >= 14) AS at_risk
  FROM agg
  ORDER BY at_risk DESC, days_inactive DESC, visits_30d DESC
  LIMIT 100;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_attendance_radar() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_class_seat_counts(
  p_booking_date date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  class_id uuid,
  confirmed_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cb.class_id,
    COUNT(*)::integer AS confirmed_count
  FROM public.class_bookings cb
  WHERE cb.booking_date = p_booking_date
    AND cb.status IN ('confirmed', 'attended')
  GROUP BY cb.class_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_class_seat_counts(date) TO authenticated;

CREATE OR REPLACE FUNCTION public.book_gym_class(
  p_class_id uuid,
  p_schedule_id uuid DEFAULT NULL,
  p_booking_date date DEFAULT CURRENT_DATE,
  p_athlete_name text DEFAULT 'Atleta Cronos'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_capacity integer;
  v_confirmed integer;
  v_already boolean;
  v_booking_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No autenticado');
  END IF;

  SELECT COALESCE(capacity, 20)
    INTO v_capacity
    FROM public.gym_classes
   WHERE id = p_class_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Clase no encontrada');
  END IF;

  SELECT EXISTS (
    SELECT 1
      FROM public.class_bookings
     WHERE class_id = p_class_id
       AND user_id = v_uid
       AND booking_date = p_booking_date
       AND status IN ('confirmed', 'attended')
  ) INTO v_already;

  SELECT COUNT(*)::integer
    INTO v_confirmed
    FROM public.class_bookings
   WHERE class_id = p_class_id
     AND booking_date = p_booking_date
     AND status IN ('confirmed', 'attended');

  IF NOT v_already AND v_confirmed >= v_capacity THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Cupo lleno para esta clase hoy',
      'confirmed_count', v_confirmed,
      'capacity', v_capacity
    );
  END IF;

  INSERT INTO public.class_bookings (
    class_id,
    schedule_id,
    user_id,
    athlete_name,
    booking_date,
    status
  )
  VALUES (
    p_class_id,
    p_schedule_id,
    v_uid,
    COALESCE(NULLIF(trim(p_athlete_name), ''), 'Atleta Cronos'),
    p_booking_date,
    'confirmed'
  )
  ON CONFLICT (class_id, user_id, booking_date)
  DO UPDATE SET
    status = 'confirmed',
    schedule_id = COALESCE(EXCLUDED.schedule_id, public.class_bookings.schedule_id),
    athlete_name = COALESCE(NULLIF(trim(EXCLUDED.athlete_name), ''), public.class_bookings.athlete_name)
  RETURNING id INTO v_booking_id;

  SELECT COUNT(*)::integer
    INTO v_confirmed
    FROM public.class_bookings
   WHERE class_id = p_class_id
     AND booking_date = p_booking_date
     AND status IN ('confirmed', 'attended');

  RETURN jsonb_build_object(
    'ok', true,
    'booking_id', v_booking_id,
    'confirmed_count', v_confirmed,
    'capacity', v_capacity
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.book_gym_class(uuid, uuid, date, text) TO authenticated;

-- 5. Enable Supabase Realtime on attendance, class bookings & purchase tickets
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.gym_attendance;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.class_bookings;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.purchase_tickets;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

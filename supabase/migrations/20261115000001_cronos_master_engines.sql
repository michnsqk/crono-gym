-- Additive, idempotent migration for Cronos Master Engines & COT-CG-001 compliance.
-- Safe to run multiple times; client engines include IndexedDB/localStorage fallbacks
-- so the application works seamlessly before or after this migration is applied.

-- 1. Admin Audit Logs
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id TEXT PRIMARY KEY,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'admin_audit_logs' AND policyname = 'admin_audit_logs_read_staff'
  ) THEN
    CREATE POLICY admin_audit_logs_read_staff ON public.admin_audit_logs
      FOR SELECT USING (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'admin_audit_logs' AND policyname = 'admin_audit_logs_insert_auth'
  ) THEN
    CREATE POLICY admin_audit_logs_insert_auth ON public.admin_audit_logs
      FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- 2. Gym Service Status (Modo Pausa / COT-CG-001)
CREATE TABLE IF NOT EXISTS public.gym_service_status (
  id TEXT PRIMARY KEY DEFAULT 'primary',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'warning_day5', 'paused_day7')),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.gym_service_status ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'gym_service_status' AND policyname = 'gym_service_status_read_all'
  ) THEN
    CREATE POLICY gym_service_status_read_all ON public.gym_service_status
      FOR SELECT USING (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'gym_service_status' AND policyname = 'gym_service_status_write_auth'
  ) THEN
    CREATE POLICY gym_service_status_write_auth ON public.gym_service_status
      FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;

INSERT INTO public.gym_service_status (id, status)
VALUES ('primary', 'active')
ON CONFLICT (id) DO NOTHING;

-- 3. Gym Challenges (Retos Mensuales del Gimnasio)
CREATE TABLE IF NOT EXISTS public.gym_challenges (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  target_sessions INTEGER NOT NULL DEFAULT 16,
  month_label TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.gym_challenges ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'gym_challenges' AND policyname = 'gym_challenges_read_all'
  ) THEN
    CREATE POLICY gym_challenges_read_all ON public.gym_challenges
      FOR SELECT USING (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'gym_challenges' AND policyname = 'gym_challenges_write_auth'
  ) THEN
    CREATE POLICY gym_challenges_write_auth ON public.gym_challenges
      FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- 4. Machine Maintenance Reports
CREATE TABLE IF NOT EXISTS public.machine_reports (
  id TEXT PRIMARY KEY,
  equipment_id TEXT NOT NULL,
  equipment_name TEXT NOT NULL DEFAULT '',
  reported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'maintenance', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.machine_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'machine_reports' AND policyname = 'machine_reports_read_all'
  ) THEN
    CREATE POLICY machine_reports_read_all ON public.machine_reports
      FOR SELECT USING (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'machine_reports' AND policyname = 'machine_reports_write_auth'
  ) THEN
    CREATE POLICY machine_reports_write_auth ON public.machine_reports
      FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- 5. Store & Class Demand Intents
CREATE TABLE IF NOT EXISTS public.store_intents (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('store', 'class')),
  item_id TEXT NOT NULL,
  item_title TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.store_intents ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'store_intents' AND policyname = 'store_intents_read_all'
  ) THEN
    CREATE POLICY store_intents_read_all ON public.store_intents
      FOR SELECT USING (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'store_intents' AND policyname = 'store_intents_insert_own'
  ) THEN
    CREATE POLICY store_intents_insert_own ON public.store_intents
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 6. Floor Spot / Technique Requests
CREATE TABLE IF NOT EXISTS public.spot_requests (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  athlete_name TEXT NOT NULL DEFAULT 'Socio',
  exercise_name TEXT NOT NULL,
  station_label TEXT NOT NULL DEFAULT 'Piso',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'attending', 'done')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.spot_requests ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'spot_requests' AND policyname = 'spot_requests_all_auth'
  ) THEN
    CREATE POLICY spot_requests_all_auth ON public.spot_requests
      FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;

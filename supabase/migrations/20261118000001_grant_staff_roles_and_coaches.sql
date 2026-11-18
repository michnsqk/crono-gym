-- Grant coach & admin access for staff emails (whether signing in via Email or Google OAuth)
INSERT INTO public.role_invites (email, role, consumed_at)
VALUES
  ('stephemercadov@gmail.com', 'coach'::public.app_role, NULL),
  ('stephenmercadov@gmail.com', 'coach'::public.app_role, NULL),
  ('alejandro.calixtomas@gmail.com', 'coach'::public.app_role, NULL),
  ('michnsqk07@gmail.com', 'admin'::public.app_role, NULL),
  ('cronosgymoficial@gmail.com', 'admin'::public.app_role, NULL)
ON CONFLICT (email, role) DO UPDATE
SET consumed_at = NULL;

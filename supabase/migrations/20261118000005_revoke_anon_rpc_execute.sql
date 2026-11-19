-- Revoke default PUBLIC/anon EXECUTE grants on Sprint 4 & 5 SECURITY DEFINER RPCs
REVOKE EXECUTE ON FUNCTION public.increment_shared_routine_clone(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_monthly_challenge_leaderboard(date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_admin_attendance_radar() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_class_seat_counts(date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.book_gym_class(uuid, uuid, date, text) FROM PUBLIC, anon;

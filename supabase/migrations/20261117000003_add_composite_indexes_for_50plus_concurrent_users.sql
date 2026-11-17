create index if not exists idx_completed_sets_log_exercise
  on public.completed_sets (log_id, exercise_id);

create index if not exists idx_workout_logs_user_completed
  on public.workout_logs (user_id, completed_at desc);

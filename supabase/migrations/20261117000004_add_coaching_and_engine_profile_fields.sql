alter table public.profiles
  add column if not exists weekly_days_target integer not null default 4,
  add column if not exists preferred_session_minutes integer not null default 60,
  add column if not exists training_location text not null default 'commercial_gym',
  add column if not exists injuries_or_notes text;

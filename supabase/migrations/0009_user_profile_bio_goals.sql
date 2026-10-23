-- PROJ-16 extension: Auto-Bio + Career Goals columns on user_profile
alter table user_profile
  add column if not exists bio text,
  add column if not exists bio_updated_at timestamptz,
  add column if not exists goals_text text,
  add column if not exists goals_updated_at timestamptz;

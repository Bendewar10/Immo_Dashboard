-- PROJ-16: Eigenes Profil (CV) + CV-Upload mit KI-Parsing
-- Tables: user_profile (singleton), user_education, user_employment. Owner-only RLS.
-- Storage bucket cv-uploads for uploaded CV PDFs, owner-scoped RLS.

create table if not exists user_profile (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  headline text,
  skills text[] not null default '{}',
  languages text[] not null default '{}',
  cv_file_path text,
  cv_uploaded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists user_education (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  institution text not null,
  degree text,
  field_of_study text,
  city text,
  start_date date,
  end_date date,
  created_at timestamptz not null default now()
);

create table if not exists user_employment (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  employer text not null,
  job_title text,
  city text,
  start_date date,
  end_date date,
  description text,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_profile_user_id on user_profile(user_id);
create index if not exists idx_user_education_user_id on user_education(user_id);
create index if not exists idx_user_employment_user_id on user_employment(user_id);

alter table user_profile enable row level security;
alter table user_education enable row level security;
alter table user_employment enable row level security;

create policy "user_profile_select_own" on user_profile for select using (auth.uid() = user_id);
create policy "user_profile_insert_own" on user_profile for insert with check (auth.uid() = user_id);
create policy "user_profile_update_own" on user_profile for update using (auth.uid() = user_id);
create policy "user_profile_delete_own" on user_profile for delete using (auth.uid() = user_id);

create policy "user_education_select_own" on user_education for select using (auth.uid() = user_id);
create policy "user_education_insert_own" on user_education for insert with check (auth.uid() = user_id);
create policy "user_education_update_own" on user_education for update using (auth.uid() = user_id);
create policy "user_education_delete_own" on user_education for delete using (auth.uid() = user_id);

create policy "user_employment_select_own" on user_employment for select using (auth.uid() = user_id);
create policy "user_employment_insert_own" on user_employment for insert with check (auth.uid() = user_id);
create policy "user_employment_update_own" on user_employment for update using (auth.uid() = user_id);
create policy "user_employment_delete_own" on user_employment for delete using (auth.uid() = user_id);

-- Storage bucket for uploaded CV PDFs, private (not publicly readable)
insert into storage.buckets (id, name, public)
values ('cv-uploads', 'cv-uploads', false)
on conflict (id) do nothing;

create policy "cv_uploads_select_own"
  on storage.objects for select
  using (bucket_id = 'cv-uploads' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "cv_uploads_insert_own"
  on storage.objects for insert
  with check (bucket_id = 'cv-uploads' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "cv_uploads_delete_own"
  on storage.objects for delete
  using (bucket_id = 'cv-uploads' and (storage.foldername(name))[1] = auth.uid()::text);

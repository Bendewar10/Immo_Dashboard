-- PROJ-12: Projekte/Cases
-- Tables: projects, project_participants. Owner-only RLS. Adds optional project_id to interactions.

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  client text,
  city text,
  start_date date,
  end_date date,
  status text not null default 'active' check (status in ('active', 'done')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists project_participants (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('partner', 'project_manager', 'case_team', 'client', 'other')),
  role_other text,
  created_at timestamptz not null default now(),
  unique (project_id, contact_id)
);

alter table interactions add column if not exists project_id uuid references projects(id) on delete set null;

create index if not exists idx_projects_user_id on projects(user_id);
create index if not exists idx_projects_status on projects(status);
create index if not exists idx_project_participants_project_id on project_participants(project_id);
create index if not exists idx_project_participants_contact_id on project_participants(contact_id);
create index if not exists idx_interactions_project_id on interactions(project_id);

alter table projects enable row level security;
alter table project_participants enable row level security;

create policy "projects_select_own" on projects for select using (auth.uid() = user_id);
create policy "projects_insert_own" on projects for insert with check (auth.uid() = user_id);
create policy "projects_update_own" on projects for update using (auth.uid() = user_id);
create policy "projects_delete_own" on projects for delete using (auth.uid() = user_id);

create policy "project_participants_select_own" on project_participants for select using (auth.uid() = user_id);
create policy "project_participants_insert_own" on project_participants for insert with check (
  auth.uid() = user_id
  and exists (select 1 from projects p where p.id = project_id and p.user_id = auth.uid())
  and exists (select 1 from contacts c where c.id = contact_id and c.user_id = auth.uid())
);
create policy "project_participants_delete_own" on project_participants for delete using (auth.uid() = user_id);

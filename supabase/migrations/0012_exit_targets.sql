-- PROJ-23: Exit-Ziel-Tracker — Zielfirmen pro Nutzer
-- Schlanke Liste; Abdeckung/Touchpoint werden clientseitig aus den Kontakten berechnet.
-- Duplikate verhindert die DB case-insensitive (lower + trim).

create table if not exists exit_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_name text not null check (
    length(trim(company_name)) between 1 and 100
  ),
  created_at timestamptz not null default now()
);

create unique index if not exists idx_exit_targets_unique_company
  on exit_targets(user_id, lower(trim(company_name)));

create index if not exists idx_exit_targets_user_id on exit_targets(user_id);

alter table exit_targets enable row level security;

create policy "exit_targets_select_own" on exit_targets for select using (auth.uid() = user_id);
create policy "exit_targets_insert_own" on exit_targets for insert with check (auth.uid() = user_id);
create policy "exit_targets_update_own" on exit_targets for update using (auth.uid() = user_id);
create policy "exit_targets_delete_own" on exit_targets for delete using (auth.uid() = user_id);

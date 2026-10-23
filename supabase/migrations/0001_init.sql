-- PROJ-1: Supabase Infrastructure Setup
-- Tables: contacts, interactions. Owner-only RLS. Auto-updated follow-up tracking.

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  photo_url text,
  context text,
  category text check (category in ('business', 'investor', 'community', 'friend', 'acquaintance')),
  strength smallint check (strength in (1, 2, 3)),
  notes text,
  followup_interval_days int not null default 30,
  last_contacted_at timestamptz,
  next_followup_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists interactions (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references contacts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  occurred_at date not null,
  channel text not null check (channel in ('meeting', 'call', 'message', 'event')),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_contacts_user_id on contacts(user_id);
create index if not exists idx_contacts_next_followup_at on contacts(next_followup_at);
create index if not exists idx_interactions_contact_id on interactions(contact_id);
create index if not exists idx_interactions_user_id on interactions(user_id);

alter table contacts enable row level security;
alter table interactions enable row level security;

create policy "contacts_select_own" on contacts for select using (auth.uid() = user_id);
create policy "contacts_insert_own" on contacts for insert with check (auth.uid() = user_id);
create policy "contacts_update_own" on contacts for update using (auth.uid() = user_id);
create policy "contacts_delete_own" on contacts for delete using (auth.uid() = user_id);

create policy "interactions_select_own" on interactions for select using (auth.uid() = user_id);
create policy "interactions_insert_own" on interactions for insert with check (auth.uid() = user_id);
create policy "interactions_update_own" on interactions for update using (auth.uid() = user_id);
create policy "interactions_delete_own" on interactions for delete using (auth.uid() = user_id);

-- Keeps contacts.last_contacted_at / next_followup_at in sync whenever an interaction is logged,
-- so the frontend never has to compute follow-up dates itself.
create or replace function update_contact_followup()
returns trigger as $$
begin
  update contacts
  set last_contacted_at = new.occurred_at,
      next_followup_at = new.occurred_at + (followup_interval_days || ' days')::interval
  where id = new.contact_id;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_update_contact_followup
  after insert on interactions
  for each row execute function update_contact_followup();

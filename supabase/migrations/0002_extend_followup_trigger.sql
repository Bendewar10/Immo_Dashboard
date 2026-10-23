-- PROJ-5: Interaktions-Log
-- Extends the followup-sync trigger to also recompute on UPDATE/DELETE of interactions,
-- so last_contacted_at/next_followup_at always reflect the actual newest remaining interaction
-- (not just the one most recently inserted).

create or replace function recompute_contact_followup(target_contact_id uuid)
returns void as $$
declare
  latest_date date;
begin
  select max(occurred_at) into latest_date
  from interactions
  where contact_id = target_contact_id;

  update contacts
  set last_contacted_at = latest_date,
      next_followup_at = case
        when latest_date is null then null
        else latest_date + (followup_interval_days || ' days')::interval
      end
  where id = target_contact_id;
end;
$$ language plpgsql security definer set search_path to 'public';

-- SECURITY DEFINER helper, only meant to be called by the trigger below — not a public API.
revoke execute on function recompute_contact_followup(uuid) from public, anon, authenticated;

create or replace function update_contact_followup()
returns trigger as $$
begin
  if tg_op = 'DELETE' then
    perform recompute_contact_followup(old.contact_id);
    return old;
  end if;

  perform recompute_contact_followup(new.contact_id);

  if tg_op = 'UPDATE' and old.contact_id is distinct from new.contact_id then
    perform recompute_contact_followup(old.contact_id);
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path to 'public';

drop trigger if exists trg_update_contact_followup on interactions;

create trigger trg_update_contact_followup
  after insert or update or delete on interactions
  for each row execute function update_contact_followup();

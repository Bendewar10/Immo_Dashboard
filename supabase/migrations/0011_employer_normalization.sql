-- PROJ-22: Firmen-Ansicht — KI-normalisierte Firmennamen am Kontakt
-- employer bleibt der Rohwert; employer_normalized ist der kanonische Gruppierungsname.
-- source='manual' schützt Nutzer-Korrekturen dauerhaft vor KI-Überschreibung.

alter table contacts add column if not exists employer_normalized text;
alter table contacts add column if not exists employer_normalized_source text
  check (employer_normalized_source in ('ai', 'manual'));
alter table contacts add column if not exists employer_normalized_at timestamptz;

-- Batch-Lauf sucht Kontakte mit employer, aber ohne Normalisierung
create index if not exists idx_contacts_employer_pending
  on contacts(user_id)
  where employer is not null and employer_normalized is null;

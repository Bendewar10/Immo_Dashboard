-- PROJ-17: Gemeinsamkeiten-Feld bei Kontakten (KI-Matching Profil ↔ Kontakt)
-- Adds AI-generated commonalities text column to contacts table.
alter table contacts add column if not exists commonalities text;

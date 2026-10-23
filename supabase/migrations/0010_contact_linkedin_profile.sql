-- PROJ-20 (Erweiterung): On-Demand LinkedIn-Profildaten-Enrichment.
-- Der Apify-Profil-Scrape liefert das ganze Profil (Headline, Position, Standort,
-- Werdegang, Ausbildung), nicht nur das Bild. Diese Daten werden on-demand beim
-- KI-Analyse-Knopf (Gemeinsamkeiten, PROJ-17) mit-geerntet und pro Kontakt als
-- KI-Kontext gespeichert.
--
-- linkedin_profile:    normalisierter Profil-Snapshot (jsonb), backend-only KI-Kontext.
-- linkedin_profile_at: Zeitpunkt des letzten Profil-Scrapes (Cooldown-Steuerung,
--                      getrennt von photo_attempted_at).
alter table contacts add column if not exists linkedin_profile jsonb;
alter table contacts add column if not exists linkedin_profile_at timestamptz;

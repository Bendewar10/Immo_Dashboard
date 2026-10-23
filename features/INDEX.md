# Feature Index

> Central tracking for all features. Updated by skills automatically.

## Status Legend
- **Roadmap** - `/init` done, feature identified in feature map, no spec file yet
- **Planned** - `/write-spec` done, full spec written, architecture not yet designed
- **Architected** - `/architecture` done, tech design approved, ready to build
- **In Progress** - `/frontend` or `/backend` active or completed, not yet in QA
- **In Review** - `/qa` active, testing in progress
- **Approved** - `/qa` passed, no critical/high bugs, ready to deploy
- **Deployed** - `/deploy` done, live in production

## Features

| ID | Feature | Status | Spec | Created | Dependencies |
|----|---------|--------|------|---------|---------------|
| PROJ-1 | Supabase Infrastructure Setup | Deployed | [Spec](PROJ-1-supabase-infrastructure-setup.md) | 2026-06-19 | None |
| PROJ-2 | Auth (Login) | Deployed | [Spec](PROJ-2-auth-login-signup.md) | 2026-06-19 | PROJ-1 |
| PROJ-3 | Kontakt anlegen & verwalten | Deployed | [Spec](PROJ-3-kontakt-anlegen-verwalten.md) | 2026-06-19 | PROJ-1, PROJ-2 |
| PROJ-4 | Kontaktliste & Filter (inkl. Firmen-/Titel-Suche) | Deployed | [Spec](PROJ-4-kontaktliste-filter.md) | 2026-06-19 | PROJ-3 |
| PROJ-5 | Interaktions-Log | Deployed | [Spec](PROJ-5-interaktions-log.md) | 2026-06-19 | PROJ-3 |
| PROJ-6 | Follow-up Dashboard & Tagesansicht (inkl. Anlässe/Geburtstage, AI-Nachrichtenvorschlag, editierbarer Draft + Ton-Anpassung, Copy-Button, Kalender-Link, 14-Tage-Vorschau, Import-Events, Kalender-Geburtstags-Vorschläge) | Deployed | [Spec](PROJ-6-follow-up-dashboard.md) | 2026-06-19 | PROJ-3, PROJ-5, PROJ-10, PROJ-19, PROJ-21 |
| PROJ-7 | Foto-Upload | Obsolet (ersetzt durch PROJ-20) | - | 2026-06-19 | PROJ-3 |
| PROJ-8 | Netzwerk-Analytics (periodisch, inkl. Top-Kontakte nach Meeting-Häufigkeit) | Deployed | [Spec](PROJ-8-netzwerk-analytics.md) | 2026-06-22 | PROJ-3, PROJ-5, PROJ-19, PROJ-21 |
| PROJ-9 | Monatlicher AI-Report per Mail | Deployed | [Spec](PROJ-9-monatlicher-ai-report.md) | 2026-06-23 | PROJ-1, PROJ-5, PROJ-8 |
| PROJ-10 | LinkedIn-CSV-Import | Deployed | [Spec](PROJ-10-linkedin-csv-import.md) | 2026-06-24 | PROJ-3 |
| PROJ-11 | AI Chat Assistant (Sidebar-Popup) | Deployed | [Spec](PROJ-11-ai-chat-assistant.md) | 2026-06-29 | PROJ-3, PROJ-5 |
| PROJ-12 | Projekte/Cases (Engagement-Container: Beteiligte + Projekt-Log) | Deployed | [Spec](PROJ-12-projekte-cases.md) | 2026-06-30 | PROJ-3, PROJ-5 |
| PROJ-13 | Rolloff-Wizard (AI-Bulk-Nachfass bei Projektende) | Verworfen (2026-07-03, bewusste Produktentscheidung) | - | 2026-06-30 | PROJ-12, PROJ-6 |
| PROJ-14 | City-Trip-Modus (Kontakte vor Ort + Batch-Draft auf Projekt-Detailseite + Dashboard-Auto-Trigger via Kalender) | Deployed | [Spec](PROJ-14-city-trip-modus.md) | 2026-06-30 | PROJ-12, PROJ-3, PROJ-5, PROJ-6, PROJ-19, PROJ-21 |
| PROJ-15 | Profil (Umbenennung Projekte → Profil + Karriere-Stats-Header) | Deployed | [Spec](PROJ-15-profil.md) | 2026-06-30 | PROJ-12, PROJ-3, PROJ-6 |
| PROJ-16 | Eigenes Profil (CV) + CV-Upload mit KI-Parsing + Auto-Bio + Career Goals | Deployed | [Spec](PROJ-16-eigenes-profil-cv.md) | 2026-06-30 | PROJ-3, PROJ-15 |
| PROJ-17 | Gemeinsamkeiten-Feld bei Kontakten (KI-Matching Profil ↔ Kontakt) | Deployed | [Spec](PROJ-17-gemeinsamkeiten-feld.md) | 2026-06-30 | PROJ-16, PROJ-3, PROJ-11 |
| PROJ-18 | Passives KI-Lernen aus Cases/Interaktionen (automatische Profil-Vorschläge) | Roadmap | - | 2026-06-30 | PROJ-16, PROJ-12, PROJ-5 |
| PROJ-19 | Konnektoren-Hub (OAuth Integration Settings) | Deployed | [Spec](PROJ-19-konnektoren-hub.md) | 2026-07-01 | PROJ-1, PROJ-2 |
| PROJ-20 | LinkedIn Foto-Enrichment (auto Profilbild-Scraping via Apify: CSV-Import + Monats-Cron) + On-Demand Profildaten-Enrichment (Erweiterung) | Deployed | [Spec](PROJ-20-linkedin-foto-enrichment.md) | 2026-07-01 | PROJ-10, PROJ-3, PROJ-1, PROJ-17 |
| PROJ-21 | Meeting-Prep-Sektion im Dashboard (Termine 3-Tage-Fenster + KI-Zusammenfassung + Post-Meeting-Nudge pro Kontakt) | Deployed | [Spec](PROJ-21-meeting-prep-dashboard.md) | 2026-07-02 | PROJ-19, PROJ-3, PROJ-5, PROJ-17, PROJ-6 |
| PROJ-22 | Firmen-Ansicht (Firmen-Drilldown auf Kontaktliste + KI-Normalisierung der Firmennamen) | Deployed | [Spec](PROJ-22-firmen-ansicht.md) | 2026-07-02 | PROJ-3, PROJ-4, PROJ-5 |
| PROJ-23 | Exit-Ziel-Tracker (Zielfirmen + Netzwerk-Abdeckung auf Profil-Seite) | Deployed | [Spec](PROJ-23-exit-ziel-tracker.md) | 2026-07-02 | PROJ-22, PROJ-16, PROJ-3, PROJ-5 |
| PROJ-24 | Job-Change-Radar (monatliche Wechsel-Erkennung via LinkedIn → Dashboard-Anlässe) | Deployed | [Spec](PROJ-24-job-change-radar.md) | 2026-07-02 | PROJ-20, PROJ-10, PROJ-6, PROJ-22, PROJ-3 |

<!-- Add features above this line -->

## Next Available ID: PROJ-25

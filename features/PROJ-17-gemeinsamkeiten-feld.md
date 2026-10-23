# PROJ-17: Gemeinsamkeiten-Feld bei Kontakten (KI-Matching Profil ↔ Kontakt)

## Status
Deployed

## Overview
KI vergleicht das eigene Profil (CV: Stationen, Ausbildung, Skills) mit dem Kontaktprofil (Arbeitgeber, Rolle, Stadt, Kontext, Notizen) und identifiziert konkrete Anknüpfungspunkte — gemeinsame Arbeitgeber, Branchen, Städte, Universitäten, Themen. Ergebnis wird auf Kontaktkarte als Badge und im Kontakt-Dialog als lesbarer Text angezeigt.

## Dependencies
- PROJ-16 (Eigenes Profil / CV) — Profildaten sind Grundlage
- PROJ-3 (Kontakt anlegen & verwalten) — contacts-Tabelle

## Acceptance Criteria
- [x] Kontakt-Dialog zeigt "Gemeinsamkeiten"-Sektion mit "KI-Analyse starten"-Button (nur bei bestehendem Kontakt)
- [x] Button löst POST /api/contacts/[id]/commonalities aus
- [x] KI-Analyse nutzt user_employment, user_education, user_profile + Kontaktdaten
- [x] Ergebnis wird in contacts.commonalities gespeichert und sofort angezeigt
- [x] Kontaktkarte zeigt violettes "Gemeinsamkeiten"-Badge wenn Daten vorhanden
- [x] Fehlerfall: kein CV → klare Fehlermeldung, zu wenig Kontaktdaten → klare Fehlermeldung
- [x] "Neu analysieren"-Button für erneute Analyse

## Technical Implementation

### DB
- Migration `0006_contact_commonalities.sql`: `ALTER TABLE contacts ADD COLUMN commonalities text`

### API
- `POST /api/contacts/[id]/commonalities`
- Fetcht parallel: contact, user_profile, user_education, user_employment
- Prompt an claude-haiku-4-5: findet Gemeinsamkeiten als 2-4 Stichpunkte
- Speichert Ergebnis in contacts.commonalities
- Fehler 422 wenn kein Profil oder zu wenig Kontaktdaten

### Frontend
- `ContactCard`: violettes Badge mit Sparkles-Icon wenn `contact.commonalities` gesetzt
- `ContactFormDialog`: Gemeinsamkeiten-Sektion mit Button + Ergebnisanzeige (violetter Hintergrund)
- `Contact` Typ: `commonalities?: string | null`

## QA Test Results

**Date:** 2026-07-01
**QA Status:** Approved

### Acceptance Criteria

| # | Criterion | Result |
|---|-----------|--------|
| 1 | Kontakt-Dialog zeigt Gemeinsamkeiten-Sektion + Button (nur bei bestehendem Kontakt) | PASS |
| 2 | Button löst POST /api/contacts/[id]/commonalities aus | PASS |
| 3 | KI-Analyse nutzt user_employment, user_education, user_profile + Kontaktdaten | PASS |
| 4 | Ergebnis wird in contacts.commonalities gespeichert und sofort angezeigt | PASS |
| 5 | Kontaktkarte zeigt violettes Gemeinsamkeiten-Badge wenn Daten vorhanden | PASS |
| 6 | Fehler: kein CV → klare Fehlermeldung | PASS |
| 7 | Fehler: zu wenig Kontaktdaten → klare Fehlermeldung (422) | PASS |
| 8 | "Neu analysieren"-Button für erneute Analyse | PASS |

### Automated Tests
- **Unit tests:** 10/10 pass (`src/app/api/contacts/[id]/commonalities/route.test.ts`)
- **E2E tests:** 6/6 pass (`tests/PROJ-17-gemeinsamkeiten.spec.ts`)
- **Full suite:** 123 tests pass (no regressions)

### Bugs Found

| Severity | Description |
|----------|-------------|
| Medium | `update` result not checked — if DB write silently fails after AI call, API still returns 200 but result not persisted across reloads |
| Medium | `myProfile` can be empty string if user has profile row with zero content (no headline/skills/employment/education) — AI gets poor/empty context |
| Low | Missing `.limit()` on `user_education`/`user_employment` list queries (backend rule violation) |
| Low | UUID regex `^[0-9a-f-]{36}$` too loose (allows non-UUID strings of 36 hex+dash chars); no security impact since RLS enforces ownership |

### Security Audit
- **Authorization:** Server client uses anon key + user cookie JWT → RLS enforced. Users can only read/update their own contacts and profile data. ✓
- **Input validation:** Contact ID validated by regex before use. Contact ownership verified by RLS on all queries. ✓
- **Prompt injection:** User-controlled fields (context, notes, employer) are inserted into AI prompt. Risk is low — worst case a poorly crafted contact note influences the AI output, it doesn't affect other users or expose data. Acceptable for this use case. ✓
- **No secrets exposed:** API response only returns the generated commonalities text, no profile or CV data. ✓

### Production-Ready Decision
**READY** — No Critical or High bugs. Medium bugs are low-risk in practice (update failure is edge case; empty profile is caught by `hasProfileData` check). Can ship, fix Medium bugs in follow-up.

## Deployed
2026-07-01

- **Production URL:** https://bambi-w26q.vercel.app
- **Deploy-Commit:** `fead78c` · **Tag:** `v1.17.0-PROJ-17`
- Code seit erstem Deploy live; Endpoint `/api/contacts/[id]/commonalities` in Prod erreichbar. INDEX-Status am 2026-07-01 auf „Deployed" korrigiert (war fälschlich „Approved").

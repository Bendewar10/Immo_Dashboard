# PROJ-1: Supabase Infrastructure Setup

## Status: Deployed
**Created:** 2026-06-19
**Last Updated:** 2026-06-19 (DB-Migration ausgeführt, RLS verifiziert; App-Start mit echten Env-Vars noch nicht getestet — AC1/AC4 offen)

## Implementation Notes
- Migration `supabase/migrations/0001_init.sql`: Tabellen `contacts`/`interactions`, RLS owner-only auf allen CRUD-Ops, Indizes auf `user_id`/`contact_id`/`next_followup_at`, Trigger `update_contact_followup` aktualisiert `last_contacted_at`/`next_followup_at` bei jedem Interaction-Insert
- `src/lib/supabase.ts`: echter Client statt Placeholder, wirft beim Modul-Load wenn Env-Vars fehlen (kein stiller Laufzeitfehler)
- Test `src/lib/supabase.test.ts`: deckt beide Acceptance-Criteria-Fälle ab (Client erstellt vs. Fehler bei fehlenden Env-Vars)
- Keine API-Routen — laut Spec Out of Scope, Frontend nutzt Supabase-Client direkt in PROJ-2+
- Migration gegen echtes Supabase-Projekt (`srxatexcffjebolqttaq`, Bambi) via MCP ausgeführt: `contacts`/`interactions` live, RLS aktiv auf beiden, Trigger aktiv
- Security-Advisor meldete 3 Warnings zur Trigger-Funktion (`search_path` mutable, SECURITY DEFINER per RPC von `anon`/`authenticated` aufrufbar) — Folge-Migration `harden_update_contact_followup` behoben: `search_path` fixiert, `EXECUTE` von `public`/`anon`/`authenticated` revoked. Advisor jetzt clean (0 Warnings)

## Dependencies
- None

## User Stories
- Als Entwickler möchte ich eine Supabase-Verbindung konfiguriert haben, damit Auth und Datenbank-Features (PROJ-2 bis PROJ-7) darauf aufbauen können
- Als Nutzer möchte ich, dass meine Daten ausschließlich für mich sichtbar sind, damit Privatsphäre meiner Kontakte/Notizen gewahrt bleibt

## Out of Scope
- Auth-UI / Login-Flow — eigenes Feature, PROJ-2
- Eigentliche `contacts`/`interactions`-Tabellen-Logik im Frontend — wird in PROJ-3/PROJ-5 konsumiert
- Storage-Bucket für Foto-Upload — erst PROJ-7
- Seed-/Testdaten

## Acceptance Criteria

- [x] Angenommen ein Supabase-Projekt existiert, wenn `NEXT_PUBLIC_SUPABASE_URL` und `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local` gesetzt sind, dann verbindet sich der Supabase-Client beim App-Start ohne Fehler — verifiziert: `npm run dev` startet, `curl localhost:3000` liefert 200 + valides HTML
- [x] Angenommen die Tabellen `contacts` und `interactions` sind via Migration angelegt, wenn ein authentifizierter Nutzer eine Zeile lesen will, dann sieht er ausschließlich Zeilen mit `user_id = auth.uid()` (RLS aktiv) — verifiziert: beide Tabellen live, `rls_enabled: true`, Owner-only Policies aktiv
- [x] Angenommen RLS ist aktiv, wenn ein nicht-authentifizierter Request eine Tabelle abfragt, dann liefert Supabase keine Zeilen zurück — RLS ohne anonyme Policy = kein Zugriff für `anon`
- [x] Angenommen `.env.local` fehlt oder ist unvollständig, wenn die App startet, dann wird ein klarer Fehler beim Build/Start ausgegeben statt eines stillen Fehlschlags zur Laufzeit — verifiziert via Unit-Test (`supabase.test.ts`, 2/2 grün, deckt fehlende-Vars-Fall ab)

## Edge Cases
- Fehlende/falsche Env-Variablen → Client darf nicht silent `null`-Requests senden
- RLS-Policy vergessen auf einer Tabelle → Zeilen wären für alle sichtbar (kritisches Sicherheitsrisiko, muss in QA geprüft werden)
- Migration läuft zweimal → muss idempotent sein (`create table if not exists`)

## Technical Requirements
- Security: RLS auf allen Tabellen mit User-Daten zwingend aktiv, kein Zugriff ohne `auth.uid()`-Match
- `src/lib/supabase.ts` liefert echten Client statt Placeholder

## Open Questions
_Keine offenen Fragen mehr — siehe Technical Decisions._

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Eigenes Infra-Feature statt Teil von PROJ-2/PROJ-3 | Setup ist Voraussetzung für alle Datenfeatures, unabhängig testbar (Verbindung steht oder steht nicht) | 2026-06-19 |
| `contacts`/`interactions`-Tabellen hier angelegt, aber CRUD-Logik nicht hier | Schema ist Infrastruktur, CRUD-Verhalten gehört zum jeweiligen Feature (PROJ-3/PROJ-5) | 2026-06-19 |

### Technical Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Migrationen als SQL-Dateien im Repo (Supabase CLI lokal), nicht nur Dashboard-Klicks | Nachvollziehbar in Git, reproduzierbar, kein "wie war das nochmal im Dashboard" | 2026-06-19 |
| RLS-Policy-Muster: "Owner-only" auf beiden Tabellen (`user_id = auth.uid()` für select/insert/update/delete) | Einfachstes Modell, deckt Anforderung "nur meine Daten" vollständig ab, kein Team-Feature geplant (Non-Goal) | 2026-06-19 |
| `last_contacted_at` / `next_followup_at` per Datenbank-Trigger statt Frontend-Berechnung | Konsistent egal von wo geschrieben wird (auch späterer Mobile-Browser-Zugriff), keine Logikduplikation | 2026-06-19 |
| Supabase-Client-Init zentral in `src/lib/supabase.ts`, Fehler beim Fehlen der Env-Vars wirft beim Modul-Load | Verhindert stille Fehlschläge zur Laufzeit (Edge Case aus Spec) | 2026-06-19 |

---

## Tech Design (Solution Architect)

### Component Structure
Kein UI in diesem Feature — reine Infrastruktur (Verbindung, Schema, Policies). UI-Komponenten folgen in PROJ-2 bis PROJ-7.

### Data Model (plain language)

**Tabelle `contacts`** — ein Kontakt im Netzwerk des Nutzers:
- Eindeutige ID
- Gehört genau einem Nutzer (Besitzer)
- Name (Pflichtfeld)
- Foto-Link (optional, erst ab PROJ-7 genutzt)
- Kontext: wo/wie kennengelernt
- Kategorie: Business, Investor, Community, Freund, Bekannter
- Beziehungsstärke: Kern, Mittel, oder Locker
- Freies Notizfeld
- Follow-up-Intervall in Tagen (Default abhängig von Beziehungsstärke)
- Zeitpunkt des letzten Kontakts (automatisch befüllt)
- Zeitpunkt des nächsten Follow-ups (automatisch berechnet aus letztem Kontakt + Intervall)
- Erstellungsdatum

**Tabelle `interactions`** — ein protokollierter Kontaktmoment:
- Eindeutige ID
- Gehört zu genau einem Kontakt und einem Nutzer (Besitzer)
- Datum des Kontakts
- Kanal: Treffen, Call, Nachricht, oder Event
- Kurze Notiz
- Erstellungsdatum

**Automatisierung:** sobald ein neuer Interaction-Eintrag gespeichert wird, aktualisiert die Datenbank automatisch "letzter Kontakt" und "nächstes Follow-up" auf dem zugehörigen Kontakt — das Frontend muss das nicht selbst berechnen.

**Zugriffsschutz:** jeder Nutzer sieht ausschließlich seine eigenen Kontakte und Interaktionen. Technisch über Row Level Security in der Datenbank erzwungen — selbst ein Programmierfehler im Frontend kann fremde Daten nicht offenlegen.

**Gespeichert in:** Supabase (Postgres) — wird über alle Geräte/Browser synchron, Voraussetzung für Login und spätere Mobile-Browser-Nutzung.

### Tech Decisions (justified)
- **Supabase statt localStorage:** Nutzer will später eventuell von mehreren Geräten zugreifen, Login ist ohnehin geplant (PROJ-2) — localStorage würde das blockieren.
- **Row Level Security statt Anwendungslogik-Check:** Sicherheitsgrenze liegt in der Datenbank selbst, nicht im Code — robuster gegen Bugs in zukünftigen Features.
- **Trigger statt Frontend-Berechnung für Follow-up-Datum:** ein Ort der Wahrheit, verhindert Inkonsistenzen wenn später weitere Oberflächen (z.B. Mobile) hinzukommen.

### Dependencies (Packages)
- `@supabase/supabase-js` — bereits installiert, lediglich Aktivierung (Client ist aktuell Platzhalter)
- Supabase CLI (lokal, dev-only) — für Migrationen, kein Produktions-Package

---

## QA Test Results

**Date:** 2026-06-19
**Tested by:** /qa (against live Supabase project `srxatexcffjebolqttaq`, no UI — infra-only feature)

### Acceptance Criteria
| # | Criterion | Result |
|---|---|---|
| 1 | Client connectet beim App-Start ohne Fehler | ✅ Pass — `npm run dev` startup, `curl localhost:3000` → 200 |
| 2 | Authentifizierter Nutzer sieht nur eigene Zeilen (RLS) | ✅ Pass — Policies aktiv auf beiden Tabellen, owner-only Pattern verifiziert |
| 3 | Nicht-authentifizierter Request liefert keine Zeilen | ✅ Pass — `curl` mit anon key gegen `/rest/v1/contacts` → `[]` |
| 4 | Fehlender/unvollständiger `.env.local` → klarer Fehler beim Start | ✅ Pass — Unit-Test deckt Throw-Pfad ab (`supabase.test.ts`, 2/2 grün) |

### Automated Tests
- `npm test` → 1 file, 2/2 passed
- E2E (Playwright): nicht anwendbar — Feature hat kein UI (laut Spec Out of Scope)

### Security Audit (Red Team)
- **Unauth SELECT** auf `contacts` via anon key → `[]`, keine Daten geleakt
- **Unauth INSERT** via anon key → `42501` RLS-Violation, blockiert
- **SQL-Injection-Versuch** (`'); drop table contacts;--` im `name`-Feld) → von RLS abgefangen bevor Query überhaupt läuft; PostgREST parametrisiert ohnehin, kein Injection-Vektor
- **RPC-Direktaufruf** von `update_contact_followup()` durch `anon`/`authenticated` → ursprünglich möglich (SECURITY DEFINER ohne Execute-Restriktion), **Bug gefunden + behoben** während Implementierung: `revoke execute` + `search_path` fixiert. Supabase Security-Advisor: 0 Warnings nach Fix
- **Idempotenz:** Migration zweimal angewendet (zweites Mal nur Teilmenge) → kein Fehler, `create table/index if not exists` greift korrekt

### Bugs Found
Keine offenen Bugs. (1 Bug während Implementierung gefunden und sofort gefixt — siehe Security Audit oben.)

### Production-Ready: **YES**

## Deployment

**Date:** 2026-06-19
**Production URL:** https://bambi-w26q.vercel.app
**Vercel Project:** bambi-w26q
**Verification:** `curl` → 200, env vars (`NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`) added to Vercel production env, Supabase migration already live on project `srxatexcffjebolqttaq`

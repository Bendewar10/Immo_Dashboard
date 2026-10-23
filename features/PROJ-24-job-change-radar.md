# PROJ-24: Job-Change-Radar (monatliche Wechsel-Erkennung via LinkedIn)

## Status: Deployed
**Created:** 2026-07-02
**Last Updated:** 2026-07-02

## Dependencies
- Requires: PROJ-20 (LinkedIn-Enrichment) — Apify-Profilscrape, Monats-Cron-Muster, `linkedin_profile`-Snapshot
- Requires: PROJ-10 (LinkedIn-CSV-Import) — `contact_events`-Tabelle (Jobwechsel/Beförderung) + Erkennungs-Semantik
- Requires: PROJ-6 (Follow-up Dashboard) — bestehende Event-Karte (Anzeige, Dismiss, Interaktion loggen)
- Requires: PROJ-22 (Firmen-Ansicht) — Normalisierungs-Reset bei employer-Update
- Requires: PROJ-3 (Kontakte) — `linkedin_url`, `employer`, `job_title`

## Summary
Client-Kontakte verpuffen nach Projektende — und der beste Reaktivierungs-Anlass ist ein Jobwechsel („Gratuliere zur neuen Rolle!"). Der Job-Change-Radar prüft einmal im Monat automatisch LinkedIn-Profile der Kontakte (Apify, gedeckeltes rotierendes Budget) und vergleicht Arbeitgeber/Jobtitel mit dem Datenbestand. Bei Abweichung: Kontaktdaten werden aktualisiert (inkl. Firmen-Normalisierungs-Reset) und ein Anlass-Event (Jobwechsel/Beförderung) erscheint in der bestehenden Dashboard-Sektion — mit Dismiss und „Interaktion loggen" wie bei Import-Events. Kein neues UI, nur ein neuer Erkennungspfad.

## User Stories
- Als Berater möchte ich automatisch erfahren, wenn ein Kontakt die Firma wechselt, damit ich mit einem Glückwunsch nachfassen kann, ohne LinkedIn zu durchforsten.
- Als Berater möchte ich auch Beförderungen (neuer Titel, gleiche Firma) als Anlass sehen, damit ich Karriere-Meilensteine meiner Kontakte nicht verpasse.
- Als Berater möchte ich, dass erkannte Wechsel meine Kontaktdaten automatisch aktualisieren, damit Firmen-Ansicht und Exit-Ziel-Abdeckung aktuell bleiben.
- Als Berater möchte ich Radar-Anlässe im Dashboard wegklicken oder direkt eine Interaktion loggen können, genau wie bei Import-Events.
- Als Berater möchte ich, dass die Scrape-Kosten planbar bleiben (monatliches Budget statt Komplett-Scan), damit das Feature dauerhaft bezahlbar ist.

## Out of Scope
- **Neues UI** — Anzeige läuft komplett über die bestehende Dashboard-Event-Sektion (PROJ-6/PROJ-10)
- **Echtzeit-/wöchentliche Erkennung** — monatlicher Rhythmus reicht, Wechsel sind keine Eilmeldungen
- **Weitere Event-Typen** (Standortwechsel, Jubiläen, neue Skills) — nur Jobwechsel + Beförderung
- **KI-Bulk-Nachrichten für alle Wechsel** — Nachrichtenvorschlag pro Kontakt existiert bereits im Dashboard (PROJ-6); Bulk gehört zu PROJ-13 (Rolloff-Wizard)
- **Review-Dialog vor Übernahme** — bewusst verworfen; Auto-Update + Event, CSV-Import behält seinen Review-Flow
- **Benachrichtigungen außerhalb der App** (E-Mail/Push) — Anlässe erscheinen im Dashboard; Monats-Report (PROJ-9) bleibt unverändert
- **Scrape von Kontakten ohne LinkedIn-URL** — keine Namenssuche, nur hinterlegte Profile

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Cron & Auswahl
- [ ] Angenommen der Monats-Cron läuft, wenn Kontakte mit LinkedIn-URL existieren, dann werden pro Lauf höchstens N Profile gescrapt (Budget-Deckel), sortiert nach ältestem Profil-Stand (nie gescrapte zuerst)
- [ ] Angenommen ein Kontakt hat keine LinkedIn-URL, wenn der Cron läuft, dann wird er nie gescrapt
- [ ] Angenommen der Cron wird außerhalb des Monatsanfangs oder ohne gültiges Secret aufgerufen, dann läuft keine Erkennung (gleiche Schutzlogik wie Foto-Cron PROJ-20)
- [ ] Angenommen der Scrape eines einzelnen Profils schlägt fehl, wenn der Lauf weiterläuft, dann werden die übrigen Profile normal verarbeitet (kein Abbruch des Gesamtlaufs)

### Erkennung & Datenpflege
- [ ] Angenommen das gescrapte Profil zeigt einen anderen Arbeitgeber als der Kontakt (und der Kontakt hatte bereits einen Arbeitgeber), wenn der Vergleich läuft, dann wird ein „Jobwechsel"-Event erzeugt und employer/job_title am Kontakt aktualisiert (inkl. Normalisierungs-Reset, PROJ-22)
- [ ] Angenommen das gescrapte Profil zeigt gleichen Arbeitgeber, aber anderen Jobtitel (und der Kontakt hatte bereits einen Titel), wenn der Vergleich läuft, dann wird ein „Beförderung"-Event erzeugt und der Jobtitel aktualisiert
- [ ] Angenommen der Kontakt hatte noch keinen Arbeitgeber/Titel (leeres Feld), wenn der Scrape einen liefert, dann wird das Feld befüllt, aber KEIN Event erzeugt (Erstbefüllung ist kein Wechsel — Semantik wie CSV-Import)
- [ ] Angenommen Profil und Kontaktdaten stimmen überein, wenn der Vergleich läuft, dann passiert nichts (kein Event, kein Update)
- [ ] Angenommen für einen Kontakt existiert bereits ein offenes (nicht dismisstes) Event gleichen Typs, wenn derselbe Wechsel erneut erkannt wird, dann wird kein Duplikat-Event erzeugt
- [ ] Angenommen der Scrape liefert kein verwertbares Arbeitgeber-Feld (leeres/unvollständiges Profil), wenn der Vergleich läuft, dann bleiben die Kontaktdaten unangetastet (kein Löschen vorhandener Werte)

### Dashboard-Anzeige (bestehende Sektion)
- [ ] Angenommen der Radar hat Events erzeugt, wenn der Nutzer das Dashboard öffnet, dann erscheinen sie in der bestehenden Event-Sektion mit Kontaktname und Event-Typ
- [ ] Angenommen ein Radar-Event wird angezeigt, wenn der Nutzer es dismisst oder eine Interaktion loggt, dann verhält es sich identisch zu Import-Events (bestehende Funktionalität)

## Edge Cases
- **Apify-Ausfall/Timeout beim Gesamtlauf:** Lauf bricht kontrolliert ab, nächster Monat holt nach (Rotation nach Profil-Stand sorgt für Fairness); keine halben Updates
- **Kontakt wechselt zurück zur alten Firma** (Boomerang): normaler Jobwechsel — Event + Update
- **LinkedIn-Profil gelöscht/privat:** Scrape liefert nichts → Kontakt unangetastet, Profil-Stand-Zeitstempel trotzdem gesetzt (sonst blockiert er dauerhaft das Budget)
- **Mehrere Positionen im Profil** (z.B. Advisor + Hauptjob): aktuelle Hauptposition zählt (gleiche Logik wie PROJ-20-Enrichment)
- **Nutzer editiert Kontakt manuell zwischen Scrape und Vergleich:** letzter Schreiber gewinnt — Single-User-App, Konfliktfenster praktisch irrelevant
- **Scrape-Ergebnis nur Schreibvariante** („McKinsey" vs „McKinsey & Company"): führt zu Jobwechsel-Event, obwohl kein echter Wechsel — akzeptiertes False-Positive im MVP, Dismiss ist ein Klick (siehe Open Questions)

## Technical Requirements (optional)
- Security: Cron Secret-geschützt (wie PROJ-20); keine neuen öffentlichen Endpunkte; RLS auf `contact_events` unverändert
- Kosten: Budget-Deckel pro Lauf (Größe in /architecture festlegen); Wiederverwendung des Profil-Snapshots (`linkedin_profile`) statt Doppel-Scrape mit Foto-Cron wo möglich
- Performance: Lauf innerhalb Vercel-Funktions-Timeout (maxDuration wie Foto-Cron)

## Open Questions
- [x] False-Positives durch Schreibvarianten → **entschieden (/architecture):** MVP akzeptiert sie (Dismiss = 1 Klick); KI-Vergleich im Cron wäre unverhältnismäßig, nachrüstbar

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Gedeckeltes rotierendes Scrape-Budget statt Komplett-Scan oder Tier-Filter | Planbare Kosten; über 3–4 Monate volle Abdeckung; lockere Kontakte (interessante Wechsel!) bleiben beobachtet | 2026-07-02 |
| Event + Auto-Update der Felder (kein Review-Dialog) | Radar soll Datenbestand frisch halten (Firmen-Ansicht, Exit-Ziele); monatlicher Review-Aufwand widerspricht Zeitknappheit | 2026-07-02 |
| Erstbefüllung leerer Felder erzeugt kein Event | Kein Wechsel, nur Datenlücke geschlossen — Semantik konsistent mit CSV-Import (PROJ-10) | 2026-07-02 |
| Wiederverwendung der Dashboard-Event-Sektion, kein neues UI | contact_events + Karte (Dismiss, Interaktion loggen) existieren komplett; Radar ist nur neuer Erkennungspfad | 2026-07-02 |
| Nur Jobwechsel + Beförderung als Event-Typen | Bestehende DB-Typen; weitere Anlässe später bei Bedarf | 2026-07-02 |
| Monatlicher Rhythmus (kein wöchentlich/Echtzeit) | Wechsel sind keine Eilmeldungen; Kosten und Cron-Infra (PROJ-20) sprechen für monatlich | 2026-07-02 |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|----------|-----------|------|
| Eigener Cron `/api/cron/job-change-radar` am 2. des Monats | Entzerrt Foto-Cron (1.); gleiche Secret-/Datums-Schutzlogik, ?force=1 für Tests | 2026-07-02 |
| Budget 100 Profile pro Lauf, Rotation nach `linkedin_profile_at` (nulls zuerst) | Bewährter Deckel aus PROJ-20; volle Abdeckung in ~4 Monaten; nie gescrapte priorisiert | 2026-07-02 |
| Snapshot (`linkedin_profile` + `_at`) wird bei jedem Radar-Scrape aktualisiert, auch bei leerem Profil | Doppelnutzen für KI-Features; leere Profile blockieren Budget nicht dauerhaft | 2026-07-02 |
| Erkennung als pure Funktion in eigener Lib | Testbarkeit; Semantik-Parität mit CSV-Import-Diff (PROJ-10) | 2026-07-02 |
| Kein KI-Vergleich gegen Schreibvarianten vor Event-Erzeugung (MVP) | Zweiter KI-Pfad im Cron unverhältnismäßig; Dismiss = 1 Klick; nachrüstbar | 2026-07-02 |
| Keine neue Tabelle, kein neues UI | contact_events + Dashboard-Karte decken alles ab | 2026-07-02 |

---
<!-- Sections below are added by subsequent skills -->

## Implementation Notes

### Frontend (2026-07-02)
- Kein Code nötig — verifiziert: Dashboard-Sektion „Kürzlich erkannt" ([dashboard/page.tsx](../src/app/(app)/dashboard/page.tsx)) rendert alle offenen `contact_events` typunabhängig; `ImportEventCard` bietet bereits KI-Nachrichtenvorschlag (draft-message mit occasionType Jobwechsel/Beförderung), Ton-Anpassung, Copy, Dismiss und Interaktion loggen. Radar-Events erscheinen dort ohne Änderung.

### Backend (2026-07-02)
- `src/lib/job-change-radar.ts` (neu): pure `detectJobChange` (Jobwechsel/Beförderung/Erstbefüllung/No-op, Vergleich case-insensitive+getrimmt gegen Pseudo-Wechsel, Normalisierungs-Reset PROJ-22 bei employer-Änderung); `buildProfileLookup`/`findProfileItem` (Item-Zuordnung wie Foto-Enrichment); Orchestrator `runJobChangeRadar` (Budget 100, Rotation nach `linkedin_profile_at` nulls-first, Bulk-Scrape in 50er-Chunks, Duplikat-Schutz gegen offene Events, Snapshot-Update auch bei leerem Profil, Batch-Fehler ohne Zeitstempel → fairer Retry nächsten Monat)
- `src/app/api/cron/job-change-radar/route.ts` (neu): Secret-geschützt, läuft am 2. des Monats (?force=1 für Tests), pro Nutzer isolierte Fehler — Spiegel des Foto-Crons
- `vercel.json`: dritter Cron-Eintrag (täglich 5:00 UTC, Datums-Check in Route)
- Keine Migration nötig (contact_events + Snapshot-Spalten existieren)
- 17 neue Tests: 9 detectJobChange/Lookup-Units + 8 Cron-Route (401/503, Datums-Skip, force, Multi-User, Fehler-Isolation, 500)

## Tech Design (Solution Architect)
**Designed:** 2026-07-02

### Überblick
Kein neues UI, keine neue Tabelle. Ein neuer monatlicher Cron-Job (Muster identisch zum Foto-Cron PROJ-20) plus eine Erkennungs-Bibliothek. Anzeige, Dismiss und „Interaktion loggen" laufen unverändert über die bestehende Dashboard-Event-Sektion.

### Bausteine
```
Monats-Cron „Job-Change-Radar" (neu, Secret-geschützt, läuft am 2. des Monats)
+-- wählt pro Nutzer bis zu 100 Kontakte mit LinkedIn-URL
|   (ältester Profil-Stand zuerst, nie gescrapte ganz vorn → Rotation)
+-- scrapt Profile gebündelt über den bestehenden Apify-Actor (PROJ-20)
+-- Erkennungs-Logik (neu, pure Funktion — gut testbar):
|   +-- anderer Arbeitgeber + alter vorhanden → „Jobwechsel"-Event + Update employer/job_title (+ Normalisierungs-Reset PROJ-22)
|   +-- gleicher Arbeitgeber, anderer Titel + alter vorhanden → „Beförderung"-Event + Update job_title
|   +-- leeres Feld beim Kontakt → nur befüllen, kein Event
|   +-- Scrape ohne Arbeitgeber-Info → Kontakt unangetastet
|   +-- offenes Event gleichen Typs vorhanden → kein Duplikat
+-- speichert frischen Profil-Snapshot + Zeitstempel (auch bei leerem Profil → blockiert Budget nicht erneut)

Dashboard (bestehend, unverändert)
+-- Event-Sektion zeigt Radar-Events wie Import-Events (Dismiss, Interaktion loggen)
```

### Data Model
Nichts Neues. Wiederverwendet: `contact_events` (Jobwechsel/Beförderung), `linkedin_profile` + `linkedin_profile_at` am Kontakt (Profil-Stand = Rotations-Kriterium), employer/job_title inkl. Normalisierungs-Felder (PROJ-22).

### Tech Decisions (PM-Begründung)
- **Eigener Cron am 2. des Monats (Foto-Cron läuft am 1.):** entzerrt Apify-Last und Vercel-Laufzeit; gleiche Schutzlogik (Secret, Datums-Check, ?force=1 für Tests)
- **Budget 100 Profile/Lauf:** gleicher bewährter Deckel wie Foto-Enrichment (MAX_PER_RUN); ~400 Kontakte = volle Rotation in ~4 Monaten
- **Snapshot-Doppelnutzen:** Radar aktualisiert den Profil-Snapshot, den auch KI-Analyse/Gemeinsamkeiten (PROJ-17/20) nutzen — ein Scrape, zwei Verwendungen; der 90-Tage-Cooldown des On-Demand-Enrichments greift dann seltener
- **Erkennung als pure Funktion:** Diff-Logik (Wechsel/Beförderung/Erstbefüllung) ist isoliert testbar, gleiche Semantik wie CSV-Import (PROJ-10)
- **False-Positives durch Schreibvarianten im MVP akzeptiert:** KI-Vergleich vor Event-Erzeugung wäre ein zweiter KI-Pfad im Cron — nicht „günstig mitnehmbar"; Dismiss kostet einen Klick. Nachrüstbar, wenn es in der Praxis nervt
- **Hauptposition zählt:** gleiche Snapshot-Extraktion wie PROJ-20 (erste aktuelle Position)

### Dependencies (Pakete)
Keine neuen — Apify-Actor, Admin-Client, Cron-Muster existieren.

## QA Test Results

### Lauf 1 — 2026-07-02

**Automatisierte Tests:** Vitest 240/240 grün (17 neue: 9 Erkennungs-/Lookup-Units, 8 Cron-Route). Lint + Build sauber, Route registriert.

**Akzeptanzkriterien:**
- Cron-Schutz (Secret, Datums-Check, force, Fehler-Isolation pro Nutzer): ✅ Integrationstests
- Erkennung (Jobwechsel, Beförderung, Erstbefüllung ohne Event, No-op, leeres Profil, Pseudo-Wechsel durch Schreibvarianten case-insensitive abgefangen, Normalisierungs-Reset): ✅ Unit-Tests
- Budget/Rotation (100er-Deckel, nulls-first, Zeitstempel bei leerem Profil, Batch-Fehler ohne Zeitstempel): ✅ per Code-Review + Unit-Logik verifiziert
- Duplikat-Schutz gegen offene Events: ✅ Unit/Orchestrator-Logik
- Dashboard-Anzeige: ✅ via bestehender PROJ-6-E2E-Suite (39 Tests grün) — Radar erzeugt identische contact_events-Zeilen; bewusst keine eigene E2E gegen echten Apify (Kosten/Flakiness), Scrape-Pfad ist der produktionserprobte PROJ-20-Actor

**Regression:** PROJ-6 (Dashboard/Events) grün; PROJ-10 (CSV-Import inkl. Event-Erzeugung + MED-1-Reset-Pfad) 9/9 grün — dafür Test-Wartung nötig: Seed nutzte seit Kategorie-Remap ungültiges `category: 'friend'` (Insert scheiterte still) + veraltete Label-Assertions (`Kategorie`/`Freund` → `Kontakttyp`/`Privat`). Pre-existing Test-Debt, kein PROJ-24-Effekt; PROJ-3/PROJ-5-Stale-Tests als Chore erledigt (2026-07-03, siehe PROJ-22-QA).

**Security-Audit:**
- Cron nur mit `CRON_SECRET`-Bearer (401 sonst), kein öffentlicher Endpunkt, keine Nutzereingaben ✅
- Schreibzugriffe über Admin-Client nur auf fixe Spalten; Event-Typ fest (DB-Check-Constraint als zweite Linie) ✅
- LinkedIn-Snapshot als KI-Kontext ist bestehende PROJ-20-Fläche, unverändert ✅

**Bugs:** keine im Feature. **Deploy-Risiko notiert:** vercel.json hat jetzt 3 Cron-Einträge — falls Vercel-Plan (Hobby) nur 2 erlaubt, schlägt Deploy fehl → beim /deploy prüfen, ggf. Crons konsolidieren.

**Production-Ready: JA** (Verifikation des echten Apify-Laufs bewusst auf kontrollierten `?force=1`-Smoke nach Deploy verschoben — Kostenentscheidung)

## Deployment

**Production URL:** https://bambi-w26q.vercel.app (Cron: /api/cron/job-change-radar)
**Deployed:** 2026-07-02 (Vercel Auto-Deploy, Build 57s, Status Ready)
**Tag:** v1.21.0-PROJ-24

- Alle 3 Crons registriert (`vercel crons ls` verifiziert) — kein Plan-Limit-Problem, QA-Risiko entfällt
- Endpoint ohne Secret: 401 ✅
- **Echter Produktionslauf verifiziert** (Aufruf mit Secret am 2.7. = Monatslauf-Tag): 100 Profile gescrapt (Budget-Deckel griff), 0 Events, 0 Updates, 0 Fehler über 3 Nutzer (~0,40 $ Apify-Kosten). Nächster automatischer Lauf: 2.8.
- Keine neuen Env-Vars, keine Migration

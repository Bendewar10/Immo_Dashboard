# PROJ-22: Firmen-Ansicht (Firmen-Drilldown mit KI-Normalisierung)

## Status: Deployed
**Created:** 2026-07-02
**Last Updated:** 2026-07-02

## Dependencies
- Requires: PROJ-3 (Kontakt anlegen & verwalten) — `employer`-Feld am Kontakt
- Requires: PROJ-4 (Kontaktliste & Filter) — Drilldown erweitert die bestehende Kontaktliste
- Requires: PROJ-5 (Interaktions-Log) — Interaktions-Historie für Firmen-Aggregation
- Nice-to-have: PROJ-10 (LinkedIn-CSV-Import) — Hauptquelle für `employer`-Daten

## Summary
Berater denken in Accounts, nicht in Einzelkontakten. Die Firmen-Ansicht bündelt alle Kontakte einer Firma per Drilldown auf der bestehenden Kontaktliste: Klick auf einen Firmennamen (oder Auswahl im Firmen-Dropdown) filtert die Liste auf diese Firma und zeigt darüber eine Firmen-Header-Karte mit Aggregation (Anzahl Kontakte, letzter Touchpoint, letzte Interaktionen). Da `employer` Freitext ist ("McKinsey" vs. "McKinsey & Company"), normalisiert eine KI die Firmennamen automatisch; der Nutzer kann die Zuordnung pro Kontakt manuell korrigieren.

## User Stories
- Als Berater möchte ich auf den Firmennamen eines Kontakts klicken, um sofort alle meine Kontakte bei dieser Firma zu sehen, damit ich in Accounts statt Einzelpersonen denken kann.
- Als Berater möchte ich in der Filterleiste eine Firma aus einer Liste auswählen (mit Kontakt-Anzahl), damit ich auch Firmen erreiche, deren Kontakte gerade nicht sichtbar sind.
- Als Berater möchte ich pro Firma den letzten Touchpoint und die letzten Interaktionen über alle Kontakte hinweg sehen, damit ich erkenne, ob eine Client-Beziehung einschläft.
- Als Berater möchte ich, dass Schreibweisen-Varianten ("McKinsey", "McKinsey & Company") automatisch als eine Firma erscheinen, damit die Ansicht ohne manuelle Datenpflege brauchbar ist.
- Als Berater möchte ich eine falsche KI-Gruppierung am Kontakt manuell korrigieren können, damit Fehlzuordnungen nicht dauerhaft bestehen bleiben.

## Out of Scope
- **Eigene Firmen-Seite / Sidebar-Bereich** — bewusst verworfen; Drilldown auf Kontaktliste reicht (siehe Product Decisions)
- **Firmen-Entität mit eigenen Metadaten** (Notizen, Branche, Logo pro Firma) — keine `companies`-Tabelle in diesem Feature; bei Bedarf später
- **Follow-up-Aggregation in der Header-Karte** (überfällige Kontakte pro Firma) — verworfen im Interview
- **Projekt-Verknüpfung in der Header-Karte** (Cases mit Firmen-Kontakten, PROJ-12) — verworfen im Interview
- **Batch-Review-Dialog für KI-Gruppierungen** — Korrektur erfolgt einzeln am Kontakt
- **Firmen-Hierarchien** (Mutter-/Tochterfirmen, z.B. "Google" vs. "Google DeepMind") — KI behandelt sie nach eigenem Ermessen als eine oder getrennte Firmen, keine explizite Modellierung
- **Exit-Ziel-Markierung von Firmen** — eigenes Feature (PROJ-23, Exit-Ziel-Tracker), baut auf dieser Normalisierung auf

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Drilldown & Einstieg
- [ ] Angenommen ein Kontakt hat einen Firmennamen, wenn der Nutzer in der Kontaktliste auf den Firmennamen klickt, dann wird die Liste auf alle Kontakte dieser (normalisierten) Firma gefiltert und die Firmen-Header-Karte erscheint
- [ ] Angenommen die Filterleiste ist sichtbar, wenn der Nutzer das Firmen-Dropdown öffnet, dann sieht er alle normalisierten Firmen mit Kontakt-Anzahl (z.B. "McKinsey & Company (12)"), sortiert nach Kontakt-Anzahl absteigend
- [ ] Angenommen der Firmen-Filter ist aktiv, wenn der Nutzer den Filter zurücksetzt (X auf Karte oder Dropdown leeren), dann zeigt die Liste wieder alle Kontakte und die Header-Karte verschwindet
- [ ] Angenommen der Firmen-Filter ist aktiv, wenn der Nutzer zusätzlich andere Filter (Kategorie, Stärke, Suche) setzt, dann kombinieren sich die Filter wie gewohnt (UND-Verknüpfung)

### Firmen-Header-Karte
- [ ] Angenommen eine Firma ist ausgewählt, wenn die Header-Karte erscheint, dann zeigt sie: normalisierten Firmennamen, Anzahl Kontakte, letzten Touchpoint (jüngste Interaktion über alle Kontakte der Firma)
- [ ] Angenommen eine Firma ist ausgewählt, wenn die Header-Karte erscheint, dann zeigt sie die letzten 3–5 Interaktionen über alle Firmen-Kontakte hinweg als Mini-Timeline (Kontaktname, Kanal, Datum)
- [ ] Angenommen keine Interaktion existiert für Kontakte der Firma, wenn die Header-Karte erscheint, dann zeigt sie "Noch keine Interaktionen" statt der Timeline und keinen letzten Touchpoint

### KI-Normalisierung
- [ ] Angenommen mehrere Kontakte haben Schreibweisen-Varianten derselben Firma (z.B. "McKinsey", "McKinsey & Company"), wenn die Normalisierung gelaufen ist, dann erscheinen sie unter einem gemeinsamen Firmennamen im Dropdown und Drilldown
- [ ] Angenommen ein neuer Kontakt mit Firmenname wird angelegt oder per CSV importiert, wenn der Vorgang abgeschlossen ist, dann wird sein Firmenname automatisch normalisiert (ohne Nutzeraktion)
- [ ] Angenommen die KI-Normalisierung schlägt fehl oder ist nicht verfügbar, wenn Kontakte angezeigt werden, dann wird der rohe `employer`-Wert als Firmenname verwendet (Fallback, kein Fehler für den Nutzer)
- [ ] Angenommen der Nutzer hat den normalisierten Firmennamen eines Kontakts manuell korrigiert, wenn eine spätere KI-Normalisierung läuft, dann bleibt der manuelle Wert unangetastet
- [ ] Angenommen ein Kontakt ist falsch gruppiert, wenn der Nutzer den normalisierten Firmennamen am Kontakt bearbeitet, dann wandert der Kontakt sofort in die korrigierte Firmen-Gruppe

### Empty States & Randfälle
- [ ] Angenommen ein Kontakt hat keinen Firmennamen (`employer` leer), wenn die Kontaktliste angezeigt wird, dann ist bei ihm nichts klickbar und er erscheint in keiner Firmen-Gruppe
- [ ] Angenommen kein einziger Kontakt hat einen Firmennamen, wenn der Nutzer das Firmen-Dropdown öffnet, dann zeigt es einen Empty State ("Keine Firmen — Firmennamen bei Kontakten pflegen")
- [ ] Angenommen eine Firma hat genau einen Kontakt, wenn der Nutzer den Drilldown öffnet, dann funktioniert die Ansicht identisch (Header-Karte + Liste mit einem Eintrag)

## Edge Cases
- **Kontakt ohne `employer`:** kein Klick-Target, taucht in keiner Gruppe auf; Dropdown zählt ihn nirgends mit
- **KI fasst fälschlich zwei verschiedene Firmen zusammen:** Nutzer korrigiert am Kontakt; manueller Wert ist dauerhaft geschützt vor erneuter KI-Überschreibung
- **KI-Ausfall (API-Fehler, Timeout):** Fallback auf rohen `employer`-String, Normalisierung wird beim nächsten Lauf nachgeholt; Nutzer sieht keinen Fehler
- **Nutzer ändert `employer` eines Kontakts:** Normalisierung läuft für diesen Kontakt erneut (außer manuelle Korrektur der Zuordnung existiert — dann Frage an Nutzer via erneuter Normalisierung nur des Rohwerts; siehe Open Questions)
- **CSV-Import mit vielen neuen Firmen auf einmal:** Normalisierung läuft im Batch, Liste ist sofort nutzbar (mit Roh-Strings), Gruppierung verfeinert sich nach dem Lauf
- **Sehr lange Firmennamen / Sonderzeichen:** Header-Karte und Dropdown truncaten sauber (Ellipsis), Filter funktioniert trotzdem
- **Zwei echte Firmen mit ähnlichem Namen (z.B. "Bain & Company" vs. "Bain Capital"):** dürfen NICHT zusammengefasst werden — Qualitätsanforderung an KI-Prompt, Korrektur-Fallback existiert

## Technical Requirements (optional)
- Security: Authentifizierung erforderlich; RLS — Nutzer sieht nur eigene Kontakte/Firmen
- Performance: Drilldown/Filter clientseitig ohne spürbare Verzögerung (bestehende Filterlogik); Normalisierung asynchron, blockiert keine Nutzeraktion
- KI-Kosten: Normalisierung nur bei neuen/geänderten Firmennamen, nicht bei jedem Seitenaufruf

## Open Questions
- [x] Wenn Nutzer den rohen `employer` eines Kontakts ändert, der bereits eine manuelle Firmen-Korrektur hat → **entschieden (/architecture):** neu normalisieren, neuer Arbeitgeber = neue Faktenlage
- [x] Anzeige in der Kontaktliste: roh oder normalisiert → **entschieden (/architecture):** normalisierter Name mit Fallback auf Rohwert; Rohwert bleibt im Bearbeiten-Dialog

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Gruppierung per KI-Normalisierung statt exaktem String-Match oder eigener Firmen-Entität | Freitext-`employer` ist dreckig (Schreibweisen-Varianten); Firmen-Tabelle wäre Overkill für Single-User-App | 2026-07-02 |
| Kein eigener Sidebar-Bereich — Drilldown auf bestehender Kontaktliste | Weniger Navigation, Kontaktliste bleibt der eine Ort für Kontakte; Aggregation kommt per Header-Karte | 2026-07-02 |
| Firmen-Header-Karte über gefilterter Liste (Name, #Kontakte, letzter Touchpoint, letzte 3–5 Interaktionen) | Firmen-Historie war Kern des Feature-Pitches; Karte liefert sie ohne eigene Seite | 2026-07-02 |
| Follow-up-Aggregation und Projekt-Verknüpfung NICHT in Header-Karte | Bewusst schlank gehalten; Follow-ups leben im Dashboard (PROJ-6) | 2026-07-02 |
| KI-Korrektur einzeln am Kontakt, manuelle Werte für KI tabu | Einfachster Korrektur-Flow; Batch-Review-Dialog wäre zusätzlicher Workflow-Schritt bei jedem Lauf | 2026-07-02 |
| Zwei Einstiege: klickbarer Firmenname + Firmen-Dropdown in Filterleiste | Klick = schnellster Weg im Kontext; Dropdown = Erreichbarkeit aller Firmen inkl. Kontakt-Anzahl | 2026-07-02 |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|----------|-----------|------|
| Normalisierte Firma als Spalten am Kontakt statt eigener companies-Tabelle | Kein Migrations-/Pflege-Overhead; reicht für Gruppierung, PROJ-23 kann aufsetzen | 2026-07-02 |
| Batch-Normalisierung in einem KI-Aufruf (nur unnormalisierte Namen) | Kostenkontrolle + konsistente Gruppierung; einzeln pro Kontakt wäre teuer/langsam | 2026-07-02 |
| Claude Haiku für Normalisierung | Einfaches Namens-Mapping; gleiche Modellwahl wie Monats-Report (report-ai) | 2026-07-02 |
| Quelle-Feld ("KI"/"manuell") schützt manuelle Korrekturen | KI überspringt manuell gesetzte Werte dauerhaft | 2026-07-02 |
| employer-Änderung setzt manuelle Korrektur zurück und normalisiert neu | Neuer Arbeitgeber = neue Faktenlage | 2026-07-02 |
| Firmen-Gruppierung/Dropdown clientseitig aus geladener Kontaktliste | Liste lädt ohnehin alle Kontakte; kein neuer Lese-Endpunkt, sofortige Filter-Reaktion | 2026-07-02 |
| Kein Cron — Trigger nur bei Datenänderung (Anlage/Edit/Import) | Nichts zu tun, wenn sich nichts ändert; spart KI-Kosten | 2026-07-02 |

---
<!-- Sections below are added by subsequent skills -->

## Implementation Notes

### Frontend (2026-07-02)
- `src/lib/contacts.ts`: Contact-Typ um `employer_normalized`, `employer_normalized_source`, `employer_normalized_at` erweitert (optional, wie `commonalities`); Helper `getCompanyName()` = normalisiert mit Fallback auf roh
- `src/components/company-filter-combobox.tsx` (neu): Firmen-Dropdown (Popover+Command), sortiert nach Kontakt-Anzahl, Empty State
- `src/components/company-header-card.tsx` (neu): Firmenname, #Kontakte, letzter Touchpoint, letzte 5 Interaktionen (eine Supabase-Query, limitiert), X zum Aufheben
- `src/components/contact-card.tsx`: Firmenname klickbar (`onCompanyClick`), zeigt normalisierten Namen
- `src/components/contact-list.tsx`: `companyFilter`-State (UND-verknüpft mit übrigen Filtern), Header-Karte bei aktivem Filter, Normalisierungs-Trigger (fire-and-forget `POST /api/normalize-employers`) nach Speichern/Import
- `src/components/contact-form-dialog.tsx`: Feld "Firma (normalisiert)" (nur Edit-Modus); manuelle Änderung → source `manual`; employer-Änderung → Normalisierung zurückgesetzt (KI holt nach)
- Hinweis: UI erst nach Backend-Migration (neue Spalten) voll funktionsfähig — Kontakt-Speichern mit geändertem Arbeitgeber schreibt die neuen Spalten

### Backend (2026-07-02)
- Migration `0011_employer_normalization.sql` (angewendet auf Produktion): `employer_normalized`, `employer_normalized_source` (check: ai/manual), `employer_normalized_at` an `contacts`; partieller Index für Pending-Lookup. RLS unverändert aktiv (Owner-only auf contacts)
- `POST /api/normalize-employers` (neu): Auth-Check → lädt employer/employer_normalized des Nutzers → sammelt unnormalisierte Rohnamen (max. 150 pro Lauf, Kosten-Deckel) → EIN `generateObject`-Aufruf (Haiku, Zod-Schema) mit bekannten kanonischen Namen als Kontext → Updates gebündelt pro kanonischem Namen, nur wo `employer_normalized IS NULL` (manuelle Korrekturen unantastbar)
- Absicherung KI-Antwort: halluzinierte Rohnamen verworfen, fehlende Rohnamen identisch gemappt (kein Dauer-Pending); Fehler → 502, Nutzer sieht weiter Roh-Fallback
- 9 Integrationstests (`normalize-employers.test.ts`): 401, 500 (Load/Save), 0-Pending ohne KI-Aufruf, Gruppierung, Prompt-Inhalt, Identity-Fallback, Halluzinations-Filter, 502

## Tech Design (Solution Architect)
**Designed:** 2026-07-02

### Überblick
Kein neuer Seitenbereich, keine neue Tabelle. Zwei Bausteine:
1. **Normalisierung (Backend):** Neue Spalten am Kontakt speichern den KI-normalisierten Firmennamen. Ein Batch-Endpunkt normalisiert alle noch unbearbeiteten Firmennamen in einem Rutsch.
2. **Drilldown (Frontend):** Die bestehende Kontaktliste bekommt einen Firmen-Filter (Dropdown + klickbarer Firmenname) und eine Firmen-Header-Karte mit Aggregation.

### Component Structure
```
Kontakte-Seite (bestehend)
+-- Filterleiste (bestehend, erweitert)
|   +-- Firmen-Dropdown (neu: Combobox mit Suche, "Firma (Anzahl)", sortiert nach Anzahl)
+-- Firmen-Header-Karte (neu, nur bei aktivem Firmen-Filter)
|   +-- Firmenname + Anzahl Kontakte + letzter Touchpoint
|   +-- Mini-Timeline: letzte 3-5 Interaktionen (Kontaktname, Kanal, Datum)
|   +-- X-Button (Filter aufheben)
+-- Kontaktliste (bestehend, erweitert)
|   +-- Kontaktkarte: Firmenname wird klickbar (setzt Firmen-Filter)
+-- Kontakt-Dialog (bestehend, erweitert)
    +-- Feld "Firma (normalisiert)" — manuelle Korrektur der Gruppierung
```

### Data Model (Klartext)
Drei neue Felder am bestehenden Kontakt (keine neue Tabelle):
- **Normalisierter Firmenname** — der kanonische Name, unter dem der Kontakt gruppiert wird (z.B. "McKinsey & Company")
- **Quelle der Normalisierung** — "KI" oder "manuell"; manuelle Werte werden von der KI nie überschrieben
- **Zeitstempel der Normalisierung** — wann zuletzt normalisiert

Anzeige-Regel überall: normalisierter Name, falls vorhanden — sonst roher Firmenname (Fallback, deckt KI-Ausfall ab).

### Ablauf Normalisierung
1. Auslöser: Kontakt angelegt/geändert, CSV-Import abgeschlossen — danach stößt die App im Hintergrund den Normalisierungs-Endpunkt an (blockiert nichts)
2. Der Endpunkt sammelt alle unterschiedlichen Firmennamen des Nutzers, die noch nicht normalisiert sind, und schickt sie zusammen mit den bereits bekannten kanonischen Namen in EINEM KI-Aufruf (Haiku — schnell, günstig, gleiche Wahl wie beim Monats-Report)
3. Die KI liefert pro Rohname den kanonischen Namen ("Bain & Company" ≠ "Bain Capital" bleibt getrennt — explizite Prompt-Anweisung)
4. Ergebnis wird pro Kontakt gespeichert; Kontakte mit manueller Korrektur werden übersprungen
5. Ändert der Nutzer den rohen Arbeitgeber eines Kontakts, wird neu normalisiert — auch wenn vorher manuell korrigiert wurde (neuer Arbeitgeber = neue Faktenlage)

### Firmen-Aggregation (Drilldown)
- Firmen-Dropdown und Gruppierung entstehen clientseitig aus der bereits geladenen Kontaktliste (406 Kontakte — problemlos im Browser)
- Letzter Touchpoint pro Firma: jüngstes Kontaktdatum über alle Firmen-Kontakte (Feld existiert bereits am Kontakt)
- Mini-Timeline: die letzten 3-5 Interaktionen der Firmen-Kontakte werden bei aktivem Filter nachgeladen (eine Abfrage, limitiert)

### Tech Decisions (PM-Begründung)
- **Spalten statt Firmen-Tabelle:** Eine eigene companies-Tabelle bräuchte Migrationen, Verknüpfungspflege und eigene UI — für Single-User-Gruppierung reicht ein normalisiertes Feld; PROJ-23 kann darauf aufbauen
- **Ein Batch-KI-Aufruf statt pro Kontakt:** 406 Kontakte einzeln = teuer und langsam; alle unbekannten Namen in einem Aufruf = Centbeträge, konsistente Gruppierung
- **Haiku statt Sonnet:** Namens-Mapping ist einfache Aufgabe, gleiche Modellwahl wie beim Monats-Report
- **Clientseitige Gruppierung:** Kontaktliste lädt ohnehin alle Kontakte; kein neuer Lese-Endpunkt nötig, Filter bleibt sofort reaktionsschnell
- **Kein Cron:** Normalisierung wird von Datenänderungen ausgelöst, nicht zeitgesteuert — nichts zu tun, wenn sich nichts ändert

### Dependencies (Pakete)
Keine neuen — `@ai-sdk/anthropic` (KI), shadcn Combobox/Command (Dropdown) und Card sind bereits im Projekt.

## QA Test Results

### Lauf 1 — 2026-07-02

**Automatisierte Tests:** Vitest 214/214 grün (davon 9 neue Integrationstests für `/api/normalize-employers`). Lint + Build sauber.

**E2E (Playwright, `tests/PROJ-22-firmen-ansicht.spec.ts`, 10 Tests):**
- 3 bestanden (Dropdown-Gruppierung mit Varianten-Zählung, Roh-Fallback, Kontakt ohne Firma)
- 7 blockiert durch Bug HIGH-1 (alle Tests, die den Klick auf den Firmennamen brauchen)

**Akzeptanzkriterien:** Dropdown-Einstieg, Gruppierung, Roh-Fallback, Empty States ✅ — Klick-Einstieg über Kontaktkarte ❌ (HIGH-1). KI-Normalisierungs-Kriterien über Integrationstests abgedeckt (Batch, manuelle Werte tabu, Identity-Fallback, 502-Fallback) ✅.

**Bugs:**

| ID | Severity | Beschreibung |
|----|----------|--------------|
| HIGH-1 | High | Klickbarer Firmenname auf Kontaktkarte ist `inline-block` in truncierter Zeile (`<p class="truncate">`): Passt der Button nicht vollständig in die Zeile (Normalfall: neben Avatar+Icons bleiben ~127px), ersetzt der Browser das gesamte Element durch „…" — Firmenname unsichtbar und unklickbar. Kern-Einstieg des Features funktioniert auf typischen Kartenbreiten nicht. Repro: Kontakt mit Jobtitel + längerem Firmennamen → Karte zeigt „Partner · …". |
| MED-1 | Medium | `employer`-Änderungen außerhalb des Kontakt-Dialogs (AI-Chat `update_contact_field`, CSV-Import-Änderungsübernahme) setzen `employer_normalized` nicht zurück → Kontakt bleibt unter alter Firma gruppiert. Workaround: Kontakt-Dialog öffnen und speichern. |
| LOW-1 | Low | `POST /api/normalize-employers` hat kein Rate-Limit; authentifizierter Nutzer kann KI-Aufrufe spammen (gedeckelt durch Early-Exit ohne Pending-Namen + 150er-Batch). |

**Security-Audit:**
- Auth: 401 ohne Session (getestet) ✅
- RLS: neue Spalten auf `contacts`, Owner-only-Policies greifen; Update-Query zusätzlich explizit auf `user_id` gefiltert ✅
- Injection: Firmennamen React-escaped gerendert; Supabase-Queries parametrisiert ✅
- Prompt-Injection über Firmennamen: KI-Antwort Zod-validiert, nur angefragte Rohnamen übernommen, halluzinierte Mappings verworfen ✅
- Keine Secrets im Client; KI-Aufruf serverseitig ✅

**Production-Ready: NEIN** — HIGH-1 muss gefixt werden, danach Re-QA der blockierten E2E-Tests.

### Lauf 2 — 2026-07-02 (nach Bugfixes)

**Fixes:**
- HIGH-1 ✅ Karten-Zeile als Flex-Container; Firmenname-Button truncated selbst (bleibt sichtbar + klickbar), Jobtitel max. 50% Breite, `title`-Tooltips für volle Namen
- MED-1 ✅ Gemeinsame Konstante `EMPLOYER_NORMALIZATION_RESET` (contacts.ts); alle drei employer-Schreibpfade resetten jetzt die Normalisierung: Chat-Direktschreiben (chat-server), Chat-Bestätigung (chat/confirm), CSV-Import-Änderungen (linkedin-import-dialog)
- LOW-1 ✅ In-Memory-Rate-Limit auf `/api/normalize-employers` (5/min pro Nutzer, 429; pro warmer Instanz — bewusst kein Redis für Single-User-App)

**Ergebnisse:**
- Vitest 215/215 grün (neu: 429-Rate-Limit-Test)
- E2E PROJ-22: **20/20 grün** (chromium + Mobile Safari, `--workers=1` wegen geteilter Seed-Daten zwischen Projekt-Workern)
- Regression E2E (PROJ-3/4/5/10/11, chromium): 37 grün, 2 Fehlschläge sind **veraltete Tests** (pre-existing, nicht PROJ-22): PROJ-3 AC2 erwartet Label „Kategorie"/Option „Freund" (seit Kategorie-Remap heißt es „Kontakttyp" mit neuen Werten), PROJ-5 erwartet „Verlauf" als Dropdown-Menüpunkt (seit Karten-Redesign eigener Icon-Button). → Test-Wartung als separates Chore empfohlen. **Erledigt 2026-07-03** (chore-Commit): Selektoren/Labels aktualisiert, Login-Retry gegen Auth-Rate-Limit nachgerüstet — beide Suiten 25/25 grün (chromium + Mobile Safari).
- E2E-Hinweise: PROJ-22-Suite läuft seriell; Login-Helper mit Retry gegen Supabase-Auth-Rate-Limit; „Manuelle Korrektur"-Test bewusst als letzter (echter KI-Lauf gruppiert QA-Präfix-Namen unvorhersehbar)

**Production-Ready: JA** — keine offenen Critical/High/Medium-Bugs.

## Deployment

**Production URL:** https://bambi-w26q.vercel.app
**Deployed:** 2026-07-02 (Vercel Auto-Deploy via Push auf main, Build 56s, Status Ready)
**Tag:** v1.19.0-PROJ-22

- Migration `0011_employer_normalization.sql` war bereits vor Deploy auf Produktions-DB angewendet (via Supabase MCP)
- Keine neuen Env-Vars nötig (`ANTHROPIC_API_KEY` existiert)
- Post-Deploy-Check: `/login` 200; `POST /api/normalize-employers` ohne Session → Redirect auf Login (Auth-Schutz greift)
- Bestehende Kontakte werden beim ersten Normalisierungs-Trigger (Kontakt speichern oder CSV-Import) in 150er-Batches normalisiert

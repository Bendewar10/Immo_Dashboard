# PROJ-23: Exit-Ziel-Tracker (Zielfirmen + Netzwerk-Abdeckung)

## Status: Deployed
**Created:** 2026-07-02
**Last Updated:** 2026-07-02

## Dependencies
- Requires: PROJ-22 (Firmen-Ansicht) — normalisierte Firmennamen für Autocomplete + Match, Firmen-Drilldown als Sprungziel
- Requires: PROJ-16 (Eigenes Profil/CV) — Tracker lebt auf der Profil-/Lebenslauf-Seite neben Career Goals
- Requires: PROJ-3 (Kontakte), PROJ-5 (Interaktions-Log) — Abdeckung + letzter Touchpoint
- Requires: PROJ-2 (Auth) — Owner-only

## Summary
Für Berater ist das Netzwerk Exit-Kapital. Der Exit-Ziel-Tracker macht sichtbar, wie gut das eigene Netzwerk die Wunsch-Arbeitgeber abdeckt: Der Nutzer pflegt eine schlanke Liste von Zielfirmen (PE, Industrie, Startups) auf der Profil-Seite neben den Career Goals. Pro Zielfirma zeigt eine Karte die Netzwerk-Abdeckung (Anzahl Kontakte + Stärke-Verteilung), den letzten Touchpoint und springt per Klick in den Firmen-Drilldown (PROJ-22). Firmen ohne Kontakte sind bewusst erfassbar — das ist der typische Exit-Fall, an dem Netzwerkaufbau ansetzen muss.

## User Stories
- Als Berater möchte ich Zielfirmen für meinen Exit erfassen (auch solche, bei denen ich noch niemanden kenne), damit meine Exit-Planung an einem Ort neben meinen Career Goals liegt.
- Als Berater möchte ich pro Zielfirma sehen, wie viele Kontakte ich dort habe und wie stark die Beziehungen sind, damit ich weiß, wo mein Netzwerk trägt und wo ich aufbauen muss.
- Als Berater möchte ich beim Anlegen Vorschläge aus meinen bekannten Firmen bekommen (normalisierte Namen), damit Zielfirma und Netzwerk sauber matchen.
- Als Berater möchte ich pro Zielfirma den letzten Touchpoint sehen, damit ich erkenne, ob der Draht dorthin warm oder kalt ist.
- Als Berater möchte ich von der Zielfirmen-Karte direkt zu meinen Kontakten dieser Firma springen, damit ich sofort ins Handeln komme (Follow-up, Nachricht).

## Out of Scope
- **Priorität/Status pro Ziel** (hoch/mittel/niedrig, aktiv/erreicht/verworfen) — bewusst verworfen, schlanke Liste; bei Bedarf später
- **Notiz pro Ziel** — verworfen im Interview
- **KI-Vorschläge für Zielfirmen aus Career Goals** (goals_text) — verworfen für MVP, möglicher späterer Ausbau
- **Warm-Intro-Finder** („Wer kann mich bei Firma X vorstellen?") — eigenes Feature (Roadmap-Idee), nicht Teil des Trackers
- **Automatische Anlage von Zielfirmen** (z.B. aus CV-Parsing) — nicht Teil des MVP
- **Job-/Stellen-Tracking pro Zielfirma** — kein Bewerbungs-Tracker, nur Netzwerk-Sicht
- **Alerts/Notifications** bei neuen Kontakten in Zielfirmen — später denkbar (z.B. mit Job-Change-Radar)

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Anlegen & Verwalten
- [ ] Angenommen der Nutzer ist auf der Profil-Seite, wenn er im Exit-Ziel-Eingabefeld tippt, dann erscheinen Autocomplete-Vorschläge aus seinen bekannten (normalisierten) Firmennamen mit Kontakt-Anzahl
- [ ] Angenommen der eingegebene Firmenname existiert nicht im Netzwerk, wenn der Nutzer bestätigt, dann wird die Firma als Freitext-Ziel angelegt (mit Hinweis „Keine Kontakte")
- [ ] Angenommen eine Zielfirma existiert bereits in der Liste, wenn der Nutzer dieselbe Firma erneut anlegt, dann wird ein Duplikat verhindert und ein Hinweis angezeigt
- [ ] Angenommen der Nutzer bestätigt ein leeres Eingabefeld, dann passiert nichts (keine leere Zielfirma möglich)
- [ ] Angenommen eine Zielfirma existiert, wenn der Nutzer auf Löschen klickt, dann wird sie nach Bestätigungsdialog entfernt
- [ ] Angenommen der Nutzer ist nicht eingeloggt bzw. ein fremder Nutzer, dann sind Zielfirmen weder sichtbar noch änderbar (Owner-only)

### Zielfirmen-Karte
- [ ] Angenommen eine Zielfirma hat Kontakte im Netzwerk (Match über Firmennamen der Kontakte), wenn die Karte angezeigt wird, dann zeigt sie Anzahl Kontakte und Stärke-Verteilung (Stark/Mittel/Locker)
- [ ] Angenommen eine Zielfirma hat Kontakte mit Interaktionen, wenn die Karte angezeigt wird, dann zeigt sie den letzten Touchpoint (jüngste Interaktion über alle Kontakte der Firma)
- [ ] Angenommen eine Zielfirma hat keine Kontakte, wenn die Karte angezeigt wird, dann zeigt sie „Keine Kontakte — Netzwerk aufbauen" statt Abdeckung und Touchpoint
- [ ] Angenommen eine Zielfirma hat Kontakte, wenn der Nutzer auf die Karte klickt, dann öffnet sich die Kontaktliste mit aktivem Firmen-Filter (PROJ-22-Drilldown) für diese Firma
- [ ] Angenommen eine Zielfirma hat keine Kontakte, wenn der Nutzer auf die Karte klickt, dann passiert kein Drilldown-Sprung (kein leerer Filter)
- [ ] Angenommen mehrere Zielfirmen existieren, wenn die Liste angezeigt wird, dann ist sie nach Netzwerk-Abdeckung sortiert (meiste Kontakte zuerst, Firmen ohne Kontakte zuletzt)

### Empty & Fehler
- [ ] Angenommen keine Zielfirma existiert, wenn die Sektion angezeigt wird, dann erscheint ein Empty State, der den Zweck erklärt („Zielfirmen für deinen Exit erfassen…")
- [ ] Angenommen das Speichern schlägt fehl (Netzwerk/API), wenn der Nutzer eine Zielfirma anlegt oder löscht, dann erscheint eine Fehlermeldung und die Liste bleibt konsistent (kein Phantom-Eintrag)

## Edge Cases
- **Zielfirma ohne Kontakte, später kommt ein Kontakt dazu:** Abdeckung aktualisiert sich beim nächsten Laden automatisch (Match über Firmennamen, kein manueller Sync)
- **Normalisierter Firmenname ändert sich** (KI-Lauf oder manuelle Korrektur in PROJ-22): Match läuft über den Namen — Ziel „McKinsey" matcht nicht mehr, wenn Kontakte auf „McKinsey & Company" umnormalisiert werden. Verhalten: Ziel zeigt dann 0 Kontakte; Nutzer legt Ziel mit korrektem Namen neu an (bewusst einfach gehalten, siehe Product Decisions)
- **Groß-/Kleinschreibung & Whitespace:** „mckinsey " und „McKinsey" gelten als dieselbe Zielfirma (Duplikat-Check case-insensitive, getrimmt)
- **Kontakt hat nur rohen employer (keine Normalisierung):** Match nutzt denselben Anzeigenamen wie PROJ-22 (normalisiert, sonst roh) — konsistent mit Drilldown
- **Sehr lange Firmennamen:** Karte truncated sauber, voller Name als Tooltip
- **Viele Zielfirmen (>20):** Liste bleibt performant, kein Limit erzwungen — realistisch sind 5–15 Ziele

## Technical Requirements (optional)
- Security: Authentifizierung erforderlich; RLS Owner-only auf Zielfirmen-Daten
- Performance: Abdeckungs-Berechnung ohne spürbare Verzögerung bei ~400 Kontakten
- Validierung: Firmenname Pflicht, getrimmt, max. 100 Zeichen

## Open Questions
- [x] Umgang mit Umbenennung normalisierter Firmen → **entschieden (/architecture):** MVP = Ziel neu anlegen; automatische Mitführung bewusst nicht gebaut

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Sektion auf Profil-Seite statt eigener Seite/Dashboard | Exit-Planung gehört neben CV + Career Goals (PROJ-16); kein neuer Navigationspunkt für eine Liste | 2026-07-02 |
| Autocomplete aus Netzwerk + Freitext für unbekannte Firmen | Wunschfirmen ohne Kontakte sind der häufigste Exit-Fall; Match über normalisierte Namen (PROJ-22) hält Daten sauber | 2026-07-02 |
| Karte: Abdeckung + Stärke-Verteilung + letzter Touchpoint + Drilldown-Sprung; keine Notiz | Fokus auf „Wo trägt mein Netzwerk?" und schnelles Handeln; Notiz-Pflege verworfen | 2026-07-02 |
| Keine Priorität/kein Status-Lifecycle | Schlanke Liste passt zu Zeitknappheit; Sortierung nach Abdeckung ersetzt manuelle Priorisierung | 2026-07-02 |
| Match über Firmennamen (String), kein FK auf Firmen-Entität | Es gibt bewusst keine companies-Tabelle (PROJ-22-Entscheidung); Namens-Match ist konsistent mit Drilldown | 2026-07-02 |
| Umbenennungs-Drift akzeptiert (Ziel zeigt dann 0 Kontakte) | Seltener Fall, einfacher Workaround (neu anlegen); automatische Mitführung wäre unverhältnismäßig komplex | 2026-07-02 |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|----------|-----------|------|
| Eigene Tabelle exit_targets (user_id, Firmenname, created_at) mit case-insensitive Unique-Constraint | Liste mit eigenem Lebenszyklus; DB verhindert Duplikate zuverlässiger als UI-Check | 2026-07-02 |
| CRUD direkt über Supabase-Client (kein API-Endpunkt) | Gleiches Muster wie Kontakte-CRUD; RLS schützt serverseitig; kein Server-Logik-Bedarf | 2026-07-02 |
| Abdeckung/Touchpoint clientseitig live berechnet, nicht gespeichert | Kontakte ohnehin geladen; kein Sync-/Staleness-Problem | 2026-07-02 |
| Touchpoint = max. last_contacted_at der gematchten Kontakte | Konsistent mit PROJ-22-Header-Karte; kein zusätzlicher Interactions-Query | 2026-07-02 |
| Kontaktliste lernt URL-Parameter für Firmen-Filter | Sprungziel für Karten; macht Drilldowns verlinkbar; minimale PROJ-22-Erweiterung | 2026-07-02 |
| Open Question „Umbenennungs-Drift" bestätigt: MVP = neu anlegen | Automatische Mitführung unverhältnismäßig; Fall selten | 2026-07-02 |

---
<!-- Sections below are added by subsequent skills -->

## Implementation Notes

### Frontend (2026-07-02)
- `src/lib/exit-targets.ts` (neu): ExitTarget-Typ + pure Funktionen `computeCoverage` (Match case-insensitive über PROJ-22-Anzeigenamen), `sortTargetsByCoverage`, `isDuplicateTarget`
- `src/components/exit-targets-section.tsx` (neu): selbstständige Sektion — lädt exit_targets + Kontakte, Autocomplete (Command+PopoverAnchor, Netzwerk-Vorschläge mit Kontakt-Anzahl, Enter = Freitext), Karten mit Abdeckung/Stärke-Badges/Touchpoint, Klick → `/contacts?firma=…` (nur bei Kontakten), Löschen mit AlertDialog, Fehler-States
- `src/components/ui/popover.tsx`: `PopoverAnchor` re-exportiert (Radix-Primitive, Standard-shadcn-Export)
- `src/components/cv-profile.tsx`: Sektion eingebunden (Haupt-Ansicht nach Goals + Empty-Profil-Zweig)
- `src/components/contact-list.tsx` (PROJ-22-Erweiterung): liest `?firma=`-URL-Parameter beim Laden als initialen Firmen-Filter (bewusst window.location statt useSearchParams — kein Suspense-Boundary nötig, Filter wird nach Kontakt-Load gesetzt)
- Hinweis: `exit_targets`-Tabelle existiert erst nach Backend-Migration — Anlegen zeigt bis dahin Fehlermeldung

### Backend (2026-07-02)
- Migration `0012_exit_targets.sql` (angewendet auf Produktion): Tabelle `exit_targets` (id, user_id FK cascade, company_name mit Längen-Check 1–100, created_at), case-insensitive Unique-Index auf (user_id, lower(trim(company_name))), Index auf user_id, RLS Owner-only für SELECT/INSERT/UPDATE/DELETE (Muster wie contacts)
- Kein API-Endpunkt (Design-Entscheidung): CRUD via Supabase-Client, RLS schützt serverseitig; DB-Constraints decken Validierung (Pflicht, Länge, Duplikat) als zweite Verteidigungslinie hinter der UI ab
- 8 Unit-Tests für `exit-targets.ts` (computeCoverage: Normalisierungs-Match, Roh-Fallback, case-insensitive, Touchpoint-Max, Empty; Sortierung; Duplikat-Check)

## Tech Design (Solution Architect)
**Designed:** 2026-07-02

### Überblick
Kleines, klassisches CRUD-Feature plus clientseitige Auswertung. Eine neue Datenbank-Tabelle für die Zielfirmen, eine neue Sektion auf der Profil-/Lebenslauf-Seite, keine neuen KI-Aufrufe, keine neuen Pakete.

### Component Structure
```
Profil-/Lebenslauf-Seite (bestehend, cv-profile)
+-- Career-Goals-Sektion (bestehend)
+-- Exit-Ziele-Sektion (neu, darunter)
    +-- Eingabefeld mit Autocomplete (bekannte Firmen + Kontakt-Anzahl, Freitext möglich)
    +-- Zielfirmen-Karten (sortiert: meiste Kontakte zuerst, ohne Kontakte zuletzt)
    |   +-- Firmenname + Anzahl Kontakte + Stärke-Verteilung (Stark/Mittel/Locker)
    |   +-- Letzter Touchpoint
    |   +-- Klick → Kontaktliste mit aktivem Firmen-Filter (PROJ-22)
    |   +-- Löschen-Button (mit Bestätigungsdialog)
    +-- Empty State („Zielfirmen für deinen Exit erfassen…")
```

### Data Model (Klartext)
Neue Tabelle „Exit-Ziele": pro Eintrag Nutzer-Zuordnung, Firmenname (Pflicht, max. 100 Zeichen), Anlagedatum. Duplikate pro Nutzer verhindert die Datenbank selbst (case-insensitive). Owner-only-Zugriff per RLS wie bei allen Tabellen.

**Nicht gespeichert:** Abdeckung, Stärke-Verteilung, Touchpoint — alles wird live im Browser aus den ohnehin geladenen Kontakten berechnet (Match über denselben Anzeigenamen wie PROJ-22: normalisiert, sonst roh; case-insensitive). Keine Sync-Probleme, immer aktuell.

### Drilldown-Sprung (kleine PROJ-22-Erweiterung)
Der Firmen-Filter der Kontaktliste ist bisher nur interner Seiten-Zustand. Damit die Zielfirmen-Karte dorthin springen kann, lernt die Kontakte-Seite einen Web-Adress-Parameter (z.B. „/contacts?firma=…"), den sie beim Laden als aktiven Firmen-Filter übernimmt. Nebeneffekt: Firmen-Drilldowns werden verlinkbar/bookmarkbar.

### Tech Decisions (PM-Begründung)
- **Eigene Tabelle statt Feld am Profil:** Zielfirmen sind eine Liste mit eigenem Lebenszyklus (anlegen/löschen); ein Textfeld am Profil wäre nicht sauber abfragbar
- **Kein neuer API-Endpunkt:** Anlegen/Löschen läuft direkt über die abgesicherte Datenbankverbindung (gleiches Muster wie Kontakte-CRUD); RLS schützt serverseitig
- **Berechnung im Browser statt in der Datenbank:** ~400 Kontakte sind längst geladen; Live-Berechnung ist trivial schnell und kann nie veralten
- **Match über Firmennamen statt Verknüpfungs-ID:** Es gibt bewusst keine Firmen-Tabelle (PROJ-22-Entscheidung); Namens-Match ist konsistent mit dem Drilldown. Umbenennungs-Drift akzeptiert (Spec)
- **URL-Parameter für Drilldown:** minimal-invasive Erweiterung von PROJ-22, macht Firmen-Ansichten zusätzlich verlinkbar

### Dependencies (Pakete)
Keine neuen — shadcn Command/Popover (Autocomplete), Card, AlertDialog vorhanden.

## QA Test Results

### Lauf 1 — 2026-07-02

**Automatisierte Tests:** Vitest 223/223 grün (davon 8 Unit-Tests für exit-targets-Logik). Lint + Build sauber.

**E2E (Playwright, `tests/PROJ-23-exit-ziel-tracker.spec.ts`, 9 Tests × chromium + Mobile Safari = 18):** alle grün.
Abgedeckt: Empty State, Autocomplete mit Kontakt-Anzahl, Karte mit Abdeckung/Stärke-Verteilung/Touchpoint, Freitext-Ziel ohne Kontakte, Duplikat-Hinweis (case-insensitive), Sortierung, Drilldown-Sprung nach `/contacts?firma=…` (PROJ-22-Integration), kein Sprung ohne Kontakte, leere Eingabe, Löschen mit Bestätigung.

**Security-Audit (Red Team, direkt gegen Produktions-DB):**
- Anonymer REST-Read auf `exit_targets`: 200 mit 0 Zeilen (RLS greift) ✅
- Anonymer Insert: 401 ✅
- Insert mit 101 Zeichen: 400 (DB-Längen-Check) ✅
- Duplikat case-insensitive/getrimmt: 409 (Unique-Index) ✅
- XSS: Firmennamen React-escaped; URL-Sprung mit encodeURIComponent ✅
- Kein neuer API-Endpunkt, keine KI-Kosten-Angriffsfläche ✅

**Regression:** PROJ-22-Suite (10 Tests) + PROJ-16-Suite komplett grün — URL-Parameter-Erweiterung der Kontaktliste und Profil-Seiten-Einbindung brechen nichts.

**Bugs:** keine.

**Production-Ready: JA**

## Deployment

**Production URL:** https://bambi-w26q.vercel.app/profil/lebenslauf
**Deployed:** 2026-07-02 (Vercel Auto-Deploy via Push auf main, Build 1m, Status Ready)
**Tag:** v1.20.0-PROJ-23

- Migration `0012_exit_targets.sql` war bereits vor Deploy auf Produktions-DB angewendet (via Supabase MCP)
- Keine neuen Env-Vars nötig
- Post-Deploy-Check: geschützte Seite redirectet ohne Session auf Login (307); `exit_targets` via REST erreichbar, RLS liefert anonym 0 Zeilen

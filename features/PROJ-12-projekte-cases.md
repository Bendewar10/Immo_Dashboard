# PROJ-12: Projekte/Cases

## Status: Approved
**Created:** 2026-06-30
**Last Updated:** 2026-06-30

## Dependencies
- PROJ-3 (Kontakt anlegen & verwalten) — Beteiligte sind bestehende Kontakte
- PROJ-5 (Interaktions-Log) — Interaktionen können optional einem Projekt zugeordnet werden

## User Stories
- Als MBB-Berater möchte ich ein Projekt/Case mit Titel, Kunde, Stadt und Zeitfenster anlegen können, damit ich meine Engagements als eigenständige Einheit erfasse
- Als Berater möchte ich Kontakte einem Projekt als Beteiligte mit Rolle zuordnen, damit ich nachvollziehen kann, wer Partner/PM/Case-Team/Client auf welchem Case war
- Als Berater möchte ich pro Projekt eine Timeline aus verknüpften Kontaktmomenten sehen, damit eine persönliche Historie meines Netzwerks innerhalb des Cases entsteht
- Als Berater möchte ich ein Projekt als beendet markieren können, damit aktive und vergangene Engagements klar getrennt erkennbar sind
- Als Berater möchte ich beim Erfassen eines Kontaktmoments optional ein Projekt zuordnen können, damit der Moment im Projekt-Log erscheint, ohne den bestehenden Interaktions-Flow zu verkomplizieren

## Out of Scope
- Rolloff-Wizard (AI-Bulk-Nachfass bei Projektende) — eigenes Feature PROJ-13
- City-Trip-Modus (Kontakte vor Ort basierend auf Projekt-Stadt+Zeitfenster) — eigenes Feature PROJ-14
- Projekt-eigene Meilensteine (Kickoff, Steering Committee etc.) ohne Kontaktbezug — bewusst ausgeschlossen, Log bleibt rein netzwerk-fokussiert (verknüpfte Kontakt-Interaktionen), keine separate Event-Art
- "Upcoming"-Status für zukünftige Projekte — nur Aktiv/Beendet, Enddatum kann bei aktivem Projekt gesetzt/geändert werden
- Team-Feature / geteilte Projekte — Projekte sind streng single-user (RLS), keine Kollaboration, kein Case-Team-Sharing über Nutzer hinweg
- AI-Chat-Tools für Projekte (z. B. Projekt per Chat anlegen) — nicht in PROJ-12, ggf. spätere Erweiterung von PROJ-11
- Bulk-Zuordnung mehrerer Kontakte gleichzeitig zu einem Projekt — Beteiligte werden einzeln hinzugefügt
- Eigene Notiz-Historie/Versionierung der Projekt-Notizen — ein einzelnes Notizfeld wie bei Kontakten

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

- [ ] Angenommen der Nutzer ist eingeloggt, wenn er ein Projekt nur mit Titel anlegt und speichert, dann wird das Projekt mit `user_id = auth.uid()`, Status "Aktiv" und allen übrigen Feldern leer gespeichert
- [ ] Angenommen der Nutzer lässt das Titel-Feld leer, wenn er speichern will, dann wird eine Validierungsfehlermeldung angezeigt und das Projekt wird nicht angelegt
- [ ] Angenommen der Nutzer befüllt zusätzlich Kunde, Stadt, Start-/Enddatum und Notizen, wenn er speichert, dann werden alle Werte mitgespeichert
- [ ] Angenommen ein aktives Projekt existiert, wenn der Nutzer es als "Beendet" markiert, dann wird der Status aktualisiert und das Projekt erscheint in der Liste klar als Historie erkennbar (visuell getrennt von aktiven Projekten)
- [ ] Angenommen ein Projekt existiert, wenn der Nutzer einen bestehenden Kontakt als Beteiligten hinzufügt und eine Rolle wählt (Partner/Project Manager/Case Team/Client/Sonstige), dann wird die Zuordnung mit Rolle gespeichert
- [ ] Angenommen der Nutzer wählt bei "Sonstige" zusätzlich einen freien Rollentext, wenn er speichert, dann wird dieser Freitext mit der Zuordnung gespeichert
- [ ] Angenommen ein Kontakt ist bereits Beteiligter eines Projekts, wenn der Nutzer den Beteiligten-Picker öffnet, dann wird dieser Kontakt nicht mehr zur Auswahl angeboten (kein Duplikat möglich)
- [ ] Angenommen ein Beteiligter ist einem Projekt zugeordnet, wenn der Nutzer ihn entfernt, dann wird nur die Zuordnung gelöscht — der Kontakt selbst und seine Interaktionen bleiben unverändert erhalten
- [ ] Angenommen der Nutzer protokolliert einen Kontaktmoment (PROJ-5), wenn er optional ein Projekt aus seiner eigenen Projektliste auswählt, dann wird die Interaktion mit `project_id` gespeichert
- [ ] Angenommen eine Interaktion ist einem Projekt zugeordnet, wenn der Nutzer die Projekt-Detailseite öffnet, dann erscheint diese Interaktion chronologisch absteigend im Projekt-Log
- [ ] Angenommen ein Projekt hat noch keine verknüpften Interaktionen, wenn der Nutzer die Detailseite öffnet, dann wird ein Empty-State im Log-Bereich angezeigt
- [ ] Angenommen ein Projekt existiert, wenn der Nutzer auf "Löschen" klickt, dann erscheint ein Bestätigungsdialog bevor das Projekt entfernt wird
- [ ] Angenommen ein Projekt wird gelöscht, dann werden alle `project_participants`-Zuordnungen mitgelöscht, während verknüpfte Interaktionen erhalten bleiben und nur ihre `project_id` auf `null` gesetzt wird
- [ ] Angenommen der Nutzer hat noch keine Projekte angelegt, wenn er die Projektliste öffnet, dann wird ein Empty-State mit Hinweis und "Projekt anlegen"-Button angezeigt
- [ ] Angenommen Nutzer A ist eingeloggt, wenn er versucht auf Projekte oder Beteiligten-Zuordnungen von Nutzer B zuzugreifen, dann liefert die Datenbank keine Zeile zurück (RLS)

## Edge Cases
- Projekt ohne Enddatum, Status "Beendet" gesetzt → erlaubt, kein Pflichtfeld-Zwang, Enddatum bleibt optional auch bei Beendet
- Enddatum liegt vor Startdatum → Validierungsfehler, da inkonsistentes Zeitfenster
- Letzter Beteiligter eines Projekts wird entfernt → Projekt bleibt bestehen mit leerer Beteiligten-Liste, kein Auto-Löschen
- Kontakt wird gelöscht (PROJ-3), während er Beteiligter eines Projekts ist → Cascade-Delete entfernt die `project_participants`-Zuordnung automatisch, Projekt selbst bleibt bestehen
- Sehr lange Projekt-Notiz → max. 2000 Zeichen analog zu Kontakt-/Interaktions-Notizen, Validierungsfehler bei Überschreitung
- Doppelter Klick auf "Speichern" während Request läuft → Button disabled (Loading-State), kein doppelter Insert
- Interaktion war einem Projekt zugeordnet, Projekt wird gelöscht → Interaktion bleibt im normalen Kontakt-Verlauf sichtbar, nur ohne Projekt-Tag

## Technical Requirements
- Security: RLS auf `projects` und `project_participants` analog zu bestehenden Tabellen (`auth.uid() = user_id`), `user_id` nie aus Client-Eingabe übernehmen
- Validierung: Titel Pflicht (max 200 Zeichen), Kunde/Stadt optional (max 100 Zeichen je analog zu Kontaktfeldern), Start-/Enddatum optional aber Enddatum ≥ Startdatum falls beide gesetzt, Notizen optional max 2000 Zeichen
- Rollen-Set fix: Partner, Project Manager, Case Team, Client, Sonstige (mit Freitext bei "Sonstige")
- Unique Constraint auf `(project_id, contact_id)` in `project_participants`, um Duplikate auf DB-Ebene zu verhindern (zusätzlich zur UI-seitigen Filterung im Picker)

## Open Questions
_Keine offenen Fragen — siehe Decision Log._

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Status nur Aktiv/Beendet, kein "Upcoming" | Nutzer will aktuelle Projekte mit Enddatum versehen können statt eines dritten Vorab-Status; Historie-Trennung reicht mit zwei Stati | 2026-06-30 |
| Nur Titel ist Pflichtfeld beim Anlegen | Quick-Add < 1 Minute (PRD-Ziel), Kunde/Stadt/Daten/Notizen jederzeit nachtragbar | 2026-06-30 |
| Rollen fest (Partner/PM/Case Team/Client) statt Freitext, plus "Sonstige" als Fallback | Deckt typische MBB-Case-Konstellation klar ab, vermeidet Tippvarianten/Inkonsistenz, "Sonstige" fängt Ausnahmen (z. B. externer Advisor) ab | 2026-06-30 |
| Projekt-Log zeigt ausschließlich verknüpfte Kontakt-Interaktionen, keine eigenen Meilensteine | Feature bleibt netzwerk-fokussiert (Kernziel der App), keine Projekt-Management-Funktionalität | 2026-06-30 |
| Interaktionen bekommen optionales `project_id`-Feld statt reiner Ableitung aus Beteiligten-Zeitfenster | Präzise, explizite Zuordnung statt unscharfer Heuristik über Datum/Beteiligte-Überschneidung | 2026-06-30 |
| Projekt-Löschen entfernt nur Beteiligten-Zuordnungen, Interaktionen bleiben erhalten (project_id → null) | Kein Verlust von Kontakt-Historie, nur die Projekt-Verknüpfung ist reversibel/vergänglich | 2026-06-30 |
| Bestätigungsdialog vor Projekt-Löschen | Konsistent mit bestehendem Lösch-Pattern bei Kontakten (PROJ-3) und Interaktionen (PROJ-5) | 2026-06-30 |
| Doppelte Beteiligten-Zuordnung wird durch Ausblenden im Picker verhindert, keine Fehlermeldung nötig | UI verhindert den Fall proaktiv, kein Bedarf für reaktive Fehlermeldung | 2026-06-30 |
| Kein Rolloff-Wizard, kein Travel-Hook in dieser Spec | Stufenweiser Aufbau: PROJ-12 liefert das Fundament (Projekte+Beteiligte+Log), AI-Bulk-Nachfass (PROJ-13) und City-Trip-Modus (PROJ-14) folgen separat | 2026-06-30 |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|----------|-----------|------|
| Neue Route-Gruppe `/projects` (Liste + Detail) statt Integration in Kontaktliste | Eigenständiger Engagement-Container mit eigener Beteiligten-Logik, Konsistenz mit bestehenden Top-Level-Routen (`/contacts`, `/analytics`) | 2026-06-30 |
| `project_participants` als eigene Verknüpfungstabelle mit Unique Constraint `(project_id, contact_id)` | Setzt Duplikat-Verhinderung aus Acceptance Criteria auf DB-Ebene durch, nicht nur UI-seitig | 2026-06-30 |
| `interactions.project_id` als nullable FK mit `ON DELETE SET NULL` | Interaktion bleibt bei Projekt-Löschung erhalten (Acceptance Criteria), nur Verknüpfung verschwindet | 2026-06-30 |
| `project_participants.contact_id` mit Cascade-Delete vom Kontakt | Kontakt-Löschung (PROJ-3) entfernt Beteiligten-Zuordnung automatisch, kein verwaister Eintrag | 2026-06-30 |
| Beteiligten-Picker als Command/Popover (bestehendes shadcn-Pattern) | Gleiche UX wie übrige Kontakt-Suchen im Projekt, kein neues Interaktionsmuster | 2026-06-30 |
| Tabs (Aktiv/Beendet) auf Projektliste statt Filter-Dropdown | Visuelle Trennung war explizite Acceptance Criteria, Tabs zeigen Trennung sofort | 2026-06-30 |
| Keine neuen Packages | Benötigte shadcn-Komponenten (select, command, tabs, alert-dialog, avatar, badge) bereits installiert | 2026-06-30 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### A) Komponenten-Struktur

```
/projects (neue Route, Liste)
+-- Header ("Projekte" + "Projekt anlegen"-Button)
+-- Tabs: Aktiv | Beendet
|   +-- Projekt-Karten-Liste (Titel, Kunde, Stadt, Zeitfenster, Beteiligten-Avatare)
+-- Empty State ("Noch keine Projekte" + CTA)
+-- Projekt-Anlegen-Dialog (Titel Pflicht, Rest optional)

/projects/[id] (neue Route, Detail)
+-- Header (Titel, Kunde, Stadt, Zeitfenster, Status-Badge, Status-Toggle, Bearbeiten, Löschen)
+-- Löschen-Bestätigungsdialog (Pattern wie bei Kontakten/Interaktionen)
+-- Beteiligte-Sektion
|   +-- Beteiligten-Liste (Avatar, Name, Rolle-Badge, Entfernen-Button)
|   +-- Beteiligten-Picker (Kontakt-Suche, bereits zugeordnete ausgeblendet, Rolle-Auswahl inkl. "Sonstige"-Freitext)
+-- Projekt-Log-Sektion
    +-- Timeline verknüpfter Interaktionen (chronologisch absteigend, Pattern wie bestehendes Interaktions-Log)
    +-- Empty State ("Noch keine verknüpften Momente")

Bestehender Interaktions-Dialog (PROJ-5)
+-- + optionales Feld "Projekt" (Dropdown, nur eigene Projekte)
```

### B) Datenmodell (Klartext)

**Projekt** — eigenständige Einheit pro Engagement:
- Titel (Pflicht, max 200 Zeichen)
- Kunde, Stadt (optional, je max 100 Zeichen)
- Start-/Enddatum (optional, Enddatum ≥ Startdatum)
- Status: Aktiv / Beendet
- Notizen (optional, max 2000 Zeichen)
- Gehört einem Nutzer (RLS-geschützt, kein Sharing)

**Beteiligung** — verknüpft Kontakt mit Projekt:
- Zeigt auf bestehenden Kontakt + Projekt
- Rolle: Partner / Project Manager / Case Team / Client / Sonstige (+Freitext bei Sonstige)
- Ein Kontakt kann pro Projekt nur einmal Beteiligter sein (DB-Constraint, kein Duplikat möglich)
- Entfernen löscht nur Verknüpfung, Kontakt + dessen Interaktionen bleiben unberührt

**Interaktion (bestehend, PROJ-5)** — bekommt optionale Projekt-Verknüpfung:
- Neues optionales Feld: zugehöriges Projekt
- Wird Projekt gelöscht, bleibt Interaktion erhalten, Verknüpfung verschwindet (kein Datenverlust)

Storage: Supabase Postgres, RLS analog bestehender Tabellen (`auth.uid() = user_id`).

### C) Tech-Entscheidungen (warum)

- **Neue Route-Gruppe `/projects`** statt Tab in Kontaktliste — Projekte sind eigenständige Engagement-Container mit eigener Beteiligten-Logik, verdienen eigene Liste+Detail-Seite (Konsistenz mit `/contacts`, `/analytics`).
- **Beteiligten-Picker als Command/Popover** (bestehendes shadcn-Pattern) — gleiche UX wie Kontakt-Suche an anderer Stelle, kein neues Interaktionsmuster für Nutzer.
- **Tabs Aktiv/Beendet** statt Filter-Dropdown — visuelle Trennung war explizite Acceptance Criteria, Tabs machen Trennung sofort sichtbar.
- **Löschen-Bestätigungsdialog** wiederverwendet bestehendes AlertDialog-Pattern aus Kontakt-/Interaktions-Löschung — Konsistenz, kein neues UI-Pattern nötig.
- **Cascade-Verhalten auf DB-Ebene** (Beteiligte löschen bei Projekt-Löschung, Interaktion-Verknüpfung auf null bei Projekt-Löschung; Beteiligung löschen bei Kontakt-Löschung) — Datenintegrität direkt in der Datenbank statt fehleranfälliger Anwendungslogik.

### D) Dependencies
Keine neuen Packages — `select`, `command`, `tabs`, `alert-dialog`, `avatar`, `badge` bereits installiert und im Projekt genutzt.

## Frontend Implementation Notes
<!-- Added by /frontend -->
- Neue Dateien: `src/lib/projects.ts` (Typen, Rollen-/Status-Labels, Formatierungs-Helper), `src/components/project-list.tsx`, `project-card.tsx`, `project-form-dialog.tsx`, `project-participant-dialog.tsx`, `project-detail.tsx`
- Neue Routen: `/projects` (Liste mit Aktiv/Beendet-Tabs), `/projects/[id]` (Detail mit Beteiligten + Projekt-Log)
- Nav-Link "Projekte" in `(app)/layout.tsx` ergänzt
- `src/lib/interactions.ts`: `Interaction` um optionales `project_id` erweitert
- `interaction-form-dialog.tsx`: optionales Projekt-Dropdown (lädt eigene Projekte, "Kein Projekt" als Default) ergänzt
- Beteiligten-Picker nutzt shadcn `Command` (Kontakt-Suche) + `Select` (Rolle, inkl. "Sonstige"-Freitext) in einem Dialog statt Popover-Combobox — einfacher im Detail-Seiten-Kontext
- Alle Supabase-Calls (`projects`, `project_participants`) gehen von der in der Architektur festgelegten Tabellenstruktur aus — Tabellen/RLS existieren noch nicht, folgen in `/backend`
- Build (`npm run build`) und Lint (`npm run lint`) laufen fehlerfrei; `/projects` liefert im Dev-Server korrekt 307-Redirect zu `/login` (Middleware greift), volle UI-Prüfung erst nach `/backend` möglich (Tabellen fehlen)
- **Bugfix nach QA (BUG-1):** `project-list.tsx` Empty-State zeigte einen zweiten "Projekt anlegen"-Button zusätzlich zum Header-Button (doppelter Accessible-Name). Empty-State-Button entfernt, Hinweistext ergänzt ("Lege oben dein erstes Projekt an."), Header-Button bleibt einziger CTA.

## Backend Implementation Notes
<!-- Added by /backend -->
- Migration `20260630..._create_projects_and_participants` (live) / `supabase/migrations/0003_create_projects_and_participants.sql` (repo copy): Tabellen `projects`, `project_participants`, neue Spalte `interactions.project_id`
- `projects`: `status` per CHECK auf `active`/`done` begrenzt, alle Felder außer `title`/`user_id` nullable
- `project_participants`: `role` per CHECK auf festes Set begrenzt, `role_other` frei, Unique Constraint `(project_id, contact_id)` verhindert Duplikate auf DB-Ebene, eigene `user_id`-Spalte (Konsistenz mit `interactions`) für direkte RLS-Filterung ohne Join
- `interactions.project_id`: nullable FK `on delete set null` — Interaktion bleibt bei Projekt-Löschung erhalten
- RLS: `projects` + `project_participants` Owner-only (`auth.uid() = user_id`); `project_participants`-Insert zusätzlich mit `WITH CHECK`, das referenziertes Projekt UND referenzierten Kontakt auf Eigentümerschaft des einfügenden Nutzers prüft (verhindert Verknüpfung fremder Projekte/Kontakte selbst bei korrektem `user_id`-Wert)
- Cascade-Verhalten wie spezifiziert: Projekt-Löschung → `project_participants` cascade, `interactions.project_id` → null; Kontakt-Löschung → zugehörige `project_participants`-Zeile cascade
- Keine eigenen API-Routes — CRUD läuft direkt über Supabase-Client + RLS, analog PROJ-3/4/5 (kein bestehendes `/api/contacts`-Pattern für diese Art von Ressource)
- Fix während Backend-Phase: `project-participant-dialog.tsx` fehlte `user_id` im Insert-Payload (RLS-Pflichtfeld) — ergänzt
- Repo-Migrationsordner war bereits vor PROJ-12 hinter dem Live-Schema (nur 2 von 14 Live-Migrationen committed) — neue Migration als Datei `0003` ergänzt, ohne die bestehende Lücke rückwirkend zu schließen
- `npm run build` + `npm run lint` fehlerfrei; Live-Schema via Supabase MCP gegen Tech-Design verifiziert (Spalten/Typen stimmen exakt überein)
- **Bugfix nach QA (BUG-2):** Migration `supabase/migrations/0004_interactions_project_ownership_check.sql` ergänzt `WITH CHECK` auf `interactions_insert_own`/`interactions_update_own`: `project_id` muss (falls gesetzt) einem Projekt des einfügenden/aktualisierenden Nutzers gehören — analog zum bestehenden Ownership-Check bei `project_participants_insert_own`. Live via Supabase MCP angewendet und verifiziert (`pg_policies`), keine neuen Security-Advisor-Findings.

## QA Test Results

**Tested:** 2026-06-30
**App URL:** http://localhost:3000 (npm run dev)
**Tester:** QA Engineer (AI)

### Acceptance Criteria Status

1. Titel-only anlegen → `status='active'`, restliche Felder leer — PASS
2. Leeres Titel-Feld → Validierungsfehler "Titel ist erforderlich", kein Insert — PASS
3. Kunde/Stadt/Daten/Notizen werden mitgespeichert — PASS
4. Projekt "Beendet" markieren → Status-Update + visuelle Trennung über Tabs (Aktiv/Beendet) — PASS
5. Beteiligten mit Rolle hinzufügen → gespeichert — PASS
6. "Sonstige" + Freitext → Freitext gespeichert und als Label angezeigt — PASS
7. Bereits zugeordneter Kontakt wird im Picker ausgeblendet — PASS
8. Beteiligten entfernen → nur Zuordnung gelöscht, Kontakt bleibt bestehen — PASS
9. Interaktion mit optionalem `project_id` speicherbar — PASS
10. Verknüpfte Interaktion erscheint chronologisch im Projekt-Log — PASS
11. Leeres Projekt-Log zeigt Empty-State — PASS
12. Löschen zeigt Bestätigungsdialog — PASS
13. Projekt-Löschung cascadet `project_participants`, Interaktionen bleiben mit `project_id = null` erhalten — PASS (UI + direkte DB-Verifikation)
14. Leere Projektliste zeigt Empty-State mit "Projekt anlegen"-CTA — PASS, aber siehe BUG-1 (CTA wird doppelt gerendert)
15. RLS: fremde/nicht-authentifizierte Anfragen liefern keine Zeile zurück — PASS (verifiziert über anon-Rolle gegen `projects`-Tabelle, siehe Security-Sektion)

### Edge Cases Status

- Projekt ohne Enddatum + Status Beendet → erlaubt — PASS (im Mark-Done-Test ohne Enddatum durchlaufen)
- Enddatum vor Startdatum → Validierungsfehler — PASS
- Letzter Beteiligter entfernt → Projekt bleibt mit leerer Liste bestehen — PASS
- Kontakt gelöscht während Beteiligter eines Projekts → `project_participants`-Zeile cascade-gelöscht — PASS (direkt per SQL verifiziert: Contact-Delete → Participant-Row weg, Projekt bleibt)
- Notiz > 2000 Zeichen → Validierungsfehler — durch Zod-Schema abgedeckt (`max(2000)`), nicht separat per E2E getestet (gleiches Pattern wie Kontakte/Interaktionen, geringes Risiko)
- Doppelklick auf "Speichern" während Request läuft → Button wird disabled (Loading-State) — Code-Review bestätigt Implementierung, nicht unter Last/Race getestet
- Interaktion war Projekt zugeordnet, Projekt gelöscht → Interaktion bleibt im Kontakt-Verlauf ohne Projekt-Tag — PASS (Teil von Test 13)

### Security Audit Results
- [x] Authorization (RLS): `projects`/`project_participants` ausschließlich `auth.uid() = user_id`, ohne gültigen User-Token keine Zeile sichtbar (verifiziert per anon-Rolle)
- [x] `project_participants`-Insert validiert per `WITH CHECK` zusätzlich, dass referenziertes Projekt UND referenzierter Kontakt dem einfügenden Nutzer gehören (verhindert Cross-User-Verknüpfung selbst bei korrektem `user_id`-Wert)
- [x] XSS: Titel/Notizen werden ausschließlich über React-Textinterpolation gerendert (kein `dangerouslySetInnerHTML`) — kein Injection-Vektor gefunden
- [ ] BUG-2: `interactions`-RLS (INSERT/UPDATE) prüft nur `auth.uid() = user_id`, nicht aber ob das gesetzte `project_id` dem Nutzer gehört — Inkonsistenz zum sonst sauberen Ownership-Check bei `project_participants`

### Bugs Found

#### BUG-1: "Projekt anlegen"-Button wird doppelt gerendert (Empty State)
- **Severity:** Low
- **Steps to Reproduce:**
  1. `/projects` öffnen, wenn im aktuellen Tab keine Projekte existieren (z. B. frischer Account)
  2. Sowohl der Header-Button "Projekt anlegen" als auch der Empty-State-Button mit identischem Label werden gleichzeitig angezeigt
  3. Erwartet: ein eindeutiger CTA
  4. Tatsächlich: zwei Buttons mit identischem Accessible-Name auf der Seite — verwirrend für Screenreader-Nutzer, nicht deterministisch ansteuerbar
- **Priority:** Nice to have (z. B. Empty-State-Button entfernen, da Header-Button bereits vorhanden ist)
- **File:** `src/components/project-list.tsx`

#### BUG-2: `interactions`-RLS validiert `project_id`-Eigentümerschaft nicht
- **Severity:** Low
- **Steps to Reproduce:**
  1. Eigene Interaktion per REST-API einfügen/updaten mit `project_id` einer fremden (aber existierenden) `projects`-Zeile
  2. Erwartet (analog `project_participants_insert_own`): RLS lehnt ab, da Projekt nicht dem Nutzer gehört
  3. Tatsächlich: Insert/Update wird akzeptiert (FK prüft nur Existenz, nicht Eigentümerschaft); kein Datenleck nach außen, da SELECT weiterhin durch `auth.uid() = user_id` auf die eigene Interaktion beschränkt bleibt, aber Dateninkonsistenz möglich (Interaktion "gehört" semantisch zu fremdem Projekt)
- **Priority:** Fix in next sprint (Konsistenz mit `project_participants`-Pattern, z. B. `WITH CHECK exists (select 1 from projects p where p.id = project_id and p.user_id = auth.uid())` ergänzen, sobald Projekt gesetzt ist)
- **File:** `supabase/migrations/0003_create_projects_and_participants.sql`

#### BUG-3 (Regression, nicht durch PROJ-12 verursacht): Contact-Card-Redesign bricht bestehende PROJ-3/4/5 E2E-Suites
- **Severity:** Medium (Test-Suite, kein User-Facing-Bug)
- **Steps to Reproduce:**
  1. `npm run test:e2e` für `tests/PROJ-3-contacts.spec.ts`, `tests/PROJ-4-contacts-list.spec.ts` oder `tests/PROJ-5-interaction-log.spec.ts` ausführen
  2. Erwartet: bestehende Regressionssuite läuft grün durch
  3. Tatsächlich: mehrere Tests scheitern, weil "Verlauf"/"Löschen" seit dem Contact-Card-Redesign (Commit `e4f6d99`, PROJ-4) hinter einem "Mehr Optionen"-Dropdown verschwunden sind; die Tests klicken weiterhin direkt auf den (nicht mehr sichtbaren) Button auf der Karte
- **Priority:** Fix in next sprint — eigenes Ticket zur Aktualisierung der PROJ-3/4/5-Spec-Selektoren auf das Dropdown-Pattern. Funktional ist die App nicht betroffen (Verlauf/Löschen funktionieren über das Dropdown), nur die automatisierte Regressionssuite ist blind für echte zukünftige Regressionen in diesem Bereich, bis sie repariert ist.
- **File:** `tests/PROJ-3-contacts.spec.ts`, `tests/PROJ-4-contacts-list.spec.ts`, `tests/PROJ-5-interaction-log.spec.ts` (nicht PROJ-12-Code)

### Automated Tests
- Unit (Vitest): `src/lib/projects.test.ts` — 7 Tests, alle grün (`npm test`: 107/107 gesamt)
- E2E (Playwright): `tests/PROJ-12-projekte-cases.spec.ts` — 14 Tests, alle grün auf Chromium und Mobile Safari (375px); isoliert wiederholt ausgeführt zur Flake-Prüfung
- `npm run build` und `npm run lint` fehlerfrei

### Summary
- **Acceptance Criteria:** 15/15 passed
- **Bugs Found:** 3 total (0 critical, 0 high, 1 medium — Test-Suite-Regression außerhalb PROJ-12, 2 low) — **alle 3 behoben, siehe Re-Test unten**
- **Security:** Kernschutz (RLS-Ownership auf `projects`/`project_participants`) hält; Konsistenzgap bei `interactions.project_id` geschlossen (BUG-2)
- **Production Ready:** YES
- **Recommendation:** Deploy.

### Re-Test nach Bugfixes (2026-06-30)
- BUG-1 behoben: `project-list.tsx` Empty-State zeigt nur noch einen "Projekt anlegen"-Button (Header). Neuer E2E-Test `AC: empty project list shows a single "Projekt anlegen" CTA` ergänzt.
- BUG-2 behoben: Migration `0004_interactions_project_ownership_check.sql` live angewendet, `interactions_insert_own`/`interactions_update_own` verifiziert via `pg_policies` (`with_check` enthält jetzt Projekt-Ownership-Check), keine neuen Security-Advisor-Findings.
- BUG-3 behoben: `openHistory`/`deleteContact`-Helper in `tests/PROJ-5-interaction-log.spec.ts` und `tests/PROJ-3-contacts.spec.ts` öffnen jetzt zuerst das "Mehr Optionen"-Dropdown vor "Verlauf"/"Löschen"; `tests/PROJ-4-contacts-list.spec.ts` AC1 nutzt jetzt `.cursor-pointer`-Card-Locator statt brüchiger `..`-Traversal, AC2 nutzt `h3`-Locator statt veralteter `[class*="truncate"]`-Klasse (Klasse saß früher auf dem Namen, sitzt nach dem Redesign nur noch auf Job-Title/Employer-Zeile)
- Vollständige Regression danach: `npm test` 107/107 grün, `npx playwright test --project=chromium --workers=1` **128/128 grün** (gesamte Suite inkl. aller PROJ-2–PROJ-12-Specs, seriell zur Vermeidung von Cross-Spec-Races auf dem geteilten QA-Account), `npm run build` + `npm run lint` fehlerfrei

## Deployment

- **Production URL:** https://bambi-w26q.vercel.app
- **Deployed:** 2026-06-30
- Pushed `main` (9f20d6a..7fcad4e) → Vercel auto-deploy, build `dpl_CeWMYhBszMZmtUVRjXBAp21bobaD`, Status Ready
- DB-Migrationen `0003_create_projects_and_participants.sql` + `0004_interactions_project_ownership_check.sql` bereits vor Deploy live via Supabase MCP angewendet (kein separater Migrationsschritt nötig)
- Smoke-Test: `/` → 307 (Middleware-Redirect, erwartet ohne Session), `/projects` → 200 nach Redirect-Follow (landet auf `/login`, erwartet ohne Session)

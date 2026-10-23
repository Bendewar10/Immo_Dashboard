# PROJ-5: Interaktions-Log

## Status: Deployed
**Created:** 2026-06-22
**Last Updated:** 2026-06-22 (Deployed)

## Backend Implementation Notes
- Migration `supabase/migrations/0002_extend_followup_trigger.sql`: Trigger `trg_update_contact_followup` von `after insert` auf `after insert or update or delete` erweitert
- Neue Helper-Funktion `recompute_contact_followup(contact_id)`: berechnet `last_contacted_at`/`next_followup_at` immer aus `MAX(occurred_at)` der tatsächlich verbleibenden Interactions (nicht mehr nur aus dem zuletzt eingefügten Datensatz) — leert beide Felder auf `null`, wenn keine Interaction mehr existiert
- **Sicherheitslücke gefunden + gefixt:** Helper-Funktion war initial per RPC öffentlich aufrufbar (`SECURITY DEFINER` ohne Execute-Restriktion) — hätte fremde `contacts`-Zeilen über `/rest/v1/rpc/recompute_contact_followup` mit beliebiger `contact_id` manipulieren können, RLS umgangen. Fix: `revoke execute ... from public, anon, authenticated`, Supabase Security Advisor danach clean (außer vorbestehendem, PROJ-5-unabhängigem Leaked-Password-Hinweis)
- Migration gegen echtes Supabase-Projekt (`srxatexcffjebolqttaq`) via MCP angewendet, mit `do $$ ... assert ... $$`-Block smoke-getestet: Insert, Delete der jüngsten Interaction (Fallback auf ältere), Update des Datums, Delete der letzten verbleibenden (Felder → null) — alle Assertions bestanden
- Keine neue API-Route — Frontend nutzt weiterhin direkten Supabase-Client-Zugriff (PROJ-3/4-Pattern), RLS erzwingt Ownership bereits serverseitig
- `npm run build` läuft fehlerfrei durch

## Implementation Notes
- `src/lib/interactions.ts`: Channel-Typ + Label-Mapping, `Interaction`-Interface (Spalte heißt `note`, nicht `notes` — laut PROJ-1-Migration)
- `src/components/interaction-form-dialog.tsx`: Ein Dialog-Formular für Erfassen+Bearbeiten, react-hook-form+Zod, Datum-Validierung "nicht in der Zukunft" via `max` HTML-Attribut + Zod-Refine
- `src/components/interaction-log-sheet.tsx`: shadcn `Sheet` mit chronologischem Verlauf (neueste oben), Empty-State, Edit/Delete-Icons pro Eintrag, AlertDialog für Löschen-Bestätigung
- `src/components/contact-card.tsx`: neuer "Verlauf"-Icon-Button (lucide `History`) neben Löschen-Button, öffnet Sheet ohne den bestehenden Karten-Klick (Bearbeiten) auszulösen
- `src/components/contact-list.tsx`: `historyContact`-State + `InteractionLogSheet` eingebunden
- Direkter Supabase-Client-Zugriff vom Frontend, keine neue API-Route (wie bei PROJ-3/PROJ-4)
- **Noch offen für `/backend`:** PROJ-1-Trigger `update_contact_followup` reagiert aktuell nur auf `insert` — muss um `update`/`delete` erweitert werden, damit `last_contacted_at`/`next_followup_at` beim Bearbeiten/Löschen der jüngsten Interaction korrekt neu berechnet werden (siehe Tech Design)
- `npm run build` + `npm run lint` laufen fehlerfrei durch

## Dependencies
- PROJ-1 (Supabase Infrastructure Setup) — `interactions`-Tabelle + RLS + Trigger existieren bereits
- PROJ-3 (Kontakt anlegen & verwalten) — Interactions gehören zu einem Kontakt
- PROJ-4 (Kontaktliste & Filter) — Einstiegspunkt für den Dialog ist die Kontaktliste

## User Stories
- Als Nutzer möchte ich einen Kontaktmoment (Treffen, Call, Nachricht, Event) zu einem Kontakt protokollieren können, damit ich nachvollziehen kann, wann ich zuletzt Kontakt hatte und worüber gesprochen wurde
- Als Nutzer möchte ich das Erfassen eines Kontaktmoments in unter 30 Sekunden erledigen können, damit ich es nach jedem echten Kontakt sofort nachtrage statt es zu vergessen
- Als Nutzer möchte ich den vollständigen Interaktionsverlauf eines Kontakts chronologisch sehen, damit ich mich vor dem nächsten Gespräch erinnern kann, was zuletzt besprochen wurde
- Als Nutzer möchte ich einen fehlerhaft erfassten Kontaktmoment nachträglich korrigieren können, damit Tippfehler oder falsche Kanal-Auswahl nicht dauerhaft falsch stehen bleiben
- Als Nutzer möchte ich einen versehentlich angelegten Kontaktmoment löschen können, damit mein Verlauf korrekt bleibt

## Out of Scope
- Eigene Detailseite pro Kontakt — Verlauf + Erfassung laufen über Dialog/Sheet von der Kontaktliste aus (PROJ-4), kein Routing-Aufwand
- Pagination/"Mehr laden" im Verlauf — alle Einträge werden chronologisch angezeigt, kein Limit (MVP-Netzwerke haben wenige Einträge pro Kontakt)
- Anhänge/Dateien an einem Kontaktmoment — nicht im Schema, kein MVP-Bedarf
- Bulk-Erfassung mehrerer Interactions gleichzeitig — kein MVP-Bedarf
- Erinnerungs-/Dashboard-Logik basierend auf Interactions — eigenes Feature PROJ-6
- Undo nach Löschen — Bestätigungsdialog reicht als Schutz, kein Soft-Delete

## Acceptance Criteria

- [ ] Angenommen der Nutzer ist eingeloggt und hat einen Kontakt geöffnet, wenn er Datum (Default: heute) und Kanal auswählt und speichert, dann wird die Interaction mit `user_id = auth.uid()` und der Kontakt-ID gespeichert
- [ ] Angenommen der Nutzer befüllt zusätzlich das optionale Notizfeld, wenn er speichert, dann wird die Notiz mit der Interaction gespeichert
- [ ] Angenommen der Nutzer lässt das Kanal-Feld leer, wenn er speichern will, dann wird eine Validierungsfehlermeldung angezeigt und die Interaction wird nicht angelegt
- [ ] Angenommen der Nutzer wählt ein Datum in der Zukunft, wenn er speichern will, dann wird eine Validierungsfehlermeldung angezeigt und die Interaction wird nicht angelegt
- [ ] Angenommen eine Interaction wird erfolgreich gespeichert, dann werden `last_contacted_at` und `next_followup_at` des zugehörigen Kontakts automatisch aktualisiert, sofern das neue Datum jünger ist als der bisherige letzte Kontakt
- [ ] Angenommen ein Kontakt hat mehrere protokollierte Interactions, wenn der Nutzer den Kontakt öffnet, dann werden alle Einträge chronologisch absteigend (neueste oben) angezeigt
- [ ] Angenommen ein Kontakt hat noch keine protokollierten Interactions, wenn der Nutzer ihn öffnet, dann wird ein Empty-State mit Hinweis und "Kontaktmoment hinzufügen"-Button angezeigt
- [ ] Angenommen eine Interaction existiert, wenn der Nutzer auf "Bearbeiten" klickt, dann öffnet sich das Formular vorausgefüllt mit Datum, Kanal und Notiz
- [ ] Angenommen eine Interaction wird bearbeitet und gespeichert, dann werden die neuen Werte sofort im Verlauf sichtbar
- [ ] Angenommen die bearbeitete Interaction war die bisher jüngste des Kontakts, wenn ihr Datum verändert wird, dann werden `last_contacted_at`/`next_followup_at` des Kontakts neu aus dem tatsächlich jüngsten verbleibenden Eintrag berechnet
- [ ] Angenommen eine Interaction existiert, wenn der Nutzer auf "Löschen" klickt, dann erscheint ein Bestätigungsdialog bevor der Eintrag entfernt wird
- [ ] Angenommen die gelöschte Interaction war die bisher jüngste des Kontakts, wenn sie entfernt wird, dann werden `last_contacted_at`/`next_followup_at` neu aus dem jeweils nächstjüngeren verbleibenden Eintrag berechnet (oder geleert, falls keine Interaction mehr existiert)
- [ ] Angenommen die Supabase-API ist beim Speichern nicht erreichbar, wenn der Nutzer das Formular abschickt, dann wird eine Fehlermeldung angezeigt und die Eingabe bleibt im Formular erhalten
- [ ] Angenommen Nutzer A ist eingeloggt, wenn er versucht auf Interactions von Nutzer B zuzugreifen, dann liefert die Datenbank keine Zeile zurück (RLS bereits in PROJ-1 erzwungen)

## Edge Cases
- Letzte verbleibende Interaction eines Kontakts wird gelöscht → `last_contacted_at`/`next_followup_at` werden geleert (null), kein Fallback-Wert
- Zwei Interactions mit identischem Datum/Kanal → erlaubt, keine Duplikat-Prüfung
- Sehr lange Notiz → analog zu Kontakt-Notizen max. 2000 Zeichen, Validierungsfehler bei Überschreitung
- Doppelter Klick auf "Speichern" während Request läuft → Button disabled (Loading-State), kein doppelter Insert
- Kontakt wird gelöscht (PROJ-3) während sein Interaction-Dialog offen ist → Cascade-Delete aus PROJ-1 entfernt zugehörige Interactions automatisch, Dialog zeigt Fehler/schließt sich
- Datum exakt heute → erlaubt (kein Validierungsfehler), nur Datum > heute wird abgelehnt

## Technical Requirements
- Security: RLS bereits aktiv seit PROJ-1 — kein zusätzlicher App-seitiger Check nötig, `user_id` nie aus Client-Eingabe übernehmen
- Validierung: Datum Pflicht (nicht in der Zukunft), Kanal Pflicht (Treffen/Call/Nachricht/Event), Notiz optional max. 2000 Zeichen
- Trigger-Erweiterung: bisheriger PROJ-1-Trigger reagiert nur auf Insert — muss um Update/Delete erweitert werden, damit `last_contacted_at`/`next_followup_at` immer den tatsächlich jüngsten Interaction-Eintrag widerspiegeln (technische Umsetzung in `/architecture`)

## Open Questions
_Keine offenen Fragen — siehe Decision Log._

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Dialog/Sheet von Kontaktliste aus statt eigene Detailseite | Kein Seitenwechsel nötig, passt zu bisherigem Pattern (Dialog statt eigene Seite wie PROJ-3) | 2026-06-22 |
| Formularfelder: Datum + Kanal Pflicht, Notiz optional | Schnelle Erfassung deckt PRD-Ziel "<30 Sekunden", Datum erlaubt auch Nacherfassen vergangener Kontakte | 2026-06-22 |
| Edit + Delete für bestehende Interactions erlaubt | Tippfehler/falscher Kanal sonst nicht korrigierbar, Löschen mit Bestätigungsdialog wie bei Kontakten | 2026-06-22 |
| Verlauf zeigt alle Einträge chronologisch absteigend, kein Limit/Pagination | MVP-Netzwerke haben wenige Einträge pro Kontakt, Pagination unnötiger Aufwand | 2026-06-22 |
| `last_contacted_at`/`next_followup_at` werden bei jeder Änderung (Insert/Update/Delete) neu berechnet | Follow-up-Dashboard (PROJ-6) braucht korrekte Werte, sonst veralten sie bei nachträglicher Korrektur/Löschung der jüngsten Interaction | 2026-06-22 |
| Datum darf nicht in der Zukunft liegen | Interaktions-Log protokolliert stattgefundene Kontakte, kein Termin-/Kalender-Feature (Non-Goal laut PRD) | 2026-06-22 |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|----------|-----------|------|
| Separater Icon-Button auf Kontakt-Karte statt Tabs im bestehenden ContactFormDialog | Kein Umbau eines produktiven, getesteten Formulars; risikofreier neuer Einstiegspunkt | 2026-06-22 |
| shadcn `Sheet` statt `Dialog` für Verlauf-Ansicht | Mehr vertikaler Platz für variable Anzahl Einträge, konsistent mit anderen Listen-Patterns | 2026-06-22 |
| Ein Formular für Erfassen + Bearbeiten einer Interaction | Gleiche Felder/Validierung, keine Logik-Duplikation (analog ContactFormDialog) | 2026-06-22 |
| Direkter Supabase-Client-Zugriff, keine eigene API-Route | Konsistent mit PROJ-3/PROJ-4, RLS erzwingt Ownership serverseitig | 2026-06-22 |
| PROJ-1-Trigger erweitert auf Update/Delete (nicht nur Insert) | `last_contacted_at`/`next_followup_at` müssen Datenbank-seitig immer korrekt bleiben, kein Frontend-Berechnungsrisiko | 2026-06-22 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Component Structure

```
Kontakt-Karte (aus PROJ-4)
├── Bestehender Klick → Bearbeiten-Dialog (PROJ-3, unverändert)
└── Neuer "Verlauf"-Icon-Button → öffnet Interaktions-Log-Sheet
    ├── Header: Kontaktname
    ├── "Kontaktmoment hinzufügen"-Button → öffnet Interaction-Formular
    │   ├── Datum-Feld (Default: heute, kein Datum in Zukunft wählbar)
    │   ├── Kanal-Auswahl (Treffen / Call / Nachricht / Event) — Pflicht
    │   └── Notiz-Feld (optional)
    ├── Verlauf-Liste (chronologisch absteigend, kein Limit)
    │   └── Pro Eintrag: Datum, Kanal-Badge, Notiz, "Bearbeiten"/"Löschen"-Icons
    ├── Bearbeiten → öffnet dasselbe Formular vorausgefüllt
    ├── Löschen → Bestätigungsdialog vor Entfernen
    └── Empty State ("Noch keine Kontaktmomente") wenn Liste leer
```

### Data Model (plain language)

Keine neue Tabelle — nutzt die bestehende `interactions`-Tabelle aus PROJ-1 unverändert (Datum, Kanal, Notiz, Zugehörigkeit zu Kontakt + Nutzer).

Einzige Erweiterung der bestehenden Automatisierung: die in PROJ-1 angelegte Datenbank-Automatik aktualisiert „letzter Kontakt“/„nächstes Follow-up“ bisher nur beim Neu-Anlegen einer Interaction. Diese Automatik wird erweitert, damit sie auch beim Bearbeiten oder Löschen eines Eintrags greift — so bleiben die Werte am Kontakt immer korrekt, selbst wenn der zuletzt protokollierte Kontaktmoment nachträglich geändert oder entfernt wird.

### Tech Decisions (justified)

- **Separater Icon-Button auf der Kontakt-Karte statt Tabs im Bearbeiten-Dialog:** Bestehender `ContactFormDialog` aus PROJ-3 bleibt unverändert, kein Umbau eines bereits produktiven, getesteten Formulars nötig — neuer Einstiegspunkt fügt sich ohne Risiko für bestehendes Verhalten hinzu.
- **shadcn `Sheet` statt `Dialog` für den Verlauf:** Verlauf kann mehrere Einträge enthalten und braucht mehr vertikalen Platz als ein zentriertes Dialog-Fenster — ein seitliches Sheet mit Scroll-Bereich passt besser, gleiches Pattern wie andere Listen-Ansichten im Projekt.
- **Ein Formular für Erfassen UND Bearbeiten einer Interaction:** Gleiche Felder, gleiche Validierung — analog zur bereits etablierten Entscheidung bei `ContactFormDialog` (PROJ-3), keine Logik-Duplikation.
- **Direkter Supabase-Client-Zugriff, keine eigene API-Route:** Konsistent mit PROJ-3/PROJ-4, RLS erzwingt Ownership bereits serverseitig.
- **Automatisierung für „letzter Kontakt“/„nächstes Follow-up“ in der Datenbank erweitert (nicht im Frontend berechnet):** Verhindert, dass das Frontend bei jeder Änderung selbst neu berechnen und mit der Datenbank synchron halten muss — gleiche Architektur-Linie wie die bestehende Insert-Automatik aus PROJ-1.

### Dependencies (Packages)
- Keine neuen Packages — `Sheet`, `Dialog`, `Form`, `AlertDialog`, `Select`, `Textarea` bereits installiert (shadcn/ui)

## QA Test Results

**Tested:** 2026-06-22
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)

### Acceptance Criteria Status

#### AC-1: Kontaktmoment erfassen (Datum+Kanal Pflicht, Notiz optional)
- [x] Speichert mit `user_id = auth.uid()` und Kontakt-ID
- [x] Notiz wird korrekt mitgespeichert

#### AC-2: Kanal fehlt → Validierungsfehler, nicht gespeichert
- [x] "Kanal ist erforderlich" erscheint, kein Insert

#### AC-3: Datum in der Zukunft → Validierungsfehler, nicht gespeichert
- [x] BUG-1 gefixt: `max`-Attribut vom Input entfernt, Zod-Refine validiert jetzt durch — "Datum darf nicht in der Zukunft liegen" erscheint korrekt, kein Insert

#### AC-4: last_contacted_at/next_followup_at aktualisieren sich automatisch bei Insert
- [x] Werte stimmen nach Insert der jüngsten Interaction

#### AC-5: Verlauf chronologisch absteigend, kein Limit
- [x] Mehrere Einträge korrekt sortiert (neueste oben)

#### AC-6: Empty-State ohne Interactions
- [x] "Noch keine Kontaktmomente." + Hinzufügen-Button sichtbar

#### AC-7: Bearbeiten vorausgefüllt + persistiert
- [x] Formular zeigt aktuelle Werte, Speichern aktualisiert Verlauf sofort

#### AC-8: last_contacted_at/next_followup_at bei Bearbeiten der jüngsten Interaction neu berechnet
- [x] Trigger-Erweiterung greift korrekt (smoke-getestet DB-seitig + E2E)

#### AC-9: Löschen mit Bestätigungsdialog
- [x] Dialog erscheint vor Entfernen, Eintrag verschwindet nach Bestätigung

#### AC-10: last_contacted_at/next_followup_at bei Löschen der jüngsten Interaction neu aus verbleibendem Eintrag berechnet (oder null wenn keiner mehr existiert)
- [x] Fallback auf älteren Eintrag korrekt, Felder leeren sich bei letztem Löschen auf `null`

#### AC-11: Netzwerkfehler beim Speichern zeigt Fehler, Eingabe bleibt erhalten
- [x] Fehlermeldung erscheint, Notiz-Feld bleibt befüllt

### Edge Cases Status

#### EC-1: Letzte verbleibende Interaction gelöscht
- [x] `last_contacted_at`/`next_followup_at` werden zu `null`, kein Fallback-Wert

#### EC-2: Zwei Interactions mit identischem Datum/Kanal
- [x] Erlaubt, keine Duplikat-Prüfung (laut Spec gewollt)

#### EC-3: Sehr lange Notiz (>2000 Zeichen)
- [x] Zod-Validierung (max 2000) greift analog zu Kontakt-Notizen, manuell im Code verifiziert

#### EC-4: Doppelter Klick auf "Speichern"
- [x] Button disabled während Request läuft (`isSubmitting`-State), kein doppelter Insert

#### EC-5: Kontakt wird gelöscht während Sheet offen
- [x] Cascade-Delete aus PROJ-1 greift weiterhin (DB-Constraint unverändert)

#### EC-6: Datum exakt heute
- [x] Erlaubt, kein Validierungsfehler (Zod-Refine: `value <= today()`, inklusive heute)

### Security Audit Results
- [x] Authentication: Verlauf/Formular nicht ohne Login erreichbar (Auth-Gate aus PROJ-2)
- [x] Authorization: `interactions` via Anon-Key ohne Token liefert `[]` (RLS aktiv), kein Cross-User-Zugriff möglich
- [x] **BUG-2 gefunden + bereits gefixt (während /backend):** Helper-Funktion `recompute_contact_followup` war initial per `/rest/v1/rpc/...` öffentlich aufrufbar (SECURITY DEFINER ohne Execute-Restriktion) — hätte beliebige `contacts`-Zeilen fremder Nutzer manipulieren können. Fix bereits angewendet (`revoke execute`), hier verifiziert: direkter RPC-Call liefert jetzt `401`
- [x] Supabase Security Advisor clean (nur vorbestehender, PROJ-5-unabhängiger Leaked-Password-Hinweis)
- [x] Input validation: Notiz-Feld wird als reiner Text gerendert (kein `dangerouslySetInnerHTML`), kein XSS-Vektor identifiziert

### Bugs Found

#### BUG-1: Zukunfts-Datum zeigte keine App-eigene Fehlermeldung (FIXED)
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Kontaktmoment-Formular öffnen, Datum in der Zukunft wählen, Kanal wählen, Speichern klicken
  2. Expected: Meldung "Datum darf nicht in der Zukunft liegen" erscheint (Zod-Refine im Code vorhanden)
  3. Actual (vor Fix): Das `max`-Attribut auf dem `<Input type="date">` lässt den Browser die native HTML5-Constraint-Validation greifen (`validity.rangeOverflow = true`) — das blockiert den Form-Submit, bevor react-hook-form/Zod überhaupt laufen. Datensatz wird korrekt NICHT gespeichert, aber es gab keine konsistente, App-eigene Fehlermeldung wie bei den anderen Validierungen
- **Fix:** `max`-Attribut vom Input entfernt (`src/components/interaction-form-dialog.tsx`), Zod-Refine validiert jetzt alleine — Meldung erscheint korrekt, E2E-Test AC-3 verifiziert
- **Priority:** Fixed before deployment

#### BUG-2: Helper-Funktion öffentlich per RPC aufrufbar (FIXED)
- **Severity:** Critical (während Entwicklung gefunden, vor Abschluss von /backend bereits behoben)
- **Steps to Reproduce:** siehe Backend Implementation Notes oben
- **Fix:** `revoke execute on function recompute_contact_followup(uuid) from public, anon, authenticated` — verifiziert: direkter RPC-Call liefert `401`
- **Priority:** Fixed before deployment

### Regression Testing
- PROJ-2 (Auth): alle Tests grün (einzeln/sequenziell)
- PROJ-3 (Kontakt CRUD): alle Tests grün (einzeln/sequenziell) — bei paralleler Ausführung gelegentliche Timeouts durch bekanntes Session-Race bei Mehrfach-Login desselben Test-Accounts bzw. Cold-Compile-Flakiness bei vielen gleichzeitigen Routen (dokumentierte Testinfra-Artefakte, kein PROJ-5-Regression, einzeln/sequenziell durchgängig grün)
- PROJ-4 (Kontaktliste & Filter): alle Tests grün
- `npm test` (Vitest): 2/2 grün

### Summary
- **Acceptance Criteria:** 11/11 vollständig erfüllt
- **Bugs Found:** 2 total (1 Critical, 1 Medium) — beide gefixt und re-verifiziert
- **Security:** Pass (RLS aktiv, RPC-Sicherheitslücke gefunden und gefixt, Advisor clean)
- **Production Ready:** YES
- **Recommendation:** Deploy

## Deployment
- Production URL: https://bambi-w26q.vercel.app
- Deployed: 2026-06-22
- Pre-deploy checks: `npm run build` ✓, `npm run lint` ✓
- Pushed commit `08dbb06` (6 Commits) zu origin/main, Vercel Auto-Deploy auf Produktion
- `/login` in Produktion mit 200 verifiziert

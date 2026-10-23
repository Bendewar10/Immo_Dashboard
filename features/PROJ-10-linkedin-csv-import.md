# PROJ-10: LinkedIn-CSV-Import

## Status: Deployed
**Created:** 2026-06-24
**Last Updated:** 2026-06-28

> Refinement 2026-06-28 (Nachmittag): Erkannte Jobwechsel/Beförderungen werden jetzt zusätzlich persistiert (neue Tabelle `contact_events`), damit PROJ-6 sie auf dem Dashboard anzeigen kann — reverst die vorherige Entscheidung "kein Change-Log in der DB". Noch nicht implementiert, folgt über `/architecture`+`/backend`. Siehe "Acceptance Criteria" (neue Subsektion "Persistenz für Dashboard") und Decision Log.
>
> Refinement 2026-06-28 (Vormittag): Vorschau wird von reinen Summary-Zahlen auf eine Review-Liste mit Anlass-Erkennung (Jobwechsel/Beförderung) umgebaut, kein automatisches Überschreiben mehr. Frontend für diese Neufassung ist implementiert (siehe "Implementation Notes (Refinement 2026-06-28)" unten); Abschnitte "Implementation Notes", "QA Test Results" und "Deployment" weiter unten beschreiben die ursprünglich deployte Vorgänger-Version.

## Implementation Notes (Refinement 2026-06-28)
- `src/lib/linkedin-import.ts`: `computeImportPlan` liefert jetzt pro Bestandskontakt eine `ContactChange` (Name, Liste von `FieldDiff` mit `field`/`oldValue`/`newValue`, abgeleitete `occasions`) statt eines fertigen Update-Pakets; `FIELD_LABELS` für die UI-Anzeige ergänzt
- Anlass-Erkennung: `Jobwechsel` wenn `employer`-Diff vorhanden und alter Wert nicht leer; `Beförderung` analog für `job_title`; beide gleichzeitig möglich
- `src/components/linkedin-import-dialog.tsx`: Vorschau zeigt jetzt "Neue Kontakte" (editierbare employer/job_title/email-Felder) und "Veränderungen" (gruppiert pro Person, alt→neu pro Feld, editierbar, Anlass-Badges) — je mit Checkbox (default an); "Bestätigen" schreibt nur angehakte Zeilen mit ihrem aktuellen (ggf. bearbeiteten) Wert
- `tests/PROJ-10-linkedin-csv-import.spec.ts`: bestehende E2E-Tests an neue UI-Texte/Struktur angepasst, 2 neue Tests ergänzt (Checkbox-Ausschluss, Wert-Bearbeitung vor Bestätigen)
- `src/lib/linkedin-import.test.ts`: Tests auf neue `changes`-Struktur umgestellt, 3 neue Tests für Anlass-Tagging (Jobwechsel, Beförderung, beide gleichzeitig, kein Tag bei Erstbefüllung)
- Keine Schema-Änderung, kein neuer Server-Endpoint (Tech Design bestätigt)
- `npm run lint` + `npm run build` + `npm test` (50/50) fehlerfrei

## Backend Implementation Notes (Refinement 2026-06-28, Nachmittag)
- Migration `create_contact_events` (gemeinsam mit PROJ-6 angewendet, siehe dortige Spec für exaktes Schema/RLS) — neue Tabelle, von hier aus nur beschrieben/befüllt
- `src/components/linkedin-import-dialog.tsx` (`handleConfirm`): nach dem bestehenden Kontakt-Update-Loop ein zusätzlicher Schritt — für jede angehakte Veränderung mit `occasions` wird pro Anlass-Tag eine Zeile gebaut (`contact_id`, `user_id`, `type`) und in Batches von 50 (`BATCH_SIZE`, gleiche Konstante wie der bestehende Kontakt-Insert) in `contact_events` eingefügt
- Kein neuer Server-Endpoint: Insert läuft über denselben direkten Supabase-Client-Zugriff wie der restliche Import, RLS auf `contact_events` schützt analog zu `contacts`
- **Manuell end-to-end verifiziert** (siehe PROJ-6-Spec, Backend-Notiz 2026-06-28): echter Import mit Arbeitgeber-Wechsel legt korrekt eine `Jobwechsel`-Zeile in `contact_events` an
- `npm run build` + `npm run lint` + `npm test` (52/52) weiterhin fehlerfrei
- E2E PROJ-10 (6/6) + volle Regression aller anderen Specs (73/73) — **79/79 grün** (`--workers=1`)

## Dependencies
- PROJ-3 (Kontakt anlegen & verwalten) — Kontakte werden in dieselbe `contacts`-Tabelle angelegt/aktualisiert, nutzt `first_name`/`last_name`/`employer`/`job_title`/`email`
- **Neu (Refine 2026-06-28):** PROJ-6 (Follow-up Dashboard) — konsumiert die hier neu geschriebene `contact_events`-Tabelle, zeigt offene Events in der Dashboard-Sektion "Kürzlich erkannt" an und markiert sie dort als dismissed

## Implementation Notes
- `src/lib/linkedin-import.ts`: reine Funktionen `parseLinkedInCsv` (Header-Suche + `papaparse`) und `computeImportPlan` (Matching/Diff), 11 Vitest-Tests inkl. Header-Präambel, Quoted-Commas ("Lang, LL.M."), Case-insensitive Name-Fallback, Mehrfach-Treffer
- `src/components/linkedin-import-dialog.tsx`: Datei-Upload → Vorschau (Zahlen) → Bestätigen → Batch-Insert (50er-Gruppen) + Einzel-Updates über direkten Supabase-Client
- `src/components/contact-list.tsx`: neuer "LinkedIn importieren"-Button neben "Kontakt hinzufügen", übergibt bereits geladene `contacts` an den Dialog (kein Extra-Fetch)
- `src/lib/contacts.ts`: `Contact`-Interface um `linkedin_url` ergänzt
- `npm run build` + `npm run lint` + `npm test` (48/48) laufen fehlerfrei durch

## Backend Implementation Notes
- Migration `add_linkedin_url_to_contacts` (nullable text, kein Constraint) direkt auf Live-Projekt angewendet — gleiches Erweiterungsmuster wie `phone`/`email`/`city`
- Kein neuer API-Endpoint: Import läuft komplett über direkten Supabase-Client-Zugriff vom Frontend (RLS aus PROJ-1 erzwingt `user_id`-Ownership bei Insert/Update bereits serverseitig)
- Keine neue RLS-Policy nötig (bestehende `contacts`-Policies decken die neue Spalte automatisch ab)
- Supabase Security Advisors nach Migration geprüft: keine neuen Findings

## User Stories
- Als Nutzer möchte ich meinen jährlichen LinkedIn-Connections-Export als CSV hochladen können, damit ich nicht jeden Kontakt einzeln manuell anlegen muss
- Als Nutzer möchte ich, dass bereits vorhandene Kontakte beim Re-Upload aktualisiert (z.B. neuer Arbeitgeber) statt dupliziert werden, damit mein Netzwerk konsistent bleibt
- Als Nutzer möchte ich vor dem eigentlichen Import sehen, wie viele Kontakte neu angelegt bzw. aktualisiert werden, damit ich nicht versehentlich falsche Daten importiere
- Als Nutzer möchte ich, dass von mir bereits gepflegte Felder (Kategorie, Stärke, Notizen etc.) beim Import unangetastet bleiben, damit meine manuelle Einordnung nicht überschrieben wird
- Als Nutzer möchte ich, dass importierbare Felder (employer, job_title, last_name, email, linkedin_url) bei Bestandskontakten NIE automatisch überschrieben werden, sondern erst nach meiner Bestätigung, damit eigene Korrekturen/Ergänzungen an diesen Feldern zwischen zwei Importen nicht verloren gehen
- Als Nutzer möchte ich pro Person sehen, welche Felder sich seit dem letzten Import geändert haben (alt→neu), gruppiert statt einzeln verstreut, damit ich auf einen Blick erfasse, was bei wem passiert ist
- Als Nutzer möchte ich, dass Jobwechsel oder Beförderungen explizit als Anlass markiert werden, damit ich erkenne, bei wem es sich gerade lohnt, sich zu melden
- Als Nutzer möchte ich Werte in der Vorschau direkt bearbeiten können (neue Kontakte und Veränderungen), damit ich CSV-Eigenheiten vor dem Speichern korrigieren kann
- Als Nutzer möchte ich einzelne Zeilen (einen neuen Kontakt oder die Änderungen einer Person) gezielt von der Übernahme ausschließen können, ohne den ganzen Import abzubrechen
- **Neu (Refine 2026-06-28):** Als Nutzer möchte ich, dass ein erkannter Jobwechsel/eine Beförderung auch nach Schließen des Import-Dialogs nicht verloren geht, damit ich ihn auf dem Dashboard sehe, selbst wenn ich ihn beim Import selbst übersehen oder den Dialog einfach weggeklickt habe

## Out of Scope
- Live-Synchronisation/OAuth mit LinkedIn — bewusst nur manueller, einmaliger CSV-Upload (PRD-Non-Goal "keine LinkedIn-API-Synchronisation" bezieht sich auf automatisches/laufendes Sync, nicht auf bewussten manuellen Upload — Entscheidung im Interview bestätigt)
- Export von Kontakten zurück als CSV — nur Import-Richtung
- Unterstützung anderer CSV-Formate (Xing, Outlook-Kontakte etc.) — nur das LinkedIn-"Connections.csv"-Format
- Spalte "Connected On" — wird beim Import ignoriert, kein passendes Datenfeld am Kontakt vorhanden, kein neues Feld dafür eingeführt
- Automatische Auflösung von Mehrfach-Namens-Treffern ohne `linkedin_url` — bei Ambiguität wird einfach der erste Treffer verwendet (siehe Edge Cases), kein Dialog zur manuellen Auswahl
- Rollback/Undo nach bestätigtem Import — Import ist idempotent (erneuter Upload gleicher Datei überschreibt nur mit denselben Werten), das reicht als Sicherheitsnetz
- Anlass-Tags für andere Felder als employer/job_title (z.B. neue Stadt, neue E-Mail) — diese Feldänderungen erscheinen weiterhin in der Veränderungs-Liste, aber ohne "Jobwechsel"/"Beförderung"-Tag
- ~~Persistente Historie/Protokoll erkannter Veränderungen über den aktuellen Import-Lauf hinaus — Anlass-Erkennung ist reine Diff-Berechnung der aktuellen Vorschau, nichts wird als "Change-Log" in der DB gespeichert~~ — **reverst im Refine vom 2026-06-28**, siehe neue AC-Subsektion "Persistenz für Dashboard" und Decision Log; Grund: PROJ-6 braucht persistente Events, um sie auf dem Dashboard zu zeigen
- Benachrichtigung (E-Mail/Push) bei erkannten Anlässen außerhalb des Import-Dialogs — Anzeige nur innerhalb der Vorschau des aktuellen Imports bzw. (neu) der Dashboard-Sektion "Kürzlich erkannt" aus PROJ-6, kein separater Push/E-Mail-Kanal
- **Neu (Refine 2026-06-28):** Eigene UI zum Verwalten/Löschen von `contact_events` innerhalb von PROJ-10 — Lesen/Dismiss passiert ausschließlich über das PROJ-6-Dashboard, PROJ-10 schreibt nur beim Import-Bestätigen

## Acceptance Criteria

- [ ] Angenommen der Nutzer ist eingeloggt, wenn er eine gültige LinkedIn-CSV-Datei hochlädt, dann zeigt eine Vorschau zwei Listen — "Neue Kontakte" (Name + employer/job_title/email, editierbar, Checkbox default aktiv) und "Veränderungen" gruppiert pro Person (alle abweichenden Felder dieser Person zusammen, alt→neu, editierbar, Checkbox default aktiv) — sowie die einfachen Zähler "unverändert" und "übersprungen", bevor irgendetwas gespeichert wird
- [ ] Angenommen der employer eines Bestandskontakts unterscheidet sich vom CSV-Wert (alter und neuer Wert beide nicht leer), dann zeigt die Veränderungs-Zeile dieser Person das Anlass-Tag "Jobwechsel"
- [ ] Angenommen der job_title eines Bestandskontakts unterscheidet sich vom CSV-Wert (alter und neuer Wert beide nicht leer), dann zeigt die Veränderungs-Zeile dieser Person das Anlass-Tag "Beförderung"
- [ ] Angenommen employer UND job_title einer Person unterscheiden sich gleichzeitig (beide jeweils nicht leer), dann zeigt die Veränderungs-Zeile dieser Person beide Anlass-Tags "Jobwechsel" und "Beförderung" gemeinsam
- [ ] Angenommen ein Feld (employer, job_title, last_name, email oder linkedin_url) eines Bestandskontakts ist aktuell leer und die CSV liefert dafür einen Wert, dann erscheint dies in der Veränderungs-Liste als Feld-Update ohne Anlass-Tag ("Neu erfasst"), wird aber NICHT automatisch im Hintergrund gespeichert
- [ ] Angenommen ein Feld eines Bestandskontakts ist bereits gesetzt und der CSV-Wert ist identisch, dann erscheint dieses Feld nicht in der Veränderungs-Liste (Kontakt zählt als "unverändert", falls kein anderes Feld abweicht)
- [ ] Angenommen der Nutzer bearbeitet einen Wert direkt in der Vorschau (neuer Kontakt oder Veränderung), wenn er danach "Bestätigen" klickt, dann wird der bearbeitete Wert gespeichert, nicht der ursprüngliche CSV-Wert
- [ ] Angenommen der Nutzer hakt die Checkbox einer Zeile in "Neue Kontakte" ab, dann wird für diesen CSV-Eintrag beim Bestätigen kein Kontakt angelegt
- [ ] Angenommen der Nutzer hakt die Checkbox einer Person in "Veränderungen" ab, dann wird beim Bestätigen kein Feld dieser Person verändert (auch nicht einzelne der gruppierten Felder)
- [ ] Angenommen die Vorschau wird angezeigt, wenn der Nutzer auf "Bestätigen" klickt, dann werden ausschließlich die weiterhin angehakten Zeilen mit ihren (ggf. bearbeiteten) Werten gespeichert und eine Erfolgsmeldung mit den finalen Zahlen angezeigt
- [ ] Angenommen die Vorschau wird angezeigt, wenn der Nutzer auf "Abbrechen" klickt, dann wird kein Kontakt angelegt oder verändert
- [ ] Angenommen ein CSV-Eintrag hat eine `linkedin_url`, die exakt zu einem bestehenden Kontakt passt, dann wird dieser Kontakt der Veränderungs-Liste zugeordnet statt ein neuer Kontakt angelegt
- [ ] Angenommen ein CSV-Eintrag hat keine zu `linkedin_url` passende Übereinstimmung, aber Vorname+Nachname stimmen case-insensitive mit einem bestehenden Kontakt ohne gesetzte `linkedin_url` überein, dann wird dieser Kontakt der Veränderungs-Liste zugeordnet (inkl. Ergänzung der `linkedin_url` als Feld-Update)
- [ ] Angenommen ein CSV-Eintrag hat weder per `linkedin_url` noch per Name eine Übereinstimmung, dann erscheint er in "Neue Kontakte" (Kategorie/Stärke/Kontext/Notizen/Stadt/Telefon/Geburtstag bleiben bei Anlage leer)
- [ ] Angenommen Kategorie, Beziehungsstärke, Kontext, Notizen, Stadt, Telefonnummer oder Geburtstag sind an einem bestehenden Kontakt bereits gesetzt, dann werden sie durch den Import nie verändert und tauchen nie in der Veränderungs-Liste auf (CSV liefert diese Felder nicht)
- [ ] Angenommen eine CSV-Zeile hat keinen Vorname-Wert, dann wird diese Zeile übersprungen und im "übersprungen"-Zähler der Vorschau mitgezählt
- [ ] Angenommen die hochgeladene Datei hat keine Zeile, die mit der Kopfzeile `First Name,Last Name,URL` beginnt, dann wird eine Fehlermeldung "Keine gültige LinkedIn-Export-Datei" angezeigt und kein Import-Versuch unternommen
- [ ] Angenommen die Supabase-API ist beim tatsächlichen Speichern (nach "Bestätigen") nicht erreichbar, dann wird eine Fehlermeldung angezeigt; bereits gespeicherte Zeilen bleiben gespeichert (kein Rollback), ein erneuter Upload derselben Datei ist sicher (idempotent)
- [ ] Angenommen Nutzer A ist eingeloggt, wenn er eine CSV importiert, dann werden alle importierten/aktualisierten Kontakte ausschließlich mit `user_id = auth.uid()` gespeichert (RLS aus PROJ-1 erzwungen, kein Zugriff auf/Vermischen mit Kontakten anderer Nutzer)

### Persistenz für Dashboard (Refine 2026-06-28)
- [ ] **Neu:** Angenommen der Nutzer klickt "Bestätigen" und eine angehakte Veränderungs-Zeile hat das Anlass-Tag "Jobwechsel" und/oder "Beförderung", dann wird für jedes zutreffende Tag eine Zeile in `contact_events` angelegt (`contact_id`, `user_id = auth.uid()`, `type`, `detected_at = jetzt`, `dismissed_at = null`)
- [ ] **Neu:** Angenommen eine Veränderungs-Zeile mit Anlass-Tag ist beim Bestätigen NICHT angehakt (vom Nutzer ausgeschlossen), dann wird für diese Person kein `contact_events`-Eintrag angelegt
- [ ] **Neu:** Angenommen ein Feld war vorher leer und wird durch den Import erstmals befüllt ("Neu erfasst", kein Anlass-Tag), dann wird dafür kein `contact_events`-Eintrag angelegt
- [ ] **Neu:** Angenommen das Anlegen der `contact_events`-Zeilen schlägt fehl (z.B. Netzwerkfehler), dann wird das wie ein normaler Speicherfehler behandelt (Fehlermeldung), der Kontakt-Import selbst (Felder employer/job_title/etc.) ist davon unabhängig — kein Rollback der bereits gespeicherten Kontaktdaten nur wegen eines fehlgeschlagenen Event-Inserts

## Edge Cases
- Zwei oder mehr bestehende Kontakte mit identischem Vorname+Nachname, keiner hat `linkedin_url` gesetzt → der erste gefundene Treffer wird aktualisiert (keine Disambiguierung in MVP, geringe Praxisrelevanz im persönlichen Netzwerk)
- Komplett leere CSV-Zeile (nur Datum, alle anderen Felder leer) → wird wie "kein Vorname" behandelt, übersprungen
- Sehr große CSV-Datei (mehrere hundert Zeilen) → kein explizites Zeilenlimit in MVP, Verarbeitung läuft client-seitig in Batches
- Sonderzeichen/Umlaute in Namen/Firmen (UTF-8) → werden korrekt übernommen, solange die Datei UTF-8-kodiert ist (LinkedIn-Standard-Export); fehlerhafte Kodierung anderer Quellen wird nicht erkannt/korrigiert
- Doppelter Klick auf "Importieren" während der Import läuft → Button disabled (Loading-State), kein doppelter Import-Lauf
- Erneuter Upload derselben Datei → fast alle Einträge landen in "unverändert" (Werte sind identisch), keine Duplikate
- CSV enthält eine Zeile mit `linkedin_url`, die zu einem Kontakt eines ANDEREN Nutzers gehören würde → kann nicht passieren, Matching läuft ausschließlich gegen die eigenen (RLS-gefilterten) Kontakte des eingeloggten Nutzers
- Person wechselt gleichzeitig Arbeitgeber und Position → beide Anlass-Tags ("Jobwechsel" + "Beförderung") erscheinen zusammen an einer Veränderungs-Zeile, keine gegenseitige Unterdrückung
- Nutzer hakt eine Veränderungs-Zeile ab, bearbeitet aber trotzdem ein Feld davor → Checkbox-Zustand entscheidet beim Bestätigen, nicht der Bearbeitungs-Zustand; abgehakte Zeilen werden komplett ignoriert, auch wenn Werte bearbeitet wurden
- Nutzer bearbeitet ein Feld einer Person zurück auf den alten Wert → Feld bleibt trotzdem in der Veränderungs-Liste sichtbar (Diff wird einmalig beim Laden der Vorschau berechnet, nicht live neu bewertet), aber der gespeicherte Wert entspricht dann dem (unveränderten) alten Wert — kein faktisches Update beim Bestätigen
- Sehr viele gleichzeitige Veränderungen (z.B. 200 Personen mit abweichenden Feldern in einer großen Datei) → Liste muss ohne UI-Blockierung scrollbar/handhabbar bleiben, gleiches Batch-Prinzip wie beim Speichern
- **Neu (Refine 2026-06-28):** Zwei Imports nacheinander erkennen beim selben Kontakt jeweils einen Jobwechsel, ohne dass das erste Event auf dem Dashboard dismissed wurde → beide `contact_events`-Zeilen bleiben offen bestehen, kein Dedupe/Merge (siehe PROJ-6 Edge Cases)
- **Neu:** Kontakt wird gelöscht, während er noch offene `contact_events` hat → Events werden per `ON DELETE CASCADE` mitgelöscht (siehe PROJ-6 Technical Requirements)

## Technical Requirements
- Security: RLS aus PROJ-1 deckt Zugriff ab — Import darf `user_id` nie aus Client-Eingabe übernehmen, nur `auth.uid()`
- Validierung: Vorname Pflicht pro Zeile (sonst Skip), restliche Felder wie in PROJ-3 (Längen-Constraints gelten auch für importierte/bearbeitete Werte)
- Feld `linkedin_url` am Kontakt (text, nullable, optional, freier Text wie `phone`/`email` — kein Format-Constraint) — bereits vorhanden
- Performance: Verarbeitung mehrerer hundert Zeilen muss ohne UI-Blockierung möglich sein (Batch-Verarbeitung)
- `computeImportPlan` (oder Nachfolger) muss pro Person eine Liste der abweichenden Felder (Feldname, alter Wert, neuer Wert) statt nur eines Update-Flags liefern, plus berechnete Anlass-Tags ("Jobwechsel"/"Beförderung") nach der Regel: Tag nur wenn alter UND neuer Wert nicht leer sind und sich unterscheiden
- Vorschau-Zustand muss pro Zeile editierbare Werte + Checkbox (default an) halten, unabhängig vom ursprünglichen CSV-Wert — beim Bestätigen werden nur angehakte Zeilen mit ihrem aktuellen (ggf. bearbeiteten) Feldwert geschrieben
- **Neu (Refine 2026-06-28):** Beim Bestätigen wird für jede angehakte Zeile mit Anlass-Tag(s) zusätzlich ein Insert in `contact_events` ausgeführt (ein Datensatz pro Tag) — gleicher Batch-Mechanismus wie der Kontakt-Insert/Update, kein neuer Server-Endpoint nötig (RLS schützt analog zu `contacts`)

## Open Questions
- [x] Exaktes `contact_events`-Schema/Migration → Migration `create_contact_events` angewendet, siehe Backend Implementation Notes (2026-06-28)

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Manueller CSV-Upload widerspricht nicht dem PRD-Non-Goal "keine LinkedIn-Synchronisation" | Non-Goal zielte auf automatisches/laufendes API-Sync (OAuth, Hintergrund-Jobs) ab — ein bewusster, einmaliger manueller Upload ist eher Bulk-Quick-Add als Synchronisation | 2026-06-24 |
| Matching primär über neues Feld `linkedin_url`, Fallback auf Vorname+Nachname | LinkedIn-CSV hat keine andere stabile ID; Name-Fallback deckt Kontakte ab, die schon vor dem ersten Import manuell angelegt wurden | 2026-06-24 |
| Vorschau mit Summary-Zahlen vor Bestätigung statt direktem Import | Bulk-Operation auf potenziell hunderte Kontakte — Nutzer soll Tragweite sehen, bevor etwas gespeichert wird; kein Zeilen-Diff, da das für MVP zu granular wäre | 2026-06-24 |
| Leere CSV-Felder überschreiben nie bestehende Werte | LinkedIn-Exports haben oft leere E-Mail/Firma pro Zeile — sonst würde Import versehentlich bereits gepflegte Daten löschen | 2026-06-24 |
| Nur `first_name`/`last_name`/`employer`/`job_title`/`email`/`linkedin_url` werden importiert/aktualisiert, alle anderen Kontaktfelder bleiben unberührt | CSV liefert diese Daten gar nicht — Kategorie/Stärke/Kontext/Notizen/Stadt/Telefon/Geburtstag sind bewusste manuelle Kuration des Nutzers, der Import darf sie nicht antasten | 2026-06-24 |
| "Connected On"-Spalte wird ignoriert | Kein passendes Datenfeld vorhanden, kein neues Feld nur dafür eingeführt (Konsistenz mit Lean-Prinzip aus PROJ-3-Refine) | 2026-06-24 |
| Zeilen ohne Vorname werden übersprungen, kein Abbruch des Gesamtimports | Einzelne kaputte Zeilen (leere Zeilen, fehlende Daten) sollen den Rest des Imports nicht blockieren | 2026-06-24 |
| Parser sucht nach Zeile beginnend mit `First Name,Last Name,URL` als echte Kopfzeile, ignoriert Erklärtext davor | Echte LinkedIn-Exports enthalten eine Notiz-Präambel vor der eigentlichen Kopfzeile | 2026-06-24 |
| Mehrfache Namens-Treffer ohne `linkedin_url`: erster Treffer wird verwendet, keine Disambiguierungs-UI | Pragmatischer MVP-Kompromiss, geringe Praxisrelevanz bei einem persönlichen statt einem Massen-Netzwerk | 2026-06-24 |
| **(überschreibt vorherige Entscheidung)** Importierbare Felder (`employer`/`job_title`/`last_name`/`email`/`linkedin_url`) werden bei Bestandskontakten nie mehr automatisch geschrieben — auch nicht bei abweichendem, nicht-leerem CSV-Wert. Erst nach Review in der Vorschau und explizitem "Bestätigen" | Nutzer enricht/korrigiert diese Felder selbst zwischen zwei Imports — automatisches Überschreiben bei Re-Upload hätte das wieder zerstört | 2026-06-28 |
| **(überschreibt vorherige Entscheidung)** Vorschau bekommt granulare Zeilen-Listen ("Neue Kontakte", "Veränderungen" pro Person) statt nur Summary-Zahlen | Nutzer will aktiv erkennen, bei wem sich beruflich was getan hat, um gezielt nachzufassen — reine Zahlen reichten dafür nicht | 2026-06-28 |
| Anlass-Tag "Jobwechsel" bei abweichendem `employer`, "Beförderung" bei abweichendem `job_title` — jeweils nur wenn alter UND neuer Wert nicht leer sind; beide Tags können gleichzeitig an einer Person hängen | Erstmalige Befüllung (alter Wert leer) ist kein "Wechsel", sondern neue Information; eine Person kann gleichzeitig Arbeitgeber und Position wechseln | 2026-06-28 |
| Jede Zeile (neuer Kontakt / Person mit Änderungen) hat eine standardmäßig aktive Checkbox zum gezielten Ausschluss vor dem finalen Speichern | Nutzer soll einzelne fragwürdige Treffer/Änderungen ausschließen können, ohne den gesamten Import abzubrechen | 2026-06-28 |
| Werte in der Vorschau sind direkt editierbar; gespeichert wird der Wert im Feld zum Zeitpunkt des Bestätigens | Nutzer will Tippfehler/CSV-Eigenheiten vor dem Speichern korrigieren, statt erst danach über den separaten Edit-Dialog | 2026-06-28 |
| **(reverst vorherige Entscheidung "kein Change-Log in der DB")** Erkannte Jobwechsel/Beförderungen werden ab jetzt in neuer Tabelle `contact_events` persistiert, statt nur als flüchtiges Vorschau-Ergebnis zu existieren | PROJ-6-Refine: Nutzer will diese Anlässe auch auf dem Dashboard sehen, nicht nur im Moment des Imports — das setzt Persistenz voraus | 2026-06-28 (Nachmittag) |
| Kein Dedupe von `contact_events` bei wiederholt erkanntem selben Wechsel über mehrere Imports | Geringe Praxisrelevanz (Nutzer importiert selten mehrfach ohne dazwischen zu reagieren), Dedupe-Logik wäre Mehraufwand ohne klaren Nutzen für MVP | 2026-06-28 (Nachmittag) |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|----------|-----------|------|
| Neue Spalte `linkedin_url` (nullable, kein Constraint) statt eigener Mapping-Tabelle | Gleiches Erweiterungsmuster wie `phone`/`email`/`city` aus PROJ-3, kein neues Datenmodell für eine einzelne zusätzliche Spalte nötig | 2026-06-24 |
| CSV-Parsing + Matching/Diff komplett client-seitig, kein Server-Endpoint | Keine Secrets involviert, direkter Supabase-Zugriff reicht (RLS erzwingt Ownership), konsistent mit PROJ-3/4/5-Pattern | 2026-06-24 |
| `papaparse` als CSV-Parser-Package | Vermeidet Bugs durch eingebettete Kommas in Anführungszeichen-Feldern (z.B. Nachnamen mit Titel-Suffix), Standard-Library statt Eigenbau | 2026-06-24 |
| Vorschau-Berechnung und tatsächlicher Speichervorgang als zwei getrennte Funktionsaufrufe | Erzwingt den im Spec festgelegten Bestätigungs-Schritt technisch, verhindert versehentliches Schreiben beim bloßen Anzeigen der Vorschau | 2026-06-24 |
| Bulk-Insert/Update in Batches (z.B. 50 Zeilen pro Request) | Vermeidet Request-Größen-/Timeout-Probleme bei großen Exportdateien | 2026-06-24 |
| Diff-Berechnung liefert pro Bestandskontakt eine Liste von Feld-Unterschieden (Feldname, alt, neu) statt eines fertigen Update-Pakets | UI muss jedes Feld einzeln anzeigen, editieren und mit Anlass-Tags versehen können — ein flaches Update-Objekt könnte das nicht abbilden | 2026-06-28 |
| Anlass-Tags ("Jobwechsel"/"Beförderung") werden bei jeder Vorschau-Berechnung aus den Feld-Unterschieden abgeleitet, nicht am Kontakt gespeichert | Reiner Anzeige-Hinweis für den aktuellen Import-Lauf, keine Schema-Änderung/Pflegeaufwand für einen Status, der sich beim nächsten Import ohnehin neu berechnet | 2026-06-28 |
| Checkbox- (angehakt/ausgeschlossen) und Bearbeitungs-Zustand jeder Vorschau-Zeile lebt nur im Dialog-Zustand des Browsers, nicht in der Datenbank | Konsistent mit bestehender Entscheidung "Vorschau ist reiner Browser-Zustand"; verworfen bei Abbrechen/Schließen, kein Entwurfs-Datenmodell nötig | 2026-06-28 |
| Keine neuen Packages — Diff/Tag-Logik bleibt in der bestehenden `linkedin-import.ts`, nur die Rückgabestruktur wird feingranularer | Reine Erweiterung bestehender reiner Funktionen, kein neuer technischer Bedarf | 2026-06-28 |
| Neue Tabelle `contact_events` statt neue Spalte an `contacts` | Mehrere offene Events pro Kontakt möglich (z.B. zwei Imports ohne Dismiss dazwischen), eine Spalte könnte nur den letzten Stand abbilden — siehe PROJ-6 Technical Requirements für genaues Schema | 2026-06-28 (Nachmittag) |
| Insert in `contact_events` läuft im selben Batch-Schritt wie der bestehende Kontakt-Insert/Update, kein zusätzlicher Server-Roundtrip pro Event | Konsistent mit bestehendem Bulk-Insert-Pattern (50er-Batches), RLS auf `contact_events` schützt analog zu `contacts` | 2026-06-28 (Nachmittag) |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Component Structure

```
/contacts
├── "Kontakt hinzufügen"-Button (bestehend, PROJ-3)
├── "LinkedIn importieren"-Button (neu) → öffnet Import-Dialog
│   ├── Schritt 1: Datei-Upload
│   │   ├── Datei-Auswahl (akzeptiert .csv)
│   │   └── Fehlermeldung "Keine gültige LinkedIn-Export-Datei", falls Kopfzeile nicht gefunden
│   ├── Schritt 2: Vorschau (Review-Listen, noch nichts gespeichert)
│   │   ├── Liste "Neue Kontakte" — pro Zeile: Checkbox (default an), Name, editierbare employer/job_title/email-Felder
│   │   ├── Liste "Veränderungen" — pro Person: Checkbox (default an), Name, Liste der abweichenden Felder (alt→neu, editierbar), Anlass-Tags ("Jobwechsel"/"Beförderung") falls zutreffend
│   │   ├── Zähler "unverändert" und "übersprungen (kein Vorname)"
│   │   ├── "Abbrechen"-Button → schließt Dialog, keine Änderung
│   │   └── "Bestätigen"-Button → speichert ausschließlich angehakte Zeilen mit ihrem aktuellen (ggf. bearbeiteten) Wert
│   └── Schritt 3: Erfolgsmeldung mit finalen Zahlen, Kontaktliste aktualisiert sich
```

### Data Model (plain language)

`contacts` hat bereits die Spalte `linkedin_url` (Text, optional) — gleiches Muster wie `phone`/`email` aus PROJ-3, kein Format-Constraint. Dient als primärer Abgleichs-Schlüssel zwischen CSV-Zeile und bestehendem Kontakt. Keine Schema-Änderung in dieser Iteration nötig.

Kein neues Datenmodell für den Import-Vorgang selbst — die Vorschau bleibt reiner Browser-Zustand. Was sich ändert: Statt pro Bestandskontakt nur ein fertiges "Update-Paket" zu berechnen, berechnet die Vorschau jetzt pro Bestandskontakt eine **Liste einzelner Feld-Unterschiede** (Feldname, alter Wert, neuer Wert) plus eine Liste erkannter Anlässe ("Jobwechsel", "Beförderung") — beides reine Ergebnisse eines Vergleichs, nichts davon wird in der Datenbank gespeichert.

Jede Zeile in der Vorschau (neuer Kontakt oder Person mit Veränderungen) bekommt zusätzlich zwei browserseitige Eigenschaften, die nur während der offenen Vorschau existieren: ob die Zeile aktuell angehakt ist (wird beim Bestätigen übernommen oder ignoriert) und welcher Wert aktuell in den editierbaren Feldern steht (startet mit dem CSV-Wert, kann vom Nutzer überschrieben werden). Erst der Klick auf "Bestätigen" liest diesen Zustand aus und schreibt ihn in die Datenbank.

### Tech Decisions (justified)

- **CSV-Parsing läuft komplett im Browser, kein Server-Roundtrip:** Es sind keine Geheimnisse (API-Keys) involviert, der Nutzer lädt die Datei nur für sich selbst hoch — ein Server-Umweg wäre unnötiger Mehraufwand, gleiche Überlegung wie bei den direkten Supabase-Zugriffen in PROJ-3/4/5.
- **Dedizierter CSV-Parser statt einfachem Komma-Split:** LinkedIn-Exports enthalten Felder mit eingebetteten Kommas in Anführungszeichen (z.B. Nachname "Lang, LL.M." in der Beispieldatei) — ein naiver Split würde Spalten falsch verschieben. Ein robuster, gut getesteter Parser vermeidet diese Fehlerklasse komplett.
- **Vergleich/Matching (Vorschau) und tatsächlicher Speichervorgang sind zwei getrennte Schritte:** Die Vorschau lädt einmal die eigenen Kontakte, berechnet den Diff rein im Speicher und verändert nichts. Erst der zweite, explizite Klick auf "Bestätigen" schreibt tatsächlich — verhindert versehentliches Auto-Save bei einer Bulk-Operation, die hunderte Kontakte betreffen kann.
- **Diff liefert pro Feld einen eigenen Eintrag statt eines fertigen Update-Pakets:** Die Vorschau muss "alt→neu" pro Feld einzeln anzeigen, einzeln editierbar machen und Anlass-Tags daran festmachen können — das geht nur, wenn der Vergleich Feld für Feld auflöst statt direkt ein fertiges Speicherobjekt zu bauen.
- **Anlass-Tags sind ein reines Anzeige-Ergebnis des Vergleichs, keine eigene Datenstruktur:** "Jobwechsel"/"Beförderung" werden bei jeder Vorschau-Berechnung neu aus den Feld-Unterschieden abgeleitet (Regel: altes UND neues Feld nicht leer, Werte unterscheiden sich) — nichts wird als Tag/Status am Kontakt gespeichert, vermeidet Schema-Änderung und Pflegeaufwand für einen reinen Hinweis.
- **Checkbox- und Bearbeitungs-Zustand pro Zeile lebt ausschließlich im Dialog-Zustand des Browsers:** Konsistent mit der bestehenden Entscheidung "Vorschau ist reiner Browser-Zustand" — kein Entwurf/Draft wird in der Datenbank zwischengespeichert, einfach verworfen bei "Abbrechen" oder Schließen des Dialogs.
- **Bulk-Speichern in mehreren kleineren Gruppen statt einem einzigen riesigen Request:** Vermeidet Timeout-/Größenprobleme bei sehr großen Dateien (mehrere hundert Zeilen), ohne dass der Nutzer etwas davon merkt.
- **Matching-Priorität `linkedin_url` vor Name-Fallback:** `linkedin_url` ist stabil und eindeutig pro Person, Name-Fallback ist nur ein Sicherheitsnetz für Kontakte, die vor dem ersten Import schon manuell angelegt wurden (deckt sich mit Produktentscheidung aus dem Spec-Interview).

### Dependencies (Packages)
- `papaparse` — robustes CSV-Parsing (Anführungszeichen, eingebettete Kommas), Standard-Wahl für clientseitiges CSV-Handling, keine Server-Abhängigkeit nötig — keine neuen Packages für diese Iteration

## QA Test Results (Refinement 2026-06-28)

**Tested:** 2026-06-28
**Tester:** QA Engineer (AI)

### Acceptance Criteria Status
- [x] Vorschau zeigt "Neue Kontakte" + "Veränderungen" (gruppiert pro Person) + Zähler "unverändert"/"übersprungen" vor Speicherung
- [x] Abweichender `employer` (alt+neu nicht leer) → Tag "Jobwechsel" (E2E + Vitest)
- [x] Abweichender `job_title` (alt+neu nicht leer) → Tag "Beförderung" (Vitest; UI-Rendering identischer Mechanismus wie Jobwechsel, per Code-Review verifiziert statt separatem E2E)
- [x] Beide Felder gleichzeitig abweichend → beide Tags zusammen (Vitest: `occasions: ['Jobwechsel', 'Beförderung']`)
- [x] Feld vorher leer, CSV liefert Wert → Diff erscheint mit "Neu erfasst"-Badge statt Anlass-Tag (Vitest + E2E; Bug #1 gefixt am 2026-06-28)
- [x] Identisches Feld → kein Diff-Eintrag, Kontakt zählt als unverändert (E2E Re-Upload-Test: "2 unverändert")
- [x] Wert in Vorschau editieren → bearbeiteter Wert wird gespeichert, nicht CSV-Wert (E2E)
- [x] Checkbox bei "Neue Kontakte" abwählen → Kontakt wird nicht angelegt (E2E)
- [x] Checkbox bei "Veränderungen" abwählen → keines der Felder dieser Person wird verändert (E2E, neu ergänzt)
- [x] "Bestätigen" speichert nur angehakte Zeilen mit aktuellem (ggf. bearbeitetem) Wert (E2E)
- [x] "Abbrechen" → kein Kontakt angelegt/verändert (E2E)
- [x] `linkedin_url`-Match → Kontakt landet in "Veränderungen" statt Neuanlage (E2E, da Folge-Importe über `linkedin_url` matchen)
- [x] Name-Fallback-Match (kein `linkedin_url` gesetzt) → Kontakt landet in "Veränderungen" inkl. `linkedin_url`-Ergänzung als Diff (E2E)
- [x] Kein Match → Kontakt in "Neue Kontakte", übrige Felder leer (E2E)
- [x] Kategorie/Stärke/Kontext/Notizen/Stadt/Telefon/Geburtstag nie verändert (E2E: `category: 'friend'` blieb erhalten) und können strukturell nie als Diff erscheinen, da `FIELDS`-Konstante sie nicht enthält (Code-Review)
- [x] Zeile ohne Vorname → übersprungen, im Zähler erfasst (E2E)
- [x] Datei ohne gültige Kopfzeile → Fehlermeldung "Keine gültige LinkedIn-Export-Datei.", kein Import-Versuch (E2E)
- [x] Supabase nicht erreichbar beim Bestätigen → Fehlermeldung (Code-Review: `try/catch` mit `setSubmitError`, identisch zum bereits geprüften Vorgänger-Pattern, kein dedizierter Netzwerk-Fehler-E2E-Test — wie schon in der ursprünglichen QA-Runde 2026-06-24)
- [x] RLS: Insert/Update nutzt ausschließlich `auth.uid()`/serverseitige Policy, `contactId` stammt nicht aus Roh-CSV-Eingabe sondern aus bereits RLS-gefiltertem `existingContacts`-Match (Code-Review)

**19/19 vollständig erfüllt** (nach Fix von Bug #1, siehe unten).

### Edge Cases Status
- [x] Mehrere Namens-Treffer ohne `linkedin_url` → erster Treffer (Vitest)
- [x] Komplett leere CSV-Zeile → wie "kein Vorname" behandelt (Vitest + E2E)
- [x] Person mit gleichzeitigem Arbeitgeber- und Positionswechsel → beide Tags zusammen, keine gegenseitige Unterdrückung (Vitest)
- [x] Checkbox abgehakt trotz bearbeitetem Feld → Checkbox-Zustand entscheidet, abgehakte Zeilen werden beim Bestätigen komplett ignoriert (Code-Review: `included`-Filter läuft vor dem Auslesen der `diffs`/Werte)
- [x] Eingebettete Kommas in Anführungszeichen-Feldern → unverändert von `papaparse` gehandhabt (Vitest)
- [x] Header-Präambel vor echter Kopfzeile → unverändert (Vitest)
- [x] Doppelklick auf "Bestätigen" → Button weiterhin über `isSubmitting` disabled (Code-Review)
- [x] Sehr große CSV-Datei → Diff-Berechnung bleibt O(n), nur pro Feld statt pro Zeile aufgelöst, kein zusätzlicher Netzwerk-Roundtrip; nicht erneut mit der realen 407-Zeilen-Datei nachgetestet, da Logik-Änderung rein auf das Vergleichsergebnis beschränkt ist (kein Risiko für Parser-Performance)
- [x] Re-Upload derselben Datei → 0 neu, 0 Veränderungen, idempotent (E2E)
- [x] `linkedin_url` eines anderen Nutzers → weiterhin unmöglich, Matching nur gegen RLS-gefilterte eigene Kontakte (Code-Review, unverändert)

### Security Audit
- [x] Keine neuen Endpunkte/Secrets — weiterhin reiner Supabase-Client-Zugriff, RLS erzwingt Ownership (unverändert)
- [x] `contactId` für Updates kommt ausschließlich aus dem internen Matching gegen die eigenen, bereits geladenen Kontakte — nicht aus CSV-Rohdaten beeinflussbar, kein IDOR-Vektor
- [x] Editierbare Vorschau-Felder landen als reiner Text in React-State/Supabase-Update — kein `dangerouslySetInnerHTML`, kein XSS-Vektor durch eingegebene oder CSV-gelieferte Werte
- [x] Kein neues PII-Leck: dieselben Felder (`employer`/`job_title`/`email`/`last_name`/`linkedin_url`) wie vorher, jetzt nur granularer angezeigt statt sofort geschrieben — eher weniger Exposure, da nichts mehr automatisch ohne Sichtprüfung gespeichert wird

### Regression Testing
- `npm test`: 50/50 grün (inkl. 14 für `linkedin-import.ts`, 3 davon neu für Anlass-Tagging)
- `npm run lint`, `npm run build`: fehlerfrei
- E2E PROJ-10 (8 Tests, 3 neu: Checkbox-Ausschluss bei Veränderungen, Edit-vor-Bestätigen, "Neu erfasst"-Label): 8/8 grün auf Chromium UND Mobile Safari (iPhone 13)
- E2E Vollregression (alle anderen Specs: PROJ-2/3/4/5/6/8): 73/73 grün
- **Gesamt E2E (Chromium):** 81/81 grün

### Bugs Found

**Bug #1 (Medium) — Gefixt 2026-06-28:** Fehlendes "Neu erfasst"-Label bei Erstbefüllung eines vorher leeren Feldes.
- **Ursprünglicher Zustand:** `src/components/linkedin-import-dialog.tsx` zeigte für diesen Fall nur `— →` als alten Wert, ohne den Text "Neu erfasst" oder ein vergleichbares visuelles Signal.
- **Fix:** Diff-Zeile zeigt jetzt ein `Badge variant="outline"` mit Text "Neu erfasst" statt `oldValue →`, wenn `diff.oldValue` leer ist (kein Jobwechsel/Beförderung-Tag in diesem Fall).
- **Verifiziert:** Neuer E2E-Test `AC: first-time fill of a previously empty field shows "Neu erfasst" instead of an occasion tag`.

### Summary
- **Acceptance Criteria:** 19/19 vollständig erfüllt
- **Bugs Found:** 1 (Medium) — gefixt
- **Security:** Pass
- **Production Ready:** YES
- **Recommendation:** Deploy.

---

## QA Test Results (Refinement 2026-06-28, Nachmittag — Persistenz für Dashboard)

**Tested:** 2026-06-28
**App URL:** http://localhost:3000 (Dev), echtes Supabase-Projekt
**Tester:** QA Engineer (AI)

### Scope
Nur die neue Subsektion "Persistenz für Dashboard" (`contact_events`-Insert beim Bestätigen eines Imports). Volle Details und der zugehörige End-to-End-Test (Import → Dashboard → AI → Dismiss) stehen in der PROJ-6-Spec, QA-Abschnitt "Refine 2026-06-28 (14-Tage-Vorschau + Kürzlich erkannt, Backend)" — hier nur die import-seitigen ACs.

### Acceptance Criteria Status
- [x] Angehakte Veränderungs-Zeile mit Anlass-Tag(s) → beim Bestätigen wird pro Tag eine `contact_events`-Zeile angelegt (verifiziert per direktem REST-Query nach Bestätigen: `type` enthält `Jobwechsel`)
- [x] Ausgeschlossene (nicht angehakte) Veränderungs-Zeile mit Anlass-Tag → kein `contact_events`-Eintrag (verifiziert: leeres Array nach Bestätigen)
- [x] Erstbefüllung eines leeren Feldes ("Neu erfasst") → kein `contact_events`-Eintrag (verifiziert: leeres Array nach Bestätigen)
- [ ] Fehlschlag beim Anlegen der `contact_events`-Zeilen lässt bereits gespeicherte Kontaktdaten unangetastet — **nicht automatisiert getestet** (Netzwerkfehler mitten im Import lässt sich in Playwright nicht zuverlässig auf genau diesen einen Request beschränkt simulieren). Code-Review: `handleConfirm` führt Kontakt-Insert/Update vollständig aus, BEVOR der `contact_events`-Insert-Block beginnt — ein Fehler dort wirft erst danach, bereits geschriebene Kontaktdaten werden nicht zurückgerollt. Verhalten entspricht der AC, Risiko gering (reiner Fallback-Pfad, gleiches Muster wie der bereits bestehende Kontakt-Insert)

**3/4 automatisiert verifiziert, 1 code-reviewed (Netzwerkfehler-Fall, analog zu früheren Clipboard-Error-Präzedenzfällen in diesem Projekt).**

### Security Audit Results
- Siehe PROJ-6-Spec für den vollständigen `contact_events`-RLS-Audit (BUG-5 dort dokumentiert und gefixt — betraf die Tabelle, nicht den Import-Schreibpfad selbst: der Import schreibt ausschließlich `contact_id`s, die der Nutzer per RLS-gefilterter `existingContacts`-Liste bereits selbst besitzt, konnte also dieses Loch über die UI nie ausnutzen)

### Regression Testing
- `tests/PROJ-10-linkedin-csv-import.spec.ts`: 9/9 grün (2 neue Tests für diese ACs)
- `npm test` (70/70), `npm run lint`, `npm run build`: fehlerfrei

### Summary
- **Acceptance Criteria:** 3/4 automatisiert + 1 code-reviewed, alle bestanden
- **Bugs Found:** 0 neue (BUG-5 aus PROJ-6-QA betrifft die Tabelle allgemein, nicht den Import-Pfad — dort gefixt)
- **Security:** Pass
- **Production Ready:** YES
- **Recommendation:** Deploy zusammen mit PROJ-6.

---

## QA Test Results

**Tested:** 2026-06-24
**Tester:** QA Engineer (AI)

### Acceptance Criteria Status
- [x] Vorschau zeigt Zahlen (neu/aktualisiert/unverändert/übersprungen) vor jeder Speicherung
- [x] Bestätigen führt Änderungen durch, zeigt Erfolgsmeldung mit finalen Zahlen
- [x] Abbrechen in der Vorschau → kein Kontakt angelegt/verändert
- [x] Match über `linkedin_url` → bestehender Kontakt wird aktualisiert statt dupliziert
- [x] Kein `linkedin_url`-Match, aber Name-Match (case-insensitive) bei Kontakt ohne `linkedin_url` → aktualisiert + `linkedin_url` wird ergänzt
- [x] Kein Match → neuer Kontakt, übrige Felder (Kategorie/Stärke/Kontext/Notizen/Stadt/Telefon/Geburtstag) leer
- [x] Leeres CSV-Feld überschreibt nie einen bestehenden Wert
- [x] Nicht-leeres, abweichendes CSV-Feld wird übernommen
- [x] Kategorie/Stärke/Kontext/Notizen/Stadt/Telefon/Geburtstag werden vom Import nie verändert (manuell verifiziert: `category: 'friend'` blieb nach Import erhalten)
- [x] Zeile ohne Vorname → übersprungen, im Zähler erfasst
- [x] Datei ohne gültige Kopfzeile → Fehlermeldung "Keine gültige LinkedIn-Export-Datei.", kein Import-Versuch
- [x] Re-Upload derselben Datei → 0 neu, 0 aktualisiert, idempotent (keine Duplikate)
- [x] RLS: Insert/Update nutzt ausschließlich `auth.uid()` aus der Session, keine Client-Eingabe für `user_id` (Code-Review + strukturell identisch zu PROJ-3/4/5-Pattern)

**13/13 Acceptance Criteria passed.**

### Edge Cases Status
- [x] Mehrere Namens-Treffer ohne `linkedin_url` → erster Treffer wird verwendet (Vitest-Test `uses the first match when multiple contacts share the same name...`)
- [x] Komplett leere CSV-Zeile → wie "kein Vorname" behandelt, übersprungen (Vitest + E2E)
- [x] Eingebettete Kommas in Anführungszeichen-Feldern (z.B. Nachname mit Titel-Suffix) → korrekt geparst, `papaparse` übernimmt das (Vitest-Test `handles quoted fields with embedded commas`)
- [x] Header-Präambel vor der echten Kopfzeile (wie im echten LinkedIn-Export) → wird übersprungen, echte Kopfzeile korrekt erkannt (Vitest-Test `skips the notes preamble...`)
- [x] Doppelter Klick auf "Importieren" → Button disabled während Request läuft (Code-Review: `isSubmitting`-State)
- [x] Sehr große CSV-Datei → mit echter LinkedIn-Export-Datei (407 Zeilen, reale Sonderzeichen/Encoding-Artefakte, mehrere komplett leere Zeilen) end-to-end gegen die Vorschau getestet: 403 neue Kontakte erkannt, 4 korrekt übersprungen (leere Zeilen ohne Vorname), Parse+Diff-Berechnung in 23ms — keine Performance-Probleme. Bewusst **nicht bestätigt/importiert** (reale fremde Personendaten, nur Vorschau-Pfad verifiziert, danach abgebrochen, keine Auswirkung auf echte Kontaktdaten)

### Security Audit
- [x] Kein neuer API-Endpoint, keine neuen Secrets — Import läuft ausschließlich über direkten Supabase-Client-Zugriff, RLS aus PROJ-1 erzwingt Ownership bei Insert/Update identisch zu allen anderen Direct-Client-Features (PROJ-3/4/5)
- [x] Supabase Security Advisors nach Migration `add_linkedin_url_to_contacts` geprüft: keine neuen Findings (nur vorbestehender, projektunabhängiger Leaked-Password-Hinweis)
- [x] CSV-Inhalt landet nur als Text in Formularfeldern (kein `dangerouslySetInnerHTML`), kein XSS-Vektor durch hochgeladene Dateinamen/Feldwerte
- [x] Datei-Input akzeptiert nur Client-seitig `.csv` als Hinweis (kein Security-Mechanismus) — echter Schutz kommt vom CSV-Parser selbst, der bei nicht-CSV-Inhalt einfach keine gültige Kopfzeile findet und mit der dokumentierten Fehlermeldung abbricht (manuell mit `.txt`-Inhalt verifiziert)

### Bugs Found
Keine Bugs gefunden.

### Regression Testing
- `npm test`: 48/48 grün (7 unverändert + 11 neue für `linkedin-import.ts`)
- `npm run lint`, `npm run build`: fehlerfrei
- E2E PROJ-10 (4 Tests): 4/4 grün
- E2E Regression PROJ-3 (16), PROJ-4 (11), PROJ-5 (9), PROJ-6 (23), PROJ-8 (9): 68/68 grün — alle `--workers=1`, keine Auswirkung durch neue `linkedin_url`-Spalte oder den neuen Button auf `/contacts`
- **Gesamt E2E:** 73/73 grün

### Summary
- **Acceptance Criteria:** 13/13 passed
- **Bugs Found:** 0
- **Security:** Pass
- **Production Ready:** YES
- **Recommendation:** Deploy.

## Deployment

### Ursprünglicher Deploy (2026-06-24)
- Commit `b74b492` gepusht zu `origin/main`, Tag `v1.9.0-PROJ-10`
- Migration `add_linkedin_url_to_contacts` bereits vorab auf Live-Projekt angewendet (siehe Backend Implementation Notes)
- Vercel-Build erfolgreich (55s), Deployment `Ready`, Production
- **Production URL:** https://bambi-w26q.vercel.app
- `https://bambi-w26q.vercel.app/login` mit 200 verifiziert

### Refinement-Deploy (2026-06-28)
- Commits `53891f6` (docs/architecture), `aeade21` (feat), `092814b` (test/QA), `f79d8cb` (fix Bug #1) gepusht zu `origin/main`, Tag `v1.10.0-PROJ-10`
- Keine Migration nötig (kein Schema-Change in dieser Iteration)
- Vercel-Build erfolgreich (47s), Deployment `Ready`, Production
- **Production URL:** https://bambi-w26q.vercel.app
- `https://bambi-w26q.vercel.app/login` mit 200 verifiziert

### Persistenz-Deploy (2026-06-28, Nachmittag — gemeinsam mit PROJ-6)
- Migration `create_contact_events` + `fix_contact_events_insert_ownership` auf Live-Projekt angewendet (siehe PROJ-6-Spec)
- Commit `6d3c3b2` gepusht zu `origin/main`, Tag `v1.11.0-PROJ-6` (PROJ-10s Import-Insert-Logik ist Teil dieses gemeinsamen Deploys, kein eigener Tag)
- Vercel-Build erfolgreich, Deployment `Ready`, Production
- `https://bambi-w26q.vercel.app/login` mit 200 verifiziert

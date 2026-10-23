# PROJ-3: Kontakt anlegen & verwalten

## Status: Deployed
**Created:** 2026-06-19
**Last Updated:** 2026-06-24 (Refine: `name` → `first_name`+`last_name` aufgesplittet, Arbeitgeber/Jobtitel/E-Mail ergänzt — Re-Implementierung nötig)

## Implementation Notes
- **Update 2026-06-24 (Refine: Namens-Split + Arbeitgeber/Jobtitel/E-Mail):** Migration `split_name_add_employer_jobtitle_email` (live auf Supabase-Projekt angewendet via MCP) — `name` ersetzt durch `first_name`(NOT NULL)+`last_name`(nullable), neue Spalten `employer`/`job_title`/`email`. Backfill der 2 bestehenden Produktionskontakte verifiziert (beide Einwort-Namen, korrekt nach `first_name` übernommen, `last_name` null). `src/lib/contacts.ts`: `Contact`-Interface aktualisiert, neue `getFullName(contact)`-Helper-Funktion. Alle `contact.name`-Konsumenten umgestellt: `contact-card.tsx`, `contact-list.tsx` (Suche + Löschen-Dialog), `interaction-log-sheet.tsx`, `occasion-card.tsx` (Titel + beide Kalender-Link-Titel), `/api/draft-message/route.ts` (nutzt `first_name` direkt für natürliche Anrede "Hey Anna" statt Vollname). `contact-form-dialog.tsx`: Schema/defaultValues/reset/payload + 3 neue Formularfelder (Arbeitgeber, Jobtitel, E-Mail) zwischen Beziehungsstärke und Kontext.
  - **Bug gefunden + gefixt:** `type="email"` auf dem E-Mail-Input löste native Browser-Constraint-Validation aus, die den Formular-Submit abfing bevor Zod lief (identisches Muster zu PROJ-5 BUG-1 mit `type="date"`/`max`) — Zod-Fehlermeldung "Ungültige E-Mail-Adresse" erschien nie. Fix: `type="text"` statt `type="email"`, Zod `.email()` validiert allein.
  - E2E-Suite über PROJ-3/4/5/6/8 (69 Tests) komplett auf `first_name` umgestellt (`getByLabel('Name')` → `getByLabel('Vorname')`, `seedContact`-Helper/Cleanup-Queries von `name` auf `first_name`), 4 neue Tests für Nachname-optional/Arbeitgeber+Jobtitel/E-Mail/ungültige E-Mail ergänzt
- **Erweiterung 2026-06-22:** Migration `add_city_and_phone_to_contacts` (Supabase) — 2 neue nullable Spalten `city`, `phone` auf `contacts`. `Contact`-Interface, `contact-form-dialog.tsx` (Schema, defaultValues, reset, payload) und Formular-UI um beide Felder ergänzt. Kein Format-Constraint, freier Text wie spezifiziert.
- `src/lib/contacts.ts`: Typen + Label-Mappings für Category/Strength, Follow-up-Default-Tabelle
- `src/components/contact-form-dialog.tsx`: Ein Dialog-Formular für Create+Edit, react-hook-form+Zod, Follow-up-Intervall "sticky" sobald manuell bearbeitet (via `dirtyFields`)
- `src/components/contact-list.tsx`: Schlichte Übergangsliste (Name + Bearbeiten/Löschen), Empty-State, AlertDialog für Löschen-Bestätigung
- `src/app/page.tsx`: `ContactList` eingebunden
- **Bug gefunden + gefixt während Implementierung:** `followup_interval_days` war in der PROJ-1-Migration `NOT NULL DEFAULT 30` — widersprach AC, dass das Feld ohne gewählte Stärke leer/null bleiben soll. Migration `make_followup_interval_nullable` angewendet (Constraint entfernt)
- Direkter Supabase-Client-Zugriff vom Frontend, keine neue API-Route (wie geplant)
- Smoke-getestet (Create/Edit/Delete-Zyklus) gegen echten Account — funktioniert bei serieller Ausführung; parallele Mehrfach-Logins desselben Accounts verursachen Session-Races (bekanntes Testinfra-Artefakt, kein Produktbug, siehe PROJ-2)

## Dependencies
- PROJ-1 (Supabase Infrastructure Setup) — `contacts`-Tabelle + RLS existieren bereits
- PROJ-2 (Auth Login) — Nutzer muss eingeloggt sein, `user_id = auth.uid()`

## User Stories
- Als Nutzer möchte ich einen neuen Kontakt mit nur dem Vornamen anlegen können, damit ich ihn in unter einer Minute erfassen kann, ohne sofort alle Details zu kennen
- Als Nutzer möchte ich optional einen Nachnamen erfassen können, damit ich Kontakte mit gleichem Vornamen unterscheiden und förmlicher referenzieren kann, wenn ich den Nachnamen kenne
- Als Nutzer möchte ich Arbeitgeber und Jobtitel erfassen können, damit ich weiß, wo/wie ich jemanden beruflich einordnen und ansprechen kann
- Als Nutzer möchte ich eine E-Mail-Adresse erfassen können, damit ich einen zweiten Kontaktweg habe, falls keine Telefonnummer vorliegt (z.B. bei Business-Kontakten)
- Als Nutzer möchte ich beim Anlegen optional auch Kategorie, Beziehungsstärke, Kontext, Notizen, Stadt und Telefonnummer direkt mit erfassen können, damit ich den Kontakt sofort vollständig einsortieren kann, wenn ich Zeit habe
- Als Nutzer möchte ich die Stadt eines Kontakts erfassen können, damit ich später danach filtern kann (z.B. wer in Berlin ist, wenn ich dort bin)
- Als Nutzer möchte ich eine Telefonnummer erfassen können, damit ich später direkt aus der App heraus eine WhatsApp-Nachricht vorbereiten kann
- Als Nutzer möchte ich einen bestehenden Kontakt bearbeiten können, damit ich Informationen nachpflegen oder korrigieren kann
- Als Nutzer möchte ich einen Kontakt löschen können, damit ich Karteileichen oder Fehleinträge entfernen kann
- Als Nutzer möchte ich vor dem Löschen eine Bestätigung sehen, damit ich nicht versehentlich einen Kontakt samt Verlauf verliere

## Out of Scope
- Kein separates Quick-Add-Mini-Formular — es gibt nur EIN Formular (Erstellen + Bearbeiten), alle Felder sichtbar, nur Vorname Pflicht
- Kontaktliste mit Filtern, Suche, Sortierung, Kartenansicht — eigenes Feature PROJ-4, hier nur eine schlichte, unstylische Übergangsliste (Name + Bearbeiten/Löschen) als Trägerin für CRUD-Tests
- Interaktions-Log (Kontaktmomente protokollieren) — eigenes Feature PROJ-5
- Foto-Upload — eigenes Feature PROJ-7, `photo_url`-Feld existiert im Schema, bleibt hier ungenutzt/leer
- Eindeutigkeits-Prüfung auf Namen — Duplikate sind erlaubt, keine Warnung
- Bulk-Operationen (Mehrfachauswahl, Massenlöschung) — kein MVP-Bedarf
- Undo nach Löschen — Bestätigungsdialog reicht als Schutz, kein Soft-Delete/Wiederherstellen
- Telefonnummer-Format-Validierung (E.164, Ländervorwahl-Zwang etc.) — freier Text, Normalisierung passiert erst bei Bedarf in PROJ-6 (WhatsApp-Link)
- Stadt-Autocomplete/Geo-Lookup — freier Text wie das Kontext-Feld, keine Ortsdatenbank-Anbindung
- Weitere Profilfelder (LinkedIn-Link, "wie kennengelernt", Geburtsort, Adresse) — bewusst nicht als eigene Felder, das bestehende freie "Kontext"-Feld deckt das ab, sonst bläht sich das Formular auf und verletzt das Quick-Add-Ziel (Refine-Entscheidung 2026-06-24)
- E-Mail-Format-Validierung über Standard-`Zod .email()` hinaus (z.B. MX-Record-Check, Verifizierungs-Mail) — reine Syntax-Validierung reicht für ein persönliches Adressbuch

## Acceptance Criteria

- [ ] Angenommen der Nutzer ist eingeloggt, wenn er das Formular nur mit Vorname ausfüllt und speichert, dann wird der Kontakt mit allen anderen Feldern leer/Default angelegt
- [ ] Angenommen der Nutzer ist eingeloggt, wenn er das Formular mit Vorname, Nachname, Kategorie, Beziehungsstärke, Kontext und Notizen ausfüllt und speichert, dann werden alle Werte korrekt gespeichert
- [ ] Angenommen der Nutzer lässt das Vorname-Feld leer, wenn er speichern will, dann wird eine Validierungsfehlermeldung angezeigt und der Kontakt wird nicht angelegt
- [ ] Angenommen der Nutzer lässt das Nachname-Feld leer, wenn er speichert, dann wird der Kontakt trotzdem angelegt (optional, kein Pflichtfeld)
- [ ] Angenommen der Nutzer trägt Arbeitgeber und/oder Jobtitel ein, wenn er speichert, dann werden beide Werte korrekt gespeichert und beim erneuten Öffnen vorausgefüllt angezeigt
- [ ] Angenommen der Nutzer lässt Arbeitgeber und/oder Jobtitel leer, wenn er speichert, dann wird der Kontakt trotzdem angelegt (beide Felder optional)
- [ ] Angenommen der Nutzer trägt eine E-Mail-Adresse ein, wenn er speichert, dann wird sie korrekt gespeichert und beim erneuten Öffnen vorausgefüllt angezeigt
- [ ] Angenommen der Nutzer trägt eine syntaktisch ungültige E-Mail-Adresse ein (z.B. ohne `@`), wenn er speichern will, dann wird eine Validierungsfehlermeldung angezeigt und der Kontakt wird nicht angelegt
- [ ] Angenommen der Nutzer lässt das E-Mail-Feld leer, wenn er speichert, dann wird der Kontakt trotzdem angelegt (optional, kein Pflichtfeld)
- [ ] Angenommen ein Kontakt wird ohne explizite Beziehungsstärke angelegt, wenn er gespeichert wird, dann bleibt das Follow-up-Intervall leer/null (kein automatischer Default ohne gewählte Stärke)
- [ ] Angenommen eine Beziehungsstärke wird gewählt (Kern/Mittel/Locker), wenn der Kontakt gespeichert wird, dann wird `followup_interval_days` automatisch auf 14/30/90 gesetzt, sofern der Nutzer das Intervall nicht manuell überschrieben hat
- [ ] Angenommen ein Kontakt existiert, wenn der Nutzer ihn in der Übergangsliste anklickt/auf "Bearbeiten" klickt, dann öffnet sich das Formular vorausgefüllt mit den aktuellen Werten
- [ ] Angenommen ein Kontakt wird bearbeitet und gespeichert, wenn die Änderung erfolgreich ist, dann werden die neuen Werte sofort in der Liste sichtbar
- [ ] Angenommen ein Kontakt existiert, wenn der Nutzer auf "Löschen" klickt, dann erscheint ein Bestätigungsdialog bevor der Kontakt entfernt wird
- [ ] Angenommen der Nutzer bestätigt das Löschen, wenn der Kontakt entfernt wird, dann werden auch alle zugehörigen Interactions automatisch mit gelöscht (Cascade, bereits in PROJ-1 angelegt)
- [ ] Angenommen noch kein Kontakt existiert, wenn der Nutzer die Seite aufruft, dann wird ein Empty-State mit Hinweis und "Kontakt hinzufügen"-Button angezeigt
- [ ] Angenommen die Supabase-API ist beim Speichern nicht erreichbar, wenn der Nutzer das Formular abschickt, dann wird eine Fehlermeldung angezeigt und die Eingabe bleibt im Formular erhalten
- [ ] Angenommen Nutzer A ist eingeloggt, wenn er versucht auf einen Kontakt von Nutzer B zuzugreifen, dann liefert die Datenbank keine Zeile zurück (RLS bereits in PROJ-1 erzwungen)
- [ ] Angenommen der Nutzer trägt Stadt und/oder Telefonnummer ein, wenn er speichert, dann werden beide Werte korrekt gespeichert und beim erneuten Öffnen vorausgefüllt angezeigt
- [ ] Angenommen der Nutzer lässt Stadt und/oder Telefonnummer leer, wenn er speichert, dann wird der Kontakt trotzdem angelegt (beide Felder optional, kein Pflichtfeld)
- [ ] Angenommen eine Telefonnummer enthält Leerzeichen, Klammern, `+` oder Bindestriche, wenn sie gespeichert wird, dann wird sie unverändert als Text übernommen (keine Format-Validierung)

## Edge Cases
- Zwei Kontakte mit identischem Vorname+Nachname → erlaubt, keine Warnung
- Nutzer ändert Beziehungsstärke nachträglich → `followup_interval_days` wird nur automatisch neu gesetzt, wenn der Nutzer das Intervall vorher nicht manuell überschrieben hat (sonst bleibt manueller Wert erhalten)
- Sehr langer Vorname/Nachname/Notiz-Text → Vor-/Nachname je max. 100 Zeichen, Notizen max. 2000 Zeichen, Validierungsfehler bei Überschreitung
- Löschen eines Kontakts mit bereits protokollierten Interactions (sobald PROJ-5 existiert) → Cascade-Delete entfernt diese mit, Bestätigungsdialog warnt nicht explizit davor (Out of Scope: detaillierte Warnung über Anzahl betroffener Interactions)
- Doppelter Klick auf "Speichern" während Request läuft → Button disabled (Loading-State), kein doppelter Insert
- Whitespace-only Vorname (nur Leerzeichen) → wird wie leeres Feld behandelt, Validierungsfehler
- Telefonnummer in beliebigem Format (international, mit/ohne Leerzeichen) → wird als Freitext gespeichert, keine Normalisierung in PROJ-3 (passiert erst bei Verwendung in PROJ-6)
- Zwei Kontakte in derselben Stadt → erlaubt, keine Einzigartigkeits-Logik nötig (Stadt ist reines Filter-/Info-Feld)
- Nachname mit Mehrfach-Bestandteilen ("von Mustermann", "García López") → wird als Freitext im `last_name`-Feld gespeichert, keine Parsing-Logik (Nutzer trägt selbst ein, was er als Nachname versteht)
- Bestehender Kontakt (vor Migration) mit mehrteiligem `name` (z.B. "Anna Maria Schmidt") → Migration spaltet am ersten Leerzeichen: `first_name="Anna"`, `last_name="Maria Schmidt"` — kann bei Mehrfach-Vornamen ungenau sein, Nutzer kann nach Migration einmalig manuell korrigieren (keine automatische Erkennung von Vor- vs. Nachnamen)

## Technical Requirements
- Security: RLS bereits aktiv seit PROJ-1 — kein zusätzlicher App-seitiger Check nötig, aber Frontend darf nie eine `user_id` aus Client-Eingabe übernehmen, immer `auth.uid()` serverseitig/durch RLS erzwingen lassen
- Validierung: Vorname Pflichtfeld, 1–100 Zeichen (getrimmt); Nachname optional, max. 100 Zeichen; Notizen optional, max. 2000 Zeichen; Kontext optional, max. 500 Zeichen; Stadt optional, max. 100 Zeichen; Telefonnummer optional, max. 30 Zeichen, kein Format-Constraint; Arbeitgeber optional, max. 100 Zeichen; Jobtitel optional, max. 100 Zeichen; E-Mail optional, max. 200 Zeichen, Syntax-Validierung via `Zod .email()` wenn ausgefüllt
- Migration: bestehende `name`-Spalte wird durch `first_name`/`last_name` ersetzt. Einmaliges Daten-Backfill spaltet vorhandene Werte am ersten Leerzeichen (erstes Wort → `first_name`, Rest → `last_name`, falls vorhanden)
- Cross-Feature-Impact: `name`-Konsumenten müssen auf eine zentrale `getFullName(contact)`-Helper-Funktion (`src/lib/contacts.ts`) umgestellt werden — betrifft mind. `contact-card.tsx`, `contact-list.tsx`, `occasion-card.tsx` (PROJ-6), `/api/draft-message/route.ts` (PROJ-6, AI-Prompt + Kalender-Link-Titel). PROJ-4-Namenssuche muss auf `first_name`+`last_name` (kombiniert) erweitert werden

## Open Questions
_Keine offenen Fragen — siehe Decision Log._

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Ein Formular statt Quick-Add + Vollprofil getrennt | Nutzer wollte mehrere Felder sichtbar, aber nur Name Pflicht — ein Formular deckt beide Anwendungsfälle ab ohne UI-Verdopplung | 2026-06-19 |
| Formular als Dialog/Sheet statt eigene Seite | Schnellerer Workflow ohne Seitenwechsel, passt zum PRD-Ziel "Quick-Add < 1 Minute" | 2026-06-19 |
| PROJ-3 deckt volles CRUD ab (inkl. Edit/Delete), nicht nur Create | Klare Trennung: PROJ-3 = Datenoperationen, PROJ-4 = Browsing-/Filter-UI | 2026-06-19 |
| Schlichte Übergangsliste mitgebaut, da PROJ-4 noch nicht existiert | PROJ-3 braucht einen UI-Zugriffspunkt für Edit/Delete zum Testen — PROJ-4 ersetzt/erweitert sie später um Design/Filter | 2026-06-19 |
| Follow-up-Intervall-Defaults: Kern=14, Mittel=30, Locker=90 Tage | Gängige Heuristik für Beziehungspflege-Frequenz, pro Kontakt manuell überschreibbar | 2026-06-19 |
| Namens-Duplikate erlaubt, keine Eindeutigkeits-Prüfung | Reale Netzwerke haben oft gleiche Vornamen, Unterscheidung über Kontext/Kategorie statt technischem Constraint | 2026-06-19 |
| Kein Undo nach Löschen, nur Bestätigungsdialog | Reicht als Schutz vor Versehen, Soft-Delete/Wiederherstellen kein MVP-Bedarf | 2026-06-19 |
| Stadt + Telefonnummer als neue optionale Felder ergänzt | Voraussetzung für geplante Folge-Features: PROJ-4 Stadt-Filter, PROJ-6 WhatsApp-Link (`wa.me`). Beziehungsstärke/Follow-up-Intervall (Tier-Konzept) existierten bereits, kein Rework nötig | 2026-06-22 |
| Telefonnummer ohne Format-Validierung (freier Text) | Internationale Formate variieren stark, Normalisierung für `wa.me`-Link erst bei tatsächlicher Verwendung in PROJ-6 nötig — vermeidet verfrühte/falsche Validierungsregeln | 2026-06-22 |
| Stadt ohne Autocomplete/Geo-Lookup (freier Text wie Kontext-Feld) | Kein Mehrwert ggü. Aufwand für ein einzelnes Filter-Feld, passt zum "so einfach wie möglich"-Prinzip | 2026-06-22 |
| `name` ersetzt durch `first_name` (Pflicht) + `last_name` (optional) | Nutzerwunsch im Refine; bei persönlichem Netzwerk oft nur Vorname bekannt — Nachname-Pflicht würde Quick-Add-Ziel verletzen | 2026-06-24 |
| Arbeitgeber + Jobtitel als Paar ergänzt (beide optional) | Arbeitgeber allein sagt wenig ohne Rolle — beide zusammen liefern den eigentlichen Mehrwert für Gesprächsvorbereitung/Ansprache | 2026-06-24 |
| E-Mail-Adresse ergänzt (optional, mit `Zod .email()`-Syntaxvalidierung) | Zweiter Standard-Kontaktweg neben Telefon, oft einziger Kanal bei Business-Kontakten. Im Gegensatz zu Telefon (viele internationale Freitext-Formate) hat E-Mail ein eindeutiges, günstig validierbares Format — Validierung daher hier sinnvoll, anders als bei Telefon/Stadt | 2026-06-24 |
| Keine weiteren neuen Felder (LinkedIn, "wie kennengelernt", Geburtsort, Adresse) | Bestehendes Kontext-Feld deckt das bereits ab, zusätzliche dedizierte Felder würden das Formular aufblähen ohne klaren Mehrwert ggü. Freitext | 2026-06-24 |
| Migration bestehender `name`-Werte: Split am ersten Leerzeichen (erstes Wort → `first_name`, Rest → `last_name`) | Pragmatischer Kompromiss für echte Produktionsdaten — nicht 100% korrekt bei Mehrfach-Vornamen, aber besser als alles in `first_name` zu packen (würde Liste komplett auf Vornamen reduzieren); Nutzer kann betroffene Kontakte danach einmalig manuell korrigieren | 2026-06-24 |

### Technical Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Direkter Supabase-Client-Zugriff, keine API-Route | RLS aus PROJ-1 erzwingt Ownership bereits serverseitig, zusätzliche API-Schicht wäre redundant | 2026-06-19 |
| Ein Formular für Create + Edit | Identische Felder/Validierung, kein Duplizieren von Logik | 2026-06-19 |
| Follow-up-Intervall: Auto-Default bei Stärke-Auswahl, aber "sticky" sobald manuell bearbeitet | Verhindert Verlust eines bewusst gewählten eigenen Werts bei späterer Stärke-Änderung | 2026-06-19 |
| Eine atomare Migration (Spalten hinzufügen + Backfill + `name` löschen) statt Übergangszustand mit beiden Spalten | Solo-Projekt ohne Zero-Downtime-Anforderung — ein kurzer koordinierter Deploy ist einfacher als doppelte Schreiblogik für eine Übergangsphase zu pflegen, vermeidet Backwards-Compat-Code für eine Spalte, die ohnehin sofort verschwindet | 2026-06-24 |
| Zentrale `getFullName(contact)`-Helper-Funktion statt Konkatenation an jeder Verwendungsstelle | Single Source of Truth fürs Zusammensetzen des Anzeigenamens (z.B. Leerzeichen-Handling wenn `last_name` leer ist) — verhindert Inkonsistenzen zwischen Kontaktliste, AI-Prompt, Kalender-Link | 2026-06-24 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Component Structure

```
/ (Platzhalter-Startseite, erweitert um Übergangsliste)
├── "Kontakt hinzufügen"-Button
├── Kontakt-Formular (Dialog, dient Create UND Edit)
│   ├── Vorname-Feld (Pflicht)
│   ├── Nachname-Feld (optional)
│   ├── Kategorie-Auswahl (Business/Investor/Community/Freund/Bekannter)
│   ├── Beziehungsstärke-Auswahl (Kern/Mittel/Locker)
│   ├── Arbeitgeber-Feld (optional, Freitext)
│   ├── Jobtitel-Feld (optional, Freitext)
│   ├── E-Mail-Feld (optional, Format-validiert)
│   ├── Kontext-Feld
│   ├── Notizen-Feld (mehrzeilig)
│   ├── Follow-up-Intervall (Tage) — automatisch befüllt je Stärke, manuell überschreibbar
│   ├── Stadt-Feld (optional, Freitext)
│   ├── Telefonnummer-Feld (optional, Freitext)
│   └── Speichern- / Abbrechen-Button
├── Übergangsliste (schlicht, ohne Design-Anspruch)
│   ├── Pro Zeile: Vollname (Vorname + Nachname), "Bearbeiten"-Button, "Löschen"-Button
│   └── Empty State ("Noch keine Kontakte" + Hinzufügen-Button)
└── Löschen-Bestätigung (AlertDialog)
```

### Data Model (plain language)

`contacts` existiert bereits seit PROJ-1 (Name, Kategorie, Stärke, Kontext, Notizen, Follow-up-Intervall, Zeitstempel). Für diese Erweiterung kommen 2 neue Spalten dazu: `city` (text, nullable) und `phone` (text, nullable) — beide ohne Constraint, Migration analog zum bestehenden Schema-Pattern aus PROJ-1.

### Update 2026-06-24 (Refine): Namens-Split + Arbeitgeber/Jobtitel/E-Mail

`name` (text, NOT NULL) wird ersetzt durch `first_name` (text, NOT NULL) + `last_name` (text, nullable). Zusätzlich 3 neue nullable Spalten: `employer`, `job_title`, `email` (alle text, kein Constraint außer App-seitiger E-Mail-Syntaxvalidierung).

Eine Migration, drei Schritte in derselben Transaktion: (1) neue Spalten hinzufügen, (2) Backfill `first_name`/`last_name` aus bestehendem `name` per Split am ersten Leerzeichen für alle bestehenden Zeilen, (3) alte `name`-Spalte löschen. Kein Übergangszustand mit beiden Spalten parallel — Backend-Implementierung stellt im selben Schritt alle Code-Stellen um, die bisher `name` gelesen/geschrieben haben. Eine zentrale `getFullName(contact)`-Helper-Funktion in `src/lib/contacts.ts` ersetzt jede direkte Nutzung von `contact.name` im restlichen Code (PROJ-4 Suche, PROJ-6 AI-Prompt/Kalender-Link, Kontaktliste).

### Tech Decisions (justified)

- **Direkter Supabase-Client-Zugriff vom Frontend, keine eigene API-Route:** Gleiches Muster wie bei PROJ-2 (Login) — RLS aus PROJ-1 erzwingt bereits, dass jeder Nutzer nur eigene Kontakte sieht/ändert, eine zusätzliche API-Schicht wäre redundant und nur Mehraufwand ohne Sicherheitsgewinn.
- **Ein Formular für Create UND Edit:** Identische Felder, identische Validierung — getrennte Komponenten würden Logik duplizieren. Formular bekommt optional einen bestehenden Kontakt als Ausgangswerte übergeben.
- **Follow-up-Intervall als "smart default, aber überschreibbar":** Wird automatisch gesetzt sobald eine Stärke gewählt wird, aber sobald der Nutzer das Intervall-Feld selbst anfasst, wird der automatische Vorschlag nicht mehr überschrieben — verhindert, dass ein bewusst gewählter eigener Wert beim Ändern der Stärke wieder verloren geht.
- **react-hook-form + Zod:** Bereits Projekt-Konvention (siehe PROJ-2 Login-Formular), gleiche Validierungs-Patterns (Pflichtfeld, Längenbegrenzung) wiederverwendet.
- **AlertDialog für Löschen-Bestätigung statt normalem Dialog:** Shadcn-Standardkomponente exakt für diesen Zweck (destruktive Aktion bestätigen), kein Custom-Bauteil nötig.
- **Übergangsliste bewusst ungestylt:** Vermeidet Doppelarbeit — PROJ-4 ersetzt sie ohnehin durch die echte Listen-/Filter-Ansicht mit Design.

### Dependencies (Packages)
Keine neuen Packages — `react-hook-form`, `zod`, `@hookform/resolvers`, `@supabase/supabase-js` bereits installiert.

## QA Test Results

**Date:** 2026-06-19
**Tested by:** /qa (live gegen echten Account + zweiten Test-Account für RLS-Check)

### Acceptance Criteria
| # | Criterion | Result |
|---|---|---|
| 1 | Nur Name → Kontakt mit Default/leeren Restfeldern | ✅ Pass (E2E) |
| 2 | Volles Formular → alle Werte korrekt gespeichert | ✅ Pass (E2E, inkl. Re-Open-Verifikation) |
| 3 | Leerer Name → Validierungsfehler, kein Insert | ✅ Pass (E2E) |
| 4 | Keine Stärke gewählt → Follow-up-Intervall bleibt leer | ✅ Pass (E2E) — **nach Bugfix, siehe unten** |
| 5 | Stärke gewählt → Intervall-Default automatisch gesetzt (14/30/90) | ✅ Pass (E2E) |
| 5b | Manuell editiertes Intervall bleibt bei Stärke-Wechsel erhalten | ✅ Pass (E2E) |
| 6 | Bearbeiten öffnet Formular vorausgefüllt | ✅ Pass (E2E) |
| 7 | Änderung wird gespeichert, sofort in Liste sichtbar | ✅ Pass (E2E) |
| 8 | Löschen zeigt Bestätigungsdialog | ✅ Pass (E2E) |
| 9 | Bestätigtes Löschen entfernt Kontakt | ✅ Pass (E2E) |
| 10 | Empty State bei 0 Kontakten | ✅ Pass (E2E) |
| 11 | Netzwerkfehler beim Speichern → Fehlermeldung, Eingabe bleibt | ✅ Pass (E2E) — **nach Bugfix, siehe unten** |
| 12 | Cross-User-Isolation (RLS) | ✅ Pass — verifiziert via REST-API mit zweitem echten Account: User B bekommt `[]` bei SELECT/UPDATE/DELETE auf User A's Kontakt, Daten unverändert |

**Erweiterung 2026-06-22 (Stadt + Telefonnummer):**
| # | Criterion | Result |
|---|---|---|
| 13 | Stadt + Telefonnummer gespeichert, beim Re-Open vorausgefüllt | ✅ Pass (E2E) |
| 14 | Beide Felder optional, Kontakt speichert auch ohne sie | ✅ Pass (E2E) |
| 15 | Telefonnummer mit Leerzeichen/Klammern/`+`/Bindestrichen wird unverändert übernommen | ✅ Pass (E2E, abgedeckt durch AC13 mit `+49 170 1234567`) |

### Automated Tests
- `npm test` → 1 file, 2/2 passed (Regression PROJ-1)
- `npm run test:e2e` (PROJ-3-contacts.spec.ts, 12 Tests) → 12/12 passed, seriell gegen echten Account
- Regression: PROJ-2-auth-login.spec.ts + PROJ-2-auth-login-network.spec.ts + PROJ-4 + PROJ-5 weiterhin grün (voller Suite-Lauf, 24/24 passed exkl. 1 bekannter Flake)
- Cross-Browser: Chromium + Mobile Safari, beide 23/23 (PROJ-3+PROJ-4 zusammen)

### Bugs Found

**🔴 High (gefunden + sofort gefixt):** `followup_interval_days` war in der PROJ-1-Migration `NOT NULL DEFAULT 30` — widersprach AC4 (Feld soll ohne gewählte Stärke leer/null bleiben), jeder Insert ohne Stärke schlug fehl. Migration `make_followup_interval_nullable` angewendet.

**🟠 Medium (gefunden + sofort gefixt):** Gleiches Muster wie PROJ-2 AC7 — `postgrest-js` gibt bei echten Netzwerkfehlern ein Error-Objekt mit `status: 0` zurück statt zu werfen, der ursprüngliche Code zeigte fälschlich "Speichern fehlgeschlagen" statt einer Netzwerk-Fehlermeldung. Fix: `status === 0` Check vor dem generischen Fehlerfall in `contact-form-dialog.tsx`.

**🔴 High (gefunden + sofort gefixt, 2026-06-22):** Durch die 2 neuen Felder (Stadt, Telefonnummer) wurde das Formular-Dialog höher als der Viewport — `DialogContent` aus shadcn hat kein `max-height`/`overflow`, dadurch ragte der Speichern-Button bei kleineren Fenstern aus dem sichtbaren Bereich und war nicht klickbar (sowohl per Maus als auch für Playwright). Fix: `max-h-[90vh] overflow-y-auto` auf `DialogContent` in `contact-form-dialog.tsx` ergänzt (nur dieser Dialog-Instanz, generische shadcn-Komponente unverändert).

**Keine offenen Bugs.**

### Security Audit (Red Team)
- **Cross-User RLS-Isolation (AC12):** Zweiter echter Test-Account erstellt, versuchte SELECT/UPDATE/DELETE auf Kontakt von User A → alle drei Operationen liefern `[]` (keine Zeile betroffen), Originaldaten bei User A unverändert (kein "HACKED"-Update durchgekommen)
- **Direkter REST-Delete via curl (Owner):** funktioniert korrekt mit `204`, bestätigt dass RLS Owner-Zugriff nicht fälschlich blockiert
- **SQL-Injection-Versuch:** nicht erneut getestet (bereits in PROJ-1 QA verifiziert, gleiche RLS-/PostgREST-Schicht, kein neuer Angriffsvektor durch dieses Feature)
- **Stadt/Telefon als neue Freitext-Felder:** keine neue Angriffsfläche — gleiche RLS-Policy, gleiches React-Text-Rendering (kein `dangerouslySetInnerHTML`) wie bei Notizen/Kontext, kein separater XSS-Test nötig (bereits in PROJ-4 QA für Freitext-Felder verifiziert)

### Test-Infrastruktur-Hinweise (nicht produktrelevant)
- Mehrere E2E-Flakes während QA beobachtet, alle auf Testskript-Probleme zurückgeführt, nicht auf Produktbugs:
  - Next.js Dev-Mode kompiliert Routen on-demand — allererste Interaktion nach Server-(re)start kann Klicks verschlucken bevor Hydration fertig ist (Production-Build betroffen nicht, da vorab kompiliert)
  - Mehrfache parallele Logins desselben echten Accounts invalidieren sich gegenseitig (Supabase Refresh-Token-Rotation) — E2E-Suite muss mit `--workers=1` (seriell) laufen, wenn echte Accounts statt Mocks verwendet werden
  - Einzelne Cleanup-Schritte in Tests, die nicht auf die Delete-Response warten, können vor Abschluss des Requests beendet werden — Test-Hygiene-Punkt, kein Produktbug (Produkt-Delete mehrfach isoliert mit Netzwerk-Logging verifiziert: 204, Zeile korrekt entfernt)

### Production-Ready: **YES**

## QA Test Results — Refine 2026-06-24 (Vorname/Nachname + Arbeitgeber/Jobtitel/E-Mail)

**Tested:** 2026-06-24
**Tester:** QA Engineer (AI)

### Scope
Nur die Delta-Änderungen: Namens-Split (`name` → `first_name`+`last_name`), neue Felder Arbeitgeber/Jobtitel/E-Mail, Migration bestehender Produktionsdaten. Restliche Acceptance Criteria bereits oben (2026-06-19/22) verifiziert und durch vollen Regressionslauf erneut bestätigt.

### Acceptance Criteria Status (Delta)
- [x] Nur Vorname ausgefüllt → Kontakt mit leeren/Default-Restfeldern angelegt
- [x] Vorname Pflicht — leer lassen → Validierungsfehler "Vorname ist erforderlich", kein Insert
- [x] Nachname optional — leer lassen → Kontakt speichert trotzdem
- [x] Arbeitgeber + Jobtitel gespeichert, beim Re-Open vorausgefüllt
- [x] Arbeitgeber/Jobtitel optional — leer lassen → Kontakt speichert trotzdem
- [x] E-Mail gespeichert, beim Re-Open vorausgefüllt
- [x] Ungültige E-Mail → Validierungsfehler "Ungültige E-Mail-Adresse", kein Insert — **BUG-5 gefunden + gefixt, siehe unten**
- [x] E-Mail optional — leer lassen → Kontakt speichert trotzdem

**8/8 Delta-Acceptance-Criteria passed** (nach Bugfix).

### Migration Verification (Produktionsdaten)
- Migration `split_name_add_employer_jobtitle_email` direkt auf Live-Projekt (`srxatexcffjebolqttaq`) angewendet (einzige Umgebung, kein separates Staging)
- Beide bestehenden Produktionskontakte vor/nach Migration verglichen: beide Einwort-Namen ("Shamal", "Yisa") korrekt zu `first_name` übernommen, `last_name` = `null` wie erwartet (kein Leerzeichen im Original-Namen)
- `employer`/`job_title`/`email` für beide bestehenden Kontakte korrekt `null` (kein Datenverlust, keine falschen Defaults)
- Supabase Security Advisors nach Migration erneut geprüft: keine neuen Findings, nur vorbestehender, projektunabhängiger Leaked-Password-Hinweis

### Cross-Feature Regression (Namens-Konsumenten)
Alle Stellen, die vorher `contact.name` lasen, wurden auf `getFullName(contact)` umgestellt und einzeln regressionsgetestet:
- [x] Kontaktliste: Anzeige + Suche (`getFullName`) — PROJ-4 AC1/AC7
- [x] Löschen-Bestätigungsdialog zeigt korrekten Namen — PROJ-3
- [x] Interaktions-Log-Sheet-Titel ("Verlauf: [Name]") — PROJ-5
- [x] Dashboard-Karten-Titel + beide Kalender-Link-Titel (Follow-up/Geburtstag) — PROJ-6
- [x] AI-Nachrichtenvorschlag adressiert mit `first_name` (natürlicher als Vollname in einer "Hey Anna"-Nachricht) — PROJ-6

### Security Audit
- [x] Keine neue Angriffsfläche durch `employer`/`job_title`/`email` — gleiche Tabelle, gleiche RLS-Policy wie bestehende Freitext-Felder (Stadt/Telefon/Notizen), gleiches React-Text-Rendering (kein `dangerouslySetInnerHTML`)
- [x] RLS-Cross-User-Isolation unverändert wirksam (keine Policy-Änderung durch diese Migration, strukturell verifiziert + Advisors clean)
- [x] E-Mail-Feld: Eingabe von `<script>`/SQL-Payload als E-Mail wird von `Zod .email()` bereits als ungültig abgelehnt, bevor sie die Datenbank erreicht

### Bugs Found

#### BUG-5: Natives `type="email"` blockiert Zod-Validierung — FIXED
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Kontakt-Formular öffnen, Vorname ausfüllen, bei E-Mail `not-an-email` eintragen, Speichern klicken
  2. Expected: Zod-Fehlermeldung "Ungültige E-Mail-Adresse" erscheint, kein Insert
  3. Actual (vor Fix): Browser-native HTML5-Constraint-Validation des `<Input type="email">` fängt den Submit ab, bevor react-hook-form/Zod überhaupt laufen — identisches Muster zu PROJ-5 BUG-1 (`type="date"`+`max`-Attribut)
- **Fix:** `type="email"` → `type="text"` in `contact-form-dialog.tsx`, Zod `.email()` validiert jetzt alleine. E2E-Test "AC: invalid email shows validation error..." verifiziert.
- **Priority:** Fixed before deployment

**Keine offenen Bugs.**

### Regression Testing
- `npm test`: 36/36 grün
- `npm run lint`, `npm run build`: fehlerfrei
- E2E PROJ-3 (16 Tests, inkl. 4 neue für Delta): 16/16 grün
- E2E Regression PROJ-4 (11), PROJ-5 (9), PROJ-6 (23), PROJ-8 (9): 52/52 grün — alle `--workers=1`, alle Namens-Konsumenten betroffen, keine Regression
- **Gesamt E2E:** 69/69 grün

### Summary
- **Acceptance Criteria (Delta):** 8/8 passed
- **Bugs Found:** 1 total (0 critical, 0 high, 1 medium — gefixt)
- **Security:** Pass
- **Production Ready:** YES
- **Recommendation:** Deploy

### Update 2026-06-24 (Refine: Vorname/Nachname + Arbeitgeber/Jobtitel/E-Mail)
- Commit `c7d8cdb` gepusht zu `origin/main`, Tag `v1.8.0-PROJ-3`
- Migration bereits vorab auf Live-Projekt angewendet (siehe Implementation Notes)
- Vercel-Build erfolgreich (45s), Deployment `Ready`, Production
- `https://bambi-w26q.vercel.app/login` mit 200 verifiziert

## Deployment
**Date:** 2026-06-19
**Production URL:** https://bambi-w26q.vercel.app
**Vercel Project:** bambi-w26q
**Verification:** Smoke-Test live (Create+Delete-Zyklus) gegen Production erfolgreich, Middleware-Redirect funktioniert (`/` → 307 zu `/login`). Keine neuen Env-Vars, keine neue Migration (Schema-Fix bereits während QA auf Live-Projekt angewendet). Minor Finding: shadcn-Dialog wirft Accessibility-Warning ("Missing Description") in Browser-Konsole — kosmetisch, kein funktionaler Bug, kann später behoben werden

### Erweiterung 2026-06-22 (Stadt + Telefonnummer)
**Deployment ID:** dpl_9HkgdUd9rjSBsFWnG15LMWxsV9Mf
**Verification:** Manuelles `vercel --prod` (kein Git-Push-Auto-Deploy konfiguriert), `/` → 307, `/login` → 200. Migration `add_city_and_phone_to_contacts` bereits vorab auf Live-Projekt angewendet. `npm run build` + `npm run lint` lokal grün vor Deploy.

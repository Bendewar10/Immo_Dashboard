# PROJ-14: City-Trip-Modus (Kontakte vor Ort + Batch-Draft)

## Status: Deployed
**Created:** 2026-06-30 (Roadmap) / Spec: 2026-07-03
**Last Updated:** 2026-07-03

> Refinement 2026-07-03 (Auto-Trigger via Kalender-Location): Neuer dezenter Dashboard-Hinweis erkennt, wenn ein Kalender-Termin in den nächsten Tagen eine Location hat, die zur Stadt eines aktiven Projekts passt, und verlinkt direkt zur City-Trip-Sektion dieses Projekts. Nutzt die durch den PROJ-21-Refine bereits erweiterte `/api/meetings/today`-Response (`location`-Feld) — kein neuer Kalender-Fetch. Letztes Item einer größeren Initiative, den Google-Calendar-Connector besser zu nutzen (siehe PROJ-21/PROJ-6/PROJ-8-Refines vom selben Tag). Respektiert die bestehende Entscheidung "ohne Case kein City-Trip" — nudged nur zu bereits existierenden Projekten, erfindet keine eigenständige Reise-Erkennung. Status zurück auf "In Progress" für die Bau-Phase.

## Dependencies
- Requires: PROJ-12 (Projekte/Cases) — Sektion lebt auf der Projekt-Detailseite, Stadt + Zeitraum kommen vom Case
- Requires: PROJ-3 (Kontakte) — `city`-Feld als Match-Kriterium
- Requires: PROJ-6 (Follow-up Dashboard) — Nachrichten-Draft-Infrastruktur (KI-Vorschlag, Ton, Copy, WhatsApp-Link); **Neu (Refine 2026-07-03):** der Auto-Trigger-Hinweis lebt jetzt zusätzlich auf dem Dashboard selbst (`src/app/(app)/dashboard/page.tsx`), nicht nur als Konsument der Draft-Infrastruktur
- Requires: PROJ-5 (Interaktions-Log) — „Als Nachricht loggen" nach Versand
- Nice-to-have: PROJ-17 (Gemeinsamkeiten) — reichert Draft-Kontext an
- **Neu (Refine 2026-07-03):** PROJ-19 (Konnektoren-Hub) + PROJ-21 (Meeting-Prep-Dashboard) — liefert den Google-Calendar-Token/-Fetch; das dort bereits erweiterte `location`-Feld in `MeetingGroup` (`src/lib/meetings.ts`) wird hier wiederverwendet, kein neuer Kalender-Zugriff

## Summary
Berater sind projektbedingt Mo–Do in der Case-Stadt — Abende und Lücken vor Ort verpuffen, obwohl dort Kontakte sitzen. Der City-Trip-Modus ist eine Sektion auf der Projekt-Detailseite: Sie zeigt alle Kontakte, deren Stadt zur Projekt-Stadt passt. Der Nutzer wählt per Checkbox aus, die KI entwirft PRO Kontakt eine individuelle Nachricht („Bin wegen eines Projekts regelmäßig in München — Zeit für einen Kaffee?") mit Kontext aus Stadt, Case-Zeitraum und Beziehung. Review-Liste mit Editieren, Copy und WhatsApp-Link; nach Versand loggt ein Klick die Interaktion. Kein Auto-Versand (PRD Non-Goal).

## User Stories
- Als Berater möchte ich auf meiner Case-Seite sehen, welche Kontakte in der Projekt-Stadt leben, damit ich Reisezeit für persönliche Treffen nutzen kann.
- Als Berater möchte ich mehrere Vor-Ort-Kontakte auswählen und für alle auf einmal individuelle Nachrichten-Entwürfe bekommen, damit der Aufwand pro Trip minimal bleibt.
- Als Berater möchte ich jeden Entwurf vor dem Versand prüfen und anpassen können, damit jede Nachricht wirklich persönlich klingt.
- Als Berater möchte ich Entwürfe per Copy oder WhatsApp-Link verschicken und den Versand mit einem Klick als Interaktion loggen, damit mein Follow-up-Stand stimmt.
- Als Berater möchte ich sehen, wann ich einen Vor-Ort-Kontakt zuletzt gesprochen habe, damit ich priorisieren kann, wen ich treffe.
- **Neu (Refine 2026-07-03):** Als Berater möchte ich auf dem Dashboard einen Hinweis sehen, wenn ein bevorstehender Kalender-Termin in einer Stadt liegt, in der ich ein aktives Projekt habe, damit ich nicht selbst daran denken muss, die City-Trip-Sektion zu öffnen

## Out of Scope
- **Eigene City-Trip-Seite / Trips ohne Case** (privater Städtetrip, manuelle Stadt-Wahl) — bewusst verworfen; Modus lebt am Case. Bei Bedarf späteres Feature
- **Neu (Refine 2026-07-03):** Flug-/Hotel-Buchungs-Parsing oder andere Reise-Erkennungs-Heuristiken jenseits des reinen Kalender-Location-Felds — bewusst minimal gehalten, ein einfacher String-Abgleich reicht für den Nudge-Zweck, komplexere Reise-Erkennung wäre eigene Infrastruktur ohne klaren Mehrwert gegenüber dem einfachen Signal
- **Neu (Refine 2026-07-03):** Auto-Trigger ohne bestehendes Projekt (z.B. Vorschlag, ein neues Projekt anzulegen, weil ein Kalender-Termin in einer neuen Stadt liegt) — bestätigt erneut "ohne Case kein City-Trip", der Nudge verweist ausschließlich auf bereits existierende Projekte
- **Auto-Versand von Nachrichten** — PRD Non-Goal (nur wa.me-Links, kein Senden ohne Klick)
- **Umkreis-/Geo-Matching** („Frankfurt" matcht „Bad Homburg") — nur exakter Stadt-Match; Geo wäre eigene Infrastruktur
- **Kalender-Integration** (Slots für Treffen finden) — nicht Teil des MVP
- **Eine Sammel-Nachricht für alle** — verworfen; individuelle Drafts pro Kontakt sind der Kern
- **Auto-Logging bei Copy** — verworfen; Copy ≠ versendet, Log bleibt expliziter Klick
- **Rolloff-/Projektende-Nachfass** — separates Feature (PROJ-13)

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Kontakte vor Ort
- [ ] Angenommen ein Projekt hat eine Stadt und Kontakte mit gleicher Stadt existieren (Vergleich case-insensitive, getrimmt), wenn der Nutzer die Projekt-Detailseite öffnet, dann zeigt die City-Trip-Sektion diese Kontakte mit Name, Firma, Beziehungsstärke und letztem Kontakt-Datum
- [ ] Angenommen ein Kontakt ist bereits Projekt-Beteiligter, wenn die Sektion angezeigt wird, dann erscheint er trotzdem (Vor-Ort-Liste ist unabhängig von der Beteiligten-Liste)
- [ ] Angenommen das Projekt hat keine Stadt, wenn die Detailseite geöffnet wird, dann zeigt die Sektion einen Hinweis („Projekt-Stadt pflegen, um Kontakte vor Ort zu sehen") statt einer Liste
- [ ] Angenommen keine Kontakte matchen die Projekt-Stadt, wenn die Sektion angezeigt wird, dann erscheint ein Empty State („Keine Kontakte in [Stadt]")
- [ ] Angenommen die Sektion zeigt Kontakte, wenn die Liste sortiert wird, dann stehen Kontakte mit am längsten zurückliegendem letzten Kontakt zuerst (größter Nachhol-Bedarf)

### Auswahl & Batch-Draft
- [ ] Angenommen die Sektion zeigt Vor-Ort-Kontakte, wenn der Nutzer Kontakte per Checkbox auswählt und „Nachrichten entwerfen" klickt, dann erzeugt die KI pro ausgewähltem Kontakt einen individuellen Entwurf mit Bezug auf Stadt und Case-Zeitraum
- [ ] Angenommen mehr als 20 Kontakte sind ausgewählt, wenn der Nutzer „Nachrichten entwerfen" klickt, dann wird die Auswahl auf 20 begrenzt und ein Hinweis angezeigt (Kosten-/Zeit-Deckel pro Batch)
- [ ] Angenommen kein Kontakt ist ausgewählt, wenn der Nutzer „Nachrichten entwerfen" klickt, dann passiert nichts (Button inaktiv)
- [ ] Angenommen die Drafts werden erzeugt, wenn einzelne KI-Aufrufe fehlschlagen, dann zeigen betroffene Kontakte einen Fehler mit „Erneut versuchen", die übrigen Entwürfe bleiben nutzbar

### Review & Versand
- [ ] Angenommen Entwürfe liegen vor, wenn die Review-Liste angezeigt wird, dann ist jeder Entwurf editierbar und hat Copy-Button sowie WhatsApp-Link (nur wenn Telefonnummer vorhanden)
- [ ] Angenommen ein Entwurf wurde kopiert oder per WhatsApp geöffnet, wenn der Nutzer „Als Nachricht loggen" klickt, dann wird eine Interaktion (Kanal „Nachricht", heutiges Datum) erzeugt und Follow-up-Datum aktualisiert
- [ ] Angenommen eine Interaktion wurde geloggt, wenn die Review-Liste weiter offen ist, dann ist der Eintrag als „geloggt" markiert (kein Doppel-Log per erneutem Klick)
- [ ] Angenommen der Kontakt hat keine Telefonnummer, wenn der Entwurf angezeigt wird, dann fehlt der WhatsApp-Link, Copy bleibt verfügbar

### Sicherheit & Fehler
- [ ] Angenommen der Nutzer ist nicht eingeloggt bzw. fremdes Projekt, dann sind Sektion und Drafts nicht erreichbar (Owner-only, RLS)
- [ ] Angenommen die Draft-API ist nicht erreichbar, wenn der Batch startet, dann erscheint eine Fehlermeldung und die Auswahl bleibt erhalten

### Auto-Trigger via Kalender-Location (Neu, Refine 2026-07-03)
- [ ] Angenommen der Nutzer hat Google verbunden (PROJ-19) und ein Kalender-Termin in den nächsten Tagen (gleiches Fenster wie die PROJ-21-Termine-Sektion) hat eine Location, die case-insensitive als Teilstring die Stadt eines aktiven Projekts enthält, wenn das Dashboard lädt, dann erscheint ein dezenter Hinweis ("Termin in [Stadt] — X Kontakte vor Ort im Projekt [Projektname]") mit Link zur Projekt-Detailseite
- [ ] Angenommen kein Kalender-Termin im Fenster hat eine zu einem aktiven Projekt passende Location (oder Google ist nicht verbunden, oder kein aktives Projekt hat eine Stadt), wenn das Dashboard lädt, dann erscheint kein Hinweis (kein eigener Empty-State, konsistent mit "Kürzlich erkannt"/"Termine")
- [ ] Angenommen mehrere Kalender-Termine matchen dasselbe Projekt, wenn der Hinweis berechnet wird, dann erscheint nur ein Hinweis pro Projekt (keine Duplikate für mehrere Termine in derselben Stadt)
- [ ] Angenommen Termine matchen mehrere unterschiedliche Projekte, wenn der Hinweis berechnet wird, dann erscheint ein separater Hinweis pro Projekt
- [ ] Angenommen der Nutzer klickt auf den Hinweis, wenn die Projekt-Detailseite lädt, dann ist die bestehende City-Trip-Sektion (Kontakte vor Ort) direkt sichtbar wie bei jedem normalen Aufruf der Seite (kein Auto-Scroll/Auto-Öffnen nötig, Sektion ist bereits prominent auf der Seite)

## Edge Cases
- **Projekt ohne Zeitraum (kein start/end):** Draft nutzt nur die Stadt („bin regelmäßig in X"), kein Datum im Text
- **Kontakt in Projekt-Stadt = eigener Wohnort:** kein Sonderfall — Nutzer wählt einfach nicht aus; keine automatische Filterung des Heimatorts
- **Stadt mit Schreibvarianten** („Frankfurt" vs. „Frankfurt am Main"): kein Match — akzeptiert, Kontakt-Stadtpflege ist Nutzer-Sache (konsistent mit bestehendem Stadt-Filter)
- **Sehr viele Vor-Ort-Kontakte (>50):** Liste scrollt, Auswahl-Deckel 20 pro Batch greift; mehrere Batches nacheinander möglich
- **Draft für Kontakt ohne Interaktions-Historie/Gemeinsamkeiten:** KI erzeugt generischeren, aber gültigen Entwurf (kein Fehler)
- **Projekt wird während offener Review-Liste bearbeitet (Stadt geändert):** Review-Liste bleibt auf altem Stand bis zum Neuladen — akzeptiert (Single-User)
- **Doppelklick auf „Nachrichten entwerfen":** zweiter Klick während laufender Generierung ist gesperrt
- **Neu (Refine 2026-07-03):** Kalender-Termin ohne Location-Feld → wird wie ein nicht-matchender Termin behandelt, kein Fehler
- **Neu (Refine 2026-07-03):** Zwei aktive Projekte mit identischer Stadt → beide bekommen unabhängig einen Hinweis, falls ein Termin matcht (keine Zusammenführung)
- **Neu (Refine 2026-07-03):** Location-Feld enthält mehr als nur die Stadt (z.B. volle Adresse "Konferenzraum, Musterstraße 1, 80331 München") → Teilstring-Match funktioniert weiterhin, solange der Stadtname als Substring enthalten ist; enthält die Adresse den Stadtnamen nicht wörtlich (z.B. nur PLZ ohne Stadtname), kein Match — akzeptiert, konsistent mit dem bewusst einfachen String-Matching-Prinzip
- **Neu (Refine 2026-07-03):** Projekt hat Status "done" (abgeschlossen) → kein Auto-Trigger-Hinweis, nur aktive Projekte werden berücksichtigt (konsistent mit der City-Trip-Sektion selbst, die nur auf der Detailseite existiert, unabhängig vom Status — aber ein Hinweis auf ein bereits abgeschlossenes Projekt wäre irreführend)

## Technical Requirements (optional)
- Security: Authentifizierung + RLS (Projekt und Kontakte owner-only); Draft-Erzeugung serverseitig
- Kosten: max. 20 Drafts pro Batch; Drafts werden nicht gespeichert (nur Session)
- Performance: Vor-Ort-Liste clientseitig aus geladenen Daten; Drafts parallel/gestaffelt, UI bleibt bedienbar
- **Neu (Refine 2026-07-03):** Auto-Trigger nutzt ausschließlich bereits im Dashboard geladene Daten (Kalender-Termine aus PROJ-21, aktive Projekte per Supabase-Query) — kein neuer Server-Endpunkt, reine Client-seitige Cross-Referenz-Logik
- **Neu (Refine 2026-07-03):** Matching-Funktion ist eine pure Function (Location-String, Projekt-Stadt) → boolean, unit-testbar ohne Server/DB

## Open Questions
- [x] Wiederverwendung `POST /api/draft-message` vs. eigener Batch-Endpunkt → **entschieden (/architecture):** bestehenden Endpunkt um Anlass „citytrip" + Stadt/Zeitraum erweitern

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Sektion auf Projekt-Detailseite statt eigener Seite | City-Trips entstehen beim Berater fast immer aus dem Case; Stadt+Zeitraum liegen dort schon | 2026-07-03 |
| Trade-off akzeptiert: ohne Case kein City-Trip | Privater Städtetrip ist Randfall; bei Bedarf späteres Feature | 2026-07-03 |
| Individuelle KI-Drafts pro Kontakt (kein Sammel-Text) | Persönlicher Beziehungsansatz ist Produktkern; unpersönliche Massen-Nachricht schadet | 2026-07-03 |
| Auswahl-Deckel 20 pro Batch | Kosten-/Laufzeit-Bremse; realistisch trifft man pro Trip ohnehin < 10 Personen | 2026-07-03 |
| Log-Button statt Auto-Log bei Copy | Copy ≠ versendet; falsche Interaktionen würden Follow-up-Logik verfälschen | 2026-07-03 |
| Exakter Stadt-Match (case-insensitive, getrimmt), kein Geo | Konsistent mit bestehendem Stadt-Filter; Geo-Matching wäre eigene Infrastruktur | 2026-07-03 |
| Sortierung nach ältestem letzten Kontakt | Trip-Zeit ist knapp — größter Nachhol-Bedarf zuerst | 2026-07-03 |
| Auto-Trigger-Hinweis auf dem Dashboard statt auf der Projekt-Detailseite/Projekt-Liste | Nutzerentscheidung im Refine-Interview: Dashboard ist bereits die "was braucht heute Aufmerksamkeit"-Fläche (Termine, Geburtstage, Follow-ups) — höhere Entdeckbarkeit als ein Hinweis, den man nur sieht, wenn man die Projektseite ohnehin schon offen hat | 2026-07-03 |
| Nur Location-Feld-Substring-Match, keine Flug-/Hotel-Buchungs-Erkennung | Bewusst minimal — ein einfacher Textabgleich deckt den Kern-Use-Case (Termin mit Orts-Info) ab, ohne die Komplexität einer echten Reise-Erkennung; bestätigt die bestehende "kein Geo-Matching"-Entscheidung dieser Spec | 2026-07-03 |
| Nur aktive Projekte (`status = 'active'`) werden für den Auto-Trigger berücksichtigt | Ein Hinweis auf ein bereits abgeschlossenes Projekt wäre irreführend und nicht handlungsrelevant | 2026-07-03 |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|----------|-----------|------|
| `POST /api/draft-message` um Anlass „citytrip" + optionale Felder Stadt/Zeitraum erweitern (kein Batch-Endpunkt) | Kompletter Kontext-Aufbau existiert dort; N gestaffelte Einzelaufrufe geben Fehler-Isolation gratis | 2026-07-03 |
| Stadt-Match clientseitig, exakt (case-insensitive, getrimmt) | Konsistent mit PROJ-23-Firmen-Match und bestehendem Stadt-Filter | 2026-07-03 |
| Drafts nicht persistiert (nur Browser-Session) | Wegwerf-Artefakte; Beleg ist die geloggte Interaktion | 2026-07-03 |
| Interaktions-Log via bestehendem Client-Insert, Follow-up via DB-Trigger | Gleiche Semantik wie manuelles Loggen, keine neue Logik | 2026-07-03 |
| Staffelung der KI-Aufrufe (begrenzte Parallelität) | 20 gleichzeitige Sonnet-Aufrufe unnötig; UI bleibt flüssig, Kosten unverändert | 2026-07-03 |
| Auto-Trigger nutzt das durch PROJ-21 bereits erweiterte `location`-Feld in `/api/meetings/today`, kein neuer Kalender-Fetch/keine neue Route | Der Termine-Fetch aus PROJ-21 läuft auf dem Dashboard ohnehin schon (gleiches Zeitfenster) — eine zweite, separate Kalender-Abfrage nur für den City-Trip-Hinweis wäre redundant | 2026-07-03 |
| Matching in einer neuen, kleinen `src/lib/city-trip-match.ts` statt inline im Dashboard | Pure Function ist unabhängig testbar (Unit-Tests ohne Server/DB), gleiches Muster wie `matchesCity` in `city-trip-section.tsx` (Substring- statt Exakt-Vergleich, da Location-Freitext ist) | 2026-07-03 |
| Aktive Projekte werden im Dashboard per eigenem, leichtgewichtigen Supabase-Query geladen (`id, name, city, status`) statt vollständiger Projekt-Objekte | Der Hinweis braucht nur diese vier Felder — kein unnötiges Nachladen der vollen Projekt-Datensätze (Log, Beteiligte etc.) nur für einen Dashboard-Hinweis | 2026-07-03 |

---
<!-- Sections below are added by subsequent skills -->

## Implementation Notes

### Frontend (2026-07-03)
- `src/components/city-trip-section.tsx` (neu): Sektion mit zwei Phasen — Auswahl (Checkboxen, Deckel 20 mit Hinweis, Sortierung Nachhol-Bedarf: nie kontaktiert zuerst) und Review (editierbare Textarea pro Draft, Copy, WhatsApp-Link nur bei Telefonnummer, „Als Nachricht loggen" mit Geloggt-Badge gegen Doppel-Log, Fehlerzustand + Retry pro Kontakt)
- Exportierte pure Helfer (testbar): `matchesCity` (case-insensitive, getrimmt), `sortByNeglect`, `buildWhatsAppLink` (wa.me, +/00/0-Präfix-Normalisierung mit DE-Fallback)
- KI-Aufrufe gestaffelt (3 parallel) über Worker-Pool; Button während Lauf gesperrt (kein Doppelklick-Batch)
- Interaktions-Log: Client-Insert (Kanal message, heute, Notiz „City-Trip [Stadt]"), Follow-up via bestehendem DB-Trigger
- `src/components/project-detail.tsx`: Sektion zwischen Beteiligte und Projekt-Log eingebunden
- Hinweis: Draft-Erzeugung funktioniert erst nach Backend-Erweiterung (`occasionType: 'citytrip'` in draft-message-API)

### Backend (2026-07-03)
- `src/app/api/draft-message/route.ts` erweitert: `occasionType 'citytrip'` + optionale Felder `city` (Pflicht bei citytrip, Zod-refine → 400 ohne) und `timeframe`; neuer Prompt-Zweig („bin beruflich im Zeitraum X in Y — Kaffee/Abendessen?") nutzt kompletten bestehenden Kontext (Kontaktprofil, letzte Notizen, Schreibstil, Absender-Bio, Ton)
- Keine Migration, kein neuer Endpunkt
- 3 neue Integrationstests: citytrip mit Stadt+Zeitraum im Prompt, ohne Zeitraum (Fallback-Formulierung), 400 ohne Stadt

## Tech Design (Solution Architect)
**Designed:** 2026-07-03

### Überblick
Keine neue Tabelle, keine neuen Pakete, ein erweiterter bestehender KI-Endpunkt. Eine neue Sektion auf der Projekt-Detailseite plus clientseitiges Stadt-Matching.

### Component Structure
```
Projekt-Detailseite (bestehend)
+-- Beteiligte-Sektion (bestehend)
+-- City-Trip-Sektion (neu, nur wenn Projekt eine Stadt hat)
    +-- Kopf: „Kontakte in [Stadt]" + Auswahl-Zähler + Button „Nachrichten entwerfen"
    +-- Kontaktliste mit Checkboxen (Name, Firma, Stärke, letzter Kontakt)
    |   sortiert: nie kontaktiert zuerst, dann ältester letzter Kontakt
    +-- Review-Liste (nach Generierung, ersetzt Auswahl-Ansicht)
    |   +-- pro Kontakt: editierbarer Entwurf, Copy, WhatsApp-Link (falls Telefon),
    |   |   „Als Nachricht loggen" (nach Log als erledigt markiert)
    |   +-- pro Kontakt Fehlerzustand mit „Erneut versuchen"
    +-- Empty States (keine Stadt am Projekt / keine Kontakte vor Ort)
```

### Ablauf Batch-Draft
1. Nutzer wählt Kontakte (Deckel 20), klickt „Nachrichten entwerfen"
2. App ruft pro Kontakt den bestehenden Nachrichten-Endpunkt auf — gestaffelt (wenige parallel), UI zeigt Fortschritt, Button gesperrt während Lauf
3. Jeder Aufruf nutzt den neuen Anlass „City-Trip" mit Stadt + Case-Zeitraum als Kontext; alles andere (Kontaktprofil, Schreibstil aus eigenen Notizen, Absender-Bio) liefert der Endpunkt bereits heute
4. Fehler einzelner Aufrufe → Fehlerzustand nur an diesem Kontakt, Retry-Knopf
5. „Als Nachricht loggen" schreibt eine Interaktion (Kanal Nachricht, heute) — der bestehende Datenbank-Trigger aktualisiert Follow-up-Daten automatisch

### Data Model
Nichts Neues. Genutzt: Projekt (Stadt, Zeitraum), Kontakte (city, phone, last_contacted_at), Interaktionen (Log). Drafts werden bewusst NICHT gespeichert (nur im Browser bis Seiten-Reload).

### Tech Decisions (PM-Begründung)
- **Bestehenden Draft-Endpunkt erweitern statt neuem Batch-Endpunkt:** Kontext-Aufbau (Profil, Schreibstil, letzte Notizen, Absender-Bio) existiert dort komplett; ein neuer Anlass-Typ „City-Trip" mit Stadt/Zeitraum ist die kleinste Änderung. Batch = N Einzelaufrufe vom Browser, gestaffelt — natürliche Fehler-Isolation pro Kontakt
- **Stadt-Match im Browser:** Kontakte sind clientseitig verfügbar; exakter Vergleich (case-insensitive, getrimmt) konsistent mit Firmen-Match (PROJ-23)
- **Drafts nicht persistiert:** Wegwerf-Artefakte; Speicherung würde Tabelle + Lifecycle kosten, ohne Nutzen (Nachricht landet in WhatsApp/Mail, Beleg ist die geloggte Interaktion)
- **Sonnet für Drafts:** gleiche Modellwahl wie bestehende Nachrichtenvorschläge (Qualität zählt bei persönlichen Nachrichten)
- **Interaktions-Log über bestehenden Client-Pfad:** gleiche Semantik wie manuelles Loggen, DB-Trigger übernimmt Follow-up-Neuberechnung

### Dependencies (Pakete)
Keine neuen.

## Tech Design — Refine 2026-07-03 (Auto-Trigger via Kalender-Location)

### Component Structure

```
/dashboard (bestehend, PROJ-6/PROJ-21)
├── Sektion "Termine" (bestehend, PROJ-21, unverändert)
├── City-Trip-Auto-Trigger-Hinweis (NEU — dezente Zeile/Kachel, nach "Termine", vor den Anlass-Sektionen)
│   └── Pro Match: "Termin in [Stadt] — X Kontakte vor Ort im Projekt [Name]" → Link zu /profil/[projectId]
├── Sektion "Geburtstage aus dem Kalender" (bestehend, PROJ-6, unverändert)
├── Sektion "Heute & überfällig" (bestehend, unverändert)
├── Sektion "Nächste 14 Tage" (bestehend, unverändert)
└── Sektion "Kürzlich erkannt" (bestehend, unverändert)
```

### Data Model (plain language)

Keine neue Tabelle, keine neuen Felder. Der Hinweis entsteht aus einem Abgleich von zwei bereits vorhandenen Datenquellen:
- Kalender-Termine des Nutzers (bereits auf dem Dashboard geladen für die "Termine"-Sektion, jetzt inklusive Termin-Ort)
- Die eigenen aktiven Projekte (Name, Stadt) — neu geladen, aber nur diese drei Felder, keine vollständigen Projekt-Datensätze

### Tech Decisions (justified)

- **Kein neuer Kalender-Abruf:** Die Termine samt Ort kommen aus derselben Anfrage, die das Dashboard für die Termine-Sektion ohnehin schon macht — der Hinweis ist ein reiner Zusatz-Abgleich auf bereits vorhandenen Daten.
- **Nur aktive Projekte, schlanke Abfrage:** Es werden nur die drei für den Abgleich nötigen Felder (Name, Stadt, Status) geladen, nicht die vollständigen Projekt-Informationen (Beteiligte, Log etc.) — das würde für einen reinen Hinweis unnötig viel laden.
- **Abgleich als eigener, kleiner Baustein:** Der Vergleich "passt dieser Termin-Ort zu dieser Projekt-Stadt" ist eine einfache, in sich geschlossene Regel — als eigener Baustein isoliert, damit er unabhängig überprüfbar bleibt, statt im Seiten-Code versteckt zu sein.
- **Ein Hinweis pro Projekt, nicht pro Termin:** Verhindert, dass ein Nutzer mit mehreren Terminen in derselben Stadt denselben Hinweis mehrfach sieht.

### Dependencies (Packages)
Keine neuen — nutzt dieselbe Datenlage, die auf dem Dashboard bereits vorhanden ist.

## Implementation Notes (Frontend Refine 2026-07-03, Auto-Trigger via Kalender-Location)
- `src/lib/city-trip-match.ts` (neu): `matchesEventLocationToProjectCity(location, city)` (pure function, case-insensitive/getrimmter Substring-Vergleich); `findCityTripMatches(meetings, projects, contacts)` (pure function, ein Treffer pro aktivem Projekt mit gesetzter Stadt, inkl. `contactCount` — Kontakte mit exakt passender Stadt, gleiche Vergleichslogik wie `matchesCity` in `city-trip-section.tsx`, hier lokal dupliziert statt importiert um keine Lib→Component-Abhängigkeit einzuführen)
- `src/app/(app)/dashboard/page.tsx`: neuer `useEffect` lädt aktive Projekte (`id, title, city, status`, gefiltert auf `status = 'active'`) über den Supabase-Client (RLS-geschützt, kein neuer Server-Endpunkt); `useMemo` berechnet `cityTripMatches` aus bereits geladenen `meetingsData`/`activeProjects`/`contacts` — kein zusätzlicher Ladevorgang; dezenter Hinweis (dashed-border-Kachel, analog PROJ-21/PROJ-6-Muster) pro Treffer, direkt nach der "Termine"-Sektion, Link zu `/profil/[projectId]`
- `src/lib/city-trip-match.test.ts`: 11 Unit-Tests (Substring-Match case-insensitive/getrimmt, leere Eingaben, nur aktive Projekte, nur Projekte mit Stadt, ein Treffer pro Projekt bei mehreren Terminen, mehrere Projekte unabhängig, keine Location → kein Treffer, Kontakt-Zähler inkl. Null-Fall)
- `npm run lint` läuft fehlerfrei durch, `npx tsc --noEmit` sauber (zwei vorbestehende, unabhängige Fehler in `linkedin-profile.test.ts` ausgenommen)

## QA Test Results

### Lauf 1 — 2026-07-03

**Automatisierte Tests:** Vitest 251/251 grün (11 neue: 3 citytrip-Integrationstests an draft-message, 8 Unit-Tests für matchesCity/sortByNeglect/buildWhatsAppLink). Lint + Build sauber.

**E2E (Playwright, `tests/PROJ-14-city-trip-modus.spec.ts`, 8 Tests × chromium + Mobile Safari = 16):** alle grün.
Abgedeckt: Vor-Ort-Liste (case-insensitive Match, Sortierung Nachhol-Bedarf), Hinweis ohne Projekt-Stadt, Empty State, Button-Disable ohne Auswahl, Batch-Review (editierbar, Copy immer, WhatsApp nur mit Telefonnummer), Fehler-Isolation + Retry pro Draft, Interaktions-Log mit DB-Verifikation + Doppel-Log-Schutz, 20er-Auswahl-Deckel mit Hinweis.
Draft-API im E2E per `page.route` gemockt (deterministisch, keine Sonnet-Kosten); der echte KI-Pfad ist durch Integrationstests + produktionserprobte draft-message-Route abgedeckt.

**Security-Audit:**
- Kein neuer Endpunkt; draft-message: 401 ohne Session, Zod (city/timeframe max 100, citytrip ohne city → 400) ✅
- Interaktions-Insert über RLS-geschützten Client-Pfad ✅
- wa.me-Link: encodeURIComponent + rel="noopener" ✅; XSS: React-escaped ✅
- Hinweis (Low, pre-existing): draft-message hat kein serverseitiges Rate-Limit — Batch-Deckel ist clientseitig; Angriffsfläche nur der authentifizierte Nutzer selbst

**Regression:** PROJ-12-Suite 15/15 grün — dabei letzten Stale-Selektor derselben Klasse wie gestern gefixt (`menuitem 'Verlauf'` → Icon-Button, Zeile 314); global geprüft, keine weiteren Vorkommen.

**Bugs:** keine.

**Production-Ready: JA**

## QA Test Results — Refine 2026-07-03 (Dashboard-Auto-Trigger via Kalender-Location)

**Tested:** 2026-07-03
**App URL:** http://localhost:3000 (Dev), gegen echtes QA-Supabase-Projekt (`bennewroly+qa-proj5@gmail.com`)
**Tester:** QA Engineer (AI)

### Wichtige Einschränkung des Testumfangs
Identische Einschränkung wie bei PROJ-21/PROJ-6/PROJ-8: QA-Account hat keinen `connector_tokens`-Eintrag für `google`. Der "verbunden + Treffer"-Pfad (echter Hinweis mit Link) kann nicht live verifiziert werden. Vollständig durch Vitest abgedeckt (`city-trip-match.test.ts`, 11/11: Substring-Match, nur aktive Projekte, nur Projekte mit Stadt, ein Treffer pro Projekt, mehrere Projekte unabhängig, Kontakt-Zähler).

### Acceptance Criteria Status

#### Auto-Trigger via Kalender-Location
- [ ] **NICHT TESTBAR (QA-Account nicht verbunden):** Hinweis mit korrektem Text/Link, ein Hinweis pro Projekt, mehrere Projekte unabhängig — durch Vitest verifiziert (`city-trip-match.test.ts`)
- [x] Kein Google verbunden → kein Hinweis, obwohl ein aktives Projekt mit passender Stadt im QA-Account existiert (aus der bestehenden PROJ-14-Testsuite geseedet) — Live verifiziert, E2E-Test neu, bestätigt dass das Fehlen von Kalender-Daten den Nudge korrekt unterdrückt statt fälschlich zu crashen oder anzuzeigen

### Bugs Found
Keine.

### Regression Testing
- `npm test`: 301/301 grün (36 Testdateien, davon 11 neu in diesem Refine)
- `npm run lint` + `npm run build`: fehlerfrei
- E2E Chromium, seriell (`--workers=1`, Projekt-Konvention bei geteiltem QA-Account): PROJ-14 9/9 (1 neu) · PROJ-21 6/6 · PROJ-6 47/47 · PROJ-8 13/13 — 69/69 gesamt grün, keine Regression durch den neuen Dashboard-Hinweis (insb. keine Interferenz mit den bereits dort lebenden Sektionen aus PROJ-21/PROJ-6)

### Security Audit Results
- [x] Kein neuer Server-Endpunkt, keine neue Angriffsfläche — `projects`-Query nutzt bestehende RLS-Policy aus PROJ-12 (owner-only), unverändert
- [x] Kein neues Secret, keine neue Env-Var, keine neue Migration
- [x] Matching-Logik ist reine Client-seitige String-Verarbeitung, kein Injection-Vektor (keine dynamische Query-Konstruktion)

### Summary
- **Acceptance Criteria:** 1/2 live verifiziert (nicht-verbunden-Pfad), 1/2 durch Vitest abgedeckt aber nicht live testbar (QA-Account-Limitation, identisch zu allen anderen Refines dieser Initiative)
- **Bugs Found:** 0
- **Security:** Pass
- **Production Ready:** JA
- **Recommendation:** Deploy freigeben — letztes Item der Google-Calendar-Connector-Initiative (PROJ-21 → PROJ-6 → PROJ-8 → PROJ-14).

## Deployment

**Production URL:** https://bambi-w26q.vercel.app (Sektion auf Projekt-Detailseiten, /profil/[id])
**Deployed:** 2026-07-03 (Vercel Auto-Deploy via Push auf main, Build 52s, Status Ready)
**Tag:** v1.22.0-PROJ-14

- Keine Migration, keine neuen Env-Vars
- Post-Deploy-Check: draft-message mit citytrip-Payload ohne Session → Redirect auf Login (Auth-Schutz greift)

### Update 2026-07-03 (Refine: Dashboard-Auto-Trigger via Kalender-Location)
- Commit `6cda0bd` gepusht zu `origin/main` (enthält Refine/Architecture/Frontend/QA-Commits dieses Refines — kein Backend-Schritt nötig)
- Vercel-Build erfolgreich (58s), Deployment `Ready`, Production: `https://bambi-w26q-c8uxcq0t2-bendewar10s-projects.vercel.app`
- `https://bambi-w26q.vercel.app/login` → 200, `/dashboard` unauthentifiziert → 307 (Auth-Gate funktioniert)
- Keine neuen Env-Vars, keine neue Migration — nutzt vollständig die bereits in PROJ-19/21 gesetzte Infrastruktur
- Letztes Item der Google-Calendar-Connector-Initiative (PROJ-21 → PROJ-6 → PROJ-8 → PROJ-14), alle vier live in Production
- Bekannter nachgelagerter Schritt (identisch zu allen anderen Refines dieser Initiative): QA-Account ist weiterhin nicht mit Google verbunden — "verbunden"-Pfad bleibt bis dahin nur Vitest-verifiziert

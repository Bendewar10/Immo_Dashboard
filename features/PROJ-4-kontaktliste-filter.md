# PROJ-4: Kontaktliste & Filter

## Status: Deployed
**Created:** 2026-06-19
**Last Updated:** 2026-07-01

> Refinement 2026-07-01 (Firmen-/Titel-Suche): Neues Textfeld "Firma/Titel suchen" filtert live auf `employer` ODER `job_title` (Substring, case-insensitive), UND-verknüpft mit allen bestehenden Filtern (Name, Stadt, Kategorie, Stärke). Motivation: MBB-Berater denken in Firmen/Fonds ("wen kenne ich bei BCG?"), nicht nur in Namen — bisher war weder `employer` noch `job_title` durchsuchbar. Bewusst als eigenes Feld (nicht die Namenssuche erweitert), analog zum bestehenden Stadt-Filter-Pattern. Gruppierung der Liste nach Arbeitgeber ist bewusst nicht Teil dieses Refines (siehe Out of Scope) — eigenes Refine bei Bedarf.

## Implementation Notes
- **Erweiterung 2026-07-01 (Firmen-/Titel-Suche):** `contact-list.tsx` um `companySearch`-State + Filter ergänzt — gleiches Live-"enthält"-Pattern wie Stadt-/Namenssuche, matcht `contact.employer` ODER `contact.job_title` (case-insensitive), UND-verknüpft mit allen bestehenden Filtern. Neues Input-Feld "Firma/Titel suchen..." in der Filter-Leiste nach dem Stadt-Feld. `hasFiltersActive` um `companySearch` ergänzt (steuert No-Results- vs. Empty-State-Text). Kein Backend nötig — `employer`/`job_title` existieren bereits auf `contacts` (PROJ-3), reiner Client-Filter analog zu Stadt.
- **Erweiterung 2026-06-22:** `contact-list.tsx` um `citySearch`-State + Filter ergänzt (gleiches Live-"enthält"-Pattern wie Namenssuche, case-insensitive, UND-verknüpft mit bestehenden Filtern), zusätzliches Input-Feld in der Filter-Leiste.
- `src/lib/contacts.ts`: `Contact`-Interface um `last_contacted_at`/`next_followup_at` ergänzt (fehlten bisher, werden für Anzeige/Sortierung benötigt)
- `src/components/contact-card.tsx`: neue Karten-Komponente — Name, Kategorie-/Stärke-Badges, letzter Kontakt, nächstes Follow-up (rot + "(überfällig)" wenn in der Vergangenheit), Klick öffnet Edit, Löschen-Button mit `stopPropagation`
- `src/components/contact-list.tsx`: komplett ersetzt — Filter-Leiste (Namenssuche, Kategorie-Select, Stärke-Select, alle UND-verknüpft, client-seitig via `useMemo`), Sortierung nach `next_followup_at` (null ans Ende), Empty-State vs. No-Results-State unterschieden
- `ContactFormDialog` aus PROJ-3 unverändert wiederverwendet
- Live verifiziert mit 3 Test-Kontakten (überfällig/zukünftig/ohne Follow-up): Sortierreihenfolge korrekt, Overdue-Highlight korrekt, Kategorie-Filter korrekt
- **Wichtiger Hinweis:** `next_followup_at` wird aktuell von keinem Feature aktiv gesetzt — der DB-Trigger dafür greift erst bei einem Interaction-Insert (PROJ-5, noch nicht gebaut). Bis dahin haben alle über PROJ-3 angelegten Kontakte `next_followup_at = null` und landen alle gleichrangig am Ende der Sortierung — funktional korrekt, aber Overdue-Highlight kommt erst mit PROJ-5 wirklich zum Einsatz

## Dependencies
- PROJ-3 (Kontakt anlegen & verwalten) — `contacts`-Tabelle, CRUD-Operationen und Übergangsliste existieren bereits, `city`-Feld kommt mit der PROJ-3-Erweiterung dazu (Voraussetzung für diesen Stadt-Filter)

## User Stories
- Als Nutzer möchte ich alle meine Kontakte als Karten sehen, damit ich auf einen Blick Name, Kategorie, Beziehungsstärke und Follow-up-Status erkenne
- Als Nutzer möchte ich Kontakte nach Kategorie und Beziehungsstärke filtern können, damit ich z.B. nur Investoren oder nur Kernkontakte sehe
- Als Nutzer möchte ich Kontakte nach Namen durchsuchen können, damit ich einen bestimmten Kontakt schnell finde
- Als Nutzer möchte ich Kontakte nach Stadt filtern können, damit ich z.B. sehe wer in Berlin ist, wenn ich dort bin
- Als Nutzer möchte ich überfällige Follow-ups visuell hervorgehoben sehen, damit ich direkt erkenne, wer schon lange ansteht
- Als Nutzer möchte ich die Liste standardmäßig nach Follow-up-Dringlichkeit sortiert sehen, damit die wichtigsten Kontakte oben stehen
- **Neu (Refine 2026-07-01):** Als Nutzer möchte ich nach Firma oder Jobtitel suchen können, damit ich schnell sehe, wen ich bei einem bestimmten Arbeitgeber (z.B. einem Fund oder einer Beratung) kenne, ohne mich an den Namen erinnern zu müssen

## Out of Scope
- Sortier-Auswahl durch den Nutzer (z.B. manuell nach Name/Datum umschalten) — fixe Standard-Sortierung nach Follow-up-Dringlichkeit für MVP, kein Sortier-UI
- Mehrfachauswahl/Bulk-Aktionen in der Liste — kein MVP-Bedarf
- Speichern von Filter-Einstellungen über Sessions hinweg — Filter resetten bei Page-Reload
- Paginierung/Infinite Scroll — bei aktuell erwarteter Kontaktanzahl (persönliches Netzwerk) reicht eine vollständige Liste ohne Pagination
- Eigene Detail-Seite pro Kontakt — Klick auf Karte öffnet weiterhin das Bearbeiten-Formular aus PROJ-3, keine separate Profilansicht
- Follow-up Dashboard / Tagesansicht mit Aktions-Buttons ("Kontaktiert") — eigenes Feature PROJ-6
- **Neu (Refine 2026-07-01):** Gruppierung der Kontaktliste nach Arbeitgeber (z.B. Sections pro Firma) — bewusst nicht in diesem Refine, größerer Layout-Umbau (Sections statt flaches Grid), eigenes Refine bei Bedarf
- **Neu:** Autocomplete/Vorschlagsliste bekannter Firmennamen im Suchfeld — reines "enthält"-Textfeld analog zum Stadt-Filter, kein Sammeln/Deduplizieren vorkommender Firmennamen für MVP
- **Neu:** Erweiterung der Namenssuche um Firma/Titel (ein gemeinsames Feld) — bewusst als separates Feld, damit Nutzer gezielt nach Person ODER Firma suchen können, ohne dass ein Namenstreffer durch einen zufälligen Firmennamens-Treffer verwässert wird

## Acceptance Criteria

- [ ] Angenommen der Nutzer ist eingeloggt und hat Kontakte, wenn er die Startseite aufruft, dann sieht er alle eigenen Kontakte als Karten mit Name, Kategorie, Beziehungsstärke, letztem Kontakt und nächstem Follow-up
- [ ] Angenommen keine Filter sind aktiv, wenn die Liste lädt, dann sind die Karten nach `next_followup_at` aufsteigend sortiert (kein Follow-up-Datum = ans Ende)
- [ ] Angenommen ein Kontakt hat ein `next_followup_at` in der Vergangenheit, wenn die Liste angezeigt wird, dann ist diese Karte visuell als überfällig hervorgehoben (rot)
- [ ] Angenommen der Nutzer wählt eine Kategorie im Filter, wenn der Filter angewendet wird, dann zeigt die Liste nur Kontakte dieser Kategorie
- [ ] Angenommen der Nutzer wählt eine Beziehungsstärke im Filter, wenn der Filter angewendet wird, dann zeigt die Liste nur Kontakte dieser Stärke
- [ ] Angenommen Kategorie- UND Stärke-Filter sind gleichzeitig aktiv, wenn beide angewendet werden, dann zeigt die Liste nur Kontakte, die beide Kriterien erfüllen (UND-Verknüpfung)
- [ ] Angenommen der Nutzer tippt einen Suchbegriff ins Namensfeld, wenn die Eingabe erfolgt, dann filtert die Liste live auf Kontakte, deren Name den Suchbegriff enthält (case-insensitive)
- [ ] Angenommen der Nutzer tippt einen Suchbegriff ins Stadt-Feld, wenn die Eingabe erfolgt, dann filtert die Liste live auf Kontakte, deren Stadt den Suchbegriff enthält (case-insensitive, gleiches Pattern wie Namenssuche)
- [ ] Angenommen Stadt-Filter ist mit Kategorie/Stärke/Namenssuche kombiniert, wenn mehrere aktiv sind, dann werden alle UND-verknüpft (gleiche Logik wie bestehende Filter)
- [ ] Angenommen ein Kontakt hat keine Stadt eingetragen, wenn der Stadt-Filter aktiv ist, dann erscheint dieser Kontakt nicht in den Treffern (kein "leer = alles"-Verhalten)
- [ ] Angenommen Filter sind aktiv und liefern keine Treffer, wenn die Liste das erkennt, dann wird ein Hinweis angezeigt, dass keine Kontakte zu den Filtern passen
- [ ] Angenommen noch kein Kontakt existiert, wenn der Nutzer die Seite aufruft, dann wird der bestehende Empty-State mit "Kontakt hinzufügen"-Button angezeigt (aus PROJ-3 übernommen)
- [ ] Angenommen der Nutzer klickt auf eine Kontakt-Karte, wenn die Karte angeklickt wird, dann öffnet sich das Bearbeiten-Formular aus PROJ-3 vorausgefüllt

### Firmen-/Titel-Suche (Refine 2026-07-01)
- [ ] Angenommen der Nutzer tippt einen Suchbegriff ins Firmen/Titel-Feld, wenn die Eingabe erfolgt, dann filtert die Liste live auf Kontakte, deren `employer` ODER `job_title` den Suchbegriff enthält (case-insensitive)
- [ ] Angenommen Firmen/Titel-Suche ist mit Namenssuche/Stadt-Filter/Kategorie/Stärke kombiniert, wenn mehrere aktiv sind, dann werden alle UND-verknüpft (gleiche Logik wie bestehende Filter)
- [ ] Angenommen ein Kontakt hat weder `employer` noch `job_title` eingetragen, wenn der Firmen/Titel-Filter aktiv ist, dann erscheint dieser Kontakt nicht in den Treffern (kein "leer = alles"-Verhalten, gleiches Prinzip wie Stadt-Filter)
- [ ] Angenommen der Suchbegriff matcht nur `job_title`, nicht `employer` (oder umgekehrt), wenn der Filter angewendet wird, dann erscheint der Kontakt trotzdem (ODER-Verknüpfung zwischen den beiden Feldern, UND-Verknüpfung zu den übrigen Filtern)

## Edge Cases
- Sehr lange Namen/Notizen in der Karte → Text wird abgeschnitten (Ellipsis), volle Werte nur im Bearbeiten-Formular sichtbar
- Kontakt ohne Kategorie/Stärke/Follow-up-Datum → entsprechende Badges/Infos werden auf der Karte einfach weggelassen, kein "leer"-Platzhalter
- Filter + Suche gleichzeitig aktiv, dann Kontakt gelöscht (aus PROJ-3) → Liste aktualisiert sich, gefilterte Ansicht bleibt mit den Filtern bestehen
- Groß-/Kleinschreibung bei Namenssuche → ignoriert (case-insensitive Vergleich)
- Whitespace-only Suchbegriff → wird wie leere Suche behandelt (kein Filter aktiv)
- Whitespace-only Stadt-Suchbegriff → wird wie leere Suche behandelt (kein Filter aktiv)
- Kontakt ohne Stadt + aktiver Stadt-Filter → Kontakt wird ausgeblendet (siehe AC oben)
- **Neu (Refine 2026-07-01):** Whitespace-only Firmen/Titel-Suchbegriff → wird wie leere Suche behandelt (kein Filter aktiv, gleiches Pattern wie Namens-/Stadt-Suche)
- **Neu:** Kontakt hat `employer` gesetzt, aber `job_title` leer (oder umgekehrt) → Suche matcht trotzdem, sobald eines der beiden Felder den Suchbegriff enthält
- **Neu:** Firmen/Titel-Suche + alle anderen Filter gleichzeitig aktiv, liefern zusammen 0 Treffer → gleicher No-Results-Hinweis wie bei jeder anderen Filterkombination (kein Sonderfall)

## Technical Requirements
- Security: Liste lädt ausschließlich Kontakte des eingeloggten Nutzers — RLS aus PROJ-1 erzwingt das bereits serverseitig, Frontend-Filter dürfen sich nicht darauf verlassen müssen, aber auch keine fremden Daten anfragen
- Performance: Filterung/Suche client-seitig auf bereits geladenen Kontakten (keine Server-Roundtrips pro Tastenanschlag), da keine Pagination und überschaubare Datenmenge

## Open Questions
_Keine offenen Fragen — siehe Decision Log._

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Karten-Darstellung statt Tabelle | Mehr visueller Kontext pro Kontakt, passt zum "Beziehungspflege"-Charakter der App | 2026-06-19 |
| Filter: Kategorie + Stärke + Namenssuche, alle UND-verknüpft | Deckt Hauptanwendungsfälle ab ("alle Investoren", "alle Kernkontakte", "suche Max") ohne UI-Komplexität | 2026-06-19 |
| Stadt-Filter als Textfeld (Live-"enthält"-Suche), nicht Dropdown | Stadt ist Freitext ohne festes Enum — Dropdown würde Sammeln aller vorkommenden Städte erfordern, unnötiger Aufwand ggü. simplem Textfilter analog zur Namenssuche | 2026-06-22 |
| Standard-Sortierung: nach `next_followup_at`, kein Sortier-UI | Passt zum Kernzweck der App (wer steht als nächstes an), keine zusätzliche UI-Entscheidung für MVP nötig | 2026-06-19 |
| Überfällige Follow-ups rot markiert | Macht "fällige Kontakte" auf einen Blick sichtbar, unterstützt PRD-Erfolgsmetrik "fällige Kontakte sinkt auf 0" | 2026-06-19 |
| Liste ersetzt Startseite (`/`) komplett statt eigener Route | Einzige zentrale Ansicht aktuell, vermeidet unnötigen Klick — spätere Features (PROJ-6) bekommen ggf. eigene Navigation | 2026-06-19 |
| Klick auf Karte öffnet PROJ-3-Bearbeiten-Formular, keine eigene Detailseite | Vermeidet doppelte UI für dieselben Daten, Formular deckt bereits alle Felder ab | 2026-06-19 |
| Keine Pagination | Persönliches Netzwerk, überschaubare Kontaktanzahl erwartet, client-seitiges Filtern ausreichend performant | 2026-06-19 |
| Firmen-/Titel-Suche als eigenes Textfeld (nicht Namenssuche erweitert) | Nutzerentscheidung im Refine-Interview: gezielte Suche nach Person ODER Firma, ohne dass ein Namenstreffer durch einen Firmennamens-Treffer verwässert wird — analog zum bestehenden Stadt-Filter-Pattern | 2026-07-01 |
| Suchbegriff matcht `employer` ODER `job_title` (nicht nur eines von beiden) | MBB-Berater suchen sowohl nach Firma ("BCG") als auch nach Rolle ("Partner") — ein Feld für beide Fälle vermeidet zwei zusätzliche Filterfelder | 2026-07-01 |
| Firmen-Gruppierung der Liste bewusst nicht Teil dieses Refines | Größerer Scope (Layout-Umbau Sections statt flaches Grid) als reine Such-Erweiterung — Nutzerentscheidung, kleinen Scope zuerst zu shippen | 2026-07-01 |

### Technical Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Client-seitiges Filtern/Sortieren statt Server-Roundtrip | Sofortiges Feedback, keine Latenz pro Tastenanschlag, ausreichend bei überschaubarer Datenmenge | 2026-06-19 |
| `ContactFormDialog` aus PROJ-3 unverändert wiederverwendet | Keine Logik-Duplikation, nur neuer Einstiegspunkt (Karte statt Liste) | 2026-06-19 |
| Firmen/Titel-Filter läuft client-seitig, gleiches `useMemo`-Filter-Pattern wie alle bestehenden Filter | Konsistenz, keine neue Filter-Architektur nötig — ein zusätzlicher `.filter()`-Schritt in der bestehenden Kette | 2026-07-01 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Component Structure

```
/ (Startseite, ersetzt die PROJ-3-Übergangsliste vollständig)
├── Filter-Leiste
│   ├── Namenssuche (Textfeld, live)
│   ├── Stadt-Suche (Textfeld, live, gleiches Pattern wie Namenssuche)
│   ├── Kategorie-Filter (Auswahl)
│   └── Beziehungsstärke-Filter (Auswahl)
├── "Kontakt hinzufügen"-Button
├── Kontakt-Karten (sortiert nach Follow-up-Dringlichkeit)
│   └── Pro Karte: Name, Kategorie-Badge, Stärke-Badge, letzter Kontakt,
│       nächstes Follow-up (rot hervorgehoben wenn überfällig)
│       → Klick öffnet das bestehende Bearbeiten-Formular aus PROJ-3
├── Empty State ("Noch keine Kontakte") — aus PROJ-3 übernommen
└── No-Results State ("Keine Kontakte zu diesen Filtern") — neu für Filter-Fall
```

### Data Model (plain language)

Keine eigene Änderung — nutzt das `city`-Feld, das mit der PROJ-3-Erweiterung an `contacts` dazukommt. Kein neues Feld, keine neue Tabelle aus PROJ-4-Sicht.

### Tech Decisions (justified)

- **Client-seitiges Filtern/Sortieren statt Server-Roundtrip pro Filteränderung:** Alle Kontakte werden einmal geladen (wie schon in PROJ-3), Filter/Suche operieren auf den bereits geladenen Daten im Browser — sofortiges Feedback ohne Netzwerk-Latenz bei jedem Tastenanschlag, sinnvoll bei der erwarteten überschaubaren Kontaktanzahl eines persönlichen Netzwerks.
- **Bestehendes `ContactFormDialog` aus PROJ-3 unverändert wiederverwendet:** Gleiche Felder, gleiche Validierung, keine Logik-Duplikation — nur der Einstiegspunkt (Karten-Klick statt Listenzeile) ändert sich.
- **shadcn `Card` + `Badge` für die Kontakt-Darstellung:** Standard-Komponenten bereits installiert, passen zum bestehenden Design-System ohne Custom-CSS.
- **Überfällig-Markierung rein visuell (rote Border/Text), keine Datenbank-Logik:** Berechnung (`next_followup_at < jetzt`) passiert client-seitig beim Rendern, kein zusätzliches DB-Feld oder Trigger nötig.

### Dependencies (Packages)
Keine neuen Packages — `Card`, `Badge`, `Input`, `Select` bereits installiert (shadcn/ui).

## QA Test Results

**Date:** 2026-06-19
**Tested by:** /qa (live gegen echten Account, Test-Daten via REST-API geseedet/aufgeräumt)

### Acceptance Criteria
| # | Criterion | Result |
|---|---|---|
| 1 | Karten zeigen Name, Kategorie, Stärke, Follow-up-Infos | ✅ Pass (E2E) |
| 2 | Sortierung nach `next_followup_at`, null ans Ende | ✅ Pass (E2E) |
| 3 | Überfälliger Kontakt visuell hervorgehoben | ✅ Pass (E2E) |
| 4 | Kategorie-Filter zeigt nur passende Kontakte | ✅ Pass (E2E) |
| 5 | Stärke-Filter zeigt nur passende Kontakte | ✅ Pass (E2E) |
| 6 | Kategorie+Stärke kombiniert (UND) | ✅ Pass (E2E) |
| 7 | Namenssuche live, case-insensitive | ✅ Pass (E2E) |
| 8 | No-Results-Hinweis bei 0 Treffern trotz Filter | ✅ Pass (E2E) |
| 9 | Empty State bei 0 Kontakten überhaupt | ✅ Pass — bereits durch PROJ-3 AC10 abgedeckt (gleiche UI-Logik, kein neuer Test nötig) |
| 10 | Klick auf Karte öffnet Bearbeiten-Formular vorausgefüllt | ✅ Pass (E2E) |

**Erweiterung 2026-06-22 (Stadt-Filter):**
| # | Criterion | Result |
|---|---|---|
| 11 | Stadt-Filter zeigt nur Kontakte dieser Stadt (live, case-insensitive) | ✅ Pass (E2E) |
| 12 | Stadt-Filter + Kategorie-Filter kombiniert (UND) | ✅ Pass (E2E) |
| 13 | Kontakt ohne Stadt wird bei aktivem Stadt-Filter ausgeblendet | ✅ Pass (E2E, mit abgedeckt durch AC11-Seed-Daten) |

### Automated Tests
- `npm test` → 1 file, 2/2 passed (Regression PROJ-1)
- `npm run test:e2e` → **46/46 passed** (PROJ-2, PROJ-3, PROJ-4, alle ACs × Chromium + Mobile Safari)
- Playwright Browser-Binaries waren bereits installiert

**Erweiterung 2026-06-22:** `npm run test:e2e` (PROJ-3+PROJ-4 zusammen) → 23/23 passed auf Chromium UND Mobile Safari. Voller Regressionslauf (PROJ-2/3/4/5) → 24/24 passed (1 bekannter Cold-Start-Flake bei PROJ-3 AC1, siehe PROJ-3-Spec, kein neuer Bug).

### Bugs Found

**🔴 High (gefunden + sofort gefixt):** PROJ-3's E2E-Suite (`PROJ-3-contacts.spec.ts`) nutzte `getByRole('listitem')`-Selektoren von der alten `<li>`-basierten Übergangsliste. PROJ-4 ersetzte diese durch `<Card>`-Divs ohne `listitem`-Rolle — die Selektoren fanden dadurch nichts mehr. Da die Tests in `describe.serial` liefen, brach die Suite nach dem ersten Fehlschlag ab und alle nachfolgenden PROJ-3-ACs wurden als "did not run" stillschweigend übersprungen, ohne dass dies in der Konsolen-Zusammenfassung auffiel. Dies ist kein Produktbug, aber ein kritischer Regressionstest-Ausfall: PROJ-3 hätte bei echten Bugs nicht mehr zuverlässig getestet werden können. Fix: alle Selektoren auf die neue Card-Struktur (`.cursor-pointer`-Klasse) umgestellt, alle Delete-Cleanups warten jetzt explizit auf die DELETE-Response.

**🟡 Low (gefunden + sofort gefixt, 2026-06-22):** `PROJ-4-contacts-list.spec.ts` und `PROJ-5-interaction-log.spec.ts` requireten `QA_SUPABASE_URL`/`QA_SUPABASE_ANON_KEY` strikt (`!`-Assertion), ohne dass diese Variablen in `.env.local` existierten — beide Dateien crashten beim Testlauf mit `Invalid URL`, nicht auf einen Produktbug zurückführbar. Fix: Fallback auf bestehende `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` (gleiches Supabase-Projekt, keine separate QA-Instanz). Zusätzlich `dotenv` in `playwright.config.ts` ergänzt, damit `.env.local` für den Test-Prozess überhaupt geladen wird (vorher nur im Next.js-Dev-Server verfügbar).

**Keine offenen Produktbugs.**

### Security Audit (Red Team)
- **XSS-Versuch:** Kontakt mit Name `<script>alert(1)</script>` angelegt — React rendert als reiner Text (kein `dangerouslySetInnerHTML` verwendet), kein Script-Execute, kein `dialog`-Event ausgelöst
- **Cross-User-Isolation:** keine neue Prüfung nötig — Liste nutzt dieselbe `.select('*')`-Query + RLS-Policy wie PROJ-3, dort bereits mit echtem zweiten Account verifiziert (siehe PROJ-3 QA)
- **Stadt-Filter (Erweiterung):** rein client-seitiger Filter auf bereits durch RLS vorgefilterten Daten, kein neuer Server-Request, keine neue Angriffsfläche
- **Client-seitige Filter:** Filter/Suche laufen rein im Browser auf bereits durch RLS vorgefilterten Daten — kein zusätzlicher Angriffsvektor, da kein neuer Server-Request pro Filteränderung

### Test-Infrastruktur-Hinweise (nicht produktrelevant)
- Gleiche bekannte Flakes wie bei PROJ-2/3: Next.js Dev-Mode Cold-Compile bei allererster Interaktion, parallele Logins desselben Accounts invalidieren sich gegenseitig — Suite muss seriell (`--workers=1`) mit echten Accounts laufen

### Production-Ready: **YES**

## QA Test Results — Refine 2026-07-01 (Firmen-/Titel-Suche)

**Tested:** 2026-07-01
**App URL:** http://localhost:3000 (Dev), gegen echtes QA-Supabase-Projekt (`bennewroly+qa-proj5@gmail.com`)
**Tester:** QA Engineer (AI)

### Scope
Delta aus diesem Refine: neues Firmen/Titel-Suchfeld (`employer` ODER `job_title`, UND-verknüpft mit bestehenden Filtern). Zusätzlich vollständige Regressionsprüfung der bestehenden PROJ-4-Suite, dabei mehrere vorbestehende Testbrüche entdeckt (siehe Bugs) — die Kategorie-Werte des Produkts wurden zwischenzeitlich von einem generischen CRM-Vokabular (Investor/Friend/Business) auf ein MBB-spezifisches Vokabular (Kollege/Alumni/Extern/Privat/Sonstige) umgestellt, ohne dass die E2E-Suite nachgezogen wurde.

### Acceptance Criteria Status (Delta)
- [x] Suchbegriff im Firmen/Titel-Feld filtert live auf `employer` ODER `job_title` (case-insensitive)
- [x] Firmen/Titel-Suche + Namenssuche/Stadt/Kategorie/Stärke kombinieren UND-verknüpft
- [x] Kontakt ohne `employer` UND ohne `job_title` wird bei aktivem Filter ausgeblendet
- [x] Suchbegriff matcht nur `job_title` (nicht `employer`) → Kontakt erscheint trotzdem (ODER zwischen den Feldern)
- [x] Whitespace-only Suchbegriff wird wie leere Suche behandelt

**5/5 Acceptance Criteria (Delta) bestanden.**

### E2E Tests (neu)
- `tests/PROJ-4-contacts-list.spec.ts`: 4 neue Tests (employer-Match, job_title-Match, Kombination mit Kategorie-Filter, Whitespace-only-Verhalten) + Seed-Daten um `employer`/`job_title` ergänzt
- Chromium: **15/15 grün** (11 bestehend + 4 neu, nach Bugfixes — siehe unten)

### Security Audit Results
- [x] Firmen/Titel-Filter läuft rein client-seitig auf bereits durch RLS vorgefilterten Daten — kein neuer Server-Request, keine neue Angriffsfläche (gleiches Muster wie Stadt-Filter)
- [x] Kein XSS-Vektor: `employer`/`job_title` werden über React-Textknoten gerendert (kein `dangerouslySetInnerHTML`)
- [x] Keine neue Cross-User-Exposition — Filter operiert auf der bereits RLS-beschränkten `contacts`-Query

### Bugs Found

Alle folgenden Bugs sind **vorbestehende Regressionen** in der E2E-Suite (Testdatei-Drift, kein Produktbug), entdeckt bei der vollständigen Regressionsprüfung. Test-Fixes wurden vorgenommen, da sie die Verifikation der neuen Delta-ACs blockierten (`describe.serial` bricht bei erstem Fehlschlag komplett ab).

#### BUG-12: PROJ-4-Suite nutzte veraltete Kategorie-Werte ("Investor"/"Friend"/"Business") — FIXED (Test)
- **Severity:** High (blockierte die gesamte PROJ-4-Regressionssuite)
- **Root Cause:** `Category`-Typ wurde von generischem CRM-Vokabular auf MBB-spezifisches Vokabular umgestellt (`src/lib/contacts.ts`: jetzt `colleague`/`alumni`/`extern`/`private`/`other`) — Seed-Daten und Assertions der Test-Datei wurden nicht nachgezogen
- **Fix (Test):** Seed-Kategorien auf `colleague`/`private`/`extern` umgestellt, Assertions auf `Kollege` statt `Investor` angepasst (AC1, AC4, AC6, Stadt+Kategorie-Kombi-Test)
- **Zusätzlich entdeckt:** AC1 erwartete Stärke-Label "Kern", das nie existiert hat (`STRENGTH_LABELS` kennt nur Stark/Mittel/Locker) — auf "Stark" korrigiert
- **Empfehlung:** Kein App-Code-Fix nötig, nur Testdatei betroffen

#### BUG-13: Kategorie-Select-Trigger-Text in Tests falsch ("Alle Kategorien" statt "Alle Typen") — FIXED (Test)
- **Severity:** Medium
- **Root Cause:** `SelectValue`-Platzhalter ist `"Kontakttyp"`, Default-Option-Label ist `"Alle Typen"` (`src/components/contact-list.tsx`) — Test suchte nach nie existiertem Text `"Alle Kategorien"`
- **Impact:** Da `categoryFilter` initial auf `ALL` steht (nicht `undefined`), zeigt der Trigger den Options-Text `"Alle Typen"`, nicht den Placeholder — betrifft alle Tests, die den Kategorie-Filter öffnen
- **Fix (Test):** Alle 4 Vorkommen auf `getByText('Alle Typen')` korrigiert
- **Empfehlung:** Kein App-Code-Fix nötig

#### BUG-14: PROJ-3-Regressionssuite ebenfalls durch Kategorie-Enum-Drift blockiert — NOT FIXED (Out of Scope)
- **Severity:** High (blockiert PROJ-3-Regressionssuite komplett), aber außerhalb des Scopes dieses Refines
- **Steps to Reproduce:** `npx playwright test tests/PROJ-3-contacts.spec.ts` — AC2 wählt Kategorie-Option "Freund" und Stärke-Option "Kern", beide existieren im aktuellen Datenmodell nicht mehr
- **Impact:** PROJ-3 (Kontakt anlegen & verwalten) ist bereits "Deployed" und selbst nicht Gegenstand dieses Refines — Fix gehört in eine eigene QA-Runde für PROJ-3, nicht in dieses Firmen-/Titel-Suche-Refine
- **Empfehlung:** Separates Ticket "PROJ-3 E2E-Suite an aktuelles Kategorie-Vokabular anpassen"

### Regression Testing
- `npm test`: 184/184 grün · `npm run lint` + `npm run build`: fehlerfrei
- E2E Chromium (`tests/PROJ-4-contacts-list.spec.ts`, `--workers=1`): **15/15 grün** nach BUG-12/13-Fixes
- E2E PROJ-3 (`tests/PROJ-3-contacts.spec.ts`): blockiert durch BUG-14 (vorbestehend, nicht Teil dieses Refines, siehe oben)

### Summary
- **Acceptance Criteria (Delta):** 5/5 passed
- **Bugs Found:** 3 total (0 critical, 2 high — beide Test-Infra, 2 gefixt; 1 medium — gefixt; BUG-14 als Out-of-Scope-Ticket empfohlen)
- **Security:** Pass
- **Production Ready:** YES
- **Recommendation:** Deploy. BUG-14 (PROJ-3-Suite) separat nachziehen — betrifft nicht dieses Feature.

## Deployment
- Production URL: https://bambi-w26q.vercel.app
- Deployed: 2026-06-19
- Deployment ID: dpl_4HkaZqCBrTpLYwsFcBWh3e7kFqgH
- Pre-deploy checks: `npm run build` ✓, `npm run lint` ✓
- Pushed commit `3c7de27` (4 commits) to origin/main, Vercel auto-deployed to production

### Erweiterung 2026-06-22 (Stadt-Filter)
- Deployment ID: dpl_9HkgdUd9rjSBsFWnG15LMWxsV9Mf
- Pushed commit `8934024` zu origin/main, manuelles `vercel --prod` (kein Auto-Deploy via GitHub-Integration aktiv)
- Verification: `/` → 307 zu `/login`, `/login` → 200, `npm run build` + `npm run lint` lokal grün

### Erweiterung 2026-07-02 (Firmen-/Titel-Suche)
- Commit `2d51ae1` gepusht zu `origin/main`, Vercel-Build erfolgreich (51s), Deployment `Ready`, Production
- `https://bambi-w26q.vercel.app/login` → 200 verifiziert
- Keine neuen Env-Vars, keine Migration (bestehende `employer`/`job_title`-Spalten aus PROJ-3)

# PROJ-15: Profil (Umbenennung Projekte → Profil + Karriere-Stats-Header)

## Status: Approved
**Created:** 2026-06-30
**Last Updated:** 2026-06-30

## Dependencies
- PROJ-12 (Projekte/Cases) — die umzubenennende Funktionalität
- PROJ-3 (Kontakt anlegen & verwalten) — Datenquelle für "Kontakte gesamt"
- PROJ-6 (Follow-up Dashboard) — `next_followup_at`-Semantik für "Fällige Follow-ups"

## User Stories
- Als MBB-Berater möchte ich meine Cases unter einem "Profil"-Nav-Punkt statt unter "Projekte" finden, damit die App meine Case-Historie als Teil meiner persönlichen Karriere abbildet, nicht nur als Engagement-Tracking
- Als Berater möchte ich auf einen Blick sehen, wie groß mein Netzwerk und wie viele Follow-ups gerade fällig sind, wenn ich mein Profil öffne, damit ich sofort ein Gefühl für den Stand meines Netzwerks bekomme
- Als Berater möchte ich sehen, wie viele einzigartige Personen ich über alle meine Cases hinweg kennengelernt habe, damit der Wert meines beruflichen Netzwerks sichtbar wird

## Out of Scope
- Redirect von alten `/projects`-URLs — Solo-User, Pre-Launch, kein externer Backlink-Bedarf (bewusst weggelassen, siehe Decision Log)
- Visuelles Redesign der Case-Liste zu einer echten chronologischen Timeline — bestehendes Karten-Grid mit Aktiv/Beendet-Tabs bleibt unverändert
- Umbenennung der zugrundeliegenden Komponenten-/Lib-Dateien (`project-list.tsx`, `project-card.tsx`, `project-detail.tsx`, `src/lib/projects.ts`) — beschreiben weiterhin die Datenentität, nicht das Nav-Label
- Neue Stats über die genannten 3 hinaus (z. B. "Aktive Cases"-Zähler) — bewusst auf 3 Kennzahlen begrenzt, siehe Decision Log
- Account-/Settings-Funktionalität (Name ändern, Präferenzen, AI-Report-Einstellungen) — kein Account-Profil, reines Karriere-Profil; eigenes Feature falls später gewünscht
- Neue Tabellen, neue RLS-Policies, neue CRUD-Endpunkte — reine Umbenennung + lesende Aggregations-Queries auf bestehende Tabellen

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

- [ ] Angenommen der Nutzer ist eingeloggt, wenn er die Navigation betrachtet, dann zeigt der Nav-Punkt "Profil" statt "Projekte" und verlinkt auf `/profil`
- [ ] Angenommen der Nutzer öffnet `/profil`, dann wird die bestehende Case-Liste (Aktiv/Beendet-Tabs, Karten-Grid, "Projekt anlegen") wie bisher unter PROJ-12 angezeigt
- [ ] Angenommen der Nutzer öffnet eine Projekt-Detailseite über die Karte, dann lautet die URL `/profil/[id]` und zeigt Beteiligte + Projekt-Log wie bisher unter PROJ-12
- [ ] Angenommen ein Projekt wird gelöscht, dann navigiert der Nutzer zurück zu `/profil` (nicht `/projects`)
- [ ] Angenommen der Nutzer hat N Kontakte, wenn er `/profil` öffnet, dann zeigt die Stat "Kontakte gesamt" die Zahl N
- [ ] Angenommen der Nutzer hat 0 Kontakte, wenn er `/profil` öffnet, dann zeigt "Kontakte gesamt" `0` ohne Fehler
- [ ] Angenommen ein Kontakt hat `next_followup_at` heute oder in der Vergangenheit, wenn der Nutzer `/profil` öffnet, dann wird dieser Kontakt in "Fällige Follow-ups" mitgezählt
- [ ] Angenommen ein Kontakt hat `next_followup_at` in der Zukunft oder `null`, wenn der Nutzer `/profil` öffnet, dann wird dieser Kontakt NICHT in "Fällige Follow-ups" mitgezählt
- [ ] Angenommen derselbe Kontakt ist Beteiligter in mehreren Projekten des Nutzers, wenn der Nutzer `/profil` öffnet, dann wird dieser Kontakt in "Beteiligte gesamt über alle Cases" nur einmal gezählt
- [ ] Angenommen der Nutzer hat keine Projekte oder keine Beteiligten, wenn er `/profil` öffnet, dann zeigt "Beteiligte gesamt über alle Cases" `0` ohne Fehler
- [ ] Angenommen die Stats-Queries laufen noch, wenn der Nutzer `/profil` öffnet, dann zeigen die Stat-Kacheln einen neutralen Platzhalter statt fälschlich `0`
- [ ] Angenommen Nutzer A ist eingeloggt, wenn die Stats berechnet werden, dann fließen ausschließlich Daten von Nutzer A ein (RLS-geschützt, kein Cross-User-Leak)

## Edge Cases
- Stats-Header-Queries scheitern (Netzwerkfehler) → Stats-Kacheln zeigen Fehler-/Platzhalter-Zustand, blockieren aber nicht das Laden der Case-Liste darunter (unabhängiges Laden)
- Case-Liste lädt langsam/scheitert → Stats-Header lädt unabhängig weiter, keine gegenseitige Blockade
- Kontakt mit `next_followup_at` exakt heute (Datum ohne Uhrzeit-Komponente) → zählt als fällig
- Sehr großes Netzwerk (z. B. 500+ Kontakte/Beteiligte) → Stats nutzen `count`-Queries bzw. client-seitiges Dedupe einer schlanken Spalten-Selektion, keine Performance-Sorge für Solo-User-Datenmengen
- Alte `/projects`-URL wird aufgerufen (z. B. Browser-Verlauf) → führt zu 404 (Next.js Standardverhalten), kein Redirect, bewusst akzeptiert

## Technical Requirements (optional)
- Security: Alle 3 Stats-Queries laufen über bestehende RLS-Policies (`auth.uid() = user_id`) auf `contacts` und `project_participants` — keine neuen Policies nötig
- Keine neuen Datenbank-Tabellen, keine Migration

## Open Questions
_Keine offenen Fragen — vollständig im Rahmen einer vorgelagerten Plan-Phase mit dem Nutzer abgestimmt (siehe Decision Log)._

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Nav-Punkt "Projekte" wird zu "Profil", Case-Liste wandert komplett darunter (kein zusätzlicher separater Nav-Punkt) | PRD framt das Netzwerk/die Case-Historie explizit als "Karriere- und Exit-Kapital" — ein Profil-Konzept passt besser zur Zielgruppe (MBB-Berater) als ein reines "Projekte"-Engagement-Tracking | 2026-06-30 |
| Bestehendes Karten-Grid mit Aktiv/Beendet-Tabs bleibt unverändert, kein Timeline-Redesign | Geringeres Risiko, bestehende getestete Komponenten (PROJ-12) bleiben unangetastet; visuelles Storytelling ist nicht der Kern dieses Features | 2026-06-30 |
| Genau 3 Stats: Kontakte gesamt, Fällige Follow-ups, Beteiligte gesamt über alle Cases ("Aktive Cases"-Zähler bewusst weggelassen) | Nutzer hat im Rahmen der Konzept-Abstimmung explizit diese 3 gewählt; Aktive-Cases-Zahl ist über die Tabs ohnehin sichtbar, redundant als zusätzliche Stat | 2026-06-30 |
| Kein Redirect von `/projects` auf `/profil` | Solo-User, Pre-Launch-App ohne externe Backlinks/Bookmarks — Redirect wäre unnötiger Aufwand für aktuell null echte Nutzer-Auswirkung | 2026-06-30 |
| Komponenten-/Lib-Dateinamen (`project-*.tsx`, `src/lib/projects.ts`) bleiben unverändert | Beschreiben die Datenentität ("Projekt"/Case in der DB), nicht das Nav-Label; Umbenennung wäre reiner Diff-Lärm ohne funktionalen Nutzen | 2026-06-30 |
| Priorität P1 (MBB), nicht P0 | Erweitert ein bereits deploytes P0-Feature (PROJ-12) um UX-Framing + Stats, schließt keine MVP-Lücke | 2026-06-30 |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|----------|-----------|------|
| Routing-Verzeichnisse umbenennen statt Route-Alias/Rewrite | Next.js App-Router-Konvention; ein echter Verzeichnis-Move hält URL, Nav-Label und Code-Struktur konsistent statt einer zusätzlichen Rewrite-Regel | 2026-06-30 |
| Neue eigenständige Komponente `profile-stats-header.tsx` statt Logik in `project-list.tsx` zu integrieren | Trennt Datenquelle (Kontakte/Beteiligte) von der bestehenden Case-Liste (Projekte/Beteiligte-Join); hält `project-list.tsx` fokussiert auf eine Aufgabe, einfacher unabhängig zu laden/testen | 2026-06-30 |
| 3 unabhängige Supabase-Queries (count/select) statt einer kombinierten View/RPC | Kleine, Owner-skalierte Datenmengen (Solo-User); passt zum bestehenden Muster der App (keine eigenen API-Routes, direkte Supabase-Client-Calls überall, z. B. `project-list.tsx`, `project-detail.tsx`) | 2026-06-30 |
| Client-seitiges Dedupe für "Beteiligte gesamt" (Set über `contact_id`) statt SQL `COUNT(DISTINCT ...)` via View/RPC | Keine neue DB-Funktion nötig für eine Solo-User-Datenmenge im niedrigen Hundert-Bereich; konsistent mit "keine neuen Packages/keine Backend-Änderung" | 2026-06-30 |
| Keine Wiederverwendung von `computeOccasionSections` (aus `src/lib/occasions.ts`) für "Fällige Follow-ups" | Diese Funktion vermischt Geburtstage und Follow-ups in einem "Heute"-Bucket — würde die Stat verfälschen; stattdessen eigener, einfacher datums-only Filter auf `next_followup_at` | 2026-06-30 |
| Kein Backend-Schritt (`/backend`) nötig | Reine lesende Queries auf bestehende, bereits RLS-geschützte Tabellen (`contacts`, `project_participants`); keine neuen Tabellen, Policies oder Migrationen | 2026-06-30 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### A) Komponenten-Struktur

```
(app)-Layout (Nav)
+-- Nav-Punkt "Profil" (vorher "Projekte") → /profil

/profil (umbenannte Route, vorher /projects)
+-- ProfileStatsHeader (NEU)
|   +-- Stat-Kachel "Kontakte gesamt"
|   +-- Stat-Kachel "Fällige Follow-ups"
|   +-- Stat-Kachel "Beteiligte gesamt über alle Cases"
+-- Tabs: Aktiv | Beendet (unverändert aus PROJ-12)
|   +-- Projekt-Karten-Liste (unverändert aus PROJ-12)
+-- Empty State (unverändert)
+-- Projekt-Anlegen-Dialog (unverändert)

/profil/[id] (umbenannte Route, vorher /projects/[id])
+-- Unverändert aus PROJ-12: Header, Beteiligte-Sektion, Projekt-Log-Sektion, Lösch-Dialoge
```

### B) Datenmodell (Klartext)

Keine neuen Daten-Entitäten. Die 3 Stats sind reine Aggregationen bestehender Daten:
- **Kontakte gesamt:** Anzahl aller Kontakte des Nutzers
- **Fällige Follow-ups:** Anzahl Kontakte, deren nächstes Follow-up-Datum heute oder in der Vergangenheit liegt
- **Beteiligte gesamt über alle Cases:** Anzahl einzigartiger Kontakte, die irgendwann als Beteiligter einem Projekt des Nutzers zugeordnet wurden (Duplikate über mehrere Projekte hinweg zählen nur einmal)

Storage: unverändert Supabase Postgres, bestehende RLS-Policies auf `contacts` und `project_participants` (kein neues Schema).

### C) Tech-Entscheidungen (warum)

- **Verzeichnis-Umbenennung statt Rewrite/Alias** — sauberste Next.js-App-Router-Lösung, URL und Code-Struktur bleiben deckungsgleich.
- **Eigene Stats-Komponente statt Erweiterung der bestehenden Liste** — klare Verantwortungstrennung, unabhängiges Laden (ein langsamer Stats-Request blockiert nicht die Case-Liste und umgekehrt).
- **Direkte Supabase-Queries statt Backend-Route** — konsistent mit dem bestehenden Muster der App (kein `/api/contacts`-Äquivalent existiert, alle CRUD-/Aggregations-Zugriffe laufen direkt über den Supabase-Client + RLS).
- **Kein Redirect von alten URLs** — bewusste Produktentscheidung aus der Spec (Solo-User, Pre-Launch), technisch nicht erforderlich.

### D) Dependencies
Keine neuen Packages — alle benötigten UI-Bausteine (Card, Tabs, etc.) sind bereits installiert und im Projekt genutzt.

## Frontend Implementation Notes
<!-- Added by /frontend -->
- Routen umbenannt via `git mv`: `src/app/(app)/projects` → `src/app/(app)/profil` (Inhalt von `page.tsx`/`[id]/page.tsx` unverändert)
- `src/app/(app)/layout.tsx`: Nav-Eintrag `{ href: '/projects', label: 'Projekte' }` → `{ href: '/profil', label: 'Profil' }`
- `src/components/project-card.tsx`: Link-Ziel `/projects/${project.id}` → `/profil/${project.id}`
- `src/components/project-detail.tsx`: `confirmDelete()` navigiert jetzt zu `/profil` statt `/projects`
- Neue Datei `src/components/profile-stats-header.tsx`: 3 parallele Supabase-Queries (`Promise.all`) für Kontakte gesamt (`count: 'exact', head: true`), fällige Follow-ups (`next_followup_at <= heute`, datums-only), Beteiligte gesamt (Client-Dedupe via `Set` über `contact_id` aus `project_participants`). Zeigt `–` pro Kachel während die jeweilige Query lädt, kein irreführendes `0`
- `src/components/project-list.tsx`: `<ProfileStatsHeader />` oberhalb der Tabs eingebunden
- Komponenten-/Lib-Dateinamen unverändert (`project-list.tsx`, `project-card.tsx`, `project-detail.tsx`, `src/lib/projects.ts`) — wie in der Spec entschieden
- `tests/PROJ-12-projekte-cases.spec.ts`: alle Routen-Strings `/projects` → `/profil` aktualisiert (REST-API-Pfade `${SUPABASE_URL}/rest/v1/projects` bewusst unverändert gelassen — Tabellenname, kein UI-Pfad)
- `npm run build` + `npm run lint` fehlerfrei; `/profil` und `/profil/[id]` erscheinen korrekt in der Build-Routen-Tabelle
- Kein Backend-Schritt nötig — reine Lese-Queries auf bestehende RLS-geschützte Tabellen (`contacts`, `project_participants`)

## QA Test Results

**Tested:** 2026-06-30
**App URL:** http://localhost:3000 (npm run dev)
**Tester:** QA Engineer (AI)

### Acceptance Criteria Status

1. Nav-Punkt "Profil" statt "Projekte", verlinkt auf `/profil` — PASS
2. `/profil` zeigt bestehende Case-Liste (Tabs, Karten-Grid, "Projekt anlegen") wie bisher unter PROJ-12 — PASS
3. Projekt-Detailseite erreichbar unter `/profil/[id]`, zeigt Beteiligte + Projekt-Log — PASS
4. Projekt-Löschung navigiert zurück zu `/profil` (nicht `/projects`) — PASS (Teil der PROJ-12-Regressionssuite, jetzt auf neuer Route)
5. "Kontakte gesamt" zeigt korrekte Gesamtzahl N — PASS
6. "Kontakte gesamt" zeigt `0` bei keinen Kontakten, kein Fehler — PASS (Zero-State-Test)
7. Kontakt mit `next_followup_at` heute/Vergangenheit wird in "Fällige Follow-ups" mitgezählt — PASS
8. Kontakt mit `next_followup_at` Zukunft/`null` wird NICHT mitgezählt — PASS
9. Derselbe Kontakt als Beteiligter in mehreren Projekten zählt in "Beteiligte gesamt" nur einmal — PASS (Dedupe-Test)
10. "Beteiligte gesamt über alle Cases" zeigt `0` bei keinen Projekten/Beteiligten — PASS (Zero-State-Test)
11. Stats-Kacheln zeigen Platzhalter (`–`) statt `0` während des Ladens — PASS (Code-Review: `value === null ? '–' : value`, Ladezustand vor Resolve der `Promise.all` sichtbar)
12. Stats sind RLS-geschützt, keine Cross-User-Daten — PASS (anon-Rolle ohne gültigen User-Token sieht 0 Zeilen, eigener Stat zeigt korrekt 1)

### Edge Cases Status
- Stats laden unabhängig von der Case-Liste (kein gegenseitiges Blockieren) — PASS (Code-Review: `ProfileStatsHeader` hat eigenen `useEffect`/State, kein Coupling zu `loadProjects()`)
- Sehr großes Netzwerk (Performance) — nicht separat lasttestbar im Rahmen dieser QA-Runde, aber Queries nutzen `count: 'exact', head: true` (kein Row-Transfer) bzw. schlanke Single-Column-Selects — für Solo-User-Datenmengen unkritisch
- Alte `/projects`-URL nach Rename — führt zu Next.js-404 (kein Redirect, wie in Spec entschieden) — PASS (verifiziert: Route existiert nicht mehr im Build-Output)

### Security Audit Results
- [x] Authorization (RLS): Stats-Queries laufen über bestehende Owner-only-Policies auf `contacts`/`project_participants`, kein neuer Policy-Bedarf, anon-Rolle sieht 0 Zeilen
- [x] Keine neuen Eingabefelder/Formulare in diesem Feature → kein neuer XSS-/Injection-Vektor (Stats sind reine Zahlen, kein dynamisches HTML)
- [x] Keine neuen Secrets/Env-Variablen eingeführt

### Regression Testing
- `tests/PROJ-12-projekte-cases.spec.ts` (15 Tests, jetzt auf `/profil`-Routen) — alle PASS
- Volle Suite seriell (`npx playwright test --project=chromium --workers=1`, 137 Tests über alle PROJ-2–PROJ-15-Specs) — 136 PASS, 1 vereinzelter Flake (PROJ-8, Login-Timeout), isoliert erneut grün — kein durch PROJ-15 verursachter Regressionsfehler
- `npm test` (Vitest) — 107/107 PASS (keine neuen Unit-Tests nötig, `profile-stats-header.tsx` ist reine Präsentations-/Datenladekomponente ohne extrahierte Pure-Logic)

### Automated Tests
- E2E (Playwright): `tests/PROJ-15-profil.spec.ts` — 9 Tests, alle grün auf Chromium und Mobile Safari (375px)
- `npm run build` + `npm run lint` fehlerfrei; `/profil` + `/profil/[id]` korrekt in Build-Routen-Tabelle, `/projects` nicht mehr vorhanden

### Summary
- **Acceptance Criteria:** 12/12 passed
- **Bugs Found:** 0
- **Security:** RLS-Schutz hält, kein neuer Angriffsvektor
- **Production Ready:** YES
- **Recommendation:** Deploy.

## Deployment

- **Production URL:** https://bambi-w26q.vercel.app
- **Deployed:** 2026-06-30
- Pushed `main` (53a38a8..14a23e3) → Vercel auto-deploy, build `dpl_EtjoAYkCtty2NBkXnvcJCSVmy1xE`, Status Ready
- Keine DB-Migration nötig (reine Lese-Queries auf bestehenden Tabellen)
- Smoke-Test: `/profil` → 307 zu `/login` (Middleware-Redirect, erwartet ohne Session). `/projects` → ebenfalls 307 zu `/login`, NICHT weil die alte Route noch existiert, sondern weil die Middleware jeden nicht-eingeloggten Request auf `/login` umleitet, bevor Next.js Routing prüft, ob der Pfad existiert (verifiziert: ein frei erfundener Pfad `/totally-fake-route-xyz` zeigt identisches Verhalten). Kein Redirect-Bug, wie in der Spec entschieden.

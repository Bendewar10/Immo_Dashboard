# PROJ-2: Auth (Login)

## Status: Deployed
**Created:** 2026-06-19
**Last Updated:** 2026-06-19 (QA abgeschlossen, alle Kern-ACs live verifiziert)

## Implementation Notes
- `src/components/login-form.tsx`: Client-Komponente, react-hook-form + Zod-Validierung (Email-Format, Pflichtfelder), ruft `supabase.auth.signInWithPassword` direkt auf, zeigt Fehler via shadcn `Alert`, Loading-State deaktiviert Button während Request
- `src/app/login/page.tsx`: rendert `LoginForm` in zentrierter `Card`
- `src/app/page.tsx`: ersetzt Next.js-Default-Startseite — zeigt `Eingeloggt als {email}` (per `supabase.auth.getUser()`) + Logout-Button (`supabase.auth.signOut()`, redirect zu `/login`)
- `middleware.ts`: Session-Check via `@supabase/ssr` (`createServerClient`), redirect zu `/login` wenn keine Session auf geschützter Route, redirect zu `/` wenn Session vorhanden auf `/login`. Matcher schließt `_next/static`, `_next/image`, Bild-Assets aus
- `src/lib/supabase.ts`: Browser-Client von `createClient` (@supabase/supabase-js) auf `createBrowserClient` (@supabase/ssr) umgestellt — Session landet in Cookies statt localStorage, sonst kann Middleware sie nicht lesen
- Kein neues DB-Schema/API-Route nötig — Auth läuft komplett über Supabase Auth + Middleware
- Live-Login-Flow noch nicht getestet — Supabase Email-Rate-Limit beim Versuch, Test-Account per Signup-Endpoint anzulegen, getroffen. Build + Lint + Unit-Tests laufen grün, manuelle Browser-Verifikation steht noch aus

## Dependencies
- PROJ-1 (Supabase Infrastructure Setup) — benötigt Supabase-Client + Projekt für `auth.users`

## User Stories
- Als Nutzer möchte ich mich mit Email/Passwort einloggen, damit ich auf meine Kontakte und Interaktionen zugreifen kann
- Als Nutzer möchte ich mich ausloggen können, damit meine Session auf einem geteilten Gerät nicht offen bleibt
- Als nicht-eingeloggter Nutzer möchte ich beim Versuch, eine geschützte Seite aufzurufen, automatisch zum Login weitergeleitet werden, damit ich nicht versehentlich auf leere/fehlerhafte Inhalte stoße
- Als Nutzer möchte ich bei falschen Login-Daten eine klare Fehlermeldung sehen, damit ich weiß, dass ich mich vertippt habe (statt eines stillen Fehlschlags)

## Out of Scope
- Öffentliches Signup-Formular — Account wird einmalig manuell über Supabase Dashboard/CLI angelegt, da Solo-Projekt (laut PRD: "der Nutzer selbst" als einziger Target User)
- Passwort-Reset / "Passwort vergessen" — bei Bedarf direkt im Supabase-Dashboard zurückgesetzt, kein Self-Service-Email-Flow für MVP
- Social Login (Google/GitHub etc.) — nicht angefragt, Email/Passwort reicht für Solo-Nutzung
- Eigene Header/Nav-Komponente — Logout-Button liegt vorerst auf der Platzhalter-Startseite, zieht erst mit PROJ-4/PROJ-6 in ein echtes Layout um
- Mehrfaktor-Authentifizierung (2FA) — kein Bedarf bei 1 Account, kann später nachgerüstet werden
- Echter Dashboard-Inhalt nach Login — Platzhalter-Startseite bis PROJ-4 (Kontaktliste) / PROJ-6 (Follow-up Dashboard) existieren

## Acceptance Criteria

- [ ] Angenommen ein Account existiert in Supabase Auth, wenn der Nutzer korrekte Email/Passwort eingibt und auf "Login" klickt, dann wird er eingeloggt und zur Platzhalter-Startseite (`/`) weitergeleitet
- [ ] Angenommen der Nutzer gibt falsche Email/Passwort-Kombination ein, wenn er "Login" klickt, dann erscheint eine klare Fehlermeldung ("Email oder Passwort falsch") ohne dass die Eingabefelder geleert werden
- [ ] Angenommen der Nutzer lässt ein Pflichtfeld (Email oder Passwort) leer, wenn er "Login" klickt, dann wird eine Validierungsfehlermeldung pro leerem Feld angezeigt, kein Request an Supabase wird gesendet
- [ ] Angenommen der Nutzer ist nicht eingeloggt, wenn er eine geschützte Route direkt per URL aufruft, dann wird er automatisch zu `/login` weitergeleitet
- [ ] Angenommen der Nutzer ist eingeloggt, wenn er `/login` direkt aufruft, dann wird er automatisch zur Startseite (`/`) weitergeleitet statt das Login-Formular erneut zu sehen
- [ ] Angenommen der Nutzer ist eingeloggt, wenn er auf "Logout" klickt, dann wird seine Session beendet und er landet auf `/login`
- [ ] Angenommen die Supabase-API ist während des Login-Versuchs nicht erreichbar (Netzwerkfehler/Timeout), wenn der Nutzer "Login" klickt, dann erscheint eine Fehlermeldung und die eingegebenen Werte bleiben im Formular erhalten

## Edge Cases
- Doppelter Klick auf "Login" während Request läuft → Button muss disabled sein (Loading-State), kein doppelter Request
- Session läuft während aktiver Nutzung ab (Token-Expiry) → Supabase-Client refresht automatisch im Hintergrund; falls Refresh fehlschlägt, nächster geschützter Request/Redirect wirft Nutzer zu `/login`
- Nutzer löscht Cookies/localStorage manuell während Session aktiv → wird beim nächsten Seitenaufruf als nicht eingeloggt behandelt, Redirect zu `/login`
- Brute-Force-Versuche auf Login → abgefangen durch Supabases eingebautes Rate-Limiting auf Auth-Endpunkten, keine zusätzliche App-seitige Logik nötig
- Whitespace in Email-Eingabe (z.B. versehentliches Leerzeichen am Ende) → vor Request trimmen

## Technical Requirements
- Security: Route-Schutz via Next.js Middleware (`middleware.ts`), prüft Supabase-Session bei jedem Request auf geschützten Pfaden
- Security: Keine Klartext-Passwörter im Client-State länger als nötig halten, kein Logging von Passwort-Feldern
- Auth Best Practice: `window.location.href` für Post-Login-Redirect verwenden (nicht `router.push`), `data.session` vor Redirect verifizieren, Loading-State in allen Pfaden (Erfolg/Fehler/Finally) zurücksetzen

## Open Questions
_Keine offenen Fragen — siehe Decision Log._

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Kein öffentliches Signup-Formular | Solo-Projekt, PRD nennt nur "der Nutzer selbst" als Target User — Account einmalig manuell anlegen reicht, kleinere Angriffsfläche als offene Registrierung | 2026-06-19 |
| Kein Passwort-Reset-Flow | Nur 1 Account, Dashboard-Reset bei Bedarf ausreichend, spart Email-Template-Setup für MVP | 2026-06-19 |
| Redirect-Ziel nach Login: Platzhalter-Startseite (`/`) statt eigene `/dashboard`-Route | Vermeidet Leerlauf-Route ins Nichts, da echter Dashboard-Inhalt erst PROJ-4/PROJ-6 liefert | 2026-06-19 |
| Logout-Button auf Platzhalter-Startseite statt eigene Nav-Komponente | Vermeidet doppelte Arbeit — echtes Layout kommt mit PROJ-4/PROJ-6 | 2026-06-19 |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|----------|-----------|------|
| Route-Schutz via Next.js Middleware statt Client-seitigem Check pro Seite | Zentrale Durchsetzung, greift auch bei direktem URL-Aufruf, kein Content-Flash vor Redirect, Standard-Pattern für Supabase+Next.js | 2026-06-19 |
| `@supabase/ssr` zusätzlich zu `@supabase/supabase-js` installieren | Middleware läuft server-seitig und braucht Cookie-basierten Session-Zugriff — der Browser-Client aus PROJ-1 ist dafür ungeeignet; offizielles Supabase-Pattern | 2026-06-19 |
| Kein NextAuth/eigenes Session-Management | Supabase Auth deckt Login/Session/Refresh vollständig ab, zweites Auth-System wäre redundant und erhöht Angriffsfläche | 2026-06-19 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Component Structure

```
/login (öffentliche Route)
└── Login Form
    ├── Email-Feld
    ├── Passwort-Feld
    ├── Login-Button (disabled während Request läuft)
    └── Fehlermeldung-Bereich (falsche Daten / Netzwerkfehler / Validierung)

/ (geschützte Platzhalter-Startseite)
├── "Eingeloggt als {email}"
└── Logout-Button

Middleware (kein UI, läuft vor jedem Request)
└── Prüft Session → leitet weiter zu /login (falls keine Session auf geschützter Route)
                   → leitet weiter zu / (falls Session vorhanden auf /login)
```

### Data Model (plain language)

Keine neue Tabelle nötig. Supabase Auth verwaltet Nutzer-Accounts intern (`auth.users`) — diese Tabelle existiert bereits implizit seit PROJ-1, da `contacts`/`interactions` schon darauf verweisen (`user_id references auth.users(id)`). PROJ-2 erstellt keine neuen Daten, sondern nutzt nur den bestehenden Auth-Mechanismus.

Account selbst wird einmalig manuell über Supabase Dashboard angelegt (siehe Out of Scope) — kein Bestandteil dieses Features.

### Tech Decisions (justified)

- **Supabase Auth (Email/Passwort) statt eigenem Auth-System:** Bereits Teil von `@supabase/supabase-js` (seit PROJ-1 installiert), kein zusätzlicher Service nötig, eingebautes Rate-Limiting gegen Brute-Force.
- **Next.js Middleware für Route-Schutz:** Einziger Ort, der für *jede* geschützte Seite greift — auch bei direktem URL-Aufruf, kein Risiko dass eine neue Seite den Check vergisst. Lief out-of-the-box mit Server-seitigem Session-Zugriff (kein Client-Flash von geschütztem Inhalt vor Redirect).
- **Separate Supabase-Client-Helper für Middleware:** Middleware läuft auf dem Server und braucht Zugriff auf Cookies, um die Session zu lesen — der bestehende Browser-Client aus PROJ-1 (`src/lib/supabase.ts`) ist dafür nicht geeignet. Offizielles Supabase-Pattern für Next.js Middleware/SSR-Kontexte.
- **Kein Server-Auth-State-Management-Tool (z.B. NextAuth):** Supabase Auth deckt Login/Session/Refresh bereits vollständig ab, ein zweites Auth-System wäre redundant.

### Dependencies (Packages)
- `@supabase/ssr` — offizielles Supabase-Paket für Session-Handling in Next.js Middleware/Server-Kontexten (Cookie-basiert), ergänzt den bereits vorhandenen `@supabase/supabase-js` Browser-Client

## QA Test Results

**Date:** 2026-06-19
**Tested by:** /qa

### Acceptance Criteria
| # | Criterion | Result |
|---|---|---|
| 1 | Korrekte Daten → Login + Redirect zu `/` | ✅ Pass (live gegen echten Account getestet) |
| 2 | Falsche Daten → klare Fehlermeldung, Felder bleiben erhalten | ✅ Pass (E2E) |
| 3 | Leeres Pflichtfeld → Validierungsfehler pro Feld, kein Request | ✅ Pass (E2E) |
| 4 | Nicht eingeloggt + geschützte Route → Redirect zu `/login` | ✅ Pass (E2E) — **nach Bugfix, siehe unten** |
| 5 | Eingeloggt + `/login` aufrufen → Redirect zu `/` | ✅ Pass (live gegen echten Account getestet) |
| 6 | Logout → Session beendet, Redirect zu `/login` | ✅ Pass (live gegen echten Account getestet) |
| 7 | Netzwerkfehler beim Login → Fehlermeldung, Eingabe bleibt erhalten | ✅ Pass (E2E, nach Bugfix, siehe unten) |

### Automated Tests
- `npm test` → 1 file, 2/2 passed (PROJ-1 Supabase-Client-Tests, Regression ok)
- `npm run test:e2e` → 6/6 passed (3 ACs × 2 Browser-Profile: Chromium + Mobile Safari)
- Playwright Browser-Binaries waren bereits installiert
- Live-Test AC1/5/6 gegen echten Account (manuell via Dashboard angelegt, Passwort danach auf Test-Passwort geändert) — temporäres Test-Spec (nicht ins Repo übernommen, lief nur lokal mit Credentials per Env-Var, keine Secrets in Git/Shell-History persistiert) → 3/3 passed bei serieller Ausführung. Bei paralleler Ausführung (3 Workers, gleicher Account) ein Flake bei AC6 durch Supabase Refresh-Token-Rotation (gleichzeitige Logins eines Accounts invalidieren sich gegenseitig) — kein Produktbug, reines Testinfra-Artefakt bei Mehrfach-Login desselben Accounts

### Bugs Found

**🔴 Critical (gefunden + sofort gefixt):** Middleware lag unter `middleware.ts` im Projekt-Root statt `src/middleware.ts`. Next.js erkennt die Datei bei `src/`-Struktur nur dort — Route-Schutz war dadurch komplett wirkungslos, jede Seite (inkl. `/`) war ungeschützt aufrufbar ohne Login. Fix: Datei nach `src/middleware.ts` verschoben, danach verifiziert: `/` ohne Session → 307 zu `/login`.

**🟡 Low (Config-Bug, gefixt):** Vitest las versehentlich den `tests/`-Ordner (Playwright-E2E-Specs) mit ein → Testlauf schlug mit Config-Fehler fehl, keine echte Funktionsregression. Fix: `exclude: ['tests/**']` in `vitest.config.ts` ergänzt.

**🟠 Medium (gefunden + sofort gefixt):** `@supabase/supabase-js` gibt bei echten Netzwerkfehlern (Fetch schlägt fehl) ein `AuthRetryableFetchError`-Objekt im `error`-Feld zurück statt eine Exception zu werfen — der ursprüngliche `try/catch`-Block in `login-form.tsx` griff dadurch nie, jeder Netzwerkfehler zeigte fälschlich "Email oder Passwort falsch" statt einer Netzwerk-Fehlermeldung. Verifiziert via Playwright-Route-Abort-Test. Fix: `isAuthRetryableFetchError(error)`-Check vor dem generischen Fehlerfall ergänzt. E2E-Test `tests/PROJ-2-auth-login-network.spec.ts` deckt das jetzt ab.

**Keine offenen Bugs.**

### Security Audit (Red Team)
- **Middleware-Bypass-Versuche:** Trailing Slash, Case-Variante (`/Login`), Query-String, URL-Encoding, gefälschtes Session-Cookie → alle korrekt zu `/login` redirected, keine Lücke gefunden
- **Gefälschtes/ungültiges Session-Cookie:** `getUser()` validiert serverseitig gegen Supabase, ungültiger Token wird als "nicht eingeloggt" behandelt — kein Client-seitiges Vertrauen in Cookie-Inhalt
- **Redirect-Loop-Check:** Kein Loop zwischen `/` und `/login` möglich (unterschiedliche Bedingungen pro Pfad)
- **Statische Assets:** `_next/static`, Bild-Dateien, `favicon.ico` korrekt vom Matcher ausgeschlossen (kein Redirect-Overhead)

### Open Items (nicht blockierend)
- Next.js 16 deprecated `middleware.ts` zugunsten `proxy.ts` (nur Warning, noch funktional) — Rename von Auto-Mode-Classifier als riskant geblockt (berührt Auth-Schutzmechanismus), Entscheidung liegt beim User

### Production-Ready: **YES**

## Deployment

**Date:** 2026-06-19
**Production URL:** https://bambi-w26q.vercel.app
**Vercel Project:** bambi-w26q
**Verification:** `/` → 307 zu `/login` (Middleware live + funktioniert), `/login` → 200. Keine neuen Env-Vars nötig (gleicher Supabase-Projekt wie PROJ-1)

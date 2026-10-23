# PROJ-9: Monatlicher AI-Report per Mail

## Status: Deployed
**Created:** 2026-06-23
**Last Updated:** 2026-06-23 (Backend implementiert)

## Backend Implementation Notes
- `src/lib/report-data.ts`: reine Funktionen — `isLastSundayOfMonth(now)` (Sonntag + in 7 Tagen anderer Monat), `previousMonthStartDate(now)`, `buildReportMetrics(contacts, interactions, now)` (Monats-/Vormonats-Counts, Δ, `showDelta`, `isQuietMonth`, überfällige Kernkontakte; reused `analytics.ts`-Aggregationen)
- `src/lib/supabase-admin.ts`: Service-Role-Client (`SUPABASE_SERVICE_ROLE_KEY`), nur serverseitig im Job, umgeht RLS bewusst
- `src/lib/report-ai.ts`: `generateReportSections(metrics)` via `generateObject` + Zod-Schema (4 Abschnitte), Modell `anthropic('claude-haiku-4-5-20251001')`, Prompt im Berater-Ton, strikt an echten Zahlen, ruhiger-Monat-Hinweis, kein Markdown
- `src/lib/report-pdf.tsx`: `renderReportPdf(metrics, sections)` via `@react-pdf/renderer` (`renderToBuffer`), typografisches A4-Layout, Kennzahlen-Block + 4 Abschnitte, keine Charts
- `src/lib/report-mailer.ts`: `sendReportMail(...)` via `nodemailer` Gmail-SMTP (`GMAIL_USER`/`GMAIL_APP_PASSWORD`), Body = Gruß + Exec Summary inline, PDF als Anhang
- `src/app/api/cron/monthly-report/route.ts`: GET-Handler — prüft `Bearer ${CRON_SECRET}` (sonst 401), `?force=1` für Test-Trigger, sonst nur am letzten Sonntag; Service-Role lädt Kontakte + Interactions (ab Vormonatsbeginn) pro Nutzer; 0-Kontakte-Nutzer werden übersprungen; AI → PDF → Mail; per-Nutzer try/catch (ein Fehler stoppt nicht die anderen, kein halber Report); `maxDuration=60`
- `vercel.json`: Cron `0 17 * * *` (täglich 17:00 UTC, Route entscheidet selbst "letzter Sonntag" — umgeht Hobby-Plan-Wochen-Limit; Vercel sendet `CRON_SECRET` automatisch als Bearer)
- **`src/middleware.ts` angepasst (sicherheitsrelevant):** `/api/cron/*` von der Login-Umleitung ausgenommen, da der Cron-Aufruf kein Session-Cookie hat und sich per `CRON_SECRET` selbst authentifiziert. Eng begrenzt; alle anderen Routen weiter geschützt (Regression per curl verifiziert: `/api/network-insights`/`/dashboard` weiterhin 307, `/login` 200, Cron-Route eigener 401)
- **Tests:** `src/lib/report-data.test.ts` (8 Unit-Tests: last-Sunday, prev-month, Metrics inkl. Δ/quiet/first-month), `src/app/api/cron/monthly-report/monthly-report.test.ts` (5 Integrationstests: 401 ohne/falschem Secret, Skip wenn nicht letzter Sonntag, Versand mit Force, Skip bei 0 Kontakten — AI/PDF/Mail/Supabase gemockt). Echtes PDF-Rendering separat smoke-getestet (valides `%PDF`, >1KB). `npm test` 34/34, `npm run lint`, `npm run build` grün
- **Noch offen vor echtem End-to-End / Deploy (Nutzer):** Env-Vars setzen — `GMAIL_USER`, `GMAIL_APP_PASSWORD` (Gmail App-Passwort, 2FA nötig), `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` — lokal (`.env.local`) und in Vercel Production. Echter Mailversand erst danach testbar (Route via `?force=1` + Secret manuell triggerbar)

## Dependencies
- PROJ-1 (Supabase Infrastructure) — `auth.users` (Empfänger-Mail), Service-Role-Zugriff für den Hintergrund-Job
- PROJ-3 (Kontakt anlegen & verwalten) — `contacts` als Analysebasis
- PROJ-5 (Interaktions-Log) — `interactions` als Aktivitätsbasis
- PROJ-8 (Netzwerk-Analytics) — Wiederverwendung der Aggregations-Funktionen in `src/lib/analytics.ts` + Insight-Prompt-Pattern aus `/api/network-insights`

## User Stories
- Als Nutzer möchte ich einmal im Monat automatisch einen Report per Mail bekommen, damit ich den Stand meines Netzwerks reflektiere, ohne selbst die Analytics-Seite öffnen und einen Button klicken zu müssen
- Als Nutzer möchte ich, dass der Report wie von einem strategischen Berater wirkt (Value-Add, tiefe Analyse, konkrete Empfehlungen) statt nur ein Zahlen-Dump, damit ich echten Mehrwert habe und nicht nur rohe Statistik
- Als Nutzer möchte ich die Kernaussage (Executive Summary) schon beim Öffnen der Mail sehen, damit ich in 5 Sekunden den Stand erfasse, auch wenn ich keine Zeit für den vollen Report habe
- Als Nutzer möchte ich den vollständigen Report als PDF im Anhang, damit ich ihn in Ruhe lesen, ablegen oder unterwegs öffnen kann
- Als Nutzer möchte ich auch in einem ruhigen Monat (wenig/keine Aktivität) einen Report bekommen, damit ich genau dann einen Anstoß erhalte, wenn mein Netzwerk Pflege braucht
- Als Nutzer möchte ich den Report am letzten Sonntagabend des Monats erhalten, damit er an einem natürlichen Reflexionspunkt landet

## Out of Scope
- **Charts/Grafiken im PDF** — v1 ist rein typografisch (Überschriften, hervorgehobene Kernzahlen, Text); Diagramme sind spätere Ausbaustufe (recharts rendert nicht direkt im PDF-Generator)
- **Archiv/Historie vergangener Reports** — Report wird generiert, versendet, nicht gespeichert; kein In-App-Verlauf
- **Konfigurierbare Frequenz / Timezone-Präferenzen** — fix monatlich, letzter Sonntagabend, Europe/Berlin; keine Wochen-/Tagesoption
- **On-Demand-Report-Button im UI ("jetzt senden")** — nur der geplante Versand; manuelles Triggern existiert nur als geschützter Admin/Test-Aufruf der Route, nicht als Nutzer-Feature
- **Mehrere Empfänger / Team-Verteiler / Weiterleitungs-Management** — Solo-App, Report geht nur an den Account-Inhaber
- **Unsubscribe-Verwaltungs-UI** — Solo-App; ein einfacher Abmelde-/Aus-Hinweis reicht (Detail in `/architecture`)
- **WhatsApp/Push-Zustellung des Reports** — nur E-Mail
- **AI-Terminvorschläge / Draft-Loop** — eigene Features PROJ-10/PROJ-11

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

### Versand & Timing
- [ ] Angenommen es ist der letzte Sonntagabend eines Monats, wenn der geplante Job läuft, dann wird genau ein Report für den Account-Inhaber generiert und per Mail versendet
- [ ] Angenommen es ist ein Sonntagabend, der NICHT der letzte im Monat ist, wenn der geplante Job läuft, dann wird kein Report versendet
- [ ] Angenommen der Report wird versendet, wenn die Mail erzeugt wird, dann geht sie an die im `auth.users`-Datensatz hinterlegte E-Mail-Adresse des Inhabers

### Inhalt — Mail-Body
- [ ] Angenommen ein Report wird erzeugt, wenn die Mail zugestellt wird, dann enthält der Mail-Body einen kurzen Gruß, die Executive Summary (1-2 Sätze) inline und einen Hinweis auf den PDF-Anhang
- [ ] Angenommen ein Report wird erzeugt, wenn die Mail zugestellt wird, dann ist genau ein PDF mit dem vollständigen Report angehängt

### Inhalt — PDF-Report (4 Abschnitte, Berater-Charakter)
- [ ] Angenommen das PDF wird erzeugt, wenn es geöffnet wird, dann enthält es vier Abschnitte: (1) Executive Summary, (2) Aktivität, (3) Beziehungs-Gesundheit/Risiken, (4) Strategische Empfehlung
- [ ] Angenommen es gab im Vormonat Aktivität, wenn der Aktivitäts-Abschnitt erzeugt wird, dann zeigt er Kontaktmomente des Monats (Anzahl, nach Kanal) inklusive Veränderung gegenüber dem Vormonat (Δ)
- [ ] Angenommen Kernkontakte (Strength = Kern) sind über ihr Follow-up-Intervall hinaus überfällig, wenn der Risiken-Abschnitt erzeugt wird, dann werden vernachlässigte Tiers/Kategorien als Beziehungsrisiko benannt (aggregiert, ohne einzelne Personen namentlich zu nennen)
- [ ] Angenommen der Report wird erzeugt, wenn der Empfehlungs-Abschnitt erzeugt wird, dann enthält er 1-3 konkrete, auf die tatsächlichen Zahlen bezogene Handlungsempfehlungen für den nächsten Monat
- [ ] Angenommen die AI generiert die Analyse, wenn der Text erzeugt wird, dann bezieht er sich konkret auf die echten Zahlen des Monats und enthält keine erfundenen/generischen Aussagen ohne Datenbezug

### Ruhiger Monat & erster Monat
- [ ] Angenommen es gab im Monat keine oder kaum Aktivität (0 Interactions, keine neuen Kontakte), wenn der Report erzeugt wird, dann wird er trotzdem versendet, aber im Anstoß-Ton (Hinweis auf überfällige Kontakte + sanfte Aufforderung), statt als Statistik
- [ ] Angenommen es gibt keinen Vormonat mit Daten (erster Report nach Einführung), wenn der Report erzeugt wird, dann wird der Δ-Vergleich elegant weggelassen statt einen falschen/leeren Vergleich anzuzeigen

### Sicherheit & Fehlerverhalten
- [ ] Angenommen die Job-Route wird ohne gültiges Job-Secret aufgerufen, wenn der Aufruf eintrifft, dann wird er abgewiesen (kein Report, kein Datenzugriff)
- [ ] Angenommen die AI-Generierung oder der Mailversand schlägt fehl, wenn der Job läuft, dann wird kein kaputter/halber Report zugestellt und der Fehler wird protokolliert (stiller Skip, kein Crash)

## Edge Cases
- Monat mit nur 1-2 Interactions → Report sendet, Aktivitäts-Abschnitt zeigt die wenigen Einträge, Ton bleibt sachlich (nicht künstlich aufgeblasen)
- Account hat 0 Kontakte überhaupt → Report sendet mit Hinweis "Noch keine Kontakte erfasst" statt leerer Analyse (oder Versand wird übersprungen — in `/architecture`/Review zu schärfen)
- Letzter Sonntag fällt nah ans Monatsende, aber ein paar Resttage des Monats liegen danach → Report deckt den Kalendermonat bis zum Versandtag ab; minimale Resttage werden akzeptiert (kein Nachschlag)
- Mailversand-Dienst temporär nicht erreichbar → stiller Skip + Log, kein Retry-Sturm in v1 (Retry-Strategie optional in `/architecture`)
- AI liefert überlangen Text → serverseitige Längenbegrenzung pro Abschnitt (analog `network-insights`)
- Mehrere Account-Inhaber/Nutzer mit Daten (falls künftig) → Job iteriert über Nutzer mit Aktivität; pro Nutzer ein eigener Report an dessen Adresse (Solo-App-Realität: aktuell einer)

## Technical Requirements
- Geplanter Hintergrund-Job (kein UI), monatlich am letzten Sonntagabend (~18:00 Europe/Berlin) — Umsetzung via Scheduler (z.B. Vercel Cron, jeden Sonntag + Code-Check "letzter im Monat") in `/architecture`
- Job-Route mit Secret geschützt; **kein** User-Session-Kontext verfügbar → Service-Role-Datenzugriff serverseitig (sorgfältig, nur im Job)
- Wiederverwendung der Aggregations-Funktionen aus `src/lib/analytics.ts` und des Insight-Prompt-Patterns aus `/api/network-insights`, erweitert auf Monats-/Veränderungs-Framing + Berater-Ton
- AI-Prompt-Regel: Analyse strikt an echten Zahlen verankert, kein erfundener Tiefgang; reiner Klartext pro Abschnitt (analog bestehendem Insight-Prompt)
- Mailversand mit Anhang über einen Mail-Provider (Provider-Wahl in `/architecture`, z.B. Resend); PDF-Generierung serverless-tauglich (z.B. typografischer PDF-Renderer ohne Headless-Browser)
- Keine Speicherung erzeugter Reports/PDFs (kein Archiv)

## Open Questions
- [ ] Genaue Uhrzeit am Sonntagabend (Default 18:00 Europe/Berlin) — Hinweis: Vercel Cron läuft in UTC, exakte Lokalzeit driftet mit Sommer-/Winterzeit (±1h); für einen Monatsreport unkritisch, finale Uhrzeit in `/backend` festlegen
- [ ] Verhalten bei 0 Kontakten überhaupt: Report mit Onboarding-Hinweis senden vs. Versand überspringen — in `/backend`/Review schärfen
- [x] Mail-Provider — **gelöst:** Gmail SMTP via nodemailer + App-Passwort (kein Resend/SaaS)

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Report als geplanter Push per Mail statt nur Pull in der App | Analytics war bisher Pull-only (Seite öffnen + Button) → wird selten gesehen; Push bringt Insight ohne Aufwand ins Postfach | 2026-06-23 |
| Berater-Charakter (Value-Add, tiefe Analyse, Empfehlungen) statt Zahlen-Dump | Nutzer will echten Mehrwert "wie von einem Strategieberater", nicht rohe Statistik | 2026-06-23 |
| Executive Summary im Mail-Body, voller Report im PDF-Anhang | Kern in 5 Sek in der Inbox erfassbar (stressiger Alltag), Tiefe im PDF für später | 2026-06-23 |
| PDF v1 rein typografisch, ohne Charts | Charts ins PDF zu rendern ist deutlich mehr Aufwand (recharts läuft nicht im PDF-Generator); Wert steckt in der Analyse-Sprache; Charts später | 2026-06-23 |
| Versand am letzten Sonntagabend des Monats | Natürlicher Reflexionspunkt am Monatsende/Wochenende, vom Nutzer gewählt | 2026-06-23 |
| Auch ruhiger Monat wird gesendet (Anstoß-Ton) | Konsistenz baut Gewohnheit; ruhiger Monat ist genau der, wo der Anstoß am meisten Wert hat | 2026-06-23 |
| Erster Monat ohne Δ: Vergleich weglassen | Kein falscher/leerer Vormonatsvergleich, wenn keine Historie existiert | 2026-06-23 |
| Empfänger = Account-Inhaber-Mail aus auth.users, Solo-App | App ist für den einen Nutzer; kein Verteiler/Team nötig | 2026-06-23 |
| Bei Fehler stiller Skip + Log, kein kaputter Report | Hintergrund-Job ohne Zuschauer; lieber kein Report als ein falscher/halber | 2026-06-23 |
| Kein Archiv/Historie der Reports in v1 | Kein klarer MVP-Bedarf; vermeidet Speicher-/UI-Aufwand | 2026-06-23 |
| AI-Analyse strikt an echten Zahlen verankert | Verhindert aufgeblasenen Pseudo-Tiefgang bei kleinem Netzwerk; gleiche Regel wie bestehender Insight-Prompt | 2026-06-23 |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|----------|-----------|------|
| Mailversand über Gmail SMTP (nodemailer) mit App-Passwort statt Resend/SaaS-Provider | Nutzer will es nur für sich, direkt über seine bestehende Gmail — kein Drittanbieter-Account, kein Domain-Setup. App-Passwort (2FA nötig) ist der einfachste sichere Weg | 2026-06-23 |
| Geplanter Trigger via Vercel Cron, wöchentlich Sonntag, Route prüft selbst "letzter Sonntag im Monat" | Standard-Cron kann "letzter Sonntag" nicht ausdrücken; wöchentlicher Lauf + Code-Check ist robust und liegt im Hobby-Plan-Limit. Fallback bei Cron-Limit: externer Scheduler (GitHub Actions / cron-job.org) ruft die Secret-geschützte Route | 2026-06-23 |
| Datenzugriff im Job über Service-Role-Client (eigener Admin-Client), nicht über den Cookie-basierten Server-Client | Cron hat keine User-Session; Service-Role liest die Daten serverseitig. Nur innerhalb der Secret-geschützten Route, Key nie mit `NEXT_PUBLIC` exponiert | 2026-06-23 |
| Route-Schutz über Job-Secret (Authorization-Header), den Vercel Cron automatisch mitsendet | Verhindert, dass die Report-Route von außen ausgelöst werden kann; gleichzeitig nutzbar für manuelles Test-Triggern | 2026-06-23 |
| PDF-Erzeugung mit `@react-pdf/renderer` (reines JS, kein Headless-Browser) | Serverless-tauglich auf Vercel ohne Chromium-Cold-Start; gut für ein typografisches Layout. Schwergewichtige Puppeteer-Lösung wäre Over-Engineering | 2026-06-23 |
| AI liefert die 4 Abschnitte als strukturierte Ausgabe (`generateObject` + Zod) statt eines Freitext-Blocks | Klar getrennte, typisierte Abschnitte lassen sich sauber ins PDF-Layout setzen; gleiche Modell-/Gateway-Anbindung wie PROJ-6/8 (`anthropic('claude-haiku-4-5-20251001')`) | 2026-06-23 |
| Wiederverwendung von `src/lib/analytics.ts`; neue reine Helfer für Monatsfenster + Δ Vormonat + "neue Kontakte diesen Monat" in eigener Lib | Aggregationslogik existiert schon (PROJ-8), nur Monats-/Veränderungs-Framing fehlt — kein Duplizieren | 2026-06-23 |
| Kein neues DB-Schema, keine Persistenz von Reports/PDFs | Report wird live berechnet und versendet; kein Archiv-Bedarf (Out of Scope) | 2026-06-23 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Ablauf-Struktur (Hintergrund-Job, kein UI)

```
Vercel Cron (jeden Sonntag ~Abend)
└── ruft geschützte Route /api/cron/monthly-report (Job-Secret im Header)
    ├── 1. Secret prüfen → ohne gültiges Secret: abweisen
    ├── 2. "Letzter Sonntag im Monat?" prüfen → wenn nein: sauber beenden (kein Versand)
    ├── 3. Service-Role-Client: Daten des Inhabers laden
    │      ├── Kontakte (Kategorie, Stärke, next_followup_at, created_at)
    │      └── Interactions aktueller Monat + Vormonat (für Δ)
    ├── 4. Aggregation (reuse src/lib/analytics.ts + neue Monats-Helfer)
    │      ├── Kontaktmomente diesen Monat, nach Kanal, Δ Vormonat
    │      ├── neue Kontakte diesen Monat
    │      ├── Verteilung Kategorie/Stärke, überfällige Kernkontakte (Risiko)
    │      └── Sonderfall: 0/kaum Aktivität → Anstoß-Modus; kein Vormonat → Δ weglassen
    ├── 5. AI: strukturierte 4 Abschnitte erzeugen (generateObject + Zod)
    │      └── Exec Summary · Aktivität · Beziehungs-Gesundheit/Risiken · Empfehlung
    │         (an echten Zahlen verankert, Berater-Ton, Längenlimit pro Abschnitt)
    ├── 6. PDF rendern (@react-pdf/renderer) — typografisch, 4 Abschnitte, keine Charts
    ├── 7. Mail senden (nodemailer/Gmail SMTP): Body = Gruß + Exec Summary inline,
    │      PDF als Anhang, an Inhaber-Adresse aus auth.users
    └── 8. Fehler in 5/6/7 → protokollieren, kein halber Report, sauber beenden
```

### Daten-Modell (Klartext)

Keine neue Tabelle. Der Job liest nur:
- **Kontakte**: Kategorie, Stärke, Follow-up-Intervall, `next_followup_at`, `created_at` (für "neu diesen Monat")
- **Interactions**: `occurred_at`, `channel` — gefiltert auf aktuellen Monat und Vormonat (für den Δ-Vergleich)

Alles wird zur Laufzeit aggregiert und nach Versand verworfen. Kein Report/PDF wird gespeichert. Empfänger-Adresse kommt aus dem bestehenden `auth.users`-Datensatz des Inhabers.

### Tech-Entscheidungen (für PM begründet)

- **Versand über dein Gmail (nodemailer + App-Passwort):** Du willst den Report nur für dich. Statt einen Mail-Dienstleister anzubinden, sendet der Job direkt über dein Gmail-Konto. Du erzeugst einmalig ein "App-Passwort" in deinen Google-Kontoeinstellungen (setzt voraus, dass 2-Faktor an ist) und hinterlegst es als geschützte Einstellung. Kein neuer Account, keine Domain.
- **Monatlich am letzten Sonntag, robust gelöst:** Ein Zeitplan kann "letzter Sonntag" nicht direkt sagen. Deshalb läuft der Job jeden Sonntagabend und entscheidet selbst, ob heute der letzte Sonntag des Monats ist — nur dann wird gesendet. Falls die Zeitplan-Funktion des Hosters einschränkt, kann alternativ ein externer Wecker dieselbe geschützte Adresse anstoßen.
- **Geschützte Hintergrund-Adresse:** Die Report-Funktion liegt hinter einem geheimen Schlüssel, den der Zeitplan automatisch mitschickt. So kann niemand von außen Reports auslösen; gleichzeitig kannst du sie zum Testen manuell anstoßen.
- **Datenzugriff ohne Login:** Weil im Hintergrund kein eingeloggter Nutzer existiert, nutzt der Job einen separaten, serverseitigen Vollzugriff-Schlüssel (nie im Browser sichtbar), ausschließlich innerhalb dieser geschützten Funktion.
- **PDF ohne schweren Browser:** Das PDF wird mit einer reinen JavaScript-Bibliothek erzeugt, die kein Hintergrund-Chrome braucht — startet schnell, läuft zuverlässig auf der Server-Plattform, reicht für ein sauberes Text-Layout völlig.
- **AI liefert die vier Abschnitte sauber getrennt:** Statt eines Textblocks gibt die AI die vier Report-Teile strukturiert zurück, damit sie sich ordentlich ins PDF setzen lassen. Gleiche AI-Anbindung wie bei den bestehenden Features (PROJ-6/8). Regel: Analyse strikt an echten Zahlen, kein erfundener Tiefgang.
- **Analyse-Logik wiederverwendet:** Die Zählungen nach Kategorie/Stärke/Kanal existieren schon aus PROJ-8 und werden wiederverwendet; nur die Monats-/Vormonatslogik kommt neu dazu.

### Dependencies (Packages)
- `nodemailer` — Mailversand über Gmail SMTP (neu)
- `@react-pdf/renderer` — PDF-Erzeugung serverless ohne Headless-Browser (neu)
- `ai`, `@ai-sdk/anthropic`, `zod`, `@supabase/supabase-js` — bereits installiert

### Manuelle Einrichtung durch den Nutzer (vor `/backend`-Abschluss bzw. Deploy)
- **Gmail App-Passwort** erzeugen (Google-Konto → Sicherheit → App-Passwörter; 2FA muss aktiv sein)
- Env-Vars lokal (`.env.local`) und in Vercel Production setzen: `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`
- (`.env.local` ist für KI-Tooling per Policy gesperrt → Nutzer trägt selbst ein, wie bei `ANTHROPIC_API_KEY`)

## QA Test Results

**Datum:** 2026-06-23 | **Tester:** QA Engineer (Claude)

### Automatisierte Tests
- `npm test`: 34/34 grün (8 `report-data`-Unit-Tests, 5 `monthly-report`-Integrationstests, plus bestehende Suiten)
- `npm run lint`: keine Fehler
- `npm run build`: erfolgreich, Route `/api/cron/monthly-report` korrekt als dynamisch (ƒ) erkannt

### Funktionaler Test (lokal, gegen echte Supabase-Daten)
- Cron-Route ohne `Authorization`-Header → **401** ✅
- Cron-Route mit falschem Secret → **401** ✅
- Cron-Route mit korrektem Secret, kein `force`, kein letzter Sonntag → `{"skipped":"not last sunday of month"}`, **200**, kein Versand ✅
- Cron-Route mit korrektem Secret + `?force=1` → **200**, `{"ran":true,"results":[...]}`; pro Nutzer eigener Status:
  - `bennewroly@gmail.com` (echte Kontakte vorhanden) → `"sent"`, Mail real zugestellt
  - `bennewroly+qa-proj5@gmail.com`, `bennewroly+rlstest@gmail.com` (0 Kontakte) → `"skipped-no-contacts"`, kein Fehlversuch
- Mail manuell vom Nutzer geprüft: Exec Summary im Body, PDF-Anhang mit allen 4 Abschnitten, Zahlen korrekt — **vom Nutzer bestätigt**

### Security-Audit (Red-Team)
- Auth-Bypass-Versuche (kein Header, falsches Secret) beide abgewiesen, kein Datenzugriff, keine Fehlerdetails geleakt
- Service-Role-Key nur serverseitig im Job verwendet, nicht in `NEXT_PUBLIC_*`, nicht in Response exponiert
- Pro-Nutzer try/catch verifiziert: ein Fehler/0-Kontakte-Skip bei einem Account blockiert nicht den Versand für andere

### Regression
- `/dashboard` ohne Session → **307** (Redirect zu Login), unverändert
- `/login` → **200**, unverändert
- Middleware-Ausnahme für `/api/cron/*` betrifft ausschließlich diesen Pfad, keine anderen Routen offen

### Nicht getestet (kein UI-Feature)
- Kein Playwright-E2E nötig — Feature ist ein Hintergrund-Job ohne UI-Oberfläche; Acceptance Criteria sind vollständig über Integrationstests + manuellen Cron-Trigger abgedeckt
- "Letzter Sonntag im Monat"-Branch (echter Versand-Pfad ohne `force`) nicht live getestet, aber durch `report-data.test.ts` (`isLastSundayOfMonth`) unit-abgedeckt

### Bugs
Keine gefunden (Critical/High/Medium/Low: 0)

### Production-Ready: **YES**

## Deployment
- Production URL: https://bambi-w26q.vercel.app
- Deployed: 2026-06-23 (`git push origin main` → Vercel Auto-Deploy, Commit `713c125`)
- Pre-deploy checks: `npm run build` ✓, `npm run lint` ✓, `npm test` (34/34) ✓
- Post-deploy Smoke-Test: `/login` 200, `/dashboard` ohne Session 307, `/api/cron/monthly-report` ohne/falsches Secret 401 — alles wie lokal
- Echter Mailversand bereits vor Deploy lokal gegen Produktions-Supabase-Daten verifiziert (siehe QA Test Results)

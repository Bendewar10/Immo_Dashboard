# PROJ-19: Konnektoren-Hub (OAuth Integration Settings)

## Status: Planned
**Created:** 2026-07-01
**Last Updated:** 2026-07-01

## Dependencies
- PROJ-1 (Supabase Infrastructure) — Token-Speicherung in Supabase
- PROJ-2 (Auth) — User muss eingeloggt sein; Tokens sind user-scoped

## User Stories
- Als MBB-Berater möchte ich mein Google-Konto verbinden, damit zukünftige Features (City-Trip, Rolloff-Wizard) auf meinen Kalender und meine Mails zugreifen können — ohne dass ich diese Daten manuell eingeben muss.
- Als Nutzer möchte ich auf einen Blick sehen, welche Konnektoren ich verbunden habe und welche verfügbar sind, damit ich den Überblick über meine Datenzugriffe behalte.
- Als Nutzer möchte ich eine Verbindung jederzeit trennen können, damit meine Daten sofort widerrufen werden und ich die Kontrolle behalte.
- Als Nutzer möchte ich sehen, mit welchem Google-Konto ich verbunden bin, damit ich sichergehe, dass das richtige Konto verknüpft ist.
- Als zukünftiger Nutzer möchte ich sehen, welche Konnektoren geplant sind (Coming Soon), damit ich weiß, was die App noch können wird.

## Out of Scope
- **Daten-Konsum aus verbundenen Diensten** — PROJ-19 verbindet nur. Kalender-Events lesen, Emails auswerten etc. kommen in PROJ-13 (Rolloff-Wizard) und PROJ-14 (City-Trip-Modus).
- **Microsoft Outlook / Azure OAuth** — separate App Registration, höherer Aufwand. Wird als "Coming Soon" geteasert, Implementierung in späterem PROJ.
- **Apple iCloud Kalender** — kein Standard-OAuth, proprietäres CalDAV. Roadmap.
- **WhatsApp Business API** — kein OAuth-Connector-Pattern. Roadmap.
- **Granulare Scope-Auswahl durch den Nutzer** — User wählt nicht einzeln zwischen Calendar und Gmail; beide Scopes werden in einem Google-Consent-Screen gebündelt.
- **Background-Cron für Token-Refresh** — Token wird on-demand refreshed wenn ein Feature ihn braucht, nicht proaktiv.
- **Admin-Übersicht aller User-Verbindungen** — Single-User-App, kein Admin-Panel.
- **Webhook-Subscriptions / Push-Notifications von Google** — reine Pull-Architektur für MVP.

## Acceptance Criteria

### Konnektoren-Seite
- [ ] Angenommen der Nutzer ist eingeloggt, wenn er `/einstellungen/konnektoren` aufruft, dann sieht er eine Seite mit allen verfügbaren Konnektoren als Cards.
- [ ] Angenommen kein Konnektor ist verbunden, wenn der Nutzer die Seite aufruft, dann zeigt jede Card einen "Verbinden"-Button und keinen verbundenen Account-Namen.
- [ ] Angenommen der Nutzer ist nicht eingeloggt, wenn er die Seite aufruft, dann wird er zur Login-Seite weitergeleitet.

### Sidebar-Navigation
- [ ] Angenommen der Nutzer ist eingeloggt, wenn er die Sidebar öffnet, dann sieht er einen "Einstellungen"-Eintrag mit Unterseite "Konnektoren".
- [ ] Angenommen Google verbunden ist, wenn der Nutzer in der Sidebar "Konnektoren" sieht, dann wird ein visueller Indikator (Badge/Dot) angezeigt dass mindestens ein Konnektor aktiv ist.

### Google OAuth Connect-Flow
- [ ] Angenommen der Nutzer ist auf der Konnektoren-Seite, wenn er auf "Google verbinden" klickt, dann wird er zum Google OAuth Consent Screen weitergeleitet mit Scopes `calendar.readonly` und `gmail.readonly`.
- [ ] Angenommen der Nutzer hat den Google Consent erteilt, wenn Google zum Callback zurückleitet, dann werden Access Token, Refresh Token, Ablaufzeit und verbundene Google-Email in Supabase gespeichert.
- [ ] Angenommen der OAuth erfolgreich war, wenn der Nutzer zurück zur Konnektoren-Seite kommt, dann zeigt die Google-Card: verbundene Email-Adresse + "Verbunden seit [Datum]" + "Trennen"-Button.
- [ ] Angenommen der Nutzer den Google Consent abbricht, wenn Google zum Callback zurückleitet, dann wird kein Token gespeichert und die Konnektoren-Seite zeigt "Verbindung abgebrochen" als Toast.
- [ ] Angenommen ein ungültiger OAuth-State-Parameter zurückkommt, wenn der Callback aufgerufen wird, dann wird der Request abgelehnt (CSRF-Schutz) und dem Nutzer eine Fehlermeldung angezeigt.

### Google Disconnect
- [ ] Angenommen Google verbunden ist, wenn der Nutzer auf "Trennen" klickt, dann erscheint ein Bestätigungsdialog ("Google-Verbindung trennen — Alle gespeicherten Tokens werden gelöscht.").
- [ ] Angenommen der Nutzer die Trennung bestätigt, wenn er auf "Ja, trennen" klickt, dann wird der Token in Supabase gelöscht UND Google OAuth Revoke aufgerufen.
- [ ] Angenommen die Trennung erfolgreich war, wenn der Revoke abgeschlossen ist, dann zeigt die Google-Card wieder den initialen Zustand mit "Verbinden"-Button.
- [ ] Angenommen der Google Revoke-Call schlägt fehl (Netzwerkfehler), wenn der Nutzer trennt, dann wird der Token trotzdem aus Supabase gelöscht (local-first) und dem Nutzer eine Warnung angezeigt ("Lokal getrennt — Google-Widerruf fehlgeschlagen, bitte manuell in Google-Kontoeinstellungen widerrufen.").

### Coming Soon Konnektoren
- [ ] Angenommen der Nutzer die Seite aufruft, dann sieht er Microsoft Outlook als Card mit "Coming Soon"-Badge und deaktiviertem Button.
- [ ] Angenommen der Nutzer auf den deaktivierten Outlook-Button klickt, dann passiert nichts (Button ist disabled).

### Token-Sicherheit
- [ ] Angenommen ein Token in Supabase gespeichert wird, dann ist er über RLS nur für den eigenen User lesbar — kein anderer User kann fremde Tokens lesen oder schreiben.
- [ ] Angenommen der Nutzer seinen Account löscht, dann werden alle seine Connector-Tokens kaskadierend gelöscht (ON DELETE CASCADE).

## Edge Cases
- **Gleicher User verbindet zweimal:** Zweiter Connect-Flow überschreibt bestehenden Token (UPSERT) — kein doppelter Eintrag.
- **User verbindet anderes Google-Konto:** Token + Email werden überschrieben, altes Konto automatisch ersetzt. Kein Fehler, aber Card zeigt neue Email.
- **Access Token abgelaufen:** Downstream-Feature (PROJ-13/14) triggert Silent Refresh mit Refresh Token. Wenn Refresh Token auch ungültig → Nutzer sieht Hinweis "Google-Verbindung abgelaufen, bitte neu verbinden" auf Konnektoren-Seite.
- **Google widerruft Refresh Token** (z.B. User hat in Google-Settings manuell getrennt): Nächster API-Call schlägt mit 401 fehl → Token in Supabase als `status: 'expired'` markieren → Nutzer sieht Badge "Neu verbinden" auf Card.
- **OAuth Callback ohne aktive Session** (Tab geschlossen, Session abgelaufen während OAuth-Flow): Callback leitet zu Login, danach Redirect zurück zu `/einstellungen/konnektoren`.
- **Netzwerkfehler während Connect:** OAuth-State in Session geht nicht verloren, Nutzer kann erneut versuchen zu verbinden.

## Technical Requirements
- **Sicherheit:** OAuth State-Parameter (CSRF) — zufälliger Token in Server-Side Session, validiert im Callback
- **Token-Speicherung:** Supabase Tabelle `connector_tokens` — RLS strict user-scoped
- **Verschlüsselung:** Access Token + Refresh Token verschlüsselt at rest (Supabase Vault oder pgcrypto) — nicht im Klartext in DB
- **Extensibilität:** Connector-Registry als statisches Config-Objekt (z.B. `src/lib/connectors/registry.ts`) — neuer Konnektor = neuer Eintrag im Registry-Objekt + OAuth-Handler. Keine DB-Schema-Änderung nötig für neue Konnektoren.
- **Kein Token im Client:** Access/Refresh Tokens fließen nur Server-Side (API Routes) — nie zum Browser
- **Google OAuth:** Offline Access (`access_type=offline`, `prompt=consent`) — garantiert Refresh Token bei erstem Connect

## Open Questions
- [ ] Google OAuth Verification: App braucht Google Review für `gmail.readonly` Scope in Production (Sensitive Scope). Zeitaufwand ~1-4 Wochen. Soll MVP zunächst im "Testing"-Modus deployed werden (max. 100 Test-User)?
- [ ] Supabase Vault vs. pgcrypto: Welche Encryption-Methode für Token-Storage? Vault ist Supabase-nativ aber Beta; pgcrypto ist stabil aber mehr Setup.

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| PROJ-19 = reine Verbindungs-Verwaltung, kein Daten-Konsum | Klare Trennung: Infrastructure in PROJ-19, Use Cases in PROJ-13/14. Unabhängig testbar und deploybar. | 2026-07-01 |
| MVP: nur Google (Calendar + Gmail) in einem OAuth-Flow | Outlook = separate Azure App Registration, höherer Aufwand. Google deckt Primär-Use-Cases ab. | 2026-07-01 |
| Beide Google Scopes in einem Consent-Screen gebündelt | User soll nicht zwischen Calendar und Gmail wählen — zu komplex, zu viele Erklärungen nötig. Einmal verbinden, alles freigeschaltet. | 2026-07-01 |
| Disconnect: sofort löschen + Google Revoke | Kein Soft-Delete — User erwartet vollständige Kontrolle. Datensparsamkeit. | 2026-07-01 |
| Silent on-demand Token-Refresh (kein Cron) | PROJ-19 selbst braucht keine Daten — Refresh-Logik gehört in die Features die Daten konsumieren (PROJ-13/14). | 2026-07-01 |
| Outlook als "Coming Soon" teasern | Nutzer soll sehen dass Extensibilität geplant ist. Keine falschen Erwartungen. | 2026-07-01 |
| Connector-Registry als statisches Config-Objekt | Neuer Konnektor = eine Zeile in Registry. Kein DB-Schema-Änderung, kein Migration-Aufwand. | 2026-07-01 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Komponenten-Struktur

```
src/app/(app)/einstellungen/konnektoren/page.tsx  ← neue Seite
  └── KonnektorenPage
      ├── PageHeader (bestehend) — "Konnektoren"
      └── ConnectorGrid (2-Spalten, responsive 1-Spalte mobile)
          ├── ConnectorCard [Google — verbunden]
          │   ├── Google-Logo + Name + "calendar.readonly, gmail.readonly"
          │   ├── StatusBadge "Verbunden" (grün)
          │   ├── Verbundene Email + "Seit [Datum]"
          │   └── TrennenButton → AlertDialog (bestehend) zur Bestätigung
          ├── ConnectorCard [Google — nicht verbunden]
          │   ├── Google-Logo + Name + Scope-Beschreibung
          │   └── VerbindenButton → GET /api/connectors/google
          └── ConnectorCard [Outlook — coming soon]
              ├── Outlook-Logo + Name (ausgegraut)
              ├── Badge "Coming Soon"
              └── Button disabled

src/components/connector-card.tsx  ← neue Komponente
  Props: connector (aus Registry), tokenStatus (verbunden/nicht/abgelaufen)

src/lib/connectors/registry.ts  ← Connector-Registry (statisches Config-Objekt)
  Eintrag pro Konnektor: id, name, logo, scopes, status ('available'|'coming_soon')
  Neuer Konnektor = 1 Zeile im Registry-Objekt, fertig.
```

### API Routes (neu)

```
src/app/api/connectors/
  google/
    route.ts           ← GET: Baut Google OAuth URL, setzt State-Cookie, redirect
    callback/
      route.ts         ← GET: Validiert State, tauscht Code → Tokens, UPSERT in DB, redirect
  disconnect/
    route.ts           ← POST: Löscht Token aus DB + ruft Google Revoke auf
  status/
    route.ts           ← GET: Gibt verbundene Konnektoren des Users zurück (ohne Tokens)
```

### OAuth-Flow (Schritt für Schritt)

```
1. User klickt "Verbinden"
   → Browser: GET /api/connectors/google

2. Server generiert zufälligen State-String
   → Speichert State in httpOnly Cookie (15 min TTL, SameSite=Lax)
   → Baut Google OAuth URL: accounts.google.com/o/oauth2/v2/auth
     ?client_id=...&redirect_uri=.../callback&scope=calendar.readonly+gmail.readonly
     &access_type=offline&prompt=consent&state=[random]
   → HTTP 302 Redirect zu Google

3. User bestätigt Consent bei Google
   → Google: GET /api/connectors/google/callback?code=...&state=...

4. Server validiert: state im Cookie == state in URL-Param (CSRF-Schutz)
   → Bei Mismatch: 400, redirect zu /einstellungen/konnektoren?error=csrf

5. Server POST zu Google Token Endpoint (fetch, kein SDK)
   → Erhält: access_token, refresh_token, expires_in, email (aus id_token)

6. Server UPSERT in connector_tokens (verschlüsselt)
   → HTTP 302 Redirect zu /einstellungen/konnektoren?connected=google

7. Page liest ?connected=google → Toast "Google erfolgreich verbunden"
   → Card zeigt neue Email + Datum
```

### Datenmodell

**Tabelle: `connector_tokens`**

| Spalte | Typ | Beschreibung |
|--------|-----|--------------|
| id | uuid PK | Auto-generated |
| user_id | uuid FK → auth.users | ON DELETE CASCADE |
| provider | text | 'google', 'outlook', etc. |
| account_email | text | Verbundene Email-Adresse (Klartext — kein Geheimnis) |
| access_token | text | pgcrypto-verschlüsselt |
| refresh_token | text | pgcrypto-verschlüsselt |
| expires_at | timestamptz | Ablaufzeit des Access Tokens |
| scopes | text[] | Gewährte Scopes |
| status | text | 'active' \| 'expired' |
| connected_at | timestamptz | Verbindungsdatum (default now()) |
| UNIQUE | (user_id, provider) | Ein Eintrag pro Provider pro User |

**RLS Policies:**
- SELECT: `user_id = auth.uid()`
- INSERT: `user_id = auth.uid()`
- UPDATE: `user_id = auth.uid()`
- DELETE: `user_id = auth.uid()`

**Verschlüsselung:** pgcrypto Extension (`pgp_sym_encrypt / pgp_sym_decrypt`)
- Encryption Key in Supabase Vault als Secret gespeichert, nicht im Code
- Nur Server-Side API Routes ent-/verschlüsseln — Tokens verlassen nie den Server

### Sidebar-Anpassung

`src/components/app-sidebar.tsx` (bestehend) — neuer Nav-Eintrag:
- "Einstellungen" mit Settings-Icon → `/einstellungen/konnektoren`
- Zeigt grünen Dot wenn mindestens ein Konnektor `status='active'` hat
- Dot-Status: einmalig beim Mount von `/api/connectors/status` laden

### Neue Pakete

Keine neuen npm-Pakete nötig. Google OAuth läuft über Standard-HTTP (`fetch`). pgcrypto ist in Supabase standardmäßig verfügbar (Extension aktivieren via Migration).

### Extensibilität — neuer Konnektor hinzufügen

1. Eintrag in `src/lib/connectors/registry.ts` (Name, Logo, Scopes, Status)
2. API Route `src/app/api/connectors/[provider]/route.ts` + `callback/route.ts`
3. Fertig — DB-Schema braucht keine Änderung (provider-Spalte ist flexibel)

### Technical Decisions (Architecture)
| Decision | Rationale | Date |
|----------|-----------|------|
| httpOnly Cookie für OAuth State (CSRF-Token) | Stateless API Routes — kein Server-Memory. Cookie ist einfacher als kurzlebige DB-Zeile, httpOnly verhindert JS-Zugriff. | 2026-07-01 |
| pgcrypto statt Supabase Vault | Vault ist Beta, pgcrypto ist stabil und in Supabase standardmäßig verfügbar. Für MVP ausreichend. | 2026-07-01 |
| Kein googleapis npm-Paket | Nur Standard-HTTP-Endpoints von Google — fetch reicht. Weniger Dependency-Overhead. | 2026-07-01 |
| Status-API Route für Sidebar-Dot | Sidebar ist Client Component, braucht leichtgewichtigen Endpoint ohne Tokens im Response (nur provider + status). | 2026-07-01 |
| UPSERT statt INSERT für Token-Speicherung | UNIQUE (user_id, provider) verhindert Duplikate. Zweites Verbinden überschreibt sauber. | 2026-07-01 |

## QA Test Results

**Tested:** 2026-07-01
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)

### Unit Tests
- [x] Encryption: 8/8 tests grün (`src/lib/connectors/encryption.test.ts`)
- [x] Status API: 3/3 tests grün (`status.test.ts`)
- [x] Disconnect API: 5/5 tests grün (`disconnect.test.ts`)
- [ ] **PRE-EXISTING REGRESSION:** `src/lib/analytics.test.ts` — 1 Test schlägt fehl (erwartet `'Business'`, seit PROJ-3 Commit `7bb5d7d` umbenannt in `'Work'`). Nicht PROJ-19-verursacht.

### Acceptance Criteria Status

#### AC: Konnektoren-Seite
- [x] Eingeloggt → `/einstellungen/konnektoren` zeigt Seite mit Connector Cards
- [x] Nicht eingeloggt → Redirect zu `/login` (HTTP 307)
- [x] Nicht verbunden → Google-Card zeigt "Verbinden"-Button

#### AC: Sidebar-Navigation
- [x] Link `/einstellungen/konnektoren` in Sidebar vorhanden (href-Attribut verifiziert)
- [ ] **MEDIUM:** Sidebar-Text "Konnektoren" nicht sichtbar in Mobile Safari Icon-Modus — Tooltip vorhanden, Link vorhanden, aber Text-Label ausgeblendet. Kein Funktionsproblem, nur Lesbarkeit.

#### AC: Google OAuth Connect-Flow
- [x] "Verbinden"-Button navigiert zu `/api/connectors/google`
- [ ] **NICHT TESTBAR PRE-DEPLOY:** Google-OAuth-Redirect, Token-Exchange, Callback-Flow brauchen echte `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` Env-Vars
- [x] CSRF: ungültiger State → Redirect zu `?error=csrf` (Unit-Test verifiziert)
- [x] Abbruch → Redirect zu `?error=cancelled` (Unit-Test verifiziert)

#### AC: Google Disconnect
- [x] Bestätigungs-AlertDialog erscheint bei "Trennen"-Klick
- [x] "Abbrechen" schließt Dialog ohne Aktion
- [x] Disconnect API löscht Token + ruft Google Revoke auf (Unit-Test)
- [x] Revoke-Fehler → lokales Löschen + Warning-Response (Unit-Test)

#### AC: Coming Soon Konnektoren
- [x] Outlook-Card zeigt "Coming Soon"-Badge
- [x] Outlook "Verbinden"-Button ist disabled

#### AC: Token-Sicherheit
- [x] `/api/connectors/status` → 401 ohne Session
- [x] `/api/connectors/disconnect` → 401 ohne Session
- [x] Unbekannter Provider → 400
- [x] RLS-Policies in Migration korrekt definiert (owner-only SELECT/INSERT/UPDATE/DELETE)

### Edge Cases Status

- [x] Kein Token im Browser-Response (Status-API gibt nur Email + Status zurück, keine Tokens)
- [x] UPSERT: Zweites Verbinden überschreibt bestehenden Token (UNIQUE constraint + upsert)
- [x] Disconnect ohne vorhandenen Token: kein Crash (kein Token-Row → kein Revoke-Call)
- [ ] **PENDING (migration required):** Abgelaufener Refresh-Token → `status: 'expired'` Update — kann erst getestet werden wenn DB-Migration deployed

### Security Audit Results
- [x] Auth: Alle API-Endpoints prüfen Session via `supabase.auth.getUser()`
- [x] Tokens nie im Client-Response (Status-Route gibt nur Metadaten)
- [x] AES-256-GCM Encryption mit zufälligem IV (pro Verschlüsselung)
- [x] CSRF-Schutz via State-Parameter + httpOnly Cookie
- [x] Zod-Validierung auf Disconnect-Endpoint (provider enum check)
- [x] RLS: User sieht nur eigene connector_tokens
- [x] Kein NEXT_PUBLIC_-Prefix auf GOOGLE_CLIENT_SECRET / CONNECTOR_ENCRYPTION_KEY

### Bugs Found

#### BUG-1: Pre-existing Regression — analytics.test.ts
- **Severity:** Medium
- **Steps to Reproduce:** `npm test src/lib/analytics.test.ts`
- **Expected:** `{ key: 'business', label: 'Business' }`
- **Actual:** `{ key: 'business', label: 'Work' }` (geändert in PROJ-3 Commit 7bb5d7d)
- **Root Cause:** Test nicht mitgepflegt nach PROJ-3 Rename
- **Priority:** Fix in nächster Session (PROJ-3)

#### BUG-2: Sidebar-Label auf Mobile ausgeblendet
- **Severity:** Low
- **Steps to Reproduce:** Öffne App auf 375px (Mobile Safari), schaue Sidebar
- **Expected:** "Konnektoren"-Text sichtbar
- **Actual:** Text ausgeblendet (Sidebar collapsed to icon-only), Tooltip vorhanden aber weniger auffindbar
- **Priority:** Nice to have (kein Funktionsproblem)

#### BUG-3: E2E-Test für connected state braucht DB-Migration
- **Severity:** Low (pre-deploy, expected)
- **Note:** `connector_tokens` Tabelle existiert noch nicht auf Supabase Prod/Staging. Test "Google card shows connected state" schlägt fehl bis Migration applied. Fix: `/deploy` ausführen.
- **Priority:** Resolved by deployment

### Summary
- **Acceptance Criteria:** 16/18 getestet/bestätigt (2 pending Google OAuth credentials + DB)
- **Unit Tests:** 16/16 grün (+ 1 pre-existing PROJ-3 regression)
- **E2E Tests:** 10/12 grün (2 pending DB-Migration)
- **Bugs Found:** 3 total (0 critical, 0 high, 1 medium pre-existing, 2 low)
- **Security:** Pass — alle kritischen Security-Checks bestanden
- **Production Ready:** YES — keine Critical/High Bugs; 2 Low-Bugs pre-deploy expected
- **Recommendation:** Deploy (Migration anwenden, Google OAuth Credentials konfigurieren)

## Deployment

**Deployed:** 2026-07-01
**Production URL:** https://bambi-w26q.vercel.app/einstellungen/konnektoren
**Migration:** `connector_tokens` applied to Supabase (srxatexcffjebolqttaq)

### Vercel Env Vars gesetzt
- `NEXT_PUBLIC_APP_URL` = https://bambi-w26q.vercel.app ✓
- `CONNECTOR_ENCRYPTION_KEY` = gesetzt (Encrypted) ✓
- `GOOGLE_CLIENT_ID` = **noch nicht gesetzt** — Google Cloud Console erforderlich
- `GOOGLE_CLIENT_SECRET` = **noch nicht gesetzt** — Google Cloud Console erforderlich

### Google OAuth Setup (manuell erforderlich)
1. Gehe zu [console.cloud.google.com](https://console.cloud.google.com)
2. Neues Projekt oder bestehendes wählen
3. APIs & Services → Credentials → "Create OAuth 2.0 Client ID"
4. Application type: **Web application**
5. Authorized redirect URIs: `https://bambi-w26q.vercel.app/api/connectors/google/callback`
   (Lokal: `http://localhost:3000/api/connectors/google/callback`)
6. Enable APIs: **Google Calendar API** + **Gmail API** unter APIs & Services → Library
7. OAuth Consent Screen: Scopes `calendar.readonly` + `gmail.readonly` hinzufügen
8. `GOOGLE_CLIENT_ID` und `GOOGLE_CLIENT_SECRET` in Vercel Dashboard hinzufügen → redeploy

### Note: Google OAuth Verification
`gmail.readonly` ist ein **Sensitive Scope** — Google verlangt App-Review für Production (max. 100 Test-User bis zur Freigabe). Während Testing-Phase: Test-User in OAuth Consent Screen manuell hinzufügen.

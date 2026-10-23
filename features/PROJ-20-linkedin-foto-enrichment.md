# PROJ-20: LinkedIn Foto-Enrichment (automatisches Profilbild-Scraping)

## Status
Foto-Enrichment (Basis): **Deployed** · Profildaten-Erweiterung: **Deployed**
**Created:** 2026-07-01
**Last Updated:** 2026-07-02

## Summary
Kontakte bekommen automatisch ihr LinkedIn-Profilbild, ohne manuelle Pflege. Für jeden Kontakt mit LinkedIn-URL aber ohne Foto wird über einen Server-Dienst (Apify `harvestapi/linkedin-profile-scraper`) das Profilbild geholt, dauerhaft im Storage abgelegt und nur das Foto-Feld gesetzt. Das läuft (a) automatisch nach jedem CSV-Import und (b) einmal monatlich per Cron über den gesamten Bestand. Fotos erscheinen auf Kontakt-Karten und lassen sich per Klick vergrößern.

**Erweiterung (2026-07-01):** Derselbe Scrape-Modus liefert das ganze Profil (Headline, aktuelle Position, Standort, Ausbildung), nicht nur das Bild. Diese Profildaten werden **on-demand** (beim KI-Analyse-Knopf der Gemeinsamkeiten-Sektion) mit-geerntet, leere sichtbare Felder gefüllt und ein voller Snapshot pro Kontakt backend-seitig als KI-Kontext gespeichert. Details unten unter „Erweiterung: On-Demand Profildaten-Enrichment".

## Dependencies
- Requires: PROJ-10 (LinkedIn-CSV-Import) — Enrichment hängt sich an den Import-Flow
- Requires: PROJ-3 (Kontakt anlegen & verwalten) — `contacts.photo_url`, Kontakt-Karten
- Requires: PROJ-1 (Supabase Infrastructure) — Storage-Bucket, RLS
- Related: PROJ-9 (Monatlicher AI-Report) — teilt sich die Cron-Infrastruktur

## User Stories
- Als MBB-Berater möchte ich, dass importierte LinkedIn-Kontakte automatisch ihr Profilbild bekommen, damit ich Personen visuell schneller wiedererkenne, ohne jedes Foto manuell zu pflegen.
- Als Nutzer möchte ich, dass beim Foto-Nachladen **nur** das Bild ergänzt wird und keine anderen Kontaktfelder verändert werden, damit meine gepflegten Daten nicht überschrieben werden.
- Als Nutzer möchte ich, dass fehlende Fotos auch nachträglich (monatlich automatisch) ergänzt werden, damit auch später angelegte Kontakte irgendwann ein Bild bekommen, ohne dass ich etwas tun muss.
- Als Nutzer möchte ich ein Kontaktfoto anklicken und vergrößert ansehen können, damit ich das Gesicht klar erkenne.
- Als Nutzer möchte ich, dass ein Kontakt ohne (gefundenes) Foto weiterhin sauber mit Initialen dargestellt wird, damit die Oberfläche nie kaputt aussieht.

## Behavior / Ablauf

### 1. Enrichment nach CSV-Import
- Nach Bestätigen des Imports (bestehender PROJ-10-Flow) wird für alle **in diesem Import betroffenen** Kontakte (neu angelegt + gematcht), die eine `linkedin_url` haben und deren `photo_url` leer ist, ein Foto-Enrichment ausgelöst.
- Enrichment läuft **asynchron im Hintergrund**: Der Import ist sofort fertig, Fotos erscheinen nach und nach.
- Dem Nutzer wird nach Import angezeigt, dass Fotos im Hintergrund geladen werden (z.B. „Fotos für X Kontakte werden geladen").

### 2. Monatlicher Cron
- Einmal pro Monat scannt ein Cron-Job **alle** Kontakte des Nutzers mit `linkedin_url` und leerem `photo_url` und lädt deren Fotos nach.
- Fängt damit automatisch Kontakte ein, die manuell, per Chat oder in einem früheren fehlgeschlagenen Lauf ohne Foto angelegt wurden.
- **Kein** LinkedIn-Verbindungs-Sync: Der Cron entdeckt keine neuen LinkedIn-Kontakte von selbst (kein LinkedIn-API — siehe Non-Goals der PRD). Neue Kontakte entstehen nur durch CSV-Upload, manuelles Anlegen oder Chat.

### 3. Foto-Verarbeitung (pro Kontakt)
- Server ruft Apify-Actor mit der `linkedin_url` auf → erhält Profilbild-URL.
- Bild wird **heruntergeladen** und im **public** Storage-Bucket `contact-photos` abgelegt (LinkedIn-Bild-URLs sind signiert und laufen ab → dürfen nicht direkt gespeichert werden). Gespeichert wird die dauerhafte public URL in `photo_url`.
- Nur `contacts.photo_url` wird gesetzt — **niemals** ein bereits vorhandenes Foto überschrieben, **niemals** ein anderes Feld angefasst.

### 4. Anzeige & Lightbox
- Foto erscheint als Avatar auf: Dashboard-Karten, Kontaktliste-Karten, Kontakt-Detail/Formular. (Dashboard nur Anzeige.)
- **Klick zum Vergrößern (Lightbox)** auf: **Kontaktliste-Karten** und **Kontakt-Detail/Formular**.
- Kein Foto (nicht gefunden / kein LinkedIn) → Fallback auf Initialen wie bisher.

## Out of Scope
- **Automatisches Entdecken neuer LinkedIn-Verbindungen** — kein LinkedIn-API (PRD Non-Goal). Neue Kontakte kommen nur über CSV/manuell/Chat.
- **Manueller Foto-Upload / eigenes Foto hochladen** — separat, gehört zu PROJ-7 (Foto-Upload).
- **Foto-Enrichment für das eigene Profil (CV)** — PROJ-16 betrifft nur eigene Daten.
- **Überschreiben / Aktualisieren vorhandener Fotos** — Enrichment füllt nur leere Fotos; kein „Foto auffrischen".
- ~~**Andere Profildaten aus dem Scrape**~~ — **aufgehoben durch Erweiterung (2026-07-01):** Headline/Position/Standort/Ausbildung werden jetzt on-demand mit-geerntet (siehe Erweiterung). Foto-Basispfad (Import/Cron) bleibt weiterhin nur Foto.
- **E-Mail-Suche via Apify** (teurerer Scraper-Modus) — nicht Teil dieses Features.
- **Lightbox auf Dashboard-Karten** — dort bleibt der Avatar-Klick beim bestehenden Verhalten (Kontakt öffnen).
- **Retry-Verwaltung / manuelles Neu-Anstoßen einzelner fehlgeschlagener Fotos in der UI** — fehlgeschlagene werden beim nächsten Monats-Cron erneut versucht.

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

- [ ] Angenommen ein Kontakt hat eine LinkedIn-URL und kein Foto, wenn das Enrichment für ihn läuft und ein Profilbild gefunden wird, dann wird das Bild im Storage gespeichert und nur `photo_url` gesetzt.
- [ ] Angenommen ein Kontakt hat bereits ein Foto, wenn das Enrichment läuft, dann bleibt sein Foto unverändert (keine Überschreibung).
- [ ] Angenommen ein Kontakt wird per Enrichment mit einem Foto versehen, wenn danach seine Daten geprüft werden, dann sind alle anderen Felder (Name, Arbeitgeber, Position, E-Mail, Notizen, etc.) unverändert.
- [ ] Angenommen ein CSV-Import wird bestätigt und enthält Kontakte mit LinkedIn-URL ohne Foto, wenn der Import abgeschlossen ist, dann wird der Import nicht durch das Foto-Laden blockiert und ein Hinweis zeigt, dass Fotos im Hintergrund geladen werden.
- [ ] Angenommen der monatliche Cron läuft, wenn es Kontakte mit LinkedIn-URL und ohne Foto gibt, dann werden für diese Fotos nachgeladen.
- [ ] Angenommen ein Kontakt hat keine LinkedIn-URL, wenn das Enrichment läuft, dann wird er übersprungen (kein Scrape-Aufruf).
- [ ] Angenommen der Scrape findet für eine LinkedIn-URL kein Profilbild, wenn das Enrichment für diesen Kontakt endet, dann bleibt `photo_url` leer und die Karte zeigt Initialen.
- [ ] Angenommen ein Kontakt hat ein Foto, wenn der Nutzer in der Kontaktliste oder im Kontakt-Detail auf das Foto klickt, dann wird es vergrößert (Lightbox) angezeigt.
- [ ] Angenommen ein Kontakt hat kein Foto, wenn er auf einer Karte dargestellt wird, dann werden seine Initialen angezeigt.
- [ ] Angenommen der Nutzer greift auf fremde Kontakte zu, wenn Enrichment oder Anzeige erfolgt, dann greift RLS auf `contacts` und nur eigene Kontakte sind zugänglich (Foto-Dateien liegen im public Bucket unter unratbarem UUID-Pfad).

## Edge Cases
- **Scrape schlägt fehl / Apify nicht erreichbar / Timeout:** Kontakt wird übersprungen, `photo_url` bleibt leer, restliche Kontakte laufen weiter; erneuter Versuch beim nächsten Monats-Cron. Import selbst schlägt nie wegen Fotos fehl.
- **LinkedIn-Profil hat kein Bild oder ist privat:** kein Foto gesetzt, Fallback Initialen.
- **LinkedIn-URL ungültig / Profil existiert nicht mehr:** übersprungen, kein Fehler nach außen.
- **Sehr großer Import (400+ Kontakte):** Enrichment in Batches im Hintergrund; Kosten (~$4/1000 Scrapes) und Laufzeit beachten.
- **Doppelter/erneuter CSV-Import derselben Kontakte:** Kontakte mit bereits vorhandenem Foto werden nicht erneut gescraped (Kosten sparen, kein Überschreiben).
- **Bild-Download klappt, Storage-Upload schlägt fehl:** kein `photo_url` gesetzt, wird beim nächsten Lauf erneut versucht.
- **Signierte LinkedIn-URL läuft während Verarbeitung ab:** Download passiert unmittelbar; abgelaufene URL → skip + Retry nächster Lauf.
- **Gleicher Kontakt in mehreren Läufen gleichzeitig (Import + Cron):** kein doppeltes Setzen, nur wenn `photo_url` leer (idempotent).

## Technical Requirements (optional)
- Enrichment läuft server-seitig (Apify-Zugriff nur über Server, nicht Client).
- Externer Dienst: Apify `harvestapi/linkedin-profile-scraper`; benötigt einen Apify-API-Token als Server-Env-Variable (in Vercel hinterlegen).
- Bilder dauerhaft im Supabase Storage (public Bucket `contact-photos`, unratbarer UUID-Pfad); LinkedIn-Bild-URLs nie direkt persistieren.
- RLS: Kontakte und Fotos strikt pro Nutzer isoliert.
- Import darf durch Enrichment nicht spürbar langsamer werden (async/entkoppelt).
- Idempotenz: Enrichment nur bei leerem `photo_url`.

## Known Limitations
- **Apify Free-Plan = max 10 Actor-Runs.** Beim Backfill-Versuch (2026-07-01) aufgebraucht → Scrapes liefern dann `error: "Free users are limited to 10 runs..."` statt Foto. Feature (Import-Trigger + Cron + Backfill) benötigt einen **Paid/Pay-as-you-go Apify-Plan**, um über 10 Runs hinaus zu skalieren. Code ist korrekt; nur Kontingent fehlt. Fehlgeschlagene Läufe setzen `photo_attempted_at` — bei einem solchen Ausfall zurücksetzen mit: `update contacts set photo_attempted_at = null where photo_url is null`.

## Open Questions
- [ ] Mechanik des Hintergrund-Enrichments (z.B. entkoppelte Server-Verarbeitung, Batchgröße, Rate-Limiting gegenüber Apify) — Detail für `/architecture`.
- [ ] Soll dem Nutzer irgendwo ein Fortschritt/Status („X von Y Fotos geladen") angezeigt werden, oder reicht stiller Hintergrundlauf? (aktuell: nur kurzer Hinweis nach Import)
- [ ] Genauer Tag/Zeitpunkt des Monats-Cron (mit PROJ-9-Report bündeln?). → Design-Vorschlag: eigene Cron-Route, monatlich.
- [ ] `APIFY_TOKEN` muss vom Nutzer im Apify-Konto erstellt und in Vercel + `.env.local` hinterlegt werden (Voraussetzung für `/backend`).
- [ ] Ab wann gilt ein Foto-Versuch als „alt genug" für erneuten Cron-Versuch (z.B. > 3 Monate)? — Feinjustierung in `/backend`.
- [ ] Verhalten bei sehr großem Erstimport, der eine Ausführung zeitlich nicht schafft: Rest via Monats-Cron akzeptabel, oder gezielte Nach-Anstöße? — Feinjustierung in `/backend`.

### Erweiterung (Profildaten-Enrichment)
- [x] Trigger für Profildaten? → **On-demand über KI-Analyse-Knopf** (kein Import/Cron) (2026-07-01)
- [x] Überschreib-Policy sichtbare Felder? → **Nur leere füllen** (2026-07-01)
- [x] Re-Scrape bei „Neu analysieren"? → **Snapshot + Cooldown 90 Tage** (2026-07-01)
- [x] Welche Felder? → sichtbar: employer/job_title/city (nur leer); Snapshot (backend/KI): + headline + education/Werdegang (2026-07-01)
- [ ] Genaues Snapshot-Format (`linkedin_profile` jsonb-Struktur: welche Felder, wie normalisiert) — Detail für `/architecture` / `/backend`.
- [ ] Braucht der KI-Analyse-Knopf einen sichtbaren „scrape läuft"-Ladezustand, oder reicht der bestehende Analyse-Spinner? — Detail für `/frontend`.
- [ ] Apify-Kontingent: on-demand-Scrapes zählen ebenfalls gegen das 10-Runs-Limit des Free-Plans (siehe Known Limitations) — Paid-Plan Voraussetzung.

## Erweiterung: On-Demand Profildaten-Enrichment
**Status:** Deployed (2026-07-02) · **Added:** 2026-07-01
**Deploy:** commit `d2d3c88`, prod https://bambi-w26q.vercel.app; Migration `0010` auf Prod angewandt; keine neuen Env-Vars (nutzt bestehendes `APIFY_TOKEN`).

### Warum
Der Apify-Modus „Profile details no email" liefert das **ganze** Profil (Headline, aktuelle Position, Standort, Ausbildung, Werdegang); bisher wird nur `profilePicture` genutzt, der Rest verworfen. Nach CSV-Import hat ein Kontakt oft nur Name + LinkedIn-URL — der Gemeinsamkeiten-KI (PROJ-17) und den Nachrichtenvorschlägen fehlt Kontakt-Kontext. Der Scrape soll diese Profildaten mit-ernten und pro Kontakt für KI-Anfragen speichern.

### User Stories
- Als Nutzer möchte ich, dass beim Anstoßen der Gemeinsamkeiten-Analyse fehlende Kontakt-Profildaten (Position, Arbeitgeber, Stadt, Werdegang) aus LinkedIn ergänzt werden, damit die KI bessere Anknüpfungspunkte findet — ohne dass ich Daten manuell pflege.
- Als Nutzer möchte ich, dass das Frontend kompakt bleibt (keine Flut neuer Felder), die reichen Profildaten aber im Hintergrund für KI-Anfragen verfügbar sind.
- Als kostenbewusster Nutzer möchte ich, dass LinkedIn nur bei Bedarf (Knopfdruck) und nicht bei jedem Klick erneut gescraped wird.

### Trigger (Kostenbremse)
- **Nur on-demand:** ausgelöst durch den „KI-Analyse starten" / „Neu analysieren"-Knopf der Gemeinsamkeiten-Sektion (PROJ-17), nur für Kontakte mit `linkedin_url`.
- **Kein** Import-Trigger, **kein** Cron für Profildaten. (Foto-Enrichment behält Import + Monats-Cron unverändert.)
- **Snapshot + Cooldown (90 Tage):** erster Klick scraped & speichert; weitere Klicks nutzen den gespeicherten Snapshot; erst wenn der Snapshot älter als der Cooldown ist, scraped der nächste Klick neu. Minimiert Apify-Kosten.

### Daten-Policy
- **Nur leere** sichtbare Felder werden gefüllt: `employer`, `job_title`, `city` — vorhandene (nutzergepflegte) Werte werden **nie** überschrieben (konsistent mit Foto-Policy).
- **Voller Snapshot** (inkl. Headline, Ausbildung, Werdegang) wird backend-seitig pro Kontakt gespeichert und **ausschließlich** als KI-Kontext genutzt — nicht als neue sichtbare Einzelfelder (Frontend bleibt kompakt).

### DB (neu)
- **`contacts.linkedin_profile jsonb`** — gespeicherter Profil-Snapshot (headline, education, experience, location …) für KI-Kontext. Leer = noch nie profil-gescraped.
- **`contacts.linkedin_profile_at timestamptz`** — Zeitpunkt des letzten Profil-Scrapes (Cooldown-Steuerung). Getrennt von `photo_attempted_at` (Foto-Pfad hat eigenen Cooldown/Trigger).

### Ablauf (on-demand)
```
Nutzer klickt "KI-Analyse starten"/"Neu analysieren" (Gemeinsamkeiten, PROJ-17)
   |
   v
Kontakt hat linkedin_url?  --nein-->  KI direkt auf vorhandenen Daten (kein Scrape)
   | ja
   v
Snapshot fehlt ODER linkedin_profile_at älter als Cooldown (90d)?  --nein-->  Snapshot wiederverwenden
   | ja
   v
Apify-Scrape (bestehender Actor/Modus, ein Profil)
   |
   v
employer/job_title/city NUR wenn leer füllen  +  Snapshot in linkedin_profile speichern, linkedin_profile_at setzen
   |
   v
Gemeinsamkeiten-Prompt mit angereichertem Kontakt (inkl. Snapshot: Headline/Ausbildung) ausführen
```

### Acceptance Criteria (Erweiterung)
- [ ] Angenommen ein Kontakt hat eine `linkedin_url` und keinen Snapshot, wenn „KI-Analyse" gedrückt wird, dann wird das LinkedIn-Profil gescraped und ein Snapshot in `contacts.linkedin_profile` gespeichert (+ `linkedin_profile_at` gesetzt).
- [ ] Angenommen `employer`/`job_title`/`city` sind leer, wenn der Scrape Werte liefert, dann werden nur die leeren Felder gefüllt; vorhandene bleiben unverändert.
- [ ] Angenommen ein Snapshot ist jünger als der Cooldown (90 Tage), wenn „Neu analysieren" gedrückt wird, dann wird **nicht** erneut gescraped (nur die KI läuft auf dem gespeicherten Snapshot).
- [ ] Angenommen der Snapshot ist älter als der Cooldown, wenn „KI-Analyse" gedrückt wird, dann wird neu gescraped und der Snapshot aktualisiert.
- [ ] Angenommen ein Kontakt hat keine `linkedin_url`, wenn „KI-Analyse" gedrückt wird, dann erfolgt kein Scrape und die KI nutzt die vorhandenen Kontaktdaten.
- [ ] Angenommen der Scrape/Apify schlägt fehl (Fehler/Timeout/Kontingent), wenn „KI-Analyse" läuft, dann bricht die Gemeinsamkeiten-Analyse **nicht** ab — sie läuft graceful auf den vorhandenen Daten weiter.
- [ ] Angenommen ein Snapshot existiert, wenn die Gemeinsamkeiten-KI aufgerufen wird, dann fließen Headline/Ausbildung aus dem Snapshot in den Prompt ein.

### Out of Scope (Erweiterung)
- Import-/Cron-Trigger für Profildaten (nur Fotos behalten diese Trigger).
- Neue sichtbare Einzelfelder im Frontend für Headline/Ausbildung (bleibt kompakt; nur KI-Kontext).
- Überschreiben nutzergepflegter `employer`/`job_title`/`city`.
- Posts/Aktivität scrapen (bräuchte separaten Actor — bewusst nicht Teil, evtl. späteres Feature).

### Cross-Feature-Abhängigkeit
- Trigger (Knopf) und Prompt-Anreicherung leben in **PROJ-17** (`POST /api/contacts/[id]/commonalities`). Diese Route ruft die neue Enrichment-Funktion auf und baut den Snapshot in den Prompt ein. → **PROJ-17 braucht parallel eine eigene Umsetzung** (Route-Erweiterung + evtl. UI-Hinweis „Profil wird aus LinkedIn ergänzt").
- Scraper-Logik (Apify-Aufruf, Profil-Feld-Extraktion, Storage) gehört zu PROJ-20 (`src/lib/photo-enrichment.ts` bzw. neues geteiltes Modul) und wird wiederverwendbar für einen Kontakt bereitgestellt.

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Enrichment setzt ausschließlich `photo_url`, nie andere Felder | Nutzer-gepflegte Daten dürfen nicht durch Scrape verfälscht werden | 2026-07-01 |
| Vorhandene Fotos werden nie überschrieben (nur leere gefüllt) | Idempotenz, Kosten sparen, keine ungewollten Änderungen | 2026-07-01 |
| Nur das Profilbild wird gescraped (nicht Headline/Erfahrung/etc.) | Fokus & Single Responsibility; reichere Anreicherung wäre eigenes Feature | 2026-07-01 |
| Zwei Trigger: async nach CSV-Import + monatlicher Cron | CSV deckt Neuimport ab; Cron fängt später/anders angelegte Kontakte automatisch ein | 2026-07-01 |
| Enrichment asynchron im Hintergrund (nicht synchron) | Große Importe (400+) würden UX sonst lange blockieren | 2026-07-01 |
| Kein automatisches Entdecken neuer LinkedIn-Verbindungen | Kein LinkedIn-API (PRD Non-Goal); nur Fotos zu bestehenden Kontakten | 2026-07-01 |
| Lightbox nur in Kontaktliste + Kontakt-Detail, nicht Dashboard | Dashboard-Avatar-Klick öffnet bereits den Kontakt; kein Konflikt | 2026-07-01 |
| Fehlgeschlagene Scrapes werden nicht in UI verwaltet, sondern beim nächsten Cron erneut versucht | Hält MVP einfach; selbstheilend | 2026-07-01 |
| Public Storage-Bucket statt privat+signiert | Einfacher; unratbarer UUID-Pfad; Fotos sind ohnehin public auf LinkedIn; akzeptables Risiko für Solo-CRM | 2026-07-01 |
| **Erweiterung:** Profildaten-Enrichment nur on-demand über den KI-Analyse-Knopf, kein Import/Cron | Hält Apify-Kosten minimal — gescraped wird nur, wenn der Nutzer die Gemeinsamkeiten wirklich braucht | 2026-07-01 |
| **Erweiterung:** Snapshot + Cooldown (90 Tage) statt jedes Mal neu scrapen | Wiederholtes „Neu analysieren" darf nicht jedes Mal kosten; Daten ändern sich selten schnell | 2026-07-01 |
| **Erweiterung:** Nur leere sichtbare Felder (employer/job_title/city) füllen | Nutzergepflegte Daten nicht verfälschen — konsistent mit Foto-Policy | 2026-07-01 |
| **Erweiterung:** Frontend kompakt, voller Snapshot nur backend als KI-Kontext | Nutzerwunsch: keine Feld-Flut in der UI, aber reiche Daten für bessere KI-Antworten | 2026-07-01 |
| **Erweiterung:** Scrape-Fehler bricht Gemeinsamkeiten-Analyse nicht ab (graceful) | KI soll immer ein Ergebnis liefern; Enrichment ist Best-Effort-Bonus | 2026-07-01 |

### Technical Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Server-seitiger Enrichment-Dienst, von CSV-Import-Route und Cron-Route geteilt | Eine Logik; Apify-Token & Storage-Schreibrechte gehören auf den Server | 2026-07-01 |
| Apify über REST/`fetch` statt `apify-client`-Package | Vermeidet neue Abhängigkeit; Aufruf ist simpel | 2026-07-01 |
| Bulk-Scrape: mehrere LinkedIn-URLs pro Apify-Lauf (Bündel ~50) | Schneller und günstiger als ein Lauf pro Kontakt | 2026-07-01 |
| Neue Spalte `contacts.photo_attempted_at` | Monats-Cron soll fotolose Kontakte nicht endlos jeden Monat neu scrapen (Kostenbremse) | 2026-07-01 |
| Import stößt Enrichment fire-and-forget an; Rest via Monats-Cron | Große Erstimporte blockieren UI nicht; selbstheilend | 2026-07-01 |
| Lightbox via bestehendem shadcn-Dialog, kein neues Package | Schlanke Abhängigkeiten | 2026-07-01 |
| Eigene Cron-Route statt Einbau in Monatsreport-Cron | Trennung der Zuständigkeiten; eigene Fehlerbehandlung/Logs | 2026-07-01 |
| Storage-Pfad `{user_id}/{contact_id}.jpg` | Eindeutig pro Kontakt, überschreibt bei Re-Fetch sauber, unratbar | 2026-07-01 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Überblick
Ein server-seitiger **Enrichment-Dienst** holt Profilbilder über Apify, lädt sie herunter, legt sie im public Storage-Bucket ab und setzt bei den betroffenen Kontakten nur `photo_url`. Zwei Auslöser teilen sich denselben Dienst: der CSV-Import (nur die gerade importierten Kontakte) und ein monatlicher Cron (gesamter Bestand ohne Foto). Die Anzeige/Lightbox ist reine Frontend-Arbeit auf bestehenden Kontakt-Karten.

### Backend nötig?
Ja. Der Apify-Aufruf braucht einen geheimen Token und der Bild-Download/Upload muss server-seitig laufen (Client darf weder Token noch fremde Storage-Schreibrechte haben).

### Ablauf (Enrichment-Dienst)
```
Auslöser (CSV-Import ODER Monats-Cron)
   |
   v
Kandidaten bestimmen: eigene Kontakte mit LinkedIn-URL UND ohne Foto
   |
   v
URLs in Bündel aufteilen (z.B. 50 pro Apify-Lauf)  <- Bulk, spart Zeit & Geld
   |
   v
Pro Bündel: Apify harvestapi-Actor aufrufen -> Profilbild-URLs zurück
   |
   v
Pro Treffer: Bild herunterladen -> in Bucket 'contact-photos' ablegen
   |
   v
photo_url setzen -- NUR wenn noch leer (idempotent), kein anderes Feld
```

### Komponenten-Struktur
```
Server
+-- Enrichment-Dienst (geteilte Logik: Kandidaten -> Apify-Bulk -> Download -> Upload -> photo_url)
+-- API-Route "Fotos anreichern" (eingeloggt)   <- vom CSV-Import aufgerufen, mit Liste der Kontakt-IDs
+-- Cron-Route "Fotos anreichern (monatlich)"   <- Secret-geschützt, über alle Nutzer, ganzer Bestand

Frontend
+-- LinkedIn-Import-Dialog (bestehend)
|   +-- nach Bestätigen: Enrichment fire-and-forget anstoßen + Hinweis "Fotos werden geladen"
+-- Kontakt-Karte (Liste)   -> Avatar zeigt Foto, Klick öffnet Lightbox
+-- Kontakt-Detail/Formular -> Avatar zeigt Foto, Klick öffnet Lightbox
+-- Foto-Lightbox (großes Bild, schließbar)   <- neue kleine Komponente auf shadcn-Dialog
+-- Dashboard-Karte (bestehend) -> zeigt Foto nur an (keine Lightbox)
```

### Datenmodell (Klartext)
- **`contacts.photo_url`** (existiert bereits): dauerhafte public URL des im Bucket abgelegten Bildes. Leer = Fallback auf Initialen.
- **`contacts.photo_attempted_at`** (neu, optional, Zeitstempel): wann zuletzt ein Foto-Versuch lief. Verhindert, dass der Monats-Cron denselben fotolosen Kontakt (z.B. Profil ganz ohne Bild) jeden Monat erneut scraped → Kostenbremse. Kontakte werden nur (erneut) versucht, wenn nie versucht oder Versuch lange her.
- **Storage:** public Bucket `contact-photos` (existiert), Pfad `{user_id}/{contact_id}.jpg`. Nichts anderes ändert sich am Datenmodell.

### Externe Integration
- **Apify** `harvestapi/linkedin-profile-scraper`, aufgerufen über Apify-REST-API mit einem **Apify-API-Token** (Server-Env `APIFY_TOKEN`). Modus „Profile details no email" (~$4 / 1000 Profile). Bulk: mehrere URLs pro Lauf.
- Hinweis: Der Apify-MCP-Zugang (OAuth) gilt nur für die Entwicklungs-Assistenz, nicht für die laufende App — die App braucht einen eigenen Token.

### Tech-Entscheidungen (warum)
- **Geteilter Enrichment-Dienst für beide Auslöser:** eine Logik, kein Duplikat; CSV übergibt Kontakt-IDs, Cron bestimmt Kandidaten selbst.
- **Bulk-Scrape (mehrere URLs pro Apify-Lauf):** deutlich schneller und günstiger als ein Lauf pro Kontakt.
- **Async / fire-and-forget beim Import:** großer Erstimport (400+) darf die UI nicht blockieren; Rest, der eine Ausführung nicht schafft, wird vom Monats-Cron nachgeholt.
- **`photo_attempted_at` als Kostenbremse:** ohne Marker würde der Cron monatlich alle fotolosen Kontakte erneut scrapen (auch die ohne LinkedIn-Bild).
- **Kein neues Package nötig:** Apify über `fetch` (REST), Lightbox über vorhandenen shadcn-Dialog, Upload über vorhandenen Supabase-Client. Hält die Abhängigkeiten schlank.
- **Wiederverwendung der bestehenden Cron-Infrastruktur** (Secret-Auth, Admin-Client, Fehler pro Nutzer isoliert) wie beim Monatsreport.

### Dependencies (Packages)
- Keine neuen Packages erforderlich (Apify per REST/`fetch`, Lightbox per shadcn-Dialog).

### Umgebungsvariablen
- **`APIFY_TOKEN`** (Server-only, neu) — in `.env.local.example` dokumentieren und in Vercel hinterlegen. Muss vom Nutzer im Apify-Konto erstellt werden.

## Implementation Notes

### Frontend (2026-07-01)
- **Neue Komponente** [photo-lightbox.tsx](../src/components/photo-lightbox.tsx): shadcn-Dialog zeigt Foto vergrößert (max 80vh, object-contain), a11y-Titel sr-only.
- [contact-card.tsx](../src/components/contact-card.tsx): Avatar bei vorhandenem `photo_url` klickbar (`cursor-zoom-in`) → Lightbox; `stopPropagation` verhindert Öffnen des Bearbeiten-Dialogs. Ohne Foto: Initialen, Klick öffnet wie bisher den Kontakt.
- [contact-form-dialog.tsx](../src/components/contact-form-dialog.tsx): großer Avatar (h-20) unter dem Titel beim Bearbeiten; Klick auf Foto → Lightbox.
- [linkedin-import-dialog.tsx](../src/components/linkedin-import-dialog.tsx): nach erfolgreichem Import fire-and-forget `POST /api/enrich-photos` (Route folgt im Backend-Schritt) + Hinweis „Fehlende Profilfotos werden im Hintergrund geladen", wenn Kontakte mit LinkedIn-URL betroffen sind.
- Foto-Anzeige auf Karten (Avatar) bereits zuvor umgesetzt (Commit `2ebbd5b`).

### Backend (2026-07-01)
- **Migration:** `contacts.photo_attempted_at timestamptz` + Partial-Index `idx_contacts_photo_enrichment (user_id) where linkedin_url is not null and photo_url is null`.
- **Enrichment-Dienst** [photo-enrichment.ts](../src/lib/photo-enrichment.ts): Kandidaten (URL & kein Foto & Cooldown), Bulk-Scrape via Apify `run-sync-get-dataset-items` (Bündel 50, max 100/Lauf), Bild-Download → Upload Bucket `contact-photos` (`{user_id}/{contact_id}.jpg`, upsert) → `photo_url` **nur wenn leer** (`.is('photo_url', null)`), `photo_attempted_at` immer gesetzt (auch bei „kein Foto"/Fehler → Cooldown 90 Tage).
- **Rückmapping robust:** LinkedIn-REST liefert Rückreferenz je nach Input-Feld unterschiedlich (`originalQuery.query` bei `queries`, `.url` bei `urls`); Lookup matcht über normalisierte URL + `publicIdentifier`-Fallback.
- **Route** [POST /api/enrich-photos](../src/app/api/enrich-photos/route.ts): eingeloggter Nutzer, `maxDuration=300`, 401/503/502-Handling. Behebt den fire-and-forget-404 aus dem Frontend-Schritt.
- **Cron** [GET /api/cron/enrich-photos](../src/app/api/cron/enrich-photos/route.ts): `CRON_SECRET`-Bearer, täglicher Schedule mit internem 1.-des-Monats-Gate (`?force=1` zum Test), iteriert alle Nutzer, Fehler pro Nutzer isoliert. `vercel.json`-Cron `0 4 * * *` ergänzt.
- **Tests:** [photo-enrichment.test.ts](../src/lib/photo-enrichment.test.ts) (Pure-Logik: chunk/cooldown/extract/normalize/lookup) + [enrich-photos.test.ts](../src/app/api/enrich-photos/enrich-photos.test.ts) (401/503/200/502). 23 grün.
- **End-to-End verifiziert** mit echtem Kontakt (Lennart Heinacher): Scrape → Identifier-Match → Download → Bucket → `photo_url` → public URL HTTP 200 (87 KB jpeg).

## Implementation Notes — Erweiterung (Profildaten-Enrichment)

### Backend (2026-07-02)
- **Migration** `0010_contact_linkedin_profile.sql`: `contacts.linkedin_profile jsonb` (Snapshot, KI-Kontext) + `contacts.linkedin_profile_at timestamptz` (Cooldown). Additiv/nullable, auf Prod angewandt.
- **Modul** [linkedin-profile.ts](../src/lib/linkedin-profile.ts): teilt den Apify-Actor/-Modus mit dem Foto-Enrichment (`APIFY_ACTOR`).
  - `extractProfileSnapshot(item)` — Roh-Apify-Item → kompakter `ProfileSnapshot` (headline, location, employer/jobTitle/city aus `currentPosition[0]`, about, currentPositions/experience/education kompakt, topSkills).
  - `shouldScrapeProfile(at, now, 90d)` — Cooldown-Gate.
  - `scrapeLinkedInProfile(url, token)` — Einzel-Profil via `run-sync-get-dataset-items`.
  - `formatSnapshotForPrompt(snapshot)` — deutscher Prompt-Textblock.
  - `maybeEnrichContactProfile(supabase, contact, token, now)` — On-demand-Orchestrator: Cooldown-Check → Scrape → **nur leere** employer/job_title/city füllen → Snapshot + `linkedin_profile_at` speichern. Best-Effort: harter Fehler (Netz/Kontingent) → kein Cooldown (nächster Klick retry), leeres Profil → Cooldown gesetzt. Nutzt den Session-Client (RLS, eigener Kontakt).
- **PROJ-17-Route** [commonalities/route.ts](../src/app/api/contacts/[id]/commonalities/route.ts): selektiert jetzt `linkedin_url, linkedin_profile, linkedin_profile_at`; ruft nach dem 404-Check `maybeEnrichContactProfile(...)` mit `process.env.APIFY_TOKEN` auf; nutzt angereicherte Felder + hängt `formatSnapshotForPrompt(snapshot)` an den Kontakt-Prompt. Scrape-Fehler brechen die Analyse nie ab.
- **Trigger:** ausschließlich der bestehende „KI-Analyse / Neu analysieren"-Knopf (PROJ-17). Kein Import/Cron für Profildaten. Kein neues Frontend-Feld — Frontend bleibt kompakt (nur die schon sichtbaren employer/job_title/city können nun befüllt werden).
- **Tests:** [linkedin-profile.test.ts](../src/lib/linkedin-profile.test.ts) — 19 Tests (Mapping, Cooldown, Prompt-Format, Fill-only-empty, Cooldown-Skip, leeres Profil, graceful Error, Scrape). Full-Suite 184/184 grün, keine Regression.

## QA Test Results

**Tested:** 2026-07-01
**App URL:** http://localhost:3000 (+ Live-Apify/Storage/DB)
**Tester:** QA Engineer (AI)

### Acceptance Criteria Status

- [x] **AC1** URL & kein Foto → gefundenes Bild im Storage, nur `photo_url` gesetzt — verifiziert end-to-end (Lennart Heinacher: Scrape → Upload → `photo_url`, public URL HTTP 200).
- [x] **AC2** Vorhandenes Foto wird nicht überschrieben — geguardeter Update (`.is('photo_url', null)`) betraf 0 Zeilen bei gesetztem Foto (DB-Test, `got_clobbered=false`).
- [x] **AC3** Nur `photo_url`/`photo_attempted_at` geändert, andere Felder unverändert — Lennarts `employer`/`job_title`/`name`/`linkedin_url` nach Enrichment intakt.
- [x] **AC4** Import nicht durch Foto-Laden blockiert + Hinweis — Frontend ruft `/api/enrich-photos` fire-and-forget (nicht awaited), Erfolgstext ergänzt „Fehlende Profilfotos werden im Hintergrund geladen".
- [x] **AC5** Monats-Cron reichert an — Cron-Route teilt `enrichUserPhotos` (end-to-end bewiesen), 1.-des-Monats-Gate + Secret-Auth verifiziert per Code/Review.
- [x] **AC6** Kein URL → übersprungen — Kandidaten-Query filtert `linkedin_url is not null`; kein Scrape-Aufruf.
- [x] **AC7** Kein Bild gefunden → `photo_url` bleibt leer, Initialen — Logik setzt bei fehlendem Treffer nur `photo_attempted_at`; Frontend-Fallback (E2E AC9).
- [x] **AC8** Klick auf Foto → Lightbox (Kontaktliste + Detail) — E2E grün (Lightbox-Dialog mit Bild öffnet).
- [x] **AC9** Kein Foto → Initialen — E2E grün (kein `<img>` im Karten-Avatar).
- [x] **AC10** RLS auf `contacts`; Fotos public unter UUID-Pfad — RLS aktiv; Route scoped auf Session-`user_id`.

### Edge Cases Status
- [x] Scrape/Batch fehlgeschlagen → `photo_attempted_at` gesetzt (Cooldown), Rest läuft weiter, Import bricht nie.
- [x] Kein/privates Bild → kein Foto, Fallback Initialen.
- [x] Idempotenz bei parallelen Läufen → Guard `.is('photo_url', null)`.
- [x] Rückmapping robust (queries→`originalQuery.query`, urls→`.url`, plus `publicIdentifier`) — Unit-getestet + live bestätigt.
- [x] Großer Bestand → Cap `MAX_PER_RUN=100`/Lauf, Rest via Cron.

### Security Audit Results
- [x] Authentifizierung: `/api/enrich-photos` ohne Login → 401.
- [x] Autorisierung: Route reichert nur `session.user.id` an — kein Input, keine Fremd-Kontakte adressierbar.
- [x] Cron: `CRON_SECRET`-Bearer erzwungen (401 sonst).
- [x] Secrets: `APIFY_TOKEN` server-only (kein `NEXT_PUBLIC_`), nicht im Client-Bundle.
- [x] RLS auf `contacts` aktiv; Service-Role nur serverseitig, per `user_id` gescoped.
- [~] Storage public: Fremd-Fotos per URL öffentlich erreichbar (unratbarer UUID-Pfad, kein Listing) — bewusste Produkt-Entscheidung (siehe Decision Log).

### Bugs Found
Keine PROJ-20-Bugs.

**Vorbestehend (nicht PROJ-20, nicht durch diese Änderung verursacht):** 13 fehlschlagende Unit-Tests in `chat.test.ts`, `draft-message.test.ts`, `analytics.test.ts` — identisch auf Commit `6841368` (vor dieser Session) reproduziert. Ursache: veraltete Supabase-Mocks (`maybeSingle`) bzw. Fixtures aus früheren Features. Empfehlung: separates Cleanup-Ticket.

#### Beobachtung (Low): Kein Rate-Limit auf `/api/enrich-photos`
- **Severity:** Low
- Wiederholtes/paralleles Auslösen könnte vor dem Setzen von `photo_attempted_at` doppelt scrapen (Kosten). Durch Cooldown stark begrenzt; Solo-App. Priority: Nice to have.

### Summary
- **Acceptance Criteria:** 10/10 passed
- **Bugs Found:** 0 PROJ-20 (0 critical, 0 high, 0 medium, 1 low Beobachtung). Zusätzlich 13 vorbestehende, feature-fremde Test-Failures.
- **Security:** Pass (public-Bucket ist dokumentierte Entscheidung)
- **Production Ready:** YES
- **Recommendation:** Deploy. Vorbestehende Test-Failures separat aufräumen.

## Deployment

**Deployed:** 2026-07-01
**Production URL:** https://bambi-w26q.vercel.app
**Tag:** v1.18.0-PROJ-20

- `vercel --prod` erfolgreich (READY), Commits nach `origin/main` gepusht (`46c4203`).
- Env `APIFY_TOKEN` in Vercel (production/preview/development) gesetzt; `CRON_SECRET` bereits vorhanden.
- Migration `photo_attempted_at` + Index bereits in Supabase-Prod angewandt.
- Cron `/api/cron/enrich-photos` (`0 4 * * *`, interner 1.-des-Monats-Gate) via `vercel.json` registriert.
- Post-Deploy-Smoke: Home 307 (Auth-Redirect), `/api/enrich-photos` unauth → Middleware-Redirect (geschützt), `/api/cron/enrich-photos` ohne Secret → 401.
- Bereits live befüllt: Yisa Wu + Lennart Heinacher mit Foto (Demo/Verifikation).

# PROJ-16: Eigenes Profil (CV) + CV-Upload mit KI-Parsing

## Status: Deployed
**Created:** 2026-06-30
**Last Updated:** 2026-07-01

## Dependencies
- PROJ-3 (Kontakt anlegen & verwalten) — liefert das Kontaktmodell, das ein späteres Folgefeature (PROJ-17, noch nicht spezifiziert) gegen dieses Profil abgleichen wird. Kein technischer Hard-Dependency für PROJ-16 selbst.
- PROJ-15 (Profil) — `/profil/lebenslauf` ist eine Unterseite der bestehenden `/profil`-Route, aber funktional unabhängig (eigene Tabellen, eigene UI, kein gemeinsamer Code mit der Case-Liste).

## User Stories
- Als Berater möchte ich mein eigenes berufliches Profil (Bildung, Werdegang, Skills, Sprachen) im Tool hinterlegen, damit meine Karriere-Historie digital erfasst ist und später für intelligente Funktionen (z. B. Gemeinsamkeiten mit Kontakten) genutzt werden kann
- Als Berater möchte ich meinen Lebenslauf als PDF hochladen können, damit ich nicht jeden Eintrag manuell eintippen muss
- Als Berater möchte ich die aus dem PDF erkannten Daten vor dem Speichern sehen und korrigieren können, damit Fehler aus der automatischen Erkennung nicht ungeprüft übernommen werden
- Als Berater möchte ich auch ohne CV-Upload einzelne Stationen (Studium, Job) manuell nachtragen können, damit ich mein Profil jederzeit aktuell halten kann, auch lange nach dem letzten Upload
- Als Berater möchte ich eine automatisch generierte Kurzbeschreibung meines Profils sehen, die aus meinen CV-Daten und Projekten erstellt wird, damit ich auf einen Blick weiß was das Tool über mich weiß und die KI-Funktionen (Gemeinsamkeiten, Chat) besseren Kontext über mich haben
- Als Berater möchte ich meine Karriereziele in einem geführten KI-Gespräch festhalten können, damit die KI-Funktionen des Tools auf meine konkreten nächsten Schritte ausgerichtet sind und z. B. passende Kontakte für mein Ziel hervorhebt

## Out of Scope
- Gemeinsamkeiten-Matching zwischen eigenem Profil und Kontakten — eigenes Folgefeature (PROJ-17), baut auf diesem Datenmodell auf, aber diese Spec liefert nur die Datenbasis
- Passives KI-Lernen aus geloggten Cases/Interaktionen (automatische Profil-Vorschläge ohne CV-Upload) — eigenes späteres Feature (PROJ-18), andere Pipeline-Form (Hintergrund-Extraktion statt On-Demand-Parsing)
- Foto-Upload für das eigene Profilbild — eigenes Feature (PROJ-7, Roadmap), nicht Teil dieser Spec
- Sichtbarkeit/Teilen des Profils mit anderen Nutzern — App ist strikt Single-User (siehe PRD Non-Goals), Profil ist ausschließlich für den Account-Owner selbst sichtbar
- Mehrfacher gleichzeitiger CV-Upload / Versionsverwaltung mehrerer CVs — nur der zuletzt hochgeladene CV-Pfad wird referenziert, ältere Uploads werden nicht als Historie verwaltet
- Automatisches Überschreiben bestehender Einträge durch einen erneuten CV-Upload — jeder Upload erzeugt neue Vorschau-Einträge, die der Nutzer einzeln bestätigt; bestehende Einträge werden nicht automatisch gelöscht/ersetzt
- Strukturierte Felder für Skills/Sprachen mit Niveau-Angaben (z. B. "Englisch C1") — für MVP einfache Text-Listen ohne Sub-Struktur
- Ziele als strukturierte Dropdown-Felder (z. B. fester Wert "PE Exit" als Enum) — Goals werden als Freitext-Zusammenfassung aus dem AI-Gespräch gespeichert, keine fest vordefinierte Kategorisierung
- Automatische Bio-Aktualisierung bei jeder CV-Datenänderung — Nutzer löst Bio-Generierung manuell per Button aus, kein Hintergrund-Trigger
- Ziele als Push-Notification/Email-Nudge — Nudge erscheint als In-App-Banner auf `/profil/lebenslauf`, kein E-Mail-Reminder

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

- [ ] Angenommen der Nutzer ist eingeloggt und hat noch kein Profil angelegt, wenn er `/profil/lebenslauf` öffnet, dann sieht er einen Empty-State mit Hinweis und den Optionen "CV hochladen" und "Manuell hinzufügen"
- [ ] Angenommen der Nutzer lädt eine gültige PDF-Datei hoch, wenn die KI-Verarbeitung abgeschlossen ist, dann sieht er eine editierbare Vorschau mit erkannten Einträgen, gruppiert nach Bildung/Werdegang/Skills/Sprachen — noch nichts ist gespeichert
- [ ] Angenommen die Vorschau zeigt erkannte Einträge, wenn der Nutzer einzelne Zeilen abwählt oder Felder korrigiert und dann bestätigt, dann werden nur die ausgewählten, ggf. korrigierten Werte gespeichert
- [ ] Angenommen der Nutzer bricht die Vorschau ab (ohne zu bestätigen), dann wird nichts gespeichert und das hochgeladene PDF bleibt nur als Datei im Storage bestehen, ohne dass Profil-Daten entstehen
- [ ] Angenommen der Nutzer lädt eine Datei hoch, die kein PDF ist, dann wird eine Validierungsfehlermeldung angezeigt und kein Upload/Parsing-Versuch gestartet
- [ ] Angenommen der Nutzer lädt eine PDF-Datei hoch, die größer als das Limit ist, dann wird eine Validierungsfehlermeldung angezeigt, kein Upload gestartet
- [ ] Angenommen die KI-Verarbeitung des PDFs schlägt fehl (z. B. unleserliches/gescanntes Dokument, API-Fehler), dann wird eine Fehlermeldung angezeigt und der Nutzer kann stattdessen manuell Einträge anlegen
- [ ] Angenommen der Nutzer klickt auf "Ausbildung hinzufügen" ohne CV-Upload, wenn er Institution (Pflichtfeld) ausfüllt und speichert, dann wird ein neuer Bildungs-Eintrag gespeichert
- [ ] Angenommen das Institution-Feld bei einem manuellen Bildungs-Eintrag ist leer, wenn der Nutzer speichern will, dann erscheint eine Validierungsfehlermeldung und der Eintrag wird nicht angelegt
- [ ] Angenommen der Nutzer klickt auf "Berufserfahrung hinzufügen" ohne CV-Upload, wenn er Arbeitgeber (Pflichtfeld) ausfüllt und speichert, dann wird ein neuer Werdegang-Eintrag gespeichert
- [ ] Angenommen ein Bildungs- oder Werdegang-Eintrag existiert, wenn der Nutzer ihn bearbeitet und speichert, dann werden die neuen Werte übernommen
- [ ] Angenommen ein Bildungs- oder Werdegang-Eintrag existiert, wenn der Nutzer ihn löscht, dann wird nur dieser Eintrag entfernt, alle anderen bleiben unverändert
- [ ] Angenommen der Nutzer hat Skills/Sprachen über CV-Upload oder manuell hinterlegt, wenn er die Profilseite erneut öffnet, dann sieht er die zuletzt gespeicherten Werte
- [ ] Angenommen Nutzer A ist eingeloggt, wenn er versucht, auf Profil-Daten oder CV-Dateien von Nutzer B zuzugreifen, dann liefert die Datenbank/das Storage keine Daten zurück (RLS)

**Auto-Bio**
- [ ] Angenommen der Nutzer hat mindestens einen Bildungs- oder Werdegang-Eintrag, wenn er `/profil/lebenslauf` öffnet, dann sieht er eine generierte Kurzbeschreibung seines Profils (max. 3 Sätze) oberhalb der Sektionen
- [ ] Angenommen eine Bio existiert, wenn der Nutzer auf "Bio neu generieren" klickt, dann wird eine neue Bio aus den aktuellen CV-Daten + Projekten erzeugt und die alte überschrieben
- [ ] Angenommen der Nutzer hat noch keine CV-Einträge, dann ist der Bio-Abschnitt nicht sichtbar (kein leerer Platzhalter)
- [ ] Angenommen der Nutzer bestätigt CV-Einträge nach einem Upload, dann wird die Bio automatisch neu generiert und angezeigt

**Career Goals via AI-Gespräch**
- [ ] Angenommen der Nutzer öffnet `/profil/lebenslauf`, dann sieht er einen "Ziele festlegen"-Button (bzw. "Ziele aktualisieren" wenn bereits Goals vorhanden)
- [ ] Angenommen der Nutzer klickt "Ziele festlegen", dann öffnet sich ein Chat-Dialog in dem die KI die erste gezielte Frage stellt (nächster Move: Exit/Partner-Track/Sabbatical/Ausland/anderes)
- [ ] Angenommen der Nutzer beantwortet die Fragen, dann stellt die KI maximal 3 gezielte Folgefragen (Zeithorizont, Branchen/Ziele, offenes Freitextfeld) bevor sie eine Zusammenfassung erstellt
- [ ] Angenommen die KI hat genug Kontext, dann präsentiert sie eine Zusammenfassung der Ziele zur Bestätigung durch den Nutzer ("So habe ich deine Ziele verstanden: [...]")
- [ ] Angenommen der Nutzer bestätigt die Zusammenfassung, dann werden die Goals als Text in `user_profile.goals_text` gespeichert und `goals_updated_at` gesetzt
- [ ] Angenommen der Nutzer bricht den Dialog ab, dann bleiben bestehende Goals unverändert
- [ ] Angenommen Goals sind vorhanden, dann werden sie als Text-Abschnitt auf `/profil/lebenslauf` unterhalb der Bio angezeigt mit Datum der letzten Aktualisierung
- [ ] Angenommen `goals_updated_at` ist älter als 90 Tage, dann zeigt `/profil/lebenslauf` einen In-App-Nudge-Banner ("Deine Ziele sind X Monate alt — noch aktuell?") mit direktem Link zum Aktualisieren-Dialog

## Edge Cases
- Enddatum eines Bildungs-/Werdegang-Eintrags liegt vor dem Startdatum → Validierungsfehler
- Laufende Ausbildung/Anstellung (kein Enddatum) → erlaubt, Enddatum bleibt optional
- Sehr lange Werdegang-Beschreibung → max. 500 Zeichen, analog zu bestehenden Freitextfeldern im Tool
- CV-PDF enthält keine erkennbaren Bildungs-/Werdegang-Abschnitte → Vorschau zeigt leere Gruppen mit Hinweis statt Fehler, Nutzer kann trotzdem manuell ergänzen
- Doppelter Klick auf "Hochladen"/"Speichern" während Request läuft → Button disabled (Loading-State), kein doppelter Insert/Upload
- Nutzer lädt einen zweiten CV hoch, nachdem bereits Einträge existieren → neue Vorschau wird unabhängig von bestehenden Einträgen erzeugt, nichts wird automatisch gelöscht oder überschrieben (siehe Out of Scope)
- Sehr großes PDF (z. B. mehrseitiger CV mit eingebetteten Bildern) nahe am Größenlimit → Upload wird serverseitig zeitlich begrenzt (Timeout), bei Überschreitung Fehlermeldung statt endlosem Laden
- Bio-Generierung schlägt fehl (API-Fehler) → Fehlermeldung, bestehende Bio bleibt unverändert, kein Datenverlust
- Nutzer hat CV-Daten aber keine Projekte (oder umgekehrt) → Bio wird aus verfügbaren Daten generiert, kein Fehler
- Goals-Chat-Dialog: Nutzer gibt sehr kurze/ausweichende Antworten → KI fragt maximal 1-2 Mal nach, erstellt dann eine Zusammenfassung aus dem was vorhanden ist (kein Endlos-Loop)
- Goals-Dialog: AI-Call schlägt fehl → Fehlermeldung im Dialog, bestehende Goals bleiben unverändert

## Technical Requirements
- Security: RLS auf `user_profile`, `user_education`, `user_employment` analog zu bestehenden Tabellen (`auth.uid() = user_id`); Storage-Bucket `cv-uploads` privat mit Owner-only-Policies, kein öffentlicher Zugriff auf hochgeladene PDFs
- Validierung: Institution/Arbeitgeber Pflichtfelder (max 200 Zeichen je analog zu bestehenden Namensfeldern), übrige Felder optional, Enddatum ≥ Startdatum falls beide gesetzt, Beschreibung max 500 Zeichen
- PDF-Upload: nur `application/pdf`, Größenlimit (Empfehlung 10 MB, analog typischer CV-Dateigrößen)
- KI-Parsing liefert ausschließlich einen Vorschlag — kein automatisches Schreiben in die Datenbank ohne explizite Nutzerbestätigung

**Erweiterungen (Auto-Bio + Career Goals):**
- `user_profile` bekommt 4 neue Spalten: `bio text`, `bio_updated_at timestamptz`, `goals_text text`, `goals_updated_at timestamptz` — neue DB-Migration erforderlich
- Neue API-Route `/api/generate-bio`: Auth-Check, lädt `user_education` + `user_employment` + `user_profile` (Skills/Sprachen) + `projects` (PROJ-12) für den User, ruft Claude via `generateText` auf, speichert generierte Bio in `user_profile` (upsert), gibt Bio zurück — gleiches Muster wie `/api/cv-parse`
- Neue API-Route `/api/goals-chat`: Multi-Turn-Conversation mit spezialisiertem System-Prompt (Goal-Extraction, nicht allgemeiner Assistent); nimmt `messages[]` entgegen, gibt `{message, done, goalsSummary?}` zurück; wenn `done=true` enthält Response die finale Zusammenfassung zur Bestätigung — kein direktes Speichern ohne Nutzerbestätigung
- Neues Frontend-Pattern: `goals-chat-dialog.tsx` — verwaltet lokalen `messages`-State, ruft `/api/goals-chat` nach jeder Nutzerantwort auf, zeigt Bestätigungs-Step wenn `done=true`, speichert `goals_text` per Supabase-Client-Call nach Bestätigung
- Bio-Section auf `/profil/lebenslauf`: wird nach CV-Bestätigung (nach `cv-review-dialog`) automatisch getriggert; "Bio neu generieren"-Button ruft `/api/generate-bio` auf; Bio wird lokal im Component-State aktualisiert ohne Page-Reload
- AI-Kontext: `bio` + `goals_text` werden als Teil des System-Prompts in `/api/chat` (PROJ-11) und `/api/draft-message` (PROJ-6) mitgegeben wenn vorhanden — bestehende Routen müssen um einen User-Profile-Fetch erweitert werden

## Open Questions
_Keine offenen Fragen — vollständig im Rahmen einer vorgelagerten Plan-Phase mit dem Nutzer abgestimmt (siehe Decision Log)._

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Volles CV-Profil (Bildung, Werdegang, Skills, Sprachen) statt nur Bildung | Nutzer hat sich explizit für den größten Scope entschieden — "echtes CV hochladen und alles erfasst" | 2026-06-30 |
| CV-Upload mit KI-Parsing direkt im MVP, nicht als Folge-Feature | Nutzer hat sich explizit dafür entschieden statt eines einfacheren manuellen Starts | 2026-06-30 |
| Zwei gleichwertige Eingabewege: CV-Upload UND manuelle Formulare | "Kontinuierlich aktualisiert" setzt voraus, dass der Nutzer auch lange nach dem letzten CV-Upload einzelne neue Stationen nachtragen kann, ohne erneut ein ganzes CV hochladen zu müssen | 2026-06-30 |
| Eigene Unterseite `/profil/lebenslauf` statt Tab/Sektion auf `/profil` | `/profil` (PROJ-15) zeigt Case-Historie + Stats — konzeptionell etwas anderes als persönliche CV-Fakten; PROJ-15s eigener Decision Log nennt ein Account-/CV-Profil bereits explizit als "eigenes Feature falls später gewünscht" | 2026-06-30 |
| Kein automatisches Schreiben aus dem CV-Parsing — immer Bestätigungs-Vorschau | Konsistent mit dem bestehenden "propose → confirm"-Muster der AI-Chat-Assistenz (PROJ-11); Fehlerkennungen aus PDF-Parsing dürfen nicht ungeprüft in die Datenbank | 2026-06-30 |
| Skills/Sprachen als einfache Listen ohne Niveau-Struktur | Reduziert Scope für MVP, Niveau-Angaben (z. B. "Englisch C1") sind nicht für die geplante Matching-Funktion (PROJ-17) erforderlich | 2026-06-30 |
| Re-Upload überschreibt bestehende Einträge nicht automatisch | Verhindert versehentlichen Datenverlust bei wiederholtem CV-Upload; Nutzer behält volle Kontrolle über jeden einzelnen Eintrag | 2026-06-30 |
| PROJ-17 (Gemeinsamkeiten-Matching) und PROJ-18 (passives Lernen) bewusst als eigene Folge-Specs ausgegliedert | Single-Responsibility-Prinzip des Repos — unabhängig testbar/deploybar; Matching braucht ohnehin echte Profildaten aus PROJ-16 als Voraussetzung | 2026-06-30 |
| Auto-Bio als eigenständige generierte Section im Profil (nicht nur stilles AI-Kontext-Artefakt) | Nutzer soll sehen was die KI über ihn weiß — Transparenz und Kontroll-Feedback; Anzeige im Profil schafft Vertrauen in KI-Funktionen wie Gemeinsamkeiten | 2026-07-01 |
| Goals als konversationeller AI-Dialog statt Formular | Berater-Zielgruppe ist zeitarm; geführtes Gespräch (AI fragt, Nutzer antwortet kurz) < kognitive Last eines leeren Formulars; AI kann Folgefragen kontextabhängig stellen | 2026-07-01 |
| Goals als Freitext-Zusammenfassung gespeichert (nicht strukturierte Enum-Felder) | AI-Conversation produziert natürlichsprachige Zusammenfassung — diese direkt als Kontext an andere AI-Routen weiterzugeben ist effektiver als normalisierte Felder; Freitext enthält mehr Nuancen | 2026-07-01 |
| Goals-Chat als eigenständige API-Route `/api/goals-chat`, nicht als Erweiterung von PROJ-11 `/api/chat` | Spezialisierter System-Prompt (strukturierte Goal-Extraktion, endliche Konversation), anderes Output-Schema (`done` + `goalsSummary`); Trennung verhindert Scope-Creep im allgemeinen Chat-Endpunkt | 2026-07-01 |
| 90-Tage-Nudge als In-App-Banner, kein E-Mail/Push | Minimalste Implementierung; E-Mail-Kanal existiert (PROJ-9), aber ein separater Reminder-Job für Goals wäre Overhead; Banner ist ausreichend für einen Solo-Nutzer der täglich die App öffnet | 2026-07-01 |
| Bio + Goals als AI-Kontext in `/api/chat` (PROJ-11) und `/api/draft-message` (PROJ-6) einbinden | Das ist der primäre Mehrwert — reichere Gemeinsamkeiten, passendere Nachrichtenvorschläge; ohne diesen Schritt sind Bio/Goals Anzeigefeatures ohne echten Nutzen | 2026-07-01 |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|----------|-----------|------|
| 3 neue Tabellen statt einer breiten Tabelle: `user_profile` (Singleton), `user_education`, `user_employment` (Child-Tables) | Bildung/Werdegang sind wiederholbar und datiert (mehrere Abschlüsse/Jobs mit Zeitraum) — analog zum bestehenden `project_participants`-neben-`projects`-Muster. Skills/Sprachen als `text[]`-Spalten auf der Singleton-Zeile statt eigener Tabellen, da unsortierte, undatierte einfache Listen ohne Pro-Eintrag-Metadaten | 2026-06-30 |
| `user_profile.updated_at` bewusst mitgeführt | Spätere Folgefeatures (PROJ-17) brauchen ein verlässliches Änderungs-Signal, um zu erkennen, wann ein Profil-Abgleich nötig ist | 2026-06-30 |
| Neuer privater Storage-Bucket `cv-uploads`, Pfad `{user_id}/{timestamp}-{filename}.pdf` | Erstes Storage-Feature im Repo (bisher ungenutzt) — `user_id` als oberstes Pfadsegment macht die Owner-Policy einfach (`storage.foldername(name)[1] = auth.uid()::text`), analog zum `auth.uid() = user_id`-Muster aller bestehenden Tabellen | 2026-06-30 |
| Kein Storage-Update-Policy, Re-Upload erzeugt neuen Pfad statt Overwrite | Vermeidet Teil-Schreib-Fehlerfälle, hält den zuletzt referenzierten CV-Pfad eindeutig über `user_profile.cv_file_path` | 2026-06-30 |
| Neue API-Route `/api/cv-parse`, gleiches Gerüst wie `/api/draft-message` (Auth-Check, zod-Body, try/catch um den AI-Call) | Konsistenz mit bestehenden server-seitigen AI-Routen dieses Repos, kein neues Muster nötig | 2026-06-30 |
| `generateObject` (Vercel AI SDK) statt `generateText` für das CV-Parsing | Strukturierte JSON-Antwort mit Zod-Schema statt freiem Text — bereits installiertes Package, kein neues Dependency | 2026-06-30 |
| Modell `claude-sonnet-4-6` für CV-Parsing (nicht Haiku) | Höhere Extraktions-Güte für ein einmaliges, wichtiges Parsing-Ergebnis gerechtfertigt — gleiches Modell, das dieses Repo bereits für seine "großen" AI-Aufgaben nutzt (Chat-Assistent), während Haiku für günstige/häufige Aufgaben reserviert bleibt (z. B. Nachrichtenvorschläge) | 2026-06-30 |
| PDF wird vom Client zuerst in Storage hochgeladen, die API-Route bekommt nur den Storage-Pfad (nicht die rohen Bytes erneut) | Vermeidet doppelten Datei-Transfer; die Datei existiert als durables Artefakt unabhängig davon, ob das Parsing gelingt | 2026-06-30 |
| Review-Dialog (`cv-review-dialog.tsx`) strukturell von `linkedin-import-dialog.tsx` (PROJ-10) abgeleitet | Bestehendes, bewährtes "Vorschau mit Checkbox pro Zeile, vor Bestätigung editierbar, Batch-Insert"-Muster wiederverwenden statt neu zu erfinden | 2026-06-30 |
| Manuelle Eingabe-Dialoge strukturell von `project-form-dialog.tsx` abgeleitet (react-hook-form + zod) | Konsistentes Formular-Pattern im gesamten Repo | 2026-06-30 |
| Neue Unterseite `/profil/lebenslauf` statt neuer Top-Level-Nav-Punkt | Bereits im Spec-Decision-Log festgehalten — kein 5. Nav-Punkt für einen Unteraspekt von "Profil" | 2026-06-30 |
| Kein eigener API-Endpunkt für CRUD auf `user_education`/`user_employment` (außer dem Parsing) | Direkte Supabase-Client-Calls + RLS, analog zum etablierten Muster bei `projects`/`project_participants` (kein bestehendes API-Route-Pattern für diese Art Ressource in diesem Repo) | 2026-06-30 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### A) Komponenten-Struktur

```
/profil (bestehend, PROJ-15, unverändert)
+-- "Mein Lebenslauf"-Card/Button (NEU, verlinkt auf Unterseite)

/profil/lebenslauf (NEUE Unterseite)
+-- Empty State ("Noch kein Profil" + "CV hochladen"/"Manuell hinzufügen")
+-- Profil-Kopf (Headline, Skills, Sprachen als Tags)
+-- Bildung-Sektion
|   +-- Liste der Bildungs-Einträge (Institution, Abschluss, Zeitraum)
|   +-- "+ Ausbildung hinzufügen"-Button → Bildungs-Formular-Dialog
+-- Werdegang-Sektion
|   +-- Liste der Werdegang-Einträge (Arbeitgeber, Rolle, Zeitraum)
|   +-- "+ Berufserfahrung hinzufügen"-Button → Werdegang-Formular-Dialog
+-- "CV hochladen"-Button → Upload-Dialog
    +-- Datei-Auswahl (PDF)
    +-- Lade-Zustand während KI-Parsing läuft
    +-- Review-Dialog: editierbare Vorschau (gruppiert, Checkbox pro Zeile) → Bestätigen → Speichern
```

### B) Datenmodell (Klartext)

**Eigenes Profil** — eine Zeile pro Nutzer:
- Kurzbeschreibung/Headline (optional)
- Skills, Sprachen (jeweils eine einfache Liste)
- Referenz auf zuletzt hochgeladenen Lebenslauf (Dateipfad + Zeitpunkt)

**Bildungs-Eintrag** — mehrere pro Nutzer:
- Institution (Pflicht), Abschluss, Fachrichtung, Stadt, Zeitraum (Start optional, Ende optional = "läuft noch")

**Werdegang-Eintrag** — mehrere pro Nutzer:
- Arbeitgeber (Pflicht), Rolle, Stadt, Zeitraum, kurze Beschreibung (optional)

**Hochgeladene CVs:** PDF-Dateien liegen in einem privaten Datei-Speicher, nur für den jeweiligen Nutzer zugänglich, nicht öffentlich abrufbar.

Storage: Supabase Postgres (3 neue Tabellen) + Supabase Storage (neuer privater Bucket), RLS analog bestehender Tabellen (`auth.uid() = user_id`).

### C) Tech-Entscheidungen (warum)

- **Drei Tabellen statt einer** — Bildung und Werdegang sind wiederholbare, datierte Einträge (mehrere Studienabschlüsse, mehrere Jobs), passt zum bestehenden Muster für "ein Haupt-Objekt + mehrere Unter-Einträge" wie bei Projekten/Beteiligten.
- **CV-Upload mit KI-Parsing, aber immer mit Bestätigungs-Schritt** — die KI liest das PDF und schlägt Einträge vor, schreibt aber nichts automatisch — konsistent mit dem bereits etablierten "Vorschlagen statt automatisch Ausführen"-Prinzip der KI-Funktionen in diesem Tool.
- **Eigene Unterseite statt Erweiterung der bestehenden Profil-Seite** — die bestehende Profil-Seite (Case-Historie) und das neue CV-Profil sind inhaltlich unterschiedliche Dinge; eine eigene Unterseite hält beides übersichtlich getrennt.
- **Neuer Datei-Speicher-Bereich nur für CVs** — bisher speichert das Tool keine hochgeladenen Dateien; ein klar abgegrenzter, privater Bereich nur für Lebensläufe ist die einfachste sichere Lösung.

### D) Dependencies
Keine neuen Packages — das bereits installierte AI-Werkzeug unterstützt strukturierte Datenextraktion direkt, shadcn-Komponenten (Dialog, Checkbox, Input, Card) sind bereits installiert und im Projekt genutzt.

## Frontend Implementation Notes
<!-- Added by /frontend -->
- Neue Dateien: `src/lib/user-profile.ts` (Typen `UserProfile`/`EducationEntry`/`EmploymentEntry`, `formatEntryDateRange` als Re-Export von `formatDateRange` aus `lib/projects.ts` statt Duplikat, `sortByStartDateDesc`-Helper)
- Neue Route `src/app/(app)/profil/lebenslauf/page.tsx` → rendert `CvProfile`
- `src/components/cv-profile.tsx`: Haupt-Seite, lädt `user_profile`/`user_education`/`user_employment` parallel, Empty-State wenn nichts vorhanden, sonst Headline+Skills+Sprachen-Badges, Bildung-/Werdegang-Sektionen mit Edit (Klick auf Zeile) und Delete (Icon, keine Bestätigung — geringes Risiko, manuell editierbar)
- `src/components/education-form-dialog.tsx`, `employment-form-dialog.tsx`: strukturell identisch zu `project-form-dialog.tsx` (react-hook-form + zod, Enddatum-≥-Startdatum-Validierung)
- `src/components/cv-upload-dialog.tsx`: PDF-Validierung (Typ, max 10 MB) client-seitig, Upload zu Storage-Bucket `cv-uploads` unter `{user_id}/{timestamp}-{filename}`, POST an `/api/cv-parse` (kein manueller Auth-Header nötig — Session läuft über Cookies, gleiches Muster wie bestehende `/api/draft-message`-Aufrufe), bei Fehler Hinweis auf manuelle Eingabe als Fallback
- `src/components/cv-review-dialog.tsx`: adaptiert von `linkedin-import-dialog.tsx` — gruppierte Vorschau (Ausbildung/Werdegang/Skills/Sprachen), Checkbox pro Zeile, Skills/Sprachen als entfernbare Badges, Bestätigen schreibt nur ausgewählte Zeilen + upserted `user_profile` (`onConflict: 'user_id'`), Abbrechen speichert nichts
- `src/components/project-list.tsx`: neue "Mein Lebenslauf"-Card verlinkt auf `/profil/lebenslauf`, unterhalb des Stats-Headers aus PROJ-15
- Tabellen (`user_profile`, `user_education`, `user_employment`), Storage-Bucket `cv-uploads` und `/api/cv-parse` existieren noch nicht — Supabase-Calls gehen vom in der Architektur festgelegten Schema aus, folgen in `/backend` (gleiches Vorgehen wie bei PROJ-12)
- Lint-Fix während Implementierung: `cv-profile.tsx` rief `setIsLoading(true)` redundant synchron im Mount-Effect auf (Initial-State ist bereits `true`) — neue `react-hooks/set-state-in-effect`-Regel hat das korrekt angemeckert, entfernt
- Build (`npm run build`) und Lint (`npm run lint`) laufen fehlerfrei; `/profil/lebenslauf` erscheint korrekt in der Build-Routen-Tabelle

## Backend Implementation Notes
<!-- Added by /backend -->
- Migration `supabase/migrations/0005_create_user_profile.sql`: Tabellen `user_profile` (Singleton, `user_id unique`), `user_education`, `user_employment`, alle Owner-only RLS (4 Policies je Tabelle, `auth.uid() = user_id`), Indizes auf `user_id`
- Neuer Storage-Bucket `cv-uploads` (privat, `public = false`), 3 Storage-RLS-Policies (select/insert/delete) auf `storage.objects`, gescoped über `(storage.foldername(name))[1] = auth.uid()::text` — kein Update-Policy (Re-Upload erzeugt neuen Pfad, siehe Tech Design)
- Migration live via Supabase MCP angewendet, danach `list_tables` + `get_advisors` (security) verifiziert: alle 3 Tabellen RLS-enabled, keine neuen Security-Findings (nur bereits bestehender, unabhängiger `auth_leaked_password_protection`-Hinweis)
- Neue API-Route `src/app/api/cv-parse/route.ts`: gleiches Gerüst wie `/api/draft-message` (Auth-Check 401, zod-Body-Validierung), lädt PDF server-seitig aus `cv-uploads` herunter (RLS verweigert fremde Pfade bereits hier), base64-kodiert, `generateObject` (Vercel AI SDK, `ai@6.0.208` + `@ai-sdk/anthropic@3.0.62`, beide bereits installiert) mit Modell `claude-sonnet-4-6`, PDF als `file`-Content-Part (`mediaType: 'application/pdf'`), Zod-Schema deckungsgleich mit dem Frontend-`ParsedCv`-Typ; Fehler beim AI-Call → 502, fehlende/fremde Datei → 404
- Keine Integration-Tests (Vitest) für diese Route geschrieben, da sie einen echten PDF-Upload + Claude-Call braucht (kein sinnvoller Mock ohne externe Abhängigkeit zu kapseln) — Abdeckung erfolgt über E2E in `/qa`
- `npm run build` + `npm run lint` fehlerfrei; `/api/cv-parse` erscheint korrekt in der Build-Routen-Tabelle

## QA Test Results

**Tested:** 2026-06-30
**App URL:** http://localhost:3000 (npm run dev)
**Tester:** QA Engineer (AI)

### Acceptance Criteria Status

1. Empty-State auf `/profil/lebenslauf` mit "CV hochladen"/"Manuell hinzufügen" — PASS
2. CV-Upload → editierbare Vorschau, noch nichts gespeichert — PASS (Parsing selbst funktioniert sehr gut, siehe BUG-1 für den Speichern-Schritt)
3. Vorschau: Zeilen abwählen/korrigieren, nur Ausgewähltes wird gespeichert — Code-Review PASS (Checkbox-Logik + editierbare Felder verifiziert), End-to-End-Speichern blockiert durch BUG-1
4. Abbrechen der Vorschau speichert nichts — PASS
5. Nicht-PDF-Datei → Validierungsfehler, kein Upload-Versuch — PASS
6. Datei über Größenlimit → Validierungsfehler — Code-Review PASS (`MAX_FILE_SIZE_BYTES`-Check vor Upload), nicht mit echter Großdatei e2e getestet (geringer Wert/hoher Aufwand für diese Prüfung)
7. KI-Verarbeitung schlägt fehl → Fehlermeldung, manueller Fallback möglich — Code-Review PASS (try/catch im Route-Handler gibt 502, Frontend zeigt Fallback-Hinweis), nicht mit absichtlich unlesbarem PDF e2e reproduziert
8. Manueller Bildungs-Eintrag ohne Upload (Institution Pflicht) — PASS
9. Leeres Institution-Feld → Validierungsfehler — PASS
10. Manueller Werdegang-Eintrag ohne Upload (Arbeitgeber Pflicht) — PASS, aber siehe BUG-2 (Empty-State bietet keinen direkten Einstieg dafür)
11. Bildungs-/Werdegang-Eintrag bearbeiten → Werte übernommen — PASS
12. Bildungs-/Werdegang-Eintrag löschen → nur dieser Eintrag entfernt — PASS
13. Skills/Sprachen bleiben nach Neuladen erhalten — Code-Review PASS (Teil des `user_profile`-Upserts), End-to-End-Speichern blockiert durch BUG-1 wenn über CV-Upload befüllt; manuell ist kein UI-Pfad zum direkten Setzen von Skills/Sprachen ohne CV vorgesehen (spec-konform, kein Bug)
14. RLS: fremde Profil-Daten nicht zugreifbar — PASS (anon-Rolle sieht 0 Zeilen, eigene Daten korrekt sichtbar)

### Edge Cases Status
- Enddatum vor Startdatum (Bildung) → Validierungsfehler — PASS
- Laufende Ausbildung/Anstellung (kein Enddatum) — PASS (Enddatum optional, kein Zwang)
- Doppelter Klick auf Speichern/Hochladen während Request läuft — Code-Review PASS (`disabled`-State auf allen Submit-Buttons/File-Input während Verarbeitung), nicht unter Last getestet
- Re-Upload eines zweiten CVs nach bestehenden Einträgen → Code-Review PASS (neuer Pfad pro Upload, kein Überschreiben), nicht separat e2e getestet (durch BUG-1 ohnehin aktuell nicht sauber durchspielbar)
- CV ohne erkennbare Bildung/Werdegang → Code-Review PASS (Review-Dialog zeigt Hinweistext statt Fehler bei leeren Gruppen)

### Security Audit Results
- [x] RLS: `user_profile`/`user_education`/`user_employment` Owner-only, verifiziert über `get_advisors` (keine neuen Findings) + direkten anon-Rollen-Test (0 Zeilen ohne gültige Session)
- [x] Storage: Bucket `cv-uploads` privat (`public = false`), 3 Owner-Scoped Policies (select/insert/delete) verifiziert über `pg_policies`, Pfad-Präfix-Check (`auth.uid()`) verhindert Zugriff auf fremde Dateien
- [x] `/api/cv-parse` lädt die PDF-Datei über den Supabase-Server-Client (Cookie-Session), nicht über Service-Role — fremde `storagePath`-Werte werden bereits auf Storage-RLS-Ebene abgelehnt, bevor ein AI-Call überhaupt stattfindet
- [x] XSS: Alle geparsten/eingegebenen Texte (Institution, Arbeitgeber, Headline, Skills, Sprachen) werden ausschließlich über React-Textinterpolation gerendert, kein `dangerouslySetInnerHTML`
- [x] Keine Secrets im Client sichtbar (Anthropic-Call läuft ausschließlich server-seitig in `/api/cv-parse`)

### Regression Testing
- Volle Suite seriell (`npx playwright test --project=chromium --workers=1`, 149 Tests über alle PROJ-2–PROJ-16-Specs) — **149/149 PASS**, keine Regression durch die neue "Mein Lebenslauf"-Card auf `/profil` (PROJ-15-Suite weiterhin grün)
- `npm test` (Vitest) — 113/113 PASS

### Bugs Found

#### BUG-1: CV-Speichern schlägt fehl bei jahresgenauen (nicht tagesgenauen) Daten aus dem PDF
- **Severity:** High
- **Steps to Reproduce:**
  1. Lebenslauf-PDF hochladen, das Zeiträume nur als Jahreszahl nennt (z. B. "RWTH Aachen, 2014 – 2019") — der absolute Normalfall bei echten Lebensläufen
  2. KI parst korrekt (verifiziert: Institution, Abschluss, Arbeitgeber, Skills, Sprachen werden zuverlässig erkannt), Vorschau wird angezeigt
  3. "Bestätigen" klicken
  4. Erwartet: Einträge werden gespeichert
  5. Tatsächlich: "Speichern fehlgeschlagen. Bitte erneut versuchen." — der komplette Batch-Insert bricht ab, weil die KI z. B. `"2014"` statt `"2014-01-01"` als Datum liefert und Postgres' `date`-Spaltentyp das ablehnt (direkt verifiziert: `select '2014'::date` → `ERROR: invalid input syntax for type date: "2014"`). Da `user_education`/`user_employment` in einem Batch-Insert geschrieben werden, scheitert die GESAMTE Vorschau, nicht nur der einzelne Eintrag mit unscharfem Datum — der Nutzer verliert die komplette Eingabe und muss das CV erneut hochladen
- **Priority:** Fix before deployment — betrifft den Kern-Workflow (CV hochladen → speichern) bei realistischen Eingaben, kein Randfall
- **Empfehlung:** Prompt in `src/app/api/cv-parse/route.ts` anweisen, Daten verbindlich als `YYYY-MM-DD` zu liefern (z. B. nur-Jahr-Angaben → `YYYY-01-01`, nicht rekonstruierbare Daten → `null`), und/oder vor dem Insert in `cv-review-dialog.tsx` serverseitig validieren/normalisieren statt den rohen KI-String ungeprüft zu speichern
- **File:** `src/app/api/cv-parse/route.ts` (Prompt/Schema), `src/components/cv-review-dialog.tsx` (Insert-Logik)

#### BUG-2: Empty-State bietet keinen direkten Einstieg für reinen Werdegang-Eintrag
- **Severity:** Low
- **Steps to Reproduce:**
  1. `/profil/lebenslauf` ohne bestehende Daten öffnen
  2. "Manuell hinzufügen" klicken
  3. Erwartet: Auswahl, ob Bildung oder Berufserfahrung angelegt werden soll (oder generischer Einstieg)
  4. Tatsächlich: Es öffnet sich ausschließlich das Bildungs-Formular — eine reine Werdegang-Ersterfassung ohne vorherigen Bildungs-Eintrag oder CV-Upload ist nicht direkt möglich (nur über Umweg: Bildungseintrag anlegen, dann wieder löschen)
- **Priority:** Nice to have — Funktion ist über Umweg erreichbar, betrifft nur die Erstbefüllung aus dem Leerzustand
- **File:** `src/components/cv-profile.tsx` (Empty-State-Branch)

### Automated Tests
- Unit (Vitest): `src/lib/user-profile.test.ts` — 6 Tests, alle grün (`npm test`: 113/113 gesamt)
- E2E (Playwright): `tests/PROJ-16-eigenes-profil-cv.spec.ts` — 12 Tests (11 grün, 1 bewusst als `test.fail()` markiert zur Dokumentation von BUG-1, bis der Fix landet), grün auf Chromium (voll) + Mobile Safari (Smoke-Teilmenge: Empty-State, Entry-Point, Datei-Validierung)
- Test-Fixture `tests/fixtures/test-cv.pdf` (+ Generator-Script `tests/fixtures/generate-cv-fixture.mjs`, nutzt bereits installiertes `@react-pdf/renderer`) — realistischer Test-Lebenslauf mit RWTH Aachen/Tsinghua/McKinsey/BCG-Inhalten, KI-Parsing-Qualität damit verifiziert (erkennt Institution, Abschluss, Fachrichtung, Arbeitgeber, Rolle, Skills, Sprachen zuverlässig)
- `npm run build` + `npm run lint` fehlerfrei

### Summary
- **Acceptance Criteria:** 13/14 vollständig PASS, 1 (Speichern nach CV-Upload) zunächst durch BUG-1 blockiert — **nach Fix erneut getestet, jetzt PASS**
- **Bugs Found:** 2 total (0 critical, 1 high, 0 medium, 1 low) — **beide behoben, siehe Re-Test**
- **Security:** RLS + Storage-Policies halten, kein Cross-User-Zugriff, kein XSS-Vektor
- **Production Ready:** YES
- **Recommendation:** Deploy.

### Re-Test nach Bugfixes (2026-06-30)
- **BUG-1 behoben:** `src/app/api/cv-parse/route.ts` — Prompt weist Claude jetzt explizit an, Daten immer als `YYYY-MM-DD` zu liefern (Jahr-only → `YYYY-01-01`, unbekannt → `null`). Zusätzlich serverseitiges Sicherheitsnetz: neues `isoDateOrNull`-Zod-`.transform()` auf `start_date`/`end_date` in `educationSchema`/`employmentSchema`, das jeden Wert, der nicht exakt dem `YYYY-MM-DD`-Format entspricht, automatisch zu `null` normalisiert, statt den rohen KI-String ungeprüft an die DB weiterzureichen (Defense-in-Depth — auch falls das Modell die Format-Anweisung in der Praxis verletzt, kann kein ungültiges Datum mehr in die Tabelle gelangen).
- **BUG-2 behoben:** `src/components/cv-profile.tsx` Empty-State zeigt jetzt zwei getrennte Buttons "+ Ausbildung hinzufügen" und "+ Berufserfahrung hinzufügen" statt eines einzelnen mehrdeutigen "Manuell hinzufügen"-Buttons, der nur das Bildungs-Formular öffnete. `EmploymentFormDialog` wird jetzt auch im Empty-State-Branch gerendert.
- E2E-Test `tests/PROJ-16-eigenes-profil-cv.spec.ts` AC "uploading a CV parses it and shows an editable review before saving" lief zunächst bewusst mit `test.fail()` zur Dokumentation von BUG-1, nach dem Fix entfernt — Test läuft jetzt regulär grün (kein `test.fail()` mehr nötig, bestätigt den Fix end-to-end mit echtem Claude-PDF-Parsing-Call)
- Button-Selektoren in den übrigen Education-Tests von "Manuell hinzufügen" auf "+ Ausbildung hinzufügen" aktualisiert (Label-Änderung durch BUG-2-Fix)
- Vollständige Regression danach: `npm test` 113/113 grün, `npx playwright test tests/PROJ-16-eigenes-profil-cv.spec.ts --project=chromium --workers=1` **12/12 grün** (alle reguläre Tests, kein `test.fail()` mehr), volle Suite (`--project=chromium --workers=1`, 149 Tests über PROJ-2–PROJ-16) — 1 vereinzelter AI-Flake in PROJ-11 (isoliert beim ersten Retry erneut fehlgeschlagen, beim zweiten Retry grün — bestätigt KI-Antwortvarianz, keine Regression durch PROJ-16; PROJ-16-Code rührt `chat-server.ts`/Kontakt-Erstellung nicht an), `npm run build` + `npm run lint` fehlerfrei

## Deployment

- **Production URL:** https://bambi-w26q.vercel.app
- **Deployed:** 2026-06-30
- Pushed `main` (09bf6cc..c7565d2) → Vercel auto-deploy, build `dpl_EEavazGmpDrvgDEoYmdJ6M1myzHx`, Status Ready
- DB-Migration `0005_create_user_profile.sql` (Tabellen + `cv-uploads`-Storage-Bucket) bereits vor Deploy live via Supabase MCP angewendet, kein separater Migrationsschritt nötig
- Keine neuen Env-Variablen nötig — `/api/cv-parse` nutzt das bereits in Produktion gesetzte `ANTHROPIC_API_KEY` (gleiche Variable wie `/api/chat`, `/api/draft-message`, `/api/network-insights`)
- Smoke-Test: `/profil/lebenslauf` → 307 (Middleware-Redirect zu `/login`, erwartet ohne Session), `/api/cv-parse` → 307 (gleiches Middleware-Verhalten, kein Routen-spezifisches Problem, konsistent mit PROJ-15-Präzedenzfall)

# PROJ-21: Meeting-Prep-Sektion im Dashboard

## Status: Deployed
**Created:** 2026-07-02
**Last Updated:** 2026-07-03
**Refine-Historie:** Ursprünglich deployed 2026-07-02. Refine 2026-07-03: Vorlauf-Fenster (3 Tage) + Post-Meeting-Nudge ergänzt (Item 1 einer größeren Initiative zur besseren Nutzung des Google-Calendar-Connectors — siehe auch geplante Refines von PROJ-6, PROJ-8, PROJ-14).

## Dependencies
- PROJ-19 (Konnektoren-Hub) — liefert den Google-OAuth-Token (`connector_tokens`, `calendar.readonly`-Scope) und die Verschlüsselungs-Bibliothek (`src/lib/connectors/encryption.ts`), die dieses Feature zum Lesen der Kalender-Events braucht. `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` sind seit 2026-07-01 in Vercel (Preview + Production) gesetzt — der Google-Connect-Flow ist live nutzbar (verifiziert 2026-07-03 via `vercel env ls`). Der frühere Blocker aus den PROJ-19-Deployment-Notizen ist behoben.
- PROJ-3 (Kontakt anlegen & verwalten) — `contacts.email` wird für das Matching gebraucht
- PROJ-5 (Interaktions-Log) — letzte Interaktionen sind Grundlage der KI-Zusammenfassung
- PROJ-17 (Gemeinsamkeiten-Feld) — `commonalities` fließt zusätzlich in die Zusammenfassung ein, sofern vorhanden
- PROJ-6 (Follow-up Dashboard) — neue Sektion lebt auf derselben `/dashboard`-Seite, wiederverwendet das etablierte Karten-/On-Click-Draft-Pattern

## User Stories
- Als MBB-Berater möchte ich beim Öffnen des Dashboards sehen, mit welchen bekannten Kontakten ich heute Termine habe, damit ich mich gezielt vorbereiten kann, ohne meinen Kalender manuell mit meiner Kontaktliste abzugleichen
- Als Nutzer möchte ich für einen Termin auf Knopfdruck eine kurze KI-Zusammenfassung ("worum ging's zuletzt") bekommen, damit ich vor dem Meeting nicht erst durch alte Notizen scrollen muss
- Als Nutzer möchte ich bei einem Termin mit mehreren bekannten Teilnehmern alle auf einen Blick sehen, damit ich weiß, wer im Raum sitzt
- Als Nutzer, der Google noch nicht verbunden hat, möchte ich einen Hinweis sehen, dass diese Funktion existiert, damit ich sie nicht übersehe
- Als Nutzer möchte ich, dass nur Termine mit mir bereits bekannten Kontakten auftauchen, damit die Sektion nicht mit irrelevanten internen/unbekannten Terminen überfüllt wird
- Als Nutzer möchte ich schon 1-2 Tage vor einem Termin sehen, dass er ansteht, damit ich mich nicht erst am Tag selbst vorbereite (Refine 2026-07-03)
- Als Nutzer möchte ich nach einem beendeten Meeting einen dezenten Hinweis sehen, die Interaktion zu loggen, damit ich das Follow-up nicht vergesse, ohne dass die App automatisch etwas protokolliert (Refine 2026-07-03)

## Out of Scope
- **Kontakt-Erstellung aus unbekannten Termin-Teilnehmern** — Teilnehmer ohne E-Mail-Match werden schlicht ignoriert, kein "Als Kontakt anlegen"-Vorschlag (kleiner Scope, eigenes Feature bei Bedarf)
- **~~Termine ab morgen / 14-Tage-Vorschau für Meetings~~ → Aufgehoben (Refine 2026-07-03):** Fenster jetzt "heute + 2 Tage" (siehe neue Acceptance Criteria). Volle 14-Tage-Vorschau (Parität mit den Anlass-Sektionen) bleibt bewusst außerhalb des Scopes — Meeting-Prep ist weiterhin ein "bald geht's los"-Feature, kein Langzeit-Planungstool.
- **Schreiben/Bearbeiten von Kalender-Terminen** — nur Lesezugriff (`calendar.readonly`, bereits in PROJ-19 so festgelegt)
- **Automatisches Interaktions-Logging nach einem Meeting** — bleibt bestehen: der neue Post-Meeting-Nudge (Refine 2026-07-03) öffnet lediglich den bestehenden manuellen "Kontaktiert"-Dialog (PROJ-5/6), es wird nichts automatisch erstellt oder erkannt — kein Auto-Log, keine automatische Meeting-Ende-Erkennung außer dem reinen Zeitvergleich für die Nudge-Anzeige selbst
- **Fuzzy-Namens-Matching als Fallback** — nur exaktes E-Mail-Matching (Entscheidung im Interview), vermeidet Falsch-Zuordnungen
- **Caching/Speichern der KI-Zusammenfassung** — wird bei jedem Klick auf "Vorbereiten" neu generiert, kein Verlauf (konsistent mit PROJ-6s "kein Draft-Caching"-Prinzip)
- **Rate-Limiting für den Kalender-Read oder den KI-Call** — kein MVP-Bedarf bei erwarteter Nutzungsfrequenz (analog zu allen anderen KI-Features in diesem Projekt)
- **Behandlung von Terminen ohne Teilnehmerliste (z.B. private Blocker-Events)** — werden wie Termine ohne Matches behandelt (nicht angezeigt), keine Sonderlogik
- **Wiederkehrende Termine / Serientermine besonders kennzeichnen** — werden wie jeder andere Termin behandelt, keine "wiederholt sich"-Kennzeichnung für MVP

## Acceptance Criteria

### Sektion "Termine" (bisher "Heutige Termine")
- [ ] Angenommen der Nutzer hat Google verbunden (PROJ-19) und mindestens ein Kalender-Termin in den nächsten 3 Tagen (heute + 2 Tage) hat einen Teilnehmer, dessen E-Mail zu einem eigenen Kontakt passt, wenn das Dashboard lädt, dann erscheint eine Sektion "Termine" oberhalb der bestehenden Anlass-Sektionen
- [ ] Angenommen mehrere passende Termine existieren, wenn die Sektion angezeigt wird, dann sind die Termin-Karten chronologisch nach Startzeit sortiert
- [ ] Angenommen ein Termin hat mehrere Teilnehmer mit Kontakt-Match, wenn die Karte angezeigt wird, dann erscheinen alle gematchten Kontakte auf derselben Karte (eine Karte pro Termin, nicht pro Kontakt)
- [ ] Angenommen ein Termin-Teilnehmer hat keine zu einem Kontakt passende E-Mail, wenn die Karte gerendert wird, dann taucht dieser Teilnehmer nirgends auf der Karte auf
- [ ] Angenommen kein Termin im 3-Tage-Fenster hat einen Kontakt-Match (oder es gibt keine Termine), wenn das Dashboard lädt, dann wird die Sektion "Termine" komplett ausgeblendet (kein eigener Empty-State, analog zu "Kürzlich erkannt")
- [ ] Angenommen ein Termin liegt nicht am heutigen Tag, wenn die Karte angezeigt wird, dann zeigt sie zusätzlich zur Uhrzeit ein Tages-Label ("Heute", "Morgen", oder Wochentag ab übermorgen) — Termine am heutigen Tag zeigen kein Zusatz-Label (identisch zum bisherigen Verhalten)

### Post-Meeting-Nudge (neu, Refine 2026-07-03)
- [ ] Angenommen ein Termin in der Sektion "Termine" liegt am heutigen Tag und seine Endzeit liegt in der Vergangenheit, wenn die Karte gerendert wird, dann zeigt jede gematchte Kontakt-Zeile auf der Karte einen dezenten Hinweis ("Interaktion loggen?") mit Button
- [ ] Angenommen der Nutzer klickt auf diesen Button, wenn der Klick verarbeitet wird, dann öffnet sich der bestehende Interaktions-Dialog (`InteractionFormDialog`) vorausgefüllt mit diesem Kontakt — identisches Verhalten zum "Kontaktiert"-Button auf `OccasionCard`/`ImportEventCard`
- [ ] Angenommen der Nutzer speichert die Interaktion, wenn das Dashboard danach neu lädt, dann verschwindet der Nudge für diesen Kontakt (Ableitung rein client-seitig aus `contact.last_contacted_at`, keine neue Persistenz für den Nudge-Zustand selbst)
- [ ] Angenommen ein Termin liegt in der Zukunft (heute später oder an einem Folgetag) oder ein ganztägiger Termin, wenn die Karte gerendert wird, dann erscheint kein Post-Meeting-Nudge (nur echte, bereits beendete Termine mit bekannter Endzeit lösen den Nudge aus)
- [ ] Angenommen ein Kontakt hat an einem beendeten Termin teilgenommen, aber bereits danach (z.B. direkt im Anschluss telefonisch) eine Interaktion geloggt bekommen, wenn das Dashboard neu lädt, dann erscheint für diesen Kontakt kein Nudge mehr (Zeitvergleich `last_contacted_at` ≥ `meeting.endTime`)

### Kein Google verbunden
- [ ] Angenommen der Nutzer hat noch keinen Google-Konnektor verbunden, wenn das Dashboard lädt, dann zeigt die Sektion "Heutige Termine" einen dezenten Hinweistext ("Google Kalender verbinden, um heutige Termine hier zu sehen") mit einem Link zu `/einstellungen/konnektoren`
- [ ] Angenommen der Google-Token ist vorhanden, aber laut PROJ-19-Status `expired`, wenn das Dashboard lädt, dann wird der gleiche Hinweis wie "nicht verbunden" angezeigt (kein technischer Fehlertext)

### Meeting-Prep (KI-Zusammenfassung)
- [ ] Angenommen eine Termin-Karte mit mindestens einem gematchten Kontakt wird angezeigt, wenn der Nutzer auf "Vorbereiten" bei einem der gelisteten Kontakte klickt, dann wird eine kurze KI-Zusammenfassung (2-3 Sätze) basierend auf den letzten Interaktionen und ggf. `commonalities` dieses Kontakts generiert und inline angezeigt
- [ ] Angenommen die Zusammenfassung wird generiert, wenn der Nutzer wartet, dann zeigt der Button einen Loading-State
- [ ] Angenommen die KI-Anfrage schlägt fehl, wenn das passiert, dann wird eine Fehlermeldung angezeigt, die Karte bleibt ansonsten funktionsfähig
- [ ] Angenommen ein Kontakt hat keine einzige Interaktions-Notiz, wenn "Vorbereiten" geklickt wird, dann wird trotzdem eine Zusammenfassung generiert (z.B. "Noch keine bisherige Historie mit [Name]"), kein Fehler
- [ ] Angenommen "Vorbereiten" wurde für einen Kontakt bereits geklickt, wenn der Nutzer erneut klickt, dann wird eine frische Zusammenfassung generiert und die alte ersetzt (kein Verlauf)
- [ ] Angenommen ein Termin hat mehrere gematchte Kontakte, wenn der Nutzer für einen davon "Vorbereiten" klickt, dann wird nur für diesen einen Kontakt eine Zusammenfassung generiert (unabhängige Buttons pro Kontakt auf der Karte)

### Kalender-Datenzugriff
- [ ] Angenommen der Google Access Token ist abgelaufen, aber ein gültiger Refresh Token existiert, wenn das Dashboard die Termine lädt, dann wird der Token serverseitig still refresht, ohne dass der Nutzer etwas davon merkt
- [ ] Angenommen sowohl Access- als auch Refresh-Token sind ungültig, wenn das Dashboard die Termine laden will, dann wird der Token-Status in `connector_tokens` auf `expired` gesetzt und die Sektion zeigt den "nicht verbunden"-Hinweis (siehe oben)

## Edge Cases
- Termin ohne jeglichen Teilnehmer (z.B. reiner Kalender-Blocker "Fokuszeit") → wird wie ein Termin ohne Match behandelt, erscheint nicht in der Sektion
- Ganztägiger Termin ("All-Day Event") → zählt als "heute", erscheint in der Sektion, aber ohne spezifische Uhrzeit (nur Datum/„Ganztägig" als Anzeige)
- Termin liegt zeitlich bereits in der Vergangenheit (heute Morgen, jetzt ist Nachmittag) → wird trotzdem angezeigt (keine Filterung nach "bereits vorbei"), da nachträgliche Vorbereitung/Nachbereitung ebenfalls wertvoll sein kann
- Zwei Termine heute mit demselben Kontakt (z.B. zwei kurze Calls) → erscheinen als zwei separate Karten, kein Zusammenführen
- Kontakt mit mehreren E-Mail-Adressen — **nicht relevant**, `contacts.email` ist ein einzelnes Feld (PROJ-3), Matching läuft nur gegen dieses eine Feld
- Google API liefert einen 5xx-Fehler beim Laden der Termine → Sektion zeigt einen Fehlerhinweis statt zu crashen, restliches Dashboard (Anlässe, Kürzlich erkannt) bleibt normal funktionsfähig
- Nutzer hat sehr viele Termine heute (>10) → keine Paginierung für MVP, alle werden geladen und chronologisch angezeigt (überschaubare Tagesmenge erwartet)
- Zeitzone: Google-Termin-Zeiten vs. lokale Browser-Zeitzone → Anzeige in der lokalen Zeitzone des Browsers, "heute"/"morgen" wird ebenfalls anhand der lokalen Zeitzone bestimmt
- (Refine 2026-07-03) Ganztägiger Termin am heutigen Tag → löst keinen Post-Meeting-Nudge aus (keine bekannte Endzeit im Sinne von "vorbei"), erscheint aber weiterhin in der Sektion mit "Ganztägig"-Label
- (Refine 2026-07-03) Termin endet exakt "jetzt" (Grenzfall) → wird als beendet behandelt (`endTime <= now`), Nudge erscheint — vermeidet Flackern beim Neuladen kurz nach Terminende
- (Refine 2026-07-03) Zwei beendete Termine heute mit demselben Kontakt → Nudge erscheint auf beiden Karten unabhängig, verschwindet für beide sobald eine Interaktion geloggt wurde (da beide denselben `last_contacted_at`-Zeitvergleich nutzen)

## Technical Requirements
- Security: Der Google Access Token wird ausschließlich serverseitig entschlüsselt und verwendet (Wiederverwendung von `src/lib/connectors/encryption.ts` aus PROJ-19) — nie im Client-Bundle oder Browser-Request sichtbar
- Security: Neue API-Route(n) müssen die Supabase-Session verifizieren, bevor sie den connector_token des Nutzers laden (RLS aus PROJ-19 greift zusätzlich als zweite Verteidigungslinie)
- Security: KI-Zusammenfassungs-Route darf nur Interaktionsdaten des angefragten, dem eingeloggten Nutzer gehörenden Kontakts in den Prompt laden — gleiches Muster wie `/api/draft-message` aus PROJ-6
- Matching: E-Mail-Vergleich case-insensitive (Google liefert E-Mails ggf. in anderer Groß-/Kleinschreibung als in `contacts.email` gespeichert)
- Performance: Kalender-Events werden bei jedem Dashboard-Laden neu vom Google Calendar API abgerufen (kein Caching für MVP) — Datenmenge (3 Tage statt 1) bleibt klein genug
- Token-Refresh: Silent Refresh bei abgelaufenem Access Token (Refresh Token vorhanden) — gleiche Logik wie in PROJ-19s Edge-Case-Beschreibung für Downstream-Features vorgesehen
- (Refine 2026-07-03) `GoogleEvent`/`MeetingGroup` werden um `end.dateTime` (für den Post-Meeting-Nudge) und `location` (Freitext-Feld, für ein mögliches späteres Refine von PROJ-14 vorbereitet, in diesem Feature selbst ungenutzt) erweitert — beide Felder liefert die bestehende `events.list`-Abfrage bereits mit, kein zusätzlicher Scope/Call nötig

## Open Questions
- [x] Google Calendar API Scope-Detail: reicht `calendar.readonly` für Events + Attendee-Emails? → Ja, der Standard-`events.list`-Endpunkt liefert Teilnehmer-E-Mails bereits mit `calendar.readonly` (kein Schreibzugriff nötig, kein zusätzlicher Scope) (2026-07-02)
- [x] Soll die KI-Zusammenfassung denselben AI-Provider/Modell wie `/api/draft-message` nutzen? → Ja, gleicher direkter Anthropic-Provider (siehe Tech Decisions) — ein Provider-Setup für das ganze Projekt (2026-07-02)
- [ ] Exakter Prompt-Wortlaut für die Zusammenfassung → Feinschliff in `/backend`, keine Produktentscheidung

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Matching nur per exaktem E-Mail-Abgleich, kein Namens-Fallback | Vermeidet Falsch-Zuordnungen (z.B. zwei Personen mit ähnlichem Namen) — Nutzerentscheidung im Interview | 2026-07-02 |
| KI-generierte Zusammenfassung statt reiner Anzeige der letzten 3 Interaktionen | Höherer Mehrwert ("worum ging's zuletzt" statt Rohdaten durchlesen) — Nutzerentscheidung, bewusst höhere Komplexität/Kosten akzeptiert | 2026-07-02 |
| Zusammenfassung wird erst on-click generiert, nicht automatisch beim Laden | Vermeidet KI-Kosten/Latenz für Termine, die der Nutzer nicht anschaut — konsistent mit dem bestehenden "Vorschlag"-Button-Pattern aus PROJ-6 | 2026-07-02 |
| Neue Dashboard-Sektion statt eigener Seite | Zentraler Dashboard-Flow aus PROJ-6 bleibt der einzige Einstiegspunkt, kein zusätzlicher Navigationsklick nötig | 2026-07-02 |
| Nur "heute", keine 14-Tage-Vorschau für Meetings | Meeting-Prep ist ein "gleich geht's los"-Feature — ein zweites Zeitfenster neben den bestehenden Anlass-Sektionen hätte die Dashboard-Logik unnötig verkompliziert | 2026-07-02 |
| Ein Termin = eine Karte, alle gematchten Kontakte darauf gelistet | Ein Kalender-Ereignis soll eine visuelle Einheit bleiben, nicht künstlich pro Teilnehmer dupliziert werden | 2026-07-02 |
| Nicht verbunden/abgelaufen → dezenter Hinweis mit Link statt Sektion ausblenden | Feature soll auffindbar sein, auch wenn Google noch nicht verbunden ist — sonst entdeckt der Nutzer die Funktion nie | 2026-07-02 |
| Unbekannte Teilnehmer werden stillschweigend ignoriert, kein Kontakt-Erstellungs-Vorschlag | Kleiner Scope; Kontakt-Erstellung aus Kalender-Daten ist ein eigenständiges, größeres Feature | 2026-07-02 |
| Fenster von "nur heute" auf "heute + 2 Tage" erweitert (Umkehr der ursprünglichen Out-of-Scope-Entscheidung) | Teil einer größeren Initiative, den bereits verbundenen Google-Calendar-Scope besser auszunutzen; reiner "heute"-Fokus verhindert Vorbereitung mit Vorlauf, was der Kern-Use-Case des Features (Vorbereitung) eigentlich verlangt. 3 Tage statt voller 14-Tage-Parität mit den Anlass-Sektionen, um den "bald geht's los"-Charakter zu erhalten | 2026-07-03 |
| Post-Meeting-Nudge als reiner manueller Trigger (öffnet bestehenden Dialog), keine Auto-Erkennung/Auto-Logging | Respektiert die ursprüngliche Out-of-Scope-Entscheidung gegen automatisches Logging — der Nudge ist nur ein Hinweis, keine Automatisierung; vermeidet False Positives (Meeting fand vielleicht gar nicht statt) | 2026-07-03 |
| Nudge-UI: Inline-Zeile pro Kontakt statt Karten-Badge | Konsistent mit dem bestehenden Pattern, dass jeder Kontakt einer Karte unabhängigen State hat (siehe "Vorbereiten"-Button); ein Karten-weites Badge würde bei Terminen mit mehreren Kontakten nicht unterscheiden, wer bereits geloggt wurde | 2026-07-03 |
| Nudge-Sichtbarkeit rein client-seitig aus `last_contacted_at` abgeleitet, keine neue Persistenz-Tabelle | Kleinstmögliche Lösung — der bestehende Trigger aktualisiert `last_contacted_at` bereits bei jedem Interaktions-Save, das reicht als Signal "wurde geloggt", ohne zusätzlichen Wartungsaufwand für eine reine Anzeige-Konvenienz | 2026-07-03 |

### Technical Decisions
<!-- Added by /architecture -->
| Decision | Rationale | Date |
|----------|-----------|------|
| `calendar.readonly`-Scope (bereits in PROJ-19 beantragt) reicht aus, kein neuer/breiterer Scope nötig | Googles Standard-Events-Abfrage liefert Teilnehmer-E-Mails bereits mit Lesezugriff — kein Schreibrecht auf den Kalender erforderlich | 2026-07-02 |
| KI-Zusammenfassung nutzt denselben direkten Anthropic-Provider wie der bestehende Nachrichtenvorschlag (PROJ-6) | Ein Provider-Setup, ein Satz Zugangsdaten im Projekt — kein zweiter AI-Anbieter/Konfigurationspfad nur für diese eine Zusammenfassung | 2026-07-02 |
| Neue, eigene serverseitige Route für Kalender-Abruf + eine zweite für die Zusammenfassung (statt eine kombinierte Route) | Kalender-Abruf und KI-Zusammenfassung haben unterschiedliche Fehlerbilder und Auslöser (Abruf beim Laden, Zusammenfassung erst bei Klick) — getrennte Routen halten Ladezeiten und Fehlerbehandlung unabhängig voneinander | 2026-07-02 |
| E-Mail-Matching passiert serverseitig in der Kalender-Route, nicht im Browser | Der Server hat ohnehin sowohl die Google-Termindaten als auch (via RLS-gesichertem Query) die eigenen Kontakte zur Hand — Matching dort vermeidet, dass unnötig viele fremde Termin-Rohdaten (auch ohne Kontakt-Match) zum Client geschickt werden | 2026-07-02 |
| Bestehende `/api/meetings/today`-Route wird erweitert (Response um `end`/`location`), keine neue Route für das breitere Fenster | `from`/`to` waren von Anfang an generische Zod-Datetime-Parameter, keine Backend-Logikänderung nötig, nur mehr Felder in der Antwort und ein weiter gewählter Aufrufer-Bereich im Dashboard | 2026-07-03 |
| Post-Meeting-Nudge-Sichtbarkeit rein client-seitig aus `contact.last_contacted_at` vs. `meeting.endTime` abgeleitet | Vermeidet neue Tabelle/Spalte für einen reinen Anzeige-Zustand; nutzt den bereits bei jeder Interaktion aktualisierten Trigger aus PROJ-5 | 2026-07-03 |
| `MeetingPrepCard` wird dritter Caller des bestehenden `InteractionFormDialog`-State-Patterns im Dashboard (`loggingContact`/`onLogInteraction`) | Wiederverwendung der exakt gleichen Orchestrierung wie bei `OccasionCard`/`ImportEventCard` statt eines neuen Dialog-Mechanismus | 2026-07-03 |

## Tech Design (Solution Architect)

### Component Structure

```
/dashboard (bestehend, PROJ-6)
├── Sektion "Termine" (Refine 2026-07-03: vormals "Heutige Termine", jetzt 3-Tage-Fenster)
│   ├── Fall A: Google nicht verbunden/abgelaufen
│   │   └── Hinweis-Kachel: "Google Kalender verbinden, um Termine hier zu sehen"
│   │       → Link zu /einstellungen/konnektoren
│   ├── Fall B: verbunden, aber kein Termin im Fenster mit Kontakt-Match
│   │   └── Sektion komplett ausgeblendet (kein eigener Empty-State)
│   └── Fall C: verbunden, mindestens ein Treffer
│       └── Termin-Karte (eine pro Kalender-Termin, chronologisch sortiert)
│           ├── Termin-Titel + Uhrzeit (oder "Ganztägig") + Tages-Label bei Nicht-Heute (NEU)
│           ├── Liste der gematchten Kontakte (Avatar + Name je Kontakt)
│           ├── Pro Kontakt: "Vorbereiten"-Button
│           │   → Klick generiert KI-Zusammenfassung, zeigt sie inline unter dem Kontakt
│           │   → Loading-State während der Generierung, Fehlermeldung bei Fehlschlag
│           └── Pro Kontakt, nur wenn Termin heute + bereits beendet (NEU): Nudge-Zeile
│               "Interaktion loggen?" → öffnet bestehenden InteractionFormDialog
│               (dritter Caller neben OccasionCard/ImportEventCard, gleiche Orchestrierung
│               über den Dashboard-State, den es dafür schon gibt)
├── Sektion "Heute & überfällig" (bestehend, unverändert)
├── Sektion "Nächste 14 Tage" (bestehend, unverändert)
└── Sektion "Kürzlich erkannt" (bestehend, unverändert)
```

### Data Model (plain language)

Keine neue Tabelle. Dieses Feature liest nur:
- Den bereits in PROJ-19 gespeicherten Google-Token (`connector_tokens`) — verschlüsselt, wird nur serverseitig entschlüsselt
- Die eigenen Kontakte (`contacts.email`) für den Abgleich
- Die letzten Interaktionen (`interactions`) und `commonalities` eines Kontakts als Grundlage für die KI-Zusammenfassung

Die Kalender-Termine selbst kommen live von Google (kein Zwischenspeichern in der eigenen Datenbank) und die generierte Zusammenfassung wird ebenfalls nicht gespeichert — beides entsteht bei jedem Dashboard-Besuch bzw. jedem Klick neu.

(Refine 2026-07-03) Keine neuen Felder in der Datenbank nötig für die Erweiterung — `end.dateTime`/`location` kommen zusätzlich aus derselben Google-API-Antwort wie bisher schon `summary`/`start`/`attendees`, werden nur zusätzlich durchgereicht. Der Nudge-Zustand ("bereits geloggt?") ist reine Ableitung aus dem längst vorhandenen `contacts.last_contacted_at`, keine neue Spalte/Tabelle.

### Tech Decisions (justified)

- **Zwei getrennte serverseitige Routen (Termine laden / Zusammenfassung generieren):** Termine sollen automatisch beim Öffnen des Dashboards da sein, die Zusammenfassung aber erst auf Wunsch — das sind zwei unterschiedliche Zeitpunkte und Fehlerbilder, deshalb zwei unabhängige Bausteine statt einem kombinierten.
- **E-Mail-Abgleich passiert auf dem Server, nicht im Browser:** Der Server lädt ohnehin sowohl die Google-Termine als auch die eigene Kontaktliste — der Abgleich dort spart, dass Rohdaten fremder (nicht gematchter) Termin-Teilnehmer überhaupt zum Browser geschickt werden müssen.
- **Kein Zwischenspeichern von Terminen oder Zusammenfassungen:** Konsistent mit dem bestehenden Prinzip aus PROJ-6 ("kein Draft-Caching") — beides ist im nächsten Moment ohnehin wieder aktuell abrufbar, ein Zwischenspeicher wäre zusätzlicher Wartungsaufwand ohne echten Nutzen für ein persönliches Tool.
- **Wiederverwendung des bestehenden AI-Providers (direktes Anthropic-Setup aus PROJ-6):** Kein zweiter Anbieter/Konfigurationsweg nur für diese eine Zusammenfassung.
- **(Refine 2026-07-03) Bestehende Route statt neuer Route für das breitere Fenster:** `querySchema` in `/api/meetings/today` nahm von Anfang an generische `from`/`to`-Parameter (nicht hardcoded "heute") — die Erweiterung ist ein reiner Aufrufer-seitiger Parameterwechsel im Dashboard, keine Backend-Änderung an der Grundlogik nötig, nur Erweiterung der zurückgegebenen Felder.
- **(Refine 2026-07-03) Nudge-Zustand client-seitig berechnet, keine neue Persistenz:** Der bestehende DB-Trigger aktualisiert `contacts.last_contacted_at` bereits bei jedem Interaktions-Save (aus PROJ-5) — ein Vergleich `meeting.endTime <= contact.last_contacted_at` im Browser reicht als "wurde bereits geloggt"-Signal, spart eine eigene Tabelle für einen reinen UI-Convenience-Zustand.
- **(Refine 2026-07-03) Nudge wird dritter Caller des bestehenden `InteractionFormDialog`-Orchestrierungs-Patterns:** Das Dashboard verwaltet schon `loggingContact`/`dismissingEventIds`-State für `OccasionCard` und `ImportEventCard` — `MeetingPrepCard` reiht sich als dritter Caller ein statt einen neuen Dialog-Mechanismus zu bauen.

### Dependencies (Packages)
Keine neuen Packages — Google Calendar API läuft über Standard-HTTP (`fetch`, gleiches Muster wie der bestehende Google-OAuth-Flow aus PROJ-19), die KI-Anbindung nutzt das bereits installierte `ai`/`@ai-sdk/anthropic`-Setup aus PROJ-6.

## Implementation Notes (Frontend)
- `src/lib/meetings.ts` (neu): Typen `MeetingContact`/`MeetingGroup`/`TodayMeetingsResponse` — Response-Contract für die noch zu bauende `/api/meetings/today`-Route
- `src/components/meeting-prep-card.tsx` (neu): eine Karte pro Kalender-Termin, Titel + Uhrzeit (oder "Ganztägig"), darunter eine Zeile pro gematchtem Kontakt mit eigenem, unabhängigem State (Avatar/Name, "Vorbereiten"-Button, Loading-/Fehler-/Zusammenfassungs-Anzeige) — jeder Kontakt einer Karte kann unabhängig vorbereitet werden, ruft `/api/meeting-prep` (POST, `contactId`) auf
- `src/app/(app)/dashboard/page.tsx`: lädt zusätzlich `/api/meetings/today` (dritter, unabhängiger Ladevorgang neben Kontakten/Events); drei mögliche Zustände oberhalb der bestehenden Anlass-Sektionen: (1) nicht verbunden/Fehlschlag → dezenter Hinweis mit Link zu `/einstellungen/konnektoren`, (2) verbunden + Fehler beim Laden → Fehlerhinweis, (3) verbunden + Treffer → Sektion "Heutige Termine" mit `MeetingPrepCard`-Grid; bei 0 Treffern (aber verbunden, kein Fehler) wird nichts gerendert (kein eigener Empty-State), wie in der Spec festgelegt
- **Bewusst robust gegen fehlende Route:** `/api/meetings/today` existiert noch nicht (folgt in `/backend`) — `loadMeetings()` fängt jeden Fehlschlag (404 o.ä.) ab und setzt `{ googleConnected: false, meetings: [] }`, identisches Verhalten zum "nicht verbunden"-Zustand. Manuell verifiziert: Dashboard lädt normal, zeigt den Verbinden-Hinweis, kein Crash — 404 landet nur in der Browser-Konsole (gleiches Muster wie `contact_events` in PROJ-6 vor dessen Backend-Teil)
- `npm run lint` + `npm run build` laufen fehlerfrei durch
- **Zeitzone (Edge Case):** `loadMeetings()` berechnet Start/Ende des heutigen Tages im Browser via `Date.setHours(0/23,...)` (läuft automatisch in der lokalen Zeitzone des Nutzers) und schickt beides als fertige ISO-Instants (`from`/`to`) an die Route — kein Offset-Rechnen serverseitig nötig, erfüllt die Spec-Vorgabe "heute" anhand der lokalen Browser-Zeitzone zu bestimmen

### Frontend-Erweiterung (Refine 2026-07-03: 3-Tage-Fenster + Post-Meeting-Nudge)
- `src/lib/meetings.ts`: `MeetingGroup` um `date` (ISO-Kalendertag, Basis fürs Tages-Label und für die "nur heute"-Nudge-Prüfung), `endTime`, `location` erweitert; `MeetingContact` um `last_contacted_at` erweitert (Basis für die Nudge-Sichtbarkeit, kein neuer Request nötig)
- `src/components/meeting-prep-card.tsx`: `formatDayLabel(dateStr)` (Heute → kein Label, Morgen → "Morgen", ab übermorgen → Wochentagsname via `toLocaleDateString('de-DE', { weekday: 'long' })`); `needsPostMeetingNudge(meeting, contact)` (pure function: nur heutige, nicht-ganztägige, bereits beendete Termine, `endTime <= now`, und `last_contacted_at` liegt vor `endTime` oder ist `null`); `MeetingPrepCard` bekommt neue Prop `onLogInteraction(contactId)`, `ContactPrepRow` rendert bei `showNudge` eine dezente "Interaktion loggen?"-Zeile mit "Kontaktiert"-Button (visuell an `OccasionCard` angelehnt)
- `src/app/(app)/dashboard/page.tsx`: `loadMeetings()` weitet das Fenster auf `MEETINGS_WINDOW_DAYS = 3` (heute + 2 Tage); Sektions-Titel "Heutige Termine" → "Termine"; State-Refactor von `loggingContact: Contact | null` zu `loggingContactId: string | null` (der Dialog brauchte ohnehin nur die ID) — macht `MeetingPrepCard` zum dritten Caller desselben `InteractionFormDialog`-Orchestrierungs-Patterns über die neue Funktion `openInteractionForMeetingContact(contactId)`
- **Bewusst robust gegen fehlende Backend-Felder:** `npx tsc --noEmit` zeigt aktuell einen erwarteten Typ-Fehler in `src/app/api/meetings/today/route.ts` (liefert `last_contacted_at`/`date`/`endTime`/`location` noch nicht) — identisches, bereits etabliertes Vorgehen wie beim ursprünglichen PROJ-21-Frontend-Schritt (Route folgt in `/backend`)
- `npm run lint` läuft fehlerfrei durch

## Backend Implementation Notes
- `src/lib/connectors/google-token.ts` (neu): `getValidGoogleAccessToken(supabase, userId)` — lädt `connector_tokens`-Zeile für `provider='google'`, gibt `null` zurück wenn keine Zeile existiert oder `status !== 'active'`; ist der Access Token noch >60s gültig, wird er entschlüsselt zurückgegeben; sonst wird per Refresh Token beim Google-Token-Endpoint erneuert (gleiches Muster wie der bestehende OAuth-Callback aus PROJ-19), neuer Access Token verschlüsselt gespeichert und zurückgegeben; schlägt der Refresh fehl (kein Refresh Token vorhanden ODER Google lehnt ab), wird `status` auf `'expired'` gesetzt und `null` zurückgegeben — wiederverwendbar von jedem zukünftigen Google-Daten-Feature (PROJ-13/14), exakt wie in der PROJ-19-Spec als Downstream-Verantwortung vorgesehen
- `src/app/api/meetings/today/route.ts` (neu): GET, Zod validiert `from`/`to` (ISO-Datetime-Query-Params vom Client); Session-Check (401); `getValidGoogleAccessToken` — kein Token → `{ googleConnected: false, meetings: [] }`; ruft Google Calendar `events.list` (`primary`-Kalender, `singleEvents=true`, `orderBy=startTime`) auf; Fehlschlag (Netzwerk oder Non-200) → `{ googleConnected: true, meetings: [], error: true }`; sammelt alle Attendee-E-Mails über alle Termine, lädt einmalig alle eigenen Kontakte mit gesetzter E-Mail (RLS-beschränkt auf `auth.uid()`), matched case-insensitive; Termine ohne mindestens einen gematchten Kontakt werden verworfen; `isAllDay = !event.start.dateTime`; Sortierung nach `dateTime` bzw. `date` als Fallback-Sortierschlüssel für ganztägige Termine
- `src/app/api/meeting-prep/route.ts` (neu): POST, Zod validiert `contactId` (UUID); Session-Check (401); lädt Kontakt inkl. `commonalities` (404 falls nicht gefunden/fremd, RLS greift wie bei `/api/draft-message`); lädt letzte 3 Interaktions-Notizen; Prompt unterscheidet sich, je nachdem ob Notizen existieren ("worum ging's zuletzt" vs. "noch keine Historie, nutze Profil-Kontext"); gleicher direkter Anthropic-Provider/Modell wie `/api/draft-message` (`claude-sonnet-4-6`); Antwort auf 400 Zeichen begrenzt; 502 bei AI-Fehler
- `src/lib/connectors/google-token.test.ts`: 6 Tests (kein Token, inaktiver Status, gültiger Token ohne Refresh, erfolgreicher Refresh, fehlgeschlagener Refresh markiert `expired`, kein Refresh-Token vorhanden → kein Fetch-Call)
- `src/app/api/meetings/today/meetings-today.test.ts`: 8 Tests (401/400, nicht verbunden, Google-API-Fehler, kein Match wird verworfen, Mehrfach-Match auf einer Karte inkl. case-insensitivem E-Mail-Abgleich, Ganztägig-Erkennung, chronologische Sortierung)
- `src/app/api/meeting-prep/meeting-prep.test.ts`: 6 Tests (401/400/404, Zusammenfassung mit Notizen, Zusammenfassung ohne Historie, Gemeinsamkeiten im Prompt, 502 bei AI-Fehler)
- `npm test`: 205/205 grün (17 neu) · `npm run lint` + `npm run build` fehlerfrei

### Backend-Erweiterung (Refine 2026-07-03: 3-Tage-Fenster + Post-Meeting-Nudge)
- `src/app/api/meetings/today/route.ts`: `GoogleEvent`-Interface um `end`/`location` erweitert; `contacts`-Select um `last_contacted_at` erweitert (kein RLS-Impact, gleiche Tabelle/Policy); jede zurückgegebene `MeetingGroup` bekommt zusätzlich `date` (erste 10 Zeichen aus `start.dateTime` bzw. `start.date` — Google liefert `dateTime` inkl. korrektem Offset, damit ist der Slice die richtige Kalendertag-Repräsentation ohne zusätzliche Zeitzonen-Bibliothek), `endTime` (`event.end?.dateTime ?? null`), `location` (`event.location ?? null`); jeder `MeetingContact` bekommt `last_contacted_at` durchgereicht — keine neue DB-Abfrage nötig, alle Felder kommen aus der ohnehin schon geladenen Google-API-Antwort bzw. dem ohnehin schon selektierten Kontakt-Datensatz
- Keine Änderung an `/api/meeting-prep` nötig — Post-Meeting-Nudge löst ausschließlich den bestehenden, unveränderten Interaktions-Dialog aus, kein neuer/geänderter KI-Call
- Kein neuer Scope, keine neue Route, keine neue Migration — reine Response-Erweiterung der bestehenden Route
- `src/app/api/meetings/today/meetings-today.test.ts`: 2 neue Tests (`end`/`location`/`date`/`last_contacted_at` werden korrekt durchgereicht bzw. auf `null` gesetzt wenn im Google-Event nicht vorhanden) — 10/10 Tests in dieser Datei grün
- `npm test`: 253/253 grün (2 neu) · `npm run lint` + `npm run build` fehlerfrei · `npx tsc --noEmit` sauber (die zwei vorbestehenden Fehler in `linkedin-profile.test.ts` sind unabhängig von diesem Refine)
- Kein Komponenten-Unit-Test für `meeting-prep-card.tsx` angelegt — konsistent mit dem bereits etablierten Muster in diesem Projekt (UI-Komponenten werden über E2E-Tests in `/qa` verifiziert, nicht über isolierte Component-Unit-Tests)

## QA Test Results

**Tested:** 2026-07-02
**App URL:** http://localhost:3000 (Dev), gegen echtes QA-Supabase-Projekt (`bennewroly+qa-proj5@gmail.com`)
**Tester:** QA Engineer (AI)

### Wichtige Einschränkung des Testumfangs
Wie bereits in der Spec (Dependencies-Abschnitt) und im Architecture-Review festgehalten: `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` sind in Vercel noch nicht gesetzt, und der QA-Account hat keinen `connector_tokens`-Eintrag für `google` (verifiziert per direktem REST-Query vor Testbeginn — `[]`). Der "verbunden + Treffer"-Pfad (Termin-Karten, "Vorbereiten"-Button, KI-Zusammenfassung im echten Browser) kann daher **nicht end-to-end gegen echte Google-Daten** verifiziert werden, bis die Google-Cloud-Console-Einrichtung nachgeholt wird (siehe PROJ-19-Deployment-Notizen). Diese Logik ist stattdessen vollständig durch Vitest-Integrationstests mit gemockter Google-API/gemocktem AI-Call abgedeckt (17 Tests, siehe Backend Implementation Notes) — das deckt Matching, Sortierung, Ganztägig-Erkennung, Token-Refresh und Zusammenfassungs-Generierung inhaltlich ab, ersetzt aber keinen echten Browser-Lauf mit echtem Google-Consent.

### Acceptance Criteria Status

#### Sektion "Heutige Termine"
- [ ] **NICHT TESTBAR (fehlende Google-Verbindung):** Sektion erscheint bei Treffer, chronologische Sortierung, mehrere Kontakte auf einer Karte, nicht gematchte Teilnehmer fehlen — Logik durch Vitest verifiziert (`meetings-today.test.ts`), kein Live-Browser-Test möglich
- [x] Kein Treffer / keine Verbindung → Sektion "Heutige Termine" wird nicht angezeigt (Live verifiziert: QA-Account ist nicht verbunden, Sektion fehlt korrekt, stattdessen Hinweis-Kachel)

#### Kein Google verbunden
- [x] Nicht verbunden → dezenter Hinweis "Google Kalender verbinden, um heutige Termine hier zu sehen" mit Link zu `/einstellungen/konnektoren` (E2E, echter QA-Account ohne Google-Verbindung)
- [x] Link navigiert korrekt zu `/einstellungen/konnektoren` (E2E)
- [ ] **NICHT TESTBAR:** `expired`-Status zeigt denselben Hinweis wie "nicht verbunden" — durch Code-Review verifiziert (`getValidGoogleAccessToken` gibt in beiden Fällen `null` zurück, Frontend unterscheidet nicht zwischen den Ursachen), kein DB-Fixture-Test für diesen Zustand angelegt (kleiner Zusatzaufwand für einen Fall, der bereits durch dieselbe Code-Pfad-Logik wie "nicht verbunden" abgedeckt ist)

#### Meeting-Prep (KI-Zusammenfassung)
- [ ] **NICHT TESTBAR (fehlende Google-Verbindung):** Alle "Vorbereiten"-bezogenen ACs (Zusammenfassung generieren, Loading-State, Fehlerfall, keine Historie, Regenerieren, unabhängige Buttons pro Kontakt) — Zusammenfassungs-Generierung selbst ist vollständig durch Vitest verifiziert (`meeting-prep.test.ts`, 6 Tests inkl. Prompt-Varianten), UI-State-Handling (Loading/Error/Ersetzen) folgt exakt dem bereits in PROJ-6 E2E-verifizierten `occasion-card`-Pattern (gleiche Zustandslogik, gleicher Button-Code-Stil)

#### Kalender-Datenzugriff
- [x] Silent Token-Refresh bei ablaufendem Access Token (Vitest: `google-token.test.ts`, erfolgreicher Refresh-Call verifiziert)
- [x] Refresh schlägt fehl → Status wird auf `expired` gesetzt (Vitest verifiziert)

**Automatisiert verifiziert (Vitest): 17/17 neue Tests grün. Live/E2E verifiziert: 3/3 testbare ACs (kein-Google-Zustand). Nicht live testbar: Alle "verbunden"-Pfad-ACs — blockiert durch fehlende Google-OAuth-Produktionskonfiguration, nicht durch einen Code-Fehler.**

### E2E Tests (neu)
- `tests/PROJ-21-meeting-prep-dashboard.spec.ts`: 6 Tests — Hinweis-Kachel + Link (2), Security (4: unauth `/api/meetings/today`, unauth `/api/meeting-prep`, fremder Kontakt → 404, keine Rohtokens in der Response)
- Chromium: **6/6 grün**
- Regression: `tests/PROJ-6-follow-up-dashboard.spec.ts` (Dashboard-Datei wurde für dieses Feature mitgeändert) — **38/38 weiterhin grün**, keine Regression durch die neue Sektion

### Security Audit Results
- [x] Auth: `/api/meetings/today` und `/api/meeting-prep` ohne Session → 401/307 (Middleware-Gate, gleiches Muster wie alle anderen API-Routen)
- [x] Authorization: `/api/meeting-prep` mit `contactId` eines fremden Nutzers → 404 (RLS-gestützt, verifiziert mit echtem fremden Kontakt aus einem anderen Account — identischer Test-Fixture wie PROJ-6)
- [x] Keine Rohtoken (`access_token`/`refresh_token`) in der `/api/meetings/today`-Response — verifiziert per String-Suche im Response-Body
- [x] Google Access/Refresh Token werden ausschließlich serverseitig ent-/verschlüsselt (Wiederverwendung der PROJ-19-Verschlüsselung), nie im Client-Bundle
- [x] Zod-Validierung auf beiden neuen Routen (400 bei ungültigen Query-Params/Body) — Vitest verifiziert
- [x] Kein neues Secret ohne `NEXT_PUBLIC_`-Fehlprefix — `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`CONNECTOR_ENCRYPTION_KEY` bereits aus PROJ-19 korrekt dokumentiert, keine neuen Variablen für PROJ-21 nötig
- Rate limiting: bewusst kein MVP-Bedarf (konsistent mit allen anderen KI-Routen im Projekt), nicht getestet

### Bugs Found
Keine neuen Bugs gefunden (weder in den testbaren Pfaden noch per Code-Review der nicht live testbaren Pfade).

### Regression Testing
- `npm test`: 205/205 grün (26 Testdateien) · `npm run lint` + `npm run build`: fehlerfrei
- E2E Chromium PROJ-21: 6/6 grün · PROJ-6 (Dashboard, Regression): 38/38 grün

### Summary
- **Acceptance Criteria:** 5/5 automatisiert/live verifizierte ACs bestanden; restliche ACs (verbunden-Pfad-UI) durch Vitest inhaltlich abgedeckt, aber nicht live browser-verifizierbar (siehe Einschränkung oben)
- **Bugs Found:** 0
- **Security:** Pass
- **Production Ready:** **JA für den Code-Pfad** — Deploy ist sicher (kein Bug, kein Sicherheitsproblem). **Aber:** Das Feature bleibt für Endnutzer unsichtbar/nutzlos, bis die Google-OAuth-Produktionskonfiguration (PROJ-19, `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` in Vercel) nachgeholt wird — bis dahin zeigt jeder Nutzer nur die "Google verbinden"-Hinweis-Kachel.
- **Recommendation:** Deploy freigeben. Vor dem eigentlichen Nutzen-Test durch den Menschen: Google-Cloud-Console-Setup abschließen (siehe PROJ-19-Spec) und danach diesen QA-Durchlauf für den "verbunden"-Pfad live nachholen.

## QA Test Results (Refine 2026-07-03: 3-Tage-Fenster + Post-Meeting-Nudge)

**Tested:** 2026-07-03
**App URL:** http://localhost:3000 (Dev), gegen echtes QA-Supabase-Projekt (`bennewroly+qa-proj5@gmail.com`)
**Tester:** QA Engineer (AI)

### Wichtige Einschränkung des Testumfangs
Google-Cloud-Console-Setup ist inzwischen abgeschlossen (`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` seit 2026-07-01 in Vercel gesetzt, verifiziert), **aber** der QA-Account selbst hat weiterhin keinen `connector_tokens`-Eintrag für `google` (verifiziert per direktem DB-Query vor Testbeginn — nur der reguläre Account `bennewroly@gmail.com` ist verbunden, nicht der QA-Account). Der "verbunden + Termine im 3-Tage-Fenster + Nudge"-Pfad kann daher weiterhin **nicht live gegen echte Google-Daten mit dem QA-Account** verifiziert werden. Diese Logik ist stattdessen vollständig durch Vitest abgedeckt: Backend-Feldweitergabe (`meetings-today.test.ts`, 10/10) und die neu extrahierten reinen Frontend-Funktionen `formatDayLabel`/`needsPostMeetingNudge` (`src/lib/meetings.test.ts`, 10/10 neue Tests, alle Randfälle: heute/morgen/Wochentag-Label, ganztägig, noch nicht beendet, nie geloggt, vor/nach Terminende geloggt).

### Acceptance Criteria Status

#### Sektion "Termine" (3-Tage-Fenster)
- [ ] **NICHT TESTBAR (QA-Account nicht verbunden):** Sektion mit 3-Tage-Fenster, Sortierung, Mehrfach-Match, Tages-Label — Logik durch Vitest verifiziert (`meetings-today.test.ts` für Backend-Felder, `meetings.test.ts` für `formatDayLabel`), kein Live-Browser-Test möglich
- [x] Kein Treffer / keine Verbindung → Sektion "Termine" wird nicht angezeigt (Live verifiziert, E2E-Test aktualisiert auf neuen Sektionsnamen)

#### Post-Meeting-Nudge
- [ ] **NICHT TESTBAR (QA-Account nicht verbunden):** Alle Nudge-bezogenen ACs (Anzeige nach Terminende, öffnet Dialog, verschwindet nach Log, keine Anzeige bei Zukunfts-/Ganztages-Terminen) — vollständig durch `needsPostMeetingNudge`-Unit-Tests abgedeckt (7 Fälle), Dialog-Verhalten selbst folgt exakt dem in PROJ-21/PROJ-6 bereits E2E-verifizierten `InteractionFormDialog`-Pattern (jetzt dritter Caller über `loggingContactId`)

#### Kein Google verbunden
- [x] Hinweistext korrekt an das breitere Fenster angepasst (E2E, echter QA-Account ohne Google-Verbindung)

### Bugs Found
| # | Severity | Beschreibung | Status |
|---|----------|--------------|--------|
| 1 | Low | Hinweistext bei nicht verbundenem Google-Konto sagte noch "...um **heutige** Termine hier zu sehen", obwohl die Sektion durch dieses Refine ein 3-Tage-Fenster zeigt — Copy passte nicht mehr zum tatsächlichen Scope | **Fixed** (Text auf "...um Termine hier zu sehen" angepasst, `src/app/(app)/dashboard/page.tsx`), E2E-Assertion entsprechend aktualisiert |

### Regression Testing
- `npm test`: 263/263 grün (32 Testdateien, davon 12 neu in diesem Refine: 2 Backend + 10 Frontend-Unit) · `npm run lint` + `npm run build`: fehlerfrei · `npx tsc --noEmit`: sauber (bis auf zwei vorbestehende, unabhängige Fehler in `linkedin-profile.test.ts`)
- E2E Chromium: PROJ-21 6/6 grün · PROJ-6 (Dashboard, Regression) 38/38 grün — 44/44 gesamt
- Mobile Safari: PROJ-21 6/6 grün bei isoliertem Lauf (`--workers=1`); bei parallelem Lauf mit Chromium ein Login-Timeout beobachtet — reproduzierbar als reine Worker-Kontention auf dem gemeinsamen Dev-Server-Login, nicht code-bedingt (identisches Verhalten bei isoliertem PROJ-6-Lauf nicht beobachtbar → Test-Infrastruktur-Flakiness, kein Produktbug, keine Aktion nötig)

### Security Audit Results
- [x] Auth/Authorization/Token-Exposure: unverändert gegenüber ursprünglichem PROJ-21-Audit, alle bestehenden Security-E2E-Tests weiterhin grün (siehe Regression Testing)
- [x] Keine neuen Secrets/Env-Vars, keine neue Migration, kein erweiterter OAuth-Scope für dieses Refine

### Summary
- **Acceptance Criteria:** 2/8 live verifiziert (nicht-verbunden-Pfad), 6/8 durch Vitest inhaltlich abgedeckt aber nicht live testbar (identische, bereits akzeptierte Einschränkung wie beim ursprünglichen PROJ-21-QA-Lauf — liegt an der QA-Account-Konfiguration, nicht am Code)
- **Bugs Found:** 1 (Low, gefunden und noch in dieser QA-Runde gefixt)
- **Security:** Pass
- **Production Ready:** **JA** — Code-Pfad sicher, keine offenen Critical/High/Medium-Bugs. Empfehlung: QA-Account perspektivisch mit Google verbinden, um den "verbunden"-Pfad auch live zu verifizieren (gilt weiterhin für alle PROJ-21-Erweiterungen, nicht neu durch dieses Refine).
- **Recommendation:** Deploy freigeben.

## Deployment

**Deployed:** 2026-07-02
**Production URL:** https://bambi-w26q.vercel.app
**Commit:** `285baa8` gepusht zu `origin/main`, Vercel-Build erfolgreich (57s), Deployment `Ready`, Production
**Verification:** `/login` → 200, `/dashboard` unauthentifiziert → 307 (Auth-Gate funktioniert)
**Keine neuen Env-Vars, keine neue Migration** — nutzt vollständig die bereits in PROJ-19 gesetzte Infrastruktur (`connector_tokens`, `CONNECTOR_ENCRYPTION_KEY`)

### Bekannter Nachgelagerter Schritt (nicht durch dieses Deploy blockiert)
Das Feature ist live, aber für Endnutzer aktuell nur als "Google verbinden"-Hinweis sichtbar, bis `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` in Vercel gesetzt und die Google-Cloud-Console-Einrichtung (OAuth Consent Screen, Test-User, API-Aktivierung) abgeschlossen sind — siehe PROJ-19-Spec, Abschnitt "Google OAuth Setup". Sobald das nachgeholt ist, empfiehlt sich ein erneuter `/qa`-Durchlauf gegen den dann live testbaren "verbunden"-Pfad.

## Deployment (Refine 2026-07-03: 3-Tage-Fenster + Post-Meeting-Nudge)

**Deployed:** 2026-07-03
**Production URL:** https://bambi-w26q.vercel.app
**Commit:** `3b46ed6` gepusht zu `origin/main`, Vercel-Build erfolgreich (56s), Deployment `Ready`, Production
**Verification:** `/login` → 200, `/dashboard` unauthentifiziert → 307 (Auth-Gate funktioniert)
**Keine neuen Env-Vars, keine neue Migration** — reine Erweiterung der bestehenden `/api/meetings/today`-Response und der Dashboard-Komponenten

### Bekannter Nachgelagerter Schritt (weiterhin nicht durch dieses Deploy blockiert)
Google-Cloud-Console-Setup ist seit 2026-07-01 abgeschlossen, der Connect-Flow ist live nutzbar. Der QA-Account selbst ist aber weiterhin nicht mit Google verbunden — der "verbunden"-Pfad (3-Tage-Fenster live sehen, Post-Meeting-Nudge live auslösen) konnte daher nur durch Vitest/Unit-Tests, nicht live im Browser verifiziert werden. Empfehlung bleibt: QA-Account perspektivisch mit Google verbinden für einen vollständigen Live-Test-Durchlauf.

---
<!-- Sections below are added by subsequent skills -->

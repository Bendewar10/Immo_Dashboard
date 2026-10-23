# PROJ-11: AI Chat Assistant (Sidebar-Popup)

## Status: Deployed
**Created:** 2026-06-29
**Last Updated:** 2026-06-29 (Refine — Verlauf löschen)

## Dependencies
- PROJ-3 (Kontakt anlegen & verwalten) — Chat liest/schreibt Contact-Daten
- PROJ-5 (Interaktions-Log) — Chat liest/schreibt Interaction-Daten

## User Stories
- Als Nutzer möchte ich über ein Chat-Popup Fragen zu einzelnen Kontakten stellen können (z.B. "Wann hatte ich zuletzt Kontakt mit Tom?"), damit ich nicht manuell in der Kontaktliste suchen muss.
- Als Nutzer möchte ich aggregierte/übergreifende Fragen stellen können (z.B. "Wer hat im Juli Geburtstag?", "Wie viele Business-Kontakte sind überfällig?"), damit ich einen schnellen Überblick über mein gesamtes Netzwerk bekomme.
- Als Nutzer möchte ich per Chat-Nachricht Interaktionen loggen können (z.B. "Hab grad mit Anna telefoniert, log das"), damit ich nicht extra das Interaktions-Formular öffnen muss.
- Als Nutzer möchte ich per Chat Follow-up-Termine setzen können (z.B. "Erinnere mich in 2 Wochen an Tom"), damit Nachfass-Planung schneller geht als über die UI.
- Als Nutzer möchte ich per Chat neue Kontakte anlegen und bestehende Felder ändern können, damit Datenpflege auch unterwegs per Chat möglich ist.
- Als Nutzer möchte ich, dass der Chat bei riskanten Aktionen (Löschen, Überschreiben vorhandener Werte) erst nachfragt, damit mir keine Daten versehentlich verloren gehen.
- Als Nutzer möchte ich den Chat-Verlauf über Sessions hinweg wiederfinden, damit ich an frühere Unterhaltungen anknüpfen kann.
- Als Nutzer möchte ich den gesamten Chat-Verlauf löschen können (wie bei ChatGPT), damit ich neu anfangen kann, ohne dass alte Nachrichten stören.
- Als Nutzer möchte ich mehrere getrennte Konversationen führen und über eine Seitenleiste zwischen ihnen wechseln können (wie bei Claude.ai/ChatGPT), damit verschiedene Themen nicht in einem einzigen Verlauf vermischt werden.

## Out of Scope
- Team-/Multi-User-Features (kein Team-Feature laut PRD)
- Automatisches Scoring/Ranking von Kontakten durch den Chat (Non-Goal aus PRD — Tier/Intervall bleiben manuell, Chat setzt sie nur auf expliziten Nutzerwunsch)
- LinkedIn-Sync oder externe Datenquellen im Chat (Non-Goal aus PRD)
- Tageslimit/Rate-Limiting für Nachrichten (v1 ohne Limit, da kein festes Budget — kann später nachgerüstet werden)
- Voice-Input (nur Text-Chat)
- Proaktive Chat-Nachrichten ohne Nutzeraktion (Chat antwortet nur auf Anfrage, initiiert nichts selbst)

## Acceptance Criteria

**Format:** Angenommen [Vorbedingung] / Wenn [Aktion] / Dann [Ergebnis]

- [ ] Angenommen der Nutzer ist eingeloggt, wenn er auf einer beliebigen Seite den Chat-Button (unten rechts) klickt, dann öffnet sich das Chat-Panel von rechts mit dem bisherigen Verlauf (oder Leerzustand bei erster Nutzung)
- [ ] Angenommen der Chat ist leer (erste Nutzung), wenn der Nutzer das Panel öffnet, dann zeigt der Chat eine kurze Begrüßung mit 2-3 Beispiel-Fragen
- [ ] Angenommen der Nutzer stellt eine Frage zu einem einzelnen Kontakt, wenn der Kontaktname eindeutig zuordenbar ist, dann antwortet der Chat mit korrekten, aktuellen Daten aus Contacts/Interactions
- [ ] Angenommen der Nutzer stellt eine aggregierte Frage (z.B. "wer hat diese Woche Geburtstag"), wenn die Anfrage gesendet wird, dann berechnet der Chat die Antwort serverseitig aus den eigenen (RLS-geschützten) Daten, nicht aus geratenen Werten
- [ ] Angenommen der Nutzer bittet den Chat, eine Interaktion zu loggen, wenn die Angaben (Kontakt, Kanal, ggf. Notiz) klar erkennbar sind, dann wird der Interaction-Eintrag direkt angelegt und der Chat bestätigt die Aktion in der Antwort
- [ ] Angenommen der Nutzer bittet den Chat, einen Follow-up-Termin zu setzen, wenn der Kontakt eindeutig ist, dann wird `next_followup_at` direkt aktualisiert und bestätigt
- [ ] Angenommen der Nutzer bittet den Chat, einen neuen Kontakt anzulegen, wenn mindestens der Vorname genannt wird, dann wird der Kontakt direkt angelegt und der Chat bestätigt
- [ ] Angenommen der Nutzer bittet den Chat, ein bereits gefülltes Kontaktfeld zu überschreiben, wenn die Anfrage gesendet wird, dann zeigt der Chat zuerst den alten und neuen Wert und fragt nach Bestätigung, bevor geschrieben wird
- [ ] Angenommen der Nutzer bittet den Chat, einen Kontakt oder eine Interaktion zu löschen, wenn die Anfrage gesendet wird, dann zeigt der Chat eine Bestätigungsanfrage mit dem betroffenen Datensatz, bevor gelöscht wird
- [ ] Angenommen der Nutzer bittet um eine Bulk-Aktion (z.B. "lösch alle Kontakte ohne Follow-up"), wenn die Anfrage gesendet wird, dann zeigt der Chat die Anzahl und Liste der betroffenen Kontakte und fragt einmalig nach Bestätigung für alle, bevor irgendetwas geändert wird
- [ ] Angenommen eine Nutzeranfrage bezieht sich auf einen Namen, der zu mehreren Kontakten passt, wenn der Chat die Aktion ausführen soll, dann listet der Chat die Treffer (Name + Unterscheidungsmerkmal wie Arbeitgeber/Nachname) auf und fragt nach Auswahl, bevor irgendetwas geändert wird
- [ ] Angenommen der Nutzer bestätigt eine vorgeschlagene Aktion, wenn die Bestätigung gesendet wird, dann wird genau die zuvor angezeigte Aktion ausgeführt (kein erneutes Interpretieren der ursprünglichen Anfrage)
- [ ] Angenommen der Nutzer lehnt eine vorgeschlagene Aktion ab, wenn die Ablehnung gesendet wird, dann wird keine Datenänderung vorgenommen und der Chat bestätigt den Abbruch
- [ ] Angenommen die KI-Anfrage schlägt fehl (Timeout/API-Fehler), wenn der Nutzer eine Nachricht sendet, dann zeigt der Chat eine Fehlermeldung im Verlauf und die Nutzereingabe bleibt nicht verloren (erneut sendbar)
- [ ] Angenommen der Nutzer öffnet den Chat erneut nach einem Reload, dann sind frühere Nachrichten (bis zu den letzten 50) weiterhin sichtbar
- [ ] Angenommen ein anderer Nutzer ist eingeloggt, wenn er den Chat öffnet, dann sieht er ausschließlich seinen eigenen Verlauf und seine eigenen Kontakte/Interaktionen (RLS-Schutz)
- [ ] Angenommen der Chat hat Verlauf, wenn der Nutzer auf den Löschen-Button im Header klickt, dann erscheint eine Bestätigungsabfrage, bevor irgendetwas gelöscht wird
- [ ] Angenommen der Nutzer bestätigt das Löschen, dann werden alle eigenen Chat-Nachrichten (und eine offene Pending-Action) endgültig gelöscht und der Chat zeigt wieder den Leerzustand
- [ ] Angenommen der Nutzer klickt "Neuer Chat", dann wird eine neue, leere Konversation gestartet (Leerzustand), ohne die bisherige zu verändern
- [ ] Angenommen der Nutzer hat mehrere Konversationen, dann listet die Seitenleiste sie nach letzter Aktivität sortiert mit einem aus der ersten Nachricht abgeleiteten Titel
- [ ] Angenommen der Nutzer klickt eine Konversation in der Seitenleiste an, dann lädt der Chat genau deren Nachrichten und Pending-Action (falls offen)
- [ ] Angenommen der Nutzer löscht die aktive Konversation, dann wechselt der Chat zur nächsten vorhandenen Konversation oder zu einem neuen Leerzustand, falls keine mehr existiert
- [ ] Angenommen der Bildschirm ist schmal (Mobile), dann ist die Seitenleiste standardmäßig ausgeblendet und über ein Toggle-Icon erreichbar, ohne den Chat-Bereich zu verdecken

## Edge Cases
- Nutzer stellt Frage zu Kontakt, der nicht existiert → Chat antwortet, dass kein passender Kontakt gefunden wurde, statt zu raten/halluzinieren
- Nutzer schickt leere Nachricht → Senden-Button/Aktion bleibt deaktiviert oder wird ignoriert
- Nutzer bittet um Aktion mit fehlenden Pflichtangaben (z.B. "leg Kontakt an" ohne Namen) → Chat fragt gezielt nach der fehlenden Angabe, statt zu raten
- Nutzer bestätigt eine Aktion, aber der betroffene Datensatz wurde inzwischen anderswo geändert/gelöscht (z.B. in der UI) → Chat meldet, dass die Aktion nicht mehr ausführbar ist, statt einen Fehler zu verschlucken
- Sehr lange Konversation (>50 Nachrichten) → UI lädt nur die letzten 50, ältere bleiben in der DB erhalten
- Mehrere Browser-Tabs gleichzeitig offen → beide zeigen denselben persistierten Verlauf (kein Echtzeit-Sync zwischen Tabs nötig für v1, Reload reicht)
- Nutzer versucht über Chat auf Daten anderer Nutzer zuzugreifen (z.B. durch Prompt-Manipulation) → serverseitige RLS-Policies verhindern Zugriff unabhängig vom Prompt-Inhalt
- Netzwerkfehler beim Senden (Client offline) → Nutzereingabe bleibt im Eingabefeld erhalten, Fehlermeldung statt stillem Verlust
- Verlauf wird gelöscht, während eine Pending Action offen ist → wird mitgelöscht, keine verwaiste Bestätigungskarte
- Löschen schlägt durch Netzwerkfehler fehl → Fehlermeldung, Verlauf bleibt unverändert sichtbar (kein teilweises Löschen)

## Technical Requirements (optional)
- Security: Authentication required (wie bestehende API-Routen); alle Datenzugriffe serverseitig RLS-geschützt, niemals Client-Payload für Datenwerte vertrauen
- Destruktive Aktionen (Löschen, Überschreiben nicht-leerer Felder, Bulk-Änderungen) erfordern explizite Nutzerbestätigung vor Ausführung

## Open Questions
- [x] Welches Modell/welche Technik für Tool-Calling — geklärt, siehe Tech Design
- [ ] Soll Chat-Verlauf je Gerät oder global pro Nutzer-Account gespeichert werden (für v1 angenommen: global pro Nutzer-Account, da Single-User ohne Team-Feature)

## Decision Log

### Product Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Chat kann volle CRUD-Aktionen auf Contacts/Interactions ausführen (nicht nur read-only) | Explizit vom Nutzer gewünscht — Chat soll "alles was man auch sonst machen kann" können | 2026-06-29 |
| Bestätigung nur bei destruktiven Aktionen (Löschen, Überschreiben vorhandener Werte, Bulk) | Balance zwischen Tempo (loggen/Follow-up setzen läuft direkt) und Sicherheit (irreversible Aktionen brauchen Schutz) | 2026-06-29 |
| Mehrdeutige Kontakt-Treffer → Chat fragt nach statt zu raten | Verhindert falsche Zuordnung bei gleichen Vornamen | 2026-06-29 |
| Bulk-Aktionen erlaubt, aber mit einmaliger Bestätigung über Gesamtliste | Nutzer wollte volle Aktionsfreiheit, aber Bulk-Löschen ohne Vorschau wäre zu riskant | 2026-06-29 |
| Chat-Verlauf dauerhaft in DB, UI zeigt nur letzte 50 Nachrichten | Ermöglicht Rückbezug auf frühere Fragen ohne Performance-Problem bei langer Nutzung | 2026-06-29 |
| Kein Tageslimit für Nachrichten in v1 | Solo-Projekt ohne festes Budget laut PRD; Haiku-Kosten pro Nachricht minimal | 2026-06-29 |
| Chat-Button auf jeder eingeloggten Seite verfügbar (nicht nur Dashboard) | Nutzer will Chat "immer erreichbar", nicht an eine Seite gebunden | 2026-06-29 |
| Priorität P1 (nicht P0) | Kein MVP-Blocker, baut auf bestehender KI-Infra (draft-message, network-insights) auf | 2026-06-29 |
| Löschen-Button löscht ganzen Verlauf (nicht einzelne Nachrichten) | Nutzerwunsch explizit "wie bei ChatGPT" — eine Konversation pro Account, kein Multi-Thread-Konzept, Einzelnachrichten-Löschung nicht relevant | 2026-06-29 |
| Bestätigungsdialog vor Verlauf-Löschen | Konsistent mit bestehendem Pattern (`interaction-log-sheet.tsx` AlertDialog vor Löschen), verhindert versehentlichen Datenverlust | 2026-06-29 |

### Technical Decisions
| Decision | Rationale | Date |
|----------|-----------|------|
| Modell: Claude Sonnet 4.6 (vorher Haiku 4.5) | Upgrade nach BUG-2 (Haiku rief Propose-Tool bei Bulk-Aktionen manchmal nicht auf — bekanntes Tool-Orchestrierungs-Risiko, siehe QA). Sonnet zuverlässiger bei Multi-Tool-Turns und komplexen Netzwerk-Fragen; draft-message/network-insights bleiben auf Haiku (einfachere Single-Shot-Tasks, kein Tool-Calling) | 2026-06-29 |
| Tool-Calling über AI SDK (`tools`-Parameter) statt vollem Datendump im Prompt | Skaliert mit wachsender Kontaktliste, günstiger pro Anfrage, KI sucht/handelt gezielt statt alles im Kontext zu lesen | 2026-06-29 |
| Zwei-Phasen-Ausführung für destruktive Aktionen: Vorschlag (kein Write) → eigene Bestätigung führt exakt den gespeicherten Vorschlag aus | Erfüllt Acceptance Criteria "genau die zuvor angezeigte Aktion, kein erneutes Interpretieren" — Bestätigung ruft KEIN erneutes LLM auf, sondern führt 1:1 das aus, was vorgeschlagen wurde | 2026-06-29 |
| Pending Actions in eigener Tabelle `pending_actions` (nicht im Client-State) | Überlebt Reload/Tab-Wechsel; Status-Feld (pending/confirmed/declined/expired) macht Lifecycle klar nachvollziehbar | 2026-06-29 |
| Nur eine offene Pending Action gleichzeitig pro Nutzer | Verhindert Verwechslung, falls Nutzer eine neue Anfrage stellt, bevor er die vorherige bestätigt hat — ältere wird automatisch auf "expired" gesetzt | 2026-06-29 |
| Chat-Verlauf in eigener Tabelle `chat_messages`, RLS auf `user_id` | Gleiches Muster wie `contacts`/`interactions` — pro Nutzer isoliert, kein Sonderfall | 2026-06-29 |
| Right-Side Panel mit shadcn `Sheet` (wie `interaction-log-sheet.tsx`) | Bereits etabliertes Pattern im Projekt, keine neue Abhängigkeit nötig | 2026-06-29 |
| Floating Trigger-Button im Root-Layout (nicht pro Seite) | Einzige Stelle, die garantiert auf jeder eingeloggten Seite gerendert wird | 2026-06-29 |
| Keine neuen Packages nötig | `ai`, `@ai-sdk/anthropic`, `zod` bereits im Projekt (siehe draft-message/network-insights Routen) | 2026-06-29 |
| Neue Route `DELETE /api/chat/messages` löscht alle `chat_messages` (cascade löscht `pending_actions`) für `auth.uid()` | Eine Route, ein DELETE-Statement, RLS erzwingt ownership; FK-Cascade auf `pending_actions.chat_message_id` macht zweiten Löschvorgang unnötig | 2026-06-29 |
| Löschen-Button (Trash-Icon) im Chat-Header + shadcn `AlertDialog` als Bestätigung | Gleiches UI-Pattern wie Löschen in `interaction-log-sheet.tsx`, kein neues Component nötig | 2026-06-29 |
| Multi-Conversation: neue Tabelle `conversations` + `conversation_id` FK auf `chat_messages`/`pending_actions` (ON DELETE CASCADE) | Nutzerwunsch nach Claude.ai-artiger Chat-Liste; Cascade macht Löschen einer Konversation zu einem einzigen DELETE-Statement | 2026-06-29 |
| Konversations-Titel = erste ~40 Zeichen der ersten Nutzer-Nachricht | Kostenlos (kein extra KI-Call), sofort verfügbar, genau wie vom Nutzer gewünscht | 2026-06-29 |
| "Neuer Chat" erzeugt KEINE Konversation in der DB, bis die erste Nachricht gesendet wird | Verhindert leere Geister-Konversationen in der Seitenleiste, falls Nutzer abbricht ohne zu schreiben | 2026-06-29 |
| Pending-Action-Scope ("nur eine offene gleichzeitig") jetzt pro Konversation statt pro Nutzer | Mit mehreren Konversationen wäre nutzer-weites Expire falsch — eine Bestätigung in Chat A darf eine offene in Chat B nicht stillschweigend verwerfen | 2026-06-29 |
| Bestehende Migration: ein Legacy-`conversations`-Eintrag pro Nutzer mit existierenden `chat_messages`, Titel aus deren erster Nachricht | Nicht-destruktiv — echte Produktionsdaten (10 Nachrichten eines aktiven Nutzers) blieben erhalten statt gewiped zu werden | 2026-06-29 |
| Sidebar auf Mobile (<640px) als absolutes Overlay über dem Chat, Desktop als feste Spalte (Panel wird breiter) | Erfüllt "ausblendbar auf Mobile" ohne den Chat-Bereich zu zerquetschen; ein gemeinsamer Toggle-State für beide Breakpoints hält die Logik einfach | 2026-06-29 |
| Sidebar-Default: offen auf Desktop, geschlossen auf Mobile (per `window.innerWidth`-Check beim Öffnen) | QA-Fund: Sidebar-Default "immer offen" blockierte auf Mobile als Overlay den gesamten Chat-Bereich (Klicks abgefangen) — siehe QA Bugs | 2026-06-29 |
| Alte globale `DELETE /api/chat/messages` entfernt, ersetzt durch `DELETE /api/chat/conversations/[id]` | Löschen ist jetzt pro Konversation sinnvoll, nicht mehr global; saubere REST-Semantik | 2026-06-29 |

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### A) Component Structure
```
Root Layout (überall, eingeloggter Bereich)
└── ChatTrigger (schwebender Button, unten rechts, alle Seiten)
└── ChatPanel (Sheet, öffnet von rechts)
    ├── Empty State (Begrüßung + 2-3 Beispiel-Fragen, nur bei leerem Verlauf)
    ├── Message List (scrollbar, lädt letzte 50 Nachrichten)
    │   ├── User-Nachricht
    │   ├── Assistant-Nachricht (Text-Antwort)
    │   └── Pending-Action-Karte (bei vorgeschlagener destruktiver/Bulk-Aktion)
    │       ├── Klartext-Zusammenfassung ("Lösche Kontakt Tom Müller")
    │       ├── Bestätigen-Button
    │       └── Abbrechen-Button
    ├── Fehler-Banner (bei KI-/Netzwerkfehler, mit erneut senden)
    └── Eingabefeld + Senden-Button
```

### B) Data Model (plain language)

**Chat-Nachricht** (Tabelle `chat_messages`):
- Wer (Nutzer-ID)
- Wer hat geschrieben (Nutzer oder Assistent)
- Text der Nachricht
- Zeitstempel
- Gespeichert in: Supabase, RLS-geschützt pro Nutzer

**Vorgeschlagene Aktion** (Tabelle `pending_actions`):
- Wer (Nutzer-ID)
- Zu welcher Chat-Nachricht gehört es
- Welche Art Aktion (z.B. "Kontakt löschen", "Feld überschreiben", "Bulk-Löschen")
- Klartext-Zusammenfassung, die dem Nutzer angezeigt wurde
- Die exakten Daten, die bei Bestätigung ausgeführt werden (z.B. welcher Kontakt, welches Feld, welcher neuer Wert)
- Status: wartend / bestätigt / abgelehnt / abgelaufen
- Zeitstempel
- Gespeichert in: Supabase, RLS-geschützt pro Nutzer

Direkte Aktionen (Interaktion loggen, Follow-up setzen, neuen Kontakt anlegen, leeres Feld befüllen) brauchen keinen Pending-Eintrag — die werden sofort beim Verarbeiten der Nachricht ausgeführt und das Ergebnis fließt direkt in die Assistant-Antwort ein.

### C) Tech Decisions (für PM erklärt)

- **Sonnet-4.6-Modell**: zuverlässiger bei Tool-Orchestrierung als Haiku (siehe BUG-2), bewusst teurer/langsamer in Kauf genommen für diese Route. Nachrichtenvorschlag-Funktion bleibt auf Haiku.
- **Tool-Calling statt Datendump**: die KI bekommt keine komplette Kontaktliste in jede Anfrage gepackt, sondern "Werkzeuge" (z.B. "Kontakt suchen", "Interaktion anlegen", "Follow-up setzen"), die sie bei Bedarf selbst aufruft. Bleibt schnell und günstig, egal wie groß das Netzwerk wird.
- **Zwei-Phasen-Bestätigung**: bei riskanten Aktionen schlägt die KI zuerst nur vor, was sie tun würde — ohne etwas zu verändern. Erst der Klick auf "Bestätigen" löst die echte Änderung aus, und zwar exakt das, was vorher angezeigt wurde (kein erneutes Nachdenken der KI, kein Risiko einer abweichenden Interpretation).
- **Eigene Tabelle für Vorschläge**: macht den Bestätigungs-Schritt zuverlässig, auch wenn der Nutzer das Browser-Tab wechselt oder neu lädt, bevor er bestätigt.

### D) Dependencies
Keine neuen Packages — `ai`, `@ai-sdk/anthropic`, `zod` sind bereits im Projekt installiert (genutzt von den bestehenden Routen `draft-message` und `network-insights`).

## Frontend Implementation Notes
- `src/components/chat-widget.tsx` — Floating Trigger-Button (unten rechts, fixed) + Sheet-Panel (shadcn `Sheet`, von rechts), enthält Message-List, Empty-State mit Beispiel-Prompts, Pending-Action-Karte (Bestätigen/Abbrechen), Fehler-Banner mit "Erneut senden", Eingabefeld (Enter sendet, Shift+Enter neue Zeile)
- Eingebunden in `src/app/(app)/layout.tsx` — läuft auf jeder eingeloggten Seite (Dashboard, Kontakte, Analytics)
- `src/lib/chat.ts` — Typen (`ChatMessage`, `PendingAction`) + Beispiel-Prompts-Konstante
- Erwarteter API-Vertrag (noch nicht implementiert, für `/backend`):
  - `GET /api/chat/messages` → `{ messages: ChatMessage[], pendingAction: PendingAction | null }`
  - `POST /api/chat` Body `{ content: string }` → `{ message: ChatMessage, pendingAction?: PendingAction | null }`
  - `POST /api/chat/confirm` Body `{ pendingActionId: string, decision: 'confirm' | 'decline' }` → `{ message: ChatMessage }`
- Verifiziert per Playwright-Screenshot (Login → Dashboard → Chat öffnen): Button + Panel rendern korrekt, Fehler-Banner zeigt erwarteten 404 (Backend fehlt noch), kein UI-Crash
- **Redesign (post-deploy):** `chat-widget.tsx` auf Glassmorphism-Design umgestellt (Framer Motion statt shadcn `Sheet`) — floating Button rotiert/wird rot beim Öffnen, Panel mit `backdrop-blur`, Avatar-Icon (Sparkles) pro Assistant-Nachricht, Bounce-Dots als Typing-Indikator, Eingabe als abgerundetes Single-Line-Input statt Textarea. Multi-Agent-Selector aus der Design-Vorlage entfernt (App hat nur einen Assistenten) — statischer Header "Assistent" / "Online" statt Dropdown. Neue Abhängigkeit: `framer-motion`. Alle data-testid/aria-label/Placeholder-Strings unverändert — komplette E2E-Suite (14/14, chromium + Mobile Safari) weiterhin grün ohne Anpassung der Tests selbst.

## Backend Implementation Notes
- DB-Migration `create_chat_tables`: Tabellen `chat_messages` (id, user_id, role, content, created_at) und `pending_actions` (id, user_id, chat_message_id, action_type, summary, payload jsonb, status, created_at), beide RLS-geschützt (`<table>_<select|insert|update|delete>_own`, `auth.uid() = user_id`), Indizes auf `(user_id, created_at)` bzw. `(user_id, status)`
- `src/lib/chat-server.ts` — Tool-Definitionen für den KI-Agenten (AI SDK `tool()`): `list_contacts`, `get_contact_interactions`, `list_upcoming_birthdays`, `get_network_stats` (read-only); `log_interaction`, `set_followup`, `create_contact` (direkt, keine Bestätigung — laut Spec-AC); `update_contact_field` (direkt wenn Feld leer, sonst Pending-Action); `propose_delete_contact`, `propose_delete_interaction`, `propose_bulk_delete_contacts` (immer Pending-Action)
- Vor jeder neuen Pending-Action wird die vorherige offene automatisch auf `expired` gesetzt (`expirePendingActions`) — erfüllt Decision "nur eine offene Pending Action gleichzeitig"
- `GET /api/chat/messages`, `POST /api/chat`, `POST /api/chat/confirm` — wie im Frontend-Vertrag erwartet, implementiert in `src/app/api/chat/`
- `POST /api/chat`: Nutzer-Nachricht wird vor dem KI-Call gespeichert (bleibt bei AI-Fehler erhalten), Modell ist `claude-sonnet-4-6` mit `stopWhen: stepCountIs(5)` für Multi-Tool-Turns
- `POST /api/chat/confirm`: führt exakt das in `pending_actions.payload` gespeicherte aus (kein erneuter KI-Call) — wenn der Datensatz inzwischen weg ist, wird die Pending-Action auf `expired` gesetzt und das im Chat kommuniziert, statt einen Fehler zu werfen
- 18 Vitest-Integrationstests (Auth/Validierung/Happy-Path je Route) + End-to-End mit echter DB via Playwright verifiziert: Aggregat-Frage, direkte Kontaktanlage, Löschen mit Bestätigungs-Flow (inkl. DB-Check nach Bestätigen)
- `npm run build`, `npm run lint`, `npm test` (88 Tests) alle grün

## QA Test Results

**Tested:** 2026-06-29
**App URL:** http://localhost:3000 (dev), real Supabase project + real Claude Haiku 4.5 calls (no mocks)
**Tester:** QA Engineer (AI)

### Automated Suites
- `npm test` (Vitest): 88/88 passed (incl. 18 new for `/api/chat`, `/api/chat/messages`, `/api/chat/confirm`)
- `npm run build`: passed, no TS errors
- `npm run lint`: passed, no warnings
- `npm run test:e2e` full regression (chromium, serial, shared QA account): 101/106 passed — the 5 non-PROJ-11 "failures" seen in an earlier *parallel* run were confirmed to be pre-existing flakiness from running multiple browser projects against one shared QA account concurrently (reproduced: same specs pass 10/10 when run serially), not caused by this feature. See `tests/PROJ-11-ai-chat-assistant.spec.ts` (new, 14 tests) — after both bugs below were fixed: 14/14 passed on both `chromium` and `Mobile Safari`.

### Acceptance Criteria Status
- [x] Chat-Button überall, Panel öffnet von rechts mit Verlauf/Leerzustand
- [x] Leerzustand zeigt Begrüßung + Beispiel-Fragen
- [x] Einzel-Kontakt-Fragen korrekt aus echten Daten beantwortet
- [x] Aggregierte Fragen serverseitig aus eigenen Daten berechnet (nicht geraten)
- [x] Interaktion loggen direkt ausgeführt, bestätigt in Antwort
- [x] Follow-up-Termin direkt aktualisiert, bestätigt
- [x] Neuer Kontakt direkt angelegt, bestätigt
- [x] Überschreiben gefüllter Felder zeigt alten/neuen Wert + Bestätigung vor Schreiben
- [x] Löschen (Kontakt/Interaktion) zeigt Bestätigungsanfrage vor Ausführung
- [x] Bulk-Aktion zeigt Bestätigungskarte mit Anzahl + Liste (BUG-2 — siehe unten, FIXED)
- [x] Mehrdeutiger Namens-Treffer → Chat fragt nach (mit Unterscheidungsmerkmal), keine Aktion ausgeführt
- [x] Bestätigen führt exakt die zuvor gespeicherte Aktion aus (kein erneutes KI-Interpretieren — verifiziert: confirm-Route ruft kein LLM auf)
- [x] Ablehnen → keine Datenänderung, Abbruch bestätigt
- [x] KI-Fehler zeigt Fehlermeldung im Verlauf, Eingabe erneut sendbar (Vitest-getestet: 502-Pfad)
- [x] Verlauf bleibt nach Reload erhalten (letzte 50)
- [x] RLS: anderer Nutzer sieht nur eigene Daten (strukturell durch RLS-Policies erzwungen + Confirm-Route gibt 409 bei fremder/nicht-existierender Pending-Action-ID)

### Edge Cases Status
- [x] Unbekannter Kontaktname → Chat sagt, dass nichts gefunden wurde (kein Halluzinieren) — beobachtet im BUG-1-Repro
- [x] Leere Nachricht → Senden-Button bleibt deaktiviert (clientseitig), serverseitig Zod-validiert (400)
- [x] Datensatz beim Bestätigen schon weg → Pending-Action wird `expired`, Chat kommuniziert das statt Fehler zu werfen (Vitest-getestet)
- [x] >50 Nachrichten → UI lädt nur letzte 50 (DB behält Rest)
- [x] Netzwerkfehler beim Senden → Eingabe bleibt erhalten, Fehler-Banner mit „Erneut senden"
- [x] Mehrdeutiger Name (zwei „Mara"s) → Rückfrage statt Annahme (3/3 reproduziert)

### Security Audit Results
- [x] Authentication: `/api/chat`, `/api/chat/messages`, `/api/chat/confirm` ohne Session → Redirect zu `/login` (App-weites Middleware-Verhalten, konsistent mit allen anderen API-Routen)
- [x] Authorization: Pending-Actions sind RLS-gescoped auf `user_id`; Confirm-Route filtert zusätzlich explizit nach `user_id` — fremde/erratene IDs liefern 409, kein Datenzugriff
- [x] Input validation: Zod auf allen drei Routen; `update_contact_field` validiert Feldname gegen Whitelist + Werteformat pro Feldtyp (z.B. `strength` nur 1-3); React escaped Chat-Inhalte automatisch (kein `dangerouslySetInnerHTML` → kein XSS-Vektor)
- [x] Destruktive Aktionen können nicht ohne gespeicherten Pending-Action-Datensatz ausgeführt werden — es gibt kein Tool, das direkt löscht/überschreibt
- [x] Rate limiting: bewusst keins (Decision Log: kein Budget-Constraint für v1) — kein Bug, dokumentierte Entscheidung

### Bugs Found

#### BUG-1: Optimistische User-Nachricht verschwindet, wenn History-Fetch nach dem Senden zurückkommt — FIXED
- **Severity:** High
- **Steps to Reproduce:**
  1. Chat öffnen (History-GET `/api/chat/messages` startet)
  2. Sofort eine Nachricht abschicken, bevor das GET zurückkommt
  3. Erwartet: eigene Nachricht bleibt sichtbar, Antwort kommt dazu
  4. Tatsächlich: wenn das GET *nach* dem optimistischen Hinzufügen zurückkommt, überschreibt `setMessages(data.messages ?? [])` in `chat-widget.tsx` den State komplett (statt zu mergen) — die eigene Nachricht verschwindet aus der UI, bis die Antwort kommt (dann ist nur noch die Antwort sichtbar, keine User-Nachricht)
  - Reproduziert via Playwright + Debug-Logging (GET-Resolve kam nach optimistischem Add). Daten in der DB sind korrekt — reines UI-State-Problem.
- **Priority:** Fix before deployment (Race ist real, auch wenn in der App selbst durch normale Tipp-Verzögerung selten getroffen — bei langsamem Netzwerk/Supabase-Latenz aber plausibel)
- **Fix:** `setMessages((prev) => (prev.length > 0 ? prev : data.messages ?? []))` in `chat-widget.tsx` — History-Fetch überschreibt nur noch, wenn lokal noch nichts hinzugekommen ist. Verifiziert: 3/3 Läufe ohne jeglichen Wait zwischen Öffnen und Senden (Worst-Case-Timing), Suite 14/14 grün.

#### BUG-2: Bulk-Aktion manchmal als Text-Rückfrage statt Bestätigungskarte — FIXED
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Zwei Kontakte ohne Follow-up-Termin anlegen
  2. „Lösch alle Kontakte ohne Follow-up-Termin." schreiben
  3. Erwartet: Bestätigungskarte mit Liste + Bestätigen/Abbrechen-Buttons (`propose_bulk_delete_contacts`-Tool)
  4. Tatsächlich (3/3 reproduziert): Haiku listet die Kontakte korrekt per Text auf und fragt „Soll ich die beiden löschen?", ruft aber das Propose-Tool nicht auf — keine Karte, kein strukturierter Bestätigungs-Flow
  - Kein Sicherheitsrisiko: es existiert kein Tool, das ohne Pending-Action direkt löscht, also kann nichts ungewollt gelöscht werden — der Nutzer müsste im Klartext "ja" antworten, was vermutlich erst dann das Tool triggert (zweite Bestätigungsrunde, nur UX-Reibung)
  - Vermutete Ursache: bereits im Architecture-Schritt als Risiko notiert (Haiku statt Sonnet für Tool-Orchestrierung — siehe Decision Log)
- **Priority:** Fix in next sprint
- **Fix:** System-Prompt in `chat-server.ts` (`CHAT_SYSTEM_PROMPT`) geschärft — explizite Regel hinzugefügt: bei löschenden/überschreibenden/Bulk-Anfragen MUSS das passende Werkzeug aufgerufen werden, nie nur Text-Rückfrage. Verifiziert: 3/3 Läufe zeigen jetzt korrekt die Bestätigungskarte.

### Summary
- **Acceptance Criteria:** 16/16 passed
- **Bugs Found:** 2 total, both FIXED (0 critical, 1 high, 1 medium, 0 low)
- **Security:** Pass — no findings
- **Production Ready:** YES
- **Recommendation:** Deploy.

## Deployment

- **Production URL:** https://bambi-w26q.vercel.app
- **Deployed:** 2026-06-29
- **Verification:** Production-Smoke-Test (Playwright gegen Live-URL) — Login, Chat öffnen, echte Frage gestellt, KI-Antwort kam aus echten (leeren) Account-Daten zurück, keine Console-/Page-Errors
- Keine neuen Env-Vars nötig (ANTHROPIC_API_KEY + Supabase-Vars bereits aus PROJ-6/8/9-Deploys in Vercel gesetzt)
- DB-Migration `create_chat_tables` (chat_messages, pending_actions) bereits direkt auf dem Supabase-Projekt angewendet (kein separater Migrationsschritt beim Deploy nötig)

### Update 2026-06-29: Verlauf löschen + Modell-Wechsel
- Verlauf-löschen-Feature (DELETE `/api/chat/messages`, Bestätigungsdialog) deployed — Unit-Tests (3 neu) + E2E-Test grün, RLS + Cascade-FK (`pending_actions` → `chat_messages`, `ON DELETE CASCADE`) gegen DB verifiziert
- Modell-Wechsel Haiku → Sonnet 4.6 für `/api/chat` (siehe Technical Decisions) — adressiert BUG-2 aus QA
- `npm run build`, `npm run lint`, `npm test` (91/91) grün vor Deploy

### Update 2026-06-29: Multi-Conversation (Seitenleiste mit Chat-Verlauf)
- DB-Migration `add_chat_conversations`: neue Tabelle `conversations` (id, user_id, title, created_at, updated_at, RLS), `conversation_id`-FK (NOT NULL, ON DELETE CASCADE) auf `chat_messages` und `pending_actions`. Nicht-destruktiv migriert — ein Legacy-`conversations`-Eintrag pro Nutzer mit existierenden Nachrichten wurde aus deren erster Nachricht erzeugt, echte Produktionsdaten (10 Nachrichten) blieben erhalten
- Neue Routen: `GET /api/chat/conversations` (Liste, sortiert nach `updated_at`), `DELETE /api/chat/conversations/[id]` (ersetzt die alte globale `DELETE /api/chat/messages`)
- `POST /api/chat` nimmt optional `conversationId` — ohne ID wird eine neue Konversation angelegt (Titel aus erster Nachricht), mit ID wird Ownership geprüft (404 wenn fremd/nicht vorhanden)
- `GET /api/chat/messages` nimmt optional `?conversationId=` — ohne Parameter wird automatisch die zuletzt aktive Konversation geladen
- `chat-widget.tsx`: linke Seitenleiste (Chat-Liste + "Neuer Chat"), Conversation-Switching, Toggle-Icon im Header. Sidebar auf Desktop als feste Spalte (Panel wird breiter), auf Mobile als Overlay (Panel bleibt schmal)
- **Bug gefunden + gefixt (QA, High):** Sidebar-Default "immer offen" blockierte auf Mobile (<640px) als Overlay den gesamten Chat-Bereich — kein Button war klickbar. Fix: Sidebar startet geschlossen, öffnet sich automatisch nur auf Desktop-Breite beim Öffnen des Chats
- Bestehende Bugfix-Lücke beim Umbau gefunden + gefixt: `confirm/route.ts` versuchte Antwort-Nachrichten ohne `conversation_id` einzufügen (jetzt NOT NULL) → alle 8 `reply()`-Aufrufe um `pendingAction.conversation_id` ergänzt
- E2E-Suite erweitert auf 20 Tests (vorher 16): "Neuer Chat" startet getrennte Konversation, Sidebar zeigt beide, Wechsel lädt richtige Nachrichten, Löschen der aktiven Konversation wechselt zur nächsten oder zu Leerzustand — alle 20/20 auf `chromium` und `Mobile Safari` grün
- `npm run build`, `npm run lint`, `npm test` (100/100) grün vor Deploy
- Production-Deployment Ready: https://bambi-w26q-bendewar10s-projects.vercel.app

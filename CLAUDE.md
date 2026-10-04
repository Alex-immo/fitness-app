# Fitness-App

Persönliche Trainings-App (Muskelaufbau) als lokale PWA für das iPhone. Die fachliche Quelle der Wahrheit ist `SPEZIFIKATION.md`. Bei Widerspruch zwischen dieser Datei und der Spezifikation: nachfragen, nicht raten.

## Feste Entscheidungen

Nicht ohne Rückfrage ändern.

- Lokale PWA ohne Backend, ohne Login, ohne LLM, ohne Analytics
- React + TypeScript (strict) + Vite, `vite-plugin-pwa` für Manifest und Service Worker
- Daten in IndexedDB über Dexie
- Tests mit Vitest
- Validierung von Import-Dateien mit Zod
- Auslieferung über GitHub Pages aus einem öffentlichen Repository, Veröffentlichung per GitHub-Actions-Workflow (`actions/deploy-pages`)
- Vite `base` so setzen, dass die App unter `https://<nutzer>.github.io/<repository>/` läuft; Manifest `start_url` und `scope` relativ
- Oberfläche auf Deutsch, Zahlen mit Dezimalkomma, Code und Bezeichner auf Englisch

## Öffentliches Repository

- Keine persönlichen Daten in Code, Seed-Daten, Tests, Beispieldateien, Commits oder Dokumentation: kein Name, kein Alter, kein Körpergewicht, keine echten Trainingswerte.
- Profilwerte (Größe, Geburtsjahr, Geschlecht, Startgewicht) gibt der Nutzer beim ersten Start in der App ein.
- Testdaten sind erkennbar erfunden.
- Keine Schlüssel, Tokens oder Zugangsdaten im Repository. Die App braucht keine.
- `.gitignore` enthält mindestens `node_modules`, `dist`, `.env*`, `*.backup.json`.

## Architekturregeln

- `src/domain/`: reine Funktionen ohne Abhängigkeit zu React, Dexie oder Browser-APIs. Hier liegen Laststufen aus dem Scheibensatz, Progression (fünf Stufen, Trigger), A/B-Rotation und Wochenbelegung, Gewichtstrend und Kalorienregel, Deload-Erkennung. Jede Regel aus der Spezifikation hat mindestens einen Test.
- `src/db/`: Dexie-Schema, Seed-Daten, Migrationen. Schema-Änderungen nur über neue Dexie-Versionen, nie durch Löschen der Datenbank.
- `src/features/`: je Bereich ein Ordner (plan, workout, body, history, settings, backup).
- Lasten sind nie freie Zahlen: Die Auswahl kommt immer aus den berechneten Laststufen, die Anzeige nennt die Beladung pro Seite.
- Jede Stufenänderung schreibt einen `ProgressionEvent` mit Begründung.
- Datum und Uhrzeit in lokaler Zeit des Geräts; Wochenstart Montag.

## Sicherheit

- Content Security Policy als Meta-Tag: `default-src 'self'`, keine externen Quellen, kein `unsafe-eval`.
- Keine externen Skripte, Schriften, Bilder oder CDNs. Systemschrift verwenden.
- Beim Start `navigator.storage.persist()` anfragen.
- Import: Datei gegen Zod-Schema prüfen, Versionsfeld auswerten, vor dem Überschreiben bestätigen lassen. Ungültige Dateien ablehnen, nichts teilweise übernehmen.
- Export: eine JSON-Datei mit Versionsfeld und Zeitstempel, über die Web Share API mit Datei; Rückfall auf Download-Link.
- Kein `dangerouslySetInnerHTML`.

## Bedienung

- Zuerst für das iPhone bauen: einhändig bedienbar, große Tap-Flächen (mindestens 44 px), kein Hover.
- Workout-Ansicht: ein Satz pro Bildschirmabschnitt, Wiederholungen per Plus/Minus statt Tastatur, Vorbelegung mit dem Zielwert, Pausentimer startet automatisch nach dem Abhaken.
- Bildschirm während des Workouts wach halten (Screen Wake Lock API, mit Rückfall ohne Fehler).
- Laufendes Workout übersteht App-Wechsel und Neuladen (Zwischenstand sofort speichern).
- Hell- und Dunkelmodus nach Systemeinstellung, Safe-Area-Abstände beachten.

## Arbeitsweise

- In der Bau-Reihenfolge aus `SPEZIFIKATION.md` Abschnitt 11 vorgehen.
- Nach jedem Schritt anhalten: kurz sagen, was fertig ist, wie man es prüft und was als Nächstes kommt.
- Ein Schritt ist fertig, wenn `npm test` und `npm run build` fehlerfrei laufen und die Ansicht in einem iPhone-großen Fenster geprüft ist.
- Kleine, thematisch saubere Commits mit deutscher Nachricht.
- Keine zusätzlichen Abhängigkeiten ohne Begründung. Kein UI-Framework; schlichtes eigenes CSS.
- Funktionen außerhalb des MVP-Umfangs (Abschnitt 10) nicht bauen, auch wenn sie naheliegen.

## Befehle

```
npm install
npm run dev      # lokale Vorschau
npm test         # Unit-Tests
npm run build    # Produktions-Build nach dist/
npm run preview  # Build lokal ansehen
```

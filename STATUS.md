# STATUS

Stand: 4. Oktober 2026

## Fertig

- Schritt 1: Projektgerüst (Vite, React, TypeScript strict, PWA-Manifest, Service Worker, CSP im Build, GitHub-Actions-Workflow für Pages)
- Schritt 2: Dexie-Schema und Seed-Daten für Übungen, Vorlagen, Equipment (Version 2 aktualisiert den Katalog)
- Schritt 3: Logikmodul `src/domain/` mit Tests: Laststufen, Progression, Klimmzug-Einstufung, Wochenplanung und Rotation, Kalorienregel
- Schritt 4: Workout-Ansicht mit Logging, Pausentimer, Wake Lock, Zwischenstand in der Datenbank, Auswertung der Progression beim Beenden

## Entscheidungen (4. Oktober 2026)

- Rückschritt ab Stufe 3 und ohne Hantel: eine Stufe zurück
- Protein-Minimum wächst mit dem Gewicht
- Glute Bridge mit einer Hantel
- Übrige Annahmen aus der Fragenliste gelten wie vorgeschlagen

## Offen

- Öffentliches GitHub-Repository anlegen (Name festlegen), erst dann läuft der Pages-Workflow
- Workout wird bis Schritt 5 von Hand gestartet; Wochentyp ist immer "normal"

## Noch nicht gebaut

- Wochenplanung (Schritt 5), Onboarding und Ernährung (Schritt 6), Historie und Deload (Schritt 7), Backup (Schritt 8)

## Nächster Schritt

Schritt 5: Wochenplanung und Rotation

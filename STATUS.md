# STATUS

Stand: 4. Oktober 2026

## Fertig

- Schritt 1: Projektgerüst (Vite, React, TypeScript strict, PWA-Manifest, Service Worker, CSP im Build, GitHub-Actions-Workflow für Pages)
- Schritt 2: Dexie-Schema (Version 1) und Seed-Daten für Übungen, Vorlagen, Equipment
- Schritt 3: Logikmodul `src/domain/` mit Tests: Laststufen, Progression, Klimmzug-Einstufung, Wochenplanung und Rotation, Kalorienregel

## Offen vor Schritt 4

- Offene Fragen zur Spezifikation klären (siehe Chat vom 4. Oktober 2026); die Annahmen stehen als Kommentare im Code
- Git-Repository anlegen: Autor-Identität ohne Klarnamen festlegen, dann erste Commits

## Noch nicht gebaut

- Deload-Erkennung und Kürzungsregel (Schritt 7)
- Alle Ansichten außer dem Platzhalter-Startbildschirm

## Nächster Schritt

Schritt 4: Workout-Ansicht mit Logging und Pausentimer

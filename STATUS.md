# STATUS

Stand: 4. Oktober 2026

## Fertig

- Schritt 1: Projektgerüst (Vite, React, TypeScript strict, PWA-Manifest, Service Worker, CSP im Build, GitHub-Actions-Workflow für Pages)
- Schritt 2: Dexie-Schema und Seed-Daten für Übungen, Vorlagen, Equipment (Version 2 aktualisiert den Katalog)
- Schritt 3: Logikmodul `src/domain/` mit Tests: Laststufen, Progression, Klimmzug-Einstufung, Wochenplanung und Rotation, Kalorienregel
- Schritt 4: Workout-Ansicht mit Logging, Pausentimer, Wake Lock, Zwischenstand in der Datenbank, Auswertung der Progression beim Beenden
- Schritt 5: Wochenplanung nach Tagtyp (diese und nächste Woche), A/B-Rotation nach erledigten Langversionen, Einheit ausfallen lassen und wieder einplanen, Bike-Einheit von Hand eintragen
- Schritt 6: Onboarding (Profil), Gewichtslog mit Wochenmitteln und Trend, Kalorienregel alle zwei Wochen, Protein als Tagessumme, Tab-Leiste Plan/Körper
- Einstiegsphase: Vorlagen A/B Einstieg, Einstellung Planvariante (Einstieg/Voll), Satzzahl aus Vorlage plus Zusatzsatz, Wechselvorschlag, Datenbank-Version 3
- Schritt 7: Verlauf je Übung (Stand, letzte Einheiten, Änderungen), Deload-Vorschlag und Deload-Woche, Kürzungsregel für die Langversionen
- Einstellungen: Versionsanzeige mit Aktualisieren-Knopf; Zurück im laufenden Workout

## Entscheidungen (4. Oktober 2026)

- Rückschritt ab Stufe 3 und ohne Hantel: eine Stufe zurück
- Protein-Minimum wächst mit dem Gewicht
- Glute Bridge mit einer Hantel
- Übrige Annahmen aus der Fragenliste gelten wie vorgeschlagen
- Rotation folgt den erledigten Langversionen; nie gestartete Einheiten vergangener Wochen gelten als ausgefallen
- Kalorienregel: fällig zwei volle Wochen nach dem ersten Wiegen bzw. der letzten Auswertung; verglichen werden die beiden abgeschlossenen Wochen davor; jede Auswertung wird protokolliert, auch ohne Änderung
- Profil und Equipment sind nach dem Onboarding noch nicht änderbar (Einstellungen fehlen, stehen in keinem Bauschritt)
- Einstiegsphase: Klimmzug-Aufstieg in B Einstieg bei 3 von 3 Sätzen; Trainingswoche = Kalenderwoche mit mindestens einer erledigten Einstiegs-Einheit seit dem letzten Wechsel; Dauer von Starten bis Beenden; geschätzte Dauer 40 Min
- Veröffentlicht unter https://alex-immo.github.io/fitness-app/ (Push auf main veröffentlicht automatisch)

## Offen

- Noch kein Backup: Daten liegen nur auf dem Gerät (Schritt 8)

## Noch nicht gebaut

- Backup (Schritt 8)
- Einstellungen für Profil und Equipment (in keinem Bauschritt)

## Nächster Schritt

Schritt 8: Backup-Export und -Import

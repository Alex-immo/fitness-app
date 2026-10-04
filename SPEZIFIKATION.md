# Fitness-App: Spezifikation (Bau-Fassung)

Stand: 4. Oktober 2026. Fachliche Quelle der Wahrheit für den Bau. Diese Fassung enthält bewusst keine persönlichen Daten, weil das Repository öffentlich ist. Profilwerte gibt der Nutzer beim ersten Start in der App ein.

## 1. Ziel und Rahmen

- Persönliche Trainings-App für eine Person, Ziel Muskelaufbau (Hypertrophie), Trainingsstand Anfänger
- Zielrate der Gewichtszunahme: 0,25–0,5 % des Körpergewichts pro Woche
- Training zu Hause, morgens, mit knappem Zeitbudget
- Sprache der Oberfläche: Deutsch, Dezimalkomma

## 2. Equipment

Die Last ist eine Variable mit Deckel. Hantelbank und Rudergerät gibt es nicht.

| Gerät | Detail | Bedeutung für die App |
| --- | --- | --- |
| Kurzhanteln | 2 Stück, je 2,3 kg Stange plus Scheiben | Lasten ergeben sich aus dem Scheibensatz |
| Klimmzugstange | Türreck | vertikaler Zug, Hängeübungen für den Rumpf |
| Trainingsmatte | vorhanden | Boden- und Rumpfübungen |
| Indoor-Bike | Smart-Trainer | Warm-up und Zone 2 |
| Bankersatz | Sofa, Stuhl oder Treppenstufe | Abstützen beim Rudern, Erhöhung für Split Squat und Liegestütze |

### Scheibensatz

| Scheibe | Gesamt | Pro Hantel | Pro Seite |
| --- | --- | --- | --- |
| 2 kg | 4 | 2 | 1 |
| 1,25 kg | 4 | 2 | 1 |
| 1 kg | 8 | 4 | 2 |

Regeln:

- Beladung immer symmetrisch (beide Seiten einer Hantel gleich).
- Höchstens vier Scheiben pro Seite (`max_plates_per_side` = 4). Mit fünf greift der Sicherungsring nicht mehr vollständig; die App bietet das nie an.
- Die App berechnet die einstellbaren Lasten aus dem Scheibensatz und zeigt zu jeder Last die Beladung pro Seite an. Es gibt keinen festen Lastsprung.

Laststufen bei Übungen mit zwei Hanteln (Gesamtgewicht je Hantel inklusive Stange):

| Gesamtgewicht je Hantel | Scheiben pro Seite | Sprung zur nächsten Stufe |
| --- | --- | --- |
| 2,3 kg | leer | 2 kg |
| 4,3 kg | 1 | 0,5 kg |
| 4,8 kg | 1,25 | 1,5 kg |
| 6,3 kg | 2 | 0,5 kg |
| 6,8 kg | 1,25 + 1 | 1,5 kg |
| 8,3 kg | 2 + 1 | 0,5 kg |
| 8,8 kg | 2 + 1,25 | 1,5 kg |
| 10,3 kg | 2 + 1 + 1 | 0,5 kg |
| 10,8 kg | 2 + 1,25 + 1 | 2 kg |
| 12,8 kg | 2 + 1,25 + 1 + 1 | Deckel |

Bei Übungen mit nur einer Hantel dürfen die Scheiben beider Hanteln auf eine Stange. Das ergibt vier zusätzliche Stufen:

| Gesamtgewicht der Hantel | Scheiben pro Seite |
| --- | --- |
| 13,3 kg | 2 + 1,25 + 1,25 + 1 |
| 14,3 kg | 2 + 2 + 1 + 1 |
| 14,8 kg | 2 + 2 + 1,25 + 1 |
| 15,3 kg | 2 + 2 + 1,25 + 1,25 |

Deckel: 15,3 kg für Ein-Hantel-Übungen, 12,8 kg je Hantel (25,6 kg zusammen) für Zwei-Hantel-Übungen.

Stangengewicht, Scheibensatz und `max_plates_per_side` sind in der App editierbar (Einstellungen), damit ein späterer Zukauf keinen Code-Eingriff braucht.

## 3. Scheduling-Logik

Der Tagtyp bestimmt das Workout.

| Tagtyp | Dauer | Workout |
| --- | --- | --- |
| Homeoffice | ca. 60 Min | A lang oder B lang |
| Büro | ca. 30 Min | Kurzzirkel |
| Reise | 20–25 Min | Reisezirkel ohne Equipment |
| Wochenende | 40–50 Min | Bike Zone 2 |

Regeln:

1. Drei Krafteinheiten pro Woche, Standard-Slots Montag, Mittwoch, Freitag.
2. Mindestens ein Tag Pause zwischen zwei Krafteinheiten.
3. Die Langversionen rotieren A → B → A → B. Die Rotation zählt nur Langversionen; ein Kurz- oder Reisezirkel verschiebt sie nicht. Maßgeblich sind die tatsächlich erledigten Langversionen: Fällt eine geplante Langversion aus, rückt sie auf die nächste Langversion.
4. Fällt ein Homeoffice-Tag weg, ersetzt der Kurzzirkel die Einheit. Sie wird nicht gestrichen und nicht nachgeholt.
5. An Reisetagen ersetzt der Reisezirkel die Einheit, ebenfalls ohne Nachholen.
6. Zone-2-Bike nie am selben Morgen wie Krafttraining. Ausnahme: 6 Min lockeres Kurbeln als Warm-up.
7. Die Wochenplanung braucht pro Woche eine Eingabe: den Tagtyp je Wochentag. Die App belegt daraus die Slots.

Beispielwochen:

- 3 Homeoffice-Tage: Mo A lang, Mi B lang, Fr A lang, Sa Bike
- 2 Homeoffice-Tage: Mo A lang, Mi B lang, Fr Kurzzirkel, Sa Bike; Folgewoche startet mit A lang
- Reisewoche Di–Do: Mo A lang, Mi Reisezirkel, Fr B lang, Sa Bike

## 4. Übungsdatenbank

Die Spalte Last zeigt, wo die Übung beim Start steht: am Deckel, unter dem Deckel (Startlast in den ersten beiden Einheiten kalibrieren) oder ohne Hantel.

| ID | Übung | Muster | Equipment | Einseitig | Last |
| --- | --- | --- | --- | --- | --- |
| `front_squat_db` | Front Squat mit 2 Kurzhanteln | Knie (Squat) | 2 KH | nein | am Deckel |
| `goblet_squat` | Goblet Squat | Knie (Squat) | 1 KH | nein | am Deckel |
| `bulgarian_split_squat` | Bulgarian Split Squat | Knie (einbeinig) | 2 KH + Sofa | ja | kalibrieren |
| `pushup_feet_elevated` | Liegestütze, Füße erhöht | Druck horizontal | Erhöhung | nein | Körpergewicht |
| `floor_press` | Floor Press | Druck horizontal | 2 KH + Matte | nein | am Deckel |
| `row_one_arm` | Einarmiges Kurzhantelrudern | Zug horizontal | 1 KH + Stütze | ja | am Deckel |
| `pullup` | Klimmzug | Zug vertikal | Klimmzugstange | nein | Körpergewicht |
| `lateral_raise` | Seitheben | Schulter Abduktion | 2 KH | nein | kalibrieren |
| `triceps_overhead` | Überkopf-Trizepsdrücken | Ellbogen Extension | 1 KH | nein | kalibrieren |
| `hanging_knee_raise` | Knieheben im Hang | Rumpf (Hüftbeugung) | Klimmzugstange | nein | Körpergewicht |
| `plank` | Plank | Rumpf Anti-Extension | Matte | nein | Zeit |
| `side_plank` | Side Plank | Rumpf Anti-Lateralflexion | Matte | ja | Zeit |
| `rdl_single_leg` | Einbeiniges Rumänisches Kreuzheben | Hüfte (Hinge) | 2 KH | ja | kalibrieren |
| `glute_bridge_single_leg` | Einbeinige Glute Bridge | Hüfte (Extension) | 1 KH | ja | am Deckel |
| `reverse_fly` | Reverse Fly vorgebeugt | Zug horizontal (hintere Schulter) | 2 KH | nein | kalibrieren |
| `shoulder_press_kneeling` | Schulterdrücken kniend | Druck vertikal | 2 KH | nein | kalibrieren |
| `biceps_curl` | Bizeps Curls | Ellbogen Flexion | 2 KH | nein | kalibrieren |
| `calf_raise_single_leg` | Wadenheben einbeinig | Wade | 1 KH | ja | am Deckel |
| `dead_bug` | Dead Bug | Rumpf Anti-Extension | Matte | ja | Körpergewicht |

Kalibrierregel: Startlast ist das Gewicht, mit dem die untere Wiederholungsgrenze bei RIR 2–3 sauber gelingt. Die Einstufung "am Deckel" ist eine Annahme; die App lässt die Startlast in der ersten Einheit jeder Übung frei wählen.

RIR = Wiederholungen, die im Satz bis zum Muskelversagen noch möglich gewesen wären.

## 5. Workouts

### 5.1 Warm-up (immer, 5–6 Min)

6 Min lockeres Kurbeln auf dem Bike (bevorzugt) oder Hüftkreisen, Katze-Kuh, 10 Kniebeugen ohne Last, 10 Schulterkreisen. Danach ein leichter Aufwärmsatz der ersten Übung.

### 5.2 Workout A lang (Push, Knie-Schwerpunkt)

| # | Übungs-ID | Sätze | Wdh. | Pause | Hinweis |
| --- | --- | --- | --- | --- | --- |
| 1 | `front_squat_db` | 4 | 10–15 | 90 s | 3 s ablassen, 1 s Pause unten |
| 2 | `bulgarian_split_squat` | 3 | 10–12 je Bein | 60 s | stärkster Beinreiz im Plan |
| 3 | `pushup_feet_elevated` | 3 | 8–15 | 60 s | Hanteln als Griffe für mehr Tiefe |
| 4 | `floor_press` | 3 | 12–15 | 60 s | Ellbogen kurz am Boden absetzen |
| 5 | `row_one_arm` | 3 | 12–15 je Seite | 45 s | 1 s Halten in der Endposition |
| 6 | `lateral_raise` | 3 | 12–15 | 45 s | |
| 7 | `triceps_overhead` | 2 | 12–15 | 45 s | |
| 8 | `hanging_knee_raise` | 2 | 8–12 | 45 s | ohne Schwung |
| 9 | `side_plank` | 2 | 40 s je Seite | 30 s | |

### 5.3 Workout B lang (Pull, Hüft-Schwerpunkt)

| # | Übungs-ID | Sätze | Wdh. | Pause | Hinweis |
| --- | --- | --- | --- | --- | --- |
| 1 | `rdl_single_leg` | 4 | 10–12 je Bein | 75 s | 3 s ablassen |
| 2 | `pullup` | 4 | nach Einstufung | 90 s | siehe Abschnitt 6 |
| 3 | `glute_bridge_single_leg` | 3 | 12–15 je Bein | 60 s | Hantel auf der Hüfte |
| 4 | `row_one_arm` | 3 | 12–15 je Seite | 60 s | |
| 5 | `reverse_fly` | 2 | 12–15 | 45 s | |
| 6 | `shoulder_press_kneeling` | 3 | 10–15 | 60 s | kniend verhindert das Ausweichen ins Hohlkreuz |
| 7 | `biceps_curl` | 2 | 12–15 | 45 s | |
| 8 | `calf_raise_single_leg` | 2 | 15–20 je Bein | 30 s | |
| 9 | `dead_bug` | 2 | 10 je Seite | 30 s | |

Kürzungsregel: Überschreitet die gemessene Dauer einer Langversion zweimal in Folge 55 Min, schlägt die App vor, Übung 7 zu streichen.

### 5.4 Kurzzirkel (Bürotag, 25 Min inkl. Warm-up)

Vier Runden, je 12–15 Wiederholungen, 45 s Pause zwischen den Runden, keine Pause innerhalb einer Runde.

1. `goblet_squat`
2. `pushup_feet_elevated`
3. `row_one_arm`
4. `glute_bridge_single_leg`

### 5.5 Reisezirkel (ohne Equipment, 20–25 Min)

Vier Runden, 45 s Pause zwischen den Runden. Ein Zug fehlt, weil unterwegs kein Gerät dafür da ist.

1. `bulgarian_split_squat` ohne Last, 12–15 je Bein, hinterer Fuß auf Bett oder Stuhl
2. `pushup_feet_elevated`, 8–15
3. `glute_bridge_single_leg` ohne Last, 15–20 je Bein
4. `side_plank`, 40 s je Seite

### 5.6 Bike Zone 2

40–50 Min am Wochenende, locker, Gespräch möglich. Eintrag manuell (Dauer, optional Durchschnittsleistung).

## 6. Progressionsalgorithmus

Jede Übung durchläuft für sich fünf Stufen; den Wechsel löst ein Trigger aus, kein Kalender. Die Logik ist regelbasiert und deterministisch.

| Stufe | Variable | Regel | Endet, wenn |
| --- | --- | --- | --- |
| 1 | Last | nächste einstellbare Laststufe wählen, Wiederholungen zurück auf die Untergrenze | Last = Deckel |
| 2 | Wiederholungen | in allen Sätzen die obere Grenze erreichen | Trigger erfüllt |
| 3 | Tempo | 4 s ablassen, 1 s Pause in der Dehnung; Wiederholungen zurück auf die Untergrenze | Trigger erfüllt |
| 4 | Zusatzsatz | ein Satz mehr, einmalig pro Übung | Trigger erfüllt |
| 5 | Variante | schwerere Variante laut Tabelle unten; Wiederholungen zurück auf die Untergrenze | Trigger erfüllt: Equipment-Grenze |

Stufe 1 und 2 wechseln sich ab, solange die Last unter dem Deckel liegt (doppelte Progression): Obergrenze erreicht, Last hoch, Wiederholungen zurück. Übungen am Deckel und Übungen ohne Hantel starten in Stufe 2.

Große Lastsprünge: Ist der Sprung zur nächsten Laststufe größer als 15 % der aktuellen Last, steigt zuerst die obere Wiederholungsgrenze um 5. Erst wenn auch die erreicht ist, folgt der Lastsprung, und der Wiederholungsbereich geht auf den Ursprungswert zurück.

### Trigger

- Aufstieg: In zwei aufeinanderfolgenden Einheiten mit dieser Übung erreichen alle Sätze die obere Wiederholungsgrenze.
- Schnellaufstieg: Obergrenze in allen Sätzen und RIR 4 oder mehr im letzten Satz. Dann reicht eine Einheit.
- Rückschritt: Die Untergrenze wird im ersten Satz zweimal in Folge verfehlt. In Stufe 1 und 2 geht die Last eine Stufe zurück. Ab Stufe 3 geht die Übung eine Stufe zurück (Variante, Zusatzsatz oder Tempo entfällt); das gilt auch für Übungen ohne Hantel.
- Gewertet werden nur A lang und B lang. Kurz- und Reisezirkel werden protokolliert, lösen aber keinen Stufenwechsel aus.
- RIR ist im letzten Satz jeder Übung ein Pflichtfeld.
- Bei einseitigen Übungen zählt die schwächere Seite.

### Klimmzüge

Die erste Einheit B beginnt mit einem Einstufungstest: maximale saubere Wiederholungen.

| Testergebnis | Startschema | Aufstieg |
| --- | --- | --- |
| 0 | 4 Sätze mit 3–5 Negativ-Wiederholungen, 5 s ablassen | 4 × 5 Negative geschafft: neuer Test |
| 1–4 | 4 Sätze mit so vielen sauberen Wiederholungen wie möglich bei RIR 1 | 4 × 5 geschafft: nächste Zeile |
| 5 oder mehr | 4 Sätze mit 5–10 Wiederholungen | 4 × 10 geschafft: Zusatzlast im Rucksack |

### Varianten für Stufe 5

| Übung | Schwerere Variante |
| --- | --- |
| `front_squat_db` | Front Squat mit 1½ Wiederholungen |
| `bulgarian_split_squat` | Vorderfuß erhöht |
| `pushup_feet_elevated` | mit Rucksack als Zusatzlast |
| `rdl_single_leg` | Standfuß erhöht |
| `glute_bridge_single_leg` | einbeiniger Hip Thrust, Schultern auf dem Sofa |
| `calf_raise_single_leg` | auf der Treppenstufe mit voller Dehnung |

Für die übrigen Übungen zeigt die App bei Erreichen von Stufe 5 nur den Hinweis "Variante festlegen".

### Deload

Nach sieben Trainingswochen schlägt die App eine Deload-Woche vor: halbe Satzzahl (aufgerundet) bei gleicher Last und gleichen Wiederholungen. Die Woche ist ein eigener Wochentyp und zählt nicht für Trigger.

### Equipment-Grenze

Haben drei der vier Hauptübungen (`front_squat_db`, `bulgarian_split_squat`, `row_one_arm`, `floor_press`) Stufe 5 abgeschlossen, meldet die App den Upgrade-Bedarf (schwerere Scheiben oder Hanteln). Sie schlägt dann keine weiteren Varianten vor.

## 7. Ernährung

Die App zeigt ein Kalorienziel und ein Protein-Minimum und passt das Kalorienziel alle zwei Wochen am Gewichtstrend an. Food-Logging gibt es nicht.

Startwerte, berechnet aus dem Profil (Gewicht, Größe, Geburtsjahr, Geschlecht):

| Größe | Formel |
| --- | --- |
| Grundumsatz | Mifflin-St-Jeor: 10 × kg + 6,25 × cm − 5 × Alter + 5 (Männer) bzw. − 161 (Frauen) |
| Erhaltungsbedarf | Grundumsatz × 1,5 |
| Kalorienziel | Erhaltung + 280 kcal, gerundet auf 50 |
| Protein-Minimum | 1,6 g je kg aktuelles Körpergewicht (Zielbereich bis 2,2 g je kg); wächst mit dem Gewicht mit |
| Zielrate | 0,25–0,5 % des Körpergewichts pro Woche |

### Regelkreis

1. Wiegen: mindestens dreimal pro Woche morgens. Die App bildet daraus ein Wochenmittel.
2. Auswertung alle zwei Wochen: Veränderung des Wochenmittels pro Woche. Liegen in einer der beiden Wochen weniger als zwei Messungen vor, gibt es keine Anpassung, nur einen Hinweis.
3. Anpassung des Kalorienziels:

| Trend | Anpassung |
| --- | --- |
| unter 0,25 % pro Woche | +150 kcal |
| 0,25–0,5 % pro Woche | unverändert |
| über 0,5 % pro Woche | −100 kcal |

Jede Anpassung wird mit Datum, Trend, altem und neuem Ziel protokolliert.

### Umfang

- MVP: Kalorienziel als Anzeige, Protein als Tagessumme, Gewichtslog mit Trend
- Ausbaustufe: Wochenplan aus eigenem Rezeptpool mit Einkaufsliste, pro Mahlzeit ein Haken "gegessen"
- Optional: Taillen-, Arm- und Brustumfang alle vier Wochen

## 8. Architektur

Die App läuft vollständig lokal auf dem iPhone: eine PWA ohne Backend und ohne Login. Ein Sync bleibt nachrüstbar.

| Schicht | Wahl | Grund |
| --- | --- | --- |
| Frontend | React + TypeScript + Vite, als PWA auf dem Homescreen installiert | läuft wie eine App, ohne App Store und ohne Entwicklerkonto |
| Daten | IndexedDB auf dem iPhone | offline nutzbar, keine Daten auf fremden Systemen |
| Speicherschutz | dauerhafter Speicher wird beim Browser beantragt | Schutz vor automatischem Löschen |
| Backup | Export als JSON über das Teilen-Menü nach iCloud Drive, Import über die Dateien-App | Schutz bei Handywechsel oder gelöschter App |
| Logik | Progression, Lasten, Planung und Kalorienregel als reine Funktionen in einem eigenen Modul, mit Unit-Tests | deterministisch; später auch auf einem Server nutzbar |
| Auslieferung | GitHub Pages aus einem öffentlichen Repository, Veröffentlichung per GitHub Actions | kostenlos, HTTPS automatisch |
| Backend, Login, LLM | entfallen | für einen Nutzer auf einem Gerät nicht nötig |

Einschränkungen der lokalen Variante: keine Push-Erinnerung (iPhone-Wecker nutzen), Bike-Einheiten manuell, Daten auf genau einem Gerät.

### Sicherheitsgrundsätze

- Trainings- und Körperdaten verlassen das iPhone nur als Backup-Datei.
- Das Repository ist öffentlich: keine persönlichen Daten in Code, Seed-Daten, Tests, Commits oder Dokumentation.
- Keine Dritt-Tracker, keine externen Skripte, Schriften oder CDNs; alle Abhängigkeiten werden mit ausgeliefert.
- Eine strikte Content Security Policy verbietet der App, fremde Adressen aufzurufen.
- Der Import prüft die Backup-Datei gegen ein Schema, bevor Daten übernommen werden.
- Zugriffsschutz ist die Gerätesperre des iPhones.

## 9. Datenmodell

Lokale Tabellen. `load_kg` ist das Gesamtgewicht je Hantel inklusive Stange, bei Klimmzügen und Liegestützen die Zusatzlast. `user_id` bleibt erhalten, damit ein späterer Sync ohne Umbau möglich ist.

```
User
  id, height_cm, birth_year, sex, goal,
  kcal_target, protein_target_g, gain_target_pct_per_week

Equipment
  id (slug), name_de, count, bar_weight_kg (null = ohne Last),
  plates[] ({weight_kg, count}), max_plates_per_side

Exercise
  id (slug), name_de, movement_pattern, equipment_ids[], is_unilateral,
  load_type ("hantel" | "koerpergewicht" | "zeit"),
  dumbbells_used (0 | 1 | 2), next_variant_text (null), cue_text

WorkoutTemplate
  id ("A_lang" | "B_lang" | "kurzzirkel" | "reisezirkel" | "bike_z2"),
  type ("straight_sets" | "circuit" | "cardio"), estimated_minutes,
  counts_for_progression (bool)

TemplateItem
  id, template_id, exercise_id, order, sets, rep_min, rep_max,
  rest_seconds, note

WeekPlan
  id, user_id, week_start, week_type ("normal" | "deload")

ScheduledSession
  id, week_plan_id, date, template_id,
  day_type ("homeoffice" | "buero" | "reise" | "wochenende"),
  status ("geplant" | "erledigt" | "ersetzt" | "ausgefallen")

SessionLog
  id, scheduled_session_id, started_at, finished_at,
  perceived_effort (1-10)

SetLog
  id, session_log_id, exercise_id, set_number,
  side ("links" | "rechts" | null),
  load_kg, reps_done, duration_s (Halteübungen),
  rir (Pflicht im letzten Satz), tempo_applied (bool)

ProgressionState
  user_id, exercise_id, current_stage (1-5), current_load_kg,
  current_sets, current_rep_min, current_rep_max,
  consecutive_target_hits, updated_at

ProgressionEvent
  id, user_id, exercise_id, date, from_stage, to_stage,
  from_load_kg, to_load_kg, reason

BodyWeightLog
  id, user_id, date, weight_kg

BodyMeasureLog (optional)
  id, user_id, date, waist_cm, arm_cm, chest_cm

NutritionDayLog
  id, user_id, date, protein_g

KcalAdjustment
  id, user_id, date, trend_pct_per_week, old_target, new_target

CardioLog
  id, user_id, date, duration_min, zone, avg_power_w (optional)
```

Entwurfsentscheidungen:

- `ProgressionState` hält nur den aktuellen Stand; `ProgressionEvent` protokolliert jeden Wechsel. So lässt sich jede Entscheidung der App nachvollziehen.
- Das aktuelle Gewicht ergibt sich aus `BodyWeightLog`, nicht aus `User`.
- Sätze, Wiederholungsbereich und Pausen stehen in `TemplateItem`, nicht in `Exercise`. Dieselbe Übung kann in A und B unterschiedlich dosiert sein.

## 10. MVP-Umfang

Muss:

1. Wochenplanung nach Tagtyp (Homeoffice, Büro, Reise) mit automatischer A/B-Rotation
2. Workout-Ansicht mit Eingabe je Satz (Last, Wiederholungen, RIR im letzten Satz), Pausentimer und Tempo-Hinweis
3. Progressionsberechnung mit fünf Stufen und Trigger pro Übung, inklusive Klimmzug-Einstufung
4. Historie pro Übung: Last, Wiederholungen, aktuelle Stufe
5. Deload-Vorschlag als eigener Wochentyp
6. Gewichtslog mit Trend und automatischer Anpassung des Kalorienziels
7. Protein als Tagessumme
8. Backup: Export nach iCloud Drive und Import, mit wöchentlichem Hinweis

Nice-to-have:

- Wochenplan für Mahlzeiten aus eigenem Rezeptpool mit Einkaufsliste
- Umfangsmessungen alle vier Wochen
- Hinweis bei Erreichen der Equipment-Grenze

Bewusst nicht im Umfang:

- Kalorienzählen mit Lebensmitteldatenbank oder Barcode-Scan
- Social Features, Videoanleitungen, LLM-Funktionen
- Backend, Login, Sync, Push-Benachrichtigungen

## 11. Bau-Reihenfolge

1. Projektgerüst: Vite, PWA-Manifest, Service Worker, GitHub-Actions-Workflow
2. Lokales Datenmodell mit Seed-Daten (Übungen, Vorlagen, Equipment)
3. Logikmodul als reine Funktionen mit Tests: Laststufen, Progression, Rotation, Kalorienregel
4. Workout-Ansicht mit Logging und Pausentimer
5. Wochenplanung und Rotation
6. Onboarding (Profil), Gewichtstrend und Kalorienregel, Protein
7. Historie und Deload
8. Backup-Export und -Import
9. Veröffentlichung auf GitHub Pages und Installation auf dem iPhone

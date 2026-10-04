// Display texts of the exercises, taken from UEBUNGSTEXTE.md. A test checks
// that this file and the document stay identical.

export interface ExerciseTexts {
  /** Short everyday name shown under the exercise name. */
  subtitle: string
  /** How the exercise is done. */
  howTo: string
  /** What to pay attention to. */
  watchFor: string
}

export const EXERCISE_TEXTS: Record<string, ExerciseTexts> = {
  front_squat_db: {
    subtitle: 'Kniebeuge mit zwei Hanteln',
    howTo:
      'Hanteln auf den Schultern ablegen, Ellbogen zeigen nach vorn, Füße schulterbreit. In die Hocke gehen, bis die Oberschenkel waagerecht sind, dann hochdrücken.',
    watchFor: 'Fersen bleiben am Boden, Oberkörper aufrecht.',
  },
  goblet_squat: {
    subtitle: 'Kniebeuge mit einer Hantel',
    howTo:
      'Eine Hantel senkrecht mit beiden Händen vor der Brust halten. In die Hocke gehen, bis die Oberschenkel waagerecht sind, dann hochdrücken.',
    watchFor: 'Ellbogen zeigen nach unten, die Hantel bleibt nah am Körper.',
  },
  bulgarian_split_squat: {
    subtitle: 'Einbeinige Kniebeuge, hinterer Fuß erhöht',
    howTo:
      'Großer Schritt vor Sofa oder Stuhl, der hintere Fuß liegt mit dem Spann darauf. Hanteln hängen seitlich. Vorderes Knie beugen, bis das hintere Knie fast den Boden berührt, dann hochdrücken.',
    watchFor: 'Das Gewicht liegt auf dem vorderen Bein, das hintere stützt nur.',
  },
  rdl_single_leg: {
    subtitle: 'Vorbeugen auf einem Bein',
    howTo:
      'Auf einem Bein stehen, Knie leicht gebeugt. Oberkörper mit geradem Rücken nach vorn kippen, das freie Bein geht gestreckt nach hinten. Hanteln am Standbein entlang bis etwa Schienbeinmitte führen, dann aufrichten.',
    watchFor: 'Der Rücken bleibt gerade, die Bewegung kommt aus der Hüfte. Anfangs mit einer Hand an der Wand abstützen.',
  },
  glute_bridge_single_leg: {
    subtitle: 'Hüftheben auf einem Bein',
    howTo:
      'Rückenlage, ein Fuß aufgestellt, das andere Bein angehoben. Hantel mit beiden Händen auf der Hüfte halten. Hüfte hochdrücken, bis Schulter, Hüfte und Knie eine Linie bilden, dann senken.',
    watchFor: 'Oben das Gesäß anspannen, nicht ins Hohlkreuz gehen.',
  },
  calf_raise_single_leg: {
    subtitle: 'Wadenheben auf einem Bein',
    howTo:
      'Auf einem Fuß stehen, Hantel in einer Hand, die andere Hand stützt an der Wand. Ferse hochdrücken bis auf die Zehenspitzen, kurz halten, langsam senken.',
    watchFor: 'Voller Bewegungsweg, kein Wippen.',
  },
  pushup_feet_elevated: {
    subtitle: 'Liegestütze mit erhöhten Füßen',
    howTo:
      'Füße auf Stuhl oder Treppenstufe, Hände etwas breiter als schulterbreit. Brust absenken, dann hochdrücken.',
    watchFor: 'Der Körper bleibt eine gerade Linie, die Hüfte hängt nicht durch.',
  },
  floor_press: {
    subtitle: 'Bankdrücken auf dem Boden',
    howTo:
      'Rückenlage auf der Matte, Knie angestellt, Hanteln mit gestreckten Armen über der Brust. Absenken, bis die Oberarme den Boden berühren, kurz absetzen, hochdrücken.',
    watchFor: 'Ellbogen etwa 45 Grad zum Körper, nicht rechtwinklig abgespreizt.',
  },
  shoulder_press_kneeling: {
    subtitle: 'Hanteln über Kopf drücken, kniend',
    howTo:
      'Auf beiden Knien, Hanteln auf Schulterhöhe. Nach oben drücken, bis die Arme gestreckt sind, kontrolliert senken.',
    watchFor: 'Bauch und Gesäß anspannen, kein Hohlkreuz.',
  },
  triceps_overhead: {
    subtitle: 'Trizeps strecken über Kopf',
    howTo:
      'Eine Hantel mit beiden Händen über den Kopf strecken. Ellbogen beugen und die Hantel hinter den Kopf senken, dann wieder strecken.',
    watchFor: 'Die Oberarme bleiben neben dem Kopf, nur die Unterarme bewegen sich.',
  },
  row_one_arm: {
    subtitle: 'Rudern mit einer Hantel',
    howTo:
      'Eine Hand und das Knie derselben Seite auf Sofa oder Stuhl, Rücken flach und fast waagerecht. Hantel mit der freien Hand zur Hüfte ziehen, eine Sekunde halten, senken.',
    watchFor: 'Ellbogen eng am Körper, der Oberkörper dreht nicht mit.',
  },
  pullup: {
    subtitle: 'Klimmzug',
    howTo:
      'Stange etwas breiter als schulterbreit greifen, Handflächen zeigen weg vom Körper. Aus dem gestreckten Hang hochziehen, bis das Kinn über der Stange ist, langsam ablassen. Negativ-Wiederholung: mit Stuhl oder Sprung nach oben kommen und sich 5 Sekunden lang ablassen.',
    watchFor: 'Kein Schwung aus den Beinen, unten ganz aushängen.',
  },
  reverse_fly: {
    subtitle: 'Arme seitlich heben, vorgebeugt',
    howTo:
      'Oberkörper mit geradem Rücken weit nach vorn beugen, Hanteln hängen. Arme leicht gebeugt seitlich anheben, Schulterblätter zusammenziehen, senken.',
    watchFor: 'Kein Schwung, leichtes Gewicht.',
  },
  biceps_curl: {
    subtitle: 'Unterarme beugen',
    howTo:
      'Stehend, Hanteln seitlich, Handflächen nach vorn. Unterarme zu den Schultern beugen, langsam senken.',
    watchFor: 'Die Ellbogen bleiben am Körper.',
  },
  lateral_raise: {
    subtitle: 'Arme seitlich heben, stehend',
    howTo:
      'Stehend, Hanteln seitlich. Arme leicht gebeugt seitlich bis auf Schulterhöhe anheben, langsam senken.',
    watchFor: 'Schultern nicht zu den Ohren ziehen, kein Schwung.',
  },
  hanging_knee_raise: {
    subtitle: 'Knie anziehen im Hang',
    howTo:
      'An der Klimmzugstange hängen. Knie Richtung Brust ziehen und das Becken dabei einrollen, langsam senken.',
    watchFor: 'Kein Schwingen.',
  },
  dead_bug: {
    subtitle: 'Rumpfübung in Rückenlage',
    howTo:
      'Rückenlage, Arme senkrecht nach oben, Beine angehoben mit 90 Grad in Hüfte und Knie. Rechten Arm und linkes Bein gleichzeitig Richtung Boden strecken, zurückführen, Seite wechseln.',
    watchFor: 'Der untere Rücken bleibt die ganze Zeit am Boden.',
  },
  plank: {
    subtitle: 'Unterarmstütz',
    howTo:
      'Auf Unterarmen und Zehenspitzen, Ellbogen unter den Schultern. Position halten.',
    watchFor: 'Körper gerade, Bauch und Gesäß angespannt.',
  },
  side_plank: {
    subtitle: 'Seitlicher Unterarmstütz',
    howTo:
      'Seitlich auf einem Unterarm, Füße übereinander. Hüfte anheben und halten.',
    watchFor: 'Die Hüfte sackt nicht ab und dreht nicht nach vorn.',
  },
}

/**
 * Every word the learner reads, in one place.
 *
 * PRD F1 requires all Spanish copy to be reviewed by a native speaker. That is
 * only a realistic ask if the reviewer can read it as prose instead of hunting
 * through JSX, so nothing user-facing is written inline anywhere in the app.
 *
 * House style, and none of it is arbitrary:
 *
 *   - `tú`, never `usted`. The learner is 19 and this is not a bank.
 *   - Latin American vocabulary. `computadora`, not `ordenador`. No `vosotros`.
 *   - Short sentences. Functional literacy in Spanish is the assumption; long
 *     subordinate clauses are not.
 *   - Nothing that could read as a grade, a rank, or a failure. Not "incorrecto",
 *     not "0/10", not "perdiste". The test for every string is the PRD's own:
 *     would a nervous 19-year-old who thinks he is bad at English quit here?
 *   - Errors say what to do next, not what went wrong.
 */

export const es = {
  app: {
    name: "Hablar",
    tagline: "Aprende inglés hablando desde el primer día",
    description:
      "Un curso gratis de inglés para hispanohablantes. Veinte minutos al día, " +
      "y hablas en voz alta desde la primera sesión.",
  },

  landing: {
    heading: "Aprende inglés hablando",
    subheading:
      "Gratis. Veinte minutos al día. Hablas en voz alta desde la primera sesión, " +
      "aunque hoy no sepas nada.",
    samplePrompt: "Escucha. Así suena la primera lección:",
    sampleHint: "Toca para escuchar",
    sampleGloss: "En español",
    cta: "Empezar gratis",
    ctaSecondary: "Ya tengo cuenta",
    // Three promises, because the first question in his head is "what is the catch".
    promises: [
      "Gratis de verdad. Sin anuncios y sin tarjeta.",
      "Veinte minutos al día. Si un día no puedes, no pasa nada.",
      "Hablas desde la primera sesión. No solo tocas botones.",
    ],
    noSample: "La lección de muestra se está preparando.",
  },

  auth: {
    signupTitle: "Crea tu cuenta",
    signupSubtitle: "Toma menos de un minuto.",
    loginTitle: "Hola de nuevo",
    loginSubtitle: "Continúa donde te quedaste.",
    email: "Correo electrónico",
    password: "Contraseña",
    passwordHint: "Mínimo 8 caracteres.",
    submitSignup: "Crear cuenta",
    submitLogin: "Entrar",
    or: "o",
    google: "Continuar con Google",
    toLogin: "¿Ya tienes cuenta? Entra aquí",
    toSignup: "¿No tienes cuenta? Créala aquí",
    working: "Un momento…",

    // Every error names the fix. None of them blame the person reading it.
    errors: {
      emailRequired: "Escribe tu correo electrónico.",
      emailInvalid: "Ese correo no se ve bien. Revisa si falta algo.",
      passwordRequired: "Escribe una contraseña.",
      passwordShort: "La contraseña necesita al menos 8 caracteres.",
      invalidCredentials:
        "Ese correo y esa contraseña no coinciden. Inténtalo otra vez.",
      emailTaken: "Ya existe una cuenta con ese correo. Entra en vez de crearla.",
      rateLimited: "Demasiados intentos. Espera un minuto y vuelve a probar.",
      generic: "Algo falló de nuestro lado. Inténtalo otra vez en un momento.",
    },

    // Shown only if the project requires email confirmation before sign-in.
    confirmTitle: "Revisa tu correo",
    confirmBody:
      "Te enviamos un enlace a {email}. Ábrelo para entrar. Si no aparece, " +
      "revisa la carpeta de spam.",
  },

  onboarding: {
    stepOf: "Paso {current} de {total}",
    next: "Continuar",
    back: "Atrás",
    finish: "Empezar mi primera sesión",

    welcome: {
      title: "Bienvenido",
      body:
        "Esto es un curso de inglés para hablar, no para memorizar listas. " +
        "Veinte minutos al día. Es gratis y siempre lo será.",
      note: "Vamos a preparar tu cuenta en menos de un minuto.",
    },

    motivation: {
      title: "¿Para qué quieres el inglés?",
      // True today. The old line promised the answer would pick his
      // conversations; nothing read it. A promise on screen two that the
      // product does not keep is exactly the wrong first impression for a
      // learner deciding whether this thing is real.
      body: "Para conocerte. El curso empieza igual para todos, y esto nos ayuda a mejorarlo.",
      options: {
        work: { label: "Para el trabajo", hint: "Entrevistas, compañeros, clientes" },
        travel: { label: "Para viajar", hint: "Aeropuertos, hoteles, direcciones" },
        family: { label: "Por mi familia", hint: "Familiares, la escuela, el doctor" },
        study: { label: "Para estudiar", hint: "Clases, exámenes, lecturas" },
        other: { label: "Otra razón", hint: "Tú sabes por qué" },
      },
    },

    // No adaptive placement yet (PRD D19 is Phase 2). Saying so plainly beats
    // a test that cannot change the answer -- and the PRD's rule holds either
    // way: a starting point, never a score.
    placement: {
      title: "Empiezas desde el principio",
      body:
        "Vas a empezar por el primer bloque: saludos, tu nombre y cómo pedir " +
        "ayuda cuando no entiendes.",
      reassurance: "Nadie empieza sabiendo. Eso no es un problema, es el punto de partida.",
      note: "Si resulta muy fácil, avanzas rápido. Nada te detiene.",
    },

    microphone: {
      title: "Vas a hablar en voz alta",
      // The reason comes BEFORE the browser prompt (PRD F1). A permission
      // dialog with no explanation is the fastest way to get a "no".
      body:
        "Para practicar necesitamos escucharte. Tu voz se queda en tu teléfono " +
        "y solo se guarda si tú lo pides.",
      allow: "Permitir micrófono",
      skip: "Ahora no, prefiero escribir",
      denied:
        "Sin problema. Puedes escribir tus respuestas y activar el micrófono " +
        "cuando quieras desde Ajustes.",
      unsupported:
        "Tu navegador no puede escuchar todavía. No importa: puedes escribir " +
        "tus respuestas y todo funciona igual.",
      granted: "Listo. Ya podemos escucharte.",
    },

    goal: {
      title: "¿Cuánto tiempo al día?",
      body: "Puedes cambiarlo cuando quieras.",
      options: {
        10: { label: "10 minutos", hint: "Corto pero constante" },
        20: { label: "20 minutos", hint: "Lo recomendado" },
        30: { label: "30 minutos", hint: "Vas con prisa" },
      },
      note: "Si un día no puedes, no pierdes nada. Aquí no se rompe ninguna racha.",
    },
  },

  // Offline (ROADMAP #10). Offered, never automatic: the megabytes are his.
  offline: {
    save: "Guardar esta unidad para usarla sin internet",
    saving: "Guardando…",
    saved: "Listo. {count} pistas guardadas en este teléfono.",
    unsupported: "Este navegador no puede guardar para usar sin internet.",
  },

  // The phrasebook (ROADMAP #8). Headings are situations, not grammar, because
  // that is how he will look: "I'm at the counter", never "ordering".
  phrasebook: {
    title: "Mis frases",
    blurb: "Todo lo que ya viste, por situación. Toca una para oírla.",
    search: "Buscar",
    searchHint: "En inglés o en español",
    noMatch: "Nada con esas palabras. Prueba con otra.",
    empty: "Todavía no tienes frases. Empieza una sesión y aquí van quedando.",
    groups: {
      repair: "Si no entiendes",
      greet: "Saludar y despedirse",
      numbers: "Números y teléfono",
      people: "Familia y gente",
      street: "En la calle",
      work: "El trabajo y la hora",
      cafe: "En el café",
      feelings: "Cómo te sientes",
      other: "Otras",
    },
  },

  // The listening library (ROADMAP #4). A shelf, not a stage: the copy must
  // never suggest there is something to get right here. "Más historias" and
  // not "práctica de escucha", because practice is what he does in the
  // session and this is what he does on the bus.
  listening: {
    title: "Más historias",
    blurb: "Las mismas personas, las mismas palabras que ya conoces, más tiempo escuchando. Sin preguntas.",
    empty: "Todavía no hay historias para lo que llevas. Pronto.",
    narrator: "Cuenta {name}",
    play: "Escuchar",
    pause: "Pausa",
    speed: "Velocidad",
    noAudio: "Esta historia todavía no tiene audio.",
    backToLibrary: "Todas las historias",
  },

  // Ajustes. The one place the learner is in charge of the product rather than
  // the other way round, so the copy never scolds and never implies a "right"
  // answer. Less Spanish is not better; it is just later.
  settings: {
    title: "Ajustes",
    back: "Volver",
    saved: "Listo, guardado.",
    save: "Guardar",

    spanishTitle: "¿Cuánto español quieres ver?",
    spanishBlurb:
      "Puedes cambiarlo cuando quieras. Ver más español no es hacer trampa: es como se aprende al principio.",
    spanish: {
      "1": "Bastante. Quiero ver la traducción cuando la necesite.",
      "3": "El justo. Traducción a la mano, preguntas en inglés cuando las haya.",
      "5": "Poco. Quiero intentarlo sin traducción.",
    },

    goalTitle: "¿Cuántos minutos al día?",
    goalBlurb: "Es una meta, no una regla. Nadie te va a quitar nada por no llegar.",
    goalOption: "{minutes} minutos",

    // Offered when the learner keeps revealing the Spanish -- never announced
    // as a problem, and never applied without them saying yes.
    offerTitle: "¿Te ponemos más español?",
    offerBody:
      "Vimos que abres la traducción seguido. Eso está bien, y podemos dejarla más a la mano.",
    offerAccept: "Sí, más español",
    offerDismiss: "Así está bien",
  },

  home: {
    // The missions scoreboard (ROADMAP #9). Counts people, not points: this
    // is the one number that measures the thing the product exists for.
    peopleSpokenTo: "Has hablado inglés con {count} personas",
    peopleSpokenToOne: "Has hablado inglés con 1 persona",
    phrasebookCta: "Mis frases",
    listeningCta: "Más historias para escuchar",
    settingsCta: "Ajustes",
    greeting: "Hola",
    startSession: "Empezar",
    sessionLength: "unos {minutes} minutos",
    todayTitle: "Hoy",
    daysPracticed: "{count} días practicados",
    daysPracticedOne: "1 día practicado",
    firstSession: "Tu primera sesión te espera.",
    resumeSession: "Seguir",
    reviewSession: "Repasar",
    // Reached when the authored curriculum runs out, which today is after one
    // unit. Says plainly that the limit is ours, not theirs -- a learner who
    // has finished everything that exists has not done anything wrong.
    caughtUp: "Ya viste todo lo que hay por ahora. Estamos escribiendo más.",
    caughtUpBody: "Mientras tanto, tus repasos siguen. Son los que hacen que se quede.",

    // PRD F8. Nothing here may read as a warning, a countdown, or something the
    // learner is about to lose. "Días seguidos" can quietly go back to 1; it is
    // never announced, and there is no copy for breaking it because the product
    // does not have that idea.
    xp: "{count} XP",
    consecutiveDays: "{count} días seguidos",
    consecutiveDaysOne: "1 día seguido",
    questsTitle: "Hoy puedes",
    missionCta: "Tienes una misión: {title}",
    patternsCta: "Algo que se te repite",
    questDone: "Listo",
    quests: {
      speak: "Habla en voz alta una vez",
      session: "Termina una sesión",
      review: "Repasa {target} frases",
      meet: "Aprende {target} frases nuevas",
      listen: "Escucha una escena",
    },
    signOut: "Cerrar sesión",
  },

  session: {
    // The five stages of a daily session (PRD 4.2). Each blurb answers the one
    // question a beginner actually has -- "what are you about to ask me to
    // do?" -- before anything starts playing.
    stages: {
      ear: {
        title: "Afina el oído",
        blurb: "Escuchas pares de palabras casi iguales, con voces distintas, hasta que la diferencia te salta sola.",
      },
      meet: {
        title: "Conoce frases nuevas",
        blurb: "Frases completas que puedes usar hoy mismo. Nada de listas de palabras sueltas.",
      },
      absorb: {
        title: "Escucha la historia",
        blurb: "Una conversación corta, hecha casi toda con lo que ya conoces.",
      },
      retrieve: {
        title: "Recuerda",
        blurb: "Las frases vuelven justo cuando estás a punto de olvidarlas. Así se quedan.",
      },
      speak: {
        title: "Habla en voz alta",
        blurb: "Dices las frases tú, con tu voz. Nadie te está calificando.",
      },
    },
    progress: "Paso {position} de {total}",

    // Stage 1 (Ear). Two words that sound the same to a Spanish ear until they
    // do not. Never framed as a test -- it is a warm-up, and being wrong here
    // is the normal state for weeks.
    ear: {
      counter: "Sonido {position} de {total}",
      prompt: "¿Cuál escuchaste?",
      replay: "Escuchar otra vez",
      right: "¡Eso es!",
      wrong: "Era esta:",
      next: "Siguiente",
      notReady: "Todavía estamos grabando las voces para esta parte.",
    },

    // Stage 5 (Speak). The whole product's thesis: the learner talks out loud
    // from day one. Nothing here scores pronunciation, and nothing waits on a
    // microphone -- denying it must cost nothing at all (PRD F1).
    speak: {
      scenarioLabel: "La situación",
      // The formulation step: Spanish on screen, a visible clock, and the
      // learner says the English before it appears. The clock has to read as
      // a game and never as an exam -- it runs out, the answer shows up, and
      // nothing was lost. So the copy says out loud that it grades nothing.
      formulateIntro: "Antes del guion, un calentamiento. Di estas frases en inglés.",
      formulateClock: "Tienes cinco segundos. El reloj no califica nada.",
      formulatePrompt: "¿Cómo se dice…?",
      formulateReveal: "Se dice así:",
      formulateCompare: "Escúchalo y compáralo con lo que dijiste.",
      formulateNext: "Siguiente",
      formulateStart: "Empezar",
      counter: "Frase {position} de {total}",
      // Three rounds of the same five phrases, each a second faster. Framed as
      // "otra vez, más rápido" -- a game, never a retest.
      roundCounter: "Ronda {round} de {total}",
      formulateSkip: "Saltar el calentamiento",
      // The frame step: the first time the learner builds a sentence nobody
      // wrote for them. The copy has to make that feel like a small freedom
      // rather than a test, because it is the moment the course stops being a
      // phrasebook -- so: "armá la tuya", never "completá el espacio".
      frameIntro: "Ahora arma una tuya. Elige lo que quieras decir:",
      frameSay: "Dilo en voz alta:",
      frameAnother: "Probar otra",
      yourTurn: "Te toca. Dilo en voz alta:",
      theirTurn: "{name} dice:",
      said: "Ya lo dije",
      // The inversion: his line arrives as Spanish first. Producing the
      // English is the exercise; reading it off the screen is the fallback,
      // one tap away and never a failure.
      revealLine: "Ver la frase en inglés",
      hearModel: "Oír cómo suena",
      hearAgain: "Oír otra vez",
      reviewModel: "Oír el modelo",
      recordHint: "Nadie te está calificando. Nadie más lo escucha.",
      recording: "Grabando…",
      recordStart: "Grabar mi voz",
      recordStop: "Listo",
      recordOptional: "Grabar es opcional.",
      // After a take: he hears himself before deciding to keep it. This is
      // the one pronunciation intervention that works with no teacher, and
      // the copy has to make re-recording feel free rather than corrective.
      reviewTitle: "Escúchate",
      reviewHint: "Así sonaste. Nadie más lo oye. Puedes guardarlo o grabar otra vez.",
      reviewPlay: "Oír mi voz",
      reviewPlaying: "Sonando…",
      reviewKeep: "Guardar y seguir",
      reviewAgain: "Grabar otra vez",
      // The mic can be denied, unsupported, or simply fail. All the same here.
      recordFailed: "No pudimos grabar, pero eso no importa. Sigue en voz alta.",
      done: "Lo hiciste. Hablaste en inglés.",
      notReady: "Esta unidad todavía no tiene práctica de conversación.",
    },

    // Stage 4 (Retrieve). The one stage where the learner can be wrong, so the
    // wording carries the most weight: no scores, no streak-at-risk, no red.
    retrieve: {
      counter: "Tarjeta {position} de {total}",
      recognizePrompt: "¿Qué significa?",
      producePrompt: "¿Cómo se dice en inglés?",
      // Dictation: the clip is the whole prompt. "Escríbelo" and not
      // "escríbelo bien" -- the grader is as lenient here as everywhere.
      dictationPrompt: "Escucha y escribe lo que oíste:",
      dictationPlay: "Escuchar",
      inputLabel: "Escríbelo en inglés",
      check: "Revisar",
      skip: "No me acuerdo",
      right: "¡Eso es!",
      // Not "incorrecto", and never the learner's answer echoed back at them
      // next to a cross. Say the phrase; that is the useful part.
      almost: "Casi. Se escribe así:",
      wrong: "Se dice así:",
      next: "Siguiente",
      // The queue can legitimately be empty -- everything is scheduled for
      // later, which is the system working, not a gap.
      nothingDue: "No tienes nada que repasar ahora.",
      nothingDueBody: "Vuelve mañana y estas frases te estarán esperando.",
    },

    // Stage 3 (Absorb). The scene is meant to be almost followable already, so
    // the transcript is never hidden -- this is comprehension, not a memory test.
    absorb: {
      sceneCounter: "Escena {position} de {total}",
      play: "Escuchar la escena",
      playAgain: "Escuchar otra vez",
      stop: "Pausar",
      tapHint: "Toca cualquier línea para repetirla.",
      toQuestions: "Ya escuché",
      questionCounter: "Pregunta {position} de {total}",
      // Never a score and never the word "incorrecto". Getting one wrong is
      // information, not a verdict, and the learner is told the answer either way.
      right: "¡Eso es!",
      // No trailing colon: the correct option is highlighted in the list *above*
      // this line, so "la respuesta es:" dangles with nothing after it.
      wrong: "Casi. La correcta está marcada.",
      nextQuestion: "Siguiente",
      noAudio: "Esta escena todavía no tiene audio. Puedes leerla.",
      // PRD F11. Three steps on one line, in the order the technique needs.
      // Nothing is scored and the microphone is never required.
      // Its own counter: reusing the question one made the shadowing steps read
      // "Pregunta 1 de 3", which is three questions the learner is not being asked.
      shadowCounter: "Parte {position} de {total}",
      shadowTitle: "Ahora dilo tú",
      shadowListen: "Escucha la frase.",
      shadowRepeat: "Ahora repítela en el silencio, después del audio.",
      shadowShadow: "Ahora dila al mismo tiempo que la voz. Vas a tropezar; eso es normal.",
      shadowNoScript: "Esta vez sin leer. Solo tu oído y tu voz.",
      shadowPlay: "Escuchar",
      shadowDone: "Listo",
      shadowSkip: "Saltar esta parte",
    },

    // Stage 2 (Meet). Nothing here may read as a test -- this is the first time
    // the learner sees these words, and there is nothing yet to get wrong.
    meet: {
      counter: "Frase {position} de {total}",
      listen: "Escuchar",
      otherVoice: "Otra voz",
      // Which voice, because three of the four are the same accent -- a label
      // that reads "US (General American)" three taps running looks like a
      // button that does nothing.
      voiceCount: "Voz {position} de {total}",
      reveal: "¿Qué significa?",
      example: "Así se usa:",
      next: "Siguiente",
      // Shown when a chunk has no audio at all. Rare, and never the learner's
      // problem, so it says what they can still do rather than what is missing.
      noAudio: "Esta frase todavía no tiene audio. Puedes leerla.",
    },
    resumed: "Seguimos donde lo dejaste.",
    // Same promise /home made while it was empty: say plainly that a part is
    // still being built rather than showing a screen that does nothing.
    underConstruction: "Esta parte se está construyendo. Por ahora, sigue adelante.",
    continue: "Continuar",
    finish: "Terminar",
    exit: "Salir",
    exitNote: "Puedes salir cuando quieras. Volvemos a este mismo punto.",
    // Reached when a unit has no stage it can serve -- no audio, no chunks.
    // A beginner must never be shown a technical reason for this.
    empty: {
      title: "Todavía no",
      body: "Esta lección aún no está lista. No es nada que hayas hecho tú.",
      back: "Volver a Hoy",
    },
    done: {
      title: "Listo por hoy",
      body: "Terminaste la sesión. Nos vemos mañana.",
    },
  },

  // Real-world missions (PRD F12). The hardest copy in the product to get
  // right: it is asking a nervous person to speak to a stranger. Every line is
  // written to lower the stakes, and nothing anywhere calls it a test, a
  // challenge, or something to pass.
  mission: {
    label: "Tu misión",
    title: "Una misión de verdad",
    difficulty: "Nivel {level}",
    // Named plainly, because the whole point is that it happens off the phone.
    outOfApp: "Esto no se hace en la app. Se hace allá afuera.",
    alternateTitle: "¿No hay nadie con quien hablar inglés hoy?",
    alternateNote: "Esta opción cuenta exactamente igual. No es un premio de consolación.",
    start: "Ya la hice",
    later: "Hoy no",
    // The report. Three taps, all optional, none of them a grade.
    reportTitle: "¿Cómo te fue?",
    reportSkip: "Las dos preguntas son opcionales. Puedes no contestar ninguna.",
    feltLabel: "¿Cómo te sentiste?",
    felt: { 1: "Me costó", 2: "Más o menos", 3: "Bien" },
    understoodLabel: "¿Te entendieron?",
    understood: { yes: "Sí", partly: "Más o menos", no: "No" },
    send: "Listo",
    // Shown after any report, whatever it said. Attempting is the whole thing.
    thanks: "Lo hiciste. Eso es lo que cuenta.",
    thanksBody: "No importa cómo salió. Abriste la boca en inglés con una persona real.",
    none: "No tienes misión pendiente ahora.",
    noneBody: "Aparecen cuando ya conoces las frases que necesitas.",
    back: "Volver a Hoy",
  },

  // The payoff of error detection (PRD F6): naming a rule, once, with the
  // learner's own words as the example. Everything here is written to read as
  // a lesson rather than a report card -- no counts of mistakes, no "errores",
  // and nothing that suggests they are behind.
  patterns: {
    label: "Un detalle",
    title: "Algo que se te repite",
    // Softens the whole page: this is a category of thing, not a personal flaw,
    // and it is the single most common one among Spanish speakers.
    intro: "Le pasa a casi todos los que hablan español. Una vez que lo ves, ya no se te olvida.",
    youWrote: "Escribiste",
    itIs: "Se dice",
    times: "Ha pasado {count} veces",
    none: "Nada que señalar por ahora.",
    noneBody: "Cuando algo se repita, te lo decimos aquí. Una cosa a la vez.",
    back: "Volver a Hoy",
  },

  // What the learner sees when something on our side is broken.
  //
  // The rule for every string here is the one the whole product is written to:
  // it must be impossible to read any of it as "you did something wrong". A
  // beginner who already suspects he is bad at this will take an unexplained
  // failure personally, so every message says plainly whose fault it is.
  trouble: {
    // Generic: an unexpected exception anywhere in the app.
    title: "Algo se rompió de este lado",
    body: "No es nada que hayas hecho tú. Vuelve a intentarlo en un momento.",
    retry: "Intentar otra vez",
    home: "Volver al inicio",

    // Specific: the backend is unreachable. Distinguished because the honest
    // message is different -- nothing is broken, it is asleep, and his progress
    // is not lost.
    offlineTitle: "No podemos conectar ahora mismo",
    offlineBody: "Tu progreso está guardado y no se ha perdido nada. Esto es un problema nuestro, no tuyo.",
    offlineHint: "Inténtalo de nuevo en unos minutos.",
  },

  common: {
    loading: "Cargando…",
    retry: "Intentar otra vez",
    close: "Cerrar",
  },
} as const;

/** `es.onboarding.stepOf` and friends carry {placeholders}. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    key in values ? String(values[key]) : match
  );
}

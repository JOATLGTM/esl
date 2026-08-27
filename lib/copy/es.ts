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
      body: "Así elegimos las conversaciones que vas a practicar.",
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

  home: {
    greeting: "Hola",
    startSession: "Empezar",
    sessionLength: "unos {minutes} minutos",
    todayTitle: "Hoy",
    daysPracticed: "{count} días practicados",
    daysPracticedOne: "1 día practicado",
    firstSession: "Tu primera sesión te espera.",
    comingSoon: "La sesión diaria se está construyendo. Vuelve pronto.",
    signOut: "Cerrar sesión",
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

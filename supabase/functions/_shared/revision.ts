// CloseLabs Voice — revisión mecánica del dictado: la red de seguridad.
//
// La regla del producto es que el contenido clínico NUNCA se pierda ni cambie sin avisar. Ningún
// modelo la cumple solo: medido el 2026-09-24/29, gpt-4o-mini dejaba dosis dobles, Groq borraba
// tramos enteros del audio y los reemplazaba por la pista, y el troceado nuestro borraba frases con
// decimales. Los principales de hoy (OpenAI para la voz, gpt-6-luna para limpiar) salieron limpios
// en el banco, pero cuando se caen responde el respaldo, que es justo el que falla.
//
// Esto no usa ningún modelo: compara textos. Tarda menos de un milisegundo.
//
// ⚠️ PRIVACIDAD: nada de lo que se compara aquí sale del proceso. Lo que se registra es un código
// ("revision_limpieza", "eco_pista"), nunca el número ni la frase que lo disparó.

/** Cómo actúa la revisión de la limpieza. Se cambia en `app_config.content_check`, sin deploy. */
export type ModoRevision = "off" | "observe" | "enforce";

// ---------------------------------------------------------------------------------------------
// Capa 1 — ¿la limpieza perdió algo?
// ---------------------------------------------------------------------------------------------

/**
 * Las mismas señales de autocorrección que reconoce el prompt de limpieza (regla 3). Un número
 * dicho justo antes de una de estas señales PUEDE desaparecer: es lo que el médico retractó.
 * "digo" se cuela en frases normales ("le digo al paciente"); eso solo hace la revisión un poco
 * más permisiva cerca de esa palabra, nunca más estricta.
 */
const SENALES =
  /(?<!\p{L})(mentiras?|perd[oó]n|corrijo|me equivoqu[eé]|mejor dicho|o sea,? no|no,? espera|no,? no|digo)(?!\p{L})/giu;

/** Cuántas palabras antes de la señal se consideran "lo retractado". */
const VENTANA_RETRACCION = 12;

/**
 * Por debajo de este largo no se mira si el texto se encogió: en un dictado corto, una sola
 * corrección ("cada 8 horas, mentira, cada 12 horas") ya lo reduce a la mitad legítimamente.
 */
const MINIMO_PARA_PROPORCION = 200;

/**
 * Lo mínimo que puede medir el texto limpio frente al crudo. Quitar muletillas y aplicar
 * correcciones lo encoge un 5-20%; los casos del banco nunca bajan de 0,8. Perder un párrafo lo
 * encoge mucho más. 0,6 deja margen de sobra para lo legítimo.
 */
const PROPORCION_MINIMA = 0.6;

/** Formas escritas de los números que la limpieza puede usar en vez de los dígitos. */
const EN_PALABRAS: Record<string, string[]> = {
  "0": ["cero"], "1": ["un", "uno", "una"], "2": ["dos"], "3": ["tres"], "4": ["cuatro"],
  "5": ["cinco"], "6": ["seis"], "7": ["siete"], "8": ["ocho"], "9": ["nueve"], "10": ["diez"],
  "11": ["once"], "12": ["doce"], "13": ["trece"], "14": ["catorce"], "15": ["quince"],
  "16": ["dieciséis", "dieciseis"], "17": ["diecisiete"], "18": ["dieciocho"],
  "19": ["diecinueve"], "20": ["veinte"], "30": ["treinta"], "40": ["cuarenta"],
  "50": ["cincuenta"], "60": ["sesenta"], "70": ["setenta"], "80": ["ochenta"],
  "90": ["noventa"], "100": ["cien"],
};

/**
 * Los números del texto, con el separador unificado. "7,2" y "7.2" son el mismo valor, igual que
 * "240,000", "240.000" y "240 000": cambiar el estilo del separador no es cambiar el contenido.
 */
export function numerosDe(s: string): string[] {
  return (s.replace(/(\d) (?=\d{3}(?!\d))/g, "$1.").match(/\d+(?:[.,]\d+)*/g) ?? [])
    .map((n) => n.replace(/,/g, "."));
}

const palabras = (s: string) => s.toLowerCase().split(/[^\p{L}\p{N}.,]+/u).filter(Boolean);

/** Números dichos justo antes de una señal de corrección: pueden desaparecer con razón. */
function retractados(crudo: string): Set<string> {
  const fuera = new Set<string>();
  for (const m of crudo.matchAll(SENALES)) {
    const antes = palabras(crudo.slice(0, m.index ?? 0)).slice(-VENTANA_RETRACCION).join(" ");
    for (const n of numerosDe(antes)) fuera.add(n);
  }
  return fuera;
}

/** ¿El número del crudo sigue en el limpio, escrito de cualquier forma válida? */
function sigue(n: string, limpio: string, delLimpio: string[]): boolean {
  if (delLimpio.includes(n)) return true;
  // "1 metro y 56" → "1,56 m": cada parte del número nuevo cuenta.
  if (delLimpio.some((x) => x.split(".").includes(n))) return true;
  // "240.000" → "240000".
  const digitos = n.replace(/\./g, "");
  if (delLimpio.some((x) => x.replace(/\./g, "") === digitos)) return true;
  // "1 gramo" → "un gramo".
  const formas = EN_PALABRAS[n];
  return !!formas && formas.some((f) => new RegExp(`(?<!\\p{L})${f}(?!\\p{L})`, "iu").test(limpio));
}

export type ResultadoRevision =
  | { ok: true }
  | { ok: false; motivo: "numero_perdido" | "texto_encogido"; cuantos: number };

/**
 * Compara el dictado crudo con su versión limpia. Falla si se perdió un número que el médico NO
 * retractó, o si el texto se encogió mucho más de lo que explican las muletillas y correcciones.
 *
 * No mira si el modelo reescribió o reordenó: eso lo mide el banco. Esto es la última barrera en
 * producción, y por eso solo pregunta lo que se puede afirmar sin entender el texto.
 */
export function revisarLimpieza(crudo: string, limpio: string): ResultadoRevision {
  const fuera = retractados(crudo);
  const delLimpio = numerosDe(limpio);
  const perdidos = numerosDe(crudo).filter((n) => !fuera.has(n) && !sigue(n, limpio, delLimpio));
  if (perdidos.length) return { ok: false, motivo: "numero_perdido", cuantos: perdidos.length };

  if (crudo.length >= MINIMO_PARA_PROPORCION && limpio.length < crudo.length * PROPORCION_MINIMA) {
    return { ok: false, motivo: "texto_encogido", cuantos: 1 };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------------------------
// Capa 2a — frases que el motor de voz inventó
// ---------------------------------------------------------------------------------------------

/**
 * Frases que Whisper y sus parientes escriben en los silencios porque se entrenaron con
 * subtítulos. Es la misma lista que `WHISPER_HALLUCINATIONS` en `audio_toolkit/text.rs`: la app
 * descarta el dictado cuando es TODO el texto; aquí se quitan cuando vienen como una frase suelta
 * dentro de un dictado real ("…por sospecha de apendicitis aguda. Gracias por ver el video.").
 */
const ALUCINACIONES = new Set([
  "subtitulos realizados por la comunidad de amara org",
  "subtitulado por la comunidad de amara org",
  "gracias por ver",
  "gracias por ver el video",
  "gracias por ver este video",
  "muchas gracias por ver el video",
  "suscribete",
  "suscribete al canal",
  "no olvides suscribirte",
  "thanks for watching",
  "thank you for watching",
  "thank you",
  "sous titres realises par la communaute d amara org",
  "merci d avoir regarde cette video",
  "untertitel der amara org community",
  "legendas pela comunidade amara org",
]);

/** Minúsculas, sin tildes y solo letras/dígitos separados por un espacio (como en text.rs). */
function normalizar(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

/** Frases con su signo final, y lo que quede sin signo al final. */
function frases(texto: string): string[] {
  const out: string[] = [];
  let desde = 0;
  for (const m of texto.matchAll(/[.!?]+(?=\s|$)/g)) {
    const hasta = (m.index ?? 0) + m[0].length;
    out.push(texto.slice(desde, hasta));
    desde = hasta;
  }
  if (desde < texto.length) out.push(texto.slice(desde));
  return out;
}

export interface Transcripcion {
  texto: string;
  /** Se quitó al menos una frase de subtítulos. */
  quitadas: number;
  /**
   * Hay una frase que parece la PISTA repetida en vez de lo que se dijo. NO se quita: medido el
   * 2026-09-28, esa frase a veces viene pegada a contenido real ("Dictado m en espa con un paciente
   * con un cuadro cl compatible con osteoartrosis…"), y borrarla borraría el diagnóstico. Lo que
   * sirve es saber que pasó: casi siempre significa que el motor se comió un tramo del audio.
   */
  ecoPista: boolean;
}

/**
 * Quita las alucinaciones de subtítulos que vienen como frase suelta y detecta el eco de la pista.
 * Si quitar dejaría el texto vacío, no toca nada: ese caso lo descarta la app entera.
 */
export function revisarTranscripcion(texto: string, pista: string): Transcripcion {
  const partes = frases(texto);
  const quedan = partes.filter((f) => !ALUCINACIONES.has(normalizar(f)));
  const quitadas = partes.length - quedan.length;
  const limpio = quitadas && quedan.join("").trim() ? quedan.join("").trim() : texto;

  // Eco de la pista: la frase de estilo que ningún médico dicta, o una frase hecha SOLO de
  // palabras del diccionario del médico repetidas ("CloseLabs, CloseS, CloseLabs, CloseLabs.").
  const n = normalizar(limpio);
  // "dictado m" y no "dictado medico": en los tramos degradados de Groq la fuga sale cortada en la
  // tilde ("Dictado m en espa con un paciente…", 2026-09-28).
  const estilo = /(?<!\p{L})dictado m(?!\p{L})|dictado medico|correos electronicos escritos como/u.test(n);
  const delDiccionario = new Set(normalizar(pista).split(" ").filter((w) => w.length > 3));
  // Solo palabras de más de 3 letras en los dos lados: si no, "de" contaría como conocida en
  // cuanto el diccionario tenga "desloratadina". El prefijo cubre las deformaciones del eco
  // ("CloseS" por "CloseLabs") con un mínimo de 5 letras.
  const soloDiccionario = delDiccionario.size > 0 && frases(limpio).some((f) => {
    const ws = normalizar(f).split(" ").filter((w) => w.length > 3);
    const conocidas = ws.filter((w) =>
      delDiccionario.has(w) || (w.length >= 5 && [...delDiccionario].some((d) => d.startsWith(w))));
    return ws.length >= 3 && conocidas.length / ws.length >= 0.75;
  });

  return { texto: limpio, quitadas: quitadas && limpio !== texto ? quitadas : 0, ecoPista: estilo || soloDiccionario };
}

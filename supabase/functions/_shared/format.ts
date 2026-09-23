// CloseLabs Voice — limpieza del dictado, compartida por `/format` y por `/dictate`.
//
// ⚠️ El texto que pasa por aquí es el dictado de un paciente: no se guarda, no se registra y no
// aparece en ningún mensaje de error. Solo se cuenta cuántos tokens fueron.

import { fetchWithTimeout, isAbort, classifyProviderError } from "./http.ts";
import { resolveRoutes, type Route } from "./routing.ts";
import { logUsage, type ErrorCode } from "./usage.ts";

/**
 * Tiempo total para formatear, contando el respaldo. La app le da 30 s a esta parte
 * (`FORMAT_TIMEOUT` en proxy.rs) y después pega el texto crudo; se deja margen para la respuesta.
 *
 * ⚠️ Subido de 12 s a 25 s el 2026-09-22 junto con `MAX_OUTPUT_TOKENS`: el tiempo de formateo lo
 * manda el LARGO de la salida, no el proveedor. Medido contra Groq real: ~830 tokens por segundo,
 * así que un dictado de 5 min (~7.500 tokens de salida) necesita ~9 s solo de generación. Con el
 * presupuesto viejo el respaldo ni alcanzaba a intentarlo.
 */
const PRESUPUESTO_MS = 25_000;

/**
 * Lo máximo que se le espera a un proveedor que NO es el último. Un dictado corto se formatea en
 * 1-2 s (medido: DeepInfra 1,66 s, Groq 1,09 s), pero uno largo tarda en proporción a su salida:
 * el de 60 s medido en producción gastó 1.877 tokens y tardó 2,3 s. 12 s cubre el dictado más
 * largo que cabe en `MAX_OUTPUT_TOKENS` sin dejar al respaldo sin turno.
 */
const TOPE_INTENTO_MS = 12_000;
const MINIMO_INTENTO_MS = 2_000;

/**
 * Techo de tokens de salida POR TROZO.
 *
 * ⚠️ Dos historias que hay que leer juntas:
 *
 * 1. El techo viejo de 2.000 tumbaba todo dictado de más de ~73 s: el modelo se quedaba sin cupo,
 *    devolvía HTTP 200 con `finish_reason: "length"` y el JSON cortado, y el médico recibía texto
 *    sin puntuar justo en los dictados largos. Por eso se subió a 8.000 el 2026-09-22.
 * 2. Pero `gpt-oss-20b` RAZONA antes de escribir, y su razonamiento se estira hasta llenar el cupo
 *    que le den: con 8.000 el mismo dictado corto pasó de 1-2 s a 6-20 s, y gastó 6.806 tokens de
 *    salida donde el texto final eran ~90 (medido el 2026-09-23 en los tres proveedores).
 *
 * La salida es el corte del dictado (ver `partirDictado`): con trozos de ~900 caracteres, ninguno
 * necesita más de ~600 tokens de texto, así que 3.000 deja aire de sobra para el razonamiento y a
 * la vez le pone freno. Si vuelve a aparecer `truncated` en `usage_events`, el trozo es lo que hay
 * que achicar, no este techo.
 */
const MAX_OUTPUT_TOKENS = 3_000;

/**
 * Techo de reserva, para el trozo al que no le alcanzó el primero.
 *
 * ⚠️ Lo que hay detrás: `gpt-oss-20b` razona antes de escribir y ese razonamiento es MUY variable
 * — medido el 2026-09-23, el mismo texto de 300 caracteres gastó entre 315 y 5.977 tokens. Un
 * techo fijo obliga a elegir entre lento (si es alto, el modelo se estira hasta llenarlo: 20 s) y
 * roto (si es bajo, se corta a media frase). Por eso el techo es adaptable: casi todos los trozos
 * caben en 3.000 y salen en ~2 s; al que no, se le repite con 8.000 y tarda unos segundos más.
 * Solo si TAMBIÉN se corta con 8.000 se da por perdido, y ahí la app pega la transcripción cruda.
 */
const TECHO_AMPLIO = 8_000;

const SCHEMA = {
  type: "object",
  properties: { transcription: { type: "string" } },
  required: ["transcription"],
  additionalProperties: false,
};

export type FormatResult =
  | { ok: true; text: string; provider: string }
  | { ok: false; code: ErrorCode; status: number };

export async function formatText(
  deviceId: string,
  text: string,
  systemPrompt: string,
): Promise<FormatResult> {
  if (!text.trim() || !systemPrompt.trim()) {
    return { ok: false, code: "bad_request", status: 400 };
  }

  let routes: Route[];
  try {
    routes = await resolveRoutes("format");
  } catch (e) {
    console.error("ruteo:", (e as Error).message);
    return { ok: false, code: "provider_error", status: 503 };
  }

  // Casi todo fallo aquí es del proveedor (la entrada ya se validó arriba), así que vale la pena
  // probar el siguiente. La excepción es `truncated`, que se corta abajo. Si no queda ninguno, la
  // app pega el texto crudo: peor que puntuado, pero el dictado no se pierde.
  const limite = Date.now() + PRESUPUESTO_MS;
  let ultimo: FormatResult = { ok: false, code: "provider_error", status: 502 };
  for (let n = 0; n < routes.length; n++) {
    const esUltimo = n === routes.length - 1;
    const queda = limite - Date.now();
    if (queda < MINIMO_INTENTO_MS) break;
    // El tiempo lo manda el LARGO del dictado: el modelo razona antes de escribir, y medido en
    // producción un dictado de 100 s gastó 6.806 tokens de salida y 8,5 s. Un tope fijo de 12 s
    // dejaba al primer proveedor sin terminar para "ahorrarle" turno a un respaldo que iba a
    // tardar lo mismo. Por eso el tope crece con el texto: +1 s por cada 1.000 caracteres.
    const topeSegunLargo = TOPE_INTENTO_MS + Math.round(text.length / 1_000) * 1_000;
    const limiteIntento =
      Date.now() + (esUltimo ? queda : Math.min(topeSegunLargo, queda - MINIMO_INTENTO_MS));

    const r = await formatearCon(routes[n], deviceId, text, systemPrompt, limiteIntento);
    if (r.ok) {
      if (n > 0) console.warn(`formateo servido por el respaldo ${routes[n].provider}`);
      return r;
    }
    ultimo = r;
    // `truncated` no es un fallo del proveedor: es que el dictado no cabe en el techo de salida.
    // Los del respaldo sirven el mismo modelo con el mismo techo, así que probarlos solo hace
    // esperar al médico para truncar otras dos veces — medido: 12 s de espera para nada.
    if (r.code === "truncated") {
      console.error("el dictado excede MAX_OUTPUT_TOKENS; el respaldo truncaría igual");
      return r;
    }
    if (!esUltimo) {
      console.warn(`${routes[n].provider} falló (${r.code}) al formatear; se prueba el siguiente`);
    }
  }
  return ultimo;
}

/**
 * Corte del dictado en trozos, para formatear en PARALELO.
 *
 * ⚠️ Por qué existe: el tiempo de formateo lo manda el largo de la salida, y el modelo razona
 * antes de escribir. Medido el 2026-09-23 contra el proxy real, un dictado de ~90 s (2.184
 * caracteres) tardó entre 10 y 21 s en UNA sola llamada, y a veces agotaba el presupuesto entero
 * sin devolver nada: el médico esperaba media eternidad o recibía el texto sin puntuar. Los mismos
 * trozos, en paralelo, tardan lo que el más lento (1-3 s).
 *
 * El corte va SIEMPRE en un final de frase (punto, signo de cierre) y solo si el trozo ya tiene
 * tamaño suficiente; si no aparece ninguno, se corta en un espacio. Nunca parte una palabra ni una
 * cifra. Cada trozo se limpia solo, que es justo lo que hace el prompt: puntuar y quitar
 * muletillas, no reescribir la historia entera.
 */
const LARGO_TROZO = 900;
const SIN_PARTIR = 1_300;

export function partirDictado(texto: string): string[] {
  if (texto.length <= SIN_PARTIR) return [texto];

  const trozos: string[] = [];
  let resto = texto;
  while (resto.length > SIN_PARTIR) {
    const ventana = resto.slice(0, LARGO_TROZO + 400);
    let corte = -1;
    for (const marca of [". ", "? ", "! ", "; ", ".\n"]) {
      const i = ventana.lastIndexOf(marca);
      if (i > LARGO_TROZO / 2 && i > corte) corte = i + marca.length - 1;
    }
    if (corte < 0) corte = ventana.lastIndexOf(" ", LARGO_TROZO);
    if (corte < 0) corte = LARGO_TROZO;
    trozos.push(resto.slice(0, corte + 1).trim());
    resto = resto.slice(corte + 1).trim();
  }
  if (resto) trozos.push(resto);
  return trozos;
}

/**
 * Cuánto se le deja "pensar" al modelo antes de escribir. Medido el 2026-09-23 contra el proxy
 * real, y es el compromiso central de este archivo:
 *   · razonamiento BAJO → 1,9 s, pero **27/33** en las frases con autocorrección, y los errores
 *     son graves: dejó "brazo derecho" donde el médico corrigió a izquierdo, y "30 años" donde
 *     dijo "treinta, mentira, treinta y dos". Inaceptable en una historia clínica.
 *   · razonamiento MEDIO → **32-33/33**, y con el techo de salida en 3.000 cuesta apenas 2,2 s
 *     (con el techo en 8.000 el modelo se estiraba hasta 20 s: ver MAX_OUTPUT_TOKENS).
 *
 * Se probó también decidirlo por texto (bajo si no hay señales de corrección), y daba lo mismo en
 * tiempo. Se descartó: manda la calidad, y esa lista de señales es una apuesta sobre cómo habla el
 * médico — basta que diga "corrección" o "más bien" para que el atajo falle justo donde importa.
 */
const ESFUERZO_POR_DEFECTO = "medium";

interface Respuesta {
  ok: boolean;
  code?: ErrorCode;
  status?: number;
  texto?: string;
  tokensIn?: number;
  tokensOut?: number;
}

/** UNA llamada a un proveedor por UN trozo, con su reintento sin esquema si hace falta. */
async function llamar(
  route: Route,
  trozo: string,
  systemPrompt: string,
  limite: number,
  strict: boolean,
  techo: number = MAX_OUTPUT_TOKENS,
): Promise<Respuesta> {
  const payload: Record<string, unknown> = {
    model: route.model,
    temperature: 0,
    max_tokens: techo,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: trozo },
    ],
  };
  if (strict) {
    payload.response_format = {
      type: "json_schema",
      json_schema: { name: "transcription", strict: true, schema: SCHEMA },
    };
  }
  payload.reasoning_effort = route.reasoningEffort ?? ESFUERZO_POR_DEFECTO;
  // Lo que el proveedor necesite además del estándar de OpenAI (OpenRouter: qué servidor usar).
  if (route.extraBody) Object.assign(payload, route.extraBody);

  let res: Response;
  try {
    res = await fetchWithTimeout(
      `${route.baseUrl}/chat/completions`,
      {
        method: "POST",
        headers: { authorization: `Bearer ${route.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
      Math.max(1_000, limite - Date.now()),
    );
  } catch (e) {
    const code: ErrorCode = isAbort(e) ? "timeout" : "provider_error";
    return { ok: false, code, status: code === "timeout" ? 504 : 502 };
  }

  // Un 400 con esquema estricto casi siempre es el proveedor incapaz de cerrar el JSON, no una
  // petición mal armada: se repite sin esquema antes de rendirse.
  if (res.status === 400 && strict) {
    console.warn(`${route.provider} no pudo generar el JSON; reintento sin esquema estricto`);
    return llamar(route, trozo, systemPrompt, limite, false, techo);
  }

  if (!res.ok) {
    const code = classifyProviderError(res.status);
    // El cuerpo del error se queda en los registros: puede traer eco del dictado.
    console.error(`proveedor ${route.provider} devolvió ${res.status}`);
    return { ok: false, code, status: res.status === 429 ? 429 : 502 };
  }

  const body = await res.json().catch(() => null);
  const tokensIn = body?.usage?.prompt_tokens;
  const tokensOut = body?.usage?.completion_tokens;

  // El modelo se quedó sin cupo de salida y lo que llegó está cortado a media frase.
  //
  // ⚠️ No se rescata el texto a medias: esto es una historia clínica. Media nota que PARECE
  // completa es peor que una nota sin puntuar — lo segundo el médico lo ve de inmediato, lo
  // primero puede que no lo vea nunca. Al fallar, la app pega la transcripción cruda ENTERA.
  if (String(body?.choices?.[0]?.finish_reason ?? "") === "length") {
    // Al trozo no le alcanzó el techo (casi siempre porque el modelo razonó de más). Se le da el
    // techo amplio UNA vez: cambiar de proveedor no serviría, todos sirven el mismo modelo.
    if (techo < TECHO_AMPLIO && limite - Date.now() > MINIMO_INTENTO_MS) {
      console.warn(`${route.provider} se quedó corto; se repite el trozo con techo amplio`);
      return llamar(route, trozo, systemPrompt, limite, strict, TECHO_AMPLIO);
    }
    console.error(`${route.provider} truncó la respuesta: el trozo no cabe ni en el techo amplio`);
    return { ok: false, code: "truncated", status: 502, tokensIn, tokensOut };
  }

  const content = String(body?.choices?.[0]?.message?.content ?? "");
  let limpio: string;
  if (strict) {
    try {
      limpio = String(JSON.parse(content).transcription ?? "");
    } catch {
      limpio = "";
    }
  } else {
    // En modo clásico el modelo responde el texto pelado. Algunos igual lo envuelven en JSON, así
    // que se intenta desenvolver y, si no es JSON, se usa tal cual.
    try {
      const parsed = JSON.parse(content);
      limpio = typeof parsed?.transcription === "string" ? parsed.transcription : content;
    } catch {
      limpio = content;
    }
  }

  if (!limpio.trim()) {
    // Vacío CON esquema es el modelo enredado armando el JSON, no el proveedor caído: el mismo
    // proveedor, sin esquema, suele contestar bien, y cuesta segundos en vez de un proveedor.
    if (strict && limite - Date.now() > MINIMO_INTENTO_MS) {
      console.warn(`${route.provider} devolvió vacío con esquema; reintento sin esquema`);
      return llamar(route, trozo, systemPrompt, limite, false, techo);
    }
    return { ok: false, code: "empty_result", status: 502, tokensIn, tokensOut };
  }

  return { ok: true, texto: limpio.trim(), tokensIn, tokensOut };
}

/** Un intento contra UN proveedor: parte el dictado y formatea los trozos en paralelo. */
async function formatearCon(
  route: Route,
  deviceId: string,
  text: string,
  systemPrompt: string,
  limite: number,
): Promise<FormatResult> {
  const trozos = partirDictado(text);
  const started = performance.now();
  const partes = await Promise.all(
    trozos.map((trozo) => llamar(route, trozo, systemPrompt, limite, true)),
  );
  const latencyMs = performance.now() - started;

  const suma = (campo: "tokensIn" | "tokensOut") =>
    partes.reduce((t, p) => t + (p[campo] ?? 0), 0) || undefined;

  // Si UN trozo falla, falla el intento entero: pegar media historia clínica bien puntuada y la
  // otra media cruda sería peor que pegarla toda cruda. El respaldo reintenta el dictado completo.
  const fallo = partes.find((p) => !p.ok);
  if (fallo) {
    logUsage({
      deviceId, kind: "format", provider: route.provider, model: route.model,
      tokensIn: suma("tokensIn"), tokensOut: suma("tokensOut"),
      latencyMs, ok: false, errorCode: fallo.code ?? "provider_error",
    });
    return { ok: false, code: fallo.code ?? "provider_error", status: fallo.status ?? 502 };
  }

  logUsage({
    deviceId, kind: "format", provider: route.provider, model: route.model,
    tokensIn: suma("tokensIn"), tokensOut: suma("tokensOut"),
    latencyMs, ok: true,
  });
  if (trozos.length > 1) {
    console.log(`dictado largo formateado en ${trozos.length} trozos (${Math.round(latencyMs)} ms)`);
  }
  return { ok: true, text: partes.map((p) => p.texto).join(" "), provider: route.provider };
}

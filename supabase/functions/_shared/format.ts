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
 * Techo de tokens de salida.
 *
 * ⚠️ **Esto tumbaba TODOS los dictados de más de ~73 segundos.** Con el techo viejo de 2.000, el
 * modelo se quedaba sin cupo a mitad de la respuesta, devolvía **HTTP 200** con
 * `finish_reason: "length"` y el JSON cortado por la mitad; `JSON.parse` fallaba, el texto salía
 * vacío y se reportaba como `empty_result`. Como es un 200, el reintento sin esquema tampoco
 * saltaba (solo mira el 400), y el respaldo no servía de nada: los tres proveedores sirven el
 * MISMO `gpt-oss-20b` y se truncaban en el mismo punto. El médico recibía texto sin puntuar justo
 * en los dictados largos, que son los que más falta le hacen.
 *
 * El techo se calculó con los dictados reales del 2026-09-22 (regresión sobre 10 medidos):
 *
 *     tokens de salida ≈ 240 + 24,2 × segundos de audio
 *
 * — o sea 2.000 se agotan a los 73 s, y uno de 60 s medido gastó 1.877, el 94% del viejo techo.
 * 8.000 cubre **5,3 minutos** de dictado seguido. No se pone más alto porque el techo también es
 * la red de seguridad contra un modelo que se va en un bucle de razonamiento: pasado ese punto
 * preferimos cortar y pegar el texto crudo COMPLETO. El límite del endpoint de Groq es 65.536,
 * así que 8.000 entra de sobra.
 *
 * Costo: solo se paga lo generado. A $0,30 por millón de tokens de salida, subir el techo no
 * cuesta nada por sí solo — un dictado de 1,5 min sale en $0,0019 contando transcripción.
 */
const MAX_OUTPUT_TOKENS = 8_000;

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
    const limiteIntento =
      Date.now() + (esUltimo ? queda : Math.min(TOPE_INTENTO_MS, queda - MINIMO_INTENTO_MS));

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

/** Un intento contra UN proveedor, con su reintento sin esquema si hace falta. */
async function formatearCon(
  route: Route,
  deviceId: string,
  text: string,
  systemPrompt: string,
  limite: number,
): Promise<FormatResult> {
  /**
   * ⚠️ Los dos modos existen por una razón medida: Groq falla de forma intermitente al cerrar el
   * JSON (`400 Failed to validate JSON`, ~1 de cada 16 según lo medido el 2026-09-19) y tarda
   * 2,3 s en devolver el error. Sin este respaldo, un dictado real se pegó SIN puntuar.
   */
  function buildPayload(strict: boolean): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      model: route.model,
      temperature: 0,
      max_tokens: MAX_OUTPUT_TOKENS,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text },
      ],
    };
    if (strict) {
      payload.response_format = {
        type: "json_schema",
        json_schema: { name: "transcription", strict: true, schema: SCHEMA },
      };
    }
    // Solo si el proveedor lo aprovecha: en DeepInfra 'low' acierta igual y tarda la mitad; en
    // Groq empeora los 400, por eso allá la columna va nula.
    if (route.reasoningEffort) payload.reasoning_effort = route.reasoningEffort;
    // Lo que el proveedor necesite además del estándar de OpenAI (OpenRouter: qué servidor usar).
    if (route.extraBody) Object.assign(payload, route.extraBody);
    return payload;
  }

  const call = (strict: boolean) =>
    fetchWithTimeout(
      `${route.baseUrl}/chat/completions`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${route.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(buildPayload(strict)),
      },
      // El reintento sin esquema comparte el mismo límite: no puede comerse el del respaldo.
      Math.max(1_000, limite - Date.now()),
    );

  const started = performance.now();
  let strict = true;
  let res: Response;
  try {
    res = await call(strict);
    // Un 400 con esquema estricto casi siempre es el proveedor incapaz de cerrar el JSON, no una
    // petición mal armada: se repite sin esquema antes de rendirse.
    if (res.status === 400) {
      console.warn(`${route.provider} no pudo generar el JSON; reintento sin esquema estricto`);
      strict = false;
      res = await call(strict);
    }
  } catch (e) {
    const code: ErrorCode = isAbort(e) ? "timeout" : "provider_error";
    logUsage({
      deviceId, kind: "format", provider: route.provider, model: route.model,
      latencyMs: performance.now() - started, ok: false, errorCode: code,
    });
    return { ok: false, code, status: code === "timeout" ? 504 : 502 };
  }

  if (!res.ok) {
    const code = classifyProviderError(res.status);
    // El cuerpo del error se queda en los registros: puede traer eco del dictado.
    console.error(`proveedor ${route.provider} devolvió ${res.status}`);
    logUsage({
      deviceId, kind: "format", provider: route.provider, model: route.model,
      latencyMs: performance.now() - started, ok: false, errorCode: code,
    });
    return { ok: false, code, status: res.status === 429 ? 429 : 502 };
  }

  const body = await res.json().catch(() => null);

  // El modelo se quedó sin cupo de salida y lo que llegó está cortado a media frase. Se mira
  // ANTES de interpretar nada, porque un JSON truncado no se puede parsear y acabaría contado
  // como `empty_result` — que manda a probar proveedores que van a truncar exactamente igual.
  //
  // ⚠️ No se rescata el texto a medias, ni reintentando sin esquema estricto: esto es una
  // historia clínica. Media nota que PARECE completa es peor que una nota sin puntuar — lo
  // segundo el médico lo ve de inmediato, lo primero puede que no lo vea nunca. Al fallar, la
  // app pega la transcripción cruda ENTERA, que es lo correcto.
  if (String(body?.choices?.[0]?.finish_reason ?? "") === "length") {
    console.error(`${route.provider} truncó la respuesta: el dictado no cabe en max_tokens`);
    logUsage({
      deviceId, kind: "format", provider: route.provider, model: route.model,
      tokensIn: body?.usage?.prompt_tokens, tokensOut: body?.usage?.completion_tokens,
      latencyMs: performance.now() - started, ok: false, errorCode: "truncated",
    });
    return { ok: false, code: "truncated", status: 502 };
  }

  const content = String(body?.choices?.[0]?.message?.content ?? "");
  let cleaned: string;
  if (strict) {
    try {
      cleaned = String(JSON.parse(content).transcription ?? "");
    } catch {
      cleaned = "";
    }
  } else {
    // En modo clásico el modelo responde el texto pelado. Algunos igual lo envuelven en JSON, así
    // que se intenta desenvolver y, si no es JSON, se usa tal cual.
    try {
      const parsed = JSON.parse(content);
      cleaned = typeof parsed?.transcription === "string" ? parsed.transcription : content;
    } catch {
      cleaned = content;
    }
  }

  const latencyMs = performance.now() - started;
  if (!cleaned.trim()) {
    logUsage({
      deviceId, kind: "format", provider: route.provider, model: route.model,
      latencyMs, ok: false, errorCode: "empty_result",
    });
    return { ok: false, code: "empty_result", status: 502 };
  }

  logUsage({
    deviceId, kind: "format", provider: route.provider, model: route.model,
    tokensIn: body?.usage?.prompt_tokens, tokensOut: body?.usage?.completion_tokens,
    latencyMs, ok: true,
  });

  return { ok: true, text: cleaned, provider: route.provider };
}

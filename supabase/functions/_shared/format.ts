// CloseLabs Voice — limpieza del dictado, compartida por `/format` y por `/dictate`.
//
// ⚠️ El texto que pasa por aquí es el dictado de un paciente: no se guarda, no se registra y no
// aparece en ningún mensaje de error. Solo se cuenta cuántos tokens fueron.

import { fetchWithTimeout, isAbort, classifyProviderError } from "./http.ts";
import { resolveRoute } from "./routing.ts";
import { logUsage, type ErrorCode } from "./usage.ts";

/** Normalmente tarda 1-4 s. A los 15 s la app prefiere pegar el texto crudo antes que esperar. */
const TIMEOUT_MS = 15_000;

/** El formateador devuelve el mismo dictado: nunca necesita más que eso. */
const MAX_OUTPUT_TOKENS = 2_000;

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

  let route;
  try {
    route = await resolveRoute("format");
  } catch (e) {
    console.error("ruteo:", (e as Error).message);
    return { ok: false, code: "provider_error", status: 503 };
  }

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
      TIMEOUT_MS,
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

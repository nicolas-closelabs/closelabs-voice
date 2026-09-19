// CloseLabs Voice — proxy del formateador (limpieza del dictado).
//
// La app manda el TEXTO ya transcrito y recibe el texto pulido. La llave del proveedor nunca sale
// de aquí, y a qué proveedor se llama lo decide `app_config`, no el programa instalado.
//
// ⚠️ El texto que pasa por esta función es el dictado de un paciente: no se guarda, no se registra
// y no aparece en ningún mensaje de error. Solo se cuenta cuántos tokens fueron.

import { fail, fetchWithTimeout, isAbort, json, classifyProviderError } from "../_shared/http.ts";
import { authorize, touchDevice } from "../_shared/auth.ts";
import { resolveRoute } from "../_shared/routing.ts";
import { logUsage } from "../_shared/usage.ts";

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

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // Identidad y cupo en UNA consulta: desde el borde hasta São Paulo, cada viaje a la base se
  // siente. Ver la nota en `_shared/auth.ts`.
  const auth = await authorize(req);
  if (!auth.ok) {
    return auth.reason === "quota_exceeded" ? fail("quota_exceeded", 429) : fail("auth", 401);
  }
  const device = { id: auth.device.deviceId };
  touchDevice(device.id);

  let text: string;
  let systemPrompt: string;
  try {
    const body = await req.json();
    text = String(body.text ?? "");
    systemPrompt = String(body.system_prompt ?? "");
  } catch {
    return fail("bad_request", 400);
  }
  if (!text.trim() || !systemPrompt.trim()) return fail("bad_request", 400);

  let route;
  try {
    route = await resolveRoute("format");
  } catch (e) {
    console.error("ruteo:", (e as Error).message);
    return fail("provider_error", 503);
  }

  /**
   * Una petición al proveedor. `strict` decide si se le exige el esquema JSON.
   *
   * ⚠️ Los dos modos existen por una razón medida: Groq falla de forma intermitente al cerrar el
   * JSON (`400 Failed to validate JSON`, ~1 de cada 16 según lo medido el 2026-09-19) y devuelve
   * el error en 2,3 s. La app tenía una ruta clásica de respaldo; al mudar el formateo aquí se
   * perdió, y el efecto fue que un dictado real se pegó SIN puntuar. Ahora el respaldo vive en
   * el servidor, que es donde debe estar.
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

  async function callProvider(strict: boolean): Promise<Response> {
    return await fetchWithTimeout(
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
  }

  const started = performance.now();
  let strict = true;
  let res: Response;
  try {
    res = await callProvider(strict);
    // Un 400 con esquema estricto casi siempre es el proveedor incapaz de cerrar el JSON, no una
    // petición mal armada: se repite sin esquema antes de rendirse y devolver texto crudo.
    if (res.status === 400) {
      console.warn(`${route.provider} no pudo generar el JSON; reintento sin esquema estricto`);
      strict = false;
      res = await callProvider(strict);
    }
  } catch (e) {
    const code = isAbort(e) ? "timeout" : "provider_error";
    logUsage({
      deviceId, kind: "format", provider: route.provider, model: route.model,
      latencyMs: performance.now() - started, ok: false, errorCode: code,
    });
    return fail(code, code === "timeout" ? 504 : 502);
  }

  if (!res.ok) {
    const code = classifyProviderError(res.status);
    // El cuerpo del error se queda en los registros: puede traer eco del dictado.
    console.error(`proveedor ${route.provider} devolvió ${res.status}`);
    logUsage({
      deviceId, kind: "format", provider: route.provider, model: route.model,
      latencyMs: performance.now() - started, ok: false, errorCode: code,
    });
    return fail(code, res.status === 429 ? 429 : 502);
  }

  const body = await res.json();
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
      deviceId: device.id, kind: "format", provider: route.provider, model: route.model,
      latencyMs, ok: false, errorCode: "empty_result",
    });
    return fail("empty_result", 502);
  }

  logUsage({
    deviceId: device.id, kind: "format", provider: route.provider, model: route.model,
    tokensIn: body?.usage?.prompt_tokens, tokensOut: body?.usage?.completion_tokens,
    latencyMs, ok: true,
  });

  return json({ text: cleaned, provider: route.provider, model: route.model });
});

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

  const payload: Record<string, unknown> = {
    model: route.model,
    temperature: 0,
    max_tokens: MAX_OUTPUT_TOKENS,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: text },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "transcription", strict: true, schema: SCHEMA },
    },
  };
  // Solo se manda si el proveedor lo aprovecha: en DeepInfra 'low' acierta igual y tarda la mitad;
  // en Groq empeora los errores 400, por eso allá la columna va nula.
  if (route.reasoningEffort) payload.reasoning_effort = route.reasoningEffort;

  const started = performance.now();
  let res: Response;
  try {
    res = await fetchWithTimeout(
      `${route.baseUrl}/chat/completions`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${route.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      },
      TIMEOUT_MS,
    );
  } catch (e) {
    const code = isAbort(e) ? "timeout" : "provider_error";
    void logUsage({
      deviceId: device.id, kind: "format", provider: route.provider, model: route.model,
      latencyMs: performance.now() - started, ok: false, errorCode: code,
    });
    return fail(code, code === "timeout" ? 504 : 502);
  }

  if (!res.ok) {
    const code = classifyProviderError(res.status);
    // El cuerpo del error se queda en los registros de la función: puede traer eco del dictado.
    console.error(`proveedor ${route.provider} devolvió ${res.status}`);
    void logUsage({
      deviceId: device.id, kind: "format", provider: route.provider, model: route.model,
      latencyMs: performance.now() - started, ok: false, errorCode: code,
    });
    return fail(code, res.status === 429 ? 429 : 502);
  }

  const body = await res.json();
  const content = body?.choices?.[0]?.message?.content ?? "";
  let cleaned = "";
  try {
    cleaned = String(JSON.parse(content).transcription ?? "");
  } catch {
    // Algunos proveedores fallan al cerrar el JSON. No es recuperable aquí: la app tiene su propia
    // guarda y pega el texto crudo, que es mejor que pegar basura.
    cleaned = "";
  }

  const latencyMs = performance.now() - started;
  if (!cleaned.trim()) {
    void logUsage({
      deviceId: device.id, kind: "format", provider: route.provider, model: route.model,
      latencyMs, ok: false, errorCode: "empty_result",
    });
    return fail("empty_result", 502);
  }

  void logUsage({
    deviceId: device.id, kind: "format", provider: route.provider, model: route.model,
    tokensIn: body?.usage?.prompt_tokens, tokensOut: body?.usage?.completion_tokens,
    latencyMs, ok: true,
  });

  return json({ text: cleaned, provider: route.provider, model: route.model });
});

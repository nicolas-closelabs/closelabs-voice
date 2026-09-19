// CloseLabs Voice — proxy de la transcripción.
//
// La app manda el audio ya comprimido (Ogg/Opus) y recibe el texto. Igual que en `format`, la
// llave del proveedor nunca sale de aquí y a quién se llama lo decide `app_config`.
//
// ⚠️ Esto mueve la VOZ de un paciente. No se guarda, no se escribe en ningún registro y no
// aparece en los mensajes de error: solo se anota cuántos segundos duró.

import { fail, fetchWithTimeout, isAbort, json, classifyProviderError } from "../_shared/http.ts";
import { authorize, touchDevice } from "../_shared/auth.ts";
import { resolveRoute } from "../_shared/routing.ts";
import { logUsage } from "../_shared/usage.ts";

/**
 * Tope de tiempo proporcional al audio, con el mismo criterio que el cliente: subir un dictado
 * largo por el internet de una clínica es lento, pero dejar al médico esperando sin límite es
 * peor. El mínimo cubre la latencia de red aunque el audio sea de dos segundos.
 */
function timeoutFor(audioSeconds: number): number {
  return Math.min(20_000 + audioSeconds * 500, 120_000);
}

/** ~5 minutos de Opus a 24 kbps. Más que eso no es un dictado, es otra cosa. */
const MAX_BYTES = 2 * 1024 * 1024;

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const auth = await authorize(req);
  if (!auth.ok) {
    return auth.reason === "quota_exceeded" ? fail("quota_exceeded", 429) : fail("auth", 401);
  }
  const deviceId = auth.device.deviceId;
  touchDevice(deviceId);

  let incoming: FormData;
  try {
    incoming = await req.formData();
  } catch {
    return fail("bad_request", 400);
  }

  const file = incoming.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("bad_request", 400);
  if (file.size > MAX_BYTES) return fail("bad_request", 413);

  const language = String(incoming.get("language") ?? "").trim();
  const prompt = String(incoming.get("prompt") ?? "").trim();
  const audioSeconds = Number(incoming.get("audio_seconds") ?? 0) || 0;

  let route;
  try {
    route = await resolveRoute("transcribe");
  } catch (e) {
    console.error("ruteo:", (e as Error).message);
    return fail("provider_error", 503);
  }

  const form = new FormData();
  form.append("file", file, file.name || "audio.ogg");
  form.append("model", route.model);
  form.append("response_format", "json");
  form.append("temperature", "0");
  if (language) form.append("language", language);
  // ⚠️ La pista de vocabulario SOLO si el proveedor la soporta. Medido el 2026-09-19: el Whisper
  // turbo de DeepInfra devuelve la transcripción VACÍA con una pista de ~150 caracteres, y con
  // pistas medianas la TRUNCA EN SILENCIO — media historia clínica sin que el médico lo note.
  // Quedarse sin la ayuda del diccionario es malo; perder medio dictado es inaceptable.
  const promptSent = Boolean(prompt) && route.supportsTranscribePrompt;
  if (promptSent) form.append("prompt", prompt);

  const started = performance.now();
  let res: Response;
  try {
    res = await fetchWithTimeout(
      `${route.baseUrl}/audio/transcriptions`,
      { method: "POST", headers: { authorization: `Bearer ${route.apiKey}` }, body: form },
      timeoutFor(audioSeconds),
    );
  } catch (e) {
    const code = isAbort(e) ? "timeout" : "provider_error";
    void logUsage({
      deviceId, kind: "transcribe", provider: route.provider, model: route.model,
      audioSeconds, latencyMs: performance.now() - started, ok: false, errorCode: code,
    });
    return fail(code, code === "timeout" ? 504 : 502);
  }

  if (!res.ok) {
    const code = classifyProviderError(res.status);
    console.error(`proveedor ${route.provider} devolvió ${res.status} al transcribir`);
    void logUsage({
      deviceId, kind: "transcribe", provider: route.provider, model: route.model,
      audioSeconds, latencyMs: performance.now() - started, ok: false, errorCode: code,
    });
    return fail(code, res.status === 429 ? 429 : 502);
  }

  const body = await res.json().catch(() => null);
  const text = String(body?.text ?? "").trim();
  const latencyMs = performance.now() - started;

  if (!text) {
    // Puede ser silencio de verdad, o el fallo silencioso de un proveedor que no soporta la
    // pista. Se anota como vacío para poder distinguir los dos casos en la tabla de uso.
    void logUsage({
      deviceId, kind: "transcribe", provider: route.provider, model: route.model,
      audioSeconds, latencyMs, ok: false, errorCode: "empty_result",
    });
    return fail("empty_result", 502);
  }

  void logUsage({
    deviceId, kind: "transcribe", provider: route.provider, model: route.model,
    audioSeconds, latencyMs, ok: true,
  });

  // `prompt_sent` viaja de vuelta a propósito: es un booleano, no lleva nada del dictado, y es la
  // única forma de responder "¿por qué no me funcionó el diccionario?" sin adivinar. También es lo
  // que nos deja COMPROBAR que la protección contra el truncado silencioso está activa.
  return json({ text, provider: route.provider, model: route.model, prompt_sent: promptSent });
});

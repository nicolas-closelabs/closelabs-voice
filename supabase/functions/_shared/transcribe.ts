// CloseLabs Voice — transcripción, compartida por `/transcribe` y por `/dictate`.
//
// ⚠️ Esto mueve la VOZ de un paciente. No se guarda, no se escribe en ningún registro y no
// aparece en los mensajes de error: solo se anota cuántos segundos duró.

import { fetchWithTimeout, isAbort, classifyProviderError } from "./http.ts";
import { resolveRoute } from "./routing.ts";
import { logUsage, type ErrorCode } from "./usage.ts";

/** ~5 minutos de Opus a 24 kbps. Más que eso no es un dictado, es otra cosa. */
const MAX_BYTES = 2 * 1024 * 1024;

/**
 * Tope de tiempo proporcional al audio, con el mismo criterio que el cliente: subir un dictado
 * largo por el internet de una clínica es lento, pero dejar al médico esperando sin límite es
 * peor. El mínimo cubre la latencia de red aunque el audio sea de dos segundos.
 */
function timeoutFor(audioSeconds: number): number {
  return Math.min(20_000 + audioSeconds * 500, 120_000);
}

export type TranscribeResult =
  | { ok: true; text: string; promptSent: boolean; provider: string }
  | { ok: false; code: ErrorCode; status: number };

export async function transcribeAudio(
  deviceId: string,
  incoming: FormData,
): Promise<TranscribeResult> {
  const file = incoming.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, code: "bad_request", status: 400 };
  }
  if (file.size > MAX_BYTES) return { ok: false, code: "bad_request", status: 413 };

  const language = String(incoming.get("language") ?? "").trim();
  const prompt = String(incoming.get("prompt") ?? "").trim();
  const audioSeconds = Number(incoming.get("audio_seconds") ?? 0) || 0;

  let route;
  try {
    route = await resolveRoute("transcribe");
  } catch (e) {
    console.error("ruteo:", (e as Error).message);
    return { ok: false, code: "provider_error", status: 503 };
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
    const code: ErrorCode = isAbort(e) ? "timeout" : "provider_error";
    logUsage({
      deviceId, kind: "transcribe", provider: route.provider, model: route.model,
      audioSeconds, latencyMs: performance.now() - started, ok: false, errorCode: code,
    });
    return { ok: false, code, status: code === "timeout" ? 504 : 502 };
  }

  if (!res.ok) {
    const code = classifyProviderError(res.status);
    console.error(`proveedor ${route.provider} devolvió ${res.status} al transcribir`);
    logUsage({
      deviceId, kind: "transcribe", provider: route.provider, model: route.model,
      audioSeconds, latencyMs: performance.now() - started, ok: false, errorCode: code,
    });
    return { ok: false, code, status: res.status === 429 ? 429 : 502 };
  }

  const body = await res.json().catch(() => null);
  const text = String(body?.text ?? "").trim();
  const latencyMs = performance.now() - started;

  if (!text) {
    // Puede ser silencio de verdad, o el fallo silencioso de un proveedor que no soporta la
    // pista. Se anota como vacío para poder distinguir los dos casos en la tabla de uso.
    logUsage({
      deviceId, kind: "transcribe", provider: route.provider, model: route.model,
      audioSeconds, latencyMs, ok: false, errorCode: "empty_result",
    });
    return { ok: false, code: "empty_result", status: 502 };
  }

  logUsage({
    deviceId, kind: "transcribe", provider: route.provider, model: route.model,
    audioSeconds, latencyMs, ok: true,
  });

  return { ok: true, text, promptSent, provider: route.provider };
}

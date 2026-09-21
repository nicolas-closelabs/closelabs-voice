// CloseLabs Voice — transcripción, compartida por `/transcribe` y por `/dictate`.
//
// ⚠️ Esto mueve la VOZ de un paciente. No se guarda, no se escribe en ningún registro y no
// aparece en los mensajes de error: solo se anota cuántos segundos duró.

import { fetchWithTimeout, isAbort, classifyProviderError } from "./http.ts";
import { resolveRoutes, type Route } from "./routing.ts";
import { logUsage, type ErrorCode } from "./usage.ts";

/** ~5 minutos de Opus a 24 kbps. Más que eso no es un dictado, es otra cosa. */
const MAX_BYTES = 2 * 1024 * 1024;

/**
 * Cuánto tiempo hay en total para transcribir, contando todos los intentos.
 *
 * Es el mismo tope que usa la app (`request_timeout` en proxy.rs: 20 s + medio segundo por
 * segundo de audio, máximo 120 s) menos un margen para la subida y la respuesta. Si el servidor
 * se pasara de esto, la app ya se habría rendido y el trabajo sería en vano.
 */
function presupuestoMs(audioSeconds: number): number {
  return Math.min(20_000 + audioSeconds * 500, 120_000) - 3_000;
}

/**
 * Lo máximo que se le espera a un proveedor que NO es el último de la lista.
 *
 * Medido: un dictado de 38 s se transcribe en 1-3 s en los tres proveedores. Pero DeepInfra se
 * colgó 38 s una de cada ~10 veces bajo ráfaga. Sin este tope, un cuelgue se comería todo el
 * presupuesto y el respaldo no alcanzaría a responder.
 */
function topeIntentoMs(audioSeconds: number): number {
  return 8_000 + audioSeconds * 200;
}

/** Con menos que esto ya no vale la pena empezar otro intento. */
const MINIMO_INTENTO_MS = 3_000;

/**
 * Por debajo de esta duración, una transcripción vacía casi siempre es silencio de verdad y no
 * vale la pena pedírsela a otro proveedor. Por encima, un resultado vacío es sospechoso: la app
 * ya filtró el silencio con el detector de voz, y un proveedor que devuelve nada con varios
 * segundos de habla es exactamente el fallo silencioso que medimos en el turbo de DeepInfra.
 */
const VACIO_SOSPECHOSO_S = 3;

export type TranscribeResult =
  | { ok: true; text: string; promptSent: boolean; provider: string }
  | { ok: false; code: ErrorCode; status: number };

/** Resultado de UN intento, con la decisión de si tiene sentido probar el siguiente. */
type Intento =
  | { ok: true; text: string; promptSent: boolean }
  | { ok: false; code: ErrorCode; status: number; probarOtro: boolean };

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

  let routes: Route[];
  try {
    routes = await resolveRoutes("transcribe");
  } catch (e) {
    console.error("ruteo:", (e as Error).message);
    return { ok: false, code: "provider_error", status: 503 };
  }

  const limite = Date.now() + presupuestoMs(audioSeconds);
  let ultimo: TranscribeResult = { ok: false, code: "provider_error", status: 502 };

  for (let n = 0; n < routes.length; n++) {
    const route = routes[n];
    const esUltimo = n === routes.length - 1;
    const queda = limite - Date.now();
    if (queda < MINIMO_INTENTO_MS) break;
    const tope = esUltimo ? queda : Math.min(topeIntentoMs(audioSeconds), queda - MINIMO_INTENTO_MS);

    const r = await intentar(route, deviceId, file, language, prompt, audioSeconds, tope, esUltimo);
    if (r.ok) {
      if (n > 0) console.warn(`transcripción servida por el respaldo ${route.provider}`);
      return { ok: true, text: r.text, promptSent: r.promptSent, provider: route.provider };
    }
    ultimo = { ok: false, code: r.code, status: r.status };
    if (!r.probarOtro) break;
    console.warn(`${route.provider} falló (${r.code}) al transcribir; se prueba el siguiente`);
  }
  return ultimo;
}

/** Un intento contra UN proveedor. */
async function intentar(
  route: Route,
  deviceId: string,
  file: File,
  language: string,
  prompt: string,
  audioSeconds: number,
  timeoutMs: number,
  esUltimo: boolean,
): Promise<Intento> {
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
      timeoutMs,
    );
  } catch (e) {
    const code: ErrorCode = isAbort(e) ? "timeout" : "provider_error";
    logUsage({
      deviceId, kind: "transcribe", provider: route.provider, model: route.model,
      audioSeconds, latencyMs: performance.now() - started, ok: false, errorCode: code,
    });
    return { ok: false, code, status: code === "timeout" ? 504 : 502, probarOtro: true };
  }

  if (!res.ok) {
    const code = classifyProviderError(res.status);
    console.error(`proveedor ${route.provider} devolvió ${res.status} al transcribir`);
    logUsage({
      deviceId, kind: "transcribe", provider: route.provider, model: route.model,
      audioSeconds, latencyMs: performance.now() - started, ok: false, errorCode: code,
    });
    // ⚠️ `bad_request` NO pasa al siguiente: casi siempre es el FORMATO del audio, y la app tiene
    // su propia cadena de respaldo (Opus → FLAC → WAV) que se activa justo con ese código. Si el
    // servidor lo escondiera probando otros proveedores, la app nunca bajaría de escalón. Todo lo
    // demás (caída, saturación, llave rota) es del proveedor y sí se prueba el siguiente.
    return {
      ok: false, code, status: res.status === 429 ? 429 : 502,
      probarOtro: code !== "bad_request",
    };
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
    return {
      ok: false, code: "empty_result", status: 502,
      probarOtro: !esUltimo && audioSeconds >= VACIO_SOSPECHOSO_S,
    };
  }

  logUsage({
    deviceId, kind: "transcribe", provider: route.provider, model: route.model,
    audioSeconds, latencyMs, ok: true,
  });

  return { ok: true, text, promptSent };
}

// CloseLabs Voice — un dictado completo en una sola llamada.
//
// Transcribe el audio y limpia el texto sin que la app tenga que hablar dos veces con nosotros.
// Medido el 2026-09-19: cada viaje de ida y vuelta al servidor cuesta ~500 ms al médico, y con
// dos llamadas se pagaba dos veces por dictado.
//
// Esto se pudo hacer solo después de decidir que **el diccionario del médico es la última
// palabra**: antes corría en el cliente ENTRE las dos llamadas, así que unirlas era imposible.
// Ahora corre al final, ya con el texto formateado de vuelta.
//
// ⚠️ Aquí pasan la voz y el texto de un paciente. No se guardan, no se registran y no aparecen en
// ningún mensaje de error: solo se anota cuánto duró y cuántos tokens fueron.

import { fail, json } from "../_shared/http.ts";
import { authorize, touchDevice, type DenyReason } from "../_shared/auth.ts";
import { transcribeAudio } from "../_shared/transcribe.ts";
import { formatText } from "../_shared/format.ts";
import { precalentarRuteo } from "../_shared/routing.ts";

/**
 * Mide cuánto tarda una promesa y lo anota en `tiempos` (formato de la cabecera `Server-Timing`).
 * Solo duraciones: nada del dictado.
 */
async function medir<T>(tiempos: string[], nombre: string, p: Promise<T>): Promise<T> {
  const desde = performance.now();
  try {
    return await p;
  } finally {
    tiempos.push(`${nombre};dur=${Math.round(performance.now() - desde)}`);
  }
}

/**
 * Traduce el motivo de la base a una respuesta HTTP.
 *
 * Los estados de cuenta van con **402 Pago requerido**, no con 401: el médico está bien
 * identificado y su token sirve. Lo que falta es la suscripción, y distinguirlo importa — con un
 * 401 la app pensaría que la sesión se rompió y le pediría entrar de nuevo, que no arregla nada.
 */
function denegado(reason: DenyReason): Response {
  switch (reason) {
    case "quota_exceeded":
      return fail("quota_exceeded", 429);
    case "no_account":
      return fail("no_account", 402);
    case "trial_ended":
      return fail("trial_ended", 402);
    case "subscription_missing":
    case "subscription_inactive":
      return fail("subscription_inactive", 402);
    default:
      return fail("auth", 401);
  }
}

Deno.serve(async (req) => {
  // CALENTAMIENTO (desde la 0.9.3): la app manda un GET al empezar a grabar, y lo repite cada 40 s
  // mientras el médico habla. Además de abrir la conexión y despertar la función, deja en la
  // caché de esta instancia lo que el dictado va a necesitar: la configuración de proveedores y,
  // si el GET trae el token, la autorización del equipo. Así, al soltar el atajo, el dictado no
  // tiene que ir a la base antes de empezar a transcribir. No toca ningún proveedor ni gasta cupo.
  if (req.method === "GET") {
    const tiempos: string[] = [];
    const tareas: Promise<unknown>[] = [medir(tiempos, "ruteo", precalentarRuteo()).catch(() => {})];
    if (req.headers.get("authorization")) {
      tareas.push(medir(tiempos, "auth", authorize(req)).catch(() => {}));
    }
    await Promise.all(tareas);
    return new Response(null, { status: 204, headers: { "server-timing": tiempos.join(", ") } });
  }
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // ⚠️ Antes esto iba en fila: verificar la cuenta (una ida a la base en São Paulo), DESPUÉS leer
  // el audio y DESPUÉS, ya dentro de la transcripción, leer la configuración (otra ida). Medido el
  // 2026-10-15 en dictados reales: 1 a 2,4 s antes de que OpenAI recibiera el audio, más que la
  // transcripción misma. Las tres no dependen entre sí, así que van a la vez.
  //
  // Lo que NO se adelanta es la llamada al proveedor: se transcribe solo después de saber que la
  // cuenta puede dictar. Si no, cualquiera con un token inventado nos haría pagar transcripciones.
  const tiempos: string[] = [];
  const inicio = performance.now();
  const [auth, form] = await Promise.all([
    medir(tiempos, "auth", authorize(req)),
    medir<FormData | null>(tiempos, "audio", req.formData().catch(() => null)),
    medir(tiempos, "ruteo", precalentarRuteo()).catch((e) => console.error("ruteo:", (e as Error).message)),
  ]);
  if (!auth.ok) return denegado(auth.reason);
  const deviceId = auth.device.deviceId;
  touchDevice(deviceId);
  if (!form) return fail("bad_request", 400);

  const transcription = await medir(tiempos, "transcribir", transcribeAudio(deviceId, form));
  if (!transcription.ok) return fail(transcription.code, transcription.status);

  // El formateo es OPCIONAL: si falla, el médico recibe igual su transcripción. Pegarla sin
  // puntuar es peor que puntuada, pero infinitamente mejor que perder el dictado.
  const systemPrompt = String(form.get("system_prompt") ?? "");
  let finalText: string | null = null;
  if (systemPrompt.trim()) {
    const formatted = await medir(tiempos, "limpiar", formatText(deviceId, transcription.text, systemPrompt));
    if (formatted.ok) {
      finalText = formatted.text;
    } else {
      console.warn(`formateo omitido (${formatted.code}); se devuelve la transcripción cruda`);
    }
  }

  // Se devuelven LAS DOS: la app aplica sus guardas sobre el texto limpio y, si lo descarta, usa
  // el crudo sin tener que volver a pedir nada.
  tiempos.push(`total;dur=${Math.round(performance.now() - inicio)}`);
  return json({
    text_raw: transcription.text,
    text_final: finalText,
    prompt_sent: transcription.promptSent,
    provider: transcription.provider,
  }, 200, { "server-timing": tiempos.join(", ") });
});

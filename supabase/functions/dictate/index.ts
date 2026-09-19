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
import { authorize, touchDevice } from "../_shared/auth.ts";
import { transcribeAudio } from "../_shared/transcribe.ts";
import { formatText } from "../_shared/format.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const auth = await authorize(req);
  if (!auth.ok) {
    return auth.reason === "quota_exceeded" ? fail("quota_exceeded", 429) : fail("auth", 401);
  }
  const deviceId = auth.device.deviceId;
  touchDevice(deviceId);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail("bad_request", 400);
  }

  const transcription = await transcribeAudio(deviceId, form);
  if (!transcription.ok) return fail(transcription.code, transcription.status);

  // El formateo es OPCIONAL: si falla, el médico recibe igual su transcripción. Pegarla sin
  // puntuar es peor que puntuada, pero infinitamente mejor que perder el dictado.
  const systemPrompt = String(form.get("system_prompt") ?? "");
  let finalText: string | null = null;
  if (systemPrompt.trim()) {
    const formatted = await formatText(deviceId, transcription.text, systemPrompt);
    if (formatted.ok) {
      finalText = formatted.text;
    } else {
      console.warn(`formateo omitido (${formatted.code}); se devuelve la transcripción cruda`);
    }
  }

  // Se devuelven LAS DOS: la app aplica sus guardas sobre el texto limpio y, si lo descarta, usa
  // el crudo sin tener que volver a pedir nada.
  return json({
    text_raw: transcription.text,
    text_final: finalText,
    prompt_sent: transcription.promptSent,
    provider: transcription.provider,
  });
});

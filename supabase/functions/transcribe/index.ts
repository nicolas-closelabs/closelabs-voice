// CloseLabs Voice — transcripción suelta.
//
// La app normal usa `/dictate`, que hace transcripción y limpieza en una sola llamada. Este
// endpoint se conserva porque hay un caso que lo necesita: cuando la nube falla y el dictado se
// resuelve con el Parakeet LOCAL, el texto todavía puede limpiarse en la nube — y entonces las
// dos mitades corren por separado.

import { fail, json } from "../_shared/http.ts";
import { authorize, touchDevice } from "../_shared/auth.ts";
import { transcribeAudio } from "../_shared/transcribe.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const auth = await authorize(req);
  if (!auth.ok) {
    return auth.reason === "quota_exceeded" ? fail("quota_exceeded", 429) : fail("auth", 401);
  }
  touchDevice(auth.device.deviceId);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail("bad_request", 400);
  }

  const result = await transcribeAudio(auth.device.deviceId, form);
  if (!result.ok) return fail(result.code, result.status);

  return json({
    text: result.text,
    provider: result.provider,
    // Booleano, sin nada del dictado: es la única forma de contestar "¿por qué no me funcionó el
    // diccionario?" sin adivinar.
    prompt_sent: result.promptSent,
  });
});

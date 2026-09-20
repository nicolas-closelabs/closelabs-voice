// CloseLabs Voice — transcripción suelta.
//
// La app normal usa `/dictate`, que hace transcripción y limpieza en una sola llamada. Este
// endpoint se conserva porque hay un caso que lo necesita: cuando la nube falla y el dictado se
// resuelve con el Parakeet LOCAL, el texto todavía puede limpiarse en la nube — y entonces las
// dos mitades corren por separado.

import { fail, json } from "../_shared/http.ts";
import { authorize, touchDevice, type DenyReason } from "../_shared/auth.ts";
import { transcribeAudio } from "../_shared/transcribe.ts";

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
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const auth = await authorize(req);
  if (!auth.ok) return denegado(auth.reason);
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

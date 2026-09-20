// CloseLabs Voice — limpieza suelta.
//
// La app normal usa `/dictate`. Este endpoint cubre el caso en que la transcripción vino del
// Parakeet LOCAL (porque la nube falló o no había internet al dictar) y el texto todavía puede
// limpiarse en la nube.

import { fail, json } from "../_shared/http.ts";
import { authorize, touchDevice, type DenyReason } from "../_shared/auth.ts";
import { formatText } from "../_shared/format.ts";

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

  let text: string;
  let systemPrompt: string;
  try {
    const body = await req.json();
    text = String(body.text ?? "");
    systemPrompt = String(body.system_prompt ?? "");
  } catch {
    return fail("bad_request", 400);
  }

  const result = await formatText(auth.device.deviceId, text, systemPrompt);
  if (!result.ok) return fail(result.code, result.status);

  return json({ text: result.text, provider: result.provider });
});

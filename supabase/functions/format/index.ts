// CloseLabs Voice — limpieza suelta.
//
// La app normal usa `/dictate`. Este endpoint cubre el caso en que la transcripción vino del
// Parakeet LOCAL (porque la nube falló o no había internet al dictar) y el texto todavía puede
// limpiarse en la nube.

import { fail, json } from "../_shared/http.ts";
import { authorize, touchDevice } from "../_shared/auth.ts";
import { formatText } from "../_shared/format.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const auth = await authorize(req);
  if (!auth.ok) {
    return auth.reason === "quota_exceeded" ? fail("quota_exceeded", 429) : fail("auth", 401);
  }
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

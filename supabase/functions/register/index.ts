// CloseLabs Voice — alta de una instalación.
//
// La app llama aquí UNA vez, la primera que arranca, y guarda el token que recibe. Desde entonces
// ese token la identifica ante el proxy. No pide datos del médico: en la Fase 1 todavía no hay
// cuentas, y aunque las haya, esta función seguirá sin saber quién dicta.

import { json } from "../_shared/http.ts";
import { hashToken, newToken } from "../_shared/auth.ts";
import { serviceClient } from "../_shared/db.ts";
import { loadAppConfig } from "../_shared/routing.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let platform: string | null = null;
  let appVersion: string | null = null;
  try {
    const body = await req.json();
    // Se recortan por si acaso: son texto libre que llega de fuera y va a parar a la base.
    platform = typeof body.platform === "string" ? body.platform.slice(0, 32) : null;
    appVersion = typeof body.app_version === "string" ? body.app_version.slice(0, 32) : null;
  } catch {
    // Cuerpo vacío o inválido: se registra igual, solo perdemos la etiqueta.
  }

  const token = newToken();
  const db = serviceClient();
  const { data, error } = await db
    .from("devices")
    .insert({ token_hash: await hashToken(token), platform, app_version: appVersion })
    .select("id")
    .single();

  if (error || !data) {
    console.error("no se pudo registrar el dispositivo:", error?.message);
    return json({ error: "register_failed" }, 500);
  }

  // Se devuelve también la configuración para que el primer arranque no necesite otra llamada.
  const config = await loadAppConfig().catch(() => null);

  // ⚠️ El token en claro se ve UNA sola vez, aquí. La base solo guarda su hash, así que si la app
  // lo pierde, no hay forma de recuperarlo: hay que registrarse de nuevo. Es a propósito.
  return json({ device_id: data.id, token, config });
});

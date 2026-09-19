// CloseLabs Voice — recibe un reporte de problema.
//
// Deja una fila en `problem_reports` con lo que el médico escribió y el final de su log. El log
// ya viene limpio de la app (`problem_report.rs`); aquí no se reinterpreta ni se reenvía a
// ningún lado.
//
// El log va en la misma fila y no en Storage. La razón está medida y escrita en la migración
// 20260919000008: Storage no acepta la llave que el runtime inyecta, y meterlo en la tabla quitó
// de encima el bucket, la lista de tipos MIME y la posibilidad de que la fila se escriba y el
// archivo no.
//
// ⚠️ Autorización deliberadamente BLANDA: basta con que el token exista. No se rechaza a un
// dispositivo revocado ni a uno que agotó su cupo del día — son justo los que más motivo tienen
// para escribirnos, y negarles el reporte nos dejaría sin saber por qué se quejan.

import { json, fail } from "../_shared/http.ts";
import { hashToken } from "../_shared/auth.ts";
import { insert, rpc } from "../_shared/db.ts";

/** Freno contra un cuerpo absurdo. La app manda 256 KB como mucho. */
const MAX_LOG_BYTES = 2 * 1024 * 1024;
/** Lo que el médico escribe. Más que esto no es una descripción. */
const MAX_DESCRIPTION = 4_000;

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return fail("auth", 401);

  let body: {
    description?: unknown;
    platform?: unknown;
    app_version?: unknown;
    log?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return fail("bad_request", 400);
  }

  const description = typeof body.description === "string"
    ? body.description.slice(0, MAX_DESCRIPTION)
    : null;
  const platform = typeof body.platform === "string" ? body.platform.slice(0, 32) : null;
  const appVersion = typeof body.app_version === "string" ? body.app_version.slice(0, 32) : null;
  const log = typeof body.log === "string" ? body.log : "";

  if (log.length > MAX_LOG_BYTES) return fail("bad_request", 413);

  // Se resuelve el dispositivo, pero su ausencia no tumba el reporte: un token que ya no está en
  // la base sigue mereciendo que escuchemos el problema.
  let deviceId: string | null = null;
  try {
    const row = await rpc<{ device_id: string }>("device_by_hash", {
      p_token_hash: await hashToken(token),
    });
    deviceId = row?.device_id ?? null;
  } catch (e) {
    console.error("no se pudo resolver el dispositivo:", (e as Error).message);
  }

  let created: { id: string } | null = null;
  try {
    created = await insert<{ id: string }>(
      "problem_reports",
      {
        device_id: deviceId,
        platform,
        app_version: appVersion,
        description,
        log: log || null,
      },
      "id",
    );
  } catch (e) {
    console.error("no se pudo registrar el reporte:", (e as Error).message);
  }
  if (!created) return fail("provider_error", 500);

  // El identificador se le muestra al médico: es lo que va a decirnos por WhatsApp para que
  // encontremos su reporte sin pedirle nada más.
  return json({ report_id: created.id });
});

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

import { json, fail, fetchWithTimeout } from "../_shared/http.ts";
import { hashToken } from "../_shared/auth.ts";
import { insert, rpc, select } from "../_shared/db.ts";

/** Freno contra un cuerpo absurdo. La app manda 256 KB como mucho. */
const MAX_LOG_BYTES = 2 * 1024 * 1024;
/** Lo que el médico escribe. Más que esto no es una descripción. */
const MAX_DESCRIPTION = 4_000;
/** El médico espera la respuesta del reporte: el correo no puede demorarla más que esto. */
const CORREO_TIMEOUT_MS = 8_000;

interface Contexto {
  email: string | null;
  full_name: string | null;
  label: string | null;
  interno: boolean | null;
}

function escapar(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * Avisa por correo de cada reporte. Hasta el 2026-10-28 los reportes caían en la tabla y nadie
 * se enteraba (ver la migración 20261028000001).
 *
 * El log NO va en el correo: se baja con la consulta que trae el cuerpo. Sí va lo que escribió el
 * médico, porque sin eso el aviso no dice nada; la app le advierte que no ponga datos de pacientes.
 *
 * Nunca tumba el reporte: si el correo falla, la fila ya está guardada y se anota en los registros.
 */
async function avisar(
  reportId: string,
  deviceId: string | null,
  platform: string | null,
  appVersion: string | null,
  description: string | null,
  logChars: number,
): Promise<void> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    console.error(`reporte ${reportId} sin aviso: falta RESEND_API_KEY`);
    return;
  }

  let ctx: Contexto | null = null;
  if (deviceId) {
    try {
      ctx = await rpc<Contexto>("reporte_contexto", { p_device_id: deviceId });
    } catch (e) {
      console.error("no se pudo leer de quién es el reporte:", (e as Error).message);
    }
  }
  let cfg: { send_to: string; send_from: string } | undefined;
  try {
    cfg = (await select<{ send_to: string; send_from: string }>(
      "alert_config",
      "select=send_to,send_from&limit=1",
    ))[0];
  } catch (e) {
    console.error("no se pudo leer alert_config:", (e as Error).message);
  }
  if (!cfg) return;

  const quien = ctx?.email ?? "cuenta desconocida";
  const hora = new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" });
  const fila = (k: string, v: string) =>
    `<tr><td style="padding:6px 12px;color:#6f677e;white-space:nowrap">${k}</td>` +
    `<td style="padding:6px 12px">${v}</td></tr>`;

  const html = `<div style="max-width:640px;margin:0 auto;font-family:system-ui,sans-serif;color:#1a1620">
      <p style="font-size:15px;line-height:1.6;margin:0 0 8px">Lo que escribió:</p>
      <blockquote style="margin:0 0 20px;padding:12px 16px;background:#f5edff;border-radius:8px;font-size:15px;line-height:1.6;white-space:pre-wrap">${
    escapar(description?.trim() || "(sin descripción)")
  }</blockquote>
      <table style="border-collapse:collapse;font-size:14px;line-height:1.5">
        ${fila("Cuenta", escapar(quien) + (ctx?.full_name ? ` — ${escapar(ctx.full_name)}` : ""))}
        ${fila("Equipo", escapar(ctx?.label ?? "—") + (ctx?.interno ? " (interno)" : ""))}
        ${fila("Sistema", `${escapar(platform ?? "—")} · versión ${escapar(appVersion ?? "—")}`)}
        ${fila("Hora", `${escapar(hora)} (Colombia)`)}
        ${fila("Log", logChars > 0 ? `${Math.round(logChars / 1024)} KB` : "no vino")}
      </table>
      <p style="font-size:13px;color:#6f677e;line-height:1.6;margin-top:24px">
        Para bajar el log:<br>
        <code>select log from problem_reports where id = '${reportId}';</code>
      </p>
    </div>`;

  try {
    const res = await fetchWithTimeout("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: cfg.send_from,
        to: [cfg.send_to],
        subject: `📩 Reporte de CL Voice — ${quien}`,
        html,
      }),
    }, CORREO_TIMEOUT_MS);
    if (!res.ok) {
      console.error(`reporte ${reportId}: resend devolvió ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
  } catch (e) {
    console.error(`reporte ${reportId}: no se pudo enviar el aviso:`, (e as Error).message);
  }
}

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

  await avisar(created.id, deviceId, platform, appVersion, description, log.length);

  // El identificador se le muestra al médico: es lo que va a decirnos por WhatsApp para que
  // encontremos su reporte sin pedirle nada más.
  return json({ report_id: created.id });
});

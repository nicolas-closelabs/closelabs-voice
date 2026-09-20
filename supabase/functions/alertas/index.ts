// CloseLabs Voice — manda por correo lo que la base decidió que merece un aviso.
//
// Esta función NO decide nada. La decisión entera vive en `alertas_pendientes()` (migración
// 20260920000002), y eso es a propósito: ajustar un umbral debe ser un `update`, no un
// despliegue, y se debe poder probar con un `select` sin mandarle correo a nadie.
//
// La llama pg_cron cada 15 minutos. Si no hay nada que avisar, termina sin hacer ruido.
//
// ⚠️ Aquí no pasa ni audio ni texto dictado: los avisos se construyen a partir de contadores.

import { json } from "../_shared/http.ts";
import { rpcRows, select, insert } from "../_shared/db.ts";

/** Si Resend tarda más que esto, el problema del que íbamos a avisar seguirá ahí en 15 minutos. */
const TIMEOUT_MS = 15_000;

interface Alerta {
  kind: string;
  gravedad: string;
  detalle: string;
}

interface Config {
  send_to: string;
  send_from: string;
}

function cuerpo(alertas: Alerta[]): string {
  const filas = alertas
    .map(
      (a) =>
        `<tr>
           <td style="padding:12px 16px;border-bottom:1px solid #eee;vertical-align:top">
             <strong style="font-family:system-ui,sans-serif">${a.gravedad.toUpperCase()}</strong>
           </td>
           <td style="padding:12px 16px;border-bottom:1px solid #eee;font-family:system-ui,sans-serif;line-height:1.5">
             ${a.detalle}
           </td>
         </tr>`,
    )
    .join("");

  return `<div style="max-width:640px;margin:0 auto;font-family:system-ui,sans-serif;color:#1a1620">
      <p style="font-size:15px;line-height:1.6">
        El proxy de CloseLabs Voice está reportando problemas. Cada línea trae ya la acción
        concreta que la resuelve.
      </p>
      <table style="width:100%;border-collapse:collapse;border:1px solid #eee;border-radius:8px">
        ${filas}
      </table>
      <p style="font-size:13px;color:#6f677e;line-height:1.6;margin-top:24px">
        Para mirar el detalle:<br>
        <code>select * from salud_ultima_hora;</code><br>
        <code>select * from errores_recientes;</code>
      </p>
      <p style="font-size:13px;color:#9a94a6;line-height:1.6">
        No se repetirá este aviso durante unas horas aunque el problema siga. Para callarlo del
        todo: <code>update alert_config set enabled = false;</code>
      </p>
    </div>`;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // Secreto propio, no una llave de Supabase. Dos razones: la pasarela rechaza sus propias
  // llaves de servicio en la cabecera `authorization` antes de que la petición llegue aquí, y
  // además esto es menos privilegio — un secreto que solo sirve para disparar el aviso, y que se
  // puede rotar sin tocar nada más.
  const esperado = Deno.env.get("ALERT_CRON_SECRET") ?? "";
  const recibido = req.headers.get("x-alert-secret") ?? "";
  if (!esperado || recibido !== esperado) {
    return json({ error: "auth" }, 401);
  }

  let alertas: Alerta[] = [];
  try {
    // `rpcRows`, no `rpc`: esta función devuelve un CONJUNTO. Con `rpc` se detectaban dos
    // problemas y solo se avisaba del primero — visto en la primera prueba real.
    alertas = await rpcRows<Alerta>("alertas_pendientes", {});
  } catch (e) {
    console.error("no se pudo evaluar las alertas:", (e as Error).message);
    return json({ error: "provider_error" }, 500);
  }

  if (alertas.length === 0) return json({ enviadas: 0 });

  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    // Se avisa en los registros y se sale sin escribir en `alert_log`: así, el día que aparezca
    // la llave, el primer correo sale de inmediato en vez de quedar silenciado por un aviso que
    // nunca llegó a nadie.
    console.error(
      `falta RESEND_API_KEY; ${alertas.length} alerta(s) sin enviar: ${alertas.map((a) => a.kind).join(", ")}`,
    );
    return json({ error: "sin_configurar", pendientes: alertas.length }, 503);
  }

  let cfg: Config | undefined;
  try {
    cfg = (await select<Config>("alert_config", "select=send_to,send_from&limit=1"))[0];
  } catch (e) {
    console.error("no se pudo leer alert_config:", (e as Error).message);
  }
  if (!cfg) return json({ error: "provider_error" }, 500);

  const criticas = alertas.filter((a) => a.gravedad === "crítico").length;
  const asunto = criticas > 0
    ? `🔴 CloseLabs Voice — ${criticas} problema(s) crítico(s)`
    : `⚠️ CloseLabs Voice — ${alertas.length} aviso(s) del proveedor`;

  const control = new AbortController();
  const timer = setTimeout(() => control.abort(), TIMEOUT_MS);
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: cfg.send_from,
        to: [cfg.send_to],
        subject: asunto,
        html: cuerpo(alertas),
      }),
      signal: control.signal,
    });

    if (!res.ok) {
      console.error(`resend devolvió ${res.status}: ${(await res.text()).slice(0, 300)}`);
      return json({ error: "envio_fallido" }, 502);
    }
  } catch (e) {
    console.error("no se pudo enviar el correo:", (e as Error).message);
    return json({ error: "envio_fallido" }, 502);
  } finally {
    clearTimeout(timer);
  }

  // Solo DESPUÉS de que el correo salió. Si se anotara antes, un fallo de envío dejaría el
  // problema silenciado durante horas sin que nadie se hubiera enterado.
  for (const a of alertas) {
    try {
      await insert("alert_log", { kind: a.kind, detalle: a.detalle });
    } catch (e) {
      console.error("no se pudo anotar la alerta:", (e as Error).message);
    }
  }

  return json({ enviadas: alertas.length });
});

// CloseLabs Voice — manda los correos de fin de la prueba. NO decide nada: la lista la arma
// `recordatorios_pendientes()` en la base (migración 20261007000005), y se puede revisar con un
// `select` sin mandarle correo a nadie.
//
// La llama pg_cron una vez al día (9:00 en Bogotá) con el secreto de las alertas en `x-alert-secret`
// (mismo esquema que la función `alertas`). Para dispararla a mano, la llave de servicio en
// `x-service-key`. Responde qué mandó: { enviados, fallidos }.
//
// Cada correo se marca DESPUÉS de salir: si Resend falla, mañana se vuelve a intentar.

import { json } from "../_shared/http.ts";
import { rpc, rpcRows } from "../_shared/db.ts";
import { fetchWithTimeout } from "../_shared/http.ts";
import { correoRecordatorio, type TipoRecordatorio } from "../_shared/recordatorios.ts";

interface Pendiente {
  user_id: string;
  email: string;
  full_name: string | null;
  tipo: TipoRecordatorio;
  trial_ends_at: string;
  dictados: number;
  minutos: number;
}

/**
 * ¿Es una llave de servicio del proyecto? Se prueba contra la base leyendo `app_config`, que solo
 * la llave de servicio puede leer. No se compara el texto: Supabase tiene dos formatos de llave
 * (el JWT de siempre y `sb_secret_…`) y la del entorno de la función puede ser la otra.
 */
async function esLlaveDeServicio(llave: string): Promise<boolean> {
  if (!llave) return false;
  const res = await fetchWithTimeout(
    `${Deno.env.get("SUPABASE_URL")}/rest/v1/app_config?select=id&limit=1`,
    { headers: { apikey: llave, authorization: `Bearer ${llave}` } },
    10_000,
  ).catch(() => null);
  if (!res?.ok) return false;
  const filas = await res.json().catch(() => []);
  return Array.isArray(filas) && filas.length > 0;
}

Deno.serve(async (req) => {
  const secretoCron = Deno.env.get("ALERT_CRON_SECRET") ?? "";
  const autorizado =
    (secretoCron && req.headers.get("x-alert-secret") === secretoCron) ||
    (await esLlaveDeServicio(req.headers.get("x-service-key") ?? ""));
  if (!autorizado) return json({ error: "unauthorized" }, 401);

  const resend = Deno.env.get("RESEND_API_KEY");
  if (!resend) {
    console.error("recordatorios sin enviar: falta RESEND_API_KEY");
    return json({ error: "config" }, 503);
  }

  let pendientes: Pendiente[];
  try {
    pendientes = await rpcRows<Pendiente>("recordatorios_pendientes", {});
  } catch (e) {
    console.error("no se pudo leer recordatorios_pendientes:", (e as Error).message);
    return json({ error: "provider_error" }, 500);
  }

  let enviados = 0;
  let fallidos = 0;
  for (const m of pendientes) {
    const { asunto, html } = correoRecordatorio(m.tipo, {
      nombre: m.full_name,
      fin: m.trial_ends_at,
      dictados: Number(m.dictados),
      minutos: Number(m.minutos),
    });
    try {
      const res = await fetchWithTimeout("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${resend}`, "content-type": "application/json" },
        body: JSON.stringify({
          from: "CloseLabs Voice <cuenta@closelabs.co>",
          to: [m.email],
          reply_to: "contacto@closelabs.co",
          subject: asunto,
          html,
        }),
      }, 15_000);
      if (!res.ok) throw new Error(`resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
      await rpc("recordatorio_enviado", { p_user_id: m.user_id, p_tipo: m.tipo });
      enviados++;
    } catch (e) {
      fallidos++;
      console.error(`recordatorio '${m.tipo}' sin enviar:`, (e as Error).message);
    }
  }

  if (pendientes.length) console.log(`recordatorios: ${enviados} enviados, ${fallidos} fallidos`);
  return json({ enviados, fallidos });
});

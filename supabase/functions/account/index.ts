// CloseLabs Voice — todo lo que la app necesita saber de la cuenta del médico.
//
// En una sola función: ver el estado, vincular este equipo, soltar otro y, desde 2026-10-06, el
// cobro (abrir el pago o el portal de Stripe, reanudar, poner al día). Van juntas porque la app
// las usa en el mismo momento —"Mi cuenta"— y separarlas costaría varios arranques en frío. La
// lógica del cobro vive en `_shared/cobro.ts`.
//
// ⚠️ Esta función SÍ se autentica con la sesión del médico (`verify_jwt = true`), a diferencia
// del dictado, que usa el token del dispositivo. Aquí es correcto: son operaciones de cuenta,
// ocurren una vez y toleran que el token haya que renovarlo. El dictado no lo toleraría — ver la
// nota larga en la migración 20260920000003.

import { json, fail } from "../_shared/http.ts";
import { hashToken } from "../_shared/auth.ts";
import { rpc, rpcRows, select } from "../_shared/db.ts";
import {
  abrirPago,
  abrirPortal,
  ErrorStripe,
  NoAplica,
  reanudar,
  sincronizarCuenta,
} from "../_shared/cobro.ts";

interface Perfil {
  full_name: string;
  phone_country: string;
  phone: string;
}

interface Suscripcion {
  status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}

interface Equipo {
  id: string;
  label: string | null;
  platform: string | null;
  app_version: string | null;
  last_seen_at: string | null;
  linked_at: string | null;
}

/**
 * Saca el id del médico del JWT.
 *
 * Se lee sin verificar la firma A PROPÓSITO: la pasarela de Supabase ya validó el token antes de
 * que la petición llegara aquí (`verify_jwt = true` en config.toml). Volver a verificarlo
 * obligaría a traerse una librería de criptografía y a manejar la rotación de llaves, para
 * repetir un trabajo ya hecho. ⚠️ Esto SOLO vale mientras esa bandera siga en true.
 */
function claimsDelJwt(req: Request): { id: string; email: string | null } | null {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const partes = token.split(".");
  if (partes.length !== 3) return null;
  try {
    const relleno = "=".repeat((4 - (partes[1].length % 4)) % 4);
    const payload = JSON.parse(atob(partes[1].replace(/-/g, "+").replace(/_/g, "/") + relleno));
    if (typeof payload?.sub !== "string") return null;
    return { id: payload.sub, email: typeof payload.email === "string" ? payload.email : null };
  } catch {
    return null;
  }
}

async function estado(userId: string): Promise<Response> {
  const [perfiles, subs, equipos] = await Promise.all([
    select<Perfil>("user_profiles", `select=full_name,phone_country,phone&id=eq.${userId}`),
    select<Suscripcion>(
      "subscriptions",
      `select=status,trial_ends_at,current_period_end,cancel_at_period_end,stripe_customer_id,stripe_subscription_id&user_id=eq.${userId}`,
    ),
    select<Equipo>(
      "devices",
      `select=id,label,platform,app_version,last_seen_at,linked_at&user_id=eq.${userId}&revoked=eq.false&order=linked_at.asc`,
    ),
  ]);

  const cfg = await select<{ max_devices: number }>("app_config", "select=max_devices&limit=1");

  // Los ids de Stripe no salen hacia la app: solo si ya pagó alguna vez (para mostrar "Administrar
  // pago" en vez de "Suscribirme").
  const sub = subs[0];
  return json({
    profile: perfiles[0] ?? null,
    subscription: sub
      ? {
        status: sub.status,
        trial_ends_at: sub.trial_ends_at,
        current_period_end: sub.current_period_end,
        cancel_at_period_end: sub.cancel_at_period_end,
        has_billing: Boolean(sub.stripe_subscription_id),
      }
      : null,
    devices: equipos,
    max_devices: cfg[0]?.max_devices ?? 3,
  });
}

Deno.serve(async (req) => {
  const claims = claimsDelJwt(req);
  if (!claims) return fail("auth", 401);
  const userId = claims.id;

  if (req.method === "GET") {
    try {
      return await estado(userId);
    } catch (e) {
      console.error("no se pudo leer la cuenta:", (e as Error).message);
      return fail("provider_error", 500);
    }
  }

  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: { action?: unknown; device_token?: unknown; device_id?: unknown; label?: unknown };
  try {
    body = await req.json();
  } catch {
    return fail("bad_request", 400);
  }

  if (body.action === "link") {
    if (typeof body.device_token !== "string" || !body.device_token) {
      return fail("bad_request", 400);
    }
    const label = typeof body.label === "string" ? body.label.slice(0, 64) : null;
    try {
      const r = await rpc<{ ok: boolean; motivo: string; usados: number; tope: number }>(
        "link_device",
        {
          p_token_hash: await hashToken(body.device_token),
          p_user_id: userId,
          p_label: label,
        },
      );
      if (!r) return fail("provider_error", 500);
      // 409 y no 400: "llegaste al tope de equipos" no es una petición mal armada, es un
      // conflicto con el estado de la cuenta que el médico puede resolver soltando otro.
      return json(r, r.ok ? 200 : 409);
    } catch (e) {
      console.error("no se pudo vincular:", (e as Error).message);
      return fail("provider_error", 500);
    }
  }

  if (body.action === "unlink") {
    if (typeof body.device_id !== "string") return fail("bad_request", 400);
    try {
      // La función de la base comprueba que el equipo sea de QUIEN pide soltarlo: sin eso,
      // cualquiera con una sesión podría desconectar el computador de otro médico.
      const filas = await rpcRows<{ unlink_device: boolean }>("unlink_device", {
        p_device_id: body.device_id,
        p_user_id: userId,
      });
      const ok = filas.length > 0;
      return json({ ok }, ok ? 200 : 404);
    } catch (e) {
      console.error("no se pudo soltar el equipo:", (e as Error).message);
      return fail("provider_error", 500);
    }
  }

  // ---- Cobro ----
  // checkout / portal → { url } para abrir en el navegador. resume / sync → el estado al día.
  if (body.action === "checkout" || body.action === "portal" || body.action === "resume" || body.action === "sync") {
    try {
      if (body.action === "checkout") return json({ url: await abrirPago(userId, claims.email) });
      if (body.action === "portal") return json({ url: await abrirPortal(userId) });
      if (body.action === "resume") await reanudar(userId);
      else await sincronizarCuenta(userId);
      return await estado(userId);
    } catch (e) {
      // 409: no es un error, es algo que la cuenta no permite ("sin_pago", "vencida"); la app
      // muestra el botón que corresponde.
      if (e instanceof NoAplica) return json({ error: e.codigo }, 409);
      console.error(`cobro (${body.action}) falló:`, (e as Error).message);
      // Sin llaves de Stripe todavía (o mal puestas): 503, para distinguirlo de una caída.
      if (e instanceof ErrorStripe && (e.status === 0 || e.status === 401 || e.status === 403)) {
        return fail("auth", 503);
      }
      return fail("provider_error", 502);
    }
  }

  return fail("bad_request", 400);
});

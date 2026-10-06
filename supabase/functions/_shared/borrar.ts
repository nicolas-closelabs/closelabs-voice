// CloseLabs Voice — "Eliminar mi cuenta" (Ley 1581: el médico puede pedir que borremos sus datos).
//
// Decidido con Nicolás (2026-10-05): separado de cancelar y que se note la diferencia ("Zona
// peligrosa" en Mi cuenta, con doble confirmación). Borra perfil, equipos, suscripción e historial
// de uso; el diccionario vive en el computador y lo borra la app.
//
// ⚠️ EL ORDEN IMPORTA. Primero Stripe, después la cuenta:
// - Borrar el cliente en Stripe cancela su suscripción EN EL ACTO (sin reembolso de lo no usado,
//   como dicen los términos). Si eso falla, NO se borra nada: lo peor que puede pasar es una cuenta
//   borrada a la que se le sigue cobrando, sin forma de entrar a cancelar.
// - Si Stripe sale bien y la cuenta falla, el médico puede volver a intentarlo: ya no se le cobra.
// Stripe conserva las facturas ya emitidas (obligación contable); el cliente desaparece.
//
// Al borrar el usuario de Supabase, la base borra en cascada `user_profiles`, `subscriptions`,
// `devices` y, por los equipos, `usage_events`. `stripe_eventos` queda sin dueño (`set null`).

import { fetchWithTimeout } from "./http.ts";
import { select } from "./db.ts";
import { ErrorStripe, stripe } from "./cobro.ts";

export async function eliminarCuenta(userId: string): Promise<void> {
  const fila = (await select<{ stripe_customer_id: string | null }>(
    "subscriptions",
    `select=stripe_customer_id&user_id=eq.${userId}`,
  ))[0];

  if (fila?.stripe_customer_id) {
    try {
      await stripe("DELETE", `/customers/${encodeURIComponent(fila.stripe_customer_id)}`);
    } catch (e) {
      // Ya no existía en Stripe (borrado a mano, por ejemplo): no hay nada que cobrar.
      if (!(e instanceof ErrorStripe && e.status === 404)) throw e;
    }
  }

  const base = Deno.env.get("SUPABASE_URL") ?? "";
  const llave = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const res = await fetchWithTimeout(`${base}/auth/v1/admin/users/${userId}`, {
    method: "DELETE",
    headers: { apikey: llave, authorization: `Bearer ${llave}` },
  }, 15_000);
  if (!res.ok && res.status !== 404) {
    throw new Error(`no se pudo borrar el usuario: auth ${res.status}`);
  }
}

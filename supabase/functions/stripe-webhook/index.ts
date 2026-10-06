// CloseLabs Voice — avisos de Stripe.
//
// Stripe llama aquí cada vez que cambia algo del cobro de un médico. La función NO confía en lo que
// trae el aviso: comprueba la firma, saca de qué suscripción se trata y le pregunta a Stripe cómo
// está AHORA (`sincronizar` en `_shared/cobro.ts`; el porqué está en su encabezado).
//
// ⚠️ `verify_jwt = false` en config.toml: Stripe no tiene sesión de Supabase. La autenticación es la
// firma `stripe-signature`, y sin firma válida no se toca nada.
//
// Respuestas: 200 = recibido (Stripe no reintenta). 400 = firma mala (tampoco tiene sentido
// reintentar). 500 = algo nuestro falló: Stripe reintenta solo durante tres días, y como la
// sincronización es idempotente, reintentar nunca hace daño.
//
// Eventos que hay que activar en el endpoint de Stripe (guía completa en STRIPE.md):
//   checkout.session.completed, customer.subscription.created, customer.subscription.updated,
//   customer.subscription.deleted, invoice.paid, invoice.payment_failed

import { json } from "../_shared/http.ts";
import { insertDetached } from "../_shared/db.ts";
import {
  enviarCorreoCancelacion,
  firmaValida,
  sincronizar,
  suscripcionDeFactura,
} from "../_shared/cobro.ts";

// deno-lint-ignore no-explicit-any
function suscripcionDelEvento(evento: any): string | null {
  const o = evento?.data?.object;
  switch (evento?.type) {
    case "checkout.session.completed":
      return typeof o?.subscription === "string" ? o.subscription : o?.subscription?.id ?? null;
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return o?.id ?? null;
    case "invoice.paid":
    case "invoice.payment_failed":
      return suscripcionDeFactura(o);
    default:
      return null;
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const secreto = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!secreto) {
    console.error("falta el secreto STRIPE_WEBHOOK_SECRET");
    return json({ error: "config" }, 500);
  }

  const cuerpo = await req.text();
  if (!(await firmaValida(cuerpo, req.headers.get("stripe-signature"), secreto, Date.now()))) {
    return json({ error: "firma" }, 400);
  }

  // deno-lint-ignore no-explicit-any
  let evento: any;
  try {
    evento = JSON.parse(cuerpo);
  } catch {
    return json({ error: "cuerpo" }, 400);
  }

  const subId = suscripcionDelEvento(evento);
  if (!subId) return json({ ok: true, ignorado: evento?.type ?? null });

  try {
    const r = await sincronizar(subId);
    if (r.cancelacion && r.userId) {
      try {
        await enviarCorreoCancelacion(r.cancelacion.customerId, r.userId, r.cancelacion.hasta);
      } catch (e) {
        console.error("no se pudo mandar el correo de cancelación:", (e as Error).message);
      }
    }
    // Bitácora para soporte ("pagué y no se activa"): qué llegó, de quién y qué se hizo.
    insertDetached("stripe_eventos", {
      evento_id: evento.id,
      tipo: evento.type,
      user_id: r.userId,
      resultado: r.resultado,
    });
    if (r.resultado === "sin_dueno") console.error(`suscripción ${subId} sin médico asociado`);
    return json({ ok: true, resultado: r.resultado });
  } catch (e) {
    console.error(`no se pudo sincronizar ${subId} (${evento.type}):`, (e as Error).message);
    insertDetached("stripe_eventos", {
      evento_id: evento.id,
      tipo: evento.type,
      user_id: null,
      resultado: "error",
    });
    return json({ error: "sincronizar" }, 500);
  }
});

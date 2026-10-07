// CloseLabs Voice — el cobro con Stripe.
//
// Lo que se decidió con Nicolás (ROADMAP, Fase 2) y que este archivo aplica:
// - La prueba de 30 días arranca SIN tarjeta. La tarjeta se pone al final, desde "Mi cuenta", en
//   las páginas de Stripe (Checkout y portal), en el navegador. La tarjeta nunca pasa por la app ni
//   por nuestro servidor.
// - Quien pone la tarjeta antes de que termine la prueba NO pierde días: el primer cobro llega el
//   día que la prueba iba a terminar (ver `inicioDelCobro`).
// - Cancelar es al final del período, desde el portal de Stripe, y se puede reanudar hasta esa
//   fecha. Al cancelar mandamos un correo nuestro (Stripe no lo manda).
//
// ⚠️ Sin la librería de Stripe, a propósito, por la misma razón que `db.ts` no usa supabase-js:
// cada arranque en frío tendría que evaluar un módulo grande para usar cinco llamadas.
//
// ⚠️ LA REGLA QUE HACE CONFIABLE EL WEBHOOK: nunca se escribe lo que dice el aviso; se le pregunta
// a Stripe cómo está la suscripción AHORA y se escribe eso (`sincronizar`). Los avisos llegan
// repetidos, tarde y en desorden; con esta regla da igual: el último en procesarse siempre escribe
// el estado real.
//
// Los textos de error de Stripe se registran: hablan de tarjetas y suscripciones, nunca de
// dictados, y no traen el número de la tarjeta.

import { fetchWithTimeout } from "./http.ts";
import { select, update } from "./db.ts";

const API = "https://api.stripe.com/v1";
const TIMEOUT_MS = 15_000;

/** Stripe exige que el primer cobro de una prueba quede al menos 48 h en el futuro. */
const MINIMO_PRUEBA_MS = 48 * 3600_000 + 10 * 60_000; // +10 min de margen para el reloj

export const PAGINAS = {
  pagoListo: "https://www.closelabs.co/voice/pago-listo",
  pagoCancelado: "https://www.closelabs.co/voice/pago-cancelado",
  cuentaActualizada: "https://www.closelabs.co/voice/cuenta-actualizada",
};

/** Estados con los que el médico sigue suscrito (pagando, en prueba o con el cobro en reintento). */
export const VIVOS = new Set(["trialing", "active", "past_due"]);
/** Estados de una suscripción que ya no va a volver. */
const MUERTOS = new Set(["canceled", "incomplete_expired"]);

export class ErrorStripe extends Error {
  constructor(public status: number, detalle: string) {
    super(`stripe ${status}: ${detalle}`);
  }
}

// ---------------------------------------------------------------------------------------------
// Llamadas a la API
// ---------------------------------------------------------------------------------------------

/** Stripe recibe formularios con corchetes: `line_items[0][price]=...`. */
export function formulario(
  params: Record<string, unknown>,
  prefijo = "",
  out = new URLSearchParams(),
): URLSearchParams {
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    const clave = prefijo ? `${prefijo}[${k}]` : k;
    if (Array.isArray(v)) {
      v.forEach((x, i) => {
        if (typeof x === "object" && x !== null) formulario(x as Record<string, unknown>, `${clave}[${i}]`, out);
        else out.append(`${clave}[${i}]`, String(x));
      });
    } else if (typeof v === "object") {
      formulario(v as Record<string, unknown>, clave, out);
    } else {
      out.append(clave, String(v));
    }
  }
  return out;
}

export async function stripe<T>(
  metodo: "GET" | "POST" | "DELETE",
  ruta: string,
  params: Record<string, unknown> = {},
  idempotencia?: string,
): Promise<T> {
  const llave = Deno.env.get("STRIPE_SECRET_KEY");
  if (!llave) throw new ErrorStripe(0, "falta el secreto STRIPE_SECRET_KEY");
  const cuerpo = formulario(params).toString();
  const res = await fetchWithTimeout(
    metodo === "GET" && cuerpo ? `${API}${ruta}?${cuerpo}` : `${API}${ruta}`,
    {
      method: metodo,
      headers: {
        authorization: `Bearer ${llave}`,
        "content-type": "application/x-www-form-urlencoded",
        ...(idempotencia ? { "idempotency-key": idempotencia } : {}),
      },
      body: metodo === "POST" ? cuerpo : undefined,
    },
    TIMEOUT_MS,
  );
  if (!res.ok) throw new ErrorStripe(res.status, (await res.text()).slice(0, 300));
  return (await res.json()) as T;
}

// ---------------------------------------------------------------------------------------------
// Firma del webhook
// ---------------------------------------------------------------------------------------------

const texto = new TextEncoder();

function hex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Comparación en tiempo constante: que la respuesta no delate cuántos caracteres acertó. */
function iguales(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/**
 * ¿El aviso lo mandó Stripe? Sin esto, cualquiera que conozca la URL del webhook podría regalarse
 * una suscripción. Esquema de Stripe: cabecera `t=<unix>,v1=<hmac>`; el HMAC-SHA256 es de
 * `"<t>.<cuerpo>"` con el secreto `whsec_...` ENTERO como llave. Se rechazan avisos de más de 5
 * minutos para que uno interceptado no se pueda reenviar después.
 */
export async function firmaValida(
  cuerpo: string,
  cabecera: string | null,
  secreto: string,
  ahoraMs: number,
  toleranciaS = 300,
): Promise<boolean> {
  if (!cabecera) return false;
  const partes = cabecera.split(",").map((p) => p.trim());
  const t = partes.find((p) => p.startsWith("t="))?.slice(2);
  const firmas = partes.filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!t || !/^\d+$/.test(t) || firmas.length === 0) return false;
  if (Math.abs(ahoraMs / 1000 - Number(t)) > toleranciaS) return false;
  const llave = await crypto.subtle.importKey(
    "raw",
    texto.encode(secreto),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const esperada = hex(await crypto.subtle.sign("HMAC", llave, texto.encode(`${t}.${cuerpo}`)));
  return firmas.some((f) => iguales(f, esperada));
}

// ---------------------------------------------------------------------------------------------
// Traducción Stripe → nuestra tabla
// ---------------------------------------------------------------------------------------------

// deno-lint-ignore no-explicit-any
type Obj = any;

const iso = (unix: number | null | undefined) =>
  typeof unix === "number" && unix > 0 ? new Date(unix * 1000).toISOString() : null;

export interface EstadoCobro {
  status: string;
  trial_ends_at?: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  stripe_customer_id: string;
  stripe_subscription_id: string;
}

/**
 * Lo que guardamos de una suscripción de Stripe.
 *
 * ⚠️ Stripe movió `current_period_end` de la suscripción a cada ítem (versión 2025-03-31 de su
 * API). Una cuenta nueva viene con la versión nueva; se leen las dos formas para no depender de eso.
 */
export function estadoDesdeStripe(sub: Obj): EstadoCobro {
  const finesItems: number[] = (sub.items?.data ?? [])
    .map((i: Obj) => i?.current_period_end)
    .filter((n: unknown) => typeof n === "number");
  let fin: number | null = sub.current_period_end ?? (finesItems.length ? Math.max(...finesItems) : null);
  // Cancelada DE INMEDIATO (no al final del período): el derecho a dictar termina cuando terminó la
  // suscripción, no cuando iba a terminar el mes. `authorize_device_v2` deja dictar mientras la
  // fecha siga viva, así que sin esto un reembolso por retracto seguiría dictando gratis.
  if (sub.status === "canceled" && typeof sub.ended_at === "number" && fin !== null) {
    fin = Math.min(fin, sub.ended_at);
  }
  const estado: EstadoCobro = {
    status: sub.status,
    current_period_end: iso(fin),
    // El portal puede cancelar con cualquiera de las dos marcas, según cómo esté configurado.
    cancel_at_period_end: Boolean(sub.cancel_at_period_end) || typeof sub.cancel_at === "number",
    stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer?.id,
    stripe_subscription_id: sub.id,
  };
  // Solo si Stripe trae una: nunca borrar la fecha de nuestra prueba sin tarjeta.
  if (typeof sub.trial_end === "number") estado.trial_ends_at = iso(sub.trial_end)!;
  return estado;
}

/** Hasta cuándo dicta quien canceló: lo que llegue primero entre `cancel_at` y el fin del período. */
export function dictaHasta(sub: Obj): string | null {
  const fin = estadoDesdeStripe(sub).current_period_end;
  const corte = iso(sub.cancel_at);
  if (corte && fin) return corte < fin ? corte : fin;
  return corte ?? fin;
}

/**
 * Cuándo debe llegar el primer cobro (unix) o `null` si se cobra ya.
 *
 * Quien pone la tarjeta el día 20 de su prueba paga el día 30: los días que le quedan son suyos.
 * Si le quedan menos de 48 h, Stripe no acepta esa fecha; en vez de recortarle la prueba, se le
 * corre el primer cobro a 48 h. Son, como mucho, dos días de regalo.
 */
export function inicioDelCobro(pruebaHasta: string | null, ahoraMs: number): number | null {
  const fin = pruebaHasta ? Date.parse(pruebaHasta) : NaN;
  if (!Number.isFinite(fin) || fin <= ahoraMs) return null;
  return Math.floor(Math.max(fin, ahoraMs + MINIMO_PRUEBA_MS) / 1000);
}

/** La suscripción de una factura. Stripe también la cambió de lugar en 2025. */
export function suscripcionDeFactura(factura: Obj): string | null {
  const s = factura?.subscription ?? factura?.parent?.subscription_details?.subscription;
  if (!s) return null;
  return typeof s === "string" ? s : s.id ?? null;
}

// ---------------------------------------------------------------------------------------------
// Sincronizar
// ---------------------------------------------------------------------------------------------

interface Fila {
  user_id: string;
  status: string;
  cancel_at_period_end: boolean;
  stripe_subscription_id: string | null;
  canal: string;
}

export interface Sincronizado {
  userId: string | null;
  /** `ignorada`: un aviso de una suscripción vieja y muerta que no debe pisar la actual, o de un
   *  médico que hoy es de un socio (su acceso lo maneja el interruptor, no Stripe). */
  resultado: "escrita" | "ignorada" | "sin_dueno";
  /** Lleno solo cuando el médico ACABA de cancelar: hay que mandarle el correo. */
  cancelacion?: { customerId: string; hasta: string | null };
}

/** Le pregunta a Stripe cómo está la suscripción y lo escribe en `subscriptions`. */
export async function sincronizar(subId: string): Promise<Sincronizado> {
  const sub = await stripe<Obj>("GET", `/subscriptions/${encodeURIComponent(subId)}`);
  const nuevo = estadoDesdeStripe(sub);

  let userId: string | null = typeof sub.metadata?.user_id === "string" ? sub.metadata.user_id : null;
  if (!userId) {
    const filas = await select<{ user_id: string }>(
      "subscriptions",
      `select=user_id&stripe_customer_id=eq.${encodeURIComponent(nuevo.stripe_customer_id)}`,
    );
    userId = filas[0]?.user_id ?? null;
  }
  if (!userId) return { userId: null, resultado: "sin_dueno" };

  const antes = (await select<Fila>(
    "subscriptions",
    `select=user_id,status,cancel_at_period_end,stripe_subscription_id,canal&user_id=eq.${userId}`,
  ))[0];
  if (!antes) return { userId, resultado: "sin_dueno" };

  // Médico de un socio (gMedic): quién dicta lo decide el interruptor que manejamos a mano
  // (`socio_autorizar` / `socio_pausar`). Un aviso de una suscripción directa que tuvo antes no
  // puede pisarlo.
  if (antes.canal && antes.canal !== "directo") return { userId, resultado: "ignorada" };

  // Un médico que canceló y volvió a suscribirse tiene dos suscripciones en Stripe. Un aviso tardío
  // de la vieja (ya muerta) no puede pisar la nueva y dejarlo sin dictar.
  if (
    antes.stripe_subscription_id &&
    antes.stripe_subscription_id !== sub.id &&
    MUERTOS.has(nuevo.status)
  ) {
    return { userId, resultado: "ignorada" };
  }

  const cambios = { ...nuevo, updated_at: new Date().toISOString() };

  // Correo de cancelación: solo en la TRANSICIÓN a "cancelada al final del período", y una sola vez.
  //
  // ⚠️ La transición la decide la BASE, no este código. Al cancelar, Stripe manda dos avisos casi
  // juntos (la cancelación y el motivo); se procesaban en paralelo, los dos leían `antes` sin la
  // marca y se mandaban DOS correos (pasó en la primera prueba, 2026-10-06). Ahora se escribe con
  // la condición "si todavía no estaba cancelada esta suscripción": Postgres pone en fila al
  // segundo y, cuando le toca, la condición ya no se cumple y no actualiza nada. Solo quien
  // logró el cambio manda el correo.
  if (nuevo.cancel_at_period_end && VIVOS.has(nuevo.status)) {
    const sinMarca = `or=(cancel_at_period_end.eq.false,stripe_subscription_id.is.null,` +
      `stripe_subscription_id.neq.${encodeURIComponent(sub.id)})`;
    const gano = await update("subscriptions", `user_id=eq.${userId}&${sinMarca}`, cambios);
    if (gano > 0) {
      return {
        userId,
        resultado: "escrita",
        cancelacion: { customerId: nuevo.stripe_customer_id, hasta: dictaHasta(sub) },
      };
    }
  }

  await update("subscriptions", `user_id=eq.${userId}`, cambios);
  return { userId, resultado: "escrita" };
}

// ---------------------------------------------------------------------------------------------
// Correo de cancelación
// ---------------------------------------------------------------------------------------------

const escapar = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

/** "30 de octubre de 2026". Hora de Bogotá: es la de casi todos los médicos de hoy. */
export function fechaLarga(isoFecha: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Bogota",
  }).format(new Date(isoFecha));
}

export function correoCancelacion(nombre: string | null, hasta: string | null) {
  const saludo = nombre ? `Hola, ${escapar(nombre.split(" ")[0])}:` : "Hola:";
  const fecha = hasta ? fechaLarga(hasta) : null;
  const p = (t: string) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.6">${t}</p>`;
  const html = `<div style="max-width:560px;margin:0 auto;padding:24px;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#1a1620">
    ${p(saludo)}
    ${p("Recibimos la cancelación de tu suscripción a CloseLabs Voice. <strong>No se te hará ningún cobro más.</strong>")}
    ${fecha ? p(`Puedes seguir dictando con normalidad hasta el <strong>${fecha}</strong>.`) : ""}
    ${p(`Si cambias de opinión${fecha ? " antes de esa fecha" : ""}, abre CloseLabs Voice, entra a <strong>Mi cuenta</strong> y toca <strong>Reanudar suscripción</strong>. Todo sigue igual.`)}
    ${p("Tu cuenta, tu diccionario y tus equipos se conservan: puedes volver cuando quieras.")}
    <p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#6f677e">¿Algo no salió bien? Escríbenos por <a href="https://wa.me/573102991182" style="color:#8b2ff3">WhatsApp</a> o responde este correo.<br>— El equipo de CloseLabs</p>
  </div>`;
  return { asunto: "Cancelaste tu suscripción a CloseLabs Voice", html };
}

/** Manda el correo con Resend. Un fallo se registra y NO tumba el webhook: el cambio ya se guardó. */
export async function enviarCorreoCancelacion(
  customerId: string,
  userId: string,
  hasta: string | null,
): Promise<void> {
  const resend = Deno.env.get("RESEND_API_KEY");
  if (!resend) {
    console.error("correo de cancelación sin enviar: falta RESEND_API_KEY");
    return;
  }
  const cliente = await stripe<{ email: string | null }>("GET", `/customers/${encodeURIComponent(customerId)}`);
  if (!cliente.email) {
    console.error("correo de cancelación sin enviar: el cliente de Stripe no tiene correo");
    return;
  }
  const perfil = (await select<{ full_name: string }>("user_profiles", `select=full_name&id=eq.${userId}`))[0];
  const { asunto, html } = correoCancelacion(perfil?.full_name ?? null, hasta);
  const res = await fetchWithTimeout("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${resend}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: "CloseLabs Voice <cuenta@closelabs.co>",
      to: [cliente.email],
      reply_to: "contacto@closelabs.co",
      subject: asunto,
      html,
    }),
  }, TIMEOUT_MS);
  if (!res.ok) console.error(`resend devolvió ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

// ---------------------------------------------------------------------------------------------
// Lo que pide "Mi cuenta" (función `account`)
// ---------------------------------------------------------------------------------------------

/** El médico pidió algo que su cuenta no permite (p. ej. el portal sin haber pagado nunca). */
export class NoAplica extends Error {
  constructor(public codigo: "sin_pago" | "vencida" | "canal_socio") {
    super(codigo);
  }
}

/** Con una suscripción en estos estados no se abre un pago nuevo: se arregla en el portal. */
const SE_ARREGLA_EN_EL_PORTAL = new Set([...VIVOS, "unpaid", "paused", "incomplete"]);

interface FilaCobro {
  status: string;
  trial_ends_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  canal: string;
}

async function filaCobro(userId: string): Promise<FilaCobro> {
  const fila = (await select<FilaCobro>(
    "subscriptions",
    `select=status,trial_ends_at,stripe_customer_id,stripe_subscription_id,canal&user_id=eq.${userId}`,
  ))[0];
  // La crea el disparador de registro; si falta, algo está roto y es mejor que se note.
  if (!fila) throw new Error(`el médico ${userId} no tiene fila en subscriptions`);
  // Médico de un socio: le cobra el socio. Ni pago, ni portal, ni reanudar con nosotros: un
  // botón mal puesto le cobraría dos veces.
  if (fila.canal && fila.canal !== "directo") throw new NoAplica("canal_socio");
  return fila;
}

/**
 * La página de pago de Stripe para suscribirse. Si ya está suscrito, el portal: un segundo
 * Checkout crearía una segunda suscripción y le cobraría dos veces.
 */
export async function abrirPago(userId: string, email: string | null): Promise<string> {
  const precio = Deno.env.get("STRIPE_PRICE_ID");
  if (!precio) throw new ErrorStripe(0, "falta el secreto STRIPE_PRICE_ID");
  const fila = await filaCobro(userId);
  if (fila.stripe_subscription_id && SE_ARREGLA_EN_EL_PORTAL.has(fila.status)) {
    return abrirPortal(userId);
  }

  let cliente = fila.stripe_customer_id;
  if (!cliente) {
    const perfil = (await select<{ full_name: string }>("user_profiles", `select=full_name&id=eq.${userId}`))[0];
    // La llave de idempotencia evita dos clientes si el médico toca el botón dos veces seguidas.
    const c = await stripe<{ id: string }>("POST", "/customers", {
      email: email ?? undefined,
      name: perfil?.full_name,
      metadata: { user_id: userId },
      preferred_locales: ["es-419"],
    }, `cliente-${userId}`);
    cliente = c.id;
    await update("subscriptions", `user_id=eq.${userId}`, { stripe_customer_id: cliente });
  }

  const primerCobro = inicioDelCobro(fila.trial_ends_at, Date.now());
  const sesion = await stripe<{ url: string }>("POST", "/checkout/sessions", {
    mode: "subscription",
    customer: cliente,
    client_reference_id: userId,
    line_items: [{ price: precio, quantity: 1 }],
    subscription_data: {
      metadata: { user_id: userId },
      trial_end: primerCobro ?? undefined,
    },
    // La página de "listo" dice cuándo llega el primer cobro si no es hoy.
    success_url: primerCobro ? `${PAGINAS.pagoListo}?primer_cobro=${primerCobro}` : PAGINAS.pagoListo,
    cancel_url: PAGINAS.pagoCancelado,
    locale: "es-419",
  });
  return sesion.url;
}

/** El portal de Stripe: cambiar la tarjeta, ver facturas, cancelar. */
export async function abrirPortal(userId: string): Promise<string> {
  const fila = await filaCobro(userId);
  if (!fila.stripe_customer_id) throw new NoAplica("sin_pago");
  const sesion = await stripe<{ url: string }>("POST", "/billing_portal/sessions", {
    customer: fila.stripe_customer_id,
    return_url: PAGINAS.cuentaActualizada,
    locale: "es-419",
  });
  return sesion.url;
}

/** "Reanudar suscripción": deshace la cancelación mientras el período siga vivo. */
export async function reanudar(userId: string): Promise<void> {
  const fila = await filaCobro(userId);
  if (!fila.stripe_subscription_id) throw new NoAplica("sin_pago");
  const sub = await stripe<Obj>("GET", `/subscriptions/${encodeURIComponent(fila.stripe_subscription_id)}`);
  if (!VIVOS.has(sub.status)) throw new NoAplica("vencida");
  // Se deshace con la misma marca con la que se canceló. `cancel_at=` vacío la borra.
  const cambio = typeof sub.cancel_at === "number" && !sub.cancel_at_period_end
    ? { cancel_at: "" }
    : { cancel_at_period_end: false };
  await stripe("POST", `/subscriptions/${encodeURIComponent(sub.id)}`, cambio);
  await sincronizar(sub.id);
}

/**
 * Pone al día la suscripción sin esperar al webhook. La app lo pide cuando el médico vuelve del
 * navegador: el webhook suele llegar en segundos, pero si se demora el médico vería "sin
 * suscripción" justo después de pagar.
 */
export async function sincronizarCuenta(userId: string): Promise<void> {
  const fila = await filaCobro(userId);
  if (!fila.stripe_customer_id) return;
  const lista = await stripe<{ data: Obj[] }>("GET", "/subscriptions", {
    customer: fila.stripe_customer_id,
    status: "all",
    limit: 5,
  });
  // Stripe las devuelve de la más nueva a la más vieja: la primera viva, o si no la más nueva.
  const sub = lista.data.find((s) => VIVOS.has(s.status)) ?? lista.data[0];
  if (sub) await sincronizar(sub.id);
}

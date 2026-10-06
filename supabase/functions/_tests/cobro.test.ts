// CloseLabs Voice — pruebas del cobro con Stripe (`_shared/cobro.ts`).
//
// Corre la lógica REAL contra un `fetch` falso que hace de Stripe y de la base. Correrla antes de
// desplegar cualquier cambio a `cobro.ts`, `account` o `stripe-webhook`:
//
//   bun supabase/functions/_tests/cobro.test.ts
//
// Lo que más importa que no se rompa: que nadie pague dos veces, que nadie pierda días de prueba,
// que un aviso viejo no deje sin dictar a quien sí pagó, y que la firma del webhook no se pueda
// falsificar.

const FN = decodeURIComponent(new URL("../_shared", import.meta.url).pathname);

const env: Record<string, string> = {
  SUPABASE_URL: "https://db.test",
  SUPABASE_SERVICE_ROLE_KEY: "x",
  STRIPE_SECRET_KEY: "rk_test_x",
  STRIPE_PRICE_ID: "price_11usd",
  RESEND_API_KEY: "re_x",
};
(globalThis as any).Deno = { env: { get: (k: string) => env[k] } };

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });

// ---- Estado del mundo falso ----
const USER = "11111111-1111-1111-1111-111111111111";
let fila: Record<string, any>;
let subsStripe: Record<string, any>;
let llamadas: { metodo: string; url: string; cuerpo: string }[];
let correos: any[];

function reiniciar() {
  fila = {
    user_id: USER,
    status: "trialing",
    trial_ends_at: null,
    current_period_end: null,
    cancel_at_period_end: false,
    stripe_customer_id: null,
    stripe_subscription_id: null,
  };
  subsStripe = {};
  llamadas = [];
  correos = [];
}

(globalThis as any).fetch = async (url: string, init: RequestInit = {}) => {
  const metodo = init.method ?? "GET";
  const cuerpo = typeof init.body === "string" ? init.body : "";
  llamadas.push({ metodo, url, cuerpo });
  const u = new URL(url);

  if (u.host === "db.test") {
    const tabla = u.pathname.replace("/rest/v1/", "");
    if (tabla === "subscriptions" && metodo === "GET") {
      const porCliente = u.searchParams.get("stripe_customer_id");
      if (porCliente) return json(fila.stripe_customer_id === porCliente.replace("eq.", "") ? [fila] : []);
      return json([fila]);
    }
    if (tabla === "subscriptions" && metodo === "PATCH") {
      Object.assign(fila, JSON.parse(cuerpo));
      return json([fila]);
    }
    if (tabla === "user_profiles") return json([{ full_name: "Ana María Pérez" }]);
    return json([]);
  }

  if (u.host === "api.stripe.com") {
    const p = new URLSearchParams(cuerpo);
    if (u.pathname === "/v1/customers" && metodo === "POST") return json({ id: "cus_1" });
    if (u.pathname.startsWith("/v1/customers/")) return json({ id: "cus_1", email: "ana@clinica.test" });
    if (u.pathname === "/v1/checkout/sessions") return json({ url: "https://checkout.stripe.test/s" });
    if (u.pathname === "/v1/billing_portal/sessions") return json({ url: "https://portal.stripe.test/p" });
    if (u.pathname === "/v1/subscriptions" && metodo === "GET") {
      return json({ data: Object.values(subsStripe).reverse() });
    }
    const m = u.pathname.match(/^\/v1\/subscriptions\/(.+)$/);
    if (m) {
      const sub = subsStripe[decodeURIComponent(m[1])];
      if (!sub) return json({ error: { message: "No such subscription" } }, 404);
      if (metodo === "POST") {
        if (p.has("cancel_at_period_end")) sub.cancel_at_period_end = p.get("cancel_at_period_end") === "true";
        if (p.has("cancel_at")) sub.cancel_at = p.get("cancel_at") === "" ? null : Number(p.get("cancel_at"));
      }
      return json(sub);
    }
  }

  if (u.host === "api.resend.com") {
    correos.push(JSON.parse(cuerpo));
    return json({ id: "email_1" });
  }
  throw new Error(`fetch inesperado: ${metodo} ${url}`);
};

const cobro = await import(`${FN}/cobro.ts`);

// ---- Mini marco de pruebas ----
let fallos = 0;
let pasan = 0;
function ok(cond: unknown, nombre: string, detalle?: unknown) {
  if (cond) pasan++;
  else {
    fallos++;
    console.log(`✗ ${nombre}`, detalle ?? "");
  }
}
async function prueba(nombre: string, fn: () => Promise<void> | void) {
  reiniciar();
  try {
    await fn();
  } catch (e) {
    fallos++;
    console.log(`✗ ${nombre}: lanzó ${(e as Error).message}`);
  }
}

const DIA = 86_400_000;
const AHORA = Date.now();
const unix = (ms: number) => Math.floor(ms / 1000);

/** Una suscripción de Stripe con la forma NUEVA (fin de período en los ítems). */
function sub(id: string, extra: Record<string, any> = {}) {
  const s = {
    id,
    status: "active",
    customer: "cus_1",
    metadata: { user_id: USER },
    cancel_at_period_end: false,
    cancel_at: null,
    trial_end: null,
    ended_at: null,
    items: { data: [{ current_period_end: unix(AHORA + 20 * DIA) }] },
    ...extra,
  };
  subsStripe[id] = s;
  return s;
}

// =============================================================================================
// Firma del webhook
// =============================================================================================
async function firmar(cuerpo: string, secreto: string, t: number) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secreto), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const f = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(`${t}.${cuerpo}`));
  return [...new Uint8Array(f)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

await prueba("firma", async () => {
  const secreto = "whsec_prueba";
  const cuerpo = '{"id":"evt_1","type":"invoice.paid"}';
  const t = unix(AHORA);
  const v1 = await firmar(cuerpo, secreto, t);
  ok(await cobro.firmaValida(cuerpo, `t=${t},v1=${v1}`, secreto, AHORA), "firma buena se acepta");
  ok(await cobro.firmaValida(cuerpo, `t=${t},v1=deadbeef,v1=${v1}`, secreto, AHORA), "acepta si UNA de varias v1 coincide (rotación del secreto)");
  ok(!(await cobro.firmaValida(cuerpo + " ", `t=${t},v1=${v1}`, secreto, AHORA)), "cuerpo alterado se rechaza");
  ok(!(await cobro.firmaValida(cuerpo, `t=${t},v1=${v1}`, "whsec_otro", AHORA)), "otro secreto se rechaza");
  ok(!(await cobro.firmaValida(cuerpo, `t=${t},v1=${v1}`, secreto, AHORA + 10 * 60_000)), "aviso de hace 10 min se rechaza (reenvío)");
  ok(!(await cobro.firmaValida(cuerpo, null, secreto, AHORA)), "sin cabecera se rechaza");
  ok(!(await cobro.firmaValida(cuerpo, `v1=${v1}`, secreto, AHORA)), "sin t= se rechaza");
});

// =============================================================================================
// Traducción de Stripe a nuestra tabla
// =============================================================================================
await prueba("estado: forma vieja y nueva de la API", () => {
  const fin = unix(AHORA + 10 * DIA);
  const vieja = cobro.estadoDesdeStripe({ id: "sub_v", status: "active", customer: "cus_1", current_period_end: fin });
  const nueva = cobro.estadoDesdeStripe({ id: "sub_n", status: "active", customer: { id: "cus_1" }, items: { data: [{ current_period_end: fin }] } });
  ok(vieja.current_period_end === new Date(fin * 1000).toISOString(), "fin de período (forma vieja)", vieja);
  ok(nueva.current_period_end === new Date(fin * 1000).toISOString(), "fin de período (forma nueva, en ítems)", nueva);
  ok(nueva.stripe_customer_id === "cus_1", "cliente expandido como objeto");
  ok(!("trial_ends_at" in nueva), "sin trial_end de Stripe NO se borra nuestra prueba");
});

await prueba("estado: cancelada de inmediato corta en ended_at, no al fin del mes", () => {
  const e = cobro.estadoDesdeStripe({
    id: "s", status: "canceled", customer: "cus_1", ended_at: unix(AHORA - DIA),
    items: { data: [{ current_period_end: unix(AHORA + 25 * DIA) }] },
  });
  ok(Date.parse(e.current_period_end!) < AHORA, "un reembolso por retracto no sigue dictando gratis", e);
});

await prueba("estado: cancelación por cancel_at también cuenta", () => {
  const e = cobro.estadoDesdeStripe({ id: "s", status: "active", customer: "cus_1", cancel_at: unix(AHORA + 5 * DIA), items: { data: [] } });
  ok(e.cancel_at_period_end === true, "cancel_at marca la cancelación");
});

await prueba("factura: suscripción en los dos lugares", () => {
  ok(cobro.suscripcionDeFactura({ subscription: "sub_1" }) === "sub_1", "forma vieja");
  ok(cobro.suscripcionDeFactura({ parent: { subscription_details: { subscription: "sub_2" } } }) === "sub_2", "forma nueva");
  ok(cobro.suscripcionDeFactura({}) === null, "factura suelta");
});

// =============================================================================================
// Primer cobro: nadie pierde días de prueba
// =============================================================================================
await prueba("inicio del cobro", () => {
  const en10 = new Date(AHORA + 10 * DIA).toISOString();
  ok(cobro.inicioDelCobro(en10, AHORA) === unix(Date.parse(en10)), "día 20 de 30: el cobro llega el día 30");
  const en1h = new Date(AHORA + 3600_000).toISOString();
  const r = cobro.inicioDelCobro(en1h, AHORA)!;
  ok(r * 1000 >= AHORA + 48 * 3600_000, "con 1 h de prueba: se corre a 48 h (Stripe no acepta menos)", r);
  ok(cobro.inicioDelCobro(new Date(AHORA - DIA).toISOString(), AHORA) === null, "prueba vencida: se cobra ya");
  ok(cobro.inicioDelCobro(null, AHORA) === null, "sin fecha de prueba: se cobra ya");
});

// =============================================================================================
// Pago (Checkout)
// =============================================================================================
await prueba("pago en plena prueba", async () => {
  fila.trial_ends_at = new Date(AHORA + 10 * DIA).toISOString();
  const url = await cobro.abrirPago(USER, "ana@clinica.test");
  ok(url === "https://checkout.stripe.test/s", "devuelve la URL de Checkout");
  ok(fila.stripe_customer_id === "cus_1", "guarda el cliente de Stripe");
  const crear = llamadas.find((l) => l.url.endsWith("/v1/customers"))!;
  const p = new URLSearchParams(crear.cuerpo);
  ok(p.get("metadata[user_id]") === USER && p.get("email") === "ana@clinica.test", "cliente con correo y dueño", crear.cuerpo);
  const s = new URLSearchParams(llamadas.find((l) => l.url.endsWith("/v1/checkout/sessions"))!.cuerpo);
  ok(s.get("mode") === "subscription" && s.get("line_items[0][price]") === "price_11usd", "suscripción al precio de US$11");
  ok(s.get("subscription_data[trial_end]") === String(unix(Date.parse(fila.trial_ends_at))), "primer cobro el día que termina la prueba", s.get("subscription_data[trial_end]"));
  ok(s.get("subscription_data[metadata][user_id]") === USER, "la suscripción sabe de quién es");
  ok((s.get("success_url") ?? "").includes("primer_cobro="), "la página de listo sabe cuándo es el primer cobro");
  ok(s.get("locale") === "es-419", "en español latino");
});

await prueba("pago con la prueba vencida: cobro inmediato", async () => {
  fila.trial_ends_at = new Date(AHORA - 2 * DIA).toISOString();
  fila.stripe_customer_id = "cus_1";
  await cobro.abrirPago(USER, "ana@clinica.test");
  ok(!llamadas.some((l) => l.url.endsWith("/v1/customers")), "no crea otro cliente si ya existe");
  const s = new URLSearchParams(llamadas.find((l) => l.url.endsWith("/v1/checkout/sessions"))!.cuerpo);
  ok(!s.has("subscription_data[trial_end]"), "sin trial_end");
  ok(!(s.get("success_url") ?? "").includes("primer_cobro"), "página de listo sin fecha");
});

await prueba("ya suscrito: portal, nunca un segundo pago", async () => {
  Object.assign(fila, { status: "active", stripe_customer_id: "cus_1", stripe_subscription_id: "sub_1" });
  const url = await cobro.abrirPago(USER, "ana@clinica.test");
  ok(url === "https://portal.stripe.test/p", "manda al portal");
  ok(!llamadas.some((l) => l.url.includes("/checkout/sessions")), "no abre Checkout");
});

await prueba("cobro rechazado y agotado (unpaid): portal para cambiar la tarjeta", async () => {
  Object.assign(fila, { status: "unpaid", stripe_customer_id: "cus_1", stripe_subscription_id: "sub_1" });
  ok((await cobro.abrirPago(USER, null)) === "https://portal.stripe.test/p", "unpaid va al portal");
});

await prueba("se fue y vuelve (canceled): pago nuevo", async () => {
  Object.assign(fila, { status: "canceled", stripe_customer_id: "cus_1", stripe_subscription_id: "sub_viejo" });
  ok((await cobro.abrirPago(USER, null)) === "https://checkout.stripe.test/s", "abre Checkout");
});

await prueba("portal sin haber pagado nunca", async () => {
  let codigo = "";
  try { await cobro.abrirPortal(USER); } catch (e: any) { codigo = e.codigo; }
  ok(codigo === "sin_pago", "NoAplica('sin_pago')", codigo);
});

// =============================================================================================
// Sincronizar (lo que hace el webhook)
// =============================================================================================
await prueba("sincronizar escribe lo que dice Stripe", async () => {
  fila.trial_ends_at = new Date(AHORA + 3 * DIA).toISOString();
  sub("sub_1", { status: "trialing", trial_end: unix(AHORA + 5 * DIA) });
  const r = await cobro.sincronizar("sub_1");
  ok(r.resultado === "escrita" && fila.stripe_subscription_id === "sub_1" && fila.status === "trialing", "fila al día", fila);
  ok(fila.trial_ends_at === new Date(unix(AHORA + 5 * DIA) * 1000).toISOString(), "toma la fecha de prueba de Stripe (los 2 días de regalo)");
  ok(!r.cancelacion && correos.length === 0, "sin correo");
});

await prueba("aviso viejo de una suscripción muerta no pisa la nueva", async () => {
  Object.assign(fila, { status: "active", stripe_subscription_id: "sub_nueva", stripe_customer_id: "cus_1" });
  sub("sub_vieja", { status: "canceled", ended_at: unix(AHORA - 40 * DIA) });
  const r = await cobro.sincronizar("sub_vieja");
  ok(r.resultado === "ignorada", "se ignora");
  ok(fila.status === "active" && fila.stripe_subscription_id === "sub_nueva", "sigue activa", fila);
});

await prueba("suscripción sin metadata: se encuentra por el cliente", async () => {
  fila.stripe_customer_id = "cus_1";
  const s = sub("sub_1");
  delete s.metadata.user_id;
  const r = await cobro.sincronizar("sub_1");
  ok(r.userId === USER && r.resultado === "escrita", "encontrada por stripe_customer_id", r);
});

await prueba("cancelar: un correo, una sola vez", async () => {
  Object.assign(fila, { status: "active", stripe_subscription_id: "sub_1", stripe_customer_id: "cus_1" });
  sub("sub_1", { cancel_at_period_end: true });
  const r1 = await cobro.sincronizar("sub_1");
  ok(r1.cancelacion?.customerId === "cus_1", "la primera vez pide correo", r1);
  ok(fila.cancel_at_period_end === true && fila.status === "active", "sigue activa hasta el fin del período");
  const r2 = await cobro.sincronizar("sub_1");
  ok(!r2.cancelacion, "el aviso repetido NO pide otro correo");
});

await prueba("correo de cancelación", async () => {
  const hasta = new Date(AHORA + 12 * DIA).toISOString();
  await cobro.enviarCorreoCancelacion("cus_1", USER, hasta);
  ok(correos.length === 1, "se manda uno");
  const c = correos[0];
  ok(c.to[0] === "ana@clinica.test" && c.reply_to === "contacto@closelabs.co", "a su correo, respuestas a contacto@");
  ok(c.html.includes("Hola, Ana:") && c.html.includes(cobro.fechaLarga(hasta)), "con su nombre y la fecha", c.html.slice(0, 300));
  ok(c.html.includes("Reanudar suscripción"), "dice cómo reanudar");
});

await prueba("correo: el nombre se escapa", () => {
  const { html } = cobro.correoCancelacion("<script>x</script> Pérez", null);
  ok(!html.includes("<script>"), "sin HTML inyectado");
});

// =============================================================================================
// Reanudar y poner al día
// =============================================================================================
await prueba("reanudar deshace cancel_at_period_end", async () => {
  Object.assign(fila, { status: "active", stripe_subscription_id: "sub_1", stripe_customer_id: "cus_1", cancel_at_period_end: true });
  sub("sub_1", { cancel_at_period_end: true });
  await cobro.reanudar(USER);
  const post = llamadas.find((l) => l.metodo === "POST" && l.url.endsWith("/v1/subscriptions/sub_1"))!;
  ok(post.cuerpo === "cancel_at_period_end=false", "manda cancel_at_period_end=false", post.cuerpo);
  ok(fila.cancel_at_period_end === false, "la fila queda reanudada");
});

await prueba("reanudar deshace cancel_at", async () => {
  Object.assign(fila, { status: "active", stripe_subscription_id: "sub_1", stripe_customer_id: "cus_1" });
  sub("sub_1", { cancel_at: unix(AHORA + 5 * DIA) });
  await cobro.reanudar(USER);
  const post = llamadas.find((l) => l.metodo === "POST" && l.url.endsWith("/v1/subscriptions/sub_1"))!;
  ok(post.cuerpo === "cancel_at=", "borra cancel_at", post.cuerpo);
  ok(fila.cancel_at_period_end === false, "la fila queda reanudada");
});

await prueba("reanudar una ya vencida", async () => {
  Object.assign(fila, { stripe_subscription_id: "sub_1" });
  sub("sub_1", { status: "canceled", ended_at: unix(AHORA - DIA) });
  let codigo = "";
  try { await cobro.reanudar(USER); } catch (e: any) { codigo = e.codigo; }
  ok(codigo === "vencida", "NoAplica('vencida')", codigo);
});

await prueba("poner al día escoge la suscripción viva", async () => {
  fila.stripe_customer_id = "cus_1";
  sub("sub_vieja", { status: "canceled", ended_at: unix(AHORA - 40 * DIA) });
  sub("sub_nueva", { status: "active" });
  await cobro.sincronizarCuenta(USER);
  ok(fila.stripe_subscription_id === "sub_nueva" && fila.status === "active", "queda la nueva", fila);
});

await prueba("poner al día sin haber pagado no llama a Stripe", async () => {
  await cobro.sincronizarCuenta(USER);
  ok(!llamadas.some((l) => l.url.includes("stripe.com")), "ninguna llamada a Stripe");
});

await prueba("sin llave de Stripe: error claro", async () => {
  const k = env.STRIPE_SECRET_KEY;
  delete env.STRIPE_SECRET_KEY;
  fila.stripe_customer_id = "cus_1";
  try {
    await cobro.abrirPortal(USER);
    ok(false, "debió fallar");
  } catch (e: any) {
    ok(e instanceof cobro.ErrorStripe && e.status === 0, "ErrorStripe(0)", e.message);
  } finally {
    env.STRIPE_SECRET_KEY = k;
  }
});

console.log(`\n${pasan} comprobaciones bien, ${fallos} mal`);
if (fallos) process.exit(1);

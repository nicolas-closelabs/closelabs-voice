// CloseLabs Voice — administración de los médicos de un socio (gMedic), para la página
// closelabs.co/voice/admin. Pedida por Nicolás (2026-10-06): activar, pausar y facturar sin SQL.
//
// Hace lo mismo que `socio_autorizar`, `socio_pausar` y `socio_uso_mes` en el SQL editor (ver
// migraciones 20261006000003 y 20261007000001): no hay una segunda lógica que mantener.
//
// ⚠️ Quién entra: solo una sesión de Voice cuyo correo esté en `administradores`. La sesión NO se
// lee del JWT a mano (como hace `account`): se le pregunta a Supabase (`/auth/v1/user`), que la
// verifica. Por eso `verify_jwt = false` en config.toml: la llamada viene de un navegador, y el
// preflight de CORS no lleva sesión.
//
// GET  ?mes=YYYY-MM                         → { admin, mes, medicos: [...], pruebas: [...] }
// POST { accion: "alta" | "baja", correos }  → { resultados: [{ email, resultado }] }
// POST { accion: "historial", email }        → { cambios: [...] }
// POST { accion: "prueba", email, hasta }    → { resultado }   (hasta = "YYYY-MM-DD", fin del día en Bogotá)
// POST { accion: "cortar_prueba", email }    → { resultado }
//
// Las pruebas (desde 2026-10-15) son las de venta directa: extender o cortar la prueba gratis de
// una cuenta mientras estamos en pruebas con médicos. La lógica está en `prueba_ajustar` (migración
// 20261015000001).

import { rpc, rpcRows, select } from "../_shared/db.ts";

/** La web y, para desarrollarla, cualquier localhost. */
function origenPermitido(origen: string | null): string | null {
  if (!origen) return null;
  if (origen === "https://www.closelabs.co" || origen === "https://closelabs.co") return origen;
  if (/^http:\/\/localhost:\d+$/.test(origen)) return origen;
  return null;
}

const MAX_CORREOS = 200;
/** Tope de una extensión, para que un error al escribir el año no regale acceso por una década. */
const MAX_DIAS_PRUEBA = 366;

Deno.serve(async (req) => {
  const origen = origenPermitido(req.headers.get("origin"));
  const cors: Record<string, string> = origen
    ? {
      "access-control-allow-origin": origen,
      "access-control-allow-headers": "authorization, content-type",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      vary: "origin",
    }
    : {};
  const responder = (cuerpo: unknown, status = 200) =>
    new Response(JSON.stringify(cuerpo), {
      status,
      headers: { ...cors, "content-type": "application/json; charset=utf-8" },
    });

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  // ---- ¿Quién es? ----
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return responder({ error: "sesion" }, 401);
  const usuario = await fetch(`${Deno.env.get("SUPABASE_URL")}/auth/v1/user`, {
    headers: { apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "", authorization: `Bearer ${token}` },
  });
  if (!usuario.ok) return responder({ error: "sesion" }, 401);
  const correo = String((await usuario.json())?.email ?? "").toLowerCase();
  const admin = correo
    ? await select<{ email: string }>("administradores", `select=email&email=eq.${encodeURIComponent(correo)}`)
    : [];
  if (admin.length === 0) return responder({ error: "no_admin" }, 403);

  try {
    if (req.method === "GET") {
      const pedido = new URL(req.url).searchParams.get("mes") ?? "";
      const mes = /^\d{4}-\d{2}$/.test(pedido) ? pedido : new Date().toISOString().slice(0, 7);
      const [medicos, pruebas] = await Promise.all([
        rpcRows("socio_uso_mes", { p_mes: `${mes}-01` }),
        rpcRows("pruebas_ajustadas", {}),
      ]);
      return responder({ admin: correo, mes, medicos, pruebas });
    }

    if (req.method !== "POST") return responder({ error: "metodo" }, 405);
    const cuerpo = await req.json().catch(() => ({}));

    if (cuerpo.accion === "historial" && typeof cuerpo.email === "string") {
      const email = cuerpo.email.trim().toLowerCase();
      const cambios = await select(
        "socio_cambios",
        `select=accion,resultado,por,at&email=eq.${encodeURIComponent(email)}&order=at.desc&limit=50`,
      );
      return responder({ cambios });
    }

    if ((cuerpo.accion === "prueba" || cuerpo.accion === "cortar_prueba") && typeof cuerpo.email === "string") {
      const email = cuerpo.email.trim().toLowerCase();
      let hasta = new Date();
      if (cuerpo.accion === "prueba") {
        if (typeof cuerpo.hasta !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(cuerpo.hasta)) {
          return responder({ error: "fecha" }, 400);
        }
        // Hasta el final de ese día en Bogotá: "hasta el 31" incluye el 31 entero.
        hasta = new Date(`${cuerpo.hasta}T23:59:59-05:00`);
        const dias = (hasta.getTime() - Date.now()) / 86_400_000;
        if (!Number.isFinite(dias) || dias <= 0 || dias > MAX_DIAS_PRUEBA) {
          return responder({ error: "fecha" }, 400);
        }
      }
      const resultado = await rpc<string>("prueba_ajustar", {
        p_email: email,
        p_hasta: hasta.toISOString(),
        p_por: correo,
      });
      console.log(`admin: ${correo} hizo ${cuerpo.accion} de un correo`);
      return responder({ resultado: String(resultado) });
    }

    if ((cuerpo.accion === "alta" || cuerpo.accion === "baja") && Array.isArray(cuerpo.correos)) {
      const correos = [...new Set(
        cuerpo.correos
          .filter((c: unknown): c is string => typeof c === "string")
          .map((c: string) => c.trim().toLowerCase())
          .filter(Boolean),
      )] as string[];
      if (correos.length === 0 || correos.length > MAX_CORREOS) {
        return responder({ error: "correos" }, 400);
      }
      const resultados: { email: string; resultado: string }[] = [];
      // Uno por uno y en orden: son pocos, y así un error en uno no esconde lo que pasó con el resto.
      for (const email of correos) {
        try {
          const r = cuerpo.accion === "alta"
            ? await rpc<string>("socio_autorizar", { p_email: email, p_canal: "gmedic", p_por: correo })
            : await rpc<string>("socio_pausar", { p_email: email, p_por: correo });
          resultados.push({ email, resultado: String(r) });
        } catch (e) {
          console.error(`admin ${cuerpo.accion} falló para un correo:`, (e as Error).message);
          resultados.push({ email, resultado: "⚠️ error del servidor: no se hizo nada, intenta de nuevo" });
        }
      }
      console.log(`admin: ${correo} hizo ${cuerpo.accion} de ${correos.length} correo(s)`);
      return responder({ resultados });
    }

    return responder({ error: "accion" }, 400);
  } catch (e) {
    console.error("admin falló:", (e as Error).message);
    return responder({ error: "servidor" }, 500);
  }
});

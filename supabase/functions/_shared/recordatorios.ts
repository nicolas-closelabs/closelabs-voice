// CloseLabs Voice — los correos de fin de la prueba (ver migración 20261007000005).
//
// Dos correos, cada uno una vez, solo a la venta directa sin suscripción:
//   'quedan'  — le quedan 3 días o menos.
//   'termino' — ya terminó.
// Mismo tono que la pantalla de la app (Suscripcion.tsx): qué pasa, qué hacer, cuánto cuesta. Nada de
// urgencias falsas ni mayúsculas. El precio vive en Stripe; si cambia allá, cambiarlo aquí.

import { fechaLarga } from "./cobro.ts";

const PRECIO = "US$12 al mes";

export type TipoRecordatorio = "quedan" | "termino" | "rescate";

const WHATSAPP = "https://wa.me/573102991182";

const escapar = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

/** "4 horas y 12 minutos", "38 minutos". */
function duracion(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  const hs = h === 1 ? "1 hora" : `${h} horas`;
  const ms = m === 1 ? "1 minuto" : `${m} minutos`;
  if (h === 0) return ms;
  return m === 0 ? hs : `${hs} y ${ms}`;
}

export function diasRestantes(fin: string, ahoraMs: number): number {
  return Math.max(1, Math.ceil((Date.parse(fin) - ahoraMs) / 86_400_000));
}

export function correoRecordatorio(
  tipo: TipoRecordatorio,
  datos: {
    nombre: string | null;
    fin: string;
    dictados: number;
    minutos: number;
    /** Solo importa en el rescate: si ya confirmó el correo. */
    confirmado?: boolean;
  },
  ahoraMs = Date.now(),
): { asunto: string; html: string } {
  if (tipo === "rescate") return correoRescate(datos.nombre, datos.confirmado !== false);
  const saludo = datos.nombre ? `Hola, ${escapar(datos.nombre.split(" ")[0])}:` : "Hola:";
  const p = (t: string) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.6">${t}</p>`;
  const uso = datos.dictados > 0
    ? `${tipo === "quedan" ? "En tu prueba llevas" : "En tu prueba hiciste"} <strong>${datos.dictados.toLocaleString("es")} ${datos.dictados === 1 ? "dictado" : "dictados"}</strong>${datos.minutos > 0 ? `: ${duracion(datos.minutos)} de voz que no tuviste que escribir` : ""}.`
    : null;
  const pasos = `Para seguir, abre CloseLabs Voice, entra a <strong>Mi cuenta</strong> y toca <strong>Suscribirme</strong>. Son ${PRECIO} y cancelas cuando quieras.`;

  let asunto: string;
  let cuerpo: string;
  if (tipo === "quedan") {
    const dias = diasRestantes(datos.fin, ahoraMs);
    asunto = dias === 1 ? "Mañana termina tu prueba de CloseLabs Voice" : `Te quedan ${dias} días de prueba en CloseLabs Voice`;
    cuerpo = [
      p(saludo),
      p(`Tu prueba gratuita de CloseLabs Voice termina el <strong>${fechaLarga(datos.fin)}</strong>.`),
      uso ? p(uso) : "",
      p(pasos),
      p("Si te suscribes antes de esa fecha, <strong>no pierdes ningún día</strong>: el primer cobro llega cuando termine tu prueba."),
    ].join("");
  } else {
    asunto = "Tu prueba de CloseLabs Voice terminó";
    cuerpo = [
      p(saludo),
      p("Tu prueba gratuita de CloseLabs Voice terminó. Gracias por probarla."),
      uso ? p(uso) : "",
      p(pasos),
      p("Tu cuenta, tu diccionario y tus equipos siguen ahí: vuelves a dictar en cuanto te suscribas."),
    ].join("");
  }

  const html = `<div style="max-width:560px;margin:0 auto;padding:24px;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#1a1620">
    ${cuerpo}
    <p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#6f677e">¿Dudas? Escríbenos por <a href="${WHATSAPP}" style="color:#8b2ff3">WhatsApp</a> o responde este correo.<br>— El equipo de CloseLabs</p>
  </div>`;
  return { asunto, html };
}

/**
 * Rescate a las 24 h (migración 20261111000001): se registró y no ha dictado nunca. Un solo correo,
 * corto, con UNA cosa que hacer y la ayuda por WhatsApp bien a la vista. Sin hablar de la prueba ni
 * de precios: aquí lo único que importa es que haga su primer dictado.
 */
function correoRescate(nombre: string | null, confirmado: boolean): { asunto: string; html: string } {
  const saludo = nombre ? `Hola, ${escapar(nombre.split(" ")[0])}:` : "Hola:";
  const p = (t: string) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.6">${t}</p>`;
  const mensaje = encodeURIComponent(
    confirmado
      ? "Hola, necesito ayuda para hacer mi primer dictado en CloseLabs Voice."
      : "Hola, necesito ayuda para terminar de crear mi cuenta de CloseLabs Voice.",
  );
  const boton = `<p style="margin:8px 0 24px"><a href="${WHATSAPP}?text=${mensaje}" style="display:inline-block;background:#128C7E;color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;padding:12px 22px;border-radius:12px">Escribirnos por WhatsApp</a></p>`;

  let asunto: string;
  let cuerpo: string;
  if (confirmado) {
    asunto = "¿Te ayudamos con tu primer dictado?";
    cuerpo = [
      p(saludo),
      p("Creaste tu cuenta de CloseLabs Voice, pero todavía no has hecho tu primer dictado. Es normal: al principio cuesta encontrar cómo."),
      p("Abre CloseLabs Voice, haz clic donde quieras escribir y presiona <strong>Ctrl + Espacio</strong> (en Mac, <strong>Option + Espacio</strong>). Habla, y presiona otra vez para terminar. El texto aparece solo."),
      p("Si algo no funciona, escríbenos y lo resolvemos contigo, paso a paso:"),
      boton,
    ].join("");
  } else {
    asunto = "Te falta un paso para usar CloseLabs Voice";
    cuerpo = [
      p(saludo),
      p("Empezaste a crear tu cuenta de CloseLabs Voice, pero falta confirmar tu correo."),
      p("Abre CloseLabs Voice, toca <strong>Ya tengo una cuenta</strong> y entra con tu correo y tu contraseña. La app te pedirá el código de 6 números que te enviamos; si no lo encuentras, toca <strong>Enviarme el correo otra vez</strong>."),
      p("Si te trabas, escríbenos y lo resolvemos contigo:"),
      boton,
    ].join("");
  }

  const html = `<div style="max-width:560px;margin:0 auto;padding:24px;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#1a1620">
    ${cuerpo}
    <p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#6f677e">— El equipo de CloseLabs</p>
  </div>`;
  return { asunto, html };
}

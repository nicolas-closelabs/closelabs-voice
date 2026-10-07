// CloseLabs Voice — los correos de fin de la prueba (ver migración 20261007000005).
//
// Dos correos, cada uno una vez, solo a la venta directa sin suscripción:
//   'quedan'  — le quedan 3 días o menos.
//   'termino' — ya terminó.
// Mismo tono que la pantalla de la app (Suscripcion.tsx): qué pasa, qué hacer, cuánto cuesta. Nada de
// urgencias falsas ni mayúsculas. El precio vive en Stripe; si cambia allá, cambiarlo aquí.

import { fechaLarga } from "./cobro.ts";

const PRECIO = "US$12 al mes";

export type TipoRecordatorio = "quedan" | "termino";

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
  datos: { nombre: string | null; fin: string; dictados: number; minutos: number },
  ahoraMs = Date.now(),
): { asunto: string; html: string } {
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
    <p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#6f677e">¿Dudas? Escríbenos por <a href="https://wa.me/573102991182" style="color:#8b2ff3">WhatsApp</a> o responde este correo.<br>— El equipo de CloseLabs</p>
  </div>`;
  return { asunto, html };
}

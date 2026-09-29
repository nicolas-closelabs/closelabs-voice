/**
 * Banco de la capa de VOZ: ¿el motor de voz entregó lo que el médico dijo?
 *
 * El banco de `pruebas-dictado/correr.ts` arranca desde el texto ya transcrito, así que no puede
 * ver lo que se pierde ANTES: una dosis mal oída, una negación que se vuelve otra palabra, un
 * párrafo reemplazado por texto inventado. Nada de eso lo arregla el formateo, porque el formateo
 * nunca vio lo que se dijo. Esto compara el crudo de cada grabación contra el guion.
 *
 *   bun pruebas-dictado/voz/revisar.ts
 *
 * Hoy revisa los crudos guardados (grabados en la app con la limpieza apagada). Cuando haya audio
 * guardado, el mismo revisor sirve para comparar configuraciones del motor (pista, idioma).
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const CASOS = join(dirname(fileURLToPath(import.meta.url)), "casos");

interface Caso {
  id: string;
  titulo: string;
  condicion: string;
  referencia: string;
  crudo: string;
  comprobaciones: { tipo: "conserva" | "numeros"; valores: string[] }[];
}

/** Lo que la PISTA que le mandamos a Whisper puede meter en el texto por su cuenta. */
const COLADOS = [
  "dictado médico", "dictado m ", "signos de puntuación", "correos electrónicos", "maria.lopez",
  "closelabs", "empagliflozina", "walteros",
  // Alucinaciones clásicas de Whisper en silencio: vienen de los subtítulos con que se entrenó.
  "gracias por ver", "suscríbete", "subtítulos",
];

const ACENTOS = /[áéíóúñü]/;
const numerosDe = (s: string) => s.match(/\d+(?:[.,]\d+)*/g) ?? [];
const palabrasDe = (s: string) => s.toLowerCase().split(/[^a-záéíóúñü]+/).filter(Boolean);
const hay = (texto: string, valor: string) =>
  valor.split("|").some((v) => texto.toLowerCase().includes(v.toLowerCase()));

function revisar(c: Caso) {
  const crudo = c.crudo;
  const conserva = c.comprobaciones.find((x) => x.tipo === "conserva")?.valores ?? [];
  const numeros = c.comprobaciones.find((x) => x.tipo === "numeros")?.valores ?? [];

  const perdidos = conserva.filter((v) => !hay(crudo, v)).map((v) => v.split("|")[0]);

  const delCrudo = numerosDe(crudo);
  const faltan = numeros.filter((v) => !v.split("|").some((alt) => delCrudo.includes(alt)));
  const esperados = new Set(numeros.flatMap((v) => v.split("|")));
  const inventados = [...new Set(delCrudo.filter((n) => !esperados.has(n)))];

  // Palabra cortada: no existe en el guion, pero es el comienzo de una palabra del guion y lo que
  // falta empieza justo en una letra con tilde o eñe ("tensi" de tensión, "a" de años).
  const delGuion = new Set(palabrasDe(c.referencia));
  const cortadas = [...new Set(palabrasDe(crudo).filter((p) =>
    !delGuion.has(p) &&
    [...delGuion].some((w) => w.length > p.length && w.startsWith(p) && ACENTOS.test(w[p.length])),
  ))];

  const ref = c.referencia.toLowerCase();
  const colados = COLADOS.filter((f) => crudo.toLowerCase().includes(f) && !ref.includes(f.trim()));

  return { perdidos, faltan, inventados, cortadas, colados, datos: conserva.length + numeros.length };
}

const casos: Caso[] = readdirSync(CASOS)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(join(CASOS, f), "utf8")))
  .sort((a, b) => a.id.localeCompare(b.id, "es", { numeric: true }));

let totalDatos = 0, totalMal = 0, conInventos = 0, conColados = 0, conCortes = 0;
for (const c of casos) {
  const r = revisar(c);
  const mal = r.perdidos.length + r.faltan.length;
  totalDatos += r.datos; totalMal += mal;
  if (r.inventados.length) conInventos++;
  if (r.colados.length) conColados++;
  if (r.cortadas.length) conCortes++;
  const limpio = !mal && !r.inventados.length && !r.colados.length && !r.cortadas.length;
  console.log(`${limpio ? "✅" : "❌"} ${c.id.padEnd(10)} ${c.titulo} [${c.condicion}]`);
  if (r.perdidos.length) console.log(`     perdió:            ${r.perdidos.join(", ")}`);
  if (r.faltan.length) console.log(`     faltan números:    ${r.faltan.map((n) => n.split("|")[0]).join(", ")}`);
  if (r.inventados.length) console.log(`     números que NADIE dijo: ${r.inventados.join(", ")}`);
  if (r.cortadas.length) console.log(`     palabras cortadas: ${r.cortadas.join(", ")}`);
  if (r.colados.length) console.log(`     texto colado:      ${r.colados.join(", ")}`);
}
console.log(
  `\nDatos clínicos que llegaron mal o no llegaron: ${totalMal} de ${totalDatos}` +
  `\nDictados con números inventados: ${conInventos} de ${casos.length}` +
  ` · con texto colado: ${conColados} · con palabras cortadas: ${conCortes}`,
);

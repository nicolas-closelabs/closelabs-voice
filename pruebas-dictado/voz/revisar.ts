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

export interface Caso {
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

/** "cada ocho horas" dice lo mismo que "cada 8 horas": el número escrito en palabras cuenta. */
const EN_PALABRAS: Record<string, string[]> = {
  "1": ["un", "uno", "una"], "2": ["dos"], "3": ["tres"], "4": ["cuatro"], "5": ["cinco"],
  "6": ["seis"], "7": ["siete"], "8": ["ocho"], "9": ["nueve"], "10": ["diez"], "11": ["once"],
  "12": ["doce"], "14": ["catorce"], "15": ["quince"], "16": ["dieciséis"], "18": ["dieciocho"],
  "20": ["veinte"], "30": ["treinta"], "40": ["cuarenta"], "50": ["cincuenta"], "60": ["sesenta"],
  "70": ["setenta"], "80": ["ochenta"], "90": ["noventa"], "100": ["cien"],
};
const enPalabras = (texto: string, n: string) =>
  (EN_PALABRAS[n] ?? []).some((w) => new RegExp(`(?<!\\p{L})${w}(?!\\p{L})`, "iu").test(texto));
const numerosDe = (s: string) => s.match(/\d+(?:[.,]\d+)*/g) ?? [];
const palabrasDe = (s: string) => s.toLowerCase().split(/[^a-záéíóúñü]+/).filter(Boolean);
const hay = (texto: string, valor: string) =>
  valor.split("|").some((v) => texto.toLowerCase().includes(v.toLowerCase()));

export function revisar(c: Caso) {
  const crudo = c.crudo;
  const conserva = c.comprobaciones.find((x) => x.tipo === "conserva")?.valores ?? [];
  const numeros = c.comprobaciones.find((x) => x.tipo === "numeros")?.valores ?? [];

  const perdidos = conserva.filter((v) => !hay(crudo, v)).map((v) => v.split("|")[0]);

  const delCrudo = numerosDe(crudo);
  // Una variante con letras o espacios ("1 metro 56", "cuatro meses") se busca como frase.
  const esFrase = (alt: string) => /[\sa-záéíóúñ]/i.test(alt);
  const faltan = numeros.filter((v) => !v.split("|").some((alt) =>
    esFrase(alt) ? crudo.toLowerCase().includes(alt.toLowerCase()) : delCrudo.includes(alt) || enPalabras(crudo, alt)));
  const esperados = new Set(numeros.flatMap((v) => v.split("|").flatMap((alt) => esFrase(alt) ? numerosDe(alt) : [alt])));
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

export function leerCasos(): Caso[] {
  return readdirSync(CASOS)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(CASOS, f), "utf8")));
}

/** `--recalificar a.json b.json`: vuelve a revisar textos ya transcritos con las comprobaciones de hoy. */
function recalificar(archivos: string[]) {
  const casos = new Map(leerCasos().map((c) => [c.id, c]));
  const casoDe: Record<string, string> = { "2.2 parte 2": "voz-2-2b" };
  for (const a of archivos) {
    const d = JSON.parse(readFileSync(a, "utf8"));
    console.log(`\n${d.etiqueta}`);
    for (const [cfg, v] of Object.entries<any>(d.configs)) {
      let mal = 0, datos = 0, inv = 0, col = 0, cort = 0, n = 0;
      const quien = new Map<string, number>();
      for (const x of v.detalle) {
        if (!x.texto) continue;
        const caso = casos.get(casoDe[x.audio] ?? `voz-${x.audio.replace(".", "-")}`)!;
        const r = revisar({ ...caso, crudo: x.texto });
        mal += r.perdidos.length + r.faltan.length; datos += r.datos; n++;
        inv += r.inventados.length; col += r.colados.length; cort += r.cortadas.length;
        quien.set(x.proveedor, (quien.get(x.proveedor) ?? 0) + 1);
      }
      console.log(`  ${cfg.padEnd(24)} mal ${String(mal).padStart(3)}/${datos} (${(100 * mal / datos).toFixed(1)}%) · inventados ${inv} · colado ${col} · cortadas ${cort}  [${[...quien].map(([p, k]) => `${p} ${k}`).join(" · ")}]`);
    }
  }
}

if (import.meta.main && process.argv.includes("--recalificar")) {
  recalificar(process.argv.slice(process.argv.indexOf("--recalificar") + 1));
} else if (import.meta.main) {
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
}

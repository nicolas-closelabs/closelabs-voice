/**
 * Banco de pruebas del dictado. Ver `pruebas-dictado/README.md`.
 *
 * Corre cada caso varias veces contra `/format` (lo que esté desplegado), comprueba cosas
 * objetivas sobre la salida y guarda el resultado para poder comparar con corridas anteriores.
 *
 * ⚠️ No mide si el texto "se ve bien": mide que no se pierda ni cambie contenido. Esa es la
 * propiedad que hace seguro un dictado clínico; lo bonito es negociable.
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const CASOS = join(AQUI, "casos");
const RESULTADOS = join(AQUI, "resultados");

type Comprobacion =
  | { tipo: "numeros_intactos"; retractados?: string[] }
  | { tipo: "conserva"; valores: string[] }
  | { tipo: "contiene"; valor: string }
  | { tipo: "no_contiene"; valor: string }
  | { tipo: "termina_en"; valor: string }
  | { tipo: "sin_muletillas" }
  | { tipo: "formato_basico" }
  | { tipo: "longitud"; min: number; max: number };

interface Caso {
  id: string;
  descripcion: string;
  origen: "dictado real" | "inventado";
  texto: string;
  comprobaciones: Comprobacion[];
}

const numeros = (s: string) => s.match(/\d+(?:[.,]\d+)?/g) ?? [];

function evaluar(c: Comprobacion, entrada: string, salida: string): { ok: boolean; detalle: string } {
  const s = salida.toLowerCase();
  switch (c.tipo) {
    case "numeros_intactos": {
      const fuera = (c.retractados ?? []).map(String);
      const dentro = numeros(entrada).filter((n) => !fuera.includes(n));
      const faltan = dentro.filter((n) => !numeros(salida).includes(n));
      // Los números retractados NO deben sobrevivir: si siguen ahí, la corrección no se aplicó.
      const sobran = fuera.filter((n) => numeros(salida).includes(n));
      return {
        ok: faltan.length === 0 && sobran.length === 0,
        detalle: [
          faltan.length ? `faltan ${faltan.join(", ")}` : "",
          sobran.length ? `quedó lo retractado: ${sobran.join(", ")}` : "",
        ]
          .filter(Boolean)
          .join(" · "),
      };
    }
    case "conserva": {
      const faltan = c.valores.filter((v) => !s.includes(v.toLowerCase()));
      return { ok: faltan.length === 0, detalle: faltan.length ? `faltan ${faltan.join(", ")}` : "" };
    }
    case "contiene":
      return { ok: s.includes(c.valor.toLowerCase()), detalle: c.valor };
    case "no_contiene":
      return { ok: !s.includes(c.valor.toLowerCase()), detalle: c.valor };
    case "termina_en":
      return { ok: s.includes(c.valor.toLowerCase()), detalle: `no llegó a "${c.valor}"` };
    case "sin_muletillas":
      return { ok: !/\b(eh|em|mmm|este)\b\s*,?/i.test(salida), detalle: "quedaron muletillas" };
    case "formato_basico": {
      const ok = /^[A-ZÁÉÍÓÚÑ¿¡]/.test(salida.trim()) && /[.!?]$/.test(salida.trim());
      return { ok, detalle: "mayúscula inicial y signo final" };
    }
    case "longitud": {
      const r = salida.length / entrada.length;
      return { ok: r >= c.min && r <= c.max, detalle: `proporción ${r.toFixed(2)}` };
    }
  }
}

async function formatear(texto: string, prompt: string, base: string, token: string) {
  const t0 = Date.now();
  const res = await fetch(`${base.replace(/\/+$/, "")}/format`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ text: texto, system_prompt: prompt }),
  });
  const ms = Date.now() - t0;
  if (!res.ok) return { error: `http_${res.status}`, ms, texto: "", proveedor: "" };
  const body = await res.json();
  return { error: "", ms, texto: String(body.text ?? ""), proveedor: String(body.provider ?? "") };
}

/** El prompt real del producto, leído del código: el banco mide lo que usa el médico. */
function promptDelProducto(): string {
  const src = readFileSync(join(AQUI, "..", "src-tauri", "src", "settings.rs"), "utf8");
  const m = src.match(/prompt: "(Eres un formateador[\s\S]*?)"\.to_string\(\)/);
  if (!m) throw new Error("no se encontró el prompt en settings.rs");
  return JSON.parse(`"${m[1]}"`).replace("${output}", "").trim();
}

function credenciales() {
  if (process.env.PROXY_BASE && process.env.DEVICE_TOKEN) {
    return { base: process.env.PROXY_BASE, token: process.env.DEVICE_TOKEN };
  }
  const ruta = join(
    process.env.HOME ?? "",
    "Library/Application Support/com.closelabs.voice/settings_store.json",
  );
  const store = JSON.parse(readFileSync(ruta, "utf8"));
  const s = store.settings ?? store;
  return { base: s.proxy_base_url as string, token: s.device_token as string };
}

const args = process.argv.slice(2);
const opcion = (nombre: string, def?: string) => {
  const i = args.indexOf(`--${nombre}`);
  return i >= 0 ? args[i + 1] : def;
};
const repeticiones = Number(opcion("repeticiones", "3"));
const soloCaso = opcion("caso");
const etiqueta = opcion("etiqueta", "sin-etiqueta")!;

const casos: Caso[] = readdirSync(CASOS)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(join(CASOS, f), "utf8")) as Caso)
  .filter((c) => !soloCaso || c.id === soloCaso)
  .sort((a, b) => a.id.localeCompare(b.id));

const { base, token } = credenciales();
const prompt = promptDelProducto();

console.log(`Banco de dictado · ${casos.length} caso(s) × ${repeticiones} · etiqueta "${etiqueta}"\n`);

const resumen: any = { etiqueta, fecha: new Date().toISOString(), casos: {} };
let totalOk = 0;
let total = 0;
const latencias: number[] = [];

for (const caso of casos) {
  const conteo = new Map<string, number>();
  const detalles = new Map<string, string>();
  let errores = 0;
  const ms: number[] = [];

  for (let i = 0; i < repeticiones; i++) {
    const r = await formatear(caso.texto, prompt, base, token);
    if (r.error) {
      errores++;
      continue;
    }
    ms.push(r.ms);
    for (const c of caso.comprobaciones) {
      const clave = c.tipo === "contiene" || c.tipo === "no_contiene" ? `${c.tipo}:${c.valor}` : c.tipo;
      const { ok, detalle } = evaluar(c, caso.texto, r.texto);
      conteo.set(clave, (conteo.get(clave) ?? 0) + (ok ? 1 : 0));
      if (!ok && detalle) detalles.set(clave, detalle);
    }
  }

  const mediana = ms.length ? ms.sort((a, b) => a - b)[Math.floor(ms.length / 2)] : 0;
  latencias.push(...ms);
  const hechas = repeticiones - errores;
  console.log(`▸ ${caso.id} — ${caso.descripcion} (${caso.origen}, ${caso.texto.length} chars)`);
  if (errores) console.log(`   ⚠️  ${errores} de ${repeticiones} llamadas fallaron`);

  const filas: Record<string, string> = {};
  for (const c of caso.comprobaciones) {
    const clave = c.tipo === "contiene" || c.tipo === "no_contiene" ? `${c.tipo}:${c.valor}` : c.tipo;
    const ok = conteo.get(clave) ?? 0;
    total += 1;
    if (ok === hechas && hechas > 0) totalOk += 1;
    filas[clave] = `${ok}/${hechas}`;
    const marca = ok === hechas && hechas > 0 ? "✅" : ok === 0 ? "❌" : "⚠️ ";
    const extra = detalles.get(clave) ? ` — ${detalles.get(clave)}` : "";
    console.log(`   ${marca} ${clave}: ${ok}/${hechas}${extra}`);
  }
  console.log(`   ⏱  ${(mediana / 1000).toFixed(1)}s\n`);
  resumen.casos[caso.id] = { comprobaciones: filas, medianaMs: mediana, errores };
}

const medianaGlobal = latencias.length
  ? latencias.sort((a, b) => a - b)[Math.floor(latencias.length / 2)]
  : 0;
resumen.total = { ok: totalOk, de: total, medianaMs: medianaGlobal };
console.log(`TOTAL: ${totalOk}/${total} comprobaciones sin un solo fallo · mediana ${(medianaGlobal / 1000).toFixed(1)}s`);

if (!existsSync(RESULTADOS)) mkdirSync(RESULTADOS, { recursive: true });
const archivo = join(RESULTADOS, `${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}-${etiqueta}.json`);
writeFileSync(archivo, JSON.stringify(resumen, null, 2));

// Comparación con la corrida anterior: lo que de verdad se quiere saber es si algo EMPEORÓ.
const previos = readdirSync(RESULTADOS)
  .filter((f) => f.endsWith(".json") && !archivo.endsWith(f))
  .sort();
if (previos.length) {
  const anterior = JSON.parse(readFileSync(join(RESULTADOS, previos[previos.length - 1]), "utf8"));
  console.log(`\nContra "${anterior.etiqueta}" (${anterior.fecha.slice(0, 16)}):`);
  console.log(`  antes ${anterior.total.ok}/${anterior.total.de} · ahora ${totalOk}/${total}`);
  for (const [id, datos] of Object.entries<any>(resumen.casos)) {
    const antes = anterior.casos?.[id];
    if (!antes) continue;
    for (const [clave, valor] of Object.entries<string>(datos.comprobaciones)) {
      const valorAntes = antes.comprobaciones?.[clave];
      if (valorAntes && valorAntes !== valor) {
        const peor = Number(valor.split("/")[0]) < Number(valorAntes.split("/")[0]);
        console.log(`  ${peor ? "🔻" : "🔺"} ${id} · ${clave}: ${valorAntes} → ${valor}`);
      }
    }
  }
}
console.log(`\nGuardado en ${archivo.replace(AQUI, "pruebas-dictado")}`);

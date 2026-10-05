/**
 * El MISMO audio contra Whisper con distintas configuraciones, revisado contra el guion.
 *
 *   bun pruebas-dictado/voz/transcribir.ts [--repeticiones 1] [--etiqueta nombre]
 *
 * Usa `/transcribe` de producción con el token de este equipo, así que mide el motor real
 * (proveedor, modelo, respaldo). NO cambia nada en producción: la pista y el idioma viajan en cada
 * petición, y aquí se prueban sin tocar lo que reciben los médicos.
 *
 * Los audios van en `voz/audios/opus/*.ogg` (Ogg/Opus 16 kHz mono 24 kbps, lo mismo que sube la
 * app; ver `opus_encode.rs`). Se sacan de Notas de Voz con:
 *   ffmpeg -i X.m4a -ac 1 -ar 16000 -c:a libopus -b:a 24k -application voip opus/X.ogg
 * ⚠️ La carpeta `audios/` NO va al repositorio: es la voz de quien grabó.
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { leerCasos, revisar, type Caso } from "./revisar.ts";

const AQUI = dirname(fileURLToPath(import.meta.url));
// `--carpeta medico` lee `audios/medico/opus/`; sin la opción, `audios/opus/` (los de Nicolás).
const _i = process.argv.indexOf("--carpeta");
const AUDIOS = _i >= 0
  ? join(AQUI, "audios", process.argv[_i + 1], "opus")
  : join(AQUI, "audios", "opus");
const RAIZ = join(AQUI, "..", "..");

const args = process.argv.slice(2);
const opcion = (n: string, d: string) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const repeticiones = Number(opcion("repeticiones", "1"));
const etiqueta = opcion("etiqueta", "configuraciones");

/** La frase de estilo tal como está en la app (`STYLE_HINT` en groq_transcribe.rs). */
function fraseDeEstilo(): string {
  const src = readFileSync(join(RAIZ, "src-tauri", "src", "groq_transcribe.rs"), "utf8");
  const m = src.match(/const STYLE_HINT: &str = "([\s\S]*?)";/);
  if (!m) throw new Error("no se encontró STYLE_HINT");
  return m[1].replace(/\\\n\s*/g, "");
}

function ajustes() {
  const s = JSON.parse(readFileSync(join(process.env.HOME ?? "",
    "Library/Application Support/com.closelabs.voice/settings_store.json"), "utf8"));
  const a = s.settings ?? s;
  return { base: a.proxy_base_url as string, token: a.device_token as string, palabras: (a.custom_words ?? []) as string[] };
}

const { base, token, palabras } = ajustes();
const estilo = fraseDeEstilo();
const diccionario = palabras.length ? palabras.join(", ") + "." : "";

/** Lo que se compara. La primera es exactamente lo que manda hoy la app. */
const CONFIGS: { nombre: string; pista: string; idioma?: string }[] = [
  { nombre: "HOY: estilo+dicc, auto", pista: `${estilo} ${diccionario}`.trim() },
  { nombre: "sin pista, auto", pista: "" },
  { nombre: "estilo+dicc, es", pista: `${estilo} ${diccionario}`.trim(), idioma: "es" },
  { nombre: "sin pista, es", pista: "", idioma: "es" },
  { nombre: "solo dicc, es", pista: diccionario, idioma: "es" },
];

/** `--configs 0,1` corre solo esas (por posición en CONFIGS). */
const soloConfigs = opcion("configs", "").split(",").filter(Boolean).map(Number);
const aCorrer = soloConfigs.length ? CONFIGS.filter((_, i) => soloConfigs.includes(i)) : CONFIGS;

const casoDe: Record<string, string> = { "2.2 parte 2": "voz-2-2b" };
const casos = new Map(leerCasos().map((c) => [c.id, c]));

async function transcribir(archivo: string, pista: string, idioma?: string) {
  const bytes = readFileSync(join(AUDIOS, archivo));
  const segundos = Number(Bun.spawnSync(["ffprobe", "-v", "error", "-show_entries", "format=duration",
    "-of", "csv=p=0", join(AUDIOS, archivo)]).stdout.toString()) || 0;
  const form = new FormData();
  form.append("file", new File([bytes], "audio.ogg", { type: "audio/ogg" }));
  form.append("audio_seconds", String(segundos));
  if (idioma) form.append("language", idioma);
  if (pista) form.append("prompt", pista);
  const res = await fetch(`${base.replace(/\/+$/, "")}/transcribe`, {
    method: "POST", headers: { authorization: `Bearer ${token}` }, body: form,
  });
  if (!res.ok) return { error: `http_${res.status}`, texto: "", proveedor: "" };
  const b = await res.json();
  return { error: "", texto: String(b.text ?? ""), proveedor: String(b.provider ?? "") };
}

const audios = readdirSync(AUDIOS).filter((f) => f.endsWith(".ogg")).sort();
const salida: any = { etiqueta, fecha: new Date().toISOString(), configs: {} };
console.log(`${audios.length} audios × ${aCorrer.length} configuraciones × ${repeticiones}\n`);

for (const cfg of aCorrer) {
  let mal = 0, datos = 0, inventos = 0, colados = 0, cortadas = 0;
  const detalle: any[] = [];
  for (const archivo of audios) {
    const nombre = archivo.replace(/\.ogg$/, "");
    const caso = casos.get(casoDe[nombre] ?? `voz-${nombre.replace(".", "-")}`) as Caso;
    for (let i = 0; i < repeticiones; i++) {
      const r = await transcribir(archivo, cfg.pista, cfg.idioma);
      if (r.error) { detalle.push({ audio: nombre, error: r.error }); continue; }
      const ev = revisar({ ...caso, crudo: r.texto });
      mal += ev.perdidos.length + ev.faltan.length; datos += ev.datos;
      inventos += ev.inventados.length; colados += ev.colados.length; cortadas += ev.cortadas.length;
      detalle.push({ audio: nombre, proveedor: r.proveedor, ...ev, texto: r.texto });
    }
  }
  salida.configs[cfg.nombre] = { mal, datos, inventos, colados, cortadas, detalle };
  const quien = new Map<string, number>();
  for (const d of detalle) if (d.proveedor) quien.set(d.proveedor, (quien.get(d.proveedor) ?? 0) + 1);
  console.log(`${cfg.nombre.padEnd(24)} datos mal ${String(mal).padStart(3)}/${datos} · números inventados ${inventos} · texto colado ${colados} · palabras cortadas ${cortadas}` +
    `  [${[...quien].map(([p, n]) => `${p} ${n}`).join(" · ")}]` +
    (detalle.some((d) => d.error) ? `  ⚠️ ${detalle.filter((d) => d.error).length} errores` : ""));
}

mkdirSync(join(AQUI, "resultados"), { recursive: true });
const archivo = join(AQUI, "resultados", `${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}-${etiqueta}.json`);
writeFileSync(archivo, JSON.stringify(salida, null, 2));
console.log(`\nGuardado en ${archivo.replace(AQUI, "voz")}`);

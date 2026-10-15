// Uso: bun pruebas-dictado/tiempos-servidor.ts <audio.ogg> [veces] [segundos de audio]
// Variables: PAUSA_MS (entre dictados), HABLA_MS (entre calentar y mandar), CON_TOKEN=1 (calentamiento
// con el token del equipo), REGION=sa-east-1 (fijar la región de la función). Usa el token del equipo
// de este Mac (gasta cupo) y audios del guion de pruebas (pacientes inventados).
// Mide /dictate como lo usa la app 0.9.3: tras una pausa, GET de calentamiento al "empezar a
// grabar", unos segundos "hablando" y el POST con el audio. Audio inventado del guion de pruebas.
import { readFileSync } from "node:fs";
const [audio, veces = "3", segs = "30"] = process.argv.slice(2);
const PAUSA = Number(process.env.PAUSA_MS ?? "45000");
const HABLA = Number(process.env.HABLA_MS ?? "5000");
const repo = "/Users/nicolaswalteros/Documents/Claude Code - Projects/CloseLabs Voice";
const src = readFileSync(`${repo}/src-tauri/src/settings.rs`, "utf8");
const prompt = JSON.parse(`"${src.match(/prompt: "(Eres un formateador[\s\S]*?)"\.to_string\(\)/)![1]}"`).replace("${output}", "").trim();
const store = JSON.parse(readFileSync(`${process.env.HOME}/Library/Application Support/com.closelabs.voice/settings_store.json`, "utf8"));
const s = store.settings ?? store;
const bytes = readFileSync(audio);
const totales: number[] = [];
for (let i = 0; i < Number(veces); i++) {
  if (i > 0) await new Promise((r) => setTimeout(r, PAUSA));
  const g = performance.now();
  const calentar = await fetch(`${s.proxy_base_url}/dictate`, { headers: process.env.CON_TOKEN ? { authorization: `Bearer ${s.device_token}` } : {} });
  await calentar.arrayBuffer();
  const gms = Math.round(performance.now() - g);
  await new Promise((r) => setTimeout(r, HABLA));
  const form = new FormData();
  form.append("file", new File([bytes], "audio.ogg", { type: "audio/ogg" }));
  form.append("audio_seconds", segs);
  form.append("language", "es");
  form.append("system_prompt", prompt);
  const t0 = performance.now();
  const res = await fetch(`${s.proxy_base_url}/dictate`, { method: "POST", headers: { authorization: `Bearer ${s.device_token}`, ...(process.env.REGION ? { "x-region": process.env.REGION } : {}) }, body: form });
  const j: any = await res.json();
  const total = Math.round(performance.now() - t0);
  totales.push(total);
  console.log(`${new Date().toISOString().slice(11, 19)} calentar ${calentar.status} ${gms} ms · dictado http ${res.status} total ${total} ms · servidor: ${res.headers.get("server-timing") ?? "(sin medición)"} · limpio ${j.text_final ? "sí" : "no"}`);
}
totales.sort((a, b) => a - b);
console.log(`mediana ${totales[Math.floor(totales.length / 2)]} ms · mejor ${totales[0]} · peor ${totales[totales.length - 1]}`);

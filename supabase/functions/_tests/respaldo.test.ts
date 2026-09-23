// CloseLabs Voice — prueba del respaldo AUTOMÁTICO entre proveedores.
//
// Corre la lógica REAL de `_shared/transcribe.ts` y `_shared/format.ts` contra un `fetch` falso
// que simula la base y tres proveedores (bien, saturado, caído, colgado, vacío, audio rechazado).
// Correrla antes de desplegar cualquier cambio a esos archivos:
//
//   bun supabase/functions/_tests/respaldo.test.ts
//
// Se usa Bun (no Deno) porque es lo que hay en la máquina de desarrollo; por eso el `Deno.env` de
// abajo es un reemplazo mínimo. La carpeta empieza por "_" y la CLI de Supabase no la despliega.
// decodeURIComponent: la carpeta del proyecto tiene espacios en el nombre.
const FN = decodeURIComponent(new URL("../_shared", import.meta.url).pathname);

const env: Record<string, string> = {
  SUPABASE_URL: "https://db.test",
  SUPABASE_SERVICE_ROLE_KEY: "x",
  GROQ_API_KEY: "g",
  DEEPINFRA_API_KEY: "d",
  OPENAI_API_KEY: "o",
};
(globalThis as any).Deno = { env: { get: (k: string) => env[k] } };

type Comportamiento = "ok" | "429" | "500" | "400" | "vacio" | "cuelga" | "400-siempre" | "truncado";
const conducta: Record<string, Comportamiento> = {};
let llamadas: string[] = [];

const proveedores = [
  { name: "groq", base_url: "https://groq.test", api_key_env: "GROQ_API_KEY", transcribe_model: "w", format_model: "f", format_reasoning_effort: null, supports_transcribe_prompt: true, enabled: true },
  { name: "deepinfra", base_url: "https://deepinfra.test", api_key_env: "DEEPINFRA_API_KEY", transcribe_model: "w", format_model: "f", format_reasoning_effort: "low", supports_transcribe_prompt: true, enabled: true },
  { name: "openai", base_url: "https://openai.test", api_key_env: "OPENAI_API_KEY", transcribe_model: "w", format_model: "f", format_reasoning_effort: null, supports_transcribe_prompt: true, enabled: true },
];

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });

globalThis.fetch = (async (input: any, init: any = {}) => {
  const url = String(input);
  if (url.includes("/rest/v1/app_config")) {
    return json([{ transcribe_provider: "groq", format_provider: "groq", transcribe_fallbacks: ["deepinfra", "openai"], format_fallbacks: ["deepinfra"], daily_quota: 500 }]);
  }
  if (url.includes("/rest/v1/providers")) return json(proveedores);
  if (url.includes("/rest/v1/")) return new Response(null, { status: 201 });

  const prov = new URL(url).hostname.split(".")[0];
  const tipo = url.endsWith("/audio/transcriptions") ? "T" : "F";
  llamadas.push(`${prov}:${tipo}`);
  const c = conducta[prov] ?? "ok";
  if (c === "cuelga") {
    return new Promise((_, rechazar) =>
      init.signal?.addEventListener("abort", () => rechazar(new DOMException("abort", "AbortError"))),
    );
  }
  if (c === "429") return json({ error: "x" }, 429);
  if (c === "500") return json({ error: "x" }, 500);
  if (c === "400" || c === "400-siempre") return json({ error: "x" }, 400);
  if (tipo === "T") return json({ text: c === "vacio" ? "" : `texto de ${prov}` });
  if (c === "truncado") {
    // Lo que devuelve de verdad un modelo al topar max_tokens con json_schema: HTTP 200,
    // finish_reason "length" y el JSON cortado a media cadena.
    return json({
      choices: [{ message: { content: '{"transcription":"Paciente de 58 anos con dolor torac' }, finish_reason: "length" }],
      usage: { prompt_tokens: 1800, completion_tokens: 8000 },
    });
  }
  return json({ choices: [{ message: { content: JSON.stringify({ transcription: `limpio por ${prov}` }) } }], finish_reason: "stop", usage: {} });
}) as typeof fetch;

const { transcribeAudio } = await import(`${FN}/transcribe.ts`);
const { formatText } = await import(`${FN}/format.ts`);

function audio(segundos: number) {
  const f = new FormData();
  f.append("file", new File([new Uint8Array(100)], "a.ogg"));
  f.append("audio_seconds", String(segundos));
  f.append("prompt", "metformina");
  return f;
}

let fallas = 0;
async function caso(nombre: string, c: Record<string, Comportamiento>, fn: () => Promise<any>, esperado: (r: any) => boolean, llamadasEsperadas: string[]) {
  for (const k of Object.keys(conducta)) delete conducta[k];
  Object.assign(conducta, c);
  llamadas = [];
  const t0 = performance.now();
  const r = await fn();
  const ms = Math.round(performance.now() - t0);
  const ok = esperado(r) && JSON.stringify(llamadas) === JSON.stringify(llamadasEsperadas);
  if (!ok) fallas++;
  const res = r.ok ? `ok ← ${r.provider}` : `falla ${r.code}/${r.status}`;
  console.log(`${ok ? "✅" : "❌"} ${nombre.padEnd(52)} ${res.padEnd(26)} [${llamadas.join(" → ")}] ${ms} ms`);
}

console.log("— TRANSCRIPCIÓN —");
await caso("principal bien: no toca el respaldo", {}, () => transcribeAudio("d1", audio(10)), (r) => r.ok && r.provider === "groq", ["groq:T"]);
await caso("Groq saturado (429) → DeepInfra", { groq: "429" }, () => transcribeAudio("d1", audio(10)), (r) => r.ok && r.provider === "deepinfra", ["groq:T", "deepinfra:T"]);
await caso("Groq caído (500) y DeepInfra 429 → OpenAI", { groq: "500", deepinfra: "429" }, () => transcribeAudio("d1", audio(10)), (r) => r.ok && r.provider === "openai", ["groq:T", "deepinfra:T", "openai:T"]);
await caso("audio rechazado (400): NO prueba otros (cadena Opus→FLAC)", { groq: "400" }, () => transcribeAudio("d1", audio(10)), (r) => !r.ok && r.code === "bad_request", ["groq:T"]);
await caso("vacío con 10 s de habla → sospechoso, prueba otro", { groq: "vacio" }, () => transcribeAudio("d1", audio(10)), (r) => r.ok && r.provider === "deepinfra", ["groq:T", "deepinfra:T"]);
await caso("vacío con 1 s → silencio real, no insiste", { groq: "vacio" }, () => transcribeAudio("d1", audio(1)), (r) => !r.ok && r.code === "empty_result", ["groq:T"]);
await caso("todos caídos → devuelve el último error", { groq: "429", deepinfra: "500", openai: "500" }, () => transcribeAudio("d1", audio(10)), (r) => !r.ok, ["groq:T", "deepinfra:T", "openai:T"]);
delete env.OPENAI_API_KEY;
await caso("respaldo sin llave: se salta sin tumbar nada", { groq: "429", deepinfra: "500" }, () => transcribeAudio("d1", audio(10)), (r) => !r.ok, ["groq:T", "deepinfra:T"]);
env.OPENAI_API_KEY = "o";
await caso("Groq COLGADO → corta a tiempo y responde DeepInfra", { groq: "cuelga" }, () => transcribeAudio("d1", audio(0)), (r) => r.ok && r.provider === "deepinfra", ["groq:T", "deepinfra:T"]);

console.log("— FORMATEO —");
await caso("principal bien", {}, () => formatText("d1", "hola", "prompt"), (r) => r.ok && r.provider === "groq", ["groq:F"]);
await caso("Groq 500 → DeepInfra", { groq: "500" }, () => formatText("d1", "hola", "prompt"), (r) => r.ok && r.provider === "deepinfra", ["groq:F", "deepinfra:F"]);
await caso("Groq no cierra el JSON 2 veces → DeepInfra", { groq: "400-siempre" }, () => formatText("d1", "hola", "prompt"), (r) => r.ok && r.provider === "deepinfra", ["groq:F", "groq:F", "deepinfra:F"]);
await caso("Groq COLGADO → DeepInfra dentro de los 30 s de la app", { groq: "cuelga" }, () => formatText("d1", "hola", "prompt"), (r) => r.ok && r.provider === "deepinfra", ["groq:F", "deepinfra:F"]);

// Regresión del 2026-09-22: el techo de salida en 2.000 tokens truncaba TODO dictado de más de
// ~73 s. Llegaba como HTTP 200 con el JSON a medias, se contaba como `empty_result` y se probaba
// un respaldo que sirve el mismo modelo y trunca igual. El médico recibía texto sin puntuar.
await caso("dictado que no cabe: truncado, NO prueba el respaldo", { groq: "truncado" }, () => formatText("d1", "hola", "prompt"), (r) => !r.ok && r.code === "truncated", ["groq:F"]);
await caso("truncado no se confunde con empty_result", { groq: "truncado", deepinfra: "truncado" }, () => formatText("d1", "hola", "prompt"), (r) => !r.ok && r.code === "truncated", ["groq:F"]);

console.log(fallas ? `\n❌ ${fallas} caso(s) fallaron` : "\n✅ todos los casos pasan");
process.exit(fallas ? 1 : 0);

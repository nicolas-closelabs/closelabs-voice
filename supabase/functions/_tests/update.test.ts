// CloseLabs Voice — pruebas de la función `update` (actualización automática).
//
//   bun supabase/functions/_tests/update.test.ts
//
// Lo que no se puede romper: ofrecer una versión vieja o la misma (bucle de reinstalación),
// ofrecerle a Mac algo sin archivos (sin firma de Apple pierde Accesibilidad), o fallar "hacia
// instalar" ante un error: ante cualquier duda, 204.

let handler: (req: Request) => Promise<Response>;
const env: Record<string, string> = { SUPABASE_URL: "https://db.test", SUPABASE_SERVICE_ROLE_KEY: "x" };
(globalThis as any).Deno = { env: { get: (k: string) => env[k] }, serve: (h: any) => { handler = h; } };

let latest: string | null = "0.9.1";
let archivos: Record<string, any> = {
  "windows-x86_64": { url: "https://github.test/CloseLabs.Voice_0.9.1_x64-setup.exe", signature: "firma-win" },
};
let baseCaida = false;

(globalThis as any).fetch = async (url: string) => {
  if (baseCaida) return new Response("caída", { status: 500 });
  const u = new URL(url);
  const j = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { "content-type": "application/json" } });
  if (u.pathname.endsWith("/app_config")) return j([{ version_automatica: latest }]);
  if (u.pathname.endsWith("/versiones")) {
    const v = u.searchParams.get("version")?.replace("eq.", "");
    // Solo la 0.9.1 está publicada (tiene fila en `versiones`).
    return j(v === "0.9.1" ? [{ version: v, notas: "Arreglos", publicada_at: "2026-10-07T00:00:00Z", archivos }] : []);
  }
  throw new Error(`fetch inesperado ${url}`);
};

const mod = await import("../update/index.ts");
const pedir = (q: string) => handler(new Request(`https://x.test/update?${q}`));

let fallos = 0, pasan = 0;
const ok = (c: unknown, n: string, d?: unknown) => { if (c) pasan++; else { fallos++; console.log("✗", n, d ?? ""); } };

ok(mod.esMasNueva("0.9.1", "0.9.0") && mod.esMasNueva("0.10.0", "0.9.9") && mod.esMasNueva("1.0.0", "0.99.99"), "compara números, no texto");
ok(!mod.esMasNueva("0.9.0", "0.9.0") && !mod.esMasNueva("0.8.4", "0.9.0"), "ni la misma ni una vieja");
ok(!mod.esMasNueva("basura", "0.9.0") && !mod.esMasNueva("0.9.1", ""), "versiones raras: no");
ok(mod.plataforma("darwin", "aarch64") === "darwin-universal" && mod.plataforma("darwin", "x86_64") === "darwin-universal", "Mac: un solo .app universal");
ok(mod.plataforma("windows", "x86_64") === "windows-x86_64" && mod.plataforma("windows", "aarch64") === null && mod.plataforma("linux", "x86_64") === null, "Windows x64 sí; ARM y Linux no");

let r = await pedir("target=windows&arch=x86_64&current_version=0.9.0");
const cuerpo = await r.json();
ok(r.status === 200 && cuerpo.version === "0.9.1" && cuerpo.signature === "firma-win" && cuerpo.url.endsWith(".exe"), "Windows 0.9.0 recibe la 0.9.1", cuerpo);
ok(typeof cuerpo.pub_date === "string" && cuerpo.notes === "Arreglos", "formato del updater de Tauri");

r = await pedir("target=windows&arch=x86_64&current_version=0.9.1");
ok(r.status === 204, "ya la tiene: 204 (nada de reinstalar en bucle)");
r = await pedir("target=windows&arch=x86_64&current_version=0.9.2");
ok(r.status === 204, "tiene una más nueva: 204 (nunca bajar de versión)");
r = await pedir("target=darwin&arch=aarch64&current_version=0.9.0");
ok(r.status === 204, "Mac sin archivos en la fila: 204");
archivos["darwin-universal"] = { url: "https://github.test/CloseLabs.Voice.app.tar.gz", signature: "firma-mac" };
r = await pedir("target=darwin&arch=x86_64&current_version=0.9.0");
ok(r.status === 200 && (await r.json()).signature === "firma-mac", "Mac con archivos (cuando haya firma): recibe");
r = await pedir("target=windows&arch=x86_64");
ok(r.status === 204, "sin versión actual: 204");
latest = null;
r = await pedir("target=windows&arch=x86_64&current_version=0.9.0");
ok(r.status === 204, "sin version_automatica: 204");
latest = "0.9.3";
r = await pedir("target=windows&arch=x86_64&current_version=0.9.0");
ok(r.status === 204, "version_automatica sin fila publicada: 204");
latest = "0.9.1"; baseCaida = true;
r = await pedir("target=windows&arch=x86_64&current_version=0.9.0");
ok(r.status === 204, "base caída: 204, nunca un error que la app interprete raro");

console.log(`\n${pasan} comprobaciones bien, ${fallos} mal`);
if (fallos) process.exit(1);

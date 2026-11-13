// Graba un video HTML determinista (con `window.pintar(t)` y `window.DURACION`) cuadro a cuadro.
// Sin dependencias: Google Chrome sin ventana por el protocolo de DevTools (WebSocket de Node) y
// ffmpeg para armar el MP4.
//
//   node diseno/herramientas/grabar-video.mjs <pagina.html> <salida.mp4> [--so win] [--fps 30]
//
// Se hizo así (2026-11-12) porque instalar la herramienta de video (npx hyperframes) quedó bloqueado.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const pagina = resolve(args[0]);
const salida = resolve(args[1]);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const so = opt("--so", "mac");
const fps = Number(opt("--fps", "30"));
const ANCHO = 1280, ALTO = 800;

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const perfil = mkdtempSync(join(tmpdir(), "grabar-"));
const puerto = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn(CHROME, [
  "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
  `--remote-debugging-port=${puerto}`, `--user-data-dir=${perfil}`, `--window-size=${ANCHO},${ALTO}`,
  "--allow-file-access-from-files", "about:blank",
], { stdio: "ignore" });

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
async function json(ruta, metodo = "GET") {
  for (let i = 0; i < 50; i++) {
    try { const r = await fetch(`http://127.0.0.1:${puerto}${ruta}`, { method: metodo }); return await r.json(); }
    catch { await espera(200); }
  }
  throw new Error("Chrome no respondió");
}

let ws, siguiente = 1;
const pendientes = new Map();
function cdp(method, params = {}) {
  const id = siguiente++;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((res, rej) => pendientes.set(id, { res, rej }));
}

try {
  await json("/json/version");
  const destino = await json("/json/new?about:blank", "PUT");
  ws = new WebSocket(destino.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pendientes.has(m.id)) {
      const p = pendientes.get(m.id); pendientes.delete(m.id);
      m.error ? p.rej(new Error(m.error.message)) : p.res(m.result);
    }
  });
  await cdp("Page.enable");
  await cdp("Emulation.setDeviceMetricsOverride", { width: ANCHO, height: ALTO, deviceScaleFactor: 1, mobile: false });
  const url = `${pathToFileURL(pagina).href}?grabar=1&so=${so}`;
  await cdp("Page.navigate", { url });
  // Que carguen las letras y el logo antes del primer cuadro.
  for (let i = 0; i < 60; i++) {
    const r = await cdp("Runtime.evaluate", { expression: "document.fonts.status === 'loaded' && typeof window.pintar === 'function'", returnByValue: true });
    if (r.result.value) break;
    await espera(100);
  }
  const dur = (await cdp("Runtime.evaluate", { expression: "window.DURACION", returnByValue: true })).result.value;
  const total = Math.round(dur * fps);

  const ff = spawn("ffmpeg", [
    "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fps), "-i", "-",
    "-c:v", "libx264", "-preset", "slow", "-crf", "26", "-pix_fmt", "yuv420p", "-movflags", "+faststart", salida,
  ], { stdio: ["pipe", "inherit", "inherit"] });

  for (let f = 0; f < total; f++) {
    const t = f / fps;
    await cdp("Runtime.evaluate", { expression: `window.pintar(${t}); document.querySelectorAll('img').length` , awaitPromise: false });
    const shot = await cdp("Page.captureScreenshot", { format: "jpeg", quality: 94, clip: { x: 0, y: 0, width: ANCHO, height: ALTO, scale: 1 } });
    if (!ff.stdin.write(Buffer.from(shot.data, "base64"))) await new Promise((r) => ff.stdin.once("drain", r));
    if (f % (fps * 5) === 0) process.stdout.write(`${Math.round((f / total) * 100)}% `);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on("close", r));
  console.log(`\nlisto: ${salida} (${total} cuadros, ${dur} s)`);
} finally {
  try { ws?.close(); } catch {}
  chrome.kill();
  await espera(300);
  rmSync(perfil, { recursive: true, force: true });
}

// CloseLabs Voice — ¿hay una actualización para esta app? (actualización automática de Tauri).
//
// La app lo pregunta al arrancar y cada pocas horas, con su plataforma y su versión
// (`plugins.updater.endpoints` en tauri.conf.json). Respuesta:
//   204            → nada que instalar.
//   200 + JSON     → { version, notes, pub_date, url, signature }, el formato del updater de Tauri.
//
// Se ofrece la versión de `app_config.version_automatica` (ver migración 20261007000004; es aparte de
// `latest_version`, que es el aviso con enlace): publicar o frenar una versión es cambiar esa fila. La firma la comprueba la APP con nuestra llave pública
// del updater; esta función solo dice dónde está el archivo.
//
// ⚠️ Ante cualquier duda, 204: una app que no se actualiza sigue dictando; una que instala algo raro
// no. Mac no recibe nada mientras su versión no tenga archivos (ver ACTUALIZACIONES.md).

import { json } from "../_shared/http.ts";
import { select } from "../_shared/db.ts";

/** "0.9.0" → [0, 9, 0]. `null` si no es una versión limpia. */
function partes(v: string | null): number[] | null {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec((v ?? "").trim().replace(/^v/, ""));
  return m ? m.slice(1).map(Number) : null;
}

export function esMasNueva(candidata: string, actual: string): boolean {
  const a = partes(candidata);
  const b = partes(actual);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}

/** La clave de `versiones.archivos` para lo que manda la app ({{target}} y {{arch}} de Tauri). */
export function plataforma(target: string | null, arch: string | null): string | null {
  if (target === "darwin") return "darwin-universal"; // un solo .app para Intel y Apple Silicon
  if (target === "windows" && arch === "x86_64") return "windows-x86_64";
  return null;
}

const nada = () => new Response(null, { status: 204 });

Deno.serve(async (req) => {
  if (req.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  const q = new URL(req.url).searchParams;
  const clave = plataforma(q.get("target"), q.get("arch"));
  const actual = q.get("current_version");
  if (!clave || !actual) return nada();

  try {
    const cfg = (await select<{ version_automatica: string | null }>("app_config", "select=version_automatica&limit=1"))[0];
    const ultima = cfg?.version_automatica ?? null;
    if (!ultima || !esMasNueva(ultima, actual)) return nada();

    const fila = (await select<{ version: string; notas: string | null; publicada_at: string; archivos: Record<string, { url: string; signature: string }> }>(
      "versiones",
      `select=version,notas,publicada_at,archivos&version=eq.${encodeURIComponent(ultima)}`,
    ))[0];
    const archivo = fila?.archivos?.[clave];
    if (!archivo?.url || !archivo?.signature) return nada();

    return json({
      version: fila.version,
      notes: fila.notas ?? "",
      pub_date: fila.publicada_at,
      url: archivo.url,
      signature: archivo.signature,
    });
  } catch (e) {
    console.error("update falló:", (e as Error).message);
    return nada();
  }
});

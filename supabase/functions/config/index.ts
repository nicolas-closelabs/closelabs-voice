// CloseLabs Voice — configuración que la app consulta al arrancar.
//
// Esto es el interruptor de emergencia. Hoy, si publicamos una versión con un fallo grave, no
// tenemos forma de avisarle a nadie: cada instalación sigue corriendo hasta que su dueño decida
// actualizar. Con esto, una fila de la base le dice a TODAS que hay algo nuevo —o que la versión
// que tienen ya no debe usarse.
//
// ⚠️ La app **falla hacia abierto**: si esta función se cae, se demora o responde cualquier cosa
// rara, el médico sigue dictando. Bloquear el dictado de un consultorio por un problema NUESTRO
// de servidor sería mucho peor que no avisar a tiempo.

import { json } from "../_shared/http.ts";
import { hashToken, touchDeviceByHash } from "../_shared/auth.ts";
import { loadAppConfig } from "../_shared/routing.ts";

Deno.serve(async (req) => {
  if (req.method !== "GET" && req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  // El token es OPCIONAL y aquí no autoriza nada: lo que devolvemos —qué versión es la última y
  // a dónde bajarla— no es secreto. Solo sirve para anotar que la instalación sigue viva, y por
  // eso una instalación revocada también recibe respuesta: necesita poder leer su aviso.
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (token) {
    const version = new URL(req.url).searchParams.get("app_version");
    touchDeviceByHash(await hashToken(token), version?.slice(0, 32) ?? null);
  }

  let config;
  try {
    config = await loadAppConfig();
  } catch (e) {
    console.error("no se pudo leer la configuración:", (e as Error).message);
    return json({ error: "provider_error" }, 503);
  }

  return json({
    min_supported_version: config.minSupportedVersion,
    latest_version: config.latestVersion,
    blocked_message: config.blockedMessage,
    download_url: config.downloadUrl,
    tutorial_url: config.tutorialUrl,
  });
});

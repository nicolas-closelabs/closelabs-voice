// CloseLabs Voice — ¿quien llama trae la llave de servicio del proyecto?
//
// Para lo que solo hacemos nosotros, nunca la app: disparar los recordatorios a mano, o que el banco
// de pruebas pida un proveedor específico (`x-proveedor-prueba` en /format).

import { fetchWithTimeout } from "./http.ts";

/**
 * ¿Es una llave de servicio del proyecto? Se prueba contra la base leyendo `app_config`, que solo
 * la llave de servicio puede leer. No se compara el texto: Supabase tiene dos formatos de llave
 * (el JWT de siempre y `sb_secret_…`) y la del entorno de la función puede ser la otra.
 */
export async function esLlaveDeServicio(llave: string): Promise<boolean> {
  if (!llave) return false;
  const res = await fetchWithTimeout(
    `${Deno.env.get("SUPABASE_URL")}/rest/v1/app_config?select=id&limit=1`,
    { headers: { apikey: llave, authorization: `Bearer ${llave}` } },
    10_000,
  ).catch(() => null);
  if (!res?.ok) return false;
  const filas = await res.json().catch(() => []);
  return Array.isArray(filas) && filas.length > 0;
}


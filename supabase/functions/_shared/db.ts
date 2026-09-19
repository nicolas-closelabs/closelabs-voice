// CloseLabs Voice — acceso a la base desde las Edge Functions.
//
// Se entra con la llave de servicio, que se salta la protección de filas. Es correcto justamente
// porque la app NUNCA habla con la base: solo con estas funciones. Toda decisión de permisos vive
// en el código de aquí, en un sitio, y no repartida en políticas SQL.

import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

let cached: SupabaseClient | null = null;

export function serviceClient(): SupabaseClient {
  if (cached) return cached;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  cached = createClient(url, key, { auth: { persistSession: false } });
  return cached;
}

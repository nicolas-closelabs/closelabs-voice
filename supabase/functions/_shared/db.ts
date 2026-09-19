// CloseLabs Voice — acceso mínimo a la base desde las Edge Functions.
//
// Se entra con la llave de servicio, que se salta la protección de filas. Es correcto justamente
// porque la app NUNCA habla con la base: solo con estas funciones. Toda decisión de permisos vive
// en el código de aquí, en un sitio, y no repartida en políticas SQL.
//
// ⚠️ Por qué NO se usa `@supabase/supabase-js`: medido el 2026-09-19, la función cargaba ~1,2 s de
// sobrecosto fijo por petición, incluso con audios de 3 segundos donde el proveedor solo tardaba
// 256 ms. Importar el cliente completo obliga a evaluar un módulo grande en cada arranque en frío
// del aislado, y de ese cliente usábamos tres operaciones. Esto son 40 líneas de `fetch` contra la
// misma API REST que usa la librería, sin dependencias que cargar.

const url = () => Deno.env.get("SUPABASE_URL") ?? "";
const key = () => Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function headers(extra: Record<string, string> = {}): HeadersInit {
  const k = key();
  return {
    apikey: k,
    authorization: `Bearer ${k}`,
    "content-type": "application/json",
    ...extra,
  };
}

async function call<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${url()}/rest/v1${path}`, init);
  if (!res.ok) {
    // El cuerpo puede nombrar columnas, nunca datos del dictado: es seguro registrarlo.
    throw new Error(`postgrest ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return res.status === 204 ? (null as T) : ((await res.json()) as T);
}

/** Llama a una función de la base. Devuelve la primera fila, o `null` si no hay ninguna. */
export async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T | null> {
  const rows = await call<T[] | T>(`/rpc/${fn}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(args),
  });
  if (Array.isArray(rows)) return rows[0] ?? null;
  return rows ?? null;
}

/** Igual que `rpc`, pero sin esperar la respuesta: para lo que no debe retrasar al médico. */
export function rpcDetached(fn: string, args: Record<string, unknown>): void {
  fetch(`${url()}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(args),
  }).catch(() => {});
}

/** Lee filas de una tabla. `query` va tal cual como parámetros de PostgREST. */
export function select<T>(table: string, query: string): Promise<T[]> {
  return call<T[]>(`/${table}?${query}`, { method: "GET", headers: headers() });
}

/** Inserta una fila. Con `returning` pide de vuelta las columnas que se necesiten. */
export async function insert<T>(
  table: string,
  row: Record<string, unknown>,
  returning?: string,
): Promise<T | null> {
  const prefer = returning ? "return=representation" : "return=minimal";
  const path = returning ? `/${table}?select=${returning}` : `/${table}`;
  const rows = await call<T[]>(path, {
    method: "POST",
    headers: headers({ prefer }),
    body: JSON.stringify(row),
  });
  return Array.isArray(rows) ? (rows[0] ?? null) : null;
}

/** Inserta sin esperar: el registro de uso no debe retrasar la respuesta al médico. */
export function insertDetached(table: string, row: Record<string, unknown>): void {
  fetch(`${url()}/rest/v1/${table}`, {
    method: "POST",
    headers: headers({ prefer: "return=minimal" }),
    body: JSON.stringify(row),
  }).catch((e) => console.error("no se pudo registrar el uso:", e?.message));
}

// CloseLabs Voice — utilidades HTTP compartidas por las Edge Functions.

import type { ErrorCode } from "./usage.ts";

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

/**
 * Error hacia la app. Se manda un CÓDIGO, no el texto del proveedor: sus mensajes suelen hacer
 * eco de la entrada, y la entrada aquí es el dictado de un paciente.
 */
export function fail(code: ErrorCode, status: number): Response {
  return json({ error: code }, status);
}

/**
 * Traduce el fallo de un proveedor a nuestro vocabulario cerrado. El texto original se queda en
 * los registros de la función, nunca viaja a la app ni a la base.
 */
export function classifyProviderError(status: number): ErrorCode {
  if (status === 429) return "rate_limit";
  if (status === 401 || status === 403) return "auth";
  if (status === 400 || status === 415 || status === 422) return "bad_request";
  return "provider_error";
}

/**
 * `fetch` con tope de tiempo. Lo aprendimos a golpes: la llamada al formateador NO tenía timeout
 * y un proveedor colgado congelaba el dictado sin salida. Bajo ráfaga medimos rezagados de ~38 s.
 * Pasado el tope preferimos devolver un error rápido y que la app pegue el texto crudo.
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const control = new AbortController();
  const timer = setTimeout(() => control.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: control.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function isAbort(e: unknown): boolean {
  return e instanceof DOMException && e.name === "AbortError";
}

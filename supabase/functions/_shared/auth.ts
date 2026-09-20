// CloseLabs Voice — identidad del dispositivo.
//
// En la Fase 1 todavía no hay cuentas de médico (eso es la Fase 2). La unidad de identidad es la
// INSTALACIÓN: cada una se registra una vez y guarda su token. La ganancia frente a hoy no es que
// el token sea imposible de extraer del programa —cualquier credencial que viaje dentro de la app
// lo es—, sino que **se puede revocar desde el servidor** sin tocar a nadie más. Hoy, con la llave
// de Groq incrustada, la única forma de cortar un abuso es recompilar y reinstalar en todas partes.

import { rpc, rpcDetached } from "./db.ts";

export interface Authorized {
  deviceId: string;
  usedToday: number;
  dailyQuota: number;
}

/**
 * Vocabulario CERRADO de por qué no se puede dictar. Lo decide la base en un solo sitio
 * (`authorize_device_v2`), no el borde: así la regla de quién puede dictar está escrita una vez.
 */
export type DenyReason =
  | "unauthorized"
  | "quota_exceeded"
  | "no_account"
  | "subscription_missing"
  | "trial_ended"
  | "subscription_inactive";

export type AuthResult =
  | { ok: true; device: Authorized }
  | { ok: false; reason: DenyReason };

/** SHA-256 en hexadecimal. La base guarda esto, nunca el token en claro. */
export async function hashToken(token: string): Promise<string> {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Token nuevo: 32 bytes de aleatoriedad criptográfica en base64url. */
export function newToken(): string {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...raw))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Caché de autorización en memoria de la instancia.
 *
 * Medido contra el proyecto real: el viaje del borde a la base cuesta ~0,4 s, y eso se pagaba en
 * CADA dictado para releer algo que casi nunca cambia. Con 30 s de caché, el médico que dicta
 * seguido solo lo paga la primera vez.
 *
 * Lo que cuesta: una instalación revocada puede seguir dictando hasta 30 s más, y el conteo de
 * cupo se queda corto durante ese rato. Con un cupo de 500 al día, colarse unos pocos no cambia
 * nada; y 30 segundos para cortarle el acceso a alguien es aceptable cuando la alternativa de
 * hoy —una llave dentro del programa— es *nunca*.
 */
const AUTH_CACHE_MS = 30_000;
const authCache = new Map<string, { at: number; result: AuthResult }>();

/**
 * Identifica al dispositivo y comprueba su cupo del día **en un solo viaje a la base**.
 *
 * Importa que sea uno solo: la función corre en el borde y la base está en São Paulo, así que
 * cada consulta cuesta cientos de milisegundos. Separar esto en tres llamadas añadía ~1 s a cada
 * dictado, que el médico siente.
 */
export async function authorize(req: Request): Promise<AuthResult> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { ok: false, reason: "unauthorized" };

  const hash = await hashToken(token);
  const hit = authCache.get(hash);
  if (hit && Date.now() - hit.at < AUTH_CACHE_MS) return hit.result;

  let data: {
    device_id: string | null;
    user_id: string | null;
    used_today: number;
    daily_quota: number;
    allowed: boolean;
    reason: DenyReason | null;
  } | null = null;
  try {
    // `authorize_device_v2` decide TODO: dispositivo, cupo del día, cuenta y suscripción, en una
    // sola ida a la base. Aquí no se vuelve a juzgar nada — solo se transporta su veredicto.
    data = await rpc("authorize_device_v2", { p_token_hash: hash });
  } catch (e) {
    console.error("autorización:", (e as Error).message);
  }

  let result: AuthResult;
  if (!data) {
    // Sin respuesta de la base no se inventa un permiso.
    result = { ok: false, reason: "unauthorized" };
  } else if (!data.allowed || !data.device_id) {
    result = { ok: false, reason: data.reason ?? "unauthorized" };
  } else {
    result = {
      ok: true,
      device: {
        deviceId: data.device_id,
        usedToday: data.used_today,
        dailyQuota: data.daily_quota,
      },
    };
  }

  // Cota de memoria: una instancia atiende pocas instalaciones a la vez, pero un atacante podría
  // inundarnos de tokens inventados. Al llegar al tope se vacía entera — es una caché, no un
  // registro: perderla solo cuesta una consulta.
  if (authCache.size > 1_000) authCache.clear();
  authCache.set(hash, { at: Date.now(), result });
  return result;
}

/** Marca la instalación como viva. No se espera: es estadística, no parte del dictado. */
export function touchDevice(deviceId: string): void {
  rpcDetached("touch_device", { p_device_id: deviceId });
}

/**
 * Igual, pero partiendo del hash del token, para `/config`, que no autoriza a nadie y por tanto
 * no conoce el `device_id`. Aprovecha para refrescar la versión instalada: es el único momento
 * en que la app nos dice qué versión está corriendo de verdad.
 */
export function touchDeviceByHash(tokenHash: string, appVersion?: string | null): void {
  rpcDetached("touch_device_by_hash", {
    p_token_hash: tokenHash,
    p_app_version: appVersion ?? null,
  });
}

// CloseLabs Voice — registro de uso y cuota.
//
// ⚠️ PRIVACIDAD: aquí NO entra ni el audio ni el texto del dictado, ni siquiera un fragmento.
// Son datos de pacientes y lo que no se guarda no se filtra. Se anota cuánto, cuánto tardó y si
// salió bien. Los fallos se marcan con un código corto NUESTRO, nunca con el texto que devolvió
// el proveedor, porque las APIs suelen hacer eco de la entrada en sus mensajes de error.

import { serviceClient } from "./db.ts";
import type { Kind } from "./routing.ts";

export interface UsageRecord {
  deviceId: string;
  kind: Kind;
  provider: string;
  model?: string;
  audioSeconds?: number;
  tokensIn?: number;
  tokensOut?: number;
  latencyMs: number;
  ok: boolean;
  errorCode?: ErrorCode;
}

/** Vocabulario cerrado de fallos. Si no está aquí, no se guarda. */
export type ErrorCode =
  | "rate_limit"
  | "timeout"
  | "provider_error"
  | "bad_request"
  | "auth"
  | "empty_result"
  | "quota_exceeded";

export async function logUsage(u: UsageRecord): Promise<void> {
  const db = serviceClient();
  const { error } = await db.from("usage_events").insert({
    device_id: u.deviceId,
    kind: u.kind,
    provider: u.provider,
    model: u.model ?? null,
    audio_seconds: u.audioSeconds ?? null,
    tokens_in: u.tokensIn ?? null,
    tokens_out: u.tokensOut ?? null,
    latency_ms: Math.round(u.latencyMs),
    ok: u.ok,
    error_code: u.errorCode ?? null,
  });
  // Que falle el registro no debe tumbar un dictado que ya salió bien: el médico está esperando
  // su texto, no nuestras estadísticas.
  if (error) console.error("no se pudo registrar el uso:", error.message);
}

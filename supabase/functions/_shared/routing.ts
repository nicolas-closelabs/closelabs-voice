// CloseLabs Voice — a qué proveedor va cada petición.
//
// Esta es la razón de ser de toda la Fase 1. Hoy el proveedor está escrito dentro del programa
// instalado: cambiarlo obliga a recompilar y reinstalar en el computador de cada médico. Aquí es
// una fila en `app_config`, así que el día que Groq nos cierre la puerta o se caiga, se edita esa
// fila y TODAS las instalaciones obedecen en el siguiente dictado.

import { select } from "./db.ts";

export type Kind = "transcribe" | "format";

export interface Route {
  provider: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  /** Solo para formatear: 'low' | 'medium' | 'high'. Ver nota en la migración. */
  reasoningEffort: string | null;
  /**
   * Solo para formatear. `true` = modelo de razonamiento de OpenAI (gpt-5 en adelante), que la
   * API directa trata distinto: rechaza `temperature` y exige el techo en
   * `max_completion_tokens` en vez de `max_tokens` — las dos cosas con un 400. Por OpenRouter no
   * se notaba porque traduce los parámetros; directo a OpenAI, cada dictado fallaba y lo salvaba
   * el respaldo sin que nadie se enterara. Ver la migración 20260924000005.
   */
  reasoningModel: boolean;
  extraBody: Record<string, unknown> | null;
  /**
   * Solo para transcribir. ⚠️ Medido el 2026-09-19: el Whisper turbo de DeepInfra DEVUELVE LA
   * TRANSCRIPCIÓN VACÍA cuando la pista de vocabulario pasa de ~150 caracteres, y con pistas
   * medianas la TRUNCA EN SILENCIO — media historia clínica sin que el médico se entere. Por eso
   * es un dato por proveedor: si es `false`, la pista NO se manda, aunque el médico tenga
   * diccionario. Perder la ayuda del diccionario es malo; perder medio dictado es inaceptable.
   */
  supportsTranscribePrompt: boolean;
  dailyQuota: number;
}

export interface AppConfig {
  /** En true, la app exige cuenta para dictar en la nube. Ver la migración 20260920000003. */
  requireAccount: boolean;
  minSupportedVersion: string;
  /** Última publicada. Nulo = no avisar. Ver la migración: es el aviso suave, no el bloqueo. */
  latestVersion: string | null;
  blockedMessage: string;
  downloadUrl: string;
  tutorialUrl: string | null;
}

/**
 * El ruteo se guarda en memoria durante `CACHE_MS`. Son dos consultas que, desde el borde hasta
 * São Paulo, costaban cientos de milisegundos en CADA dictado, para leer algo que cambia una vez
 * cada varios meses.
 *
 * El precio de la caché es la demora en obedecer: cambiar de proveedor en `app_config` tarda
 * hasta un minuto en llegar a todas las instancias. Es un intercambio deliberado — un minuto es
 * nada comparado con las horas que tomaba antes, cuando había que recompilar y reinstalar.
 */
const CACHE_MS = 60_000;
let cache: { at: number; cfg: RoutingConfig } | null = null;

interface RoutingConfig {
  transcribeProvider: string;
  formatProvider: string;
  /** Respaldo, en orden. Ver `resolveRoutes`. */
  transcribeFallbacks: string[];
  formatFallbacks: string[];
  dailyQuota: number;
  /** Prompt de limpieza guardado en la base; manda sobre el que envía la app. */
  formatPrompt: string | null;
  providers: Record<string, ProviderRow>;
}

interface ProviderRow {
  name: string;
  base_url: string;
  api_key_env: string;
  transcribe_model: string | null;
  format_model: string | null;
  format_reasoning_effort: string | null;
  format_reasoning_model: boolean | null;
  supports_transcribe_prompt: boolean;
  enabled: boolean;
  /** Campos extra del cuerpo. Hoy solo OpenRouter: elige qué servidor sirve el modelo. */
  extra_body: Record<string, unknown> | null;
}

async function routingConfig(): Promise<RoutingConfig> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.cfg;

  const [cfgRows, provRows] = await Promise.all([
    select<{
      transcribe_provider: string;
      format_provider: string;
      transcribe_fallbacks: string[] | null;
      format_fallbacks: string[] | null;
      daily_quota: number;
      format_prompt: string | null;
    }>(
      "app_config",
      "select=transcribe_provider,format_provider,transcribe_fallbacks,format_fallbacks,daily_quota,format_prompt&limit=1",
    ),
    select<ProviderRow>(
      "providers",
      "select=name,base_url,api_key_env,transcribe_model,format_model,format_reasoning_effort,format_reasoning_model,supports_transcribe_prompt,enabled,extra_body",
    ),
  ]);
  const row = cfgRows[0];
  if (!row) throw new Error("no se pudo leer app_config");

  const providers: Record<string, ProviderRow> = {};
  for (const p of provRows) providers[p.name] = p;

  const cfg: RoutingConfig = {
    transcribeProvider: row.transcribe_provider,
    formatProvider: row.format_provider,
    transcribeFallbacks: row.transcribe_fallbacks ?? [],
    formatFallbacks: row.format_fallbacks ?? [],
    dailyQuota: row.daily_quota,
    formatPrompt: row.format_prompt,
    providers,
  };
  cache = { at: Date.now(), cfg };
  return cfg;
}

/** Arma la ruta de UN proveedor, con su llave sacada de los secretos. */
function buildRoute(cfg: RoutingConfig, kind: Kind, name: string): Route {
  const p = cfg.providers[name];
  if (!p) throw new Error(`proveedor '${name}' no existe`);
  if (!p.enabled) throw new Error(`proveedor '${name}' está deshabilitado`);

  // La llave nunca está en la base: solo el NOMBRE del secreto que la guarda.
  const apiKey = Deno.env.get(p.api_key_env);
  if (!apiKey) throw new Error(`falta el secreto ${p.api_key_env}`);

  const model = kind === "transcribe" ? p.transcribe_model : p.format_model;
  if (!model) throw new Error(`'${name}' no tiene modelo para ${kind}`);

  return {
    provider: p.name,
    baseUrl: p.base_url.replace(/\/+$/, ""),
    apiKey,
    model,
    reasoningEffort: p.format_reasoning_effort,
    reasoningModel: p.format_reasoning_model === true,
    extraBody: p.extra_body ?? null,
    supportsTranscribePrompt: p.supports_transcribe_prompt,
    dailyQuota: cfg.dailyQuota,
  };
}

/**
 * Los proveedores a los que se puede mandar `kind`, EN ORDEN: el principal y después su respaldo.
 *
 * ⚠️ Esto es el respaldo AUTOMÁTICO. Antes había un solo proveedor por tipo y cambiarlo era
 * manual: si el principal se caía a media mañana, TODOS los dictados fallaban hasta que alguien
 * viera la alerta (hasta 15 min) y editara `app_config`. Ahora quien llama prueba el siguiente de
 * la lista dentro del mismo dictado, y el médico solo espera un poco más.
 *
 * Un respaldo mal configurado (sin llave, deshabilitado, sin modelo) se salta con un aviso en los
 * registros en vez de tumbar la petición: el principal puede estar perfecto. Solo falla si no
 * queda ninguno utilizable.
 */
export async function resolveRoutes(kind: Kind): Promise<Route[]> {
  const cfg = await routingConfig();
  const principal = kind === "transcribe" ? cfg.transcribeProvider : cfg.formatProvider;
  const respaldo = kind === "transcribe" ? cfg.transcribeFallbacks : cfg.formatFallbacks;

  const nombres = [...new Set([principal, ...respaldo].filter(Boolean))];
  const rutas: Route[] = [];
  const problemas: string[] = [];
  for (const nombre of nombres) {
    try {
      rutas.push(buildRoute(cfg, kind, nombre));
    } catch (e) {
      problemas.push((e as Error).message);
    }
  }
  if (problemas.length) console.warn(`ruteo ${kind}: ${problemas.join("; ")}`);
  if (!rutas.length) throw new Error(`ningún proveedor utilizable para ${kind}`);
  return rutas;
}

/** Configuración que la app consulta al arrancar (versión mínima, URLs). */
export async function loadAppConfig(): Promise<AppConfig> {
  const rows = await select<{
    require_account: boolean;
    min_supported_version: string;
    latest_version: string | null;
    blocked_message: string;
    download_url: string;
    tutorial_url: string | null;
  }>(
    "app_config",
    "select=require_account,min_supported_version,latest_version,blocked_message,download_url,tutorial_url&limit=1",
  );
  const data = rows[0];
  if (!data) throw new Error("no se pudo leer app_config");
  return {
    requireAccount: data.require_account,
    minSupportedVersion: data.min_supported_version,
    latestVersion: data.latest_version,
    blockedMessage: data.blocked_message,
    downloadUrl: data.download_url,
    tutorialUrl: data.tutorial_url,
  };
}

/** El prompt de limpieza que manda: el de la base si está puesto, si no el que envió la app. */
export async function promptDeFormateo(delCliente: string): Promise<string> {
  try {
    const cfg = await routingConfig();
    const guardado = cfg.formatPrompt?.trim();
    return guardado ? guardado : delCliente;
  } catch {
    return delCliente;
  }
}

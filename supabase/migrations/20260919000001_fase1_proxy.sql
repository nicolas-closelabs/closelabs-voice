-- CloseLabs Voice — Fase 1: base del proxy.
--
-- Qué resuelve: hoy la llave de Groq viaja DENTRO del programa instalado, así que es extraíble y
-- cambiar de proveedor obliga a republicar la app en el computador de cada médico. A partir de
-- aquí la llave vive solo en el servidor y el proveedor es un dato en una tabla.
--
-- Todavía NO hay cuentas de usuario (eso es la Fase 2). La unidad de identidad es el DISPOSITIVO:
-- cada instalación se registra y pide su propio token. Un token filtrado se revoca desde el
-- servidor sin tocar a nadie más, que es justo lo que hoy no podemos hacer con la llave de Groq.

-- ---------------------------------------------------------------------------------------------
-- Configuración remota
-- ---------------------------------------------------------------------------------------------
-- Una sola fila. Permite apagar una versión vieja, avisar de mantenimiento y —lo más importante
-- para nosotros— CAMBIAR DE PROVEEDOR sin publicar una versión nueva de la app.
create table public.app_config (
  id                    boolean primary key default true,
  -- Versiones por debajo de esta ven un aviso de actualización obligatoria.
  min_supported_version text        not null default '0.5.0',
  -- Mensaje para mostrar al médico cuando su versión quedó bloqueada.
  blocked_message       text        not null default 'Esta versión ya no está disponible. Actualiza para seguir dictando.',
  download_url          text        not null default 'https://closelabs.co/voice',
  tutorial_url          text,
  -- Ruteo de proveedores. Cambiar estos valores redirige a TODAS las instalaciones al instante.
  -- Los nombres deben coincidir con las claves de `providers`.
  transcribe_provider   text        not null default 'groq',
  format_provider       text        not null default 'groq',
  -- Cuántos dictados al día permite un dispositivo. Frena una llave filtrada antes de que nos
  -- vacíe la cuenta del proveedor.
  daily_quota           integer     not null default 500,
  updated_at            timestamptz not null default now(),
  constraint app_config_single_row check (id)
);

insert into public.app_config (id) values (true);

-- ---------------------------------------------------------------------------------------------
-- Proveedores
-- ---------------------------------------------------------------------------------------------
-- La URL y el modelo viven aquí; la LLAVE nunca (esa va en los secretos de la Edge Function, que
-- ni siquiera un administrador de la base puede leer desde aquí).
create table public.providers (
  name          text primary key,
  base_url      text    not null,
  -- Nombre del secreto que guarda la llave, p. ej. 'GROQ_API_KEY'.
  api_key_env   text    not null,
  transcribe_model text,
  format_model     text,
  -- gpt-oss admite 'low' | 'medium' | 'high'. Medido el 2026-09-19: en DeepInfra 'low' acierta
  -- 16/16 en 1,66 s; en Groq empeora los errores 400, por eso allá va nulo.
  format_reasoning_effort text,
  -- Whisper acepta una pista de vocabulario ("prompt") con el diccionario del médico. ⚠️ El turbo
  -- de DeepInfra DEVUELVE LA TRANSCRIPCIÓN VACÍA cuando la pista pasa de ~150 caracteres, y con
  -- pistas medianas la trunca EN SILENCIO. Por eso es un dato por proveedor y no una suposición.
  supports_transcribe_prompt boolean not null default true,
  enabled       boolean not null default true,
  created_at    timestamptz not null default now()
);

insert into public.providers
  (name, base_url, api_key_env, transcribe_model, format_model, format_reasoning_effort, supports_transcribe_prompt)
values
  ('groq', 'https://api.groq.com/openai/v1', 'GROQ_API_KEY',
   'whisper-large-v3-turbo', 'openai/gpt-oss-20b', null, true),
  -- Reemplazo ya medido contra la API real. Su Whisper NO sirve (ver nota de arriba), así que
  -- solo se usa para formatear: 16/16 aciertos, 1,66 s, cero errores 400.
  ('deepinfra', 'https://api.deepinfra.com/v1/openai', 'DEEPINFRA_API_KEY',
   'openai/whisper-large-v3', 'openai/gpt-oss-20b', 'low', false);

-- ---------------------------------------------------------------------------------------------
-- Dispositivos
-- ---------------------------------------------------------------------------------------------
create table public.devices (
  id           uuid primary key default gen_random_uuid(),
  -- Hash del token, nunca el token. Si alguien se lleva la base, no se lleva las credenciales.
  token_hash   text        not null unique,
  platform     text,
  app_version  text,
  -- Se apaga para cortarle el acceso a una instalación concreta sin tocar a las demás.
  revoked      boolean     not null default false,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index devices_last_seen_idx on public.devices (last_seen_at desc);

-- ---------------------------------------------------------------------------------------------
-- Uso
-- ---------------------------------------------------------------------------------------------
-- ⚠️ PRIVACIDAD: aquí NO entra ni el audio ni el texto del dictado. Solo cuánto y cuánto tardó.
-- Son datos de pacientes: lo que no se guarda no se filtra.
create table public.usage_events (
  id            bigserial primary key,
  device_id     uuid        not null references public.devices (id) on delete cascade,
  kind          text        not null check (kind in ('transcribe', 'format')),
  provider      text        not null,
  model         text,
  -- Según el tipo: segundos de audio, o tokens de entrada y salida.
  audio_seconds numeric,
  tokens_in     integer,
  tokens_out    integer,
  latency_ms    integer,
  ok            boolean     not null,
  -- Código corto del fallo ('rate_limit', 'timeout', 'provider_400'…), nunca el texto del error
  -- del proveedor, que podría traer fragmentos del dictado.
  error_code    text,
  created_at    timestamptz not null default now()
);

create index usage_events_device_day_idx on public.usage_events (device_id, created_at desc);
create index usage_events_created_idx on public.usage_events (created_at desc);

-- ---------------------------------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------------------------------
-- Todo cerrado por defecto. Las Edge Functions entran con la llave de servicio, que se salta RLS;
-- la app NUNCA habla con la base directamente, solo con las funciones. Sin políticas de lectura,
-- una llave anónima filtrada no sirve para nada.
alter table public.app_config    enable row level security;
alter table public.providers     enable row level security;
alter table public.devices       enable row level security;
alter table public.usage_events  enable row level security;

-- ---------------------------------------------------------------------------------------------
-- Cuota diaria
-- ---------------------------------------------------------------------------------------------
-- Se cuenta solo lo que salió bien: si el proveedor falla, no le gastamos el cupo al médico.
create function public.device_usage_today (p_device_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.usage_events
  where device_id = p_device_id
    and ok
    and created_at >= date_trunc('day', now());
$$;

-- CloseLabs Voice — respaldo AUTOMÁTICO entre proveedores.
--
-- Hasta aquí había un proveedor por tipo, y cambiarlo era manual: si el principal se caía a media
-- mañana, TODOS los dictados fallaban hasta que alguien viera la alerta (hasta 15 minutos) y
-- editara `app_config`. Con 5 testers es un detalle; con 20 médicos pagando es una mañana sin
-- servicio.
--
-- Ahora cada tipo tiene una lista ORDENADA de respaldo. Si el principal falla —caído, saturado,
-- colgado o con la llave rota—, el servidor prueba el siguiente dentro del MISMO dictado. El médico
-- espera un segundo más y no se entera. La lógica y sus límites de tiempo están en
-- `_shared/transcribe.ts` y `_shared/format.ts`.
--
-- Beneficio lateral: el techo del plan gratis de Groq (~6 dictados por minuto entre TODOS los
-- médicos) deja de tumbar dictados. Lo que Groq rechaza con 429 lo atiende DeepInfra.
--
-- Cambiar el orden o el principal sigue siendo una línea:
--   update app_config set transcribe_provider = 'openai', transcribe_fallbacks = '{deepinfra,groq}';

alter table public.app_config
  add column if not exists transcribe_fallbacks text[] not null default '{}',
  add column if not exists format_fallbacks     text[] not null default '{}';

comment on column public.app_config.transcribe_fallbacks is
  'Proveedores de respaldo para transcribir, EN ORDEN. Se prueban si el principal falla (caída, 429, 5xx, timeout, llave rota, o vacío con 3+ s de audio). NO se prueban ante bad_request: la app tiene su propia cadena Opus → FLAC → WAV que depende de ese código.';
comment on column public.app_config.format_fallbacks is
  'Proveedores de respaldo para formatear, EN ORDEN. Cualquier fallo pasa al siguiente; si no queda ninguno, la app pega el texto crudo.';

-- Transcribir: los dos plan B medidos con voz real el 2026-09-20 (ver migración 20260920000001).
-- DeepInfra primero: más barato y ya probado con el diccionario. OpenAI al final: la mejor calidad
-- medida, y no es Whisper — si el problema es del propio Whisper, OpenAI no lo arrastra.
--
-- Formatear: solo DeepInfra, que acertó 16/16 con cero errores de JSON (BACKLOG, 2026-09-19).
-- `gpt-4o-mini` de OpenAI NO se pone de respaldo porque no se ha medido con nuestros casos
-- clínicos, y un formateador que parafrasea es peor que el texto crudo.
update public.app_config
   set transcribe_fallbacks = '{deepinfra,openai}',
       format_fallbacks     = '{deepinfra}';

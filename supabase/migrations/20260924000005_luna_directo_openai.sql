-- gpt-6-luna DIRECTO a OpenAI (2026-09-24), para medirlo sin los límites de OpenRouter.
--
-- Lo medido por OpenRouter (migraciones 000003 y 000004), con el banco y `usage_events`:
--
--                        salida/dictado   costo/dictado   latencia   rechazos 429
--   gpt-4o-mini                208         $0,000784        940 ms       0 de 200
--   luna sin esfuerzo          741         $0,000812      2.734 ms      11 de 28
--   luna esfuerzo 'low'        226         $0,000439      2.403 ms      19 de 32
--
-- Sin esfuerzo declarado, el razonamiento se come el ahorro (3x los tokens de salida). Con 'low'
-- el ahorro real es ~44%. Pero OpenRouter rechazó la MITAD de las llamadas con 429, con un solo
-- equipo usándolo, y el respaldo las recogió: el 41/42 del banco mezclaba los dos modelos. No es
-- una medición de luna. Por eso se repite directo contra OpenAI, con los límites de NUESTRA
-- cuenta — los mismos con los que gpt-4o-mini sirvió 200 llamadas sin un solo 429 — y con el
-- banco en modo `--proveedor openai-luna`, que deja fuera de la nota lo que sirva el respaldo.
--
-- ⚠️ Directo a OpenAI, un modelo de razonamiento rechaza con 400 `temperature` y `max_tokens`.
-- `format_reasoning_model` le dice al proxy que no los mande (y ponga el techo en
-- `max_completion_tokens`). OpenRouter traducía esos parámetros por nosotros; OpenAI no.
--
-- ⚠️ ORDEN: esta migración ANTES que el código (el código nuevo lee la columna; al revés, fallan
-- todos los dictados). Entre esta migración y el despliegue, el código viejo le manda
-- `temperature` a luna, recibe 400 y el respaldo (gpt-4o-mini) sirve el dictado: más lento, igual
-- de correcto. Por eso se aplican seguidas.
alter table public.providers
  add column if not exists format_reasoning_model boolean not null default false;

comment on column public.providers.format_reasoning_model is
  'true = modelo de razonamiento de OpenAI (gpt-5 en adelante): sin temperature y con el techo en max_completion_tokens. La API directa rechaza lo contrario con 400.';

insert into public.providers
  (name, base_url, api_key_env, transcribe_model, format_model, format_reasoning_effort,
   format_reasoning_model, supports_transcribe_prompt, enabled, extra_body)
values
  ('openai-luna', 'https://api.openai.com/v1', 'OPENAI_API_KEY',
   null, 'gpt-6-luna', 'low', true, false, true, null)
on conflict (name) do update
  set base_url                = excluded.base_url,
      format_model            = excluded.format_model,
      format_reasoning_effort = excluded.format_reasoning_effort,
      format_reasoning_model  = excluded.format_reasoning_model,
      enabled                 = true;

-- La fila por OpenRouter se conserva, con lo que se midió, pero sin uso.
update public.providers set enabled = false where name = 'openrouter-luna';

-- gpt-4o-mini sigue de PRIMER respaldo: si luna falla, el médico recibe lo mismo que ayer.
update app_config
   set format_provider  = 'openai-luna',
       format_fallbacks = '{openai,openrouter,groq}',
       updated_at       = now();

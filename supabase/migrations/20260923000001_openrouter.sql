-- OpenRouter como proveedor de formateo (2026-09-23).
--
-- Por qué: Groq es el que mejor formatea y el más rápido (1,4 s), pero su plan gratis tiene un
-- techo de tokens por minuto para TODA la cuenta (~6 dictados por minuto entre todos los médicos)
-- y los upgrades a plan pago siguen pausados. OpenRouter vende el MISMO modelo servido por Groq,
-- sin tope de peticiones por cuenta, a ~$0,0002 por dictado. Es el camino a producción.
--
-- `extra_body` existe por esto: OpenRouter necesita un objeto `provider` en el cuerpo para elegir
-- quién sirve el modelo. Se guarda en la base para poder cambiar de proveedor servidor —o de
-- política de datos— sin tocar código, igual que el resto del ruteo.
alter table public.providers add column if not exists extra_body jsonb;

comment on column public.providers.extra_body is
  'Campos extra que se mezclan en el cuerpo de la petición. Hoy solo OpenRouter lo usa.';

insert into public.providers
  (name, base_url, api_key_env, transcribe_model, format_model, format_reasoning_effort,
   supports_transcribe_prompt, enabled, extra_body)
values
  ('openrouter', 'https://openrouter.ai/api/v1', 'OPENROUTER_API_KEY',
   -- OpenRouter no ofrece transcripción de audio: solo formatea.
   null, 'openai/gpt-oss-20b', null, false, true,
   -- `order` + `allow_fallbacks:false`: queremos EXACTAMENTE Groq. Si OpenRouter escogiera otro
   -- servidor, cambiarían la velocidad y la calidad sin que nos enteremos, y nuestro propio
   -- respaldo ya cubre el caso de que Groq falle.
   -- `data_collection: deny`: nunca un servidor que se quede con el dictado para entrenar.
   jsonb_build_object(
     'provider', jsonb_build_object(
       'order', jsonb_build_array('groq'),
       'allow_fallbacks', false,
       'data_collection', 'deny'
     )
   ))
on conflict (name) do update
  set base_url = excluded.base_url,
      api_key_env = excluded.api_key_env,
      format_model = excluded.format_model,
      extra_body = excluded.extra_body,
      enabled = true;

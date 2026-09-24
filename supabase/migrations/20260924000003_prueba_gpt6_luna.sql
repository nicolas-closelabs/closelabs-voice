-- EXPERIMENTO (2026-09-24): ¿formatea mejor y más barato `gpt-6-luna` que `gpt-4o-mini`?
--
-- Precio de lista: 0,10/0,50 por millón contra 0,15/0,60 de gpt-4o-mini. Más barato, sí, pero el
-- precio NO decide: decide el banco. Esta migración solo deja la fila y pone el modelo de
-- principal para poder medirlo; el resultado se fija (o se revierte) en la migración siguiente.
--
-- ⚠️ Y el precio de lista puede mentir: luna RAZONA, y el razonamiento se cobra como salida.
-- Calculado sobre nuestro prompt real (1.588 tokens, repetido en cada trozo), luna deja de ser
-- más barato si gasta más de ~3x el texto que escribe. Referencia: gpt-oss-20b gastaba 75x.
--
-- ⚠️ `order: ['openai'] + allow_fallbacks: false` NO es paranoia: de los siete servidores que
-- sirven este modelo en OpenRouter, **Azure y Bedrock no aceptan `response_format`**, que es como
-- pedimos la salida con esquema. Si OpenRouter escogiera uno de esos, el modo estricto se caería
-- en silencio y solo lo veríamos como fallos intermitentes. `openai/flex` cuesta la mitad pero es
-- procesamiento diferido: inservible para un médico esperando su texto.
--
-- ⚠️ Va por OpenRouter y no directo a OpenAI por una razón de código: `llamar()` manda
-- `temperature: 0` en cada petición y este modelo NO acepta `temperature` (razona, no muestrea).
-- OpenRouter filtra los parámetros que el modelo no soporta; la API de OpenAI los rechaza con 400.
-- Si el modelo gana la medición, hay que hacer que el proxy no mande `temperature` a quien no la
-- acepta ANTES de pasarlo a la vía directa, que es la barata (OpenRouter cobra 5,5% del saldo).
insert into public.providers
  (name, base_url, api_key_env, transcribe_model, format_model, format_reasoning_effort,
   supports_transcribe_prompt, enabled, extra_body)
values
  ('openrouter-luna', 'https://openrouter.ai/api/v1', 'OPENROUTER_API_KEY',
   null, 'openai/gpt-6-luna', null, false, true,
   jsonb_build_object(
     'provider', jsonb_build_object(
       'order', jsonb_build_array('openai'),
       'allow_fallbacks', false,
       'data_collection', 'deny'
     )
   ))
on conflict (name) do update
  set format_model = excluded.format_model,
      extra_body   = excluded.extra_body,
      enabled      = true;

-- gpt-4o-mini queda de PRIMER respaldo: mientras se mide, un fallo de luna le entrega al médico
-- exactamente lo que recibe hoy.
update app_config
   set format_provider  = 'openrouter-luna',
       format_fallbacks = '{openai,openrouter,groq}',
       updated_at       = now();

-- EXPERIMENTO (2026-10-04): transcribir con `gpt-transcribe` (OpenAI, julio de 2026, $0,0045/min).
--
-- Por qué: con la voz de un médico real, `gpt-4o-mini-transcribe` deja ~7,6% de los datos del
-- guion mal: ortografía de medicamentos ("en abril" por enalapril, "leopirina" por dipirona) y
-- sustituciones en el dictado rápido (hemograma → hemoglobina). gpt-transcribe promete la mitad de
-- errores que whisper-1 y acepta `keywords` con los términos esperados.
--
-- Paso 1 (esta migración): el modelo TAL CUAL, con los mismos campos que hoy (`prompt`), para saber
-- (a) si acepta el Ogg/Opus que sube la app —su documentación no lo menciona— y (b) cuánto mejora
-- solo. Las `keywords` vienen después, si este paso vale la pena.
--
-- gpt-4o-mini-transcribe queda de PRIMER respaldo. Se revierte (o se fija) con la siguiente.
-- ⚠️ Un 400 por formato NO pasa al respaldo (es la señal que usa la app para bajar a FLAC/WAV):
-- si gpt-transcribe rechaza el Opus, el banco lo verá como error y la app de un médico bajaría de
-- escalón. Por eso la prueba es corta y con nadie más dictando.
insert into public.providers
  (name, base_url, api_key_env, transcribe_model, format_model, format_reasoning_effort,
   supports_transcribe_prompt, enabled, extra_body)
values
  ('openai-transcribe', 'https://api.openai.com/v1', 'OPENAI_API_KEY',
   'gpt-transcribe', null, null, true, true, null)
on conflict (name) do update
  set transcribe_model = excluded.transcribe_model,
      enabled          = true;

update app_config
   set transcribe_provider  = 'openai-transcribe',
       transcribe_fallbacks = '{openai,groq,deepinfra}',
       updated_at           = now();

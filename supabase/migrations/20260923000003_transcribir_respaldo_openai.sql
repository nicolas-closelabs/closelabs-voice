-- Transcribir: Groq (plan gratis) con OpenAI de primer respaldo (2026-09-23).
--
-- Decisión de Nicolás: quedarnos en el plan gratis de Groq para transcribir, que aguanta ~2.000
-- dictados al día entre TODOS los médicos, y dejar a OpenAI listo detrás. Antes el primer respaldo
-- era DeepInfra, y ese orden tenía un problema medido: su Whisper NO acepta la pista de vocabulario
-- (`supports_transcribe_prompt = false`), así que cuando entraba, el diccionario del médico dejaba
-- de aplicarse en la transcripción. OpenAI sí la acepta y fue el de mejor calidad medida.
-- DeepInfra queda de último: sigue siendo mejor que no dictar.
update app_config
   set transcribe_fallbacks = '{openai,deepinfra}',
       updated_at = now();

-- DECISIÓN (2026-09-29): transcribir con OpenAI `gpt-4o-mini-transcribe` de principal, y Groq sin
-- pista cuando actúe de respaldo.
--
-- Medido con `pruebas-dictado/voz/`: 7 audios reales de Nicolás (del guion, pacientes inventados)
-- mandados al motor con varias configuraciones y revisados contra el guion — dosis, decimales,
-- negaciones, lados, diagnósticos.
--
--                                   Groq whisper-large-v3-turbo   OpenAI gpt-4o-mini-transcribe
--   datos clínicos mal o perdidos           8-17%                          1,6-2%
--   números que nadie dijo              2-3 por corrida                        0
--   tramos borrados/reemplazados        3 de 14 con pista                  0 de 28
--   palabras cortadas en la tilde       en cada corrida                        0
--   audio de ~2 min                         1-2,4 s                         2,6-7 s
--
-- Lo que decidió: Groq pierde contenido ANTES del formateo, donde nadie puede arreglarlo.
--   - Con pista, a veces borra un tramo y lo reemplaza por la pista o por texto inventado: los
--     7 negativos de un control prenatal, los signos vitales de urgencias, la receta de
--     psiquiatría ("…el resultado es el resultado de la enfermedad", frase que nadie dijo).
--   - Con o sin pista, tramos sin puntuación donde cada palabra se corta en la primera tilde y se
--     pierden los decimales: creatinina 1.4 → 1, potasio 4.1 → 4, HbA1c 7.2 → 7 (5 de 5 veces).
-- Lo que queda con OpenAI es ortografía de términos ("resubastatina"), que arreglan el diccionario
-- y el formateo. Costo: ~$0,003 por minuto de audio, ~$0,18 al mes por médico a 60 min/mes.
-- Regla de producto que manda: calidad sobre velocidad.
--
-- Respaldo: Groq y DeepInfra, para que una caída de OpenAI no deje al médico sin texto. A Groq ya
-- NO se le manda la pista: los borrados grandes pasaron solo con pista (0 de 14 sin ella).
update app_config
   set transcribe_provider  = 'openai',
       transcribe_fallbacks = '{groq,deepinfra}',
       updated_at           = now();

update public.providers
   set supports_transcribe_prompt = false
 where name = 'groq';

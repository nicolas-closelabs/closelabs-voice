-- EXPERIMENTO (2026-09-29): transcribir con OpenAI (gpt-4o-mini-transcribe) de principal, para
-- medirlo con `pruebas-dictado/voz/transcribir.ts` sobre los mismos audios que Groq.
--
-- Por qué: con 7 audios reales × 5 configuraciones, Groq (whisper-large-v3-turbo) mostró dos
-- fallos que el formateo NO puede arreglar, porque pasan antes:
--   1. Con pista, a veces BORRA un tramo y lo reemplaza por la pista o por texto inventado
--      (3 de 14 intentos con pista; 0 de 14 sin ella): los 7 negativos de obstetricia, los signos
--      vitales de urgencias, la receta de psiquiatría.
--   2. Con o sin pista, tramos donde cada palabra se corta en la primera tilde y se PIERDEN LOS
--      DECIMALES: creatinina 1.4 → 1, potasio 4.1 → 4, HbA1c 7.2 → 7, en 5 de 5 intentos.
-- Las pocas veces que respondió OpenAI (respaldo, cuando Groq se saturó) el mismo audio salió
-- limpio, con los decimales. Es anécdota hasta medirlo: eso hace esta migración.
--
-- Groq queda de PRIMER respaldo. Se revierte con la migración siguiente.
update app_config
   set transcribe_provider  = 'openai',
       transcribe_fallbacks = '{groq,deepinfra}',
       updated_at           = now();

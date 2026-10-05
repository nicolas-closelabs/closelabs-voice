-- Vuelta a `gpt-4o-mini-transcribe` (2026-10-04) tras medir `gpt-transcribe` tal cual.
--
-- Banco de voz, 20 dictados de un médico real + 7 de Nicolás, misma vara:
--   datos mal (médico)      mini 9,4%   gpt-transcribe 5,2%   (ortografía de medicamentos casi toda bien)
--   datos mal (Nicolás)     mini ~2%    gpt-transcribe ~3%
--   latencia mediana        2,3 s       2,9 s
-- Acepta el Ogg/Opus de la app sin problema.
--
-- Por qué NO entra: el mini transcribe LITERAL; gpt-transcribe a veces INTERPRETA, y produjo justo
-- los errores que cambian el contenido sin que se note — ninguno de ellos los tuvo el mini:
--   - "25 mg por una semana, mentira, 50 mg" → "25 mg por una semana, AUMENTA 50 mg": otra palabra
--     que cambia el sentido, y sin "mentira" la limpieza no puede aplicar la corrección.
--   - "tensión arterial cien sobre sesenta" → "tensión arterial sobre 60": se comió el 100.
--   - "me equivoqué" → "mequeo": la corrección se pierde.
-- Regla: solo entra lo que mejora sin empeorar nada. Siguiente: medir mini + lista de medicamentos
-- en la pista, y gpt-transcribe con `keywords` + instrucción de transcribir literal.
update app_config
   set transcribe_provider  = 'openai',
       transcribe_fallbacks = '{groq,deepinfra}',
       updated_at           = now();

update public.providers set enabled = false where name = 'openai-transcribe';

-- Formatear con DeepInfra como principal y Groq de respaldo (2026-09-22).
--
-- Por qué: en 24 h Groq falló 76 de 147 formateos, casi todos por `rate_limit` (el plan gratis
-- tiene un techo de 8.000 tokens/minuto para TODA la cuenta, ~6 dictados por minuto entre todos
-- los médicos). DeepInfra, con el mismo modelo (gpt-oss-20b), 72 de 72 sin fallar. El respaldo
-- automático ya cubría esos fallos, pero cada uno le sumaba segundos al dictado.
-- Transcribir sigue en Groq: ahí no hay techo de tokens por minuto que moleste.
update app_config
   set format_provider  = 'deepinfra',
       format_fallbacks = '{groq}',
       updated_at       = now();

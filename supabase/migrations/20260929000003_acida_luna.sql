-- PRUEBA ÁCIDA (2026-09-29), segunda mitad: gpt-6-luna de principal para medirlo con el banco.
-- Protocolo y regla de decisión (fijada el 2026-09-24, antes de ver números) en
-- `pruebas-dictado/README.md`. gpt-4o-mini ya dio: 4 fallos de contenido (1 de 160 en el banco
-- × 10, 3 de 30 en el dictado de 6 min), mediana 1,8 s, peor 4,5 s.
-- gpt-4o-mini queda de PRIMER respaldo; el banco corre con `--proveedor openai-luna`, así que lo
-- que sirva el respaldo no cuenta. Se revierte con la migración siguiente, gane quien gane.
update public.providers set enabled = true where name = 'openai-luna';

update app_config
   set format_provider  = 'openai-luna',
       format_fallbacks = '{openai,openrouter,groq}',
       updated_at       = now();

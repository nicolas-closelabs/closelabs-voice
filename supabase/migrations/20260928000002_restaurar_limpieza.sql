-- Fin de la grabación del guion (2026-09-28): la limpieza vuelve a como estaba antes de apagarla
-- en 20260928000001 — gpt-4o-mini de principal, openrouter y groq de respaldo.
update app_config
   set format_provider  = 'openai',
       format_fallbacks = '{openrouter,groq}',
       updated_at       = now();

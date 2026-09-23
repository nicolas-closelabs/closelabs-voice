-- Formatear con OpenRouter (servidor: Groq) como principal (2026-09-23).
--
-- Medido hoy contra /format real, con el prompt de producción:
--   · OpenRouter → Groq: 32/32 aciertos en las frases con autocorrección y 15/15 en frases nuevas
--     ("me equivoqué", "perdón"); 1,0 s de proceso, ~2,0 s extremo a extremo desde Colombia.
--   · Groq directo: misma calidad y velocidad, pero su plan gratis tumbó 19 de 36 peticiones por
--     `rate_limit` en la misma prueba. Los upgrades a plan pago de Groq siguen pausados.
--   · DeepInfra: 3,5-4,5 s y, con reasoning 'low', llegó a INVERTIR correcciones.
-- Costo medido: 1.649 tokens de entrada y 411 de salida por dictado = ~$0,00025. Un médico que
-- dicte 3.000 veces al mes cuesta ~$0,74 de formateo, cobrando $11.
-- Respaldo, en orden: Groq directo (por si OpenRouter se cae) y DeepInfra (por si los dos fallan).
update app_config
   set format_provider  = 'openrouter',
       format_fallbacks = '{groq,deepinfra}',
       updated_at       = now();

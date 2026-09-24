-- Cierre del experimento con `gpt-6-luna` (2026-09-24): se vuelve a gpt-4o-mini.
--
-- Medición limpia, directo a OpenAI con esfuerzo 'low' y el banco en `--proveedor openai-luna`
-- (todas las respuestas las sirvió luna, ninguna el respaldo). Sobre los MISMOS 27 dictados que
-- la corrida final de gpt-4o-mini:
--
--                          gpt-4o-mini     gpt-6-luna
--   banco                      42/42          42/42
--   dosis retractada 6 min     11/12          12/12     ← un caso de diferencia: no demuestra nada
--   costo del banco          $0,0216        $0,0203     ← 6% menos
--   latencia mediana          975 ms       2.018 ms
--   dictado de 6 min           2,3 s      5,5-6,3 s
--   rechazos 429                   0              0
--
-- Luna escribe 3x los tokens de salida aun con esfuerzo bajo: lo que ahorra en tarifa lo devuelve
-- en razonamiento, y lo cobra también en tiempo. 6% son ~$1,50 al día con 1.000 médicos, a
-- cambio de duplicar la espera. No compensa mientras no demuestre corregir mejor.
--
-- ⚠️ Sin medir: la caché del prompt (luna $0,01 vs $0,075 por millón; el prompt es ~86% del
-- costo). Si engancha, el ahorro podría acercarse a 20-25%. `usage_events` no guarda los tokens
-- cacheados; se ve en el panel de uso de OpenAI. No cambia la latencia.
--
-- ⚠️ Lo medido por OpenRouter (000003/000004) NO vale como medición de luna: OpenRouter rechazó
-- la mitad de las llamadas con 429 y el respaldo las recogió. El "44% de ahorro" de esa tanda
-- salió de que luna solo alcanzó a servir los dictados cortos.
--
-- Las filas se conservan deshabilitadas. El proxy ya habla con modelos de razonamiento de OpenAI
-- (`format_reasoning_model`): volver a probar este u otro es cambiar una fila.
update app_config
   set format_provider  = 'openai',
       format_fallbacks = '{openrouter,groq}',
       updated_at       = now();

update public.providers set enabled = false where name = 'openai-luna';

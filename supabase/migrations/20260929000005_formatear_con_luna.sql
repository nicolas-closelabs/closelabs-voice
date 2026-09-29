-- DECISIÓN (2026-09-29): formatear con gpt-6-luna (directo a OpenAI, esfuerzo 'low'), con
-- gpt-4o-mini de primer respaldo. Y el cupo diario vuelve a 500.
--
-- Prueba ácida con la regla fijada el 2026-09-24 ANTES de ver números (`pruebas-dictado/README.md`):
-- banco de 16 casos × 10 + dictado de 6 min × 30, cada modelo medido solo (`--proveedor`).
--
--                                  gpt-4o-mini        gpt-6-luna
--   fallos de contenido                 4                  0        (regla: ≥3 menos)   ✅
--     banco × 10                     1 de 150           0 de 150
--     dictado 6 min × 30             3 de 30            0 de 30
--   empeora algo perfecto de 4o-mini    —               nada                          ✅
--   dictado 6 min (mediana / peor)   2,4 / 4,5 s        5,4 / 14,2 s  (regla: <10 / <20 s) ✅
--
-- La dosis retractada del dictado de 6 min, sumando el 2026-09-24: luna 51/51, gpt-4o-mini 46/51.
-- Costo: ~6% menos (medido el 2026-09-24).
--
-- ⚠️ Qué se ajustó y por qué, para que nadie lo lea como trampa:
--   - Los separadores de miles/decimales cuentan como el mismo número ("7.2" = "7,2",
--     "240,000" = "240 000"): cambiar el estilo no es cambiar contenido (decisión de Nicolás).
--   - `real-3-5-ansiedad` se sacó de la comparación: el guion decía "sertralina 25 mg por una
--     semana, mentira, 50 mg después de la primera semana", ambiguo. Luna aplicó la corrección
--     (quitó el 25) y gpt-4o-mini la ignoró 10 de 10. Con la regla del producto —lo que sigue a
--     "mentira" reemplaza lo anterior— luna gana por más; el caso se reescribió con esa regla.
--   - La primera corrida de luna se descartó: agotó el cupo diario del equipo a mitad de camino.
update app_config
   set format_provider  = 'openai-luna',
       format_fallbacks = '{openai,openrouter,groq}',
       daily_quota      = 500,
       updated_at       = now();

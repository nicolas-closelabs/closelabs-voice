-- EXPERIMENTO, segunda parte (2026-09-24): el mismo `gpt-6-luna`, pero razonando menos.
--
-- Lo medido con el banco sin declarar esfuerzo (9 casos × 3, etiqueta "luna-sin-esfuerzo"):
--
--   calidad   41/42  (el único fallo es el MISMO que ya tiene gpt-4o-mini: el dictado de
--                     6 minutos conserva las dos dosis 1 de cada 3)
--   costo     $0,000812 por dictado contra $0,000821 de gpt-4o-mini → 1% de ahorro, no el 31%
--             que prometía el precio de lista
--   tiempo    2.734 ms de mediana contra 955 ms → casi 3x más lento
--             (los dictados largos reales: 10,4 s y 9,3 s contra 2,3 s)
--
-- La causa de las dos cosas es la misma: luna gasta 741 tokens de salida por dictado donde
-- gpt-4o-mini gasta 242 — **3,06x**, y el punto de equilibrio de precio estaba en ~3x. Todo ese
-- exceso es razonamiento, que se cobra como salida y se espera como tiempo.
--
-- Por eso esta segunda medición: con `reasoning_effort = 'low'` el modelo debería escribir casi
-- solo el texto. Si el razonamiento baja sin que caiga la calidad, luna gana por partida doble.
-- Si la calidad cae, la decisión es quedarse en gpt-4o-mini y ya está medido, que era el punto.
update public.providers
   set format_reasoning_effort = 'low'
 where name = 'openrouter-luna';

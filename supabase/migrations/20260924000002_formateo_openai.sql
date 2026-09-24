-- Formatear con OpenAI gpt-4o-mini (2026-09-24). Medido con el banco de pruebas, no a ojo.
--
-- `bun pruebas-dictado/correr.ts`, 9 dictados × 3 repeticiones, mismo prompt y mismo troceado:
--
--   openrouter/gpt-oss-20b   35/42   mediana 2,1 s   (9-10 s en los dictados largos)
--   openai/gpt-4.1-mini      40/42   mediana 1,6 s
--   openai/gpt-4o-mini       40/42   mediana 1,7 s   ← y con el prompt afinado, 42/42
--
-- Lo que decide: el dictado real de 3 minutos. Con gpt-oss la retractación fallaba SIEMPRE (0/3)
-- —quedaba "se remite a urgencias" cuando el médico corrigió a hospitalización— y además el
-- modelo se enredaba razonando hasta agotar su cupo. gpt-4o-mini acierta 3/3 y responde en 1,7 s.
-- Entre los dos de OpenAI empatan en calidad: se elige el más barato (0,15/0,60 por millón contra
-- 0,40/1,60 de gpt-4.1-mini). Medido: ~$0,00037 por dictado, igual que lo que costaba antes.
--
-- Precio idéntico por OpenRouter o directo (0,15/0,60 en ambos), pero OpenRouter cobra 5,5% al
-- comprar saldo: para este modelo, directo sale más barato. OpenRouter queda de respaldo con
-- gpt-oss, que sirve para salir del paso aunque no sea tan preciso.
update app_config
   set format_provider  = 'openai',
       format_fallbacks = '{openrouter,groq}',
       updated_at       = now();

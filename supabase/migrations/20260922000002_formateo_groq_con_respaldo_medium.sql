-- Se revierte la migración anterior (DeepInfra de principal) el mismo día, tras medirlo.
--
-- Medido el 2026-09-22 contra /format real, 33 dictados con autocorrecciones ("mentira", "perdón",
-- "me equivoqué") y el prompt de producción:
--   · DeepInfra con reasoning 'low': 26/33 y dos veces INVIRTIÓ la corrección ("se remite a
--     cardiología me equivoqué a neurología" → "Se remite a cardiología"). Inaceptable en clínica.
--   · DeepInfra con reasoning 'medium': 31/33 (fallas inofensivas: dejó ambas opciones), pero
--     ~4,5 s de mediana solo en formatear.
--   · Groq (gpt-oss-20b, reasoning por defecto): 13/13 de los que atendió, ~1,4 s. Su problema es
--     el techo de tokens/minuto del plan gratis (los upgrades siguen pausados), que se nota en
--     ráfagas, no con el tráfico actual de testers.
-- Decisión: Groq de principal; DeepInfra de respaldo pero en 'medium', para que cuando entre no
-- dañe las correcciones. Revisar cuando haya más médicos (ver ROADMAP, Fase 2.5).
update app_config
   set format_provider  = 'groq',
       format_fallbacks = '{deepinfra}',
       updated_at       = now();

update providers set format_reasoning_effort = 'medium' where name = 'deepinfra';

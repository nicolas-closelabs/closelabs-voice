-- TEMPORAL (2026-09-28): limpieza APAGADA para capturar el texto CRUDO del guion de grabaciones.
--
-- Sin esto no se puede separar un error de voz (Whisper) de uno de formateo: la app pegaría el
-- texto ya limpio y el crudo no se guarda en ningún lado (dictados de pacientes: no se guardan).
-- Ver `pruebas-dictado/README.md`, "Añadir casos".
--
-- Cómo funciona: `apagado` no existe en `providers` y no hay respaldo, así que el formateo falla
-- con `provider_error` y `/dictate` devuelve la transcripción cruda entera (`finalText` se queda
-- con el texto de Whisper). Nada se pierde; solo llega sin puntuar.
--
-- ⚠️ AFECTA A TODOS LOS EQUIPOS mientras esté puesta. Se revierte con la migración siguiente,
-- apenas termine la grabación.
update app_config
   set format_provider  = 'apagado',
       format_fallbacks = '{}',
       updated_at       = now();

-- Red de seguridad del dictado (2026-09-29). Código en `supabase/functions/_shared/revision.ts`.
--
-- Por qué: la regla del producto es que el contenido clínico NUNCA se pierda ni cambie sin
-- avisar, y ningún modelo la cumple solo. Los principales de hoy (OpenAI para la voz, gpt-6-luna
-- para limpiar) salieron limpios en el banco, pero cuando se caen responde el respaldo, que es
-- justo el que falla: Groq borró tramos en 3 de 14 intentos, gpt-4o-mini dejaba dosis dobles.
--
-- Dos capas, sin ningún modelo (comparan textos; menos de 1 ms):
--   1. Limpieza: cada trozo limpio contra su crudo. Salta si se perdió un número que el médico no
--      retractó, o si el texto se encogió a menos del 60%.
--   2a. Voz: se quitan las frases de subtítulos sueltas ("Gracias por ver el video.") y se anota
--      cuando la pista se coló en la transcripción.
--
-- `content_check` decide qué hace la capa 1:
--   'observe' — revisa y anota (`revision_limpieza` en un evento ok), pero el médico recibe lo de
--               siempre. Arranca aquí para medir falsas alarmas antes de actuar.
--   'enforce' — si no pasa, se prueba el siguiente proveedor; si ninguno pasa, la app pega el
--               crudo ENTERO. Más feo, nunca incompleto.
--   'off'     — no revisa.
-- ⚠️ Desplegar esta migración ANTES que el código: el código lee la columna.
alter table public.app_config
  add column if not exists content_check text not null default 'observe'
  check (content_check in ('off', 'observe', 'enforce'));

comment on column public.app_config.content_check is
  'Red de seguridad de la limpieza: off | observe (revisa y anota) | enforce (si pierde contenido, pega el crudo). Ver revision.ts.';

-- Lo que la red de seguridad vio, sin tocar las alertas: estos eventos son `ok = true`.
create or replace view public.revisiones_recientes as
select date_trunc('day', created_at) as dia,
       kind                          as tipo,
       provider,
       error_code                    as codigo,
       count(*)                      as veces
  from public.usage_events
 where error_code in ('revision_limpieza', 'eco_pista', 'alucinacion_quitada')
   and created_at >= now() - interval '14 days'
 group by 1, 2, 3, 4
 order by 1 desc, 5 desc;

revoke all on public.revisiones_recientes from anon, authenticated;
grant select on public.revisiones_recientes to service_role;

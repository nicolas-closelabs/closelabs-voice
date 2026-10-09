-- CloseLabs Voice — dos variantes de gpt-6-luna para MEDIR, fuera de producción (2026-10-09).
--
-- Feedback del primer médico real: lento en dictados largos. Medido: la limpieza con gpt-6-luna
-- (esfuerzo 'low') es el tramo más largo (~4,7 s en un dictado de 1 min), y casi todo es el
-- razonamiento previo, no el largo. Estas filas permiten medir 'minimal' y 'none' con el banco
-- (`bun pruebas-dictado/correr.ts --forzar openai-luna-minimal`) sin tocar a ningún médico: NO están
-- en `format_fallbacks` ni son `format_provider`. Solo se llega a ellas con la llave de servicio
-- (cabecera `x-proveedor-prueba` en /format).
insert into public.providers (name, enabled, base_url, api_key_env, transcribe_model, format_model,
                              format_reasoning_effort, format_reasoning_model, supports_transcribe_prompt,
                              notes)
select v.name, true, p.base_url, p.api_key_env, null, p.format_model, v.esfuerzo, true, false,
       'SOLO PARA MEDIR con el banco (2026-10-09): gpt-6-luna con esfuerzo ' || v.esfuerzo || '. No está en producción.'
  from public.providers p
  cross join (values ('openai-luna-minimal', 'minimal'), ('openai-luna-none', 'none')) as v(name, esfuerzo)
 where p.name = 'openai-luna'
on conflict (name) do nothing;

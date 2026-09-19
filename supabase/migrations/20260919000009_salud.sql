-- CloseLabs Voice — saber que algo va mal SIN que nos lo diga un médico.
--
-- El problema concreto (BACKLOG #4): cuando el proveedor falla —sin saldo, tope de peticiones,
-- caído— la app cae al Parakeet local **en silencio**. El médico sigue dictando, con peor
-- calidad, y en CloseLabs nadie se entera hasta que alguien se queja. Eso ya pasó: Groq retiró
-- `llama-3.3-70b-versatile` y durante días los dictados se pegaron sin formatear.
--
-- Ahora `usage_events` guarda el resultado de cada llamada. Lo que faltaba era mirarlo. Estas
-- vistas son ese "mirarlo", y están hechas para responder tres preguntas y no más:
--   1. ¿Está fallando algo AHORA?           → `salud_ultima_hora`
--   2. ¿Qué está fallando y desde cuándo?    → `errores_recientes`
--   3. ¿Cuánto se está usando?               → `uso_diario`
--
-- Ninguna toca el dictado: son consultas. Verlas no le quita un milisegundo a nadie.

-- ---------------------------------------------------------------------------------------------
-- 1. ¿Está fallando algo ahora?
-- ---------------------------------------------------------------------------------------------
-- Una fila por tipo y proveedor. Si `pct_error` sube de 0 de forma sostenida, hay que mirar.
create or replace view public.salud_ultima_hora as
select
  kind                                                          as tipo,
  provider                                                      as proveedor,
  count(*)                                                      as llamadas,
  count(*) filter (where not ok)                                as fallos,
  round(100.0 * count(*) filter (where not ok) / count(*), 1)    as pct_error,
  -- La mediana dice cómo le va al médico típico; el p95, cuántos están sufriendo.
  round(percentile_cont(0.5) within group (order by latency_ms)) as latencia_mediana_ms,
  round(percentile_cont(0.95) within group (order by latency_ms))as latencia_p95_ms,
  max(created_at)                                               as ultima_llamada
from public.usage_events
where created_at > now() - interval '1 hour'
group by kind, provider
order by pct_error desc, llamadas desc;

-- ---------------------------------------------------------------------------------------------
-- 2. ¿Qué está fallando?
-- ---------------------------------------------------------------------------------------------
-- Agrupado por CÓDIGO, que es lo que decide qué hacer: `rate_limit` se arregla cambiando de
-- proveedor en `app_config`; `auth` es la llave; `timeout` es el proveedor lento; `empty_result`
-- en transcripción suele ser el proveedor que no soporta la pista de vocabulario.
create or replace view public.errores_recientes as
select
  error_code                as codigo,
  kind                      as tipo,
  provider                  as proveedor,
  count(*)                  as veces,
  count(distinct device_id) as dispositivos,
  min(created_at)           as desde,
  max(created_at)           as hasta
from public.usage_events
where not ok
  and created_at > now() - interval '24 hours'
group by error_code, kind, provider
order by veces desc;

-- ---------------------------------------------------------------------------------------------
-- 3. ¿Cuánto se está usando?
-- ---------------------------------------------------------------------------------------------
-- Los dos números que deciden cuándo hay que dejar de esperar a que Groq reabra su plan pago:
-- cuántos médicos activos hay y cuántos minutos de audio se están gastando.
create or replace view public.uso_diario as
select
  date_trunc('day', created_at)::date                             as dia,
  count(distinct device_id)                                       as dispositivos_activos,
  count(*) filter (where kind = 'transcribe' and ok)              as dictados,
  round(sum(audio_seconds) filter (where kind = 'transcribe') / 60.0, 1) as minutos_audio,
  sum(tokens_in + tokens_out) filter (where kind = 'format')      as tokens_formateo,
  count(*) filter (where not ok)                                  as fallos
from public.usage_events
where created_at > now() - interval '30 days'
group by 1
order by 1 desc;

-- Las vistas heredan la protección de `usage_events`, pero se es explícito igualmente: esto no
-- se consulta desde la app, solo desde el panel con la llave de servicio.
revoke all on public.salud_ultima_hora  from anon, authenticated;
revoke all on public.errores_recientes  from anon, authenticated;
revoke all on public.uso_diario         from anon, authenticated;
grant select on public.salud_ultima_hora, public.errores_recientes, public.uso_diario
  to service_role;

-- Sin este índice, cada consulta recorre la tabla entera. Hoy da igual; con unos miles de
-- dictados al día, no.
create index if not exists usage_events_created_at_idx
  on public.usage_events (created_at desc);

-- CloseLabs Voice — que un fallo del proveedor nos llegue por correo (pendiente #4).
--
-- El problema, tal cual pasó: Groq retiró un modelo, la API empezó a devolver 404 en cada
-- dictado y la app cayó a texto crudo **en silencio**. Los médicos siguieron dictando con peor
-- resultado durante días y nos enteramos porque alguien se quejó. Con el proxy ya guardamos el
-- resultado de cada llamada en `usage_events`, y las vistas de salud dejan verlo — pero hay que
-- ir a mirar, y nadie mira a las 3 de la tarde de un martes.
--
-- Diseño, y el porqué de cada parte:
--
-- * **La decisión vive en SQL, no en la función.** Ajustar un umbral es un `update`, no un
--   despliegue. Y se puede probar con un `select` sin mandarle correo a nadie.
-- * **Se avisa de lo ACCIONABLE.** Cada condición de aquí abajo tiene una respuesta concreta:
--   rotar la llave, o cambiar de proveedor. Una alerta sin respuesta es ruido, y el ruido
--   entrena a la gente a ignorar el buzón — que es peor que no tener alertas.
-- * **Silencio tras avisar.** La misma condición no vuelve a escribir en varias horas. Un
--   proveedor caído genera cientos de fallos por minuto; el primer correo ya dijo todo.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ---------------------------------------------------------------------------------------------
-- A dónde se avisa y con qué sensibilidad
-- ---------------------------------------------------------------------------------------------
create table public.alert_config (
  id              boolean primary key default true,
  -- Si está apagado no se manda nada. Útil para callar el buzón durante una migración conocida.
  enabled         boolean     not null default true,
  send_to         text        not null,
  -- El remitente tiene que ser de un dominio verificado en Resend, o el correo no sale.
  send_from       text        not null default 'CloseLabs Voice <alertas@closelabs.co>',
  -- Tasa de error por encima de la cual algo va mal de verdad, en porcentaje.
  error_pct       numeric     not null default 25,
  -- Por debajo de estas llamadas en la última hora, el porcentaje no significa nada: con 2
  -- llamadas y 1 fallo sale 50% y no pasa nada.
  min_calls       integer     not null default 8,
  -- Cuánto callar tras avisar de lo mismo.
  silencio_horas  integer     not null default 6,
  constraint alert_config_single_row check (id)
);

insert into public.alert_config (id, send_to) values (true, 'admin@closelabs.co');

-- Qué se avisó y cuándo. Es lo que hace que no se repita, y además deja el historial para saber
-- si un problema es nuevo o lleva semanas.
create table public.alert_log (
  id         bigserial primary key,
  kind       text        not null,
  detalle    text        not null,
  sent_at    timestamptz not null default now()
);

create index alert_log_kind_sent_idx on public.alert_log (kind, sent_at desc);

alter table public.alert_config enable row level security;
alter table public.alert_log    enable row level security;
revoke all on table public.alert_config, public.alert_log from anon, authenticated;
grant select, update on table public.alert_config to service_role;
grant select, insert on table public.alert_log    to service_role;
grant usage, select on sequence public.alert_log_id_seq to service_role;

-- ---------------------------------------------------------------------------------------------
-- Qué se considera digno de un correo
-- ---------------------------------------------------------------------------------------------
-- Devuelve una fila por problema ACTIVO del que no se haya avisado hace poco. Si no devuelve
-- nada, no hay correo. Se puede llamar a mano sin efecto alguno:
--
--   select * from alertas_pendientes();
--
create or replace function public.alertas_pendientes()
returns table (kind text, gravedad text, detalle text)
language sql
stable
security definer
set search_path = public
as $$
  with cfg as (select * from public.alert_config where id),
  -- Ventana de una hora: suficiente para que un problema real acumule señal, y corta para que
  -- el aviso llegue mientras todavía importa.
  ventana as (
    select e.kind as tipo, e.provider, e.error_code, e.ok
      from public.usage_events e
     where e.created_at > now() - interval '1 hour'
  ),
  candidatas as (
    -- 1. La llave del proveedor dejó de servir. No hay porcentaje que valga: un solo caso ya es
    --    catastrófico y la respuesta es inmediata (rotarla o revisar la cuenta).
    select 'auth'::text as kind,
           'crítico'::text as gravedad,
           format('El proveedor %s rechaza nuestra llave (%s veces en la última hora). Los '
                  'dictados están cayendo al motor local. Revisa la cuenta o rota la llave.',
                  v.provider, count(*))::text as detalle
      from ventana v
     where not v.ok and v.error_code = 'auth'
     group by v.provider

    union all

    -- 2. Estamos topando el techo del plan. La respuesta es cambiar de proveedor en `app_config`
    --    o subir de plan; las dos están a una línea de distancia.
    select 'rate_limit',
           'alto',
           format('El proveedor %s nos está limitando: %s rechazos por cupo en la última hora. '
                  'Cambiar de proveedor es: update app_config set %s_provider = ...',
                  v.provider, count(*),
                  case when v.tipo = 'transcribe' then 'transcribe' else 'format' end)
      from ventana v
     where not v.ok and v.error_code = 'rate_limit'
     group by v.provider, v.tipo
    having count(*) >= 10

    union all

    -- 3. Algo falla mucho y no sabemos qué. Aquí el porcentaje sí manda, con un mínimo de
    --    llamadas para que no salte con dos dictados.
    select 'tasa_error',
           'alto',
           format('%s de %s llamadas de %s a %s fallaron en la última hora (%s%%). Códigos: %s',
                  count(*) filter (where not v.ok), count(*), v.tipo, v.provider,
                  round(100.0 * count(*) filter (where not v.ok) / count(*)),
                  string_agg(distinct v.error_code, ', ') filter (where not v.ok))
      from ventana v
     group by v.tipo, v.provider
    having count(*) >= (select min_calls from cfg)
       and 100.0 * count(*) filter (where not v.ok) / count(*) >= (select error_pct from cfg)
  )
  select c.kind, c.gravedad, c.detalle
    from candidatas c, cfg
   where cfg.enabled
     -- El silencio: si ya se avisó de esto hace poco, no se repite.
     and not exists (
       select 1 from public.alert_log l
        where l.kind = c.kind
          and l.sent_at > now() - make_interval(hours => cfg.silencio_horas)
     );
$$;

revoke all on function public.alertas_pendientes() from public, anon, authenticated;
grant execute on function public.alertas_pendientes() to service_role;

comment on function public.alertas_pendientes is
  'Problemas activos dignos de correo, ya filtrados por el silencio posterior a un aviso. Llamarla no manda nada: es solo la decisión. Vacío = todo en orden.';

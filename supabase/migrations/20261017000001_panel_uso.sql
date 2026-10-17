-- CloseLabs Voice — panel de uso para closelabs.co/voice/admin (pedido por Nicolás, 2026-10-17).
--
-- "Qué médico lo está usando más, cuánto y todo", para hacer seguimiento ahora que empezamos: a
-- quién llamar porque nunca dictó, quién se enfrió, a quién se le vence la prueba. Solo contadores
-- (cuántos dictados, cuántos minutos, cuándo): el contenido de los dictados no se guarda en ningún
-- lado, así que tampoco puede salir aquí.
--
-- Las cuentas y equipos del equipo de CloseLabs se marcan aparte para que no inflen los números:
-- hoy son la mayoría de las cuentas.

-- ---------------------------------------------------------------------------------------------
-- 1. Lo que es nuestro
-- ---------------------------------------------------------------------------------------------
create table public.cuentas_internas (
  email       text        primary key check (email = lower(btrim(email))),
  nota        text,
  agregado_at timestamptz not null default now()
);

alter table public.cuentas_internas enable row level security;
revoke all on table public.cuentas_internas from anon, authenticated;
grant select, insert, delete on table public.cuentas_internas to service_role;

-- Para sumar a alguien:  insert into cuentas_internas (email, nota) values ('x@y.com', 'equipo');
insert into public.cuentas_internas (email, nota) values
  ('nicolas@closelabs.co', 'equipo'),
  ('nicolaswalteros@gmail.com', 'equipo'),
  ('santiago@closelabs.co', 'equipo'),
  ('admin@closelabs.co', 'equipo'),
  ('luciaduransr@gmail.com', 'equipo'),
  ('nicolas+prueba-stripe@closelabs.co', 'prueba de Stripe'),
  ('nicolas+prueba-stripe2@closelabs.co', 'prueba de Stripe')
on conflict do nothing;

-- Un equipo nuestro dentro de la cuenta de un médico: el Mac de Nicolás entró con demo@ (la cuenta
-- que usa un médico) y desde ahí corren también las mediciones de velocidad. Sus dictados no son
-- del médico.
alter table public.devices add column if not exists interno boolean not null default false;
comment on column public.devices.interno is
  'Equipo de CloseLabs (pruebas y mediciones): sus dictados no cuentan en el panel de uso.';
update public.devices set interno = true where id = '65d96f8b-e66b-431f-b003-5416ad96ca84';

-- ---------------------------------------------------------------------------------------------
-- 2. Un médico por fila
-- ---------------------------------------------------------------------------------------------
-- `p_dias`: el período (7, 30, 90…); null = desde el principio. Los días son de Bogotá.
create or replace function public.panel_uso(p_dias integer default 30, p_equipo boolean default false)
returns table (
  email         text,
  full_name     text,
  telefono      text,
  canal         text,
  estado        text,
  prueba_hasta  timestamptz,
  interna       boolean,
  registrado_at timestamptz,
  dictados      bigint,
  minutos       numeric,
  dias_activos  bigint,
  dictados_7d   bigint,
  primer_uso    timestamptz,
  ultimo_uso    timestamptz,
  equipos       bigint,
  plataformas   text,
  version       text
)
language sql
stable
security definer
set search_path = public
as $$
  with desde as (
    select case when p_dias is null then '-infinity'::timestamptz
                else (date_trunc('day', now() at time zone 'America/Bogota') - make_interval(days => p_dias - 1))
                       at time zone 'America/Bogota' end as t
  ),
  eventos as (
    select d.user_id, e.created_at, e.audio_seconds
      from public.usage_events e
      join public.devices d on d.id = e.device_id
     where e.kind = 'transcribe' and e.ok and d.user_id is not null
       and (p_equipo or not d.interno)
  )
  select
    lower(u.email),
    p.full_name,
    nullif(btrim(coalesce(p.phone_country, '') || ' ' || coalesce(p.phone, '')), ''),
    coalesce(s.canal, 'directo'),
    case
      when s.user_id is null then 'sin suscripción'
      when s.canal <> 'directo' then case when s.status = 'active' then s.canal || ' activo' else s.canal || ' pausado' end
      when s.stripe_subscription_id is not null then case
        when s.status in ('active', 'trialing') and s.cancel_at_period_end then 'canceló (le queda período)'
        when s.status in ('active', 'trialing') then 'suscrito'
        when s.status = 'past_due' then 'cobro fallido'
        else 'suscripción terminada' end
      when s.trial_ends_at > now() then 'en prueba'
      else 'prueba terminada'
    end,
    case when s.canal = 'directo' and s.stripe_subscription_id is null then s.trial_ends_at end,
    ci.email is not null,
    u.created_at,
    (select count(*) from eventos x, desde where x.user_id = u.id and x.created_at >= desde.t),
    (select round(coalesce(sum(x.audio_seconds), 0) / 60, 1) from eventos x, desde where x.user_id = u.id and x.created_at >= desde.t),
    (select count(distinct (x.created_at at time zone 'America/Bogota')::date) from eventos x, desde
      where x.user_id = u.id and x.created_at >= desde.t),
    (select count(*) from eventos x where x.user_id = u.id and x.created_at >= now() - interval '7 days'),
    (select min(x.created_at) from eventos x where x.user_id = u.id),
    (select max(x.created_at) from eventos x where x.user_id = u.id),
    (select count(*) from public.devices d where d.user_id = u.id and not d.revoked and (p_equipo or not d.interno)),
    (select string_agg(distinct case d.platform when 'macos' then 'Mac' when 'windows' then 'Windows' else d.platform end, ' · ')
       from public.devices d where d.user_id = u.id and not d.revoked and (p_equipo or not d.interno)),
    (select d.app_version from public.devices d where d.user_id = u.id and not d.revoked and (p_equipo or not d.interno)
      order by d.last_seen_at desc nulls last limit 1)
  from auth.users u
  left join public.user_profiles p on p.id = u.id
  left join public.subscriptions s on s.user_id = u.id
  left join public.cuentas_internas ci on ci.email = lower(u.email)
  where p_equipo or ci.email is null
  order by 9 desc, u.created_at desc;
$$;

-- ---------------------------------------------------------------------------------------------
-- 3. Un día por fila, para la gráfica
-- ---------------------------------------------------------------------------------------------
create or replace function public.panel_uso_diario(p_dias integer default 30, p_equipo boolean default false)
returns table (dia date, dictados bigint, minutos numeric, medicos_activos bigint, registros bigint)
language sql
stable
security definer
set search_path = public
as $$
  with hoy as (select (now() at time zone 'America/Bogota')::date as d),
  primero as (
    -- "Desde el principio" arranca el día del primer dictado con cuenta (antes no había cuentas).
    select coalesce(
      (select hoy.d - (p_dias - 1) from hoy where p_dias is not null),
      (select min((e.created_at at time zone 'America/Bogota')::date)
         from public.usage_events e join public.devices d on d.id = e.device_id where d.user_id is not null),
      (select d from hoy)
    ) as d
  ),
  dias as (select generate_series(primero.d, hoy.d, interval '1 day')::date as dia from primero, hoy),
  eventos as (
    select d.user_id, (e.created_at at time zone 'America/Bogota')::date as dia, e.audio_seconds
      from public.usage_events e
      join public.devices d on d.id = e.device_id
      join auth.users u on u.id = d.user_id
      left join public.cuentas_internas ci on ci.email = lower(u.email)
     where e.kind = 'transcribe' and e.ok
       and e.created_at >= ((select d from primero)::timestamp at time zone 'America/Bogota')
       and (p_equipo or (ci.email is null and not d.interno))
  ),
  altas as (
    select (u.created_at at time zone 'America/Bogota')::date as dia
      from auth.users u left join public.cuentas_internas ci on ci.email = lower(u.email)
     where p_equipo or ci.email is null
  )
  select
    x.dia,
    (select count(*) from eventos e where e.dia = x.dia),
    (select round(coalesce(sum(e.audio_seconds), 0) / 60, 1) from eventos e where e.dia = x.dia),
    (select count(distinct e.user_id) from eventos e where e.dia = x.dia),
    (select count(*) from altas a where a.dia = x.dia)
  from dias x
  order by x.dia;
$$;

revoke all on function public.panel_uso(integer, boolean) from public, anon, authenticated;
revoke all on function public.panel_uso_diario(integer, boolean) from public, anon, authenticated;
grant execute on function public.panel_uso(integer, boolean) to service_role;
grant execute on function public.panel_uso_diario(integer, boolean) to service_role;

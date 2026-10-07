-- CloseLabs Voice — administración de los médicos de un socio (gMedic) sin SQL.
--
-- Nicolás pidió (2026-10-06) poder activar, pausar y tener lo de facturar sin escribir SQL. Lo hace
-- la página closelabs.co/voice/admin, que habla con la función `admin`. Esta migración pone lo que
-- esa página necesita:
--   1. Quién es administrador.
--   2. Un registro de cada alta y baja: quién la hizo y cuándo. Es lo que responde "¿desde cuándo
--      estaba activo este médico?" al facturarle a gMedic, y antes se perdía (socio_pausar borra
--      el correo de la lista).
--   3. El reporte de un mes.
--
-- `socio_autorizar` y `socio_pausar` siguen sirviendo igual desde el SQL editor; ahora además dejan
-- su registro (con `por` = quién lo pidió).

-- ---------------------------------------------------------------------------------------------
-- 1. Administradores
-- ---------------------------------------------------------------------------------------------
create table public.administradores (
  email       text        primary key check (email = lower(btrim(email))),
  agregado_at timestamptz not null default now()
);

alter table public.administradores enable row level security;
revoke all on table public.administradores from anon, authenticated;
grant select, insert, delete on table public.administradores to service_role;

-- Para agregar a alguien:  insert into administradores (email) values ('santiago@closelabs.co');
insert into public.administradores (email) values ('nicolas@closelabs.co') on conflict do nothing;

-- ---------------------------------------------------------------------------------------------
-- 2. Registro de altas y bajas
-- ---------------------------------------------------------------------------------------------
create table public.socio_cambios (
  id        bigint generated always as identity primary key,
  email     text        not null,
  canal     text        not null,
  accion    text        not null check (accion in ('alta', 'baja')),
  resultado text        not null,
  por       text        not null,
  at        timestamptz not null default now()
);

create index socio_cambios_email_idx on public.socio_cambios (email, at desc);

alter table public.socio_cambios enable row level security;
revoke all on table public.socio_cambios from anon, authenticated;
grant select, insert on table public.socio_cambios to service_role;

-- Las mismas funciones de 20261006000003, con `p_por` y el registro. Se borran las anteriores para
-- no dejar dos versiones con distinta cantidad de parámetros.
drop function if exists public.socio_autorizar(text, text, text);
drop function if exists public.socio_pausar(text);

create or replace function public.socio_autorizar(
  p_email text,
  p_canal text default 'gmedic',
  p_nota  text default null,
  p_por   text default 'sql'
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email     text := lower(btrim(p_email));
  v_user      uuid;
  v_stripe    text;
  v_ya        boolean;
  v_resultado text;
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return '⚠️ no parece un correo: no se hizo nada';
  end if;

  insert into public.canal_correos (email, canal, nota)
  values (v_email, p_canal, p_nota)
  on conflict (email) do update
    set canal = excluded.canal, nota = coalesce(excluded.nota, public.canal_correos.nota);

  select u.id into v_user from auth.users u where lower(u.email) = v_email;
  if v_user is null then
    v_resultado := 'autorizado: entrará activo, sin prueba, cuando se registre con ese correo';
  else
    select s.stripe_subscription_id, (s.canal = p_canal and s.status = 'active')
      into v_stripe, v_ya
      from public.subscriptions s where s.user_id = v_user;
    if v_ya then
      -- Nada que cambiar, y nada que registrar: la historia es para facturar y no debe ensuciarse.
      return 'ya estaba activo: no cambió nada';
    end if;
    update public.subscriptions
       set canal = p_canal, status = 'active', cancel_at_period_end = false, updated_at = now()
     where user_id = v_user;
    v_resultado := case
      when v_stripe is not null then
        'activado. ⚠️ tenía una suscripción directa en Stripe: cancelarla a mano en Stripe para que no pague dos veces'
      else 'activado: ya tenía cuenta, desde ya dicta por el canal ' || p_canal
    end;
  end if;

  insert into public.socio_cambios (email, canal, accion, resultado, por)
  values (v_email, p_canal, 'alta', v_resultado, coalesce(p_por, 'sql'));
  return v_resultado;
end;
$$;

create or replace function public.socio_pausar(p_email text, p_por text default 'sql')
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email     text := lower(btrim(p_email));
  v_user      uuid;
  v_canal     text;
  v_n         integer;
  v_resultado text;
begin
  select cc.canal into v_canal from public.canal_correos cc where cc.email = v_email;
  delete from public.canal_correos where email = v_email;

  select u.id into v_user from auth.users u where lower(u.email) = v_email;
  if v_user is null then
    v_resultado := case when v_canal is null
      then '⚠️ ese correo no estaba en la lista: no se hizo nada'
      else 'quitado de la lista (no se había registrado)' end;
  else
    select s.canal into v_canal from public.subscriptions s where s.user_id = v_user;
    if v_canal = 'directo' then
      return '⚠️ esa cuenta es de venta directa, no de un socio: no se tocó';
    end if;
    update public.subscriptions
       set status = 'canceled', updated_at = now()
     where user_id = v_user and status <> 'canceled';
    get diagnostics v_n = row_count;
    if v_n = 0 then
      return 'ya estaba pausado: no cambió nada';
    end if;
    v_resultado := 'pausado: deja de dictar desde ya';
  end if;

  -- Solo se registra lo que de verdad cambió algo.
  if v_resultado not like '⚠️%' then
    insert into public.socio_cambios (email, canal, accion, resultado, por)
    values (v_email, coalesce(v_canal, 'gmedic'), 'baja', v_resultado, coalesce(p_por, 'sql'));
  end if;
  return v_resultado;
end;
$$;

revoke all on function public.socio_autorizar(text, text, text, text) from public, anon, authenticated;
revoke all on function public.socio_pausar(text, text) from public, anon, authenticated;
grant execute on function public.socio_autorizar(text, text, text, text) to service_role;
grant execute on function public.socio_pausar(text, text) to service_role;

-- ---------------------------------------------------------------------------------------------
-- 3. Reporte de un mes (para facturar)
-- ---------------------------------------------------------------------------------------------
-- Un médico por fila: todos los que hoy son del socio, los autorizados que no se han registrado, y
-- los que el mes del reporte tuvieron alguna alta o baja (aunque hoy ya no estén). Con la última
-- alta y la última baja, quien factura ve si estuvo activo ese mes y desde cuándo.
create or replace function public.socio_uso_mes(p_mes date default date_trunc('month', now())::date)
returns table (
  canal        text,
  email        text,
  full_name    text,
  estado       text,
  ultima_alta  timestamptz,
  ultima_baja  timestamptz,
  dictados     bigint,
  minutos      numeric,
  ultimo_uso   timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with rango as (
    select date_trunc('month', p_mes)::timestamptz as desde,
           (date_trunc('month', p_mes) + interval '1 month')::timestamptz as hasta
  ),
  correos as (
    select lower(u.email) as email, s.canal from public.subscriptions s
      join auth.users u on u.id = s.user_id where s.canal <> 'directo'
    union
    select cc.email, cc.canal from public.canal_correos cc
    union
    select c.email, c.canal from public.socio_cambios c, rango r
     where c.at >= r.desde and c.at < r.hasta
  )
  select
    c.canal,
    c.email,
    p.full_name,
    case
      when u.id is null and cc.email is not null then 'sin registrarse'
      when u.id is null then 'quitado'
      when s.canal = 'directo' then 'pasó a directo'
      when s.status = 'active' then 'activo'
      else 'pausado'
    end,
    (select max(x.at) from public.socio_cambios x where x.email = c.email and x.accion = 'alta'),
    (select max(x.at) from public.socio_cambios x where x.email = c.email and x.accion = 'baja'),
    (select count(*) from public.usage_events e join public.devices d on d.id = e.device_id, rango r
      where d.user_id = u.id and e.kind = 'transcribe' and e.ok
        and e.created_at >= r.desde and e.created_at < r.hasta),
    (select round(coalesce(sum(e.audio_seconds), 0) / 60)
       from public.usage_events e join public.devices d on d.id = e.device_id, rango r
      where d.user_id = u.id and e.kind = 'transcribe' and e.ok
        and e.created_at >= r.desde and e.created_at < r.hasta),
    (select max(e.created_at) from public.usage_events e join public.devices d on d.id = e.device_id
      where d.user_id = u.id)
  from correos c
  left join auth.users u on lower(u.email) = c.email
  left join public.subscriptions s on s.user_id = u.id
  left join public.user_profiles p on p.id = u.id
  left join public.canal_correos cc on cc.email = c.email
  order by c.email;
$$;

revoke all on function public.socio_uso_mes(date) from public, anon, authenticated;
grant execute on function public.socio_uso_mes(date) to service_role;

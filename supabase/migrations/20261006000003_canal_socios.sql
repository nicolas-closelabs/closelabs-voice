-- CloseLabs Voice — canal de socios: médicos que pagan a través de un distribuidor (gMedic).
--
-- Decidido con Nicolás (2026-09-23 y 2026-10-06, ROADMAP Fase 5):
-- - En el canal de un socio NO hay 30 días gratis: el médico entra activo.
-- - El socio cobra. Nosotros no le mostramos pagos ni Stripe: "Mi cuenta" dice que su suscripción
--   la maneja el socio, y para cancelar habla con él.
-- - Manual primero: el socio nos manda los correos de sus médicos y las bajas; nosotros las
--   aplicamos con `socio_autorizar` y `socio_pausar` (abajo). Una API para el socio, solo pasando
--   ~100 médicos.
--
-- Cómo queda marcado un médico: su correo está en `canal_correos`. Al registrarse (disparador de
-- abajo) su suscripción nace con ese canal y ACTIVA. Si ya tenía cuenta, `socio_autorizar` la pasa.
-- El médico no hace nada distinto: descarga, se registra y dicta.

-- ---------------------------------------------------------------------------------------------
-- 1. El canal de cada cuenta
-- ---------------------------------------------------------------------------------------------
alter table public.subscriptions
  add column if not exists canal text not null default 'directo'
  check (canal in ('directo', 'gmedic'));

comment on column public.subscriptions.canal is
  'directo = venta nuestra con Stripe y prueba de 30 días. Otro valor = un socio que cobra por su cuenta: dicta mientras status = active, y status lo manejamos a mano (socio_autorizar / socio_pausar).';

-- ---------------------------------------------------------------------------------------------
-- 2. Correos autorizados por un socio
-- ---------------------------------------------------------------------------------------------
create table public.canal_correos (
  email       text        primary key check (email = lower(btrim(email))),
  canal       text        not null check (canal in ('gmedic')),
  nota        text,
  agregado_at timestamptz not null default now()
);

alter table public.canal_correos enable row level security;
revoke all on table public.canal_correos from anon, authenticated;
grant select, insert, update, delete on table public.canal_correos to service_role;

-- ---------------------------------------------------------------------------------------------
-- 3. Registro: quien está en la lista nace activo y con su canal
-- ---------------------------------------------------------------------------------------------
-- Igual a la versión de 20260920000008 (teléfono sano), más la rama del canal.
create or replace function public.on_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trial_days integer;
  v_phone      text;
  v_canal      text;
begin
  select trial_days into v_trial_days from public.app_config where id;

  -- Solo dígitos y con tope. Un número de 19 cifras no existe en ningún país donde estamos.
  v_phone := left(
    regexp_replace(coalesce(new.raw_user_meta_data ->> 'phone', ''), '\D', '', 'g'),
    12
  );

  insert into public.user_profiles (id, full_name, phone_country, phone, accepted_terms_at, terms_version)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'Sin nombre'),
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'phone_country'), ''), ''),
    v_phone,
    case when new.raw_user_meta_data ->> 'accepted_terms' = 'true' then now() end,
    new.raw_user_meta_data ->> 'terms_version'
  )
  on conflict (id) do nothing;

  select cc.canal into v_canal
    from public.canal_correos cc
   where cc.email = lower(btrim(new.email));

  if v_canal is not null then
    -- Médico de un socio: sin prueba, activo desde ya. Lo que paga lo cobra el socio.
    insert into public.subscriptions (user_id, status, trial_ends_at, canal)
    values (new.id, 'active', null, v_canal)
    on conflict (user_id) do nothing;
  else
    -- La prueba arranca al registrarse, no al poner la tarjeta.
    insert into public.subscriptions (user_id, status, trial_ends_at)
    values (new.id, 'trialing', now() + make_interval(days => coalesce(v_trial_days, 30)))
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 4. Quién dicta: el canal de un socio se mira por el interruptor, no por fechas
-- ---------------------------------------------------------------------------------------------
-- Igual a la versión de 20260920000006 (cancelar al final), más la rama del canal. Para un socio
-- no hay fechas que mirar: dicta si status = 'active', y si lo pausamos (`socio_pausar`) la app
-- recibe `subscription_inactive`, que ya sabe tratar: no cae al motor local (ver
-- CODIGOS_SIN_PERMISO en proxy.rs) y muestra el aviso de "habla con tu proveedor".
create or replace function public.authorize_device_v2(p_token_hash text)
returns table (
  device_id   uuid,
  user_id     uuid,
  used_today  integer,
  daily_quota integer,
  allowed     boolean,
  reason      text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quota    integer;
  v_requiere boolean;
  v_dev_id   uuid;
  v_revoked  boolean;
  v_owner    uuid;
  v_usados   integer;
  v_status   text;
  v_trial    timestamptz;
  v_periodo  timestamptz;
  v_canal    text;
  -- Hasta cuándo tiene derecho a dictar, venga de la prueba o de lo pagado.
  v_hasta    timestamptz;
begin
  select ac.daily_quota, ac.require_account
    into v_quota, v_requiere
    from public.app_config ac
   where ac.id;

  v_quota := coalesce(v_quota, 500);

  select dv.id, dv.revoked, dv.user_id
    into v_dev_id, v_revoked, v_owner
    from public.devices dv
   where dv.token_hash = p_token_hash;

  if v_dev_id is null then
    return query select null::uuid, null::uuid, 0, v_quota, false, 'unauthorized'::text;
    return;
  end if;

  if v_revoked then
    return query select v_dev_id, v_owner, 0, v_quota, false, 'unauthorized'::text;
    return;
  end if;

  v_usados := public.device_usage_today(v_dev_id);

  if v_usados >= v_quota then
    return query select v_dev_id, v_owner, v_usados, v_quota, false, 'quota_exceeded'::text;
    return;
  end if;

  if v_owner is null then
    if coalesce(v_requiere, false) then
      return query select v_dev_id, null::uuid, v_usados, v_quota, false, 'no_account'::text;
    else
      return query select v_dev_id, null::uuid, v_usados, v_quota, true, null::text;
    end if;
    return;
  end if;

  select s.status, s.trial_ends_at, s.current_period_end, s.canal
    into v_status, v_trial, v_periodo, v_canal
    from public.subscriptions s
   where s.user_id = v_owner;

  if v_status is null then
    return query select v_dev_id, v_owner, v_usados, v_quota, false, 'subscription_missing'::text;
    return;
  end if;

  -- Canal de un socio: el socio cobra, nosotros solo miramos el interruptor.
  if v_canal is distinct from 'directo' then
    if v_status = 'active' then
      return query select v_dev_id, v_owner, v_usados, v_quota, true, null::text;
    else
      return query select v_dev_id, v_owner, v_usados, v_quota, false, 'subscription_inactive'::text;
    end if;
    return;
  end if;

  v_hasta := greatest(coalesce(v_periodo, v_trial), coalesce(v_trial, v_periodo));

  -- ⚠️ LA FECHA MANDA SOBRE EL ESTADO (ver 20260920000006).
  if v_hasta is not null and v_hasta > now() then
    return query select v_dev_id, v_owner, v_usados, v_quota, true, null::text;
    return;
  end if;

  if v_status = 'past_due' then
    return query select v_dev_id, v_owner, v_usados, v_quota, true, null::text;
    return;
  end if;

  if v_status = 'active' and v_periodo is null then
    return query select v_dev_id, v_owner, v_usados, v_quota, true, null::text;
    return;
  end if;

  if v_status = 'trialing' then
    return query select v_dev_id, v_owner, v_usados, v_quota, false, 'trial_ended'::text;
    return;
  end if;

  return query select v_dev_id, v_owner, v_usados, v_quota, false, 'subscription_inactive'::text;
end;
$$;

revoke all on function public.authorize_device_v2(text) from public, anon, authenticated;
grant execute on function public.authorize_device_v2(text) to service_role;

-- ---------------------------------------------------------------------------------------------
-- 5. Lo que usamos nosotros (SQL editor de Supabase, o rpc con la llave de servicio)
-- ---------------------------------------------------------------------------------------------
--   select socio_autorizar('medica@clinica.com');           -- alta (o reactivar)
--   select socio_pausar('medica@clinica.com');              -- baja: deja de dictar
--   select * from socio_medicos order by canal, email;     -- lista y uso del mes (para facturar)

/** Alta de un médico del socio. Si ya tiene cuenta, la pasa al canal y la activa. */
create or replace function public.socio_autorizar(p_email text, p_canal text default 'gmedic', p_nota text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email  text := lower(btrim(p_email));
  v_user   uuid;
  v_stripe text;
begin
  insert into public.canal_correos (email, canal, nota)
  values (v_email, p_canal, p_nota)
  on conflict (email) do update
    set canal = excluded.canal, nota = coalesce(excluded.nota, public.canal_correos.nota);

  select u.id into v_user from auth.users u where lower(u.email) = v_email;
  if v_user is null then
    return 'autorizado: entrará activo, sin prueba, cuando se registre con ese correo';
  end if;

  select s.stripe_subscription_id into v_stripe from public.subscriptions s where s.user_id = v_user;
  update public.subscriptions
     set canal = p_canal, status = 'active', cancel_at_period_end = false, updated_at = now()
   where user_id = v_user;

  if v_stripe is not null then
    return 'activado. ⚠️ tenía una suscripción directa en Stripe: cancelarla a mano en Stripe para que no pague dos veces';
  end if;
  return 'activado: ya tenía cuenta, desde ya dicta por el canal ' || p_canal;
end;
$$;

/** Baja de un médico del socio: deja de dictar. Si no se había registrado, sale de la lista. */
create or replace function public.socio_pausar(p_email text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(p_email));
  v_user  uuid;
  v_n     integer;
begin
  delete from public.canal_correos where email = v_email;

  select u.id into v_user from auth.users u where lower(u.email) = v_email;
  if v_user is null then
    return 'quitado de la lista (no se había registrado)';
  end if;

  update public.subscriptions
     set status = 'canceled', updated_at = now()
   where user_id = v_user and canal <> 'directo';
  get diagnostics v_n = row_count;
  if v_n = 0 then
    return '⚠️ esa cuenta es de venta directa, no de un socio: no se tocó';
  end if;
  return 'pausado: deja de dictar desde ya';
end;
$$;

revoke all on function public.socio_autorizar(text, text, text) from public, anon, authenticated;
revoke all on function public.socio_pausar(text) from public, anon, authenticated;
grant execute on function public.socio_autorizar(text, text, text) to service_role;
grant execute on function public.socio_pausar(text) to service_role;

/** Médicos de los socios con su uso del mes en curso: la base para conciliar la factura. */
create or replace view public.socio_medicos as
select
  s.canal,
  u.email,
  p.full_name,
  s.status,
  (select count(*)
     from public.usage_events e join public.devices d on d.id = e.device_id
    where d.user_id = s.user_id and e.kind = 'transcribe' and e.ok
      and e.created_at >= date_trunc('month', now())) as dictados_mes,
  (select round(coalesce(sum(e.audio_seconds), 0) / 60)
     from public.usage_events e join public.devices d on d.id = e.device_id
    where d.user_id = s.user_id and e.kind = 'transcribe' and e.ok
      and e.created_at >= date_trunc('month', now())) as minutos_mes,
  (select max(e.created_at)
     from public.usage_events e join public.devices d on d.id = e.device_id
    where d.user_id = s.user_id) as ultimo_uso
from public.subscriptions s
join auth.users u on u.id = s.user_id
left join public.user_profiles p on p.id = s.user_id
where s.canal <> 'directo'
union all
-- Autorizados que todavía no se registran.
select cc.canal, cc.email, null, 'sin registrarse', 0, 0, null
from public.canal_correos cc
where not exists (select 1 from auth.users u where lower(u.email) = cc.email);

revoke all on public.socio_medicos from anon, authenticated;
grant select on public.socio_medicos to service_role;

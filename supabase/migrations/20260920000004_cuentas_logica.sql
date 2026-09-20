-- CloseLabs Voice — Fase 2: alta de cuenta, vínculo de dispositivos y permiso de dictado.

-- ---------------------------------------------------------------------------------------------
-- Al crearse una cuenta: perfil + suscripción de prueba, en el mismo acto
-- ---------------------------------------------------------------------------------------------
-- Va como disparador sobre `auth.users` y no como dos llamadas desde la app por una razón
-- concreta: si el registro crea la cuenta y luego falla al crear el perfil, queda un médico que
-- puede iniciar sesión y no existe para el resto del sistema. Aquí o pasa todo o no pasa nada.
--
-- El nombre y el teléfono viajan en los metadatos del registro (`options.data` del cliente).
create or replace function public.on_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trial_days integer;
begin
  select trial_days into v_trial_days from public.app_config where id;

  insert into public.user_profiles (id, full_name, phone_country, phone, accepted_terms_at, terms_version)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'Sin nombre'),
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'phone_country'), ''), ''),
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'phone'), ''), ''),
    case when new.raw_user_meta_data ->> 'accepted_terms' = 'true' then now() end,
    new.raw_user_meta_data ->> 'terms_version'
  )
  on conflict (id) do nothing;

  -- La prueba arranca al registrarse, no al poner la tarjeta. Stripe escribirá encima sus
  -- propias fechas cuando se conecte; mientras tanto esto ya permite dictar.
  insert into public.subscriptions (user_id, status, trial_ends_at)
  values (new.id, 'trialing', now() + make_interval(days => coalesce(v_trial_days, 30)))
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.on_auth_user_created();

-- ---------------------------------------------------------------------------------------------
-- Vincular un dispositivo a una cuenta
-- ---------------------------------------------------------------------------------------------
-- Devuelve el resultado en vez de lanzar excepción: "llegaste al tope de equipos" no es un error
-- del programa, es una respuesta que el médico tiene que poder leer y resolver.
create or replace function public.link_device(
  p_token_hash text,
  p_user_id    uuid,
  p_label      text default null
)
returns table (ok boolean, motivo text, usados integer, tope integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tope    integer;
  v_device  uuid;
  v_dueno   uuid;
  v_usados  integer;
begin
  select max_devices into v_tope from public.app_config where id;
  v_tope := coalesce(v_tope, 2);

  select id, user_id into v_device, v_dueno
    from public.devices
   where token_hash = p_token_hash and not revoked;

  if v_device is null then
    return query select false, 'dispositivo_desconocido', 0, v_tope;
    return;
  end if;

  -- Ya es suyo: vincular otra vez es una operación inocua (reinstaló, volvió a entrar). No
  -- consume un cupo nuevo ni molesta con un error.
  if v_dueno = p_user_id then
    update public.devices set label = coalesce(p_label, label) where id = v_device;
    select count(*) into v_usados from public.devices
     where user_id = p_user_id and not revoked;
    return query select true, 'ya_vinculado', v_usados, v_tope;
    return;
  end if;

  -- De otra persona. No se roba en silencio: hay que desvincularlo desde la otra cuenta.
  if v_dueno is not null then
    return query select false, 'de_otra_cuenta', 0, v_tope;
    return;
  end if;

  select count(*) into v_usados from public.devices
   where user_id = p_user_id and not revoked;

  if v_usados >= v_tope then
    return query select false, 'tope_alcanzado', v_usados, v_tope;
    return;
  end if;

  update public.devices
     set user_id = p_user_id, linked_at = now(), label = p_label
   where id = v_device;

  return query select true, 'vinculado', v_usados + 1, v_tope;
end;
$$;

-- Soltar un equipo para hacerle sitio a otro. Solo el dueño, y se revoca el token: el equipo
-- liberado deja de dictar de inmediato, que es justo lo que el médico espera al quitarlo.
create or replace function public.unlink_device(p_device_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  update public.devices
     set user_id = null, linked_at = null, revoked = true
   where id = p_device_id and user_id = p_user_id
  returning true;
$$;

-- ---------------------------------------------------------------------------------------------
-- ¿Puede dictar este dispositivo?
-- ---------------------------------------------------------------------------------------------
-- Sustituye a `authorize_device`. Se crea con nombre nuevo en vez de reemplazarla porque cambia
-- el tipo de retorno: hacerlo en caliente dejaría a los médicos que están dictando ahora mismo
-- con un error de segundos. La vieja se borra en una migración posterior, cuando la función
-- desplegada ya use esta.
--
-- Toda la regla vive aquí y no en el borde: una sola ida a la base por dictado (medido en la
-- Fase 1: separarlo costaba ~1 s al médico) y un único sitio donde está escrito quién puede.
create or replace function public.authorize_device_v2(p_token_hash text)
returns table (
  device_id   uuid,
  user_id     uuid,
  used_today  integer,
  daily_quota integer,
  allowed     boolean,
  -- Vocabulario CERRADO; la app traduce cada uno a un mensaje. Nulo cuando sí puede.
  reason      text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  c            record;
  d            record;
  v_usados     integer;
  v_sub        record;
begin
  select daily_quota, require_account into c from public.app_config where id;

  select dv.id, dv.revoked, dv.user_id into d
    from public.devices dv where dv.token_hash = p_token_hash;

  if d.id is null then
    return query select null::uuid, null::uuid, 0, coalesce(c.daily_quota, 500), false, 'unauthorized';
    return;
  end if;

  if d.revoked then
    return query select d.id, d.user_id, 0, c.daily_quota, false, 'unauthorized';
    return;
  end if;

  select public.device_usage_today(d.id) into v_usados;

  if v_usados >= c.daily_quota then
    return query select d.id, d.user_id, v_usados, c.daily_quota, false, 'quota_exceeded';
    return;
  end if;

  -- Instalación anterior a la Fase 2. Mientras el interruptor esté apagado sigue dictando: son
  -- los testers que ya tienen la app puesta y no vamos a dejarlos mudos a mitad de consulta por
  -- un despliegue nuestro.
  if d.user_id is null then
    if coalesce(c.require_account, false) then
      return query select d.id, null::uuid, v_usados, c.daily_quota, false, 'no_account';
    else
      return query select d.id, null::uuid, v_usados, c.daily_quota, true, null::text;
    end if;
    return;
  end if;

  select status, trial_ends_at, current_period_end into v_sub
    from public.subscriptions where user_id = d.user_id;

  if v_sub.status is null then
    return query select d.id, d.user_id, v_usados, c.daily_quota, false, 'subscription_missing';
    return;
  end if;

  -- `trialing` y `active` dictan. `past_due` TAMBIÉN, y es deliberado: un cobro rechazado suele
  -- ser una tarjeta vencida, no alguien que se quiere ir. Cortarle el dictado a un médico en
  -- consulta por eso es perder al cliente que estaba a un clic de seguir pagando; Stripe
  -- reintenta varios días y en ese plazo lo que toca es avisar, no bloquear.
  if v_sub.status in ('trialing', 'active', 'past_due') then
    -- Salvo que la prueba ya haya vencido sin que Stripe haya movido el estado.
    if v_sub.status = 'trialing' and v_sub.trial_ends_at is not null
       and v_sub.trial_ends_at < now() then
      return query select d.id, d.user_id, v_usados, c.daily_quota, false, 'trial_ended';
      return;
    end if;
    return query select d.id, d.user_id, v_usados, c.daily_quota, true, null::text;
    return;
  end if;

  return query select d.id, d.user_id, v_usados, c.daily_quota, false, 'subscription_inactive';
end;
$$;

revoke all on function public.link_device(text, uuid, text)   from public, anon, authenticated;
revoke all on function public.unlink_device(uuid, uuid)       from public, anon, authenticated;
revoke all on function public.authorize_device_v2(text)       from public, anon, authenticated;
grant execute on function public.link_device(text, uuid, text) to service_role;
grant execute on function public.unlink_device(uuid, uuid)     to service_role;
grant execute on function public.authorize_device_v2(text)     to service_role;

comment on function public.authorize_device_v2 is
  'Única fuente de "¿puede dictar este dispositivo?": cupo diario, cuenta y suscripción, en una sola ida a la base. `reason` usa vocabulario cerrado; nulo cuando sí puede.';

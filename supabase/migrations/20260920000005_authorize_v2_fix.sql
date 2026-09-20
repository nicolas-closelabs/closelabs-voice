-- CloseLabs Voice — corrige `authorize_device_v2`: nombres ambiguos.
--
-- La función declara columnas de salida (`daily_quota`, `user_id`…) que se llaman igual que
-- columnas de las tablas que consulta. PL/pgSQL no adivina cuál es cuál y aborta con
-- «column reference "daily_quota" is ambiguous» — en tiempo de EJECUCIÓN, no al crearla, que es
-- por lo que la migración anterior se aplicó sin quejarse.
--
-- La cura es aliar cada tabla y calificar toda referencia. Se deja así de explícito a propósito:
-- esta función decide quién puede dictar, y un fallo aquí deja a un médico mudo.
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
  v_quota   integer;
  v_requiere boolean;
  v_dev_id  uuid;
  v_revoked boolean;
  v_owner   uuid;
  v_usados  integer;
  v_status  text;
  v_trial   timestamptz;
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

  -- Instalación anterior a la Fase 2. Mientras el interruptor esté apagado sigue dictando: son
  -- los testers que ya tienen la app puesta, y no vamos a dejarlos mudos por un despliegue.
  if v_owner is null then
    if coalesce(v_requiere, false) then
      return query select v_dev_id, null::uuid, v_usados, v_quota, false, 'no_account'::text;
    else
      return query select v_dev_id, null::uuid, v_usados, v_quota, true, null::text;
    end if;
    return;
  end if;

  select s.status, s.trial_ends_at
    into v_status, v_trial
    from public.subscriptions s
   where s.user_id = v_owner;

  if v_status is null then
    return query select v_dev_id, v_owner, v_usados, v_quota, false, 'subscription_missing'::text;
    return;
  end if;

  -- `past_due` TAMBIÉN dicta, y es deliberado: un cobro rechazado suele ser una tarjeta vencida,
  -- no alguien que se quiere ir. Cortarle el dictado a un médico en consulta por eso es perder
  -- al cliente que estaba a un clic de seguir pagando. Stripe reintenta varios días; en ese
  -- plazo lo que toca es avisar, no bloquear.
  if v_status in ('trialing', 'active', 'past_due') then
    if v_status = 'trialing' and v_trial is not null and v_trial < now() then
      return query select v_dev_id, v_owner, v_usados, v_quota, false, 'trial_ended'::text;
      return;
    end if;
    return query select v_dev_id, v_owner, v_usados, v_quota, true, null::text;
    return;
  end if;

  return query select v_dev_id, v_owner, v_usados, v_quota, false, 'subscription_inactive'::text;
end;
$$;

revoke all on function public.authorize_device_v2(text) from public, anon, authenticated;
grant execute on function public.authorize_device_v2(text) to service_role;

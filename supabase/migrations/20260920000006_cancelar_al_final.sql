-- CloseLabs Voice — cancelar NO corta el servicio: lo corta el calendario.
--
-- La regla, decidida con el cliente: quien cancela el día 15 de una prueba de 30 sigue dictando
-- hasta el día 30. Quien pagó un mes y cancela el día 10 sigue hasta el día 30. **Nunca se pierde
-- a mitad de período**, ni en prueba ni pagando.
--
-- Por qué importa más de lo que parece: un médico que cancela y se queda sin dictar el mismo día
-- siente que le quitaron algo que ya había pagado, y eso lo cuenta. Un médico que cancela y
-- sigue trabajando dos semanas tiene dos semanas para cambiar de opinión. El coste nuestro son
-- unos centavos de transcripción; el beneficio es no convertir una baja en una queja.
--
-- ---------------------------------------------------------------------------------------------
-- Por qué esto no se resuelve solo con el estado de Stripe
-- ---------------------------------------------------------------------------------------------
-- En el camino feliz, Stripe ya hace lo correcto: al cancelar deja `cancel_at_period_end = true`
-- y **mantiene** el estado en `trialing`/`active` hasta que el período vence de verdad. Si solo
-- confiáramos en eso, bastaría con lo que ya había.
--
-- Pero el estado llega por un webhook, y un webhook puede perderse, llegar tarde o adelantado.
-- Si alguna vez nos llega `canceled` antes de que termine el período pagado, la versión anterior
-- de esta función dejaba al médico sin dictar ESE MISMO INSTANTE — cobrándole un mes que no
-- puede usar. Así que la fecha manda sobre el estado: mientras el período siga vivo, se dicta.

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

  select s.status, s.trial_ends_at, s.current_period_end
    into v_status, v_trial, v_periodo
    from public.subscriptions s
   where s.user_id = v_owner;

  if v_status is null then
    return query select v_dev_id, v_owner, v_usados, v_quota, false, 'subscription_missing'::text;
    return;
  end if;

  -- El período vigente: lo pagado si lo hay, si no lo que quede de prueba. Se toma el mayor de
  -- los dos porque durante la prueba con tarjeta Stripe rellena ambos, y quedarse con el menor
  -- recortaría días que el médico sí tiene.
  v_hasta := greatest(coalesce(v_periodo, v_trial), coalesce(v_trial, v_periodo));

  -- ⚠️ LA FECHA MANDA SOBRE EL ESTADO. Mientras el período siga vivo se dicta, aunque el estado
  -- ya diga `canceled`: quien canceló el día 10 pagó hasta el 30 y hasta el 30 dicta.
  if v_hasta is not null and v_hasta > now() then
    return query select v_dev_id, v_owner, v_usados, v_quota, true, null::text;
    return;
  end if;

  -- Pasada esa fecha, manda el estado. `past_due` sigue dictando: un cobro rechazado casi
  -- siempre es una tarjeta vencida, no alguien que se quiere ir, y Stripe reintenta varios días.
  -- Cortarle el dictado a un médico en consulta por eso es perder al cliente que estaba a un
  -- clic de seguir pagando.
  if v_status = 'past_due' then
    return query select v_dev_id, v_owner, v_usados, v_quota, true, null::text;
    return;
  end if;

  -- `active` sin fecha de período es un estado imposible salvo error nuestro; se deja dictar y
  -- que lo delate el registro, antes que bloquear a alguien que está pagando.
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

-- Tres equipos, no dos: el médico con consultorio, casa y portátil es el caso normal.
update public.app_config set max_devices = 3 where id;

comment on column public.app_config.max_devices is
  'Instalaciones activas por cuenta. Tres: consultorio, casa y portátil es el caso normal, no el sospechoso.';

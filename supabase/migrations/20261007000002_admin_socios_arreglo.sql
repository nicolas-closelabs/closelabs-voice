-- CloseLabs Voice — arreglo de 20261007000001 (encontrado probando la página de administración).
--
-- 1. Dar de alta dos veces a alguien que todavía no se registra dejaba DOS altas en el historial.
--    Con alguien registrado ya se evitaba; ahora también sin registrarse.
-- 2. Se borran los registros que dejó esa prueba (cuentas `nicolas+prueba-…@closelabs.co`): si no,
--    salían en la facturación de octubre de 2026. El servidor no puede borrar historial (a
--    propósito: `socio_cambios` solo admite select e insert), por eso va aquí.

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

  select u.id into v_user from auth.users u where lower(u.email) = v_email;

  -- Ya autorizado y sin registrarse: nada que cambiar ni registrar (antes dejaba una segunda alta
  -- en el historial, que es la base para facturar).
  if v_user is null and exists (
    select 1 from public.canal_correos cc where cc.email = v_email and cc.canal = p_canal
  ) then
    return 'ya estaba autorizado: entrará activo cuando se registre';
  end if;

  insert into public.canal_correos (email, canal, nota)
  values (v_email, p_canal, p_nota)
  on conflict (email) do update
    set canal = excluded.canal, nota = coalesce(excluded.nota, public.canal_correos.nota);

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

revoke all on function public.socio_autorizar(text, text, text, text) from public, anon, authenticated;
grant execute on function public.socio_autorizar(text, text, text, text) to service_role;

delete from public.socio_cambios where email like 'nicolas+prueba-%@closelabs.co';

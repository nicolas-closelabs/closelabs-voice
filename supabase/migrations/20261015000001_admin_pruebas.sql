-- CloseLabs Voice — extender o cortar la prueba gratis de una cuenta, sin SQL.
--
-- Pedido por Nicolás (2026-10-15): mientras estamos en pruebas, darle acceso a un médico por unos
-- días más (o a la cuenta demo, que hoy usa un médico) y cortárselo cuando termine, él mismo, desde
-- closelabs.co/voice/admin. Antes era un `update subscriptions set trial_ends_at = …` a mano.
--
-- Solo venta directa y solo cuentas SIN suscripción en Stripe: a quien ya puso tarjeta, la fecha de
-- cobro la maneja Stripe, y mover aquí la prueba no movería su cobro. Los de gMedic tienen su propio
-- interruptor (alta y pausa).
--
-- Quién dicta lo sigue decidiendo `authorize_device_v2` con la fecha: extender es poner una fecha
-- más adelante y cortar es ponerla en este momento. Nada más cambia.

-- ---------------------------------------------------------------------------------------------
-- 1. Historial: quién extendió o cortó qué y cuándo
-- ---------------------------------------------------------------------------------------------
create table public.prueba_cambios (
  id        bigint generated always as identity primary key,
  email     text        not null,
  accion    text        not null check (accion in ('extender', 'cortar')),
  hasta     timestamptz not null,
  resultado text        not null,
  por       text        not null,
  at        timestamptz not null default now()
);

create index prueba_cambios_email_idx on public.prueba_cambios (email, at desc);

alter table public.prueba_cambios enable row level security;
revoke all on table public.prueba_cambios from anon, authenticated;
grant select, insert on table public.prueba_cambios to service_role;

-- ---------------------------------------------------------------------------------------------
-- 2. Extender (fecha futura) o cortar (fecha pasada o ahora)
-- ---------------------------------------------------------------------------------------------
create or replace function public.prueba_ajustar(p_email text, p_hasta timestamptz, p_por text default 'sql')
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email     text := lower(btrim(p_email));
  v_user      uuid;
  v_canal     text;
  v_stripe    text;
  v_antes     timestamptz;
  v_cortar    boolean := p_hasta <= now();
  v_hasta     timestamptz := case when p_hasta <= now() then now() else p_hasta end;
  v_resultado text;
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return '⚠️ no parece un correo: no se hizo nada';
  end if;

  select u.id into v_user from auth.users u where lower(u.email) = v_email;
  if v_user is null then
    return '⚠️ no hay ninguna cuenta con ese correo: primero tiene que crearla en la app (trae 30 días gratis)';
  end if;

  select s.canal, s.stripe_subscription_id, s.trial_ends_at
    into v_canal, v_stripe, v_antes
    from public.subscriptions s where s.user_id = v_user;
  if not found then
    return '⚠️ esa cuenta no tiene suscripción: no se hizo nada';
  end if;
  if v_canal <> 'directo' then
    return '⚠️ esa cuenta es de ' || v_canal || ': se maneja con «Dar de alta» y «Pausar», no con prueba';
  end if;
  if v_stripe is not null then
    return '⚠️ esa cuenta ya tiene una suscripción en Stripe: no se tocó (su cobro lo maneja Stripe)';
  end if;
  if v_cortar and (v_antes is null or v_antes <= now()) then
    return 'su prueba ya había terminado: no cambió nada';
  end if;

  update public.subscriptions
     set status = 'trialing',
         trial_ends_at = v_hasta,
         -- Al extender, los avisos de fin de prueba vuelven a contar desde la fecha nueva. Al cortar
         -- se dan por enviados: es un corte nuestro, no el final normal de una prueba, y el correo
         -- de "tu prueba terminó, suscríbete" no corresponde (ni sirve mientras Stripe esté en
         -- modo de prueba).
         aviso_prueba_quedan_at  = case when v_cortar then coalesce(aviso_prueba_quedan_at, now())  else null end,
         aviso_prueba_termino_at = case when v_cortar then coalesce(aviso_prueba_termino_at, now()) else null end,
         updated_at = now()
   where user_id = v_user;

  v_resultado := case
    when v_cortar then 'prueba cortada: deja de dictar desde ya'
    else 'prueba extendida hasta el ' || to_char(v_hasta at time zone 'America/Bogota', 'DD/MM/YYYY')
  end;

  insert into public.prueba_cambios (email, accion, hasta, resultado, por)
  values (v_email, case when v_cortar then 'cortar' else 'extender' end, v_hasta, v_resultado, coalesce(p_por, 'sql'));
  return v_resultado;
end;
$$;

revoke all on function public.prueba_ajustar(text, timestamptz, text) from public, anon, authenticated;
grant execute on function public.prueba_ajustar(text, timestamptz, text) to service_role;

-- ---------------------------------------------------------------------------------------------
-- 3. Las cuentas a las que se les ha extendido o cortado la prueba, con su estado de hoy
-- ---------------------------------------------------------------------------------------------
create or replace function public.pruebas_ajustadas()
returns table (
  email          text,
  full_name      text,
  estado         text,
  trial_ends_at  timestamptz,
  ultima_accion  text,
  ultima_por     text,
  ultima_at      timestamptz,
  dictados_30d   bigint,
  ultimo_uso     timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with ultimo as (
    select distinct on (c.email) c.email, c.accion, c.por, c.at
      from public.prueba_cambios c
     order by c.email, c.at desc
  )
  select
    x.email,
    p.full_name,
    case
      when u.id is null then 'cuenta eliminada'
      when s.stripe_subscription_id is not null then 'suscrito'
      when s.canal <> 'directo' then 'pasó a ' || s.canal
      when s.trial_ends_at > now() then 'en prueba'
      else 'terminada'
    end,
    s.trial_ends_at,
    x.accion, x.por, x.at,
    (select count(*) from public.usage_events e join public.devices d on d.id = e.device_id
      where d.user_id = u.id and e.kind = 'transcribe' and e.ok
        and e.created_at >= now() - interval '30 days'),
    (select max(e.created_at) from public.usage_events e join public.devices d on d.id = e.device_id
      where d.user_id = u.id)
  from ultimo x
  left join auth.users u on lower(u.email) = x.email
  left join public.subscriptions s on s.user_id = u.id
  left join public.user_profiles p on p.id = u.id
  order by (s.trial_ends_at > now()) desc nulls last, s.trial_ends_at desc nulls last, x.email;
$$;

revoke all on function public.pruebas_ajustadas() from public, anon, authenticated;
grant execute on function public.pruebas_ajustadas() to service_role;

-- La cuenta demo ya se extendió a mano el 2026-10-15 (hasta el 31 de diciembre). Se anota aquí para
-- que aparezca en la página desde el primer día.
insert into public.prueba_cambios (email, accion, hasta, resultado, por, at)
select 'demo@closelabs.co', 'extender', s.trial_ends_at,
       'prueba extendida hasta el ' || to_char(s.trial_ends_at at time zone 'America/Bogota', 'DD/MM/YYYY'),
       'nicolas@closelabs.co (vía SQL)', now()
  from public.subscriptions s join auth.users u on u.id = s.user_id
 where lower(u.email) = 'demo@closelabs.co'
   and not exists (select 1 from public.prueba_cambios where email = 'demo@closelabs.co');

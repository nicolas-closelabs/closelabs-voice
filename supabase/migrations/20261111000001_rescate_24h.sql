-- CloseLabs Voice — rescate a las 24 horas (plan del primer uso aprobado por Nicolás, 2026-11-11).
--
-- Quien se registró hace más de un día y todavía no ha hecho NI UN dictado recibe UN correo:
--   - si no confirmó el correo: cómo terminar (entrar y escribir el código de 6 números);
--   - si confirmó: cómo hacer el primer dictado, y WhatsApp para ayudarle.
-- A los dos canales (venta directa y gMedic): el médico de gMedic también se puede quedar atascado.
--
-- Ventana: entre 24 y 72 horas después del registro. El envío es diario (9:00 en Bogotá), así que
-- cada quien cae una vez entre las 24 y las 48 h; el resto de la ventana es por si un día falla.
--
-- Va en la misma lista (`recordatorios_pendientes`) y la misma tarea diaria que los avisos de fin de
-- la prueba: se revisa con un `select` sin mandarle correo a nadie.

alter table public.subscriptions
  add column if not exists aviso_rescate_at timestamptz;

-- Cambia lo que devuelve (columna `confirmado`): hay que borrarla y crearla de nuevo.
drop function if exists public.recordatorios_pendientes();

create function public.recordatorios_pendientes()
returns table (
  user_id       uuid,
  email         text,
  full_name     text,
  tipo          text,
  trial_ends_at timestamptz,
  dictados      bigint,
  minutos       numeric,
  confirmado    boolean
)
language sql
stable
security definer
set search_path = public
as $$
  -- Fin de la prueba (igual que en 20261007000005).
  select s.user_id, u.email::text, p.full_name,
         case when s.trial_ends_at > now() then 'quedan' else 'termino' end,
         s.trial_ends_at,
         uso.dictados, round(uso.segundos / 60),
         true
    from public.subscriptions s
    join auth.users u on u.id = s.user_id
    left join public.user_profiles p on p.id = s.user_id
    cross join lateral public.uso_de_la_cuenta(s.user_id) uso
   where s.canal = 'directo'
     and s.status = 'trialing'
     and s.stripe_subscription_id is null
     and u.email_confirmed_at is not null
     and (
       (s.trial_ends_at > now() and s.trial_ends_at <= now() + interval '3 days'
          and s.aviso_prueba_quedan_at is null)
       or
       (s.trial_ends_at <= now() and s.trial_ends_at > now() - interval '3 days'
          and s.aviso_prueba_termino_at is null)
     )

  union all

  -- Rescate: se registró hace 1-3 días y no ha dictado nunca.
  select s.user_id, u.email::text, p.full_name,
         'rescate',
         s.trial_ends_at,
         uso.dictados, round(uso.segundos / 60),
         u.email_confirmed_at is not null
    from public.subscriptions s
    join auth.users u on u.id = s.user_id
    left join public.user_profiles p on p.id = s.user_id
    cross join lateral public.uso_de_la_cuenta(s.user_id) uso
   where u.created_at <= now() - interval '24 hours'
     and u.created_at >  now() - interval '72 hours'
     and s.aviso_rescate_at is null
     and uso.dictados = 0;
$$;

create or replace function public.recordatorio_enviado(p_user_id uuid, p_tipo text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.subscriptions
     set aviso_prueba_quedan_at  = case when p_tipo = 'quedan'  then now() else aviso_prueba_quedan_at end,
         aviso_prueba_termino_at = case when p_tipo = 'termino' then now() else aviso_prueba_termino_at end,
         aviso_rescate_at        = case when p_tipo = 'rescate' then now() else aviso_rescate_at end
   where user_id = p_user_id;
$$;

revoke all on function public.recordatorios_pendientes() from public, anon, authenticated;
revoke all on function public.recordatorio_enviado(uuid, text) from public, anon, authenticated;
grant execute on function public.recordatorios_pendientes() to service_role;
grant execute on function public.recordatorio_enviado(uuid, text) to service_role;

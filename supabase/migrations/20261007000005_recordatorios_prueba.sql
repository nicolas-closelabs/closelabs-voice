-- CloseLabs Voice — avisos por correo de fin de la prueba (pedido por Nicolás, 2026-10-07).
--
-- Solo dos correos, solo a la venta directa (gMedic no tiene prueba), solo a quien no se ha
-- suscrito, y cada uno UNA vez:
--   'quedan'  — cuando le quedan 3 días o menos: la fecha, lo que dictó, cómo suscribirse.
--   'termino' — después de que terminó (hasta 3 días después, por si un día falla el envío).
--
-- La decisión vive aquí (`recordatorios_pendientes`), como en las alertas: se puede revisar con un
-- `select` sin mandarle correo a nadie. La función `recordatorios` solo envía y marca.

alter table public.subscriptions
  add column if not exists aviso_prueba_quedan_at  timestamptz,
  add column if not exists aviso_prueba_termino_at timestamptz;

create or replace function public.recordatorios_pendientes()
returns table (
  user_id       uuid,
  email         text,
  full_name     text,
  tipo          text,
  trial_ends_at timestamptz,
  dictados      bigint,
  minutos       numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select s.user_id, u.email::text, p.full_name,
         case when s.trial_ends_at > now() then 'quedan' else 'termino' end,
         s.trial_ends_at,
         uso.dictados, round(uso.segundos / 60)
    from public.subscriptions s
    join auth.users u on u.id = s.user_id
    left join public.user_profiles p on p.id = s.user_id
    cross join lateral public.uso_de_la_cuenta(s.user_id) uso
   where s.canal = 'directo'
     and s.status = 'trialing'
     and s.stripe_subscription_id is null      -- ya puso tarjeta: no hay nada que recordarle
     and u.email_confirmed_at is not null
     and (
       (s.trial_ends_at > now() and s.trial_ends_at <= now() + interval '3 days'
          and s.aviso_prueba_quedan_at is null)
       or
       (s.trial_ends_at <= now() and s.trial_ends_at > now() - interval '3 days'
          and s.aviso_prueba_termino_at is null)
     );
$$;

create or replace function public.recordatorio_enviado(p_user_id uuid, p_tipo text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.subscriptions
     set aviso_prueba_quedan_at  = case when p_tipo = 'quedan'  then now() else aviso_prueba_quedan_at end,
         aviso_prueba_termino_at = case when p_tipo = 'termino' then now() else aviso_prueba_termino_at end
   where user_id = p_user_id;
$$;

revoke all on function public.recordatorios_pendientes() from public, anon, authenticated;
revoke all on function public.recordatorio_enviado(uuid, text) from public, anon, authenticated;
grant execute on function public.recordatorios_pendientes() to service_role;
grant execute on function public.recordatorio_enviado(uuid, text) to service_role;

-- ---------------------------------------------------------------------------------------------
-- La tarea diaria: 14:00 UTC = 9:00 en Bogotá.
-- ---------------------------------------------------------------------------------------------
-- La tarea lleva un secreto dentro (el de las alertas, `x-alert-secret`), así que no puede
-- escribirse en un repositorio público. Se copia la de las alertas, que ya lo tiene, cambiando solo
-- la función a la que llama. Si la de las alertas no existe, no se crea nada y queda un aviso.
do $$
declare
  v_cmd text;
begin
  select replace(j.command, '/functions/v1/alertas', '/functions/v1/recordatorios')
    into v_cmd
    from cron.job j
   where j.jobname = 'alertas-closelabs';

  if v_cmd is null or v_cmd not like '%/functions/v1/recordatorios%' then
    raise notice 'No encontré la tarea alertas-closelabs (o no llama a /functions/v1/alertas): hay que crear recordatorios-prueba a mano (ver BACKLOG, "Para recrear el cron").';
    return;
  end if;

  if exists (select 1 from cron.job where jobname = 'recordatorios-prueba') then
    perform cron.unschedule('recordatorios-prueba');
  end if;
  perform cron.schedule('recordatorios-prueba', '0 14 * * *', v_cmd);
end;
$$;

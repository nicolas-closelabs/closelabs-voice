-- CloseLabs Voice — autorización en UN solo viaje a la base.
--
-- Por qué: medido contra el proyecto real, el proxy añadía ~2 s por dictado frente a llamar al
-- proveedor directamente. La causa no era el proveedor sino la ida y vuelta: la Edge Function
-- corre en el borde (cerca del médico) y la base está en São Paulo, así que cada consulta cuesta
-- cientos de milisegundos. Hacíamos cinco seguidas antes siquiera de empezar a formatear.
--
-- Esta función junta en una sola llamada todo lo que se necesita ANTES de llamar al proveedor:
-- identificar el dispositivo, ver si está revocado y contar su consumo del día.

create function public.authorize_device (p_token_hash text)
returns table (device_id uuid, revoked boolean, used_today integer, daily_quota integer)
language sql
stable
security definer
set search_path = public
as $$
  select
    d.id,
    d.revoked,
    (select count(*)::integer
       from usage_events u
      where u.device_id = d.id
        and u.ok
        and u.created_at >= date_trunc('day', now())),
    (select c.daily_quota from app_config c)
  from devices d
  where d.token_hash = p_token_hash;
$$;

grant execute on function public.authorize_device (text) to service_role;

-- `last_seen_at` se actualiza aparte y sin esperar respuesta: sirve para saber cuántas
-- instalaciones siguen vivas, y no vale la pena retrasar un dictado por una estadística.
create function public.touch_device (p_device_id uuid)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  update devices set last_seen_at = now() where id = p_device_id;
$$;

grant execute on function public.touch_device (uuid) to service_role;

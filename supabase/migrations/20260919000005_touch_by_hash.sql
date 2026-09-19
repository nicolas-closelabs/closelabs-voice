-- CloseLabs Voice — mantener al día la versión instalada de cada dispositivo.
--
-- `devices.app_version` se escribía UNA sola vez, al registrar la instalación, y nunca más. O sea
-- que quedaba congelada en la versión con la que el médico instaló por primera vez: al mes, la
-- tabla mentía sobre todo el parque.
--
-- Eso importa para una decisión concreta: subir `min_supported_version` deja sin dictar a quien
-- se quede atrás, y no queremos tomar esa decisión mirando datos viejos. Ahora cada consulta de
-- configuración —una por arranque— refresca el dato.
create or replace function public.touch_device_by_hash(
  p_token_hash  text,
  p_app_version text default null
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.devices
     set last_seen_at = now(),
         -- Solo se pisa cuando llega un valor: una llamada sin versión no debe borrar la que hay.
         app_version  = coalesce(nullif(p_app_version, ''), app_version)
   where token_hash = p_token_hash;
$$;

revoke all on function public.touch_device_by_hash(text, text) from public, anon, authenticated;
grant execute on function public.touch_device_by_hash(text, text) to service_role;

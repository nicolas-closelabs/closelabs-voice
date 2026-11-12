-- El médico puede ponerle nombre a cada computador ("Portátil del consultorio").
--
-- Por qué una columna nueva y no reescribir `label`: `label` es el nombre de red del equipo
-- ("Nicolass-MacBook-Air-2.local") y la app lo usa para reconocer cuál de la lista es ESTE
-- computador (`is_this_device` en `auth.rs`). Si el médico lo renombrara, la app dejaría de
-- reconocerse. `nombre` es solo lo que se muestra; si está vacío, la app muestra el de red limpio.
--
-- Aditiva: las versiones viejas de la app no la leen y siguen igual. Desplegar ANTES que la función
-- `account` que la usa (si el código lee una columna que no existe, falla "Mi cuenta").

alter table public.devices
  add column if not exists nombre text
  check (nombre is null or char_length(nombre) between 1 and 40);

comment on column public.devices.nombre is
  'Nombre que el médico le puso al computador en Mi cuenta. Nulo = se muestra el label (nombre de red) limpio.';

-- Renombrar solo un equipo del propio médico y que no esté soltado. Igual que `unlink_device`: la
-- regla de "es tuyo" vive aquí, no en el borde, para que un error en la función no deje renombrar
-- el computador de otro.
create or replace function public.rename_device(p_device_id uuid, p_user_id uuid, p_nombre text)
returns boolean
language sql
security definer
set search_path = public
as $$
  update public.devices
     set nombre = nullif(btrim(p_nombre), '')
   where id = p_device_id and user_id = p_user_id and revoked = false
  returning true;
$$;

revoke all on function public.rename_device(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.rename_device(uuid, uuid, text) to service_role;

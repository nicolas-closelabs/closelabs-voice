-- CloseLabs Voice — quién mandó un reporte, para el correo que avisa de cada uno.
--
-- Hasta el 2026-10-28 los reportes caían en `problem_reports` y nadie se enteraba: el primero
-- de un médico real (gMedic, "al cambiar de pestaña deja de escribir") se vio solo porque
-- Nicolás sabía que lo iban a mandar. Desde ahora `report` manda un correo con cada uno, y
-- para que sirva tiene que decir DE QUIÉN es: el correo de la cuenta y el nombre del equipo.
--
-- `auth.users` no se puede leer por PostgREST; por eso una función con `security definer`,
-- abierta solo a la llave de servicio, como `device_by_hash`.

create or replace function public.reporte_contexto(p_device_id uuid)
returns table (email text, full_name text, label text, interno boolean)
language sql
stable
security definer
set search_path = public
as $$
  select u.email::text, p.full_name, d.label, d.interno
    from public.devices d
    left join auth.users u on u.id = d.user_id
    left join public.user_profiles p on p.id = d.user_id
   where d.id = p_device_id;
$$;

revoke all on function public.reporte_contexto(uuid) from public, anon, authenticated;
grant execute on function public.reporte_contexto(uuid) to service_role;

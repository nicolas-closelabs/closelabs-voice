-- CloseLabs Voice — resolver un dispositivo por su token, sin juzgarlo.
--
-- `authorize_device` ya hace esto, pero además decide si puede dictar: rechaza a los revocados y
-- a los que agotaron el cupo del día. Para "Reportar un problema" eso está al revés — un
-- dispositivo revocado o sin cupo es precisamente el que tiene algo que contarnos, y negarle el
-- reporte nos dejaría sin saber por qué se queja.
--
-- Por eso una función aparte en vez de un parámetro más: que el camino que autoriza sea el
-- estricto siempre, sin banderas que alguien pueda pasar por error desde el camino del dictado.
create or replace function public.device_by_hash(p_token_hash text)
returns table (device_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select id from public.devices where token_hash = p_token_hash;
$$;

revoke all on function public.device_by_hash(text) from public, anon, authenticated;
grant execute on function public.device_by_hash(text) to service_role;

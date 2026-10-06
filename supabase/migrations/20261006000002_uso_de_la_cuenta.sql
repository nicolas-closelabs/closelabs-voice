-- CloseLabs Voice — cuánto dictó un médico, para la pantalla de fin de prueba.
--
-- Decisión de Nicolás (2026-09-30): cuando la prueba termina sin pagar, la app no muestra un
-- error sino una pantalla amable ("gracias por probar") con lo que el médico dictó y UN botón para
-- seguir. Esto da los números: dictados que salieron bien y minutos de audio.
--
-- ⚠️ Solo contadores de `usage_events`, que por diseño no tiene ni audio ni texto (ver
-- `_shared/usage.ts`). Un dictado = un evento de transcripción con ok = true; los intentos fallidos
-- de un proveedor antes del respaldo no cuentan.

create or replace function public.uso_de_la_cuenta(p_user_id uuid)
returns table (dictados bigint, segundos numeric)
language sql
stable
security definer
set search_path = public
as $$
  select count(*), coalesce(sum(u.audio_seconds), 0)
    from public.usage_events u
    join public.devices d on d.id = u.device_id
   where d.user_id = p_user_id
     and u.kind = 'transcribe'
     and u.ok;
$$;

revoke all on function public.uso_de_la_cuenta(uuid) from public, anon, authenticated;
grant execute on function public.uso_de_la_cuenta(uuid) to service_role;

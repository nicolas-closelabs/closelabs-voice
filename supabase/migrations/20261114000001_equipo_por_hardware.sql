-- Reconocer el COMPUTADOR, no solo el token de la instalación (2026-11-14).
--
-- El problema (Nicolás, con su propio Mac): la app guarda UN token por instalación, el de la última
-- cuenta que entró. Al cambiar de cuenta, `link_device` responde `de_otra_cuenta` y la app pide un
-- token nuevo (ver `vincular_este_equipo` en auth.rs); el de la cuenta anterior se pierde en ese
-- computador. Al volver a esa cuenta se crea OTRA fila: "Computadores · 2 de 3" con el mismo Mac dos
-- veces, gastando cupo. Lo mismo al reinstalar borrando los datos de la app. Y como la app no sabía
-- que esa cuenta ya había usado ese computador, le volvía a mostrar el tutorial completo.
--
-- La solución: la app manda `equipo`, un hash del identificador del hardware (IOPlatformUUID en Mac,
-- MachineGuid en Windows; ver `equipo.rs`). No cambia al cambiar de cuenta, al reinstalar ni al
-- borrar los datos. Con él, `link_device`:
--   1. Revoca las filas de ESTA cuenta con el mismo `equipo` (son este mismo computador con un token
--      que ya no existe en él) y hereda el nombre que el médico le había puesto.
--   2. Devuelve `conocido`: si esta cuenta ya había usado este computador. La app lo usa para no
--      repetir el tutorial (solo se muestra la primera vez de una cuenta en un computador).
--
-- Filas viejas (sin `equipo`): cuentan para `conocido` si coinciden nombre de red y plataforma
-- (solo decide si se muestra el tutorial, inocuo si se equivoca), pero NO se revocan por eso: dos
-- computadores del mismo médico pueden llamarse igual y revocar uno vivo lo dejaría sin dictar. El
-- reemplazo por nombre que ya existía al llegar al tope (20260920000007) sigue igual.
--
-- Aditiva y compatible: la función `account` de hoy llama con tres parámetros y sigue funcionando
-- (`p_equipo` es opcional). ⚠️ Desplegar ANTES que la función `account` nueva: esa pide la columna
-- `equipo` en la lista de equipos y, sin ella, "Mi cuenta" fallaría.

alter table public.devices add column if not exists equipo text
  check (equipo is null or equipo ~ '^[0-9a-f]{32}$');

comment on column public.devices.equipo is
  'Hash (32 hex) del identificador del hardware del computador, calculado por la app. Igual entre cuentas, reinstalaciones y borrado de datos. Nulo en filas de versiones viejas.';

create index if not exists devices_usuario_equipo
  on public.devices (user_id, equipo) where equipo is not null;

-- El tipo de retorno cambia (nueva columna `conocido`): hay que borrar la anterior.
drop function if exists public.link_device(text, uuid, text);

create function public.link_device(
  p_token_hash text,
  p_user_id    uuid,
  p_label      text default null,
  p_equipo     text default null
)
returns table (ok boolean, motivo text, usados integer, tope integer, conocido boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tope       integer;
  v_idle       integer;
  v_device     uuid;
  v_dueno      uuid;
  v_plataforma text;
  v_usados     integer;
  v_victima    uuid;
  v_soltados   integer;
  v_equipo     text := case when p_equipo ~ '^[0-9a-f]{32}$' then p_equipo end;
  v_conocido   boolean := false;
  v_nombre     text;
begin
  select ac.max_devices, ac.device_idle_days
    into v_tope, v_idle
    from public.app_config ac where ac.id;
  v_tope := coalesce(v_tope, 3);
  v_idle := coalesce(v_idle, 90);

  select dv.id, dv.user_id, dv.platform
    into v_device, v_dueno, v_plataforma
    from public.devices dv
   where dv.token_hash = p_token_hash and not dv.revoked;

  if v_device is null then
    return query select false, 'dispositivo_desconocido', 0, v_tope, false;
    return;
  end if;

  -- Ya es suyo: volvió a entrar con el mismo token. Inocuo, no gasta cupo.
  if v_dueno = p_user_id then
    update public.devices
       set label = coalesce(p_label, label), equipo = coalesce(v_equipo, equipo)
     where id = v_device;
    select count(*) into v_usados
      from public.devices where user_id = p_user_id and not revoked;
    return query select true, 'ya_vinculado', v_usados, v_tope, true;
    return;
  end if;

  -- De otra persona. No se roba en silencio.
  if v_dueno is not null then
    return query select false, 'de_otra_cuenta', 0, v_tope, false;
    return;
  end if;

  -- ¿Esta cuenta ya había usado este computador? Por el hardware o, en filas viejas, por nombre de
  -- red y plataforma. Solo filas que siguen a su nombre (al revocar o soltar una se le quita el
  -- dueño): basta, porque la fila vigente de este computador sigue siendo suya hasta este momento.
  select exists (
    select 1 from public.devices dv
     where dv.user_id = p_user_id
       and dv.id <> v_device
       and (
         (v_equipo is not null and dv.equipo = v_equipo)
         or (dv.equipo is null and p_label is not null and p_label <> ''
             and dv.label = p_label and dv.platform is not distinct from v_plataforma)
       )
  ) into v_conocido;

  -- Este mismo computador, con un token que ya no tiene: se revoca (no debe seguir dictando) y la
  -- fila nueva hereda el nombre que el médico le había puesto.
  if v_equipo is not null then
    select dv.nombre into v_nombre
      from public.devices dv
     where dv.user_id = p_user_id and dv.equipo = v_equipo and not dv.revoked
       and dv.nombre is not null
     order by coalesce(dv.last_seen_at, dv.linked_at, dv.created_at) desc
     limit 1;

    update public.devices
       set user_id = null, linked_at = null, revoked = true
     where user_id = p_user_id and equipo = v_equipo and not revoked and id <> v_device;
  end if;

  select count(*) into v_usados
    from public.devices where user_id = p_user_id and not revoked;

  if v_usados < v_tope then
    update public.devices
       set user_id = p_user_id, linked_at = now(), label = p_label,
           equipo = v_equipo, nombre = coalesce(v_nombre, nombre)
     where id = v_device;
    return query select true, 'vinculado', v_usados + 1, v_tope, v_conocido;
    return;
  end if;

  -- -------------------------------------------------------------------------------------------
  -- Sin cupo. Antes de rendirse, dos intentos (igual que en 20260920000007).
  -- -------------------------------------------------------------------------------------------

  -- 1. ¿Es este mismo computador, reinstalado? Mismo nombre y misma plataforma.
  if p_label is not null and p_label <> '' then
    select dv.id into v_victima
      from public.devices dv
     where dv.user_id = p_user_id
       and not dv.revoked
       and dv.label = p_label
       and dv.platform is not distinct from v_plataforma
     order by coalesce(dv.last_seen_at, dv.linked_at, dv.created_at) asc
     limit 1;

    if v_victima is not null then
      update public.devices
         set user_id = null, linked_at = null, revoked = true
       where id = v_victima;

      update public.devices
         set user_id = p_user_id, linked_at = now(), label = p_label,
             equipo = v_equipo, nombre = coalesce(v_nombre, nombre)
       where id = v_device;

      return query select true, 'reemplazo_reinstalacion', v_usados, v_tope, true;
      return;
    end if;
  end if;

  -- 2. ¿Hay equipos que llevan meses sin dar señales? Sueltan su cupo.
  update public.devices
     set user_id = null, linked_at = null, revoked = true
   where user_id = p_user_id
     and not revoked
     and coalesce(last_seen_at, linked_at, created_at) < now() - make_interval(days => v_idle);
  get diagnostics v_soltados = row_count;

  if v_soltados > 0 then
    select count(*) into v_usados
      from public.devices where user_id = p_user_id and not revoked;
    update public.devices
       set user_id = p_user_id, linked_at = now(), label = p_label,
           equipo = v_equipo, nombre = coalesce(v_nombre, nombre)
     where id = v_device;
    return query select true, 'vinculado_tras_liberar', v_usados + 1, v_tope, v_conocido;
    return;
  end if;

  return query select false, 'tope_alcanzado', v_usados, v_tope, false;
end;
$$;

revoke all on function public.link_device(text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.link_device(text, uuid, text, text) to service_role;

comment on function public.link_device is
  'Vincula un equipo a una cuenta. Con `p_equipo` (hash del hardware) revoca las filas de esa cuenta que son este mismo computador y dice si la cuenta ya lo conocía (`conocido`, para no repetir el tutorial). Antes de rechazar por tope intenta reemplazar el mismo computador reinstalado y soltar los inactivos. Ver 20261114000001.';

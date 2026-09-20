-- CloseLabs Voice — que reinstalar no cueste un cupo de equipo.
--
-- El agujero, descubierto al explicar el tope de dispositivos: **cada reinstalación gasta un
-- cupo.** Al reinstalar se borran los ajustes y con ellos el token del equipo; la app se
-- registra como uno NUEVO y el viejo se queda ocupando su lugar para siempre.
--
-- O sea que un médico al que le formateen el computador tres veces —o le cambien el disco— se
-- queda bloqueado por tres fantasmas suyos, y la única salida es escribirnos. Es un tipo de
-- soporte que da muy mala espina a quien está pagando.
--
-- Dos remedios, y el orden importa:
--
--   1. **Reemplazo por nombre.** Si el equipo que entra se llama igual y es la misma plataforma
--      que uno ya vinculado de ESE MISMO médico, se asume que es el mismo reinstalado y se
--      sustituye. Es la señal más precisa, así que va primero.
--   2. **Caducidad.** Los equipos que llevan mucho sin aparecer se sueltan solos. Esto limpia el
--      computador que se dañó y nunca volvió, que el reemplazo por nombre no cubre.
--
-- ⚠️ Riesgo aceptado en el punto 1: dos máquinas distintas con el mismo nombre (pasa, los Mac
-- salen todos como "MacBook-Pro"). En ese caso se reemplaza la MÁS VIEJA de las que coinciden.
-- Es exactamente lo que haría el médico a mano, porque en la lista tampoco podría distinguirlas.

alter table public.app_config
  add column if not exists device_idle_days integer not null default 90;

comment on column public.app_config.device_idle_days is
  'Días sin aparecer tras los cuales un equipo suelta su cupo solo. Cubre el computador que se dañó y nunca volvió.';

create or replace function public.link_device(
  p_token_hash text,
  p_user_id    uuid,
  p_label      text default null
)
returns table (ok boolean, motivo text, usados integer, tope integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tope      integer;
  v_idle      integer;
  v_device    uuid;
  v_dueno     uuid;
  v_plataforma text;
  v_usados    integer;
  v_victima   uuid;
  v_soltados  integer;
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
    return query select false, 'dispositivo_desconocido', 0, v_tope;
    return;
  end if;

  -- Ya es suyo: reinstaló o volvió a entrar. Inocuo, no gasta cupo.
  if v_dueno = p_user_id then
    update public.devices set label = coalesce(p_label, label) where id = v_device;
    select count(*) into v_usados
      from public.devices where user_id = p_user_id and not revoked;
    return query select true, 'ya_vinculado', v_usados, v_tope;
    return;
  end if;

  -- De otra persona. No se roba en silencio.
  if v_dueno is not null then
    return query select false, 'de_otra_cuenta', 0, v_tope;
    return;
  end if;

  select count(*) into v_usados
    from public.devices where user_id = p_user_id and not revoked;

  if v_usados < v_tope then
    update public.devices
       set user_id = p_user_id, linked_at = now(), label = p_label
     where id = v_device;
    return query select true, 'vinculado', v_usados + 1, v_tope;
    return;
  end if;

  -- -------------------------------------------------------------------------------------------
  -- Sin cupo. Antes de rendirse, dos intentos.
  -- -------------------------------------------------------------------------------------------

  -- 1. ¿Es este mismo computador, reinstalado? Mismo nombre y misma plataforma. Si hay varios
  --    que coinciden, se reemplaza el que lleve más tiempo sin aparecer.
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
      -- Se revoca, no solo se desvincula: el token viejo no debe seguir dictando. Si el equipo
      -- de verdad murió, da igual; si sigue vivo, es el mismo computador y ya tiene token nuevo.
      update public.devices
         set user_id = null, linked_at = null, revoked = true
       where id = v_victima;

      update public.devices
         set user_id = p_user_id, linked_at = now(), label = p_label
       where id = v_device;

      return query select true, 'reemplazo_reinstalacion', v_usados, v_tope;
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
       set user_id = p_user_id, linked_at = now(), label = p_label
     where id = v_device;
    return query select true, 'vinculado_tras_liberar', v_usados + 1, v_tope;
    return;
  end if;

  -- Tres equipos vivos de verdad. Ahora sí toca que el médico elija cuál suelta.
  return query select false, 'tope_alcanzado', v_usados, v_tope;
end;
$$;

revoke all on function public.link_device(text, uuid, text) from public, anon, authenticated;
grant execute on function public.link_device(text, uuid, text) to service_role;

comment on function public.link_device is
  'Vincula un equipo a una cuenta. Antes de rechazar por tope intenta dos cosas: reemplazar el mismo computador reinstalado (mismo nombre y plataforma) y soltar los que llevan meses sin aparecer. Ver la migración 20260920000007.';

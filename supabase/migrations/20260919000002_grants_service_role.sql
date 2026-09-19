-- CloseLabs Voice — permisos mínimos para las Edge Functions.
--
-- Por qué hace falta: el proyecto se creó con "Automatically expose new tables" APAGADA (decisión
-- deliberada: así ninguna tabla nueva queda accesible sin que alguien lo decida). El efecto
-- secundario es que `service_role` tampoco recibe permisos de datos, y las Edge Functions hablan
-- con la base a través de él. Sin esto, el alta de un dispositivo falla con error 500.
--
-- Se concede lo JUSTO que usa cada función, no un permiso general. Si mañana alguien encuentra la
-- forma de ejecutar código dentro de una función, no debería poder borrar el registro de uso ni
-- reescribir la configuración de proveedores.

-- Configuración y proveedores: las funciones solo LEEN. Cambiar de proveedor o subir la cuota se
-- hace desde el panel de Supabase a propósito, no desde código que atiende peticiones de fuera.
grant select on table public.app_config to service_role;
grant select on table public.providers  to service_role;

-- Dispositivos: alta (insert), búsqueda por token (select) y marca de "visto por última vez"
-- (update). Sin delete: dar de baja una instalación es `revoked = true`, que deja rastro.
grant select, insert, update on table public.devices to service_role;

-- Uso: se anota y se cuenta. Sin update ni delete — un registro de consumo que se puede reescribir
-- no sirve para auditar nada.
grant select, insert on table public.usage_events to service_role;
grant usage, select on sequence public.usage_events_id_seq to service_role;

-- La cuota se calcula con esta función.
grant execute on function public.device_usage_today (uuid) to service_role;

-- Explícito para que se lea como intención y no como olvido: la app NUNCA habla con la base, solo
-- con las Edge Functions. Una llave anónima filtrada no debe servir para nada.
revoke all on table public.app_config   from anon, authenticated;
revoke all on table public.providers    from anon, authenticated;
revoke all on table public.devices      from anon, authenticated;
revoke all on table public.usage_events from anon, authenticated;

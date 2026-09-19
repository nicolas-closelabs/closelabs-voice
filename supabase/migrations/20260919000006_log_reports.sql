-- CloseLabs Voice — "Reportar un problema".
--
-- Sin esto, cuando un médico dice "no me funciona" solo tenemos esa frase. El log vive en su
-- computador, en una carpeta que no sabe encontrar, y pedirle que la busque por WhatsApp no es
-- soporte: es perder al cliente.
--
-- ⚠️ Qué se sube y qué NO. El log se limpia EN LA APP antes de salir (`problem_report.rs`):
-- se le quitan el nombre de usuario de las rutas, el token del dispositivo, los correos y los
-- términos del diccionario —que pueden ser nombres de pacientes—. El audio y el texto dictado
-- nunca estuvieron en el log, y este bucket no los recibe.

-- Bucket PRIVADO. Sin políticas de lectura: solo se entra con la llave de servicio, o sea solo
-- desde nuestras Edge Functions. Un médico no puede leer los reportes de otro porque nadie
-- puede leerlos desde fuera del servidor.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('log-reports', 'log-reports', false, 2097152, array['text/plain'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------------------------
-- Índice de reportes
-- ---------------------------------------------------------------------------------------------
-- El archivo va al bucket; aquí queda lo que se puede consultar sin abrirlo: quién, cuándo, con
-- qué versión y qué dijo que pasaba.
create table public.problem_reports (
  id           uuid primary key default gen_random_uuid(),
  device_id    uuid references public.devices(id) on delete set null,
  platform     text,
  app_version  text,
  -- Lo escribe el médico. La app le advierte que no incluya datos de pacientes; es texto libre
  -- y se guarda tal cual porque es lo único que explica QUÉ esperaba que pasara.
  description  text,
  -- Ruta dentro del bucket `log-reports`. Nula si el log no se pudo subir: el reporte sigue
  -- sirviendo aunque venga sin log.
  log_path     text,
  created_at   timestamptz not null default now()
);

create index problem_reports_created_at_idx on public.problem_reports (created_at desc);

alter table public.problem_reports enable row level security;
-- Sin políticas: nadie llega a esta tabla desde fuera. Solo la llave de servicio, que se las
-- salta, y esa solo la tienen las Edge Functions.

revoke all on table public.problem_reports from anon, authenticated;
grant select, insert on table public.problem_reports to service_role;

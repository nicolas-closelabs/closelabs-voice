-- CloseLabs Voice — actualización automática (ver ACTUALIZACIONES.md).
--
-- Cada versión publicada es una fila con sus archivos por plataforma: dónde bajarlos (un GitHub
-- Release del repositorio público de descargas) y la firma de NUESTRA llave del updater. La app
-- solo instala lo que esa firma valida: nadie puede colarle un instalador ajeno.
--
-- Qué versión se instala sola la decide `app_config.version_automatica`. Es una columna APARTE de
-- `latest_version` (que sigue mostrando el aviso de "hay versión nueva" con el enlace de descarga) a
-- propósito: solo la leen las apps que ya tienen actualización automática (0.9.x en adelante), así
-- que se puede probar una versión con el equipo sin que los médicos con la 0.8.4 vean un aviso.
-- Frenar una versión mala es volver esa columna atrás. Una plataforma sin archivos en la fila no se
-- actualiza sola: así está Mac hasta tener la firma de Apple (sin ella, cada versión nueva le quita
-- a la app el permiso de Accesibilidad).
alter table public.app_config add column if not exists version_automatica text;

comment on column public.app_config.version_automatica is
  'Versión que se instala sola (actualización automática). Null = ninguna. Ver ACTUALIZACIONES.md.';

create table public.versiones (
  version      text        primary key check (version ~ '^\d+\.\d+\.\d+$'),
  notas        text,
  publicada_at timestamptz not null default now(),
  -- { "windows-x86_64": { "url": "...", "signature": "..." }, "darwin-universal": {...} }
  archivos     jsonb       not null default '{}'::jsonb
);

alter table public.versiones enable row level security;
revoke all on table public.versiones from anon, authenticated;
grant select, insert, update on table public.versiones to service_role;

comment on table public.versiones is
  'Versiones publicadas para la actualización automática. Se ofrece la de app_config.latest_version. La llena scripts/publicar-version.sh.';

-- `scripts/publicar-version.sh` cambia la versión ofrecida. El servidor solo LEÍA app_config (a
-- propósito); se le permite cambiar estas dos columnas y nada más. Aunque se cambiaran mal, la app
-- solo instala versiones con fila en `versiones` y firmadas con nuestra llave del updater.
grant update (latest_version, version_automatica) on table public.app_config to service_role;

-- CloseLabs Voice — aviso suave de versión nueva.
--
-- `min_supported_version` ya existía, pero es un martillo: la versión vieja deja de funcionar y
-- el médico se queda con una pared. Eso solo se justifica cuando la versión instalada está rota
-- o es peligrosa, y entonces no queda alternativa.
--
-- Lo que falta es el caso normal: hay algo mejor disponible y queremos que se actualice, sin
-- quitarle el dictado a nadie mientras tanto. `latest_version` permite avisar; nulo = no avisar.
alter table public.app_config
  add column if not exists latest_version text;

comment on column public.app_config.latest_version is
  'Última versión publicada. Si la instalada es menor, la app muestra un aviso que se puede cerrar. Nulo = sin aviso.';

comment on column public.app_config.min_supported_version is
  'Por debajo de esta versión la app BLOQUEA el dictado. Es el martillo: usar solo con una versión rota o peligrosa.';

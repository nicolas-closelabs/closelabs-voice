-- CloseLabs Voice — Fase 2: cuentas de médico y suscripción.
--
-- Hasta aquí la unidad de identidad era la INSTALACIÓN: cada una se registraba, recibía un token
-- y dictaba. Eso bastaba para sacar las llaves del binario, pero no para cobrar: no sabemos
-- quién es nadie, un mismo médico con dos computadores son dos desconocidos, y no hay a quién
-- cortarle el acceso cuando deja de pagar.
--
-- ---------------------------------------------------------------------------------------------
-- La decisión que manda sobre todo lo demás
-- ---------------------------------------------------------------------------------------------
-- El dictado SIGUE autenticándose con el token del dispositivo, no con la sesión del usuario.
-- El token se vincula a una cuenta al iniciar sesión (`user_id` en `devices`) y el servidor mira
-- la suscripción de esa cuenta.
--
-- Por qué, y no con el JWT de Supabase en cada dictado: ese JWT caduca a la hora y hay que
-- renovarlo. Meter una renovación de sesión en el camino del dictado significa que, el día que
-- la renovación falle —sin internet un momento, el reloj del equipo desajustado— el médico se
-- queda mudo a mitad de consulta. El token del dispositivo no caduca, se revoca desde el
-- servidor, y ya está probado en producción. La sesión se usa para lo que sí tolera esperar:
-- entrar, vincular el equipo, ver la suscripción.
--
-- ---------------------------------------------------------------------------------------------
-- Migración sin romper a nadie
-- ---------------------------------------------------------------------------------------------
-- Las instalaciones 0.6.0 que ya existen dictan SIN cuenta. `app_config.require_account` empieza
-- en false: todo sigue igual. Cuando la Fase 2 esté terminada y probada se pone en true, y a
-- partir de ahí un dispositivo sin cuenta recibe un aviso en vez de una transcripción. Un
-- interruptor, no una fecha límite.

-- ---------------------------------------------------------------------------------------------
-- Perfil del médico
-- ---------------------------------------------------------------------------------------------
-- `auth.users` la maneja Supabase (correo, contraseña, confirmación). Aquí va lo nuestro.
create table public.user_profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  full_name         text not null,
  -- Indicativo y número por separado a propósito: juntos en un solo campo, normalizar después
  -- para contactar a alguien de México o Perú es un infierno. LatAm es multipaís desde el día 1.
  phone_country     text not null,
  phone             text not null,
  -- Consentimiento de tratamiento de datos. La fecha importa tanto como el hecho: ante la SIC
  -- hay que poder demostrar CUÁNDO se aceptó y qué versión de la política.
  accepted_terms_at timestamptz,
  terms_version     text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- El teléfono también es una base de contactos para otros productos de CloseLabs, así que se
-- busca por él con frecuencia.
create index user_profiles_phone_idx on public.user_profiles (phone_country, phone);

alter table public.user_profiles enable row level security;

-- Cada médico ve y edita SOLO lo suyo. El correo y la contraseña no están aquí: los guarda
-- Supabase en `auth.users`, donde ni siquiera nosotros los leemos en claro.
create policy "el médico lee su perfil"
  on public.user_profiles for select
  using (auth.uid() = id);

create policy "el médico edita su perfil"
  on public.user_profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------------------------------------------------------------------------------------------
-- Suscripción
-- ---------------------------------------------------------------------------------------------
-- Una por médico. Stripe se conecta al final (webhook), pero la tabla ya deja escrito el trato:
-- tarjeta al registrarse, 30 días sin cobro, y si no cancela empieza a cobrarse solo.
create table public.subscriptions (
  user_id                uuid primary key references auth.users(id) on delete cascade,
  -- Vocabulario CERRADO, y a propósito el mismo que usa Stripe: traducir estados entre dos
  -- sistemas es donde se cuelan los errores de cobro.
  status                 text not null default 'trialing'
                         check (status in ('trialing','active','past_due','canceled','incomplete')),
  trial_ends_at          timestamptz,
  current_period_end     timestamptz,
  -- El médico pidió cancelar: sigue usándolo hasta que termine lo pagado.
  cancel_at_period_end   boolean not null default false,
  stripe_customer_id     text unique,
  stripe_subscription_id text unique,
  updated_at             timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

-- Solo lectura, y solo lo propio. El estado lo escribe el webhook de Stripe con la llave de
-- servicio: si un médico pudiera editar esta fila, podría regalarse una suscripción.
create policy "el médico lee su suscripción"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------------------------
-- Dispositivos: ahora pueden tener dueño
-- ---------------------------------------------------------------------------------------------
alter table public.devices
  add column if not exists user_id   uuid references auth.users(id) on delete cascade,
  add column if not exists linked_at timestamptz,
  -- Nombre para que el médico distinga "MacBook del consultorio" de "PC de la casa" cuando
  -- tenga que liberar un cupo.
  add column if not exists label     text;

create index if not exists devices_user_idx on public.devices (user_id) where user_id is not null;

comment on column public.devices.user_id is
  'Cuenta dueña de esta instalación. Nulo = instalación anterior a la Fase 2, que sigue dictando mientras app_config.require_account sea false.';

-- ---------------------------------------------------------------------------------------------
-- Configuración nueva
-- ---------------------------------------------------------------------------------------------
alter table public.app_config
  -- El interruptor de la migración. En false, todo sigue como en la Fase 1.
  add column if not exists require_account boolean not null default false,
  add column if not exists trial_days      integer not null default 30,
  add column if not exists max_devices     integer not null default 2;

comment on column public.app_config.require_account is
  'En true, un dispositivo sin cuenta deja de poder dictar en la nube. Se enciende cuando la Fase 2 esté probada; hasta entonces las instalaciones 0.6.0 siguen funcionando.';

comment on column public.app_config.max_devices is
  'Instalaciones activas por cuenta. Dos: el médico con consultorio y casa es el caso normal, no el sospechoso.';

revoke all on table public.user_profiles, public.subscriptions from anon;
grant select, insert, update on table public.user_profiles to service_role;
grant select, insert, update on table public.subscriptions  to service_role;

-- CloseLabs Voice — Stripe conectado a `subscriptions`.
--
-- El código está en `_shared/cobro.ts` (cobro y sincronización) y en la función `stripe-webhook`.
-- Esta migración prepara la base para eso. Va ANTES que el código.

-- ---------------------------------------------------------------------------------------------
-- 1. Todos los estados de Stripe
-- ---------------------------------------------------------------------------------------------
-- La tabla nació con cinco estados "con el mismo vocabulario de Stripe" (20260920000003), pero
-- Stripe tiene ocho. Sin los otros tres, el día que una suscripción llegara a `unpaid` (se
-- agotaron los reintentos de cobro), la escritura del webhook fallaría por la restricción y la
-- fila se quedaría para siempre en `past_due`… que sigue dictando. `authorize_device_v2` trata
-- cualquier estado que no conoce como inactivo una vez vencida la fecha, así que no hay que tocarla.
alter table public.subscriptions drop constraint if exists subscriptions_status_check;
alter table public.subscriptions add constraint subscriptions_status_check
  check (status in (
    'trialing', 'active', 'past_due', 'canceled', 'incomplete',
    'incomplete_expired', 'unpaid', 'paused'
  ));

-- ---------------------------------------------------------------------------------------------
-- 2. Bitácora de avisos de Stripe
-- ---------------------------------------------------------------------------------------------
-- Para soporte: cuando un médico diga "pagué y no se activa", aquí se ve si el aviso llegó, de
-- quién era y qué se hizo. Una fila por ENTREGA (los reintentos de Stripe también quedan), sin
-- ningún dato de la tarjeta: solo ids y el resultado.
create table public.stripe_eventos (
  id          bigint generated always as identity primary key,
  evento_id   text        not null,
  tipo        text        not null,
  user_id     uuid        references auth.users(id) on delete set null,
  -- escrita | ignorada (aviso viejo de una suscripción muerta) | sin_dueno | error
  resultado   text        not null,
  recibido_at timestamptz not null default now()
);

create index stripe_eventos_user_idx on public.stripe_eventos (user_id, recibido_at desc);

alter table public.stripe_eventos enable row level security;
revoke all on table public.stripe_eventos from anon, authenticated;
grant select, insert on table public.stripe_eventos to service_role;

comment on table public.stripe_eventos is
  'Cada aviso de Stripe que llegó al webhook y qué se hizo con él. Para soporte; no tiene datos de tarjeta.';

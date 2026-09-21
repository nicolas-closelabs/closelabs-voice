-- CloseLabs Voice — que el teléfono no dependa solo de la pantalla.
--
-- Caso real, en el PRIMER registro de verdad: quedó guardado `+57 3212099169212099169`, el
-- número repetido. El campo del formulario estaba aplastado contra el selector de país y no se
-- veía lo que se escribía; y del lado del servidor no había nada que lo frenara.
--
-- La pantalla ya está arreglada, pero eso no basta: este teléfono es además la base de contactos
-- de CloseLabs para otros productos, y una lista con números inválidos no sirve para nada. La
-- validación va donde no se puede saltar.

-- Limpia el dato ya guardado. 10 dígitos es un celular colombiano; lo que sobra es la repetición.
update public.user_profiles
   set phone = left(regexp_replace(phone, '\D', '', 'g'), 10)
 where length(regexp_replace(phone, '\D', '', 'g')) > 12;

create or replace function public.on_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trial_days integer;
  v_phone      text;
begin
  select trial_days into v_trial_days from public.app_config where id;

  -- Solo dígitos y con tope. Un número de 19 cifras no existe en ningún país donde estamos.
  v_phone := left(
    regexp_replace(coalesce(new.raw_user_meta_data ->> 'phone', ''), '\D', '', 'g'),
    12
  );

  insert into public.user_profiles (id, full_name, phone_country, phone, accepted_terms_at, terms_version)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'Sin nombre'),
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'phone_country'), ''), ''),
    v_phone,
    case when new.raw_user_meta_data ->> 'accepted_terms' = 'true' then now() end,
    new.raw_user_meta_data ->> 'terms_version'
  )
  on conflict (id) do nothing;

  -- La prueba arranca al registrarse, no al poner la tarjeta. Stripe escribirá encima sus
  -- propias fechas cuando se conecte; mientras tanto esto ya permite dictar.
  insert into public.subscriptions (user_id, status, trial_ends_at)
  values (new.id, 'trialing', now() + make_interval(days => coalesce(v_trial_days, 30)))
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- Y que la tabla tampoco acepte basura, venga de donde venga.
alter table public.user_profiles
  drop constraint if exists user_profiles_phone_sano;
alter table public.user_profiles
  add constraint user_profiles_phone_sano
  check (phone = '' or (phone ~ '^\d{7,12}$'));

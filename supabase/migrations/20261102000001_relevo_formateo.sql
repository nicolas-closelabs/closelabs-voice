-- CloseLabs Voice — "relevo" del formateo: si el modelo tarda, se le pide lo mismo otra vez.
--
-- Por qué (2026-11-02): gpt-6-luna formatea casi siempre en 1-2 s, pero a ratos OpenAI tarda
-- 4-10 s en contestar (picos el 21/10, el 28/10 y tres seguidos el 2/11 entre 13:50 y 13:54). El
-- médico lo siente como "la app está lenta", aunque nada nuestro cambió. Si a los N ms el trozo no
-- ha vuelto, se manda la MISMA petición al MISMO modelo y se usa la primera respuesta buena: el pico
-- de uno casi nunca coincide con el del otro, y la calidad no cambia porque es el mismo modelo (el
-- respaldo gpt-4o-mini pierde contenido; por eso no se usa para esto).
--
-- `format_hedge_ms` nulo = sin relevo (como siempre). Se mide primero con una fila aparte,
-- `openai-luna-relevo`, que solo usa el banco (`bun pruebas-dictado/correr.ts --forzar
-- openai-luna-relevo`): ningún médico pasa por ella hasta que se decida.
alter table public.providers add column if not exists format_hedge_ms integer;

comment on column public.providers.format_hedge_ms is
  'Formateo: si un trozo no volvió en estos ms, se repite la misma petición al mismo modelo y gana la primera respuesta buena. Nulo = sin relevo.';

insert into public.providers (
  name, base_url, api_key_env, transcribe_model, format_model, format_reasoning_effort,
  format_reasoning_model, supports_transcribe_prompt, transcribe_uses_vocabulary, enabled,
  extra_body, format_hedge_ms
)
select 'openai-luna-relevo', base_url, api_key_env, null, format_model, format_reasoning_effort,
       format_reasoning_model, false, false, true, extra_body, 3000
  from public.providers
 where name = 'openai-luna'
on conflict (name) do nothing;

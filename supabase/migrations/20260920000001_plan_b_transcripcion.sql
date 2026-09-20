-- CloseLabs Voice — plan B de TRANSCRIPCIÓN, ahora sí probado.
--
-- El agujero que tapa esta migración: el proxy hace que cambiar de proveedor sea editar una
-- fila, pero para transcribir **no teníamos a dónde movernos**. La única alternativa que había
-- en la tabla, DeepInfra, estaba marcada como incapaz de aceptar la pista de vocabulario. O sea
-- que ante una caída de Groq podíamos seguir transcribiendo, pero perdiendo el diccionario del
-- médico — y transcribir es la función central del producto.
--
-- ---------------------------------------------------------------------------------------------
-- Lo medido el 2026-09-20, con VOZ REAL (no sintética) y la pista de vocabulario a 355 caracteres
-- ---------------------------------------------------------------------------------------------
--   proveedor / modelo                     | pista | latencia  | resultado
--   ---------------------------------------|-------|-----------|---------------------------
--   groq / whisper-large-v3-turbo          | sí    |  347-1659 | completo  (referencia)
--   deepinfra / openai/whisper-large-v3    | sí    | 1117-2800 | completo, idéntico 5/5
--   openai / gpt-4o-mini-transcribe        | sí    | 1456-2028 | completo, la mejor calidad
--   deepinfra / openai/whisper-large-v3-TURBO | sí |      2136 | ⚠️ **CERO CARACTERES**
--   deepinfra / openai/whisper-large-v3-TURBO | no |       861 | completo (493 chars)
--
-- Esa última pareja es la clave y por eso se escribe aquí: el turbo de DeepInfra devuelve la
-- transcripción **vacía** cuando lleva pista, y perfecta cuando no. El fallo es de la PISTA, no
-- del audio. Con pistas medianas no se vacía: **corta por la mitad y no avisa** — media historia
-- clínica perdida sin que el médico lo note.
alter table public.providers
  add column if not exists notes text;

-- ---------------------------------------------------------------------------------------------
-- DeepInfra: sí acepta la pista, con el modelo NO-turbo
-- ---------------------------------------------------------------------------------------------
-- ⚠️ `supports_transcribe_prompt` está en la fila del PROVEEDOR, pero lo que mide es el MODELO.
-- Cambiar `transcribe_model` de este proveedor al turbo, dejando la bandera en true, reactiva el
-- fallo silencioso. Si se cambia el modelo, hay que volver a medir la pista.
update public.providers
   set transcribe_model = 'openai/whisper-large-v3',
       supports_transcribe_prompt = true,
       notes = 'Plan B principal de transcripción. Probado 2026-09-20 con voz real: acepta la '
               'pista de 355 chars, salida idéntica 5/5, ~1,4 s. Más barato que Groq '
               '($0,027/hora vs $0,04). ⚠️ NO cambiar a whisper-large-v3-TURBO: con pista '
               'devuelve VACÍO.'
 where name = 'deepinfra';

-- ---------------------------------------------------------------------------------------------
-- OpenAI: segundo plan B, y el único que no es Whisper
-- ---------------------------------------------------------------------------------------------
-- Vale la pena aunque cueste ~6x más que Groq: es otra arquitectura, así que un problema del
-- propio Whisper no lo arrastra. En la medición fue el único que oyó "troponinas seriadas **y**
-- se inicia" donde los dos Whisper oyeron "**si** se inicia" — que dice otra cosa.
-- A $0,003/minuto, un médico de 40 dictados diarios cuesta ~$1,30 al mes contra $30 de ingreso.
insert into public.providers
  (name, base_url, api_key_env, transcribe_model, format_model,
   format_reasoning_effort, supports_transcribe_prompt, enabled, notes)
values
  ('openai', 'https://api.openai.com/v1', 'OPENAI_API_KEY',
   'gpt-4o-mini-transcribe', 'gpt-4o-mini', null, true, true,
   'Segundo plan B. Probado 2026-09-20 con voz real: completo con pista, ~1,5 s, la mejor '
   'transcripción de las tres (acertó "y se inicia" donde los Whisper oyeron "si se inicia", '
   'y conservó la arroba del correo). $0,003/min. NO es Whisper: sirve si el problema es del '
   'propio Whisper.')
on conflict (name) do update
   set base_url = excluded.base_url,
       api_key_env = excluded.api_key_env,
       transcribe_model = excluded.transcribe_model,
       format_model = excluded.format_model,
       supports_transcribe_prompt = excluded.supports_transcribe_prompt,
       enabled = excluded.enabled,
       notes = excluded.notes;

comment on column public.providers.supports_transcribe_prompt is
  'Si el proveedor acepta la pista de vocabulario (el diccionario del médico). ⚠️ Depende del MODELO, no del proveedor: al cambiar transcribe_model hay que volver a medirlo. Ver la migración 20260920000001 para el método y los números.';

comment on column public.providers.notes is
  'Qué se midió de este proveedor y cuándo. Para que quien tenga que cambiar de proveedor a las 2 de la mañana no tenga que volver a medirlo.';

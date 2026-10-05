-- EXPERIMENTO (2026-10-04), variante B: `gpt-transcribe` de nuevo de principal, para medirlo con
-- una pista que le pide transcribir LITERAL (conservar "mentira", "perdón", "me equivoqué" y todos
-- los números) más la lista médica general. La pista viaja en cada petición del banco; esta
-- migración solo cambia quién atiende. gpt-4o-mini-transcribe de primer respaldo; se revierte con
-- la siguiente migración, gane quien gane.
--
-- Variante A ya medida (sin migración, con el mini): la lista médica en la pista arregla 9 términos
-- del médico (enalapril, empagliflozina, apixabán, levotiroxina…) sin ninguna sustitución nueva y
-- con las 12 palabras de corrección intactas: 9,4% → 7,8% (médico), 2% → 1,3% (Nicolás).
update public.providers set enabled = true where name = 'openai-transcribe';

update app_config
   set transcribe_provider  = 'openai-transcribe',
       transcribe_fallbacks = '{openai,groq,deepinfra}',
       updated_at           = now();

-- CloseLabs Voice — el log del reporte se guarda en la tabla, no en Storage.
--
-- Por qué se cambió, con la medición delante (2026-09-19): Storage rechaza la llave que el
-- runtime de las Edge Functions inyecta como `SUPABASE_SERVICE_ROLE_KEY` —el formato nuevo
-- `sb_secret_…`— con "Invalid Compact JWS". Solo acepta la llave JWT antigua, que está en vía
-- de retiro. Hacer funcionar el reporte habría significado guardar a mano una credencial vieja
-- y quedar esperando el día en que Supabase la apague.
--
-- La alternativa resultó ser más simple, no un apaño: el log es texto, y Postgres guarda texto.
-- Con esto desaparecen el bucket, la lista de tipos MIME permitidos, la segunda ruta de
-- autenticación y la posibilidad de que la fila quede escrita y el archivo no. Queda un solo
-- INSERT por el mismo camino que ya usa todo lo demás.
--
-- El tamaño no es problema: un log de 256 KB comprime a unas decenas en TOAST, y los reportes
-- son un puñado por semana. El día que dejen de serlo, moverlos a Storage es una migración.
alter table public.problem_reports
  add column if not exists log text,
  drop column if exists log_path;

comment on column public.problem_reports.log is
  'Final del log, YA LIMPIO en la app (problem_report.rs): sin nombre de usuario, sin token, sin diccionario, sin correos. Nunca contiene audio ni texto dictado.';

-- El bucket `log-reports` que creaba la migración 20260919000006 se retiró con la API de
-- Storage, no desde aquí: Postgres prohíbe borrar de `storage.objects` por SQL
-- ("Direct deletion from storage tables is not allowed"). Si al levantar este proyecto desde
-- cero el bucket vuelve a aparecer, se borra desde el panel; no lo usa nadie.

-- DECISIÓN (2026-10-04): lista médica general en la pista de transcripción, SOLO para OpenAI, y
-- la transcripción vuelve a `gpt-4o-mini-transcribe`.
--
-- Medido con el banco de voz (20 dictados de un médico real + 7 de Nicolás, misma vara):
--
--                               datos mal (médico / Nicolás)   correcciones   números perdidos
--   mini, como hoy                    9,4% / 2,0%                12/12              0
--   A: mini + lista                   7,8% / 1,3%                12/12              0     ← entra
--   B: gpt-transcribe literal+lista   4,5% / 3,3%                12/12              1
--
-- A arregla 9 términos del médico (enalapril, apixabán, empagliflozina, levotiroxina, Blumberg…)
-- SIN ninguna sustitución nueva. B se equivoca menos en total, pero en las DOS pruebas escribió
-- "tensión arterial sobre 60" donde el médico dijo "cien sobre sesenta": un número perdido en
-- silencio, que el mini nunca pierde. Regla: solo entra lo que mejora sin empeorar nada. B queda
-- como candidata para volver a medir con más audios.
--
-- La lista (104 términos) sale de `pruebas-dictado/voz/lista-medica.txt`: lo que se receta y se
-- pide a diario en consulta general en Latinoamérica, NO la lista del guion. Se edita aquí, sin
-- versión nueva, y todo cambio se mide antes con `bun pruebas-dictado/voz/transcribir.ts`.
--
-- ⚠️ Solo los proveedores con `transcribe_uses_vocabulary` la reciben. DeepInfra devuelve la
-- transcripción VACÍA con pistas largas (2026-09-19), y a Groq no se le manda pista (2026-09-29).
-- ⚠️ Migración ANTES que el código: el código lee las dos columnas nuevas.
alter table public.app_config add column if not exists transcribe_vocabulary text;
comment on column public.app_config.transcribe_vocabulary is
  'Lista médica general que el proxy agrega a la pista de transcripción de los proveedores con transcribe_uses_vocabulary. Medir cada cambio con el banco de voz.';

alter table public.providers
  add column if not exists transcribe_uses_vocabulary boolean not null default false;

update public.providers set transcribe_uses_vocabulary = true where name in ('openai', 'openai-transcribe');
update public.providers set enabled = false where name = 'openai-transcribe';

update app_config
   set transcribe_vocabulary = 'enalapril, losartán, valsartán, amlodipino, hidroclorotiazida, furosemida, espironolactona, carvedilol, metoprolol, bisoprolol, atorvastatina, rosuvastatina, ácido acetilsalicílico, clopidogrel, apixabán, rivaroxabán, warfarina, metformina, glibenclamida, sitagliptina, empagliflozina, dapagliflozina, insulina glargina, levotiroxina, acetaminofén, ibuprofeno, naproxeno, diclofenaco, dipirona, tramadol, omeprazol, esomeprazol, metoclopramida, loperamida, amoxicilina, amoxicilina clavulanato, cefalexina, ceftriaxona, azitromicina, claritromicina, ciprofloxacino, nitrofurantoína, trimetoprim sulfametoxazol, metronidazol, fluconazol, albendazol, salbutamol, beclometasona, budesonida, loratadina, cetirizina, prednisolona, prednisona, dexametasona, hidrocortisona, betametasona, sertralina, fluoxetina, escitalopram, amitriptilina, clonazepam, alprazolam, quetiapina, pregabalina, gabapentina, sulfato ferroso, ácido fólico, vitamina D, carbonato de calcio, microgramos, miligramos, mililitros, unidades internacionales, hemograma, glicemia, hemoglobina glicosilada, creatinina, nitrógeno ureico, perfil lipídico, TSH, uroanálisis, urocultivo, proteína C reactiva, electrocardiograma, ecocardiograma, holter, ecografía, radiografía, tomografía, resonancia magnética, Blumberg, McBurney, Murphy, Lachman, McMurray, Romberg, Babinski, Auspitz, Glasgow, fibrilación auricular, colecistectomía, osteoartrosis, apendicitis, triage.',
       transcribe_provider   = 'openai',
       transcribe_fallbacks  = '{groq,deepinfra}',
       updated_at            = now();

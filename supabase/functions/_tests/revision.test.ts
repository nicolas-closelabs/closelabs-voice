// CloseLabs Voice — prueba de la red de seguridad (`_shared/revision.ts`).
//
//   bun supabase/functions/_tests/revision.test.ts
//
// Con dictados REALES del banco: los crudos del guion grabado el 2026-09-28 (Groq, con fugas de
// la pista conocidas) y las transcripciones limpias de OpenAI del 2026-09-29. Lo que importa tanto
// como detectar es NO dar falsas alarmas: con la revisión en modo "enforce", una falsa alarma le
// pega al médico el texto sin limpiar.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { revisarLimpieza, revisarTranscripcion } from "../_shared/revision.ts";

const RAIZ = decodeURIComponent(new URL("../../../", import.meta.url).pathname);
let fallas = 0;
const ok = (cond: boolean, nombre: string, extra = "") => {
  if (!cond) fallas++;
  console.log(`${cond ? "✅" : "❌"} ${nombre}${extra ? ` — ${extra}` : ""}`);
};

// La pista que manda hoy la app: frase de estilo + el diccionario de Nicolás.
const PISTA = "Dictado médico en español, con signos de puntuación y correos electrónicos escritos como " +
  "maria.lopez@clinica.co. CloseLabs, CloseLabs Voice, empagliflozina, Walteros.";

console.log("— CAPA 1: ¿la limpieza perdió algo? —");

// Correcciones legítimas: lo retractado desaparece y no es alarma.
const legitimos: [string, string, string][] = [
  ["mentira: se van el 8 y el 7; el 1 pasa a palabras",
    "Plan: se indica acetaminofén 1 gramo cada 8 horas por 7 días, mentira, cada 6 horas por 5 días.",
    "Plan: se indica acetaminofén un gramo cada 6 horas por 5 días."],
  ["perdón: el 28 retractado, el otro 28 sigue",
    "Edad gestacional de 28 semanas por FUM. Análisis: gestante de 28 semanas, perdón, de 29 semanas, con embarazo normal.",
    "Edad gestacional de 28 semanas por FUM. Análisis: gestante de 29 semanas, con embarazo normal."],
  ["separadores de miles con coma, punto o espacio",
    "Plaquetas 240,000, leucocitos 7,200, hemoglobina 14.2.",
    "Plaquetas 240 000, leucocitos 7200, hemoglobina 14,2."],
  ["\"1 metro y 56\" → \"1,56 m\"",
    "Peso 78 kilos, talla 1 metro y 56, índice de masa corporal 32.",
    "Peso 78 kg, talla 1,56 m, índice de masa corporal 32."],
  ["enumeración del prompt: 1000 y 12 retractados",
    "Continuar losartán 50 mg, aumentar metformina a 1000 miligramos cada 12 horas, mentira mantener 850 cada 8 horas.",
    "Continuar losartán 50 mg, mantener metformina 850 mg cada 8 horas."],
  ["sertralina: 25 retractado con la regla del producto",
    "Se inicia sertralina 25 miligramos al día por una semana, mentira, 50 miligramos al día después de la primera semana.",
    "Se inicia sertralina 50 mg al día después de la primera semana."],
  ["me equivoqué, sin números",
    "Se remite a nefrología, me equivoqué, a endocrinología para ajuste de la diabetes.",
    "Se remite a endocrinología para ajuste de la diabetes."],
];
for (const [nombre, crudo, limpio] of legitimos) {
  const r = revisarLimpieza(crudo, limpio);
  ok(r.ok, `no alarma — ${nombre}`, r.ok ? "" : `${r.motivo} (${r.cuantos})`);
}

// Las transcripciones reales de OpenAI, "limpiadas" solo quitando muletillas: cero alarmas.
const voz = JSON.parse(readFileSync(join(RAIZ, "pruebas-dictado/voz/resultados",
  readdirSync(join(RAIZ, "pruebas-dictado/voz/resultados")).filter((f) => f.includes("openai-principal")).sort().pop()!), "utf8"));
const reales = voz.configs["HOY: estilo+dicc, auto"].detalle.map((d: any) => d.texto as string);
const falsas = reales.filter((t: string) => !revisarLimpieza(t, t.replace(/\b(eh|este),?\s/gi, "")).ok);
ok(falsas.length === 0, `no alarma en ${reales.length} transcripciones reales de OpenAI`, falsas.length ? `${falsas.length} falsas alarmas` : "");

// Pérdidas reales: tienen que saltar.
const urgencias = reales.find((t: string) => t.includes("Signos vitales al ingreso"))!;
const sinVitales = urgencias.replace(/Signos vitales al ingreso:[^]*?saturación 96%,\s*/, "");
const r1 = revisarLimpieza(urgencias, sinVitales);
ok(!r1.ok && r1.motivo === "numero_perdido", "ALARMA — se borran los signos vitales (el bug del corte del 2026-09-29)",
  r1.ok ? "no saltó" : `${r1.cuantos} números perdidos`);

const interna = reales.find((t: string) => t.includes("glucosilada 7.2"))!;
const r2 = revisarLimpieza(interna, interna.replace("7.2", "7").replace("1.4", "1").replace("4.1", "4"));
ok(!r2.ok, "ALARMA — decimales perdidos (7.2 → 7, 1.4 → 1, 4.1 → 4)", r2.ok ? "no saltó" : `${r2.cuantos} números perdidos`);

const r3 = revisarLimpieza("Paciente con dosis de 1000 mg, que se retira.", "Paciente con dosis de 100 mg, que se retira.");
ok(!r3.ok, "ALARMA — 1000 → 100 sin corrección hablada");

const r4 = revisarLimpieza(interna, interna.slice(0, Math.floor(interna.length * 0.45)).replace(/\d+(?:[.,]\d+)?/g, ""));
ok(!r4.ok, "ALARMA — la limpieza devuelve menos de la mitad");

console.log("\n— CAPA 2a: frases que la voz inventó —");

const t1 = revisarTranscripcion("Se solicita valoración por cirugía general por sospecha de apendicitis aguda. Gracias por ver el video.", PISTA);
ok(t1.quitadas === 1 && t1.texto.endsWith("apendicitis aguda."), "se quita \"Gracias por ver el video.\" al final", t1.texto.slice(-40));

const t2 = revisarTranscripcion("Paciente refiere dolor, gracias por ver el resultado del laboratorio.", PISTA);
ok(t2.quitadas === 0 && !t2.ecoPista, "NO se quita si es parte de una frase real");

const t3 = revisarTranscripcion("Gracias por ver el video.", PISTA);
ok(t3.quitadas === 0 && t3.texto === "Gracias por ver el video.", "si es TODO el texto, no se toca (lo descarta la app)");

// Los crudos del guion: las fugas conocidas tienen que marcarse, y nada más.
const CASOS = join(RAIZ, "pruebas-dictado/voz/casos");
const conFuga = new Set(["voz-2-1", "voz-2-2b", "voz-2-3", "voz-3-2"]);
for (const f of readdirSync(CASOS).sort()) {
  const c = JSON.parse(readFileSync(join(CASOS, f), "utf8"));
  const r = revisarTranscripcion(c.crudo, PISTA);
  const esperado = conFuga.has(c.id);
  if (r.ecoPista !== esperado || esperado) {
    ok(r.ecoPista === esperado, `${c.id}: ${esperado ? "fuga de la pista MARCADA" : "sin fuga, sin marca"}`);
  }
}
const marcadasOpenAI = reales.filter((t: string) => revisarTranscripcion(t, PISTA).ecoPista).length;
ok(marcadasOpenAI === 0, `sin marcas en las ${reales.length} transcripciones de OpenAI`, marcadasOpenAI ? `${marcadasOpenAI} falsas` : "");
const fuga36 = revisarTranscripcion(readFileSync(join(CASOS, "3.6.json"), "utf8") && JSON.parse(readFileSync(join(CASOS, "3.6.json"), "utf8")).crudo, PISTA);
ok(fuga36.quitadas === 1 && !fuga36.texto.includes("Gracias"), "3.6 del guion: se quita el \"Gracias por ver el video.\"");

console.log(fallas ? `\n❌ ${fallas} caso(s) fallaron` : "\n✅ todos los casos pasan");
process.exit(fallas ? 1 : 0);

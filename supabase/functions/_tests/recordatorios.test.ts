// CloseLabs Voice — pruebas de los correos de fin de la prueba (`_shared/recordatorios.ts`).
//   bun supabase/functions/_tests/recordatorios.test.ts
(globalThis as any).Deno = { env: { get: () => "" } };
const { correoRecordatorio, diasRestantes } = await import("../_shared/recordatorios.ts");

let fallos = 0, pasan = 0;
const ok = (c: unknown, n: string, d?: unknown) => { if (c) pasan++; else { fallos++; console.log("✗", n, d ?? ""); } };
const AHORA = Date.parse("2026-10-20T14:00:00Z");
const en = (h: number) => new Date(AHORA + h * 3600_000).toISOString();
const datos = { nombre: "Ana María Pérez", fin: en(72), dictados: 143, minutos: 252 };

let c = correoRecordatorio("quedan", datos, AHORA);
ok(c.asunto === "Te quedan 3 días de prueba en CloseLabs Voice", "asunto 3 días", c.asunto);
ok(c.html.includes("Hola, Ana:"), "saluda por el primer nombre");
ok(c.html.includes("23 de octubre de 2026"), "fecha de fin en palabras (hora de Bogotá)", c.html);
ok(c.html.includes("143 dictados") && c.html.includes("4 horas y 12 minutos"), "lo que dictó");
ok(c.html.includes("US$12 al mes") && c.html.includes("Mi cuenta") && c.html.includes("Suscribirme"), "cómo seguir y el precio");
ok(c.html.includes("no pierdes ningún día"), "dice que suscribirse antes no recorta la prueba");

c = correoRecordatorio("quedan", { ...datos, fin: en(20) }, AHORA);
ok(c.asunto === "Mañana termina tu prueba de CloseLabs Voice", "un día: 'mañana'", c.asunto);
ok(diasRestantes(en(49), AHORA) === 3 && diasRestantes(en(1), AHORA) === 1, "días redondeados hacia arriba");

c = correoRecordatorio("termino", { ...datos, fin: en(-20) }, AHORA);
ok(c.asunto === "Tu prueba de CloseLabs Voice terminó", "asunto terminó");
ok(c.html.includes("En tu prueba hiciste") && c.html.includes("siguen ahí"), "terminó: uso y que sus cosas siguen");

c = correoRecordatorio("quedan", { ...datos, dictados: 0, minutos: 0 }, AHORA);
ok(!c.html.includes("dictados") && !c.html.includes("0 dictado"), "si no dictó, no inventa números");

c = correoRecordatorio("quedan", { ...datos, nombre: "<img src=x onerror=alert(1)>" }, AHORA);
ok(!c.html.includes("<img"), "el nombre no puede colar HTML");
c = correoRecordatorio("quedan", { ...datos, nombre: null }, AHORA);
ok(c.html.includes("Hola:"), "sin nombre: 'Hola:'");

console.log(`\n${pasan} comprobaciones bien, ${fallos} mal`);
if (fallos) process.exit(1);

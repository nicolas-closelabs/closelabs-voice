# ROADMAP — CloseLabs Voice: paridad con Aztec 1.8.2 y más

> Creado el 2026-09-17. Detalle de cada feature y de cómo lo hace Aztec: `AZTEC-BENCHMARK.md`.
> Pendientes sueltos y bugs: `BACKLOG.md`. Este archivo es el orden de ejecución.

## Arquitectura objetivo

```
App de escritorio (Tauri)
  ├─ Sesión Supabase (token en archivo propio 0600, renovación automática)
  ├─ Config remota al abrir y cada X horas (versión mínima, bloqueo, mensajes)
  ├─ Dictado → [online] Edge Function /transcribe → Groq Whisper   (audio Opus)
  │            [offline] Parakeet local (se descarga en segundo plano)
  ├─ Texto  → [online] Edge Function /format → Groq LLM (+ guardas locales)
  └─ Reportar problema → tabla problem_reports (logs limpiados en la app)

Supabase (un solo proveedor: Auth + Postgres + Storage + Edge Functions)
  ├─ Tablas: user_profiles, subscriptions, devices, user_blocks, app_config,
  │          user_dictionary_entries, user_preferences, usage_events
  ├─ RLS: cada usuario solo ve lo suyo
  ├─ Edge Functions: transcribe, format, (webhook de pagos)
  └─ Secretos: GROQ_API_KEY, (OPENAI_API_KEY de respaldo), clave del webhook de pagos

Web closelabs.co: registro/pago, confirmar email, recuperar contraseña, portal de suscripción
```

**Por qué Supabase también para el proxy (y no Vercel como Aztec):** valida el JWT de forma nativa,
consulta la suscripción en la misma base, registra el uso por médico (minutos dictados →
costos y alertas, que hoy no tenemos) y deja un solo proveedor que mantener. Si la latencia
desde LatAm resultara peor, el proxy se mueve a Vercel o Cloudflare sin tocar la app: solo
cambia la URL.

## Fases

### Fase 0 — Calidad y robustez (sin infraestructura nueva) · ✅ COMPLETADA 2026-09-19

> 18 de 19 puntos hechos; el que falta (pegado por menú) está aplazado a propósito, con el porqué
> escrito abajo. Rama `feat/sprint1-paridad-aztec`, instaladores compilados y verificados en las
> tres plataformas (macOS ARM, macOS Intel, Windows MSVC). Probado con dictado real en Mac.

> Falta probar en la app real (micrófono + Groq) lo marcado con [x]; las pruebas unitarias pasan.
- [x] Diccionario enviado como `prompt` a Groq Whisper (máx. ~600 caracteres).
- [x] Filtro de alucinaciones conocidas de Whisper + detección de eco del diccionario.
- [x] `connect_timeout` de 3 s + timeout proporcional al audio + 1 reintento si falla la conexión.
- [x] Guardas del refine para ambos modos (vacío, rechazo, longitud, eco/invención, fuga del prompt), 1 reintento, sin refine para dictados de menos de 3 palabras.
- [x] Privacidad: el texto dictado ya no se escribe en el log.
- [x] Emails dictados: normalizador local + regla del prompt que reconstruye la arroba cuando Whisper la pierde (validado con voz real).
- [x] Signos de puntuación dictados ("dos puntos", "punto y aparte"…) con **excepción médica**: "coma" y "punto" sueltos nunca se convierten.
- [x] Diccionario: corrige también el texto de la nube (antes solo el local) y acepta términos de hasta 3 palabras.
- [x] Bandeja: "Copiar" (estaba roto: leía un historial que no guardamos) y "Pegar última transcripción", solo en memoria.
- [x] Aviso "falta el permiso de Accesibilidad: tu texto está en el portapapeles".
- [x] No restaurar el portapapeles si el usuario copió algo durante el pegado (y esperar 200 ms antes de restaurarlo: con 50 ms, apps Electron podían pegar el contenido viejo).
- [x] Formateador → `openai/gpt-oss-20b` + JSON estricto. **No hubo A/B posible: Groq retiró el 70B**
  (404 en cada dictado → producción pegando texto crudo). Verificado contra la API real con 4 dictados
  clínicos. Pendiente: few-shot propios y comparar con dictados reales cuando lleguen.
- [x] Parakeet en segundo plano: con internet, el onboarding ya no espera los ~550 MB (comando `complete_onboarding`).
- [x] Opus (`opusic-sys`) → FLAC → WAV. 11x más chico que WAV, 6x que FLAC, con transcripción
  idéntica contra la API real, y compila en las tres plataformas (Windows MSVC incluido).
- [x] Micrófono: "del computador (recomendado)" + aviso de Bluetooth (AirPods pierden las primeras palabras).
- [x] Prompt del formateador acortado (1.444 → 1.221 tokens) tras medir el techo de 8.000 TPM del
  tier gratis de Groq. Validado contra la API real: acierta 8/8 casos clínicos donde el largo hacía
  6/8. ⚠️ El techo real solo lo levanta el tier pago detrás del proxy (Fase 1) — ver BACKLOG #16.
- [x] Atajo "Reprocesar último dictado" (audio solo en RAM, tope de 5 min, nunca toca el disco).
  Por defecto ⌥⇧R en Mac y Ctrl+Shift+R en Windows. Sirve cuando se cayó el internet a mitad del
  dictado o cuando se acaba de agregar un término al diccionario.
- ⏸️ Pegado por menú Edición > Pegar como respaldo (macOS) — **aplazado a propósito**: no hay forma
  de detectar que el Cmd+V falló, así que sería otro interruptor en Ajustes; y hacerlo sin pedir un
  segundo permiso exige FFI de Accesibilidad imposible de probar sin una app que falle de verdad.
  Nunca hemos visto el problema. Se retoma cuando un médico reporte la app concreta.
- [x] Normalización de emails/URLs dictados, local y sin internet ("juan arroba gmail punto com" → juan@gmail.com).

### Fase 1 — Backend base (necesita: proyecto Supabase) · ✅ COMPLETADA 2026-09-19 (v0.6.0)

> El proxy dejó de ser "infraestructura ordenada" y pasó a ser **lo que destraba el crecimiento**.
> Groq cerró su plan pago ("temporarily unavailable due to high demand") y no se puede pagar para
> subir el techo; con el proxy, el proveedor es una línea de configuración del servidor y se cambia
> sin reinstalar en el computador de ningún médico. Ver DECISIÓN 2026-09-19 en BACKLOG.md, con el
> disparador de los ~20 médicos y el reemplazo ya medido.
- [x] Migraciones SQL: `app_config` (fila única), `providers`, `devices`, `usage_events`, con RLS
  y permisos mínimos para `service_role`. Proyecto **gdizmbuzepxnkiahbeoz**, São Paulo, Postgres 17.
- [x] Edge Functions desplegadas: `register`, `dictate` (transcribe+formatea en UNA llamada),
  `transcribe` y `format` sueltas (para cuando transcribe el Parakeet local). Identidad por
  DISPOSITIVO con token revocable, cuota diaria, registro de uso sin audio ni texto, llave del
  proveedor en los secretos. La suscripción se valida desde la Fase 2, y DeepInfra y OpenAI
  quedaron medidos como respaldo (cambiar es una línea de SQL).
- [x] App apuntando al proxy. **El instalador ya no contiene ninguna llave** (verificado en el
  binario compilado). Una migración borra la llave vieja del disco de quien actualice.
- [x] **Config remota EN LA APP.** Endpoint `/config`; la app pregunta al arrancar y cada 6 h.
  Dos niveles: `latest_version` avisa y se puede cerrar; `min_supported_version` detiene el
  dictado y muestra una pantalla sin salida. **Falla hacia abierto en todos los caminos** — sin
  internet, servidor caído, respuesta ilegible o versión que no se entiende, no se bloquea nada.
  Probado EN VIVO contra el proyecto real: bloqueo y aviso, los dos.
- [x] **"Reportar un problema"** (Ayuda). Manda lo que el médico escribe + el final del log,
  limpiado en la app: sin nombre de usuario, sin credenciales, sin correos, sin los términos del
  diccionario (se conserva cuántos son). Verificado contra un log real de 468 KB, sin fugas.
  ⏸️ "Enviar comentarios…" en la bandeja: no se hizo, el botón en Ayuda cubre el caso.
- [x] **Alertas de uso y errores del proveedor** (BACKLOG #4). Vistas de salud
  (`salud_ultima_hora`, `errores_recientes`, `uso_diario`) + correo automático: `pg_cron` revisa
  cada 15 min y avisa a `admin@closelabs.co` cuando hay algo accionable. Resend configurado y
  probado con correos reales.

### Fase 2 — Usuarios y suscripción · 🔨 EN CURSO (v0.7.0) — falta solo Stripe

> **Decidido con el cliente el 2026-09-20:** Stripe · **$11/mes** · **30 días de prueba** ·
> tarjeta al registrarse sin cobro · **3 dispositivos** por cuenta · teléfono obligatorio (además
> de contacto, es base de contactos para otros productos de CloseLabs).
>
> **Cancelar no corta el servicio: lo corta el calendario.** Quien cancela el día 15 de una
> prueba de 30 dicta hasta el 30; quien pagó un mes y cancela el día 10 dicta hasta el 30. Nunca
> se pierde a mitad de período.
>
> ⚠️ **`require_account` está ENCENDIDO desde el 2026-09-20.** Una instalación sin cuenta ya no
> dicta en la nube. Y el "seguir sin cuenta" se quitó de la app a petición del cliente, así que
> **no queda válvula de escape**: si alguien no logra registrarse, la única salida es publicar
> una versión nueva.
- [x] **Base de datos**: `user_profiles`, `subscriptions`, `devices.user_id`, con RLS. El alta
  (perfil + prueba de 30 días) va en un disparador sobre `auth.users`: o pasa todo o no pasa nada.
- [x] **Login, registro, recuperar contraseña, confirmación por correo.** Correos en español y con
  la marca, por Resend. Probado de punta a punta con una cuenta real.
- [x] **Sesión persistente**, con renovación automática. ⚠️ El dictado NO usa la sesión sino el
  token del dispositivo — ver el porqué en `auth.rs`. Y tener sesión guardada basta para estar
  dentro: ni un corte de red ni una caída nuestra desconectan a nadie.
  ⚠️ **Estuvo en el llavero del sistema y se sacó a propósito** (2026-09-20): sin firma de
  Developer ID, macOS le pedía al médico la contraseña de su Mac al abrir cada versión nueva.
  Ahora es un archivo 0600 en la carpeta de datos. El porqué largo está en `auth.rs`.
- [x] **3 dispositivos por cuenta**, con las dos puertas que evitan soporte: reinstalar el mismo
  computador no gasta cupo, y los equipos sin señales en 90 días lo sueltan solos.
- [x] **Estados de suscripción** aplicados en el proxy (`authorize_device_v2`). `past_due` SÍ
  dicta: un cobro rechazado suele ser una tarjeta vencida, no alguien que se va.
- [x] **Pantallas**: bienvenida, registro con teléfono y consentimiento fechado, recuperar
  contraseña, y "Mi cuenta" con suscripción y equipos.
- [ ] **Stripe** — lo único grande que falta. Pasarela, webhook → `subscriptions`, pantalla de
  tarjeta. Todo lo demás ya está esperándolo.
- [ ] Política de Tratamiento de Datos (Ley 1581, datos sensibles de salud). Los enlaces de la app
  ya apuntan a `closelabs.co/terminos` y `/privacidad`; faltan las páginas.
- [ ] Páginas en closelabs.co: confirmar correo y recuperar contraseña usan hoy las de Supabase.

### Fase 2.5 — Listo para autoservicio y para producción · 📋 PLANEADO (2026-09-21)

> **El público manda:** médicos de 40-50 años o más, poco familiarizados con la tecnología, casi
> todos en **Windows**. Nicolás va a mandar un link y tienen que poder instalar, crear la cuenta y
> dictar **solos**. Auditoría del flujo real (código, no suposiciones) del 2026-09-21: hoy **no**
> están en condiciones de hacerlo sin ayuda.

**Autoservicio (UX):**
- [x] 🔴 **Atajo equivocado en Windows.** Instrucciones y Ayuda decían **⌥ + Espacio** (tecla de
  Mac) e Inicio mostraba **⌃ + Espacio**; en Windows es **Ctrl + Espacio**. ✅ 2026-09-21: todas las
  pantallas leen el atajo REAL del médico y lo escriben según su teclado (`shortcutLabels.ts` +
  `useShortcutKeys`). La Ayuda habla de Configuración de Windows, la bandeja junto al reloj y
  Ctrl + V; el botón del micrófono en Windows ya no dice "Ajustes del Sistema".
- [x] 🔴 **Botón de WhatsApp** (+57 310 299 1182, en `branding.ts`). ✅ 2026-09-21: primero en
  Ayuda; en TODAS las pantallas de cuenta (sin cuenta no se dicta, así que quien no logra entrar no
  tenía ninguna salida); en la pantalla de versión bloqueada; y tras reportar un problema, con el
  número del reporte ya escrito en el mensaje. Todos los mensajes van prellenados.
- [x] **Entrar solo después de confirmar el correo.** El enlace llevaba a la portada de
  closelabs.co y había que volver a escribir correo y contraseña. ✅ 2026-09-21: la app reintenta
  entrar cada 30 s y al recuperar el foco, y la pantalla dice "cuando vuelvas aquí, entrarás solo";
  más un botón "Ya confirmé mi correo". Queda la página propia de confirmación en closelabs.co.
- [ ] 🔴 **Verificar el límite de correos de Supabase** (Authentication → Rate Limits). El
  `config.toml` tiene `email_sent = 2` por HORA para todo el proyecto: si ese es el valor real,
  desde el tercer médico que se registre en la misma hora no le llega la confirmación. La CLI no
  deja leerlo; hay que mirarlo en el panel. Techo de fondo: Resend gratis = 100 correos/día.
- [x] **Tutorial interactivo del primer dictado** (`PrimerDictado.tsx`). ✅ 2026-09-21: al terminar
  el onboarding de un usuario nuevo, dicta una frase de prueba en un cuadro DENTRO de la app. Cuatro
  pasos que se van marcando solos, y pistas concretas si se traba (no empezó a grabar, error de
  micrófono o de internet, el texto no llegó al cuadro). Se repite desde Inicio ("Hacer un dictado
  de prueba"). ⚠️ Solo se puede probar con instalador: la versión de desarrollo no recibe el
  permiso de Accesibilidad en Mac.
- [ ] **Guía visual del permiso de Accesibilidad (Mac)**: una imagen de dónde exactamente hacer clic.
- [ ] **Página de descarga en closelabs.co** con un botón por sistema y una guía de instalación con
  capturas de los avisos de Windows y macOS. En Mac, el médico no sabe si su chip es Apple Silicon
  o Intel: build universal, o instrucciones de cómo saberlo. En Windows, repartir solo el `.exe`.
- [ ] Probar **Ctrl + Espacio** en los programas de historia clínica que usan los médicos (Word y
  Excel usan esa combinación para otras cosas).
- [ ] **Prueba con 2 médicos reales** de 50+ años: mandarles el link, no ayudarles, y mirar dónde se
  traban. Encuentra lo que ninguna revisión de código encuentra.

**Producción con más de 20 médicos (proveedores):**
- [ ] **Respaldo automático en el proxy.** Hoy cambiar de proveedor es manual (una fila de SQL): si
  el principal se cae a media mañana, todos fallan hasta que alguien vea la alerta y edite la
  fila. El proxy debe reintentar con el secundario dentro del mismo dictado, con timeouts cortos
  (eso también cubre los cuelgues de DeepInfra).
- [ ] **Medir con 30-50 dictados reales** antes de elegir el principal (hasta hoy, 5 muestras).
- [ ] Recomendación provisional: **transcribir con OpenAI** (`gpt-4o-mini-transcribe`, la mejor
  calidad medida, ~$1,30/médico/mes) con DeepInfra y luego Groq de respaldo; **formatear con
  DeepInfra** (`gpt-oss-20b`, 16/16, cero errores de JSON) con Groq de respaldo.
- [ ] Que el abogado revise la política de datos de cada proveedor (datos de salud).

### Fase 3 — Distribución profesional (necesita: cuentas Apple/Windows)
- [ ] **Firma Windows con SSL.com IV + eSigner** a nombre de Nicolás (~$309/año). Luz verde desde
  2026-09-21; va primero porque casi todos los médicos usan Windows.
- [ ] Firma + notarización macOS (Apple Developer, persona natural, $99/año).
  Todo el detalle en `FIRMA-Y-DISTRIBUCION.md`.
- [ ] Actualización automática: clave del updater, `latest.json` en un host público, "Actualización lista, reinicia".
- [ ] Build Windows probado de punta a punta.

### Fase 4 — Diferenciadores
- [ ] Sincronizar el diccionario MANUAL en la nube (nunca las palabras aprendidas).
- [ ] Auto-diccionario (macOS): aprende de las correcciones. Con salvaguardas: no aprender nombres de pacientes y confirmación del médico.
- [ ] Inicio con los dictados de la sesión (solo en memoria) + clic para copiar.
- [ ] Instrucciones con videos cortos.

## Cómo le ganamos a Aztec (no solo igualarlo)
1. **Vocabulario médico precargado por especialidad:** en el onboarding el médico elige su especialidad y se precargan en la pista de Whisper los fármacos y términos más usados. Aztec depende de que el usuario los escriba o de que los aprenda con el tiempo.
2. **Privacidad demostrable:** cero texto dictado en los logs, Zero Data Retention activado en Groq, política de datos honesta (la de Aztec dice que el audio no sale del equipo, y sí sale) y palabras aprendidas que nunca salen del equipo.
3. **Primer uso sin espera:** se dicta en línea al instante mientras el modelo offline baja en segundo plano.
4. **Robustez en internet malo:** Opus, timeouts cortos, fallback local en ~3 s y un overlay que avisa cuando se usó el modo sin conexión.
5. **Métricas para el médico:** minutos dictados y tiempo ahorrado en Inicio (retención y justificación del pago).
6. **Comandos de formato clínico por voz:** "punto y aparte", "nuevo párrafo", listas numeradas para planes de manejo.
7. **Soporte cercano:** reportar problema + WhatsApp directo desde la app.

## Lo que necesita CloseLabs (no es código)
| # | Acción | Bloquea |
|---|---|---|
| 1 | Crear proyecto Supabase (org CloseLabs) y compartir URL + anon key; service role solo como secreto | Fase 1 |
| 2 | ~~Plan B de proveedor~~ **RESUELTO 2026-09-20**: DeepInfra y OpenAI medidos y configurados; cambiar es una línea de SQL. Sigue pendiente Groq: **habilitar facturación (tier pago)** — el gratis tiene un techo de 8.000 tokens/minuto para toda la cuenta, o sea ~6 dictados por minuto entre TODOS los médicos; con eso no se puede vender. Además: **Zero Data Retention**, límite de gasto y alertas; key de OpenAI como plan B | Fase 1 |
| 3 | ~~Decidir pasarela de pago~~ **RESUELTO**: Stripe (vía la cuenta del socio español; Stripe no opera en Colombia), $11/mes, 30 días de prueba, 3 dispositivos | Fase 2 |
| 4 | Páginas en closelabs.co: confirmar email, recuperar contraseña, suscripción | Fase 2 |
| 5 | Abogado: política de datos sensibles (salud), transferencia internacional (Groq/Supabase en EE. UU.) | Fase 2 |
| 6 | Comprar SSL.com IV + eSigner (Windows, ~$309/año) y Apple Developer ($99/año). Azure Trusted Signing descartado: exige una sociedad | Fase 3 |
| 7 | 20-30 dictados reales **anonimizados** (texto crudo) para el A/B del formateador | Fase 0 |

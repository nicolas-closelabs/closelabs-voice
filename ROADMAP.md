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

### Fase 2.5 — Listo para autoservicio y para producción · 🔨 EN CURSO (v0.8.x)

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
- [x] **Límite de correos de Supabase.** El `config.toml` decía 2 por HORA para todo el proyecto
  (desde el tercer registro en la misma hora no llegaba la confirmación). ✅ 2026-09-21: en el
  servidor está en **60/hora**. Techo de fondo: Resend gratis = 100 correos/día — subir de plan
  antes de una campaña grande.
- [x] **Tutorial interactivo del primer dictado** (`PrimerDictado.tsx`). ✅ 2026-09-21: al terminar
  el onboarding de un usuario nuevo, dicta una frase de prueba en un cuadro DENTRO de la app. Cuatro
  pasos que se van marcando solos, y pistas concretas si se traba (no empezó a grabar, error de
  micrófono o de internet, el texto no llegó al cuadro). Se repite desde Inicio ("Hacer un dictado
  de prueba"). ⚠️ Solo se puede probar con instalador: la versión de desarrollo no recibe el
  permiso de Accesibilidad en Mac.
- [x] **Cuentas que no se pisan en un mismo computador — HECHO 2026-09-23 (v0.8.2).** Una cuenta
  nueva veía "0 de 3 equipos" y sus dictados se le cobraban a la cuenta anterior; cerrar sesión no
  sacaba de la app y seguía dictando; el tutorial no salía. Detalle en BACKLOG.
- [x] **El dictado se escribe DENTRO de la app — HECHO 2026-09-22 (v0.8.1).** El tutorial nunca
  había funcionado: el Cmd+V simulado no llegaba a nuestra propia ventana.
- [ ] **Guía visual del permiso de Accesibilidad (Mac)**: una imagen de dónde exactamente hacer clic.
- [~] **Página closelabs.co/voice (convencer e instalar)** — 🔨 EN CURSO (2026-09-21), en otra
  sesión dedicada al diseño de páginas. Estado:
  - **Descargas:** repo PÚBLICO `nicolas-closelabs/closelabs-voice-releases`, solo con instaladores
    (el código sigue privado). **v0.8.0 publicada.** Enlaces permanentes con nombres fijos
    (`…/releases/latest/download/CloseLabs-Voice-Windows.exe` y `…-Mac.dmg`, universal): publicar
    una versión nueva = subir un release con esos nombres; la página no se toca.
  - **Web:** Lovable + Vercel, repo `nicolas20w/closelabs` (Nicolás invitó a `nicolas-closelabs`
    como colaborador), clon local en `../closelabs-web`, rama `voice-descarga`. ⚠️ Vercel Hobby solo
    despliega commits cuya autoría sea la cuenta dueña: en ese clon `git config --local` quedó como
    `nicolas20w <nicolaswalteros@gmail.com>`. Las vistas previas piden login de Vercel. ⚠️ `main`
    sincroniza con Lovable: publicar = unir la rama con `main`, solo con aprobación del cliente.
  - **Diseño con Impeccable** (github.com/pbakaus/impeccable, pedido por el cliente): PRODUCT.md,
    dirección «La nota de voz» elegida por el cliente, contrato en
    `.impeccable/surfaces/src-pages-voice-tsx.md`, detector con 0 hallazgos, referencia de estructura
    wisprflow.ai. ⚠️ **Falta para cerrar:** la revisión final independiente y `DESIGN.md`
    (documenter). Impeccable se clonó en el scratchpad de la sesión: volver a clonarlo si no está.
  - **Pendiente del cliente:** testimonios reales de testers (la página no muestra ninguno hasta
    tenerlos) y aprobar la publicación. `/terminos` y `/privacidad` siguen sin existir (abogado).
  - ⚠️ En Mac la instalación falla hasta firmar con Apple; el cliente decidió **no** mostrar parches
    en la página y lanzar cuando la instalación esté bien.
- [x] **Ctrl + Espacio probado en los programas de historia clínica — OK 2026-09-23** (Nicolás lo
  probó, incluido gMedic): no choca con nada.
- [ ] **Prueba con 2 médicos reales** de 50+ años: mandarles el link, no ayudarles, y mirar dónde se
  traban. Encuentra lo que ninguna revisión de código encuentra.

**Fiabilidad del dictado (lo que se hizo el 2026-09-24):**
- [x] **Banco de pruebas `pruebas-dictado/`** — 9 dictados fijos × 3 repeticiones contra `/format`,
  comprobando que no se pierda ni cambie contenido. Dos casos son dictados REALES de 3 y 6 minutos.
  Ningún cambio de modelo, prompt o troceado se da por bueno sin pasarlo. **Regla: un 2/3 es un
  fallo**, porque estos modelos fallan de forma intermitente.
- [x] **Formateo con `gpt-4o-mini`** (openai), con openrouter y groq de respaldo: 42/42 contra
  35/42 de gpt-oss-20b, 1,7 s contra 9-10 s en dictados largos, mismo costo (~$0,00037/dictado).
- [x] **El dictado se parte en trozos de ~400 caracteres** cortados en final de frase y se
  formatean en paralelo. Medido apagándolo con el modelo nuevo ya puesto: 40/42 y los dos dictados
  largos pierden la corrección hablada. O sea, sigue haciendo falta.
- [x] **El prompt vive en `app_config.format_prompt`** → se afina sin instaladores; verificado
  mandando el prompt viejo desde el cliente (42/42 igual).
- [ ] ⚠️ **Sigue fallando 1 de cada 9**: en el dictado de 6 minutos, a veces quedan escritas las
  dos dosis de una corrección hablada. Es visible para el médico (dos dosis contradictorias), no
  silencioso, pero hay que cerrarlo antes de lanzar.
- [ ] **Grabar el guion `pruebas-dictado/GUION-GRABACIONES.md`** (17 dictados, 8 especialidades,
  uno de 5 min con pausa y otro de 10). ⚠️ Antes de grabar, apagar la limpieza para capturar el
  texto CRUDO; si no, no se puede separar un error de voz de uno de formateo.
- [ ] **Banco de la capa de VOZ**, que hoy no existe: el banco actual arranca desde el texto ya
  transcrito. Sale de las grabaciones de arriba.
- [ ] **Prueba ácida gpt-4o-mini contra gpt-6-luna**, DESPUÉS de grabar el guion (para que cubra
  las ocho especialidades). Luna no falló en 21 intentos donde gpt-4o-mini falló 2 — puede ser
  suerte. Protocolo y regla de decisión, fijada antes de ver los números, en
  `pruebas-dictado/README.md`. Si luna gana, cierra también el punto de "1 de cada 9" de arriba.
- [ ] **Por qué Whisper corta palabras con audio de 3+ minutos** ("tensi arterial", "frecuencia
  card 98"). Visto en el crudo del 2026-09-24; puede ser el audio, la compresión Opus o el modelo.

**Producción con más de 20 médicos (proveedores):**
- [x] **Respaldo automático en el proxy.** ✅ 2026-09-21, EN PRODUCCIÓN. Cadenas en `app_config`:
  transcribir **groq → deepinfra → openai**, formatear **groq → deepinfra**. Si uno falla (caída,
  429, 5xx, cuelgue, llave rota), el siguiente se prueba en el mismo dictado, con topes de tiempo
  que caben en lo que la app espera. Excepción deliberada: el `bad_request` al transcribir NO pasa
  al siguiente (lo usa la cadena Opus → FLAC → WAV de la app). Prueba con 13 escenarios en
  `supabase/functions/_tests/respaldo.test.ts`. Motivo medido: el formateo de Groq falló en
  6 de 23 dictados el 21 y en 23 de 81 el 19 — todos pegados sin puntuar.
  **Probado EN VIVO el 2026-09-21** con un principal roto a propósito (ruta 404) y 2 dictados
  reales: los dos salieron bien, atendidos por DeepInfra, y el diccionario siguió funcionando
  ("CloseLabs", "CloseLabs Voice", "Aztec Voice" bien escritos). El proveedor roto falló en
  ~100 ms y el dictado completo costó ~3 s más. Configuración restaurada al terminar.
- [x] ~~**Formatear: OpenRouter (servidor Groq)**~~ — sustituido el 2026-09-24 por openai/gpt-4o-mini
  tras medirlo con el banco (35/42 contra 42/42). OpenRouter queda de primer respaldo.
- [x] **Transcribir: nos quedamos en Groq gratis, con OpenAI de primer respaldo** (decisión de
  Nicolás, 2026-09-23). El plan gratis aguanta ~2.000 dictados/día entre TODOS; OpenAI ya está
  configurado y entra solo si Groq falla. ⚠️ Se reabre cuando el volumen se acerque a ese techo:
  mirar `usage_events` por día. OpenRouter NO ofrece transcripción de audio.
  ⚠️ El respaldo se reordenó a **openai → deepinfra**: el Whisper de DeepInfra no acepta la pista
  de vocabulario, así que cuando entraba se perdía el diccionario del médico.
- [ ] **Probar un modelo SIN razonamiento para formatear** (gpt-4o-mini, llave de OpenAI ya puesta)
  con los dictados reales del 2026-09-24. Motivo: `gpt-oss-20b` razona antes de escribir y en
  dictados de 3+ minutos se enreda (16.000-18.000 tokens sin terminar). Detalle en BACKLOG.
- [ ] **Mirar por qué Whisper corta palabras con audio de 3+ minutos** ("tensi arterial"). Se vio
  en el texto crudo del 2026-09-24; puede ser el audio, la compresión Opus o el propio modelo.
- [ ] **Medir con 30-50 dictados reales** antes de elegir el principal (hasta hoy, 5 muestras).
  ⚠️ 2026-09-22: DeepInfra con reasoning `low` INVIERTE autocorrecciones ("se remite a cardiología
  me equivoqué a neurología" → cardiología). Con `medium` acierta pero tarda ~4,5 s. Detalle en BACKLOG.
- [ ] Recomendación provisional: **transcribir con OpenAI** (`gpt-4o-mini-transcribe`, la mejor
  calidad medida, ~$1,30/médico/mes) con DeepInfra y luego Groq de respaldo; **formatear con
  DeepInfra** (`gpt-oss-20b`, 16/16, cero errores de JSON) con Groq de respaldo. ⚠️ Revisado el 2026-09-22: no con reasoning `low` (ver arriba).
- [ ] Que el abogado revise la política de datos de cada proveedor (datos de salud).

### Fase 3 — Distribución profesional (necesita: cuentas Apple/Windows)
- [ ] **Firma Windows con SSL.com IV + eSigner** a nombre de Nicolás (~$309/año). Luz verde desde
  2026-09-21; va primero porque casi todos los médicos usan Windows.
- [ ] Firma + notarización macOS (Apple Developer, persona natural, $99/año).
  ⚠️ **Mientras no esté firmada, el permiso de Accesibilidad se cae en CADA versión nueva** (va
  atado al hash del binario): el interruptor se ve encendido pero no vale, y hay que apagarlo y
  encenderlo. Se decidió NO ponerlo en la app (2026-09-23: es ruido para el médico nuevo, que es
  la mayoría); a los testers se les avisa por fuera. Con Developer ID desaparece solo.
  Todo el detalle en `FIRMA-Y-DISTRIBUCION.md`.
- [ ] Actualización automática: clave del updater, `latest.json` en un host público, "Actualización lista, reinicia".
- [ ] Build Windows probado de punta a punta.

### Fase 4 — Diferenciadores
- [ ] Sincronizar el diccionario MANUAL en la nube (nunca las palabras aprendidas).
- [ ] Auto-diccionario (macOS): aprende de las correcciones. Con salvaguardas: no aprender nombres de pacientes y confirmación del médico.
- [ ] Inicio con los dictados de la sesión (solo en memoria) + clic para copiar.
- [ ] Instrucciones con videos cortos.

### Fase 5 — Canal gMedic (socio distribuidor) · ❓ SIN DECIDIR (propuesta enviada 2026-09-23)

> **No arranca hasta que gMedic acepte.** gMedic es un software de historias clínicas que vio Voice
> y quiere ofrecerlo a sus médicos. Nada de esta fase se construye "por si acaso": el orden está
> pensado para gastar lo mínimo hasta que el piloto demuestre uso real.
>
> ⚠️ **En este canal NO hay 30 días gratis** (decisión de Nicolás, 2026-09-23): quien quiere, paga.
> La prueba gratis sigue existiendo solo en la venta directa. Implica marcar al médico que entra por
> gMedic para que la suscripción arranque activa y sin periodo de prueba.
>
> **Modelo acordado en la propuesta:** público US$12/médico/mes en TODOS los canales (para no
> competir contra la venta directa); gMedic paga US$8 (US$7 pasando 100 médicos activos) y se queda
> con la diferencia; gMedic vende, cobra y atiende primera línea; instalador con su marca sin costo.
> Costo nuestro medido: ~$2/médico/mes con uso alto. Propuesta completa (página privada):
> https://claude.ai/code/artifact/34686f8d-8457-49c9-bdf5-b405955a43fd

**1. Enlace propio (`closelabs-voice://`) — lo primero, 1-2 días.**
- [ ] Registrar el esquema (`tauri-plugin-deep-link`) en Windows y macOS + instancia única.
- [ ] Acciones: abrir/enfocar, empezar a dictar, y **activar la cuenta con un código de un solo uso**
  emitido por gMedic (el médico no escribe correo ni contraseña — es donde más se pierde un usuario
  nuevo). El código se canjea contra nuestro backend; caduca en minutos y se usa una vez.
- [ ] En la web de gMedic: si en ~2 s no abre, ofrecer la descarga (no hay forma fiable de saber si
  está instalada).
- ⚠️ Nada de esto es indispensable: la app ya escribe dentro de gMedic en el navegador sin integración.

**2. Canal local (WebSocket) — SEGUNDA etapa, solo si el piloto funciona.**
- [ ] Servidor local en la app + conexión desde la página de gMedic: estado en vivo y **entrega del
  texto directamente** en vez de simular Ctrl/Cmd+V.
- [ ] Por qué vale la pena: **en Mac desaparece el permiso de Accesibilidad** dentro de gMedic (el
  paso más frágil de la instalación) y el texto nunca cae en el campo equivocado.
- [ ] Requisito: seguridad seria (origen permitido, llave por sesión, nada de escuchar en red).
- ⚠️ Necesita desarrollo del lado de gMedic; el enlace NO se reemplaza (el WebSocket no puede
  arrancar la app si está cerrada).

**3. Usuarios y pagos los maneja gMedic.**
- [x] **Cortar el acceso a quien no paga — HECHO 2026-09-23 (v0.8.3).** El respaldo local se
  activaba con CUALQUIER error, incluidos 'no pagó' y 'se acabó la prueba': bastaba apagar el wifi
  para dictar gratis para siempre. Era condición para cualquier trato donde otro cobre. Ver BACKLOG.
- [ ] **Manual primero, a propósito** (decisión de Nicolás, 2026-09-23): gMedic manda la lista de
  activos y avisa las bajas cuando pasan; nosotros encendemos y apagamos. Ya se puede hacer hoy con
  la base tal como está: cero código, cero piezas nuevas que se rompan.
- [ ] Reporte mensual de uso por médico para conciliar la factura (sale de `usage_events`).
- [ ] Automatizar con una API para socios (crear/activar/suspender cupos) **solo pasando ~100
  médicos**, cuando los 10 minutos al mes dejen de ser suficientes.

**4. Instalador "gMedic Voice, by CloseLabs" — sin costo para él.**
- [ ] Segundo instalador: nombre, ícono, identificador de paquete y textos propios (`branding.ts`
  ya centraliza casi todo; falta parametrizar el bundle y los íconos en el CI).
- [ ] La matriz del CI compila y publica las dos marcas en cada versión.
- ⚠️ **El "by CloseLabs" no es cortesía:** al instalar, Windows y macOS muestran quién FIRMA, y la
  firma es nuestra. Que el nombre visible coincida con el firmante evita desconfianza al instalar.
- ⚠️ Costo permanente: cada versión se compila y se prueba dos veces.

**Condiciones y riesgos (para la negociación, no para el código):**
- [ ] **Las firmas (Fase 3) son requisito para abrir comercialmente.** Sus médicos instalan; hoy
  Windows advierte y Mac no abre. El piloto se puede hacer acompañado, la apertura no.
- [ ] Contrato: gMedic responsable del tratamiento, CloseLabs encargado (Ley 1581).
- [ ] Soporte de primera línea a cargo de gMedic, con acuerdo de qué se escala.
- [ ] Concentración: si trae 200 médicos y se va, quedamos en cero → mínimo mensual al renegociar.
- [ ] Por definir con él: IVA dentro o fuera de los US$12, moneda de facturación y tasa de cambio.

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

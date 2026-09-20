# BACKLOG — CloseLabs Voice

> Feedback y pendientes acumulados para hacer **un build grande con todo junto** (no builds
> sueltos). Última actualización: 2026-07-13.

## Estado actual (ya EN PRODUCCIÓN, probado en Silicon + Intel)
- ✅ **Transcripción HÍBRIDA** (v0.6): online → Groq Whisper `large-v3-turbo` (nube, calidad
  Aztec); offline o si falla → Parakeet local. Código: `groq_transcribe.rs`,
  `actions.rs::try_cloud_transcription`, toggle `cloud_transcription_enabled`. Idioma `auto`.
- ✅ **Compresión FLAC** en la subida (`flacenc`, Rust puro; ~2x más chico que WAV; verificado
  contra Groq → 200 OK). Red de seguridad: si Groq rechaza FLAC → reintenta WAV (cero regresión).
- ✅ **Wording de privacidad** honesto (Instructions/Help/About): *"100% privado y seguro. Tus
  dictados no se almacenan ni se usan para entrenar modelos."* — NUNCA volver a decir "100% local".
- ✅ Instaladores FLAC (Silicon/Intel/Windows) en `~/Desktop/CloseLabs Voice - Instaladores/`.
- ⚠️ `CLAUDE.md` commit local `4c7d436` **sin pushear** (para no gastar un build en un doc); sube
  con el próximo push de código.

## PENDIENTES para el próximo build (fixes de código)

1. **Overlay — animación del micrófono congelada (Intel).** Al hablar, el indicador de audio del
   overlay no se mueve (parece que no escucha), pero SÍ graba y transcribe. Es **solo visual**.
   Revisar la animación de nivel de audio en Intel (`src/overlay/RecordingOverlay.*`).

2. **App no queda en el Dock (Intel) — "dock glitch".** La app no aparece en el Dock de abajo;
   para volver a ella hay que ir a Aplicaciones y reabrir. Muy incómodo. Revisar activation policy
   / Dock (macOS `ActivationPolicy::Regular`, `show_main_window`, `--start-hidden`) — especialmente
   en Intel.

3. ✅ **Selector de modelos: solo ofrecer el del catálogo — HECHO (2026-09-20).** Dos mitades,
   y la segunda era la que importaba: `get_available_models` ahora filtra por `is_catalog_model`,
   y una **migración reapunta `selected_model`** cuando los ajustes señalan un modelo que ya no
   ofrecemos. Sin la migración, filtrar la lista no le cambiaba nada al tester afectado: la app
   seguía CARGANDO su Whisper Medium en cada dictado — el modelo que hacía a un Mac Intel tardar
   48 s en transcribir 2,5 de audio.
   ⏸️ **No se auto-borra el archivo viejo**, a propósito: son cientos de megas que no son nuestros
   y borrarlos sin preguntar no es cosa de una migración. Quien quiera el espacio:
   `rm -rf ~/.cache/huggingface/hub/models--*whisper*`.

4. **Error handling / alertas cuando Groq falla.** Hoy, ante cualquier error de Groq (sin saldo,
   rate limit, caído) cae a Parakeet **en silencio, sin avisar a CloseLabs** → los médicos degradan
   a calidad "regular" y nadie se entera. (No se queda pegado: reintenta la nube en cada dictado y
   se recupera solo.) Fix real = **proxy propio + telemetría** (misma infra que la capa de
   cuentas/suscripción del roadmap). Mínimo viable: distinguir/loguear el tipo de error de cuenta.

5. **Plan B de proveedor (CRÍTICO para distribuir).** ⚠️ Groq tiene los **upgrades a Developer
   tier PAUSADOS** ("temporarily unavailable due to high demand") → no se pueden conseguir límites
   de producción desde Groq por ahora. **Límites del free tier (medidos en vivo 2026-07-13):**
   Whisper ~2000 req/día + 7200 audio-seg; Llama 70B ~1000 req/día + 12000 tokens/min → **~1000
   dictados/día sumando TODOS los médicos**. Sirve para testers, NO para distribución de pago.
   **No es apagón permanente** (resetea diario), pero al topar el diario degrada el resto del día.
   Solución: como `provider`/`base_url` son configurables, cablear un proveedor disponible YA
   (OpenAI `gpt-4o-transcribe`/`whisper-1` para transcripción es lo más drop-in; refine puede ir a
   OpenAI/Cerebras/etc.). Costo ~$0.001-0.005/dictado → margen sigue 70-90% cobrando $30. Dejar el
   Plan B **probado y listo** para activar con solo cambiar config, aunque se prefiera Groq si reabre.

6. **Benchmark Aztec 1.8.2 (2026-09-16) → ver `AZTEC-BENCHMARK.md`.** Sprint 1 propuesto (todo
   chico, sin infra nueva): diccionario enviado como `prompt` a Groq Whisper; filtro de alucinaciones
   conocidas de Whisper; chequeo de conectividad de 2 s + timeout proporcional + 1 reintento (hoy
   60 s fijos); formateador `openai/gpt-oss-20b` + JSON schema + few-shot propios + guardas
   anti-fuga + reintento + omitir dictados muy cortos (**A/B con dictados médicos antes**); aviso
   "falta Accesibilidad, tu texto está en el portapapeles"; no restaurar el portapapeles si cambió;
   bandeja "Pegar última transcripción".

7. **PRIVACIDAD — log con texto de pacientes.** `managers/transcription.rs:1412` hace
   `info!("Transcription result: {}")` → el dictado completo queda en el archivo de log. Loguear
   solo la longitud.

8. ✅ **Opus — HECHO (2026-09-18).** `opus_encode.rs` codifica Ogg/Opus 16 kHz mono a 24 kbps
   (`opusic-sys`, libopus vía **cmake**) y `groq_transcribe.rs` lo encadena **Opus → FLAC → WAV**.
   Medido contra la API real con un dictado clínico de 38 s: 1,23 MB → 668 KB → **110 KB**, misma
   transcripción carácter por carácter en los tres. ✅ **`opusic-sys` compila en CI Windows MSVC**
   (run 35377377639, las tres plataformas en verde): queda demostrado que el bloqueo era autotools
   de `audiopus`, no Opus.

9. ⚠️ **PRODUCCIÓN ROTA — Groq retiró `llama-3.3-70b-versatile` (detectado 2026-09-18).** La API
   devolvía `404 model_not_found` en CADA dictado → el refine caía a texto crudo (sin puntuación)
   en todos los instaladores entregados, en silencio. También desapareció `llama-3.1-8b-instant`.
   **Arreglado en código:** default → `openai/gpt-oss-20b` + salida JSON estricta (verificado
   contra la API real: 0,85–1,5 s; el 120b falló al generar JSON). La migración
   `ensure_post_process_defaults` fuerza el modelo, así que los equipos ya instalados se arreglan
   solos al abrir la nueva versión. **Falta publicar un build nuevo** — hasta entonces los médicos
   siguen recibiendo texto crudo.
   → Refuerza el pendiente #4 (avisos cuando el proveedor falla): esto llevaba días y nadie se
   enteró. Y el #5: en las pruebas ya topamos el límite de tokens por minuto del tier gratis.

10. **Ventana principal aparecía abajo a la izquierda (bug de producción).** `lib.rs` creaba la
    ventana sin posición y el origen de coordenadas de macOS está en la esquina inferior
    izquierda. **Arreglado:** `.center()` en el builder.

11. **Los builds `--debug` morían al arrancar como app instalada.** `specta_builder.export(...)`
    con `.expect()` escribe `src/bindings.ts` en una ruta relativa al proyecto; ejecutada desde
    `/Applications` el directorio de trabajo es otro → `Permission denied` → **panic en el
    arranque**, antes de registrar el atajo global. El síntoma engañaba: la pantalla de permisos
    se quedaba pegada y parecía que macOS no reconocía el permiso de Accesibilidad.
    **Arreglado:** el export ahora solo advierte en el log. (Producción no se veía afectada
    porque es build release, donde ese bloque no se compila.)

12. **El diccionario dejó de corregir en línea (regresión de la v0.6).** `apply_custom_words`
    (corrección por similitud) solo corría en el motor local; al pasar a nube-primero, online el
    diccionario quedó reducido a una "pista" para Whisper, que sugiere pero no garantiza (dictando
    con "Isotetrinoina" en el diccionario, devolvió "Icetotrinoina"). **Arreglado:** el texto de la
    nube pasa por diccionario + filtro de muletillas, igual que el local.

13. **El diccionario no aceptaba términos con espacio** ("CloseLabs Voice", "Hospital San José").
    El backend ya comparaba grupos de hasta 3 palabras; era la UI la que lo bloqueaba.
    **Arreglado** (`CustomWords.tsx`, máximo 3 palabras).

14. **Correos dictados perdían la arroba.** Medido: con audio sintético Whisper devuelve la palabra
    "arroba" (y nuestro normalizador la convierte bien), pero con voz real devolvió directamente
    "nicolas.closelabs.co". **Arreglado en el prompt** (regla 12): si el contexto es de correo y
    aparece `nombre.dominio.tld` sin arroba, se reconstruye. Validado: no toca sitios web sueltos.

15. **Signos de puntuación dictados.** Diciendo "dos puntos" quedaban el signo Y las palabras.
    **Arreglado en el prompt** (regla 11) con **excepción médica**: "coma" y "punto" sueltos NUNCA
    se convierten ("paciente en coma", "punto de sutura", "punto gatillo"). Validado contra la API.

16. ⚠️ **TECHO DE ESCALA — el tier gratis de Groq NO aguanta el producto (medido 2026-09-18).**
    La cuenta reporta `x-ratelimit-limit-tokens: 8000` **por minuto para toda la organización**.
    Cada dictado gasta el prompt entero, así que el techo es directo: **~5-6 dictados por minuto
    ENTRE TODOS los médicos**. Con dos o tres consultorios a la vez ya devuelve 429 (se reprodujo:
    12 de 20 llamadas seguidas fallaron).
    - ✅ *Hecho:* prompt acortado de 1.444 → **1.221 tokens** (4.674 → 3.759 caracteres), lo que
      sube el techo a ~6-7 dictados/min. Se validó contra la API real con 8 casos clínicos, dos
      corridas: el prompt CORTO acierta **8/8**, el largo 6/8 y 7/8 (el largo insertaba una coma
      antes de la palabra "coma" y a veces no pasaba "sesenta y dos" a 62). O sea: más barato *y*
      más preciso.
    - ❌ *Lo que NO resuelve:* acortar el prompt es aritmética lineal; ningún prompt razonable
      hace que 8.000 TPM alcancen para un producto de pago. **La solución real es el tier pago de
      Groq detrás del proxy (pendiente #5 / Fase 1).** Es acción del cliente: habilitar facturación
      en Groq antes de vender licencias.

17. **La salida estructurada falla de forma intermitente** (`400 Failed to generate JSON`): cuando
    pasa, se reintenta por la ruta clásica y el dictado tarda ~6 s en vez de 2,5 s.
    ✅ **2026-09-19 — IDENTIFICADO: es de Groq.** Se reprodujo con el prompt de producción (1 de 16
    llamadas) y NO aparece en DeepInfra con el mismo modelo y el mismo esquema (0 de 32). Bajarle
    el `reasoning_effort` a Groq lo acelera a 0,68 s pero EMPEORA los 400 a 2 de 16 → descartado.
    No es nuestro prompt: es el validador de JSON de Groq. Se va solo cuando migremos el
    formateador (ver DECISIÓN 2026-09-19). Mientras tanto la guarda de respaldo lo cubre.
    _Nota del 2026-09-18:_ 32 llamadas no lo habían reproducido
    La hipótesis de que el "responde ÚNICAMENTE con el texto" del prompt chocara con el JSON queda
    **sin confirmar**; se probó una variante que pedía JSON explícitamente y no hubo diferencia
    medible. Dejar la guarda de respaldo como está y volver a mirar si reaparece con el tier pago
    (puede que el 400 fuera el disfraz de un throttle).

## DECISIÓN 2026-09-19 — Proveedores: nos quedamos en Groq hasta la Fase 1

**Qué se decidió:** NO mover el formateador a DeepInfra todavía. Todo sigue en Groq
(transcripción + formateo) hasta que exista el proxy de la Fase 1.

**Por qué:** el techo no aprieta (hoy 1 usuario; el límite es 1.000 formateos/día) y mover el
proveedor ahora obliga a meter una SEGUNDA llave en el binario, un segundo secreto de CI y código
de migración de ajustes — todo lo cual el proxy borra, porque ahí el proveedor pasa a ser una línea
de configuración del servidor. Sería levantar un andamio para demolerlo.

### ⚠️ DISPARADOR — cuándo dejar de esperar
**Más de ~20 médicos activos antes de que el proxy esté listo.** 20 × 40 dictados/día = 800 contra
1.000 de cupo; en 25 se revienta. Si eso pasa antes de la Fase 1, se hace el cambio de urgencia:
está medido y validado, es cuestión de horas.

### Lo medido el 2026-09-19 (para no volver a medirlo)

Formateador, mismo modelo `openai/gpt-oss-20b`, 16 casos clínicos:

| | Aciertos | Mediana | Errores 400 |
|---|---|---|---|
| Groq | 15/16 | 1,09 s | 1 de 16 |
| DeepInfra | 16/16 | 3,57 s | 0 |
| **DeepInfra `reasoning_effort=low`** | **16/16** | **1,66 s** | **0 de 32** |
| Groq `reasoning_effort=low` | 14/16 | 0,68 s | **2 de 16 (peor)** |

- El `400 Failed to validate JSON` del pendiente #17 **es de Groq**: 0 casos en DeepInfra.
  Bajarle el razonamiento a Groq lo acelera mucho pero EMPEORA los 400 → descartado.
- Costo del formateador en DeepInfra: **~$0,07/médico/mes**. El costo nunca fue el problema.
- Ráfaga de 30 simultáneos en DeepInfra: 30/30 sin rechazos (en Groq gratis es impensable).

Transcripción — **DeepInfra NO sirve para reemplazar a Groq**, por dos motivos distintos:

| Motor | Con la pista del diccionario | Tiempos (12 intentos, audio de 38 s) |
|---|---|---|
| Groq `whisper-large-v3-turbo` | Correcto | 1,0 – 2,0 s ✅ |
| DeepInfra `whisper-large-v3-turbo` | **Devuelve VACÍO 5 de 5** ❌ | 1,4 – 4,5 s |
| DeepInfra `whisper-large-v3` | Correcto (y clava el correo mejor) | 1,7 s … **37,9 s** ❌ |

⚠️ El turbo de DeepInfra **trunca o borra la transcripción en silencio** cuando la pista pasa de
~150 caracteres — el médico recibe media historia clínica sin saberlo. El large-v3 sí respeta la
pista y es más barato ($0,027/h vs $0,040/h), pero se cuelga ~1 de cada 10 veces.

Otros motores de DeepInfra, descartados: `Qwen3-ASR` (no convierte números, 12-130 s),
`Voxtral-Mini` (inestable), `Nemotron-ASR` (sin mayúsculas). **Deepgram NO está en DeepInfra**
(empresa aparte, modelo propio).

### Cómo lo hace Aztec (con ~3.000 usuarios)

Los límites de Groq son **por organización, no por usuario**: sus 3.000 usuarios comparten una sola
llave embebida. Con el plan gratis les tocaría un dictado cada tres días a cada uno → **están
pagando**. El mensaje de Groq es *"temporarily unavailable due to high demand"*: es una FILA por
falta de chips, no una política. Aztec va en la 1.8.2 y nosotros en la 0.5 — metieron la tarjeta
cuando la puerta estaba abierta, y a quien ya está adentro no lo sacan.

**Su ventaja es de calendario, no de ingeniería.** Su 1.8.2 trae `gpt-oss-20b`, el mismo modelo que
elegimos por nuestra cuenta, y arrastra los `llama-3.3-70b`/`llama-3.1-8b` que Groq ya retiró.
También traen el mensaje `Groq rate limit reached`, o sea que chocan el mismo techo.

**Acción del cliente:** escribirle a Groq por el canal COMERCIAL, no por el botón de la web. El
autoservicio está cerrado, pero una empresa con clientes pagando es otra conversación.

### Por qué no vamos a un solo proveedor
Cada uno falla distinto y ninguno avisa: Groq tiene el techo y los 400; el turbo de DeepInfra borra
transcripciones; su large-v3 se cuelga; y **Fireworks cerró su servicio de audio en junio de 2026**.
Si hubiéramos estado casados con Fireworks, el producto se muere de un día para otro. Lo que da
estabilidad no es tener un proveedor, sino **poder cambiarlo sin reinstalar en cada computador** —
que es exactamente la Fase 1.

## HALLAZGO 2026-09-19 — El formateador NO es determinista (y a veces pisa el diccionario)

Medido contra la API real: el MISMO texto, por el MISMO camino, con `temperature: 0`, devolvió
**3 salidas distintas de 4 intentos**. Las diferencias son de puntuación (un punto antes de "Mi
correo" sí o no) y, más serio, de vocabulario: en una de las cuatro cambió `Isotetrinoina` —el
término que el médico puso en SU diccionario— por `Isotretinoína`.

Dos consecuencias:

1. **El diccionario del médico no manda hoy.** Se aplica ANTES del formateo, así que el modelo
   puede sobrescribirlo, y lo hace de forma intermitente. Un médico que añade un término y ve que
   unas veces sale como él lo escribió y otras no, deja de confiar en la función.
2. **No se puede validar un cambio de orden comparando unas pocas salidas.** Se intentó comparar
   "diccionario → formateo" contra "formateo → diccionario" y daba 2 de 4 distintas; al repetir el
   mismo camino consigo mismo salían 3 de 4 distintas. El ruido tapa la señal.

**Aplicar el diccionario AL FINAL lo arreglaría**: el término del médico sería la última palabra,
siempre. Es la decisión de producto que hay que tomar — ¿manda el médico o manda el modelo? — y de
paso es lo que permitiría unir las dos llamadas del proxy en una (ver abajo).

### Unir transcripción y formateo en una sola llamada — PENDIENTE, bloqueado por lo anterior
Ahorraría ~500 ms por dictado (un viaje completo de ida y vuelta al servidor). Requiere que el
diccionario se aplique al final, porque hoy corre en el cliente ENTRE las dos llamadas. No se hizo
sin decidir antes lo de arriba: el diccionario es lo que más le importa a un médico y ya nos dio
un susto (ver el arreglo de las palabras que se tragaba).

## 2026-09-20 — FASE 2 arrancada: cuentas, dispositivos y suscripción (base de datos)

### Decisiones tomadas con el cliente
- **Stripe**, **$11/mes**, **30 días de prueba** (subió de 15).
- **Tarjeta al registrarse**, sin cobro. Si no cancela, el cobro arranca solo al terminar la prueba.
- **2 dispositivos por cuenta.** El médico con consultorio y casa es el caso normal, no el sospechoso.
- **Teléfono obligatorio**, guardado con indicativo aparte: además de contacto, es base de
  contactos para otros productos de CloseLabs.

### La decisión de arquitectura que manda sobre el resto
**El dictado sigue autenticándose con el token del dispositivo, NO con la sesión del usuario.**
Al iniciar sesión, el token se vincula a la cuenta (`devices.user_id`) y el servidor mira la
suscripción de esa cuenta.

El porqué: el JWT de Supabase caduca a la hora. Meter una renovación de sesión en el camino del
dictado significa que el día que falle —sin internet un momento, el reloj del equipo
desajustado— el médico se queda mudo a mitad de consulta. El token del dispositivo no caduca,
se revoca desde el servidor y ya está probado en producción. La sesión se usa para lo que sí
tolera esperar: entrar, vincular el equipo, ver la suscripción.

### Migración sin romper a los testers
`app_config.require_account` empieza en **false**: las instalaciones 0.6.0 que ya existen siguen
dictando sin cuenta. Cuando la Fase 2 esté probada se pone en true. **Un interruptor, no una
fecha límite.** Verificado: el mismo dispositivo sin cuenta dicta con false y recibe `no_account`
con true.

### `past_due` SÍ dicta, y es deliberado
Un cobro rechazado casi siempre es una tarjeta vencida, no alguien que se quiere ir. Cortarle el
dictado a un médico en consulta por eso es perder al cliente que estaba a un clic de seguir
pagando. Stripe reintenta varios días; en ese plazo lo que toca es avisar, no bloquear.

### Probado contra la base real
| Caso | Resultado |
|---|---|
| Alta de cuenta | perfil + suscripción de 30 días en un solo acto (disparador sobre `auth.users`) |
| Vincular 1º y 2º equipo | ✅ con su etiqueta |
| Vincular 3º | 🚫 `tope_alcanzado` |
| Volver a vincular el 1º | ✅ `ya_vinculado`, sin gastar cupo |
| `trialing` / `active` / `past_due` | dicta |
| `canceled` / `incomplete` | bloquea |
| prueba vencida | `trial_ended` |

### Bug encontrado al ejecutar (no al compilar)
`authorize_device_v2` declaraba columnas de salida con el mismo nombre que las de las tablas
(`daily_quota`, `user_id`). PL/pgSQL aborta con «column reference is ambiguous» — pero **en
tiempo de ejecución**, así que la migración se aplicó limpia y solo falló al llamarla. Corregido
aliando cada tabla. Lección: una migración que se aplica sin error no significa que la función
funcione.

### Lo que falta de la Fase 2
- Cliente de Auth en la app (entrar, registrarse, guardar sesión en el llavero del sistema).
- Pantallas: registro con teléfono y consentimiento, inicio de sesión, «tus equipos», estado de
  la suscripción.
- Endpoints `/link-device` y `/unlink-device`.
- Cambiar las Edge Functions a `authorize_device_v2` y borrar la vieja.
- Páginas web en closelabs.co: confirmar correo, recuperar contraseña.
- **Stripe al final**, como se acordó: webhook → `subscriptions`.
- Documentos legales (ver más abajo).

---

## 2026-09-20 — ALERTAS POR CORREO (pendiente #4, cerrado)

Lo que resuelve, tal cual pasó: Groq retiró un modelo, la API devolvió 404 en cada dictado y la
app cayó a texto crudo **en silencio**. Nos enteramos días después porque alguien se quejó.

### Cómo está armado
- **La decisión vive en SQL**: `alertas_pendientes()`. Ajustar un umbral es un `update`, no un
  despliegue, y se puede probar sin mandarle correo a nadie:
  ```sql
  select * from alertas_pendientes();   -- vacío = todo en orden
  ```
- **La Edge Function `alertas` solo envía.** No decide nada.
- **pg_cron la llama cada 15 minutos** con un secreto propio (`ALERT_CRON_SECRET`) en la
  cabecera `x-alert-secret`. No usa la llave de servicio: la pasarela de Supabase rechaza sus
  propias llaves en `authorization` antes de que la petición llegue a la función, y además así
  el secreto del cron solo sirve para disparar el aviso.

### De qué se avisa, y por qué solo de eso
Cada condición tiene una respuesta concreta. Una alerta sin respuesta es ruido, y el ruido
entrena a la gente a ignorar el buzón — peor que no tener alertas.

| Condición | Umbral | Qué se hace |
|---|---|---|
| `auth` | cualquier caso | La llave del proveedor no sirve: rotarla |
| `rate_limit` | ≥10 en 1 h | Topamos el plan: cambiar de proveedor en `app_config` |
| tasa de error | ≥25% con ≥8 llamadas en 1 h | Mirar `errores_recientes` |

Tras avisar hay **6 horas de silencio** para esa condición: un proveedor caído genera cientos
de fallos por minuto y el primer correo ya lo dijo todo.

⚠️ El silencio se anota **después** de que el correo sale. Si se anotara antes, un fallo de
envío dejaría el problema callado durante horas sin que nadie se hubiera enterado.

### Para recrear el cron (no está en las migraciones)
El job lleva el secreto dentro, así que **no puede vivir en un repositorio público**. Si hay que
rehacerlo: generar un secreto, `supabase secrets set ALERT_CRON_SECRET=...`, y crear el job con
`cron.schedule('alertas-closelabs', '*/15 * * * *', ...)` apuntando a la función con ese secreto
en `x-alert-secret`.

### ⚠️ Falta la llave de Resend
Sin `RESEND_API_KEY` la función evalúa, encuentra los problemas y **no manda nada** — devuelve
503 y lo escribe en sus registros, sin anotar el silencio, para que el día que aparezca la llave
el primer correo salga de inmediato. Hace falta: cuenta en Resend, dominio `closelabs.co`
verificado, y la llave en los secretos. Destino configurado: `admin@closelabs.co`
(`select * from alert_config`).

---

## 2026-09-20 — PLAN B DE TRANSCRIPCIÓN: resuelto y probado (pendiente #5)

Medido con **voz real** (grabación de Nicolás, 22 s) y con el audio clínico largo (38 s), los dos
en Opus 24 kbps, o sea exactamente lo que manda la app. Pista de vocabulario a 355 caracteres.

| proveedor / modelo | pista | latencia | resultado |
|---|---|---|---|
| `groq / whisper-large-v3-turbo` | sí | 347–1.659 ms | completo — **referencia actual** |
| `deepinfra / openai/whisper-large-v3` | sí | 1.117–2.800 ms | completo, **idéntico 5 de 5** |
| `openai / gpt-4o-mini-transcribe` | sí | 1.456–2.028 ms | completo, **mejor calidad** |
| `openai / gpt-4o-transcribe` | sí | 1.846 ms | igual que el mini, 2x el precio |
| `openai / whisper-1` | sí | 2.087–3.591 ms | completo pero lento |
| `deepinfra / …-v3-TURBO` | **sí** | 2.136 ms | ⚠️ **CERO CARACTERES** |
| `deepinfra / …-v3-TURBO` | no | 861 ms | completo (493 chars) |

**Las dos últimas filas son el hallazgo que sostiene todo lo demás.** El mismo audio, el mismo
modelo: con pista devuelve vacío, sin pista devuelve una transcripción perfecta. El fallo es de
la PISTA. Con pistas medianas no se vacía — **corta por la mitad y no avisa**. Ahora reproducido
con voz real, ya no solo con voz sintética.

### Qué cambió
`deepinfra` estaba marcado `supports_transcribe_prompt = false`, bandera puesta a partir del
turbo. Pero la fila usa el modelo **no-turbo**, que sí acepta la pista. O sea: teníamos un plan B
que habría funcionado *perdiendo el diccionario del médico*, sin necesidad. Corregido.

⚠️ **La bandera vive en el PROVEEDOR pero mide el MODELO.** Cambiar `transcribe_model` de
DeepInfra al turbo, dejando la bandera en true, reactiva el fallo silencioso. Queda escrito en el
comentario de la columna y en `providers.notes`.

### Precios (consultados el 2026-09-20)
| proveedor | por hora de audio | por médico/mes (~440 min) |
|---|---|---|
| DeepInfra whisper-large-v3 | $0,027 | **$0,20** |
| Groq whisper-large-v3-turbo | $0,040 | $0,29 |
| OpenAI gpt-4o-mini-transcribe | $0,180 | $1,32 |
| OpenAI whisper-1 | $0,360 | $2,64 |

Contra $30/mes de ingreso, **ninguno es un problema**. El plan B principal es incluso más barato
que lo que usamos hoy. ⚠️ Groq factura **mínimo 10 segundos por petición**: los dictados cortos
cuestan más de lo que dice la tabla.

### Orden de preferencia, ya configurado en `providers`
1. **Groq** (actual) — el más rápido.
2. **DeepInfra `openai/whisper-large-v3`** — plan B principal. Más barato, ~1,4 s, misma familia.
   Además **conserva la arroba** de los correos, que Groq pierde.
3. **OpenAI `gpt-4o-mini-transcribe`** — plan B si el problema es del propio Whisper: es otra
   arquitectura. Fue el único que oyó *"troponinas seriadas **y** se inicia"* donde los dos
   Whisper oyeron *"**si** se inicia"* — que dice algo clínicamente distinto.

### Cómo se cambia (probado en caliente, extremo a extremo)
```sql
update app_config set transcribe_provider = 'deepinfra';  -- o 'openai'
```
Tarda menos de un minuto en propagarse. Los tres se verificaron contra `/dictate` de verdad,
con `prompt_sent = true` en los tres casos.

---

## ESTADO AL 2026-09-19 (cierre de la Fase 1 — v0.6.0)

La Fase 1 quedó completa. Lo que se añadió en esta última vuelta:

### Config remota
`/config` + `remote_config.rs`. La app pregunta al arrancar y cada 6 h. **Probado en vivo**
subiendo `min_supported_version` a 0.9.9 y viendo la app bloquearse, y con `latest_version` a
0.7.0 viendo el aviso. Regla que no se negocia: **falla hacia abierto**. Un dedazo en la base no
puede dejar mudo un consultorio, y hay una prueba dedicada a eso
(`una_version_ilegible_nunca_bloquea`).

Cómo se usa, en la práctica:
- Sacar una versión nueva → `update app_config set latest_version='0.7.0'`. Aviso que se cierra.
- Una versión sale rota → `min_supported_version` + `blocked_message`. El dictado se detiene.
  ⚠️ Esto es el martillo. Quitarle el dictado a un médico a mitad de consulta se justifica solo
  con una versión rota o peligrosa.
- ⚠️ **Los instaladores 0.5.0 NO obedecen nada de esto**: no traen `remote_config`. Subir el
  mínimo a 0.6.0 no les mostrará ninguna pantalla — simplemente dejarán de formatear cuando se
  borre la llave vieja de Groq. Hay que avisarles por fuera.

### Reportar un problema
Botón en Ayuda. Lo que escribe el médico + el final del log (256 KB), limpiado EN LA APP antes de
salir. Se quitan: nombre de usuario en rutas, credenciales (por nombre y por longitud ≥40),
correos y los términos del diccionario —conservando cuántos son, porque ese número explica
varios fallos reales—. Verificado contra un log de verdad de 468 KB: cero fugas, y el texto
sigue siendo legible para diagnosticar.

El log va en la tabla `problem_reports`, no en Storage. Storage rechaza la llave que el runtime
de las Edge Functions inyecta (`sb_secret_…`) con "Invalid Compact JWS": solo acepta la JWT
antigua, en vía de retiro. La tabla quitó el bucket, los tipos MIME, una segunda ruta de
autenticación y el caso de "fila escrita, archivo perdido".

### Detección de fallos (pendiente #4) — a medias, a propósito
Tres vistas: `salud_ultima_hora`, `errores_recientes`, `uso_diario`.
```sql
select * from salud_ultima_hora;   -- ¿algo falla AHORA?
select * from errores_recientes;   -- ¿qué falla y desde cuándo?
select * from uso_diario;          -- ¿cuánto se está usando?
```
**Lo que destaparon el primer día:** 21 `rate_limit` de Groq en `format`, con **un solo
dispositivo** dictando. El techo de 8.000 TPM del plan gratis no es teórico, y ese número es la
mejor evidencia para el correo comercial a Groq.

⚠️ **Falta el canal.** Hoy hay que consultar las vistas a mano; nadie avisa solo. Conectar un
aviso automático (correo / WhatsApp / nada) es una decisión de CloseLabs y **no toca la app**:
se hace con pg_cron + pg_net cuando se decida a dónde mandarlo.

### Bug de seguridad encontrado y corregido
**El token del dispositivo se escribía en claro en el log**, en cada arranque, porque
`AppSettings` se vuelca entero con `{:?}` y `device_token` entró como `Option<String>` pelado.
Es una credencial: sirve para dictar contra nuestra cuenta hasta que se revoque. Y el log es el
archivo que el reporte de problemas empezaba a subir. Corregido con el tipo `Secret`
(`debug_output_redacts_the_device_token`).

La lección general, que vale para el futuro: **cualquier `String` que se añada a `AppSettings`
termina escrito en disco.** Si es un secreto, va en `Secret` o `SecretMap`.

### ✅ El CI ya no nombra ninguna llave de proveedor (2026-09-20)
`CLOSELABS_GROQ_API_KEY` salió de los dos workflows. No cambiaba el binario —la app no leía esa
variable desde que existe el proxy—, pero mientras el secreto siguiera nombrado ahí nadie se iba
a atrever a borrarlo. Ya se borró de la cuenta de Groq.

### Código muerto retirado
`llm_client.rs` perdió su cliente de chat y `proxy.rs` su `transcribe`. El primero importa: era
una segunda ruta directa al proveedor, con su propia llave, e invitaba a reconectar justo lo que
la Fase 1 vino a quitar.

### Versión a 0.6.0
Primeros instaladores **sin llave incrustada**. El número los distingue de los 0.5.0 en
`devices.app_version` y en `min_supported_version` el día que se retiren los viejos.

---

## ESTADO AL 2026-09-19 (fin de sesión — Fase 1 casi cerrada)

**Rama** `feat/sprint1-paridad-aztec`, todo subido, 130 pruebas Rust en verde, TypeScript compila,
cero código sin usar.

### Lo que quedó funcionando
- **Proxy completo y en producción** (proyecto `gdizmbuzepxnkiahbeoz`, São Paulo). La app NO
  contiene ninguna llave: verificado con `strings` sobre el binario compilado.
- **Un dictado = una llamada** (`/dictate`). Ciclo completo medido, de soltar la tecla a ver el
  texto pegado: **de 7-11 s a 2-4 s**.
- **Cambiar de proveedor es editar una fila** en `app_config`; se propaga en menos de un minuto
  (verificado). El día que Groq conteste el correo comercial, o haya que huir a DeepInfra, no se
  reinstala nada.

### Bugs de producción encontrados y corregidos esta sesión
1. **El diccionario borraba palabras del dictado.** "le dije a fernandinho" → "le dije
   Fernandinho"; "cada cinco días" → "cinco días". Silencioso: el texto queda bien escrito, solo
   que dice otra cosa. Perder un "cada" cambia una frecuencia de dosis.
2. **El formateador no tenía timeout.** Un proveedor colgado congelaba el dictado sin salida.
3. **Se perdió y se recuperó la ruta de respaldo del formateo:** al mudarlo al proxy, un 400 de
   Groq dejaba el texto sin puntuar. El respaldo vive ahora en el servidor.
4. **Los números dictados casi no se convertían** (3/12 → 17/18 tras reescribir la regla).
5. **Los atajos nuevos no aparecían** si no se había dado el permiso de Accesibilidad.

### Decisión de producto tomada
**El término del diccionario del médico es la última palabra.** Se aplica al FINAL, después del
formateo. Motivo: el formateador no es determinista ni con `temperature: 0` y sobrescribía el
término del usuario de forma intermitente. Esto además desbloqueó unir las dos llamadas.

### Lo que falta de la Fase 1
- Config remota en la app (leerla al arrancar, bloquear versiones viejas). La tabla y el endpoint
  ya existen.
- "Reportar un problema" con logs anonimizados + bucket `log-reports`.
- Alertas de uso (pendiente #4).
- **Recompilar los instaladores en CI** (saldrán sin llave) y **ahí sí borrar la llave vieja de
  Groq**. ⚠️ Mientras no se haga, los instaladores del Escritorio siguen con la llave vieja.

### Acciones del cliente
- [x] Correo comercial a Groq — **enviado el 2026-09-19.** ⚠️ Si hay respuesta, el dato más fuerte
  que tenemos es de `errores_recientes`: **21 `rate_limit` en un día con UN solo dispositivo**.
- [x] Rotar la llave de DeepInfra que quedó escrita en el chat — **hecho** (la de Groq ya se había
  rotado).
- [ ] **Volver el repo a privado** cuando se acaben los builds (hoy está público para el CI).
- [ ] **Borrar la llave vieja de Groq** de la cuenta. ⚠️ **NO antes** de que los testers estén en
  0.6.0: los instaladores 0.5.0 la llevan dentro y la usan directamente. En cuanto se borre, esos
  dejan de formatear —en silencio, cayendo a texto crudo— y no tienen config remota para avisar.

## ESTADO AL 2026-09-18 (para retomar)

- Rama `feat/sprint1-paridad-aztec`, commit `4d9442a`, **versión 0.5.0**. Todo verde:
  116 pruebas Rust, TypeScript compila. **Sin pushear** (esta sesión no tiene credenciales de
  GitHub).
- Probado con dictado real en Mac (M4): correo con arroba, signos dictados con excepción médica,
  diccionario con términos de 2 palabras corrigiendo en la nube, fallback offline, y la limpieza
  con `openai/gpt-oss-20b` funcionando. Tiempos: ~1,3 s transcripción + ~1,5 s limpieza + 0,4 s
  pegado.
- En `/Applications` quedó un build **--debug** (más lento al abrir). La versión anterior está en
  `~/Desktop/CloseLabs Voice (version anterior).app`.

### Cómo probar localmente (lecciones de esta sesión)
1. `bun tauri dev` **no sirve** para probar permisos: macOS le atribuye el permiso de
   Accesibilidad al proceso que lanzó la app (la terminal), no a la app.
2. Hay que compilar `bun tauri build --debug --bundles app`, copiar el `.app` a `/Applications`
   y abrirlo con `open`. Cada build cambia la firma → macOS revoca el permiso → hay que apagar y
   encender el interruptor en Ajustes → Privacidad → Accesibilidad.
3. `tccutil reset Accessibility com.closelabs.voice` limpia entradas viejas cuando se enredan.
4. El log vive en `~/Library/Logs/com.closelabs.voice/handy.log` **en hora UTC**.

### Para lanzar los builds de Intel y Windows (CI)
El workflow `.github/workflows/closelabs.yml` ya tiene los tres objetivos (macOS ARM, macOS Intel,
Windows) y se dispara con push a `main` o manualmente. Falta:
1. Autenticar GitHub en la máquina: `gh auth login` (o hacer el push a mano).
2. Decidir cómo pagar los minutos: el repo es privado y los minutos de macOS se agotan. La opción
   usada antes era hacerlo público un rato; es una decisión del cliente, no se hace sin permiso.
3. ⚠️ **Si se rota la API key de Groq, actualizar el secreto `CLOSELABS_GROQ_API_KEY` del repo** o
   los builds saldrán sin refine.
4. Conseguir alguien con Windows que pruebe el `.exe` (nunca se ha probado).

## Acciones del cliente (fuera de código)
- **Groq:** poner **alertas de saldo + auto-recarga + límite de gasto** en el dashboard (cuando se
  pueda pagar). Vigilar si reabren el Developer tier.
- Probar en **Windows** (pendiente) y seguir mandando feedback.

## Roadmap / Fase 2 (de antes)
- Firma + notarización (Apple Developer $99/año + Windows signing) → doble clic sin advertencias.
- Proxy propio de refine/transcripción (saca la key del binario, mide uso, alertas, gating de
  suscripción). Capa de cuentas/suscripción (estilo Aztec/Supabase) para cobrar.

## Infra / cómo compilar (recordatorio)
- Repo privado `nicolas-closelabs/closelabs-voice`. Builds en la nube con truco **público →
  `gh workflow run closelabs.yml` (o push a main) → privado** (macOS 10x minutos; en privado se
  agotan). Local: `bun install` + `bun tauri build --target …` con `CLOSELABS_GROQ_API_KEY`.
- ⚠️ **Opus:** `audiopus` usa autotools (`autoreconf`) → falla en Windows MSVC (probado). **Pero
  `opusic-sys` compila con cmake y Aztec lo usa en Windows** → ver pendiente #8.

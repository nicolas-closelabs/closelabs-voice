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

3. **Selector de modelos: solo ofrecer el del catálogo.** Un tester con instalación vieja ve
   Whisper (cacheado) + Parakeet y puede seleccionar el viejo. Fix: la app debe **solo ofrecer/usar
   el modelo del catálogo (Parakeet) e ignorar/auto-borrar** cualquier modelo que no esté en
   `catalog.json`. (Workaround manual para testers: borrar `~/.cache/huggingface/hub/models--*whisper*`
   o toda `~/.cache/huggingface` y reabrir.)

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

### Acciones del cliente pendientes
1. Correo comercial a Groq (el plan Developer lleva meses cerrado; es una fila por falta de chips).
2. Rotar la llave de DeepInfra que quedó escrita en el chat (la de Groq ya se rotó).
3. Volver el repo a privado cuando se acaben los builds.

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

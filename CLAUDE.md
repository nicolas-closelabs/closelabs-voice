# CLAUDE.md — CloseLabs Voice

> Fuente de verdad del proyecto. Léela antes de hacer cambios: contiene la arquitectura,
> las decisiones y el **porqué** de cada una, para que cualquier ajuste futuro tenga todo
> el contexto. Actualízala cuando cambien decisiones o arquitectura.

## Estado actual (v0.8.4 publicada)

> **SIN PUBLICAR — el techo de salida tumbaba todos los dictados largos.** `MAX_OUTPUT_TOKENS`
> estaba en 2.000 y el modelo se quedaba sin cupo a mitad de la respuesta: devolvía **HTTP 200**
> con `finish_reason: "length"` y el JSON cortado, `JSON.parse` fallaba y se reportaba como
> `empty_result`. Al ser 200, el reintento sin esquema (que solo mira el 400) no saltaba, y el
> respaldo tampoco servía: **los tres proveedores sirven el mismo `gpt-oss-20b` y truncan en el
> mismo punto**. Resultado: el médico recibía texto crudo justo en los dictados largos.
> Medido sobre 10 dictados reales del 2026-09-22: `salida ≈ 240 + 24,2 × segundos de audio`, o sea
> **el techo se agotaba a los 73 s**; un dictado de 60 s gastó 1.877 tokens (94% del techo) y otro
> de 84 s se cayó en los tres proveedores. Arreglo: techo a **8.000** (5,3 min de dictado),
> código de error propio **`truncated`** que NO gasta la cadena de respaldo ni se reintenta en la
> app, y presupuestos de tiempo al alza (`PRESUPUESTO_MS` 12→25 s, `TOPE_INTENTO_MS` 7→12 s,
> `FORMAT_TIMEOUT` en `proxy.rs` 15→30 s) porque formatear tarda en proporción al largo de la
> salida (~830 tokens/s medidos contra Groq).
> ⚠️ **Nunca rescatar el texto truncado**: media historia clínica que PARECE completa es peor que
> una nota sin puntuar. Al fallar se pega la transcripción cruda ENTERA.
> ⚠️ **Más allá de 5,3 min no se arregla subiendo el techo**: 32.000 tokens serían ~38 s de espera
> para el médico. Ese caso pide **partir el dictado en trozos**, no un techo más alto. Vigilar
> `truncated` en `errores_recientes` para saber si hace falta.

> **v0.8.4 — PUBLICADA (2026-09-24).** Permisos de Mac de a un paso, con la guía visual ANTES de
> abrir Ajustes del Sistema. En la misma tanda: el ícono con las proporciones del sistema y el pie
> de página sin el falso "activar" del modelo.
>
> ⚠️ **El prompt de limpieza ya NO manda desde el instalador:** vive en `app_config.format_prompt`
> y el proxy usa ese. El de `settings.rs` queda de respaldo por si la columna se vacía. Afinar el
> formateo NO requiere versión nueva.
>
> **v0.8.3 — sin pagar no se dicta** (el respaldo local se activaba también con "no pagó": apagar
> el wifi daba dictado gratis; ver `CODIGOS_SIN_PERMISO` en `proxy.rs`) y el ícono con las
> proporciones de macOS. Preparación del canal gMedic: ver Fase 5 del ROADMAP.
>
> **v0.8.2 — cuentas que no se pisan.** Cada cuenta tiene su propia ficha de equipo en el mismo
> computador (antes la segunda cuenta veía "0 de 3" y sus dictados se le cobraban a la primera),
> cerrar sesión saca de la app Y corta el dictado (se autoriza con el token del equipo, no con la
> sesión), el tutorial se marca por cuenta y cabe en la ventana mínima. **Formateo en OpenRouter**
> (servidor Groq): mismo modelo, sin el techo del plan gratis, ~$0,00025 por dictado.
>
> **v0.8.1 — el dictado se escribe DENTRO de la app** (antes nunca: el tutorial no funcionaba; ver
> `VENTANA_PRINCIPAL_ENFOCADA` en `clipboard.rs`), tutorial de una instrucción a la vez + paso del
> diccionario, nuevo orden del menú y más señales de autocorrección ("mentira", "perdón"…).
>
> **v0.8.0 — AUTOSERVICIO.** El público son médicos de 40-50 años o más, poco familiarizados con la
> tecnología y casi todos en **Windows**; tienen que poder instalar, registrarse y dictar solos.
> Atajo correcto por sistema en toda la app (`shortcutLabels.ts` + `useShortcutKeys` — ⚠️ nunca
> escribir teclas a mano en un texto: la app le decía "⌥ + Espacio" a usuarios de Windows),
> WhatsApp de soporte en todas partes (`branding.ts`), entrar solo tras confirmar el correo, y el
> tutorial "Tu primer dictado". Detalle y pendientes en la Fase 2.5 de `ROADMAP.md`.
>
> **v0.7.0 — CUENTAS.** Registro, sesión persistente (archivo 0600, NO el llavero — ver
> `auth.rs`), 3 equipos por cuenta y suscripción aplicada en el proxy. `require_account` encendido.

### v0.6.0

Compila (backend+frontend). Funciona end-to-end en Mac. **Fase 1 cerrada: el instalador ya no
contiene ninguna llave de proveedor.**

> **v0.6.0 — PROXY PROPIO (Fase 1).** La app ya no habla con Groq: manda el audio y el texto a
> nuestras Edge Functions en Supabase, que guardan las llaves y deciden el proveedor leyendo una
> tabla. **Cambiar de proveedor es editar una fila** y todas las instalaciones obedecen en menos
> de un minuto — antes había que recompilar y reinstalar en el computador de cada médico, y eso
> pasó de incómodo a bloqueante cuando Groq cerró su plan de pago. Un dictado completo va en UNA
> llamada (`/dictate`): de 7-11 s a 2-4 s. Detalle y mediciones en `BACKLOG.md`.
>
> Además: **configuración remota** (`remote_config.rs` + `/config`) para avisar de versiones
> nuevas o detener una versión rota, siempre **fallando hacia abierto**; **reportar un problema**
> desde Ayuda, con el log limpiado en la app; y tres vistas de salud sobre `usage_events`.
>
> ⚠️ **Regla que se aprendió a golpes:** cualquier `String` que se añada a `AppSettings` termina
> escrito en el log (se vuelca entero con `{:?}` en cada arranque). Si es un secreto, va envuelto
> en `Secret` o `SecretMap`. El `device_token` se escapó así y quedó en claro en los logs.

> ⚠️ **v0.6 — CAMBIO DE ARQUITECTURA: transcripción HÍBRIDA (como Aztec).** Confirmamos en los
> **logs reales de Aztec** que su calidad superior en texto largo viene de transcribir en la
> **NUBE** (Groq Whisper `large-v3-turbo`); su Parakeet local es —en sus propios strings— solo
> *"offline fallback"*. Nuestro Parakeet-siempre-local se enredaba en dictados largos (la
> auto-detección de idioma se voltea a inglés → "garabato"). Replicamos su arquitectura:
> **Online → Groq Whisper (principal); offline o si falla → Parakeet local.** Código:
> `groq_transcribe.rs` (POST multipart a Groq `/audio/transcriptions`), branch en
> `actions.rs` (`try_cloud_transcription`), toggle `cloud_transcription_enabled` (settings.rs,
> default ON, UI oculta), idioma `auto` (como Aztec), **refine** (hoy `openai/gpt-oss-20b`,
> ellos también refinan encima del Whisper). **⚠️ CAMBIO DE PRIVACIDAD: el audio del paciente SÍ
> sale a Groq cuando hay internet** (offline sigue 100% local).
>
> **Compresión de subida (velocidad en internet lento LatAm) — HECHO, ahora en OPUS:** el cuello
> de botella de la nube no es Groq (0,5 s) sino la SUBIDA. `groq_transcribe.rs` sube el audio como
> **Ogg/Opus 16 kHz mono a 24 kbps** (`opus_encode.rs`), con **cadena de respaldo Opus → FLAC →
> WAV**: se baja un escalón solo si la codificación falla o si Groq rechaza el FORMATO (400/415/422);
> cualquier otro error corta y cae a Parakeet. Así nunca quedamos peor que antes de comprimir.
> **Medido contra la API real** con un dictado clínico de 38 s: WAV 1,23 MB → FLAC 668 KB → **Opus
> 110 KB** (11x / 6x), y los tres devolvieron la **misma transcripción carácter por carácter**
> (incluidos "metformina 850 mg", "atorvastatina", "isotretinoína"). Opus tiene pérdida, pero es el
> códec diseñado para voz y a 24 kbps no le mueve el WER a Whisper; Aztec 1.8.2 hace lo mismo.
> ⚠️ **Por qué Opus estaba descartado y ya no:** el problema era de COMPILACIÓN, no de calidad —
> `audiopus` construye libopus con **autotools** (`autoreconf`) → inviable en Windows MSVC. El
> reemplazo es **`opusic-sys`**, que lo construye con **cmake** (ya es requisito nuestro: lo usa
> transcribe-cpp). **Verificado en CI: compila en macOS ARM, macOS Intel y Windows MSVC.** No
> volver a `audiopus`.
>
> **Benchmark completo de Aztec 1.8.2 → `AZTEC-BENCHMARK.md`** (qué nos falta, priorizado por sprint).
>
> **Wording de privacidad — HECHO (honesto + bajo roce, estilo Aztec sin la mentira "local"):**
> en Instructions/Help/About se puso *"100% privado y seguro. Tus dictados no se almacenan ni se
> usan para entrenar modelos."* y se quitaron los claims falsos ("100% local", "offline", "tu voz
> nunca se sube"). ⚠️ **NUNCA** volver a afirmar "audio 100% local / nunca sale del equipo" en la
> UI: es comprobablemente falso con el híbrido y sería un riesgo con clientes médicos.

Highlights acumulados:
- **Transcripción → Parakeet TDT 0.6b v3 (GGUF Q5_K_M)** vía transcribe-cpp. ⚠️ **CAMBIO CLAVE
  (v0.5): se volvió a Parakeet.** Whisper Medium era demasiado PESADO en CPU (Intel/Windows se
  colgaban ~48s por 2.5s de audio). Parakeet 0.6b es **~30x más rápido en CPU**, **más preciso**
  (WER 6.32 vs 7.44), excelente en español (WER 3-4%) y **maneja bien el espanglish médico**
  (metformina, bypass, stent, "industrial engineer" se quedan como se dijeron). El "garabato" de
  la v0.1/v0.2 con Parakeet **era caché vieja** (confirmado: instalación limpia transcribe
  perfecto). Parakeet **auto-detecta idioma** (no se fuerza; para español puro acierta). Ficha:
  `nvidia/parakeet-tdt-0.6b-v3` (25 idiomas europeos, CC-BY-4.0). GGUF: `handy-computer/parakeet-tdt-0.6b-v3-gguf`.
- **Refine → Groq `openai/gpt-oss-20b` con salida JSON estricta.** ⚠️ **2026-09-18: Groq RETIRÓ
  `llama-3.3-70b-versatile` y `llama-3.1-8b-instant`** → la API devolvía 404 en cada dictado y el
  refine caía a texto crudo en silencio (los instaladores entregados quedaron así; hay que publicar
  build nuevo). El reemplazo se verificó contra la API real con dictados clínicos: 0,85–1,5 s, y con
  `json_schema` estricto obedece mejor. `openai/gpt-oss-120b` falló al generar el JSON → descartado.
  _Histórico:_ antes `llama-3.3-70b-versatile` (el 8B se negaba). Prompt = **formateador general**
  (puntúa/estructura, quita muletillas; NO médico, NO parafrasea). **Regla añadida: NO TRADUCIR** —
  conserva en su idioma los términos que el usuario dijo en inglés (antes traducía "industrial
  engineer" → "ingeniero industrial"). ⚠️ **El refine se aplica
  SIEMPRE que `post_process_enabled=true`** (default), sin importar el atajo: en `actions.rs`,
  `post_process = self.post_process || post_process_enabled` (antes el atajo `transcribe` salía
  crudo sin puntuación — bug corregido). Migración en `ensure_post_process_defaults` fuerza
  modelo+prompt del código. Key Groq embebida (env build-time). Offline → RAW + guarda anti-rechazo.
- **Binario** `closelabs-voice` (crate + lib `closelabs_voice_lib`); nada de "handy" visible.
- **Rediseño v0.3b:** tema **blanco + acentos lila** (light forzado con `@custom-variant dark`
  class-based), sidebar tipo Aztec: **Inicio · Diccionario · Configuración · Instrucciones ·
  Acerca de · Ayuda** (`src/components/settings/{home,instructions,help}/`). Configuración
  simplificada (esconde lo técnico). Instrucciones = tutorial animado (`Instructions.css`).
- **Íconos:** app = blanco + isotipo negro grande; tray = isotipo (más grande). Overlay oscuro
  neutro (`#17161C`), **por defecto ABAJO** (`OverlayPosition::Bottom` — no tapa el centro),
  logo grande, tagline "Automatiza tu consultorio · closelabs.co".
- **Overlay arrastrable (importante — causa raíz):** el overlay es un **NSPanel no-activable**
  (macOS) que **NO entrega `pointermove`/mouseDragged al webview**, así que NADA de lo típico
  mueve la ventana: ni `-webkit-app-region: drag`, ni arrastre JS manual, ni `startDragging`
  (`performWindowDragWithEvent`). Los **clics SÍ llegan** (mouseDown/Up). Solución en
  `overlay.rs`: comandos `start_overlay_drag`/`stop_overlay_drag` — en `pointerdown` un **loop en
  Rust lee el cursor GLOBAL** (`input::get_cursor_position`, vía enigo) y mueve la ventana con
  `set_position` hasta `pointerup`. **Cross-platform:** enigo devuelve coords lógicas en macOS
  pero **físicas** en Windows/Linux → `cursor_logical()` normaliza según plataforma (correcto a
  cualquier DPI). **Recuerda la posición** arrastrada durante la sesión (`LAST_DRAG_POS`, en
  memoria; se resetea al reiniciar → vuelve a abajo). Cero dependencias nuevas, cero peso extra.
- **Ventana/Dock (macOS):** política **Regular** (ícono en el Dock siempre). El **autostart de
  login** pasa `--start-hidden` (arranca oculto); la **apertura manual muestra la ventana**
  (`should_hide = cli_args.start_hidden`). Cerrar solo oculta (Reopen/single-instance reabren).
- **Defaults:** modo toggle, mute-while-recording ON, audio-feedback ON, sin history/audio, es.

## Distribución (por qué "no abre en otros Macs") — CI + firma

> 📄 **Todo lo de firmar (Apple y Windows) vive en `FIRMA-Y-DISTRIBUCION.md`**: precios, pasos,
> secretos, y qué puede hacer cada entidad según su país. ⚠️ **No existe ninguna sociedad** (Nicolás
> es persona natural colombiana; el socio español es autónomo). Por eso: Apple como persona natural
> ($99, convertible a empresa sin perder el Team ID) y **Windows con SSL.com IV a nombre de Nicolás**
> (~$309/año). Azure Artifact Signing exige una organización; se abre el día que CloseLabs se
> constituya en la UE o EE.UU. (**no** pide antigüedad mínima, aunque medio internet diga que sí).
> Leer antes de pagar.


⚠️ **Un `.dmg` compilado localmente NO se distribuye a otros equipos.** Dos razones (confirmadas):
1. **Arquitectura:** `bun tauri build` local sale **solo arm64** → **no corre en Macs Intel**
   (necesitan build `x86_64`). Se compila por separado (Handy no hace universal para Intel).
2. **Firma/notarización:** el build local es **ad-hoc** (`signingIdentity: "-"`, `hardenedRuntime`
   on). En OTRO Mac, macOS le pone `com.apple.quarantine` y Gatekeeper lo bloquea ("dañada"/
   "desarrollador no verificado"). Solo abre en el equipo que lo compiló. **Handy SÍ abre para
   todos porque está firmado + notarizado** (su `build.yml` usa `APPLE_CERTIFICATE`/`APPLE_ID`/
   `APPLE_TEAM_ID` → una cuenta Apple Developer de pago). **"Open source" ≠ "sin firma".** No hay
   camino gratis al "doble clic": o notarizas ($99/año) o el usuario hace bypass manual.

**Bypass temporal (solo testers técnicos):** `xattr -cr "/Applications/CloseLabs Voice.app"`
quita la cuarentena. **NO sirve para médicos 0-techie** (requiere Terminal).

**macOS = UN SOLO `.dmg` universal (desde 2026-09-21).** Antes había uno para Intel y otro para
Apple Silicon, y el médico no sabe qué chip tiene. El ejecutable lleva las dos versiones y macOS
escoge al abrir. Lo arma `build-macos-universal.yml`: compila cada arquitectura **por separado y en
paralelo, con sus mismos arreglos de siempre** (Intel: ONNX dinámico, Metal OFF, AVX2/F16C ON; ARM:
Metal, ONNX estático), las une con `lipo` y `tauri bundle --target universal-apple-darwin` arma el
dmg. ⚠️ **No usar `tauri build --target universal-apple-darwin` a secas:** compila ambas con las
mismas variables de entorno y se pierde uno de los arreglos. El job verifica (y no publica si falla):
las dos arquitecturas, F16C/FMA en Intel, que ARM no dependa del `.dylib`, firma, y arranque de ambas.
⚠️ El `.dylib` de ONNX se declara en `frameworks` **antes de compilar** Intel: así tauri-build enlaza
el rpath `@executable_path/../Frameworks`; sin él la versión Intel se cierra al abrir (pasó en el 1er
build). Peso: ~39 MB. `build.yml` sigue sirviendo para compilar una sola arquitectura si hiciera falta.

**CI (la solución real, estilo Handy):** en `.github/workflows/` quedó un pipeline limpio:
- **`build.yml`** — workflow reusable heredado de Handy (compila, baja el **ONNX Runtime x86_64**
  para el slice Intel — `ort-sys` no trae prebuilt de `x86_64-apple-darwin`—, firma/notariza si
  hay secretos). Editado: inyecta `CLOSELABS_GROQ_API_KEY` (secreto), binario `closelabs-voice`.
- **`closelabs.yml`** — orquestador propio. **Fase 1 (actual): macOS ARM+Intel, `sign-binaries:
  false`** (artefactos `.dmg` descargables del run; abren con `xattr`). **Fase 2:** poner secretos
  `APPLE_*` + `sign-binaries: true` → firmado+notarizado, doble clic sin advertencias. Windows se
  añade a la matriz igual (aparte). Se **borraron** los orquestadores Handy (main-build, release,
  nix-check, test, etc.) para no lanzar jobs de Linux que fallan.
- **Secreto requerido en el repo:** `CLOSELABS_GROQ_API_KEY` (Settings → Secrets → Actions).
- **Fase 2 (notarización) requiere:** cuenta Apple Developer + secretos `APPLE_CERTIFICATE`,
  `APPLE_CERTIFICATE_PASSWORD`, `APPLE_ID`, `APPLE_PASSWORD` (app-specific), `APPLE_TEAM_ID`,
  `KEYCHAIN_PASSWORD`. ⚠️ **Al pasar a Fase 2, volver a poner `hardenedRuntime: true`** en
  `tauri.conf.json` (la notarización lo exige).

⚠️ **Bug Intel resuelto (build x86_64 se cerraba al abrir):** el build de Intel enlaza el ONNX
Runtime **dinámicamente** (`libonnxruntime.1.24.2.dylib`, empaquetado en `Contents/Frameworks/`);
con `hardenedRuntime: true` + firma ad-hoc, macOS (Library Validation) **rechazaba** ese dylib de
terceros → crash `Library not loaded @rpath/libonnxruntime`. Fix: (1) entitlement
`com.apple.security.cs.disable-library-validation` en `Entitlements.plist`, y (2) Fase 1
`hardenedRuntime: false` (garantía sin firma). El build **ARM no sufre** esto (ONNX estático, sin
dylib externo). En Fase 2, al firmar con Developer ID el dylib queda firmado por nosotros → carga
ok con hardened runtime (el entitlement queda de respaldo).

⚠️ **Bug Intel #2 — transcripción "colgada" (en realidad lentísima):** el modelo cargaba y
grababa bien, pero la transcripción tardaba ~48s para 2.5s de audio (parecía colgada). Causa
(confirmada desensamblando el binario: **0 instrucciones F16C**): al cross-compilar x86 en runner
ARM, `-march=native` no aplica y `GGML_NATIVE=OFF` deja ggml **sin vectorizar** (SSE/escalar) →
Whisper Medium por CPU 5-10x más lento. Fix: en `build.yml` (paso x86) `TRANSCRIBE_CMAKE_ARGS`
añade `-DGGML_AVX=ON -DGGML_AVX2=ON -DGGML_FMA=ON -DGGML_F16C=ON` (baseline Haswell 2013+). Verificar
tras el build que el binario Intel ya tenga `vcvtph2ps` (F16C) > 0. Nota pendiente: `selected_language`
sale `"auto"` en fresh install (el log muestra `language=None`); el spec pide forzar `"es"` — revisar.

## Multiplataforma (Windows)

El código es **cross-platform** (Tauri). Lo específico de macOS está detrás de `#[cfg]`:
activation policy (Dock), NSPanel del overlay, stub de Apple Intelligence. En **Windows** el
overlay usa `WebviewWindowBuilder` (la posición Center también aplica), tray/íconos (`.ico`),
Whisper vía transcribe-cpp (Vulkan/CPU) y el refine Groq funcionan igual. **Pendiente:** compilar
y probar el `.exe` (requiere máquina o **CI de Windows** — hay base en `.github/`). No se ha
buildeado Windows todavía.

**Rediseño (hecho en v0.3b):** tema blanco + acentos lila; sidebar completo; settings simples.
**Pendiente:** build Windows (CI), prueba real con micrófono, firma/notarización, proxy de refine.

## Qué es

**CloseLabs Voice** es una app de escritorio de **dictado por voz para médicos**: el médico
presiona un atajo global, habla, y el texto transcrito y limpio se pega en cualquier campo
(historia clínica, WhatsApp, etc.). Producto de **CloseLabs** (plataforma de IA para clínicas
en LatAm). Es un **rebrand/fork del proyecto open-source Handy** (github.com/cjpais/Handy, MIT),
app **Tauri v2**.

## Contexto de producto (lo que manda en el diseño)

- **Usuario final:** médicos poco técnicos, en **computadores débiles**, con **internet
  inestable** (clínicas de LatAm). Idioma: **español latino** (Colombia, México, Perú).
- **Privacidad:** se manejan datos de **pacientes**. ⚠️ **v0.6:** con la transcripción híbrida el
  audio **SÍ sale a Groq cuando hay internet** (offline sigue 100% local). Es la misma decisión que
  Aztec (que se vende como "privacy-first" apoyándose en que Groq no entrena/retiene datos de API).
  Hay que **actualizar el mensaje de privacidad de la app** para reflejarlo con honestidad.
- **Negocio:** producto **de pago** (~$30/mes/médico). Lanzamiento a producción **sin fallas**.
- **Debe ser modificable**, no estático (marca, modelo, refine: todo parametrizable).

## Arquitectura

```
Atajo global (toggle) → grabar audio
   → ¿hay internet?  (transcripción HÍBRIDA)
        sí → [NUBE] Groq Whisper large-v3-turbo → texto   ← PRINCIPAL (calidad Aztec; audio SÍ sale)
        no → [LOCAL] Parakeet TDT 0.6b (GGUF) → texto      ← fallback (audio NO sale)
   → diccionario/auto-corrección local (offline, siempre; términos médicos)
   → ¿hay internet?
        sí → [NUBE] Refine con Groq (openai/gpt-oss-20b, JSON estricto) → texto limpio
        no → RAW (texto crudo + diccionario local)
   → pegar en la app activa
```

- **Transcripción: HÍBRIDA (v0.6 — ver nota de arriba).** Online → **Groq Whisper `large-v3-turbo`
  en la NUBE** (principal, calidad Aztec; el audio SÍ sale a Groq). Offline o si la nube falla →
  **Parakeet TDT 0.6b (GGUF `Q5_K_M`) LOCAL** vía `transcribe-cpp` (fallback; el audio NO sale).
  Idioma `auto` (como Aztec). ⚠️ El texto histórico de abajo (Whisper Medium local "siempre") quedó
  obsoleto con el híbrido; se conserva por contexto de las decisiones previas.
  - _Histórico:_ **Whisper Medium**, GGUF `Q5_K_M` (~583 MB), vía **`transcribe-cpp`** (GGML), se
    forzaba a español (`selected_language="es"`); Whisper respeta el idioma forzado.
  - ⚠️ **Historia (por qué Whisper y no Parakeet):** la v0.1/v0.2 usaba **Parakeet TDT v3**
    (transductor). Parakeet **no respeta bien el idioma forzado** → autodetectaba por segmento y
    mezclaba inglés/español (el "garabato"). Se cambió a Whisper en v0.3 porque **sí** honra
    `language=es` (por eso Aztec, que usa Whisper, transcribe bien). La ruta de idioma:
    `transcription.rs` (`run_options.language`) + `effective_language()` (`model.rs`).
  - Nota: Whisper puede alucinar en silencios → mitigado con VAD (on) + guarda anti-alucinación
    en `actions.rs`. Es más lento que Parakeet en CPU, pero la precisión en español manda.
- **Refine (limpieza: muletillas, puntuación, formato): EN LA NUBE vía Groq** cuando hay
  internet; **offline cae a RAW** + diccionario local. Solo viaja **texto**, nunca audio. Va
  ACTIVADO por defecto pero su UI está **oculta** (config interna nuestra). CloseLabs asume el
  costo (~$0.10–$1.20/médico/mes cobrando $30 → margen ~97%). Guarda anti-alucinación en
  `actions.rs` (descarta salida vacía/desproporcionada → RAW).
- **Entrega del modelo:** instalador liviano (~18 MB; el modelo NO va dentro). En el **1er
  arranque la app lo descarga automáticamente** (el onboarding auto-inicia/observa la descarga;
  sin flujo manual ni selector). Fuente: **HuggingFace `handy-computer/parakeet-tdt-0.6b-v3-gguf`**
  (archivo `parakeet-tdt-0.6b-v3-Q5_K_M.gguf`, ~549 MB), cacheado en `~/.cache/huggingface`.
  Catálogo reducido a esa única entrada en `src-tauri/src/catalog/catalog.json`.

## Stack técnico

- **Tauri v2** (shell liviano; usa el webview del SO, no Chromium → app pequeña).
- **Backend:** Rust (`src-tauri/`). Transcripción vía **`transcribe-cpp`** (GGML, para el
  Parakeet GGUF; requiere **cmake** para compilar `transcribe-cpp-sys`); ONNX Runtime también
  presente para otros motores; VAD Silero; atajos `rdev`.
- **Frontend:** React 18 + TypeScript + **Tailwind CSS v4** (config en CSS con `@theme`, NO hay
  `tailwind.config.js`), Zustand (estado), i18next (i18n), lucide-react (íconos).
- **Package manager:** **Bun** (`bun.lock`). Comandos abajo.

## Decisiones clave y el porqué

| Decisión | Elección | Por qué |
|---|---|---|
| Base | Fork de Handy (no aria, no desde cero) | Maduro/estable; MIT. aria tenía features incompletas |
| Plataformas | macOS + Windows | Donde están los médicos |
| Transcripción | Local **Whisper Medium** GGUF Q5_K_M, español fijo | Whisper respeta `es` (Parakeet no) → español fiable; privado/offline |
| Refine | Nube Groq, offline→raw | Cero RAM/peso local; costo trivial cobrando $30; potente |
| API key refine | Embebida (v1), límite de gasto + endpoint configurable | Rápido de montar (como Aztec); migrar a proxy = solo cambiar URL |
| Modelo | Descarga automática 1er arranque (no bundled) | Instalador liviano; UX sin fricción |
| Firma | Windows: SSL.com IV + eSigner. macOS: Apple Developer. Ambas a nombre de Nicolás | No existe sociedad; son las únicas que no la exigen. Ver `FIRMA-Y-DISTRIBUCION.md` |

Investigamos a fondo **Aztec Voice** (`co.azteclab.voice`), otro fork de Handy que el cliente
admira: transcripción híbrida (Groq Whisper online / Parakeet offline), refine con Groq
`llama-3.3-70b`, key embebida, auth/suscripción Supabase. Copiamos su estrategia liviana
**pero mejorada para medicina** (transcripción siempre local por privacidad; Parakeet por no
alucinar).

## Marca (Brand Guideline CloseLabs)

- **Nombre:** "CloseLabs Voice" · **Bundle id:** `com.closelabs.voice`.
- **Modo por defecto: Light.** Paleta lila:
  - Fondos: `#F5EDFF` / `#F0E6FF` / `#EBE0FF`; invertido `#201020`.
  - Texto: `#1A1620` (primario), `#6F677E` (secundario), `#A39AAA` (muted), `#F5EDFF` (invertido).
  - **Acento: `#A439FF`** (primario) / `#8B2FF3` (secundario); focus `#A439FF`.
  - Bordes: `#A39AAA` @70%, sutil `#D4CCE0` @30%.
- **Tipografías:** **Inter** (títulos) + **Plus Jakarta Sans** (cuerpo). Empaquetadas local
  (`@fontsource/*`), sin CDN → funciona offline.
- **Logo (regla crítica):** usar el **archivo provisto tal cual** — NUNCA recrear, redibujar
  ni vectorizar el isotipo hexagonal. Ícono de app = isotipo; wordmark completo en la UI.

## Comandos

```bash
bun install            # instalar deps del frontend
bun tauri dev          # correr la app en desarrollo (requiere Rust + Bun + cmake)
bun tauri build        # compilar instaladores (.dmg / .exe/.msi)
bun run lint           # eslint
bun tauri icon <png>   # generar íconos desde un PNG 1024x1024
```
Requiere toolchain: **Rust (cargo)** + **Bun** + **cmake** (lo usa `transcribe-cpp-sys`,
el motor GGML) + Xcode CLT (macOS). cmake se puede instalar con `brew install cmake` o
`pip install --user cmake`.

**Proveedores (desde v0.6.0):** ⚠️ **NO hay ninguna llave en el build.** `bun tauri build` a
secas produce el instalador final. Las llaves viven en los secretos de Supabase y el proveedor se
elige en la tabla `app_config` (columnas `transcribe_provider` / `format_provider`).

**El prompt de limpieza vive en `app_config.format_prompt` (desde 2026-09-24).** La app manda el
suyo, pero el proxy usa el de la base si está puesto: afinar el prompt ya NO exige instaladores.
⚠️ Al tocarlo, correr `bun pruebas-dictado/correr.ts` antes y después y comparar — un ejemplo
nuevo arregla un caso y puede romper otro, y sin el banco no hay forma de saberlo.

**Banco de pruebas del dictado: `pruebas-dictado/`.** 9 dictados fijos (dos de ellos reales, de
3 y 6 minutos) × 3 repeticiones, comprobando que no se pierda ningún número, que los términos
clínicos sigan ahí, que el texto llegue al final y que no sobreviva lo retractado. Ningún cambio
en el formateo (modelo, prompt, troceado) se da por bueno sin pasarlo. Los fallos de estos
modelos son INTERMITENTES: por eso 3 repeticiones, y un 2/3 cuenta como fallo.

**Respaldo automático (desde 2026-09-21):** cada tipo tiene una cadena ORDENADA en `app_config`
(`transcribe_fallbacks`, `format_fallbacks`). Hoy: transcribir groq → deepinfra → openai; formatear
**openai (gpt-4o-mini) → openrouter → groq** (OpenRouter sirve el mismo modelo a través de Groq, sin el techo
de tokens/minuto del plan gratis; `providers.extra_body` dice qué servidor debe usar). Si el principal falla, el proxy prueba el siguiente en el mismo dictado. ⚠️ Al
tocar `_shared/transcribe.ts` o `_shared/format.ts`, correr antes
`bun supabase/functions/_tests/respaldo.test.ts`. ⚠️ Desplegar SIEMPRE la migración antes que el
código: si el código lee columnas que no existen, fallan todos los dictados.

Cambiar de proveedor, de modelo o avisar de una versión nueva se hace **sin recompilar**:
```sql
update app_config set transcribe_provider = 'openai',   -- cambiar el principal…
                      transcribe_fallbacks = '{deepinfra,groq}';  -- …y su respaldo, en orden
update app_config set format_provider     = 'deepinfra';
update app_config set latest_version      = '0.7.0';      -- aviso de actualización
```
Los tres proveedores (`groq`, `deepinfra`, `openai`) están medidos contra `/dictate` real y la
tabla `providers.notes` dice qué se midió de cada uno. ⚠️ **No cambiar `transcribe_model` sin
volver a medir la pista de vocabulario:** el turbo de DeepInfra devuelve la transcripción VACÍA
cuando lleva pista. Detalle en `BACKLOG.md` (2026-09-20).
⚠️ Groq retira modelos sin aviso: si el formateo deja de limpiar, mirar `errores_recientes` y
`curl https://api.groq.com/openai/v1/models`. Sin internet, el formateo cae a texto crudo.

## Estructura / archivos clave

- `src-tauri/src/settings.rs` — **defaults del producto**: `selected_language="es"`,
  `app_language="es"`, `push_to_talk=false` (toggle), `start_hidden=true`, `autostart=true`,
  `show_whats_new=false`, `post_process_enabled=true` + proveedor Groq + modelo + prompt médico ES
  + `post_process_selected_prompt_id` + key embebida (`option_env!("CLOSELABS_GROQ_API_KEY")`).
- `src-tauri/src/actions.rs` — flujo transcribir→refinar→pegar; **NO guarda `.wav` ni historial**.
- `src-tauri/src/proxy.rs` — cliente de nuestras Edge Functions (`/register`, `/dictate`,
  `/format`). Es el ÚNICO camino a un proveedor; la app no conoce ninguna llave.
- `src-tauri/src/remote_config.rs` — pregunta al arrancar si esta versión sigue siendo válida.
  Falla hacia abierto siempre; ver la nota larga en el encabezado del archivo.
- `src-tauri/src/problem_report.rs` — "Reportar un problema": limpia el log antes de que salga
  del computador. ⚠️ Al añadir una regla nueva ahí, la norma es: ante la duda, se borra.
- `src-tauri/src/auth.rs` — cuenta del médico (entrar, registrarse, vincular el equipo). ⚠️ **La
  sesión NO va al llavero del sistema**: va a `sesion.json` (0600) en la carpeta de datos. Sin
  firma de Developer ID, el llavero de macOS ata el permiso al **hash del binario**, así que cada
  versión nueva le exigía al médico la contraseña de su Mac nada más abrir la app — parece
  malware. **No volver a meter `keyring` mientras las compilaciones sigan sin firmar.** El porqué
  completo, y el argumento de por qué el costo de seguridad es casi nulo, están en el encabezado
  del archivo.
- `supabase/` — migraciones y Edge Functions. Proyecto `gdizmbuzepxnkiahbeoz` (São Paulo).
- `src-tauri/src/groq_transcribe.rs` — ya no llama a Groq: quedan `build_whisper_prompt` (el
  diccionario como pista) y la cadena de formatos `UPLOAD_FORMATS` (Opus → FLAC → WAV).
- `src-tauri/src/opus_encode.rs` — codificador Ogg/Opus escrito a mano sobre `opusic-sys` + `ogg`
  (RFC 7845: `OpusHead`, `OpusTags`, granule positions a 48 kHz).
- `src-tauri/src/catalog/catalog.json` — catálogo reducido a Parakeet v3 (default_quant `Q5_K_M`).
- `src-tauri/src/managers/{model,transcription}.rs` — carga de modelo + idioma (`effective_language`).
- `src-tauri/src/overlay.rs` (tamaño ventana) + `src/overlay/RecordingOverlay.{tsx,css}` —
  overlay branded (card oscura + logo `public/brand/closelabs-white.png` + barras lila + tagline).
- `src-tauri/build.rs` — stub de Apple Intelligence (evita Xcode completo); `rerun-if-env-changed`.
- `src-tauri/tauri.conf.json` — identidad, íconos, bundle, updater (deshabilitado). `src-tauri/icons/`.
- `src/components/Sidebar.tsx` — secciones (General, **Diccionario**, Avanzado, About; sin History
  ni Post-process ni selector de modelo).
- `src/components/settings/dictionary/DictionarySettings.tsx` (+ `CustomWords.tsx`) — diccionario.
- `src/App.css` / `src/styles/theme.css` — tema Tailwind v4 (`@theme`) → paleta CloseLabs.
- `src/branding.ts` — fuente única de nombre/textos/logo. `src/i18n/locales/*` — todo ES/limpio.

## Entregado por el cliente (ya integrado)

- ✅ **Logos** en `public/brand/` (`closelabs-black/white.png` + isotipo). Ícono de app generado.
- ✅ **API key de Groq** integrada en build-time (`CLOSELABS_GROQ_API_KEY`). ⚠️ **Poner límite de
  gasto** en la cuenta de Groq (la key es extraíble del binario hasta migrar al proxy).
- ✅ **Prompt** de limpieza médica en español (en `settings.rs`).

## Roadmap (fuera del v1)

- Firmar: Windows con SSL.com IV + eSigner (~$309/año) y macOS con Apple Developer ($99/año).
  Detalle en `FIRMA-Y-DISTRIBUCION.md`.
- Proxy propio de refine (sacar la key del binario, medir uso, gating de suscripción).
- Capa de cuentas/suscripción (estilo Aztec/Supabase) para cobrar.
- Opción de Whisper turbo local para equipos potentes.
- Hospedar el modelo en repo/CDN propio (hoy se baja de la HF cache pública `handy-computer`).
- Íconos de tray propios (aún usan glifos de Handy).
- Reset de ajustes en updates: los defaults nuevos solo aplican si NO hay `settings_store.json`
  previo (tauri-plugin-store solo persiste tras cambios del usuario).

## Atribución

Fork de **Handy** por CJ Pais (MIT). Se conserva la licencia y atribución del código. El
nombre/logo de "Handy" NO son open-source y fueron reemplazados por la marca CloseLabs.

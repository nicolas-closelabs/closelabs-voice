# CLAUDE.md — CloseLabs Voice

> Fuente de verdad del proyecto. Léela antes de hacer cambios: contiene la arquitectura,
> las decisiones y el **porqué** de cada una, para que cualquier ajuste futuro tenga todo
> el contexto. Actualízala cuando cambien decisiones o arquitectura.

## Estado actual (v0.4.2)

Compila (backend+frontend). Build macOS `.dmg` sin firma. Funciona end-to-end en Mac.
Highlights acumulados:
- **Transcripción → Whisper Medium (GGUF Q5_K_M)** vía transcribe-cpp, **español fijo**
  (`selected_language="es"`). Parakeet no respetaba el idioma → se cambió a Whisper (como Aztec).
- **Refine → Groq `llama-3.3-70b-versatile`** (el 8B se negaba). Prompt = **formateador general**
  (puntúa/estructura, quita muletillas; NO médico, NO parafrasea). ⚠️ **El refine se aplica
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
- **Privacidad:** se manejan datos de **pacientes** → el audio nunca debe salir del equipo.
- **Negocio:** producto **de pago** (~$30/mes/médico). Lanzamiento a producción **sin fallas**.
- **Debe ser modificable**, no estático (marca, modelo, refine: todo parametrizable).

## Arquitectura

```
Atajo global (toggle) → grabar audio
   → [LOCAL] Transcripción con Whisper Medium (GGUF Q5_K_M, español fijo) → texto crudo
   → diccionario/auto-corrección local (offline, siempre; términos médicos)
   → ¿hay internet?
        sí → [NUBE] Refine con Groq (llama-3.1-8b-instant) → texto limpio
        no → RAW (texto crudo + diccionario local)
   → pegar en la app activa
```

- **Transcripción: SIEMPRE LOCAL** — **Whisper Medium**, GGUF `Q5_K_M` (~583 MB), vía el motor
  **`transcribe-cpp`** (GGML). El audio del paciente **nunca sale**. **Se fuerza a español**
  (`selected_language="es"`, en `settings.rs`); Whisper **respeta** ese idioma y transcribe
  español excelente (incl. términos médicos en inglés).
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
| Firma | Sin firma por ahora, pipeline listo | $0; el cliente aún no tiene certificados. Roadmap: firmar |

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

**Refine (Groq):** la API key se inyecta en build time por variable de entorno:
```bash
CLOSELABS_GROQ_API_KEY=gsk_... bun tauri build
```
Si no se define, el refine queda sin key (el usuario puede pegarla en Ajustes, o se migra
a un proxy propio cambiando el `base_url` del proveedor Groq). El modelo por defecto es
`llama-3.1-8b-instant` (económico) y el prompt es de limpieza médica en español; ambos
son configurables. Offline el refine cae a texto crudo automáticamente.

## Estructura / archivos clave

- `src-tauri/src/settings.rs` — **defaults del producto**: `selected_language="es"`,
  `app_language="es"`, `push_to_talk=false` (toggle), `start_hidden=true`, `autostart=true`,
  `show_whats_new=false`, `post_process_enabled=true` + proveedor Groq + modelo + prompt médico ES
  + `post_process_selected_prompt_id` + key embebida (`option_env!("CLOSELABS_GROQ_API_KEY")`).
- `src-tauri/src/actions.rs` — flujo transcribir→refinar→pegar; **NO guarda `.wav` ni historial**.
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

- Firmar + notarizar (cero advertencias): Apple Developer ($99/año) + Windows Azure Trusted
  Signing (~$10/mes).
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

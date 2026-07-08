# CLAUDE.md — CloseLabs Voice

> Fuente de verdad del proyecto. Léela antes de hacer cambios: contiene la arquitectura,
> las decisiones y el **porqué** de cada una, para que cualquier ajuste futuro tenga todo
> el contexto. Actualízala cuando cambien decisiones o arquitectura.

## Estado actual (v0.3.0 — "v0.3a")

Compila (backend+frontend). Build macOS `.dmg` sin firma. Sobre la base v0.2 (español forzado,
modo toggle, sin history, refine Groq oculto, sección Diccionario):
- **Transcripción → Whisper Medium (GGUF Q5_K_M)**, español fijo. **CAMBIO CLAVE:** Parakeet
  (transductor) NO respetaba el idioma forzado → mezclaba inglés/español (el "garabato").
  Whisper **sí** respeta `language=es` y es excelente en español (lo que usa Aztec).
- **Binario renombrado** `handy` → `closelabs-voice` (crate + lib `closelabs_voice_lib`) → la
  notificación de Login Items ya no dice "handy".
- **Íconos de tray** = isotipo CloseLabs; **ícono de app** = morado muy oscuro (`#1A0A2E`) +
  isotipo blanco (limpio, no chillón).
- **Overlay** oscuro neutro (`#17161C`, no morado chillón) + tagline "Automatiza tu consultorio
  con CloseLabs".
- **Dock siempre visible** (política Regular) para que un no-técnico reabra la app fácil.
- Traducción español completada (huecos que quedaban en inglés).

**Siguiente (v0.3b):** rediseño limpio/minimalista tipo Aztec (tema blanco + acentos lila;
sidebar Inicio/Diccionario/Configuración/Instrucciones/Ayuda; settings simplificados).
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

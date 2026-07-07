# CLAUDE.md — CloseLabs Voice

> Fuente de verdad del proyecto. Léela antes de hacer cambios: contiene la arquitectura,
> las decisiones y el **porqué** de cada una, para que cualquier ajuste futuro tenga todo
> el contexto. Actualízala cuando cambien decisiones o arquitectura.

## Estado actual (v0.1.0)

Code-complete y **compila** (backend + frontend). **Build de producción macOS listo**:
`CloseLabs Voice_0.1.0_aarch64.dmg` (~18 MB, sin firma/notarización). Refine Groq con key
embebida, Parakeet auto-descarga en 1er arranque, español por defecto. **Pendiente:** build
de Windows (requiere máquina/CI Windows), prueba end-to-end real con micrófono, firma/
notarización (roadmap), y regenerar los íconos de tray (aún usan glifos de Handy).

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
Atajo global → grabar audio
   → [LOCAL] Transcripción con Parakeet TDT 0.6B v3 int8  → texto crudo
   → diccionario/auto-corrección local (offline, siempre; términos médicos)
   → ¿hay internet?
        sí → [NUBE] Refine con Groq (modelo económico 8B/Cerebras) → texto limpio
        no → RAW (texto crudo + diccionario local)
   → pegar en la app activa
```

- **Transcripción: SIEMPRE LOCAL** (Parakeet TDT 0.6B v3 int8, ONNX). El audio del paciente
  **nunca sale**. Parakeet **no alucina** como Whisper (seguro para notas clínicas), es rápido
  en CPU y liviano en RAM (ideal para PCs débiles). Multilingüe (español).
- **Refine (limpieza: muletillas, puntuación, formato): EN LA NUBE vía Groq** cuando hay
  internet; **offline cae a RAW** + diccionario local. Solo viaja **texto**, nunca audio.
  CloseLabs asume el costo (unit economics: ~$0.10–$1.20/médico/mes cobrando $30 → margen ~97%).
- **Entrega del modelo:** el instalador es liviano (el modelo NO va dentro). En el **1er
  arranque la app descarga Parakeet automáticamente en segundo plano** (indicador de progreso
  discreto, sin flujo manual). Fuente: `blob.handy.computer/parakeet-v3-int8.tar.gz` por ahora
  (URL configurable → migrar a R2 propio en el futuro). **No hay selector de modelo.**

## Stack técnico

- **Tauri v2** (shell liviano; usa el webview del SO, no Chromium → app pequeña).
- **Backend:** Rust (`src-tauri/`). Inferencia vía ONNX Runtime; VAD Silero; atajos `rdev`.
- **Frontend:** React 18 + TypeScript + **Tailwind CSS v4** (config en CSS con `@theme`, NO hay
  `tailwind.config.js`), Zustand (estado), i18next (i18n), lucide-react (íconos).
- **Package manager:** **Bun** (`bun.lock`). Comandos abajo.

## Decisiones clave y el porqué

| Decisión | Elección | Por qué |
|---|---|---|
| Base | Fork de Handy (no aria, no desde cero) | Maduro/estable; MIT. aria tenía features incompletas |
| Plataformas | macOS + Windows | Donde están los médicos |
| Transcripción | Local Parakeet int8 (no Whisper, no nube) | Privacidad del paciente + no alucina + rápido en PC débil |
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

- `src-tauri/tauri.conf.json` — identidad (productName, identifier), íconos, bundle, updater.
- `src-tauri/icons/` — íconos (regenerar desde el isotipo CloseLabs).
- `src-tauri/src/catalog/catalog.json` + `catalog/mod.rs` — catálogo de modelos (reducir a Parakeet).
- `src-tauri/src/managers/{model,transcription}.rs`, `transcription_coordinator.rs`,
  `src-tauri/src/commands/models.rs` — carga de modelo + descarga con progreso.
- `src/components/model-selector/*`, `src/components/settings/models/*` — selector (quitar).
- Refine (post-process): `src/components/settings/PostProcessingToggle.tsx` + comandos
  `*_post_process_*` en backend — configurar Groq + prompt español.
- `src/App.css` / `src/styles/` — tema Tailwind v4 (`@theme`) → paleta CloseLabs.
- `src/i18n/locales/` — traducciones (español por defecto).
- `src/branding.ts` — (a crear) fuente única de nombre/textos/logo.

## Prerrequisitos pendientes del cliente

1. **Logos en alta:** `CloseLabs_-_Black.png`, `CloseLabs_-_White.png`, e **isotipo 1024×1024
   fondo transparente** (para generar íconos).
2. **API key de Groq** (con límite de gasto configurado). — *cliente la está creando.*
3. Confirmar el **prompt de limpieza** en español médico.

## Roadmap (fuera del v1)

- Firmar + notarizar (cero advertencias): Apple Developer ($99/año) + Windows Azure Trusted
  Signing (~$10/mes).
- Proxy propio de refine (sacar la key del binario, medir uso, gating de suscripción).
- Capa de cuentas/suscripción (estilo Aztec/Supabase) para cobrar.
- Opción de Whisper turbo local para equipos potentes.
- Hospedar el modelo en R2 propio (dejar de depender de `blob.handy.computer`).

## Atribución

Fork de **Handy** por CJ Pais (MIT). Se conserva la licencia y atribución del código. El
nombre/logo de "Handy" NO son open-source y fueron reemplazados por la marca CloseLabs.

# Benchmark — Aztec Voice 1.8.2 vs CloseLabs Voice

> Análisis del 2026-09-16 sobre los instaladores `AztecVoice - Examples/` (DMG universal + EXE x64)
> comparados contra la 1.7.7 instalada en este Mac y contra nuestro código (v0.6).
> Método: se extrajo el frontend embebido del binario (tabla de assets de Tauri → brotli), los
> módulos Rust (`src/*.rs`), los mensajes de log, los prompts y los logs reales de uso
> (`~/Library/Logs/co.azteclab.voice/handy.log`).
>
> **Regla:** replicamos ideas y técnicas, no copiamos textual sus prompts ni sus textos. Escribimos
> versiones propias, adaptadas a médicos.

Leyenda: 🆕 = nuevo en 1.8.x (no estaba en 1.7.7) · Esfuerzo S/M/L · ✅ ya lo tenemos · ❌ no lo tenemos · 🟡 parcial

---

## 0. Resumen ejecutivo

Lo que Aztec cambió entre 1.7.7 y 1.8.2:
1. 🆕 **Proxy propio** (`proxy-gamma-seven-87.vercel.app`: `/api/transcribe`, `/api/format`). Las keys de
   Groq ya **no están en el binario**; la app se autentica con el token de sesión de Supabase
   (si recibe 401, renueva el token y reintenta).
2. 🆕 **Compresión Opus** (`opusic-sys 0.7.5` + contenedor Ogg). **Compila en Windows MSVC** (está
   en su `.exe`) → **esto invalida nuestro "Opus DESCARTADO"**: el bloqueo era `audiopus` (autotools),
   no Opus en sí. `opusic-sys` compila libopus con cmake.
3. 🆕 **Formateador migrado de `llama-3.3-70b-versatile` a `openai/gpt-oss-20b`** con JSON schema
   estricto `{"cleaned": ...}` + ejemplos few-shot + reintento + guardas anti-fuga.
   Latencia real medida en tus logs: **p50 650 ms / p90 1,6 s**.
4. 🆕 **Diccionario y preferencia "AI post" sincronizados en la nube** (Supabase RPC `sync_user_dictionary`).
5. 🆕 **Sesión expirada** con mensaje claro + **cerrar sesión** desde la app.
6. 🆕 **Aztec Paint** (anotar/dibujar sobre la pantalla). No aplica a médicos.

Lo que ya tenían en 1.7.7 y **nosotros aún no** (lo más valioso):
- **Diccionario enviado como `prompt` a Whisper** → reconoce bien nombres propios y términos técnicos.
- **Auto-diccionario**: aprende de las correcciones que el usuario hace después de pegar.
- **Filtro de alucinaciones conocidas de Whisper** ("subtítulos realizados por la comunidad de Amara.org"…).
- **Chequeo de conectividad de 2 s** antes de ir a la nube (nosotros esperamos hasta 60 s de timeout).
- **Parakeet se descarga en segundo plano** como respaldo offline; no bloquea el onboarding.
- **Pegado robusto** (clic en menú Edición > Pegar si falla Cmd+V, aviso si falta Accesibilidad,
  no restaurar el portapapeles si cambió).
- **Bandeja: "Pegar última transcripción"** + atajo **"Reprocesar última grabación"**.
- **Micrófono "del computador (recomendado)"** con aviso de latencia Bluetooth (AirPods).
- **Reportar un problema** (sube logs anonimizados) + **config remota** (versión mínima obligatoria,
  mensaje de bloqueo, URL de descarga, video tutorial).
- **Cuentas + suscripción + límite de dispositivos** (Supabase).

---

## 1. Calidad de transcripción (P0 — impacto directo en el médico)

| # | Feature Aztec | Nosotros | Esfuerzo | Notas de implementación |
|---|---|---|---|---|
| 1.1 | **Diccionario → `prompt` de Whisper.** Log real: `Whisper initial_prompt (30 chars, 4 manual + 0 auto-learned): CloseLabs, N8N, HiMed, GMedic.` | ❌ | **S** | En `groq_transcribe.rs::post_audio` añadir campo multipart `prompt` = `custom_words` unidos por ", " y terminado en ".". Groq limita el prompt a ~224 tokens → recortar (priorizar manuales, luego aprendidas por uso reciente). **La mayor ganancia por esfuerzo para términos médicos** (fármacos, procedimientos, apellidos). |
| 1.2 | **Filtro de alucinaciones conocidas** (`[filter] dropped known Whisper hallucination`): "subtítulos realizados por la comunidad de amara.org", "thanks for watching", "thank you.", "merci d'avoir regardé cette vidéo", "então, o primeiro é"… | ❌ (solo VAD + guarda de refine) | **S** | Si la transcripción completa (normalizada) coincide con una frase de la lista → descartar (no pegar nada). Aplicarlo **antes** del refine, a la salida de Groq y de Parakeet. |
| 1.3 | **Recorte de silencio antes de subir** (`Audio length after trimming silence`) | 🟡 VAD Silero en el grabador | S | Verificar que lo que subimos ya viene recortado por VAD; si no, recortar inicio/fin. Menos audio = menos latencia y menos alucinación. |
| 1.4 | **Opus/Ogg** 🆕 (`opusic-sys`, `ogg`) | 🟡 FLAC (~2x más chico que WAV) | **M** | Opus a ~24 kbps mono 16 kHz ≈ **10x más chico que FLAC**. Groq acepta `ogg`. Mantener la cadena de respaldo **Opus → FLAC → WAV**. Probar primero la compilación en CI Windows (`opusic-sys` usa cmake, que ya tenemos). Clave para el internet lento de LatAm. |
| 1.5 | **Chequeo de conectividad** (`Quick connectivity check — tries to reach Groq API with a 2s timeout`) + timeout específico de la transcripción en la nube + reintento de red | ❌ timeout fijo de 60 s | **S** | Con internet inestable hoy podemos colgarnos hasta 60 s antes de caer a Parakeet. Agregar: check de 2 s (HEAD/GET a la API) → si falla, local directo. Timeout de subida proporcional a la duración del audio (p. ej. 8 s + 1 s por cada 10 s de audio) y **1 reintento** solo si es error de red. |
| 1.6 | **Parakeet en segundo plano** (`Starting background download of Parakeet model (offline fallback)`) | ❌ el onboarding espera la descarga de 549 MB | **M** | Con el híbrido, el médico puede dictar **online desde el minuto 1** mientras Parakeet baja en segundo plano. Mostrar "Modo sin conexión: preparando…" en vez de bloquear. Enorme mejora del primer uso en conexiones lentas. |

## 2. Formateador / refine (P0)

| # | Feature Aztec | Nosotros | Esfuerzo | Notas |
|---|---|---|---|---|
| 2.1 | **Modelo `openai/gpt-oss-20b`** 🆕 (dejaron `llama-3.3-70b-versatile`) | ❌ usamos llama-3.3-70b | S | Más barato y rápido, y **otro bucket de rate limit en Groq** → ayuda directo al BACKLOG #5 (tope de ~1000 req/día del 70B). **Hacer A/B con 20-30 dictados médicos reales antes de cambiar.** |
| 2.2 | **JSON schema estricto** `{"cleaned": string}`, `additionalProperties:false` | 🟡 el proveedor groq está en `supports_structured_output: false` → modo legacy | S | Activar salida estructurada para Groq con gpt-oss (lo soporta). Elimina los preámbulos tipo "Aquí está el texto". |
| 2.3 | **Few-shot** (~11 pares entrada→`{"cleaned"}`) antes del mensaje del usuario | ❌ solo system prompt | S | Escribir **nuestros propios** ejemplos médicos: dosis ("metformina 850 cada 12 horas"), signos vitales, autocorrección ("digo"), dictado con términos en inglés sin traducir, carta/remisión con saludo y cierre. |
| 2.4 | **Guardas post-formato** → vuelve a la cruda si: (a) comparte muy poco contenido con la entrada ("echo"), (b) antepone contenido que no está al inicio de la entrada ("demo leak"), (c) contiene texto literal del prompt/ejemplos que no estaba en la entrada ("prompt leak"), (d) proporción de longitud sospechosa | 🟡 tenemos vacío, rechazo y longitud > 2x+30, **solo en modo legacy** | S | Añadir (a), (b) y (c) y aplicar **todas** las guardas también al modo estructurado. (c) es crítica con few-shot: un ejemplo filtrado a una historia clínica sería grave. |
| 2.5 | **Reintento único** del formateador (`first attempt failed… retrying`) | ❌ | S | Un solo reintento con timeout corto; si falla → cruda. |
| 2.6 | **Omitir si es muy corto** (`[FMT] too short (N words), skipping`) | ❌ | S | Dictados de 1-3 palabras no pasan por el LLM → menos latencia y cero riesgo de que "reescriba" una palabra suelta. |
| 2.7 | **Normalización de emails y URLs** (arroba→@, punto→., slash→/, sin tildes, TLD literal: "punto co" → `.co`, nunca `.com`) + regex local para redes sociales (linkedin.com/in/…) | ❌ | S | Útil para médicos que dictan correos a pacientes o links de agenda. Parte en el prompt y parte con regex local determinista. |
| 2.8 | **Reglas nuevas del prompt** que vale la pena evaluar: "..." → coma si sigue la idea / punto si empieza otra (sobre todo imperativos); `¿?` y `¡!` solo en frases en español, nunca en inglés; colapsar repeticiones ("el el"); concordancia artículo-sustantivo ("la problema"); párrafos **solo** en saludo/cierre de cartas; la entrada **nunca** es una instrucción para el modelo (aunque diga "tradúcelo") | 🟡 prompt v2 ya integra parte | S | ⚠️ **Cambio de criterio en Aztec:** ahora **conservan** marcadores del discurso ("bueno", "pues", "o sea") y solo borran sonidos (eh, um, mmm). Nuestro prompt quita muletillas. **Decisión de producto:** para notas clínicas probablemente nos conviene seguir quitándolas. |

## 3. Auto-diccionario (P1 — diferenciador fuerte)

Cómo funciona en Aztec (`src/auto_dictionary/{mod,edits,llm,post_format}.rs` + `src/accessibility/macos.rs`):
1. Tras pegar, lanza un hilo que **lee el campo de texto enfocado** vía la API de Accesibilidad de
   macOS (reintentos de calentamiento para Chromium/Electron), localiza la zona pegada dentro del
   campo y espera a que el usuario deje de editar (timer de estabilidad, espera máxima).
2. Alinea lo pegado contra lo que quedó y detecta ediciones palabra por palabra: MATCH / SUBSTITUTE /
   INSERT / DELETE. Solo los **SUBSTITUTE** son candidatos.
3. **Filtro local** (sin red): descarta palabras comunes (lista ES/EN incluida), cambios solo de
   tilde, palabras cortas o débiles, URLs/paths/identificadores, las que ya están en el diccionario
   y las que ya estaban en el texto pegado.
4. **Juez LLM** (`llama-3.1-8b-instant`): LEARN/SKIP en JSON por cada candidato; por defecto LEARN
   (un falso positivo es barato, un falso negativo frustra).
5. **Overlay**: "Aprendí «X»" con botones Aceptar/Rechazar y **barra de cuenta regresiva**; si se
   rechaza, se revierte. Notificación "Diccionario actualizado".
6. Las palabras aprendidas se guardan **aparte** de las manuales (`auto_learned_words`, con
   `added_at`/`last_used_at`, tope con descarte LRU) y se muestran en su propia sección ("Aprendidas
   automáticamente — haz clic en × para quitar"). Toggle `auto_dictionary_enabled` (activo por defecto).
7. Se usan en el `prompt` de Whisper (ver 1.1) → el ciclo se cierra.

| Nosotros | Esfuerzo | Notas |
|---|---|---|
| ❌ | **L** | Solo macOS (su build de Windows incluye el módulo pero no el de Accesibilidad). Ya pedimos permiso de Accesibilidad para pegar. ⚠️ **Riesgo de privacidad médica:** aprendería **apellidos de pacientes**, y si luego sincronizamos el diccionario a la nube (5.4) serían datos de salud identificables fuera del equipo. Propuesta: juez LLM con regla SKIP para nombres de personas en el contexto clínico, o aprender solo términos médicos/fármacos, y **nunca** sincronizar las palabras aprendidas. |

## 4. Pegado, bandeja, micrófono y UX (P1)

| # | Feature Aztec | Nosotros | Esfuerzo | Notas |
|---|---|---|---|---|
| 4.1 | **Aviso si falta Accesibilidad**: "No tengo permiso de Accesibilidad para pegar automáticamente. Tu texto está en el portapapeles — pégalo con Cmd+V." (`PASTE_ERR_ACCESSIBILITY_DENIED`) | ❌ falla en silencio | S | Toast/overlay con ese mensaje. Muy común en médicos que no concedieron el permiso. |
| 4.2 | **Respaldo de pegado por menú** (clic en Edición > Pegar si el Cmd+V simulado no entra) | ⏸️ **aplazado a propósito** | M | Arregla apps donde el Cmd+V simulado no entra. **Por qué se aplaza:** (a) no se puede DETECTAR que el Cmd+V falló — ninguna API nos dice si el texto entró al campo—, así que quedaría como un interruptor más en Ajustes, justo lo que escondemos a los médicos; (b) hacerlo sin un segundo permiso (Automatización) exige recorrer el menú con la API de Accesibilidad en FFI insegura, ~200 líneas imposibles de probar sin una app que realmente falle; (c) **nunca hemos visto el problema**: en Chrome, WhatsApp, Word y los portales web el Cmd+V entra bien. Retomar cuando un médico reporte una app concreta donde no pega, y usarla como caso de prueba. |
| 4.3 | **No restaurar el portapapeles si cambió durante el pegado** + **retardo de restauración configurable** ("súbelo si el texto se duplica") | 🟡 tenemos `paste_delay_ms` | S | Evita pisar algo que el usuario copió justo en ese momento. |
| 4.4 | **Entrega del texto en 3 modos**: "Solo pegar (conserva mi portapapeles)" / "Pegar + guardar en portapapeles" / "Solo portapapeles" | 🟡 `paste_method` + `clipboard_handling` sueltos | S | Unificar en un solo selector con lenguaje simple. |
| 4.5 | **Bandeja: "Pegar última transcripción"** | 🟡 solo "Copiar" | S | Rescate cuando el pegado cayó en la ventana equivocada. |
| 4.6 | **Atajo "Reprocesar última grabación"** | ❌ | M | Nosotros no guardamos `.wav` (privacidad) → mantener **solo en RAM** el último audio y re-transcribirlo (p. ej. si salió por Parakeet, reintentar en la nube). |
| 4.7 | **Micrófono "del computador (recomendado)"** vs "Auto (sigue al sistema)", con detección built-in/cable/**Bluetooth** y aviso "AirPods tardan 1-2 s en arrancar" | ❌ | M | Muchos médicos usan AirPods: se pierden las primeras palabras y culpan a la app. Detectar el tipo por el nombre del dispositivo (cpal no expone el transporte). |
| 4.8 | **Micrófono "caliente"** (reconstruye el stream si no está listo) | 🟡 `always_on_microphone` de Handy | S | Revisar el default y el manejo de errores. |
| 4.9 | **Botón Cancelar en el overlay** + textos "Grabando…/Transcribiendo…" | 🟡 | S | |
| 4.10 | **Inicio = historial reciente**: "Tus transcripciones recientes. Haz click para copiar." | ❌ (decisión: no guardamos historial) | M | Alternativa compatible con privacidad: lista **solo en memoria** de la sesión (se borra al cerrar) o solo local con borrado automático corto. **Decisión tuya.** |
| 4.11 | **Ocultar la ventana principal si toma foco mientras el overlay está visible** (mantiene el overlay encima) | ❌ | S | |
| 4.12 | **Instrucciones con videos** (9 clips mp4: activar, dictar, opciones de pegado, limpieza, emails/URLs, diccionario, formato, cierre) | 🟡 tutorial animado en CSS | M | Mejor para usuarios poco técnicos. Mantener los clips pequeños (los de ellos pesan 100-340 KB). |
| 4.13 | **Sección Acerca de** con explicación honesta: "solo el audio va al servicio de transcripción; el diccionario y las ediciones se quedan en tu equipo" | ✅ wording honesto (v0.6) | — | Nuestro texto ya es honesto. Ojo: su **Política de Datos** todavía dice "el audio nunca sale del dispositivo" — contradice su propia app. No repetir ese error. |

## 5. Plataforma / negocio (P2 — coincide con el roadmap)

| # | Feature Aztec | Nosotros | Esfuerzo | Notas |
|---|---|---|---|---|
| 5.1 | 🆕 **Proxy** en Vercel: `POST /api/transcribe`, `POST /api/format`; header de versión de la app; prompt en base64 por header; `Authorization` con el JWT de Supabase; si responde 401 → renovar token y reintentar; mensajes "Proxy unreachable" y "Proxy transcription timed out" | ❌ key en el binario | L | Resuelve el BACKLOG #4 (alertas y telemetría) y el #5 (cambiar de proveedor sin publicar versión nueva), y saca la key del binario. Es la base de todo lo demás de esta sección. |
| 5.2 | **Cuentas Supabase**: login, registro (nombre, apellido, teléfono con código de país, **consentimiento de datos**), recuperar contraseña, confirmación por email, token guardado en el llavero del sistema | ❌ | L | |
| 5.3 | **Estados de acceso**: trial / activa / expirada / cancelada; **límite de dispositivos** (tabla `devices`, limpieza de duplicados); usuario bloqueado; plan gratis bloqueado; 🆕 sesión expirada ("tus grabaciones y ajustes siguen guardados"); 🆕 cerrar sesión | ❌ | L | Pantallas: Suscripción expirada → Renovar; Cuenta suspendida → Soporte; Actualización requerida. |
| 5.4 | 🆕 **Sincronización en la nube** del diccionario (manual + aprendidas) y de la preferencia de refine | ❌ | M | Sincronizar **solo las palabras manuales** (ver riesgo en §3). |
| 5.5 | **Config remota** (`app_config`): `min_required_version` (fuerza actualizar), `free_tier_enabled`, `lockout_message`, `download_url`, `tutorial_video_url` | ❌ | M | Un "botón de pánico" barato: permite bloquear versiones con bugs sin tocar la máquina del médico. Se puede hacer **antes** de tener cuentas (un JSON estático en el proxy). |
| 5.6 | **Actualización automática** (tauri-plugin-updater: "Actualización lista. Reinicia para aplicar.") | 🟡 el plugin está, pero `createUpdaterArtifacts: false` y el endpoint apunta a `github.com/closelabs/closelabs-voice` (no es nuestro repo, que además es privado) | M | Requiere clave de firma del updater + publicar `latest.json` en un host público. Clave para iterar con médicos sin reinstalar a mano. |
| 5.7 | **Reportar un problema**: sube los logs a Supabase Storage (`log-reports/`), con **rutas anonimizadas** (`/Users/…` → `[REDACTED]`) y **sin el contenido de las transcripciones** | ❌ | M | ⚠️ **Hoy `managers/transcription.rs:1412` escribe en el log el texto transcrito completo (`info!("Transcription result: {}")`)** → datos de pacientes en disco. Arreglarlo (loguear solo la longitud) **ya**, aunque el reporte de logs llegue después. |
| 5.8 | **Bandeja: "Enviar comentarios…"** | ❌ | S | Abre formulario/correo de soporte. |
| 5.9 | **Política de Tratamiento de Datos (Ley 1581/2012, Colombia)** dentro de la app + aceptación en el registro | ❌ | M (legal) | ⚠️ Para nosotros aplica el régimen de **datos sensibles (salud)**: autorización explícita, finalidades y transferencia internacional (Groq en EE. UU.). Revisar con abogado; no copiar la de ellos. |

## 6. No aplica / descartado

- **Aztec Paint** 🆕 (lápiz, resaltador, flecha, rectángulo, borrador, deshacer/rehacer, varias
  pantallas; lanzador con forma de lata de spray). Sin valor para el dictado clínico. Solo tendría
  sentido para demos o teleconsulta.
- Selector de modelos locales (Whisper Small/Medium/Turbo, Moonshine), modo "tu propia API key de
  OpenAI", traducir al inglés, OpenCC para chino.
- Push-to-talk por defecto (ellos lo usan; nosotros decidimos toggle).

## 7. Dónde ya estamos igual o mejor

- **Overlay arrastrable de verdad** con posición recordada (en su log aparece `overlay: startDragging failed`).
- **Prompt especializado en medicina** + regla de NO TRADUCIR.
- **Wording de privacidad honesto** (su política de datos todavía dice que el audio no sale del equipo).
- **Build Intel optimizado** (AVX/F16C) y compresión FLAC con respaldo a WAV (ellos subían WAV hasta la 1.7.7).

---

## Orden de implementación recomendado

**Sprint 1: calidad y robustez, todo S, sin infraestructura nueva** (un build grande):
1.1 diccionario→prompt · 1.2 filtro de alucinaciones · 1.5 conectividad 2 s + timeouts + reintento ·
2.1-2.6 formateador (gpt-oss-20b + schema + few-shot propios + guardas + reintento + omitir cortos),
**previo A/B** · 4.1 aviso de Accesibilidad · 4.3 restauración segura del portapapeles · 4.5 pegar última.

**Sprint 2: UX de primer uso y audio:**
1.6 Parakeet en segundo plano · 1.4 Opus (validar CI Windows primero) · 4.7 micrófono/Bluetooth ·
4.6 reprocesar · 4.2 pegado por menú · 2.7 emails/URLs · 5.5 config remota mínima (JSON estático).

**Sprint 3: plataforma:** 5.1 proxy → 5.7 reporte de logs → 5.6 updater → 5.2/5.3 cuentas y suscripción → 5.9 política de datos.

**Sprint 4: diferenciador:** 3 auto-diccionario (con las salvaguardas de datos de pacientes).

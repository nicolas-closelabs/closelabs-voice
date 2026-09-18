# ROADMAP — CloseLabs Voice: paridad con Aztec 1.8.2 y más

> Creado el 2026-09-17. Detalle de cada feature y de cómo lo hace Aztec: `AZTEC-BENCHMARK.md`.
> Pendientes sueltos y bugs: `BACKLOG.md`. Este archivo es el orden de ejecución.

## Arquitectura objetivo

```
App de escritorio (Tauri)
  ├─ Sesión Supabase (token en el llavero del sistema, renovación automática)
  ├─ Config remota al abrir y cada X horas (versión mínima, bloqueo, mensajes)
  ├─ Dictado → [online] Edge Function /transcribe → Groq Whisper   (audio Opus)
  │            [offline] Parakeet local (se descarga en segundo plano)
  ├─ Texto  → [online] Edge Function /format → Groq LLM (+ guardas locales)
  └─ Reportar problema → Storage "log-reports" (logs sin texto dictado)

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

### Fase 0 — Calidad y robustez (sin infraestructura nueva) · EN CURSO (rama `feat/sprint1-paridad-aztec`)

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
  idéntica contra la API real. ⏳ Falta que pase el CI de Windows MSVC.
- [x] Micrófono: "del computador (recomendado)" + aviso de Bluetooth (AirPods pierden las primeras palabras).
- [x] Prompt del formateador acortado (1.444 → 1.221 tokens) tras medir el techo de 8.000 TPM del
  tier gratis de Groq. Validado contra la API real: acierta 8/8 casos clínicos donde el largo hacía
  6/8. ⚠️ El techo real solo lo levanta el tier pago detrás del proxy (Fase 1) — ver BACKLOG #16.
- [ ] Atajo "Reprocesar último dictado" (audio solo en RAM).
- [ ] Pegado por menú Edición > Pegar como respaldo (macOS).
- [x] Normalización de emails/URLs dictados, local y sin internet ("juan arroba gmail punto com" → juan@gmail.com).

### Fase 1 — Backend base (necesita: proyecto Supabase)
- [ ] Migraciones SQL en `supabase/migrations/` (tablas + RLS + `app_config` + bucket `log-reports`).
- [ ] Edge Functions `transcribe` y `format` (JWT, suscripción activa, registro de uso, key de Groq como secreto, respaldo OpenAI).
- [ ] App: el cliente de nube apunta al proxy; la key sale del binario.
- [ ] Config remota: versión mínima obligatoria, mensaje de bloqueo, URL de descarga y del video tutorial.
- [ ] "Reportar un problema" (logs anonimizados) + "Enviar comentarios…" en la bandeja.
- [ ] Alertas de uso y errores del proveedor (BACKLOG #4).

### Fase 2 — Usuarios y suscripción (necesita: decisión de pagos + páginas web)
- [ ] Login, registro (nombre, teléfono con indicativo, consentimiento de datos), recuperar contraseña, confirmación por email.
- [ ] Token en el llavero del sistema, renovación automática; si el servidor responde 401 → renovar y reintentar.
- [ ] Estados: trial, activa, vencida, cancelada, cuenta bloqueada, actualización obligatoria, sesión expirada (se sigue pudiendo dictar offline), cerrar sesión.
- [ ] Límite de dispositivos por plan.
- [ ] Webhook de pagos → tabla `subscriptions`.
- [ ] Política de Tratamiento de Datos (Ley 1581, datos sensibles de salud) en la app y aceptación en el registro.

### Fase 3 — Distribución profesional (necesita: cuentas Apple/Windows)
- [ ] Firma + notarización macOS (Apple Developer) y firma Windows (Azure Trusted Signing).
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
| 2 | Groq: **habilitar facturación (tier pago)** — el gratis tiene un techo de 8.000 tokens/minuto para toda la cuenta, o sea ~6 dictados por minuto entre TODOS los médicos; con eso no se puede vender. Además: **Zero Data Retention**, límite de gasto y alertas; key de OpenAI como plan B | Fase 1 |
| 3 | Decidir pasarela de pago (Wompi / Mercado Pago / Stripe / Paddle o Lemon Squeezy), precio, días de trial y dispositivos por plan | Fase 2 |
| 4 | Páginas en closelabs.co: confirmar email, recuperar contraseña, suscripción | Fase 2 |
| 5 | Abogado: política de datos sensibles (salud), transferencia internacional (Groq/Supabase en EE. UU.) | Fase 2 |
| 6 | Apple Developer ($99/año) + Azure Trusted Signing | Fase 3 |
| 7 | 20-30 dictados reales **anonimizados** (texto crudo) para el A/B del formateador | Fase 0 |

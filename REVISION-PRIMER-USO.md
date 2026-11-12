# Revisión del primer uso — recorrido con la app instalada (2026-11-11)

Recorrido hecho por Claude con uso del computador en el Mac de Nicolás, como un médico de 55 años
que la usa por primera vez. Compilación **43125520995** (rama `feat/sprint1-paridad-aztec`, commit
f3d4d50), firmada y notarizada. Cuenta de prueba creada por Nicolás (`nicolas+pruebav1@…`).

> **Estado:** nada de esto está corregido. Nicolás pidió ver todos los aprendizajes antes de
> decidir. Hay correcciones a medias de los puntos 2, 3, 4 y del tamaño de la bienvenida en
> `git stash` ("revisión 2026-11-11: correcciones en pausa").

## Lo que funcionó

- **.dmg de doble clic:** solo el ícono y "Haz doble clic en el ícono", sin carpeta Aplicaciones.
  Tras el aviso de macOS, la app se copió a /Applications, expulsó el disco y se reabrió: 6 s en
  total según el log (arranque 00:41:44, copia 00:41:47, reapertura 00:41:50 UTC).
- **Registro sin celular,** cuenta confirmada con el código del correo.
- **Permiso de Accesibilidad:** al encenderlo, la ventana volvió sola y pasó al tutorial.
- **Dos dictados de práctica:** dentro de la app (4,2 s) y en TextEdit (2,7 s). Después del de
  TextEdit la app volvió sola a preguntar "¿Apareció tu texto en TextEdit?".
- **Píldora:** "Presiona ⌥ + Espacio para terminar", en lila, legible.
- **Inicio de una frase,** con las teclas dibujadas. Mi cuenta y Ayuda, bien.

## Hallazgos, por etapa (⚠️ = los más graves)

### Instalación
1. ⚠️ **Tras el doble clic no pasa nada visible ~20 s.** La pantalla "Instalando…" nunca se llegó
   a ver y la app reabierta quedó escondida (en la tira del Organizador Visual), detrás del
   Finder. Causa: desde macOS 14, una app abierta por un proceso en segundo plano no puede tomar el
   foco. Probado: volver a ejecutar `open` sobre la app ya abierta, ~3 s después, SÍ la trae al
   frente y no pide ningún permiso (AppleScript `activate` también, pero puede pedir permiso de
   Automatización).
2. El aviso de macOS ("¿Seguro que quieres abrirla?") tiene tres botones: Abrir, Mostrar imagen de
   disco y Cancelar, más una casilla. Es del sistema; solo la guía de la web dice cuál tocar.

### Bienvenida
3. La "ilustración" (mientras no hay video) parece un formulario real: invita a hacer clic y no
   pasa nada.
4. No cabe en la ventana mínima (680x570): "Ya tengo una cuenta" queda cortado abajo.

### Cuenta
5. ⚠️ **El formulario abre cortado ARRIBA:** sin logo ni título "Crea tu cuenta", y no se puede
   subir a verlos. Igual en "Inicia sesión" (también se corta el enlace de WhatsApp). Causa: el
   contenedor centra con `items-center justify-center` y `overflow-y-auto`; si el contenido es más
   alto que la ventana, lo de arriba queda fuera de alcance. Arreglo: `m-auto` en el hijo.
6. ⚠️ **"Fill out this field", en inglés,** al tocar "Crear mi cuenta" con un campo vacío: la
   validación del navegador (`required`) se adelanta a nuestro aviso de qué falta. Falta
   `noValidate` en los formularios.
7. La pantalla del código no la revisó Claude (la hizo Nicolás).

### Permisos
8. ⚠️ **La pantalla más pesada del recorrido:** ícono, título, párrafo, recuadro con dibujo, tres
   pasos, una nota y, al final, el botón, que NO se ve sin desplazarse.
9. "Paso 2 de 2" sin haber visto el paso 1 (el micrófono ya tenía permiso y se saltó).
10. El dibujo no se parece al Ajustes del Sistema real, y la guía dice "Se abrió Ajustes del
    Sistema" antes de que se abra.
11. El aviso que macOS muestra al tocar el botón no sale en las capturas de Claude: no se revisó.

### Tutorial
12. El aviso amarillo "¿No pasa nada?" sale a los 25 s, mientras el médico todavía lee: parece un
    error antes de intentar nada.
13. ⚠️ **TextEdit tapa las instrucciones:** al abrirse cubre nuestra ventana justo cuando el médico
    necesita leer qué hacer. Además abre grande, en modo oscuro y con letra diminuta.
14. El paso del diccionario sobra en el primer uso: pide agregar palabras antes de que la app se
    haya equivocado con alguna; parece tarea, y "Agregar" sale gris.
15. Son ~11 pantallas desde el aviso de macOS hasta Inicio: mucho para "5 minutos".

### Uso diario
16. ⚠️ **La píldora tapa el Dock,** y lo más grande en ella es el logo de CloseLabs, no que está
    grabando ni cómo terminar.
17. ⚠️ **Pie de página "Sin Modelo - Descarga Req…" con punto rojo:** jerga cortada que suena a
    falla. Pasa cuando el modelo sin internet ya estaba en el caché (por ejemplo, al reinstalar):
    `descargarRespaldo` no lo baja porque ya está, y nadie lo selecciona. Cada dictado deja
    "Failed to load model: Model not found:" en el log. No se confirmó si se arregla al reiniciar.
18. Siete secciones en el menú; Instrucciones (carrusel de 6 pasos) repite Inicio y el dictado de
    prueba.
19. Configuración con jerga y en inglés: "Atajo de Transcripción", "Reprocesar", "Option + Space",
    etiquetas "More information".
20. Mi cuenta muestra el equipo como "Nicolass-MacBook-Air-2.local" y lo primero es el botón de
    pagar, recién registrado.
21. El logo cambia de tamaño en cada pantalla (170, 150, 130, 120, 110 px) y la ventana se movió de
    lugar entre la bienvenida y el tutorial: parecen varias apps distintas.
22. La versión sigue diciendo 0.9.3: subirla antes de publicar.

## Videos

- **Instalación:** grabación cruda completa (75 s), pero muestra los ~20 s vacíos del punto 1;
  repetir después de arreglarlo.
- **Accesibilidad:** se perdió. ⚠️ `screencapture -v -V <s>` interrumpido con SIGINT NO guarda el
  archivo: dejarlo correr su tiempo completo.
- **Bienvenida:** el dictado en TextEdit quedó grabado, pero en modo oscuro y con letra pequeña; no
  sirve como demo de "historia clínica".

## No revisado

Pantalla del código, permiso del micrófono, aviso de macOS del permiso de Accesibilidad, Windows.
El rescate a las 24 h sigue sin desplegar (espera la versión nueva).

---

# Referente: el onboarding de Wispr Flow (visto el 2026-11-11)

Nicolás grabó el primer uso de Wispr Flow 1.6 en su Mac (dos videos: la página de descarga y
3 min 47 s de onboarding) y una captura del .dmg. Pidió: "que se vea high standard, premium; hoy
nos vemos muy AI". Esto es lo observado; qué aplicar se decide con él.

## Lo que vimos, en orden

1. **Página de descarga** (wisprflow.ai/downloads): panel casi negro con titular serif grande
   ("Open Wispr Flow in 3 steps:"), tres pasos de una línea, "Not working? Try again." A la derecha,
   fondo verde oscuro con una **animación propia y simplificada** (navegador → .dmg → arrastrar), no
   una grabación de pantalla. QR para el celular.
2. **.dmg:** fondo crema, titular serif enorme "To install, *drag* Wispr Flow to Applications",
   flecha dibujada a mano en naranja. Ellos SÍ siguen con arrastrar.
3. **Entrar:** dos columnas. Izquierda: logo, "Let's get you started", una línea, botón negro
   "Sign in via browser ↗" (la cuenta se hace en la web, no en la app). Derecha: "Works *wherever*
   you do." con un mock de una app y un Dock con WhatsApp, Gmail, Notion, Slack, ChatGPT.
4. **"Setting up Flow…"** con barra de progreso fina mientras prepara.
5. **Barra de etapas fija arriba:** SIGN UP › PERMISSIONS › SET UP › LEARN › PERSONALIZE, con una
   línea de progreso morada. Siempre "← Back", a veces "Skip", "Help" abajo a la izquierda, idioma
   arriba a la derecha.
6. **Preguntas de marketing** (dónde nos conociste, para qué lo usarás, dónde escribes), con chips
   y una ilustración dibujada a mano a la derecha.
7. **"You control your data":** dos tarjetas (mejorar el modelo / no usar mis datos) + candado.
8. **Permisos:** una tarjeta por permiso con su botón "Allow" dentro; al lado, un mock de Ajustes.
   Al abrir Ajustes del Sistema, **pegan una ventanita propia debajo de Ajustes: "↑ Drag Wispr
   Flow to the list above to allow Accessibility" con el ícono arrastrable.** El médico no tiene
   que buscar nada en la lista. Al volver: "Thanks for trusting us" con dos ✓.
9. **Probar el hardware, por separado y con sí/no:** "Test your microphone — Do you see purple
   bars while you speak?" (barras + "Change microphone" / "Yes"); "Test your dictation shortcut —
   Does the button turn purple while pressing it?" (la tecla dibujada se ilumina).
10. **Idiomas** que hablas.
11. **Práctica dentro de mocks realistas** de apps conocidas, cada una enseña UNA cosa:
    - "*Dictate* a message with Flow" — un Slack con un mensaje de Tobias; el campo dice "Click into
      the text field here" y luego "Hold down fn, say something, then release."
    - "Write an email *hands free*" — un Gmail; enseña el doble toque (manos libres); la frase a
      decir aparece DENTRO del campo ("Great! Now say… 'Umm Hi Greg… on Friday at 3, no actually
      4?'"), con muletilla y autocorrección a propósito; al terminar, etiquetas moradas muestran
      qué arregló.
    - "Try *whispering* a list" — una lista de compras en Notion.
12. **Recompensa en fondo oscuro con serif:** "Nice job! You just spoke 2.2× *faster*" (barras de
    tu velocidad contra el promedio) y "With Flow you could save 23 hours *a week!*" con un control
    de horas al día.
13. Referidos ("Get a month of Pro") y "How would you like to use Flow first?" con un video demo.
14. **Inicio:** "Hey, get back into the flow with [fn]", tarjeta "Try Flow in another app", cifras
    (palabras, palabras por minuto, días seguidos), los dictados de hoy, y un aviso "Try using Flow
    in another app! Don't dictate with Flow here."
15. **Píldora:** una cápsula oscura diminuta abajo al centro; al dictar se estira con la onda, una ✕
    y una ✓. Sin logo ni lema.

## Por qué se ve premium (y nosotros "AI")

- **Un solo color de acento y usado poco.** Fondo crema/hueso cálido, texto y botones negros; el
  morado solo marca estado (progreso, tecla presionada, barras, lo que arregló). Nosotros pintamos de
  lila bordes, fondos, íconos y botones a la vez.
- **Tipografía con dos voces:** serif de revista para los momentos emocionales, con UNA palabra en
  cursiva ("*Dictate*", "*hands free*", "*a week!*"); sans sobria para la interfaz. Nosotros: Inter
  en negrita en todo.
- **Ilustraciones propias con personalidad** (trazo a mano, naranja/verde/morado) en vez de íconos
  de librería dentro de un círculo lila encima de cada título, que es el patrón de plantilla de IA
  más reconocible.
- **La misma estructura en cada pantalla:** dos columnas, botón negro siempre en el mismo sitio,
  Back/Skip/Help siempre donde mismo, etapas arriba. Nosotros cambiamos tamaño de logo, ancho y
  ubicación del botón en cada pantalla.
- **Pocas palabras por pantalla.** Una pregunta o una acción; nunca párrafo + recuadro + pasos +
  nota.
- **Ventana grande y aireada** para el onboarding.

## Ideas concretas que podríamos tomar

- La **ventanita pegada a Ajustes del Sistema** con el ícono para arrastrar (o al menos una flecha
  que señale la fila real). Es la mejor solución vista al punto más difícil del primer uso.
- **Probar micrófono y atajo por separado,** con preguntas de sí/no y algo que se ilumina.
- **Practicar dentro de mocks de lo que usa el médico:** una historia clínica (motivo de consulta,
  examen físico), un WhatsApp a un paciente, una fórmula. La frase a decir, DENTRO del campo, con
  una corrección a propósito ("…150 sobre 95, no, perdón, 150 sobre 90") y etiquetas que muestren
  qué arregló. Resuelve también el hallazgo 13 (TextEdit tapa las instrucciones).
- **Momento de recompensa:** "Dictaste 3× más rápido de lo que escribes" / "Con esto ahorras ~X
  horas a la semana en historias clínicas".
- **Barra de etapas** arriba (Cuenta › Permisos › Práctica) en vez de "Paso 2 de 2".
- **Píldora mínima** sin logo, con ✕ y ✓.
- **Inicio con lo que dictó hoy** y cifras simples.
- **Una sola tecla** para dictar (ellos usan fn: mantener para hablar, doble toque para manos
  libres). Para un público de 55 años, una tecla es mucho más fácil que ⌥ + Espacio.

## Lo que probablemente NO conviene

- Preguntas de marketing (dónde nos conociste, para qué lo usarás): son pantallas de más para un
  médico. Si acaso una sola: dónde escribe sus historias (gMedic, otro software, Word).
- Referidos y "Pro" en el primer uso.
- Cifras infladas ("23 horas a la semana") que un médico no se cree.
- Entrar por el navegador: a nosotros nos sirve el código de 6 números dentro de la app.

## Decisiones de Nicolás sobre Wispr Flow (2026-11-11)

- **Diseño: es lo más importante por mejorar.** Probar la parte de diseño con el modelo Fable 5.2.
- **SÍ:** ventanita pegada a Ajustes del Sistema · probar micrófono y atajo por separado con sí/no ·
  práctica en mocks (historia clínica, WhatsApp, fórmula) con la frase dentro del campo ("tremendo")
  · momento de recompensa ("tremendo") · píldora mínima con ✕ y ✓ ("tremendo").
- **NO por ahora:** una sola tecla para dictar ("todavía no").
- **NO:** Inicio con historial y cifras · preguntas de marketing · referidos/Pro · entrar por el
  navegador.
- **Por evaluar:** cifras de ahorro ("no me molesta, podríamos evaluar si se pone").
- **.dmg:** se queda el doble clic, pero "hay que meterle mucho diseño, no me convence".
- Siguiente: decidir sí/no sobre los 22 hallazgos y corregir por pasos.

## Respuestas de Nicolás a los 22 hallazgos (2026-11-11)

- **Los 22 aprobados.** El 11 ya está visto: Nicolás sí vio el aviso del sistema. El 14 (quitar el
  diccionario del primer uso) se aprueba, pero el diccionario se explica en el video tutorial.
- **Nuevo, copiar de Wispr:** el tutorial animado que se muestra en la web apenas se descarga
  (una animación propia y simple, no una grabación de pantalla), adaptado a lo nuestro.
- **Prioridad:** el diseño visual. "Tiene que ser muy limpio; todavía lo veo muy AI". Es parte
  fundamental de la adopción.

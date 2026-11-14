# Sistema visual de CloseLabs Voice: «Tinta y voz»

> Versión final (ronda 3, 2026-11-12). Nicolás eligió la primera propuesta, con un poco más de lila
> y con las pantallas que se agregaron después. Este documento es la especificación para
> implementar: lo que no está aquí, no va.
>
> - Maquetas a tamaño real: `diseno/maquetas/index.html` (abrir desde el repo: usa rutas relativas
>   a `public/brand/` y `src-tauri/icons/`; las fuentes de la vista previa vienen de Google Fonts).
> - Ilustraciones: `diseno/ilustraciones/`.
> - Para regenerar todo: `python3 diseno/herramientas/gen.py` (`--png` exporta además el .dmg).
> - Nada de esto está aplicado en `src/` todavía.

## 1. La idea

Papel blanco, tinta casi negra, un escenario de lino con un tinte lila apenas visible, títulos en
serif con una palabra en cursiva y **el lila como color de CloseLabs, en dosis fijas**.

## 2. Principios

1. **El lila tiene dosis** (regla completa en §3). Se siente la marca; no vuelve el "lila por todas
   partes".
2. **Dos voces.** Newsreader (serif) en títulos, con UNA palabra en cursiva y en lila. Plus Jakarta
   Sans en todo lo demás. (2026-11-12: se probó la opción D de `maquetas/tipografias.html`
   —Newsreader en botones y menú + Schibsted Grotesk— y Nicolás pidió volver a esta.) La cursiva serif en tinta, dentro de un campo, es "lo que se dice en voz
   alta"; la sans recta es "lo que queda escrito".
3. **Una plantilla.** Barra superior, columna de texto a la izquierda, escenario a la derecha, botón
   abajo a la izquierda. El logo mide siempre 132 px. La ventana no cambia de tamaño ni de lugar.
4. **Una idea por pantalla.** Un título, como máximo una línea de apoyo, una acción.
5. **Dibujo propio.** Línea de tinta con un trazo lila. Ningún ícono de librería decorativo; ningún
   ícono encima de un título; el menú no lleva íconos.
6. **Grande y tranquilo.** Apoyo de 18 px, botones de 56 de alto, nada por debajo de 14 px.

## 3. La dosis de lila (regla)

`#A439FF` se usa en estos sitios y en ninguno más:

| # | Dónde | Cuánto |
|---|---|---|
| 1 | **Botón principal** (fondo `lila`, texto blanco; hover `lila-hover`) | Uno por pantalla |
| 2 | **La palabra en cursiva del título** (y de la frase de Inicio) | Una por título |
| 3 | **La voz y lo que está pasando ahora:** onda y barras al grabar, tecla presionada, etapa o paso en curso, anillo de foco, aro de "toca aquí" en el tutorial | Lo que corresponda al estado |
| 4 | **Lo que la app corrigió:** etiquetas en `lila-suave` con texto `lila-tinta` | Bajo el resultado de la práctica |
| 5 | **Marca del menú activo:** raya de 3 px a la izquierda | Una |
| 6 | **Tinte:** el lino `#F5F1F8` y el relleno `lila-suave` de UNA pieza por ilustración | Fondo; nunca saturado |

**Nunca en lila:** bordes de tarjetas o campos (salvo el foco), íconos, interruptores, casillas,
enlaces, botones secundarios, texto corrido, fondos saturados, degradados. Un segundo botón en la
misma vista es siempre secundario (contorno). El interruptor encendido y la casilla marcada son de
tinta. Los enlaces son de tinta con subrayado.

Contraste: blanco sobre `#A439FF` da 4,56:1 (pasa AA). Lila como TEXTO pequeño sobre papel usa
`lila-texto` `#8B2FF3` (5,5:1); `#A439FF` solo en texto de 24 px o más.

## 4. Ventana

| | Tamaño del contenido | Por qué |
|---|---|---|
| Por defecto | **1120 × 680** | Se siente una aplicación. Con la barra de título de Windows (~32 px) mide 712: cabe en los ~728 px útiles de 1366 × 768. |
| Mínimo | **960 × 600** | Por debajo, la columna de texto no sostiene un título de 40 px ni el escenario la tarjeta de 468. |
| Máximo del contenido | 1280 × 760, centrado | La ventana puede crecer; el contenido no se estira más. |

- Mismo tamaño y posición para instalación, primer uso y uso diario. Se abre centrada.
- Si el área útil es menor que 1120 × 712: abrir al tamaño que quepa y aplicar zoom al webview,
  `zoom = min(1, altoÚtil / 712, anchoÚtil / 1120)`.
- Entre 960 y 1120 de ancho: la columna izquierda pasa de 500 a 440 px (relleno 48 izq. / 40 der.);
  el escenario toma el resto. Entre 600 y 680 de alto no cambia ninguna medida: solo se acorta el
  espacio libre entre el contenido y el pie.
- El primer uso nunca se desplaza. Las páginas del uso diario sí, en vertical, dentro del área
  principal (el menú queda fijo).

## 5. Tokens (Tailwind v4)

```css
@theme {
  /* Neutros */
  --color-tinta: #18141D;        /* texto, controles encendidos */
  --color-tinta-2: #55505E;      /* texto de apoyo */
  --color-tinta-3: #6E6877;      /* texto discreto. No usar nada más claro para texto */
  --color-papel: #FFFFFF;        /* columna de contenido, tarjetas, campos */
  --color-lino: #F5F1F8;         /* escenario, menú lateral, .dmg, estado vacío */
  --color-lino-2: #ECE7F0;       /* relleno neutro dentro del escenario (avatar) */
  --color-linea: #E6E2EA;        /* separadores, borde de tarjeta, botón apagado */
  --color-linea-fuerte: #CFCAD4; /* borde de campo, tecla, botón secundario, interruptor apagado */
  --color-tarjeta-cab: #FBFAFC;  /* cabecera de tarjeta, campo apagado */

  /* Lila */
  --color-lila: #A439FF;
  --color-lila-hover: #8B2FF3;   /* botón principal al pasar el mouse; lila como texto pequeño */
  --color-lila-presion: #7A1FD1; /* botón principal presionado; borde de la tecla presionada */
  --color-lila-suave: #F3E8FF;   /* etiqueta de corrección; relleno en ilustraciones */
  --color-lila-tinta: #5E1AA6;   /* texto de la etiqueta de corrección */
  --color-lila-claro: #C79BFF;   /* lila sobre fondo oscuro (onda de la píldora, cursiva en la recompensa) */
  --color-foco: rgba(164, 57, 255, 0.28);

  /* Oscuros */
  --color-noche: #18141D;        /* píldora, ventanita de Ajustes, recompensa */
  --color-noche-2: #221B29;      /* escenario de la recompensa */

  /* Estados */
  --color-hecho: #1F7A4D;
  --color-aviso: #6B4500;  --color-aviso-fondo: #FFF3D6;  --color-aviso-punto: #C98A00;
  --color-error: #B3261E;  --color-error-borde: #E3B8B4;

  /* Tipografía */
  --font-serif: "Newsreader Variable", Georgia, serif;
  --font-sans: "Plus Jakarta Sans Variable", "Segoe UI", system-ui, sans-serif;

  /* Radios */
  --radius-tecla: 9px;  --radius-chico: 10px;  --radius-campo: 12px;  --radius-boton: 12px;
  --radius-tarjeta: 16px;  --radius-pildora: 22px;

  /* Sombras (solo estas tres) */
  --shadow-1: 0 1px 2px rgba(24,20,29,.06);
  --shadow-2: 0 1px 2px rgba(24,20,29,.05), 0 10px 28px rgba(24,20,29,.08);
  --shadow-flota: 0 8px 24px rgba(0,0,0,.28);
}
```

**Fuentes** (empaquetadas, sin CDN): `@fontsource-variable/newsreader` (importar `opsz.css` y
`opsz-italic.css`; licencia OFL) y `@fontsource-variable/plus-jakarta-sans` (ya instalada). Inter
deja de usarse en la app. `font-optical-sizing: auto`.

### Escala tipográfica (única)

| Token | Fuente | Tamaño / interlínea | Peso | Tracking | Uso |
|---|---|---|---|---|---|
| `cifra` | serif | 136 / 136 | 400 | -0.03em | solo la recompensa |
| `precio` | serif | 64 / 64 | 500 | -0.02em | fin de la prueba |
| `frase-inicio` | serif | 42 / 60 | 500 | -0.015em | Inicio |
| `titulo` | serif | 40 / 46 | 500 | -0.015em | título de cada pantalla y de cada página |
| `vacio` | serif | 28 / 34 | 500 | 0 | título de un estado vacío |
| `dicho` | serif cursiva | 20 / 29 | 400 | 0 | la frase que el médico debe decir |
| `apoyo` | sans | 18 / 28 | 400 | 0 | línea bajo el título (`tinta-2`) |
| `base` | sans | 17 / 24 | 400 · 600 | 0 | campos, botones, nombre de un renglón, menú |
| `cuerpo` | sans | 16 / 24 | 400 · 600 | 0 | texto general, enlace del pie, notas |
| `detalle` | sans | 15 / 22 | 400 · 600 | 0 | etiquetas de campo, segunda línea de renglón, "Atrás" |
| `menor` | sans | 14 / 20 | 600 | 0 | etapas, encabezado de grupo. **Mínimo absoluto** |

La palabra en cursiva de un título: `font-style: italic; color: lila` (sobre oscuro, `lila-claro`).
Los títulos de una sola palabra ("Diccionario", "Ayuda") no llevan cursiva. Sin negritas de 700.
Sin mayúsculas sostenidas con tracking.

### Espaciado

Múltiplos de 4. Valores en uso: 4, 8, 12, 14, 16, 20, 24, 28, 32, 36, 40, 56, 64, 72.

## 6. Plantilla del primer uso (1120 × 680)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ logo 132        Cuenta  Permisos  Prueba  Práctica      ¿Necesitas ayuda?│ 64
├────────────────────────────────┬─────────────────────────────────────────┤
│ ← Atrás            (y = 36)    │                                         │
│ Título serif       (y = 84)    │           ESCENARIO (lino)              │
│ Línea de apoyo     (+14)       │     una ilustración (520 × 400)         │ 616
│ contenido propio               │     o una tarjeta (468 de ancho),       │
│                                │           centrada                      │
│ [ Botón principal 380 × 56 ]   │                                         │
│   enlace secundario  (b = 32)  │                                         │
└────────────────────────────────┴─────────────────────────────────────────┘
        500 (papel)                           620
```

**Barra superior.** Alto 64, borde inferior 1 px `linea`, relleno `0 32px 0 24px`, rejilla
`1fr auto 1fr`. Izquierda: `closelabs-black.png` a 132 px de ancho. Centro: etapas. Derecha:
"¿Necesitas ayuda?" (enlace 15/600; abre el WhatsApp de soporte).

**Etapas.** Fila con 12 px de separación. Cada etapa: 104 px de ancho, nombre `menor` y, 8 px
debajo, una raya de 3 px (radio 2). Pendiente: texto `tinta-3`, raya `linea`. En curso: texto
`tinta`, raya `lila`. Hecha: texto y raya `tinta`. Sin números ni flechas.
Mac: Cuenta · Permisos · Prueba · Práctica. Windows: Cuenta · Prueba · Práctica.

**Columna izquierda.** 500 px, relleno `36px 56px 0 64px` (ancho útil 380).
- Renglón "← Atrás": alto 24, `detalle` 600, `tinta-2`. Si no aplica, el renglón queda vacío y el
  título NO sube.
- Título: `margin-top: 24px`. Máximo 3 renglones.
- Apoyo: `margin-top: 14px`. Máximo 2 renglones.
- Contenido propio (campos, lista): `margin-top` 22–28 px.
- **Pie:** `position: absolute; left: 64px; right: 56px; bottom: 32px`. Botón principal de ancho
  completo y, 12 px debajo, UN enlace centrado (alto 24). Si no hay enlace, su hueco se conserva.
  En las preguntas de sí/no, el "sí" es el botón y el "no" el enlace.

**Escenario.** 620 px, fondo `lino`, sin borde. Contenido centrado en los dos ejes, en columna con
20 px de separación. Opcional: una línea de 16/24 `tinta-2`, centrada, máximo 380 px.

**Recompensa (única pantalla oscura).** Fondo `noche`, escenario `noche-2`, logo
`closelabs-white.png`, borde de la barra `rgba(255,255,255,.12)`, etapas todas en blanco, apoyo en
blanco al 72 %, botón principal lila igual.

**Excepción: las prácticas (pantallas 7 a 9).** Desde el 2026-11-13 no usan columna + escenario sino
«arriba tu pantalla, abajo tu voz» (`src/components/onboarding/practica/PlantillaPractica.tsx`,
maqueta `diseno/maquetas/practicas-v2.html`, diseño de Fable aprobado por Nicolás). Barra igual;
franja de lino de 316 con "← Atrás · Práctica n de 3" y el programa del médico (historia clínica,
chat, fórmula: se parecen a los reales, sin marcas, y lo que no es el campo va al 82 %); debajo, en
papel y en una columna de 760, UN renglón de guía (serif 30/44) y, cuando toca, la frase (serif
cursiva 25/36). Pie: enlace a la izquierda y el botón (mín. 260) a la derecha, que solo aparece en
el resultado. Momentos: falta el clic (aro lila y "clic aquí") → teclas y frase → grabando ("Al
terminar, presiona … otra vez") → escribiendo → resultado, con lo que se quitó tachado en lila.

## 7. Secuencia de pantallas

| # | Pantalla | Etapa | Título (cursiva = *…*) | Apoyo | Botón · enlace | Escenario |
|---|---|---|---|---|---|---|
| 0 | Instalando (solo Mac) | ninguna | *Instalando* CloseLabs Voice. | No tienes que hacer nada. Tarda unos segundos. | — | `voz-a-texto.svg` |
| 1 | Bienvenida | ninguna | Escribe tus historias *hablando*. | Tú hablas. El texto aparece donde tengas el cursor, con sus puntos y sus comas. | Crear mi cuenta · Ya tengo una cuenta | `voz-a-texto.svg` |
| 2 | Cuenta | Cuenta | Crea tu *cuenta*. | — | Crear mi cuenta · Ya tengo una cuenta | `privacidad.svg` + "Tus dictados no se almacenan ni se usan para entrenar modelos." |
| 3 | Código | Cuenta | Revisa tu *correo*. | Te enviamos un código de 6 números a **correo** | Confirmar (apagado hasta completar) · No me llegó: enviar otro código | `correo-codigo.svg` |
| 4 | Permisos (solo Mac) | Permisos | Dos permisos y *listo*. | macOS te los pide una sola vez. | Abrir Ajustes del Sistema | miniatura de Ajustes + "Se abre Ajustes del Sistema y te señalamos dónde tocar." |
| 5 | Micrófono | Prueba | ¿Se mueven las barras cuando *hablas*? | Di cualquier cosa, con tu voz de siempre. | Sí, se mueven · No se mueven | tarjeta con las barras y el micrófono |
| 6 | Atajo | Prueba | Presiona las dos teclas. ¿Se *encienden*? | Con ellas empiezas y terminas cada dictado. | Sí, se encienden · No se encienden | teclas grandes + "Primero ⌥ y, sin soltarla, Espacio." |
| 7 | Práctica 1 | Práctica | Dicta el *motivo* de consulta. | Haz clic en el campo y lee la frase tal como está, con el «eh» y la equivocación. | Continuar (apagado) · Saltar la práctica | historia clínica |
| 7b | resultado | Práctica | Te corregiste al hablar. Quedó *limpio*. | Así puedes dictar siempre: sin cuidarte de hablar perfecto. | Continuar · Repetir | historia + etiquetas |
| 8 | Práctica 2 | Práctica | Ahora, respóndele a un *paciente*. | Igual que antes: clic en el campo, las dos teclas y hablas. | Continuar (apagado) · Saltar la práctica | chat de WhatsApp |
| 8b | resultado | Práctica | Lo que retiraste no *llegó*. | El paciente solo lee lo que quisiste decir. | Continuar · Repetir | chat + etiquetas |
| 9 | Práctica 3 | Práctica | Por último, una *fórmula*. | Aquí te vas a corregir en la dosis. | Continuar (apagado) · Saltar la práctica | fórmula médica |
| 9b | resultado | Práctica | La dosis quedó como la *corregiste*. | Lo que retiras al hablar no llega al texto. | Continuar · Repetir | fórmula + etiquetas |
| 10 | Recompensa | todas hechas | Dictaste *N veces* más rápido de lo que escribes. | Lo medimos con lo que acabas de dictar. | Empezar a usar CloseLabs Voice | cifra, comparación y ahorro |

- **Mac:** 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → Inicio. Si un permiso ya está concedido,
  aparece marcado "Listo" en la pantalla 4; si los dos lo están, la pantalla 4 se salta.
- **Windows:** 1 → 2 → 3 → 5 → 6 → 7 → 8 → 9 → 10 → Inicio (sin 0 ni 4; teclas Ctrl + Espacio).
- "Ya tengo una cuenta" lleva a Iniciar sesión (misma plantilla: correo, contraseña, "Entrar" ·
  "Olvidé mi contraseña"); quien entra y ya hizo el tutorial va directo a Inicio.
- "Saltar la práctica" lleva a Inicio sin pasar por la recompensa.
- "No se mueven": el escenario muestra el selector de micrófono abierto y el apoyo cambia a "Elige
  otro micrófono y vuelve a hablar." · "No se encienden": apoyo "Presiona primero ⌥ y, sin soltarla,
  Espacio. Si sigue sin encenderse, escríbenos." con el enlace de ayuda.
- En la recompensa, N = palabras por minuto del médico (sobre sus tres dictados) ÷ 40, con un
  decimal en la cifra grande ("3,1×") y redondeado a entero en el título ("3 veces"). Si N < 1,5 el
  título es "Ya sabes *dictar*." y la cifra no se muestra.
- Ahorro: `minutos = round((2400/40 − 2400/ppm) / 5) × 5` → "En 20 historias al día, son unos M
  minutos menos frente al teclado." y debajo, en `menor` 400, "Calculado con historias de 120
  palabras."

### Las tres prácticas

Cada etiqueta se muestra SOLO si su comprobación exacta sobre el texto final se cumple (comparar en
minúsculas y sin tildes). Si una no se cumple, esa etiqueta no sale; las demás sí. Y antes que eso, el
texto tiene que contener las palabras ancla de la frase (`ancla` en `PrimerDictado.tsx`): sin ellas
el médico dijo otra cosa, no sale ninguna etiqueta ni tachado y el resultado dice "Quedó *escrito*."
Los títulos y apoyos de las filas 7 a 9 de la tabla de arriba quedaron reemplazados por el renglón de
guía de cada momento (ver la excepción en §6).

| | Frase que se dice | Etiqueta → comprobación |
|---|---|---|
| 1 | «Paciente de 58 años que consulta por, eh, dolor en la rodilla izquierda, no, perdón, en la rodilla derecha, desde hace tres días.» | **Quitó «eh»** → no hay palabra suelta `eh`. **Corrigió izquierda → derecha** → no contiene `izquierda` y sí `derecha`. **Puso la puntuación** → termina en `.` |
| 2 | «Hola, don Jaime. Tómela, este, después del almuerzo, no, perdón, después del desayuno, con un vaso de agua.» | **Quitó «este»** → no hay palabra `este`. **Corrigió almuerzo → desayuno** → no contiene `almuerzo` y sí `desayuno`. **Puso la puntuación** → termina en `.` |
| 3 | «Losartán de 50 miligramos, una tableta cada 12 horas, no, mentira, cada 24 horas, por 30 días.» | **Corrigió cada 12 → cada 24 horas** → no contiene `12` y sí `24`. **Puso la puntuación** → termina en `.` |

⚠️ Antes de publicar, pasar las tres frases por `pruebas-dictado/` con decenas de repeticiones.

## 8. Instalando (Mac) y el relevo

Se muestra una ventana, y es **la misma del primer uso**: mismo tamaño, misma posición, y en el
escenario el mismo dibujo de la bienvenida. Al terminar solo cambia la columna de texto.

**Contenido de la columna:** título, apoyo, la línea de avance (380 × 36: renglón de tinta de 3 px
ya recorrido, la onda lila de 64 px en la punta, puntos `linea-fuerte` por recorrer) y, 12 px
debajo, tres renglones (relleno vertical 14, separador `linea`):
1. Copiando a Aplicaciones · 2. Preparando tu computador · 3. Abriendo CloseLabs Voice.
Marca de 28 px: pendiente = círculo con borde 2 px `linea-fuerte`, texto `tinta-3` 500; en curso =
círculo con borde lila que gira (una vuelta cada 900 ms), texto `tinta` 600 con "…"; hecho =
círculo relleno `hecho` con visto blanco y "Listo" a la derecha (15/600 `hecho`). Sin botón.

**Tiempos.**
- Cada paso se ve **como mínimo 1,2 s** aunque el trabajo tarde menos. Total mínimo antes de
  relanzar: 3,6 s.
- La línea de avance va a 30 %, 62 % y 97 % al entrar a cada paso (transición de 600 ms).
- Si un paso pasa de 8 s, el apoyo cambia a "Está tardando más de lo normal. No cierres esta
  ventana." Si falla: apoyo "No se pudo instalar." + botón "Reintentar" · enlace "Pedir ayuda".

**Relevo sin corte.**
1. La app abierta desde el disco hace los pasos 1 y 2 (copiar, quitar la cuarentena).
2. Al entrar al paso 3 guarda la posición y el tamaño de su ventana y lanza la copia de
   /Applications con `--recien-instalada --x=… --y=… --ancho=… --alto=…`.
3. La app nueva abre su ventana en esa misma posición y tamaño y pinta **el mismo cuadro**: pasos 1
   y 2 hechos (sin animación de entrada), paso 3 en curso, línea al 97 %.
4. La app vieja **no se cierra al lanzar**: espera el aviso de la nueva ("ya pinté"; tope 5 s) y solo
   entonces cierra su ventana y expulsa el disco. Siempre hay una ventana idéntica a la vista.
5. La app nueva se trae al frente (segundo `open` sobre sí misma ~3 s después, ya probado), mantiene
   el cuadro **800 ms**, marca el paso 3 como hecho durante **400 ms** y funde a la bienvenida:
   la columna de texto sale en 160 ms y entra la nueva en 240 ms. El escenario, la barra superior y
   la ventana no se mueven.

Duración percibida: entre 5 y 7 s, sin huecos. En Windows no existe esta pantalla: el instalador
termina y abre la app en la bienvenida.

## 9. Componentes

**Botón principal.** Alto 56, radio 12, fondo `lila`, texto blanco `base` 600, sin borde. Hover:
`lila-hover`. Presionado: `lila-presion`. Foco por teclado: anillo `0 0 0 3px foco`. Apagado: fondo
`linea`, texto `tinta-3`, sin hover. En el primer uso ocupa el ancho de la columna (380). En el uso
diario mide lo que su texto + relleno lateral 28. Versión corta (dentro de un renglón): alto 44,
relleno lateral 20, 16/600. **Uno por vista.**

**Botón secundario.** Mismas medidas. Fondo papel, borde 1,5 px `linea-fuerte`, texto `tinta`.
Hover: fondo `lino`. Variante de peligro (solo "Eliminar mi cuenta"): texto `error`, borde
`error-borde`.

**Enlace.** `tinta`, 600, subrayado de 1 px `linea-fuerte` a 4 px del texto. 16 px en el pie y las
notas; 15 px dentro de un renglón ("Quitar", "Mostrar", "Cambiar"). Hover: subrayado `tinta`.

**Campo de texto.** Etiqueta arriba, siempre visible (`detalle` 600; 6 px de separación). Caja: alto
50, borde 1,5 px `linea-fuerte`, radio 12, relleno lateral 16, texto `base`, fondo papel.
Placeholder `tinta-3`. Foco: borde `tinta` + `box-shadow: 0 0 0 3px foco`. Error: borde `error` y un
renglón `detalle` en `error` 6 px debajo. Separación entre campos: 14. `noValidate` en todos los
formularios; los mensajes son nuestros y en español. "Mostrar" (contraseña) va en el renglón de la
etiqueta, a la derecha.

**Casilla.** 22 × 22, radio 6. Vacía: borde 1,5 px `linea-fuerte`. Marcada: fondo `tinta`, visto
blanco. Texto `detalle` `tinta-2` a 12 px.

**Casillas del código.** Seis de 54 × 68, separadas 10, radio 12, borde 1,5 px `linea-fuerte`,
dígito serif 34/500. La activa lleva el foco del campo. Al pegar los 6 números se reparten solos.

**Tecla dibujada.** Fondo papel, borde 1,5 px `linea-fuerte` con borde inferior de 3,5 px, radio 9,
texto sans 16/600, relleno lateral 10, ancho mínimo = alto. Tamaños: en línea 36; en Inicio 46
(texto 20, radio 11); grande 112 (texto 30, radio 22, borde 2 px, inferior 8 px, relleno 34). El
"+" entre teclas: `tinta-3` 500, 5 px a cada lado (18 en grande). **Presionada:** fondo `lila`,
borde `lila-presion`, texto blanco, borde inferior 3 px y baja 5 px. Sobre fondo oscuro (píldora):
alto 26, fondo blanco al 14 %, borde blanco al 30 %, texto blanco 14. Las teclas salen siempre de
`useShortcutKeys`.

**Lista de pasos** (permisos, instalación). Borde superior `linea`; cada renglón con relleno
vertical 18 (14 en instalación), separador `linea`, marca de 28 px a la izquierda y 16 px hasta el
texto: nombre `base` 600 y, si hay, una frase `detalle` `tinta-2`. Estados de la marca: pendiente
(borde 2 px `linea-fuerte`), toca ahora (borde 2 px `tinta`), en curso (borde lila girando), hecho
(relleno `hecho` + visto blanco + "Listo" a la derecha).

**Tarjeta del escenario.** Ancho 468, fondo papel, borde 1 px `linea`, radio 16, `shadow-2`.
Cabecera de 52 (fondo `tarjeta-cab`, borde inferior `linea`, relleno lateral 20): a la izquierda el
nombre 15/600, a la derecha el contexto 15/500 `tinta-2`. Cuerpo con relleno 20.
- *Historia clínica:* "Historia clínica" · "Marta Rojas · 58 años"; etiqueta "Motivo de consulta"
  (14/600 `tinta-2`) + campo de práctica; etiqueta "Examen físico" + un campo apagado de 52.
- *WhatsApp:* avatar de 32 con iniciales + "Jaime Pardo" · "WhatsApp"; franja `#EEEAF1` con el
  globo del paciente (papel, radio `4px 14px 14px 14px`, 16/24, hora 13 px a la derecha); campo de
  práctica con relleno exterior `14px 16px 16px`.
- *Fórmula:* "Dra. [nombre del médico]" · "Fórmula médica"; renglón "Paciente: **Marta Rojas**" y
  la fecha, con línea inferior; "Rp." en serif 30/500; campo de práctica.

**Campo de práctica.** Borde 1,5 px `tinta`, radio 10, relleno `14px 16px`. Tres renglones: guía
(`detalle` `tinta-2`, con las teclas en línea: "Presiona ⌥ + Espacio y di:"), la frase en `dicho`
(márgenes 8 y 10) y la guía final ("Presiona ⌥ + Espacio otra vez para terminar."). Al grabar: la
primera guía pasa a "Te escucho…" en `lila-hover` 600, la frase sigue visible y la guía final dice
"Presiona ⌥ + Espacio para terminar."; la píldora aparece dentro del escenario, centrada, a 24 px
del borde inferior. Resultado: el texto en sans 16/25 con cursor (2 × 20, `tinta`).

**Etiquetas de corrección.** Fila centrada 20 px bajo la tarjeta, 8 px entre ellas, sin salto de
línea. Cada una: alto 34, radio 17, relleno `0 14px 0 10px`, fondo `lila-suave`, texto `lila-tinta`
15/600, visto de 14 px en `lila-hover` y 8 px hasta el texto. Entran una tras otra cada 120 ms.

**Barras de voz** (prueba del micrófono). Tarjeta de 468: zona de 150 de alto con 30 barras de 8 px
(radio 4, separadas 6), en `lila`, centradas en vertical, alto de 18 a 128 según el volumen real;
debajo, renglón con borde superior `linea` y relleno `16px 20px`: nombre del micrófono (16) y el
enlace "Cambiar".

**Recompensa.** Escenario en columna: cifra (`cifra`, blanca, con la "×" en cursiva `lila-claro`);
20 px; bloque de 440 con dos comparaciones separadas 20: renglón (15 px; nombre blanco 600 a la
izquierda, dato blanco al 72 % a la derecha), 8 px, barra de 10 (radio 5): la del médico al 100 %
en `lila`; la del teclado con ancho `40/ppm` en blanco al 30 %. 20 px; bloque de ahorro de 440 con
borde superior blanco al 16 % y relleno superior 18: frase 17/26 blanca y supuesto 14/20 al 60 %.

**Menú lateral.** Ancho 248, fondo `lino`, relleno `14px 16px 20px`. Logo negro a 132 px con margen
`4px 0 26px`. Seis entradas de 46 de alto, relleno lateral 16, radio 10, `base` 500 `tinta-2`:
Inicio, Diccionario, Mi cuenta, Configuración, Acerca de, Ayuda. Hover: fondo blanco al 60 %.
Activa: fondo papel, `shadow-1`, texto `tinta` 600 y una raya lila de 3 px (radio 2) a la
izquierda, de `top: 11px` a `bottom: 11px`. Sin íconos. Abajo (`margin-top: auto`, relleno lateral
16): punto de 9 px + estado en `detalle` `tinta-2`: verde `hecho` "Lista para dictar"; ámbar
`aviso-punto` "Sin internet" o "Prueba terminada".

**Página del uso diario.** Área principal con relleno `40px 72px 0`. Título `titulo`; apoyo opcional
a 8 px. Grupos a 24 px (el primero a 18): encabezado `menor` `tinta-3` con relleno inferior 10 y
línea `linea`.

**Renglón.** Alto mínimo 66, relleno vertical 8, separador inferior `linea`, 24 px entre columnas.
Izquierda: nombre `base` 600 y frase `detalle` `tinta-2`. Derecha (pegado al borde, 14 px entre
elementos): un control. Variante baja (palabras del Diccionario, preguntas): alto mínimo 54, nombre
en 500, sin frase.

**Interruptor.** 52 × 30, radio 15; perilla de 24 con sombra `0 1px 2px rgba(0,0,0,.2)` a 3 px del
borde. Apagado `linea-fuerte`; encendido `tinta`. Transición 160 ms.

**Selector.** Alto 44, borde 1,5 px `linea-fuerte`, radio 10, relleno lateral 14, texto 16, flecha
de 12 px a 12 px del texto.

**Lapicito (renombrar computador).** Botón de 30 × 30, radio 8, borde 1,5 px `linea-fuerte`, lápiz
de 16 px trazo 1,6 `tinta`, 6 px a la derecha del nombre. Al tocarlo, el renglón se convierte en:
campo de 340 × 46 con el nombre seleccionado y el foco, botón principal corto "Guardar" y enlace
"Cancelar" (10 px entre ellos). Enter guarda, Esc cancela. Máximo 40 caracteres; vacío = vuelve al
nombre de red. **Nombre por defecto:** el nombre de red sin `.local`/`.lan` y con los guiones y
guiones bajos cambiados por espacios cuando hay minúsculas ("Nicolass-MacBook-Air-2.local" →
"Nicolass MacBook Air 2"); los nombres todo en mayúsculas de Windows se dejan como están
("CONSULTORIO-PC").

**Aviso.** Fondo `aviso-fondo`, texto `aviso` 16/24, radio 12, relleno `14px 18px`, sin ícono; la
primera frase en 600. Va arriba del contenido (en Inicio: `top: 24px`, a 72 px de los lados).

**Estado vacío.** Bloque `lino`, radio 16, que ocupa el alto libre (margen `24px 0 40px`): título
`vacio` y una frase 17/26 `tinta-2` de máximo 460 px, centrados.

**Pregunta frecuente.** Cerrada: renglón bajo con flecha de 14 px a la derecha. Abierta: relleno
`16px 0 18px`, pregunta `base` 600, respuesta 16/26 `tinta-2` de máximo 640 px. Una abierta a la vez.

**Píldora.** Solo existe mientras se graba o se escribe, o para un mensaje. En reposo no hay nada.
Cápsula `noche`, alto 44, radio 22, borde 1 px blanco al 18 %, `shadow-flota`, relleno lateral 7.
- *Grabando:* ✕ (círculo de 30, blanco al 14 %, equis blanca de 12 px trazo 2; cancela) · 12 px ·
  onda de 22 barras de 3 px (radio 2, separadas 3, alto 4–26 según el volumen) en `lila-claro` ·
  12 px · ✓ (círculo de 30 blanco, visto `tinta`; termina).
- *Procesando:* relleno lateral 18, "Escribiendo" 15/600 blanco + tres puntos de 5 px `lila-claro`
  (opacidad 1, .65, .35, en ciclo de 900 ms).
- *Pista (primeros 7 días desde el primer dictado):* cápsula aparte 8 px encima, radio 10, relleno
  `6px 12px`, 14/500: "Presiona ⌥ + Espacio para terminar".
- *Mensajes:* mismo estilo que Procesando. "No encuentro un micrófono. Conéctalo y vuelve a
  intentar." con un punto ámbar `#F2C14E` de 9 px delante; dura 6 s. (El aviso "¿No apareció? Quedó
  copiado" de los primeros 7 días se QUITÓ el 2026-11-12: a Nicolás le pareció invasivo y cansón.)
- Ventana del overlay: 300 × 100 (520 × 100 para los mensajes), centrada en horizontal, con la
  cápsula a 12 px por encima del área de trabajo (nunca sobre el Dock ni la barra de tareas).
- Sin logo, sin lema.

**Ventanita de Ajustes (Mac).** 540 × 86, `noche`, radio 16, borde 1 px blanco al 18 %,
`shadow-flota`, relleno `16px 20px`, 16 px entre elementos. Círculo lila de 40 con flecha blanca
hacia arriba · "Busca **CloseLabs Voice** en la lista de arriba y enciende su interruptor." (17/25
blanco) · ícono de la app (52, radio 12) arrastrable a la lista. Se coloca centrada, 10 px debajo
de la ventana de Ajustes del Sistema, la sigue si se mueve y se cierra sola cuando el permiso queda
concedido; entonces nuestra ventana vuelve al frente y pasa a la etapa Prueba.

**.dmg (560 × 400).** Fondo `lino`. Título serif 34/500 centrado en y = 76: "Haz *doble clic* en el
ícono" (cursiva en lila). Onda lila de 3 px desde el borde izquierdo hasta x = 192 en y = 215. Tres
renglones de tinta de 3 px desde x = 370 (y = 195, 215, 235). Tres rayitas de clic arriba a la
derecha del ícono. "Se instala sola en unos segundos." 15 px `tinta-2` en y = 352. Finder pone el
ícono de 128 px en (280, 215) y su nombre debajo. Archivos listos: `ilustraciones/dmg-fondo.png`
(560 × 400) y `dmg-fondo@2x.png` (1120 × 800); con ellos se arma el `.tiff` de `src-tauri/dmg/`.

**Web.** Panel de descarga de 1120 × 600 con la misma plantilla: izquierda (500, relleno
`36px 56px 0 64px`): logo, título 44/50 "Ábrela en *tres* pasos.", selector Mac | Windows (activo en
tinta), tres pasos (18/28, número en serif cursiva 22, separador `linea`; el actual en 600 con su
número en lila) y "¿No empezó la descarga? Intentar otra vez". Derecha (`lino`): el cuadro del
tutorial, la barra de avance (rayas de 28 × 4 separadas 8: hechas `tinta`, actual `lila`, pendientes
`linea-fuerte`) y una línea. Tutorial: 8 cuadros en Mac y 4 distintos en Windows, 3–4 s cada uno
(storyboard en las maquetas).

## 10. Páginas del uso diario

- **Inicio.** Centrado: "Haz clic donde quieras escribir, presiona [teclas], habla, y presiona otra
  vez para *terminar*." (`frase-inicio`, máx. 700 px; con "mantener presionado": "…mantén presionadas
  [teclas] mientras hablas, y suelta para *terminar*."). 36 px debajo, botón secundario corto "Hacer
  un dictado de prueba". Al pie (32 px): "¿Escribió mal una palabra? Agrégala al Diccionario". Sin
  historial ni cifras.
- **Diccionario.** Apoyo: "Nombres, medicamentos o siglas que la app debe escribir siempre igual."
  Fila a 22 px: campo ("Escribe la palabra como debe quedar") + botón "Agregar" de 50 de alto
  (apagado si el campo está vacío). Grupo "Tus palabras · N" con renglones bajos y "Quitar". Vacío:
  "Todavía no hay palabras." / "Cuando la app escriba mal un nombre o un medicamento, agrégalo aquí
  una vez. No vuelve a fallar."
- **Mi cuenta.** Grupos, en orden: *Tus datos* (nombre, correo · "Cambiar contraseña"),
  *Suscripción*, *Computadores · N de 3* (nombre + lapicito; "Este computador." o "Último dictado:
  …"; "Quitar" en los demás), *Sesión* ("Cerrar sesión" · "Solo en este computador."), y al final,
  tras desplazarse, *Eliminar la cuenta* (botón de peligro; pide confirmación doble).
  Suscripción en prueba: "Prueba gratis" · "Te quedan N días. Después, US$12 al mes." · botón
  principal corto "Suscribirme". Activa: "Plan mensual · activo" · "US$12 al mes. Próximo cobro:
  [fecha]." · secundario "Administrar el pago". Médicos de gMedic: "Incluida con gMedic", sin botón.
- **Configuración.** *Dictado:* Atajo para dictar (teclas + "Cambiar"), Micrófono (selector).
  *El texto:* Escribir todo en MAYÚSCULAS, Sonido al empezar y al terminar. *El computador:* Abrir
  al encender el computador. Sin jerga ni inglés.
- **Ayuda.** *Hablar con nosotros:* "Escríbenos por WhatsApp" (botón principal corto "Abrir
  WhatsApp"), "Reportar un problema" (secundario "Reportar"). *Preguntas frecuentes.*
- **Acerca de.** *La aplicación:* versión + "Tienes la última versión." / "Hay una versión nueva."
  ("Buscar actualizaciones"), Privacidad, Términos. *Quién la hace:* CLOSELABS GROUP LLC, Handy.
- **Fin de la prueba.** Reemplaza a Inicio (el menú sigue): "Gracias por *probarla*." · "Tu prueba
  gratis terminó. Para seguir dictando, activa tu suscripción." · "US$12" (`precio`) + "al mes" ·
  "Dictado sin límite en tus 3 computadores. Tu diccionario sigue como lo dejaste." · botón principal
  "Suscribirme" (260 de ancho) + secundario "Hablar con soporte". Estado del menú: "Prueba
  terminada". Sin rojo.
- **Sin internet.** Aviso en Inicio: "**Sin internet.** Puedes seguir dictando; el texto sale sin
  pulir hasta que vuelva la conexión." Estado del menú: "Sin internet".

## 11. Ilustración

- Línea de 2 px en `tinta`, extremos y uniones redondos. Rellenos: papel, y `lila-suave` en UNA
  pieza por dibujo (la pinza de la tabla, el candado, el sobre).
- Un único trazo `lila` de 3 px por dibujo: la voz, o lo que hay que tocar.
- Formas ligeramente torcidas a mano. Sin degradados, sombras, 3D ni personajes.
- Motivo propio: **la onda que se vuelve renglón** (bienvenida, .dmg, línea de avance, píldora).
- Texto ya escrito = renglones de tinta al 28 %; por escribir = puntos `linea-fuerte`.
- Tutorial de la web: lo mismo, más un cursor negro con borde blanco y un aro lila de 3 px.
- Archivos: `voz-a-texto.svg` (520 × 400), `privacidad.svg`, `correo-codigo.svg`, `dmg-fondo.svg`.
- El logo y el isotipo: siempre los PNG de `public/brand/`, sin redibujar.

## 12. Movimiento

| Qué | Duración | Curva |
|---|---|---|
| Estados (hover, foco, tecla, interruptor) | 160 ms | `cubic-bezier(.2,.8,.2,1)` |
| Cambio de pantalla: sale la columna de texto y el contenido del escenario (opacidad 1→0) | 160 ms | la misma |
| …y entra lo nuevo (opacidad 0→1, sube 8 px) | 240 ms | la misma |
| Raya de la etapa al pasar a "en curso" (crece de izquierda a derecha) | 240 ms | la misma |
| Etiquetas de corrección (opacidad + 4 px), una tras otra | 200 ms, cada 120 ms | la misma |
| Píldora: aparece / desaparece (opacidad + escala .96→1) | 160 ms / 120 ms | la misma |
| Onda y barras de voz | siguen el volumen, a 60 cuadros | lineal |
| Línea de avance de la instalación | 600 ms por tramo | `ease-in-out` |
| Giro del paso en curso | 900 ms por vuelta | lineal |
| Cifra de la recompensa: cuenta de 1,0 a N | 800 ms | `ease-out` |
| Barras de la recompensa: crecen desde 0 | 600 ms, 200 ms después de la cifra | la misma |

Lo que NO se mueve entre pantallas: la ventana, la barra superior, el botón principal (cambia su
texto en el sitio) y el fondo del escenario. Con `prefers-reduced-motion`: sin desplazamientos ni
giros; solo fundidos de 120 ms. El aviso "¿No pasa nada?" de las prácticas no sale antes de 60 s.

## 13. Voz de los textos

- Tuteo, frases cortas, verbo primero. El título dice qué hacer o pregunta algo de sí o no.
- Palabras del médico: historia, motivo de consulta, fórmula, paciente, las dos teclas, computador.
- Prohibidas: modelo, transcripción, overlay, IA, procesar, sincronizar, onboarding, emojis.
- Nunca "100 % local". Privacidad: "Tus dictados no se almacenan ni se usan para entrenar modelos."
- Errores: qué pasó y qué hacer, en una línea, sin culpa y sin rojo.
- Cifras: solo las medidas en el dictado del médico, o con su supuesto escrito al lado.
- Precio: "US$12 al mes".

## 14. Nunca

- Lila fuera de los seis usos del §3. Dos botones lila en la misma vista.
- Un ícono dentro de un círculo encima de un título; íconos de librería como decoración.
- Degradados, brillos, vidrio esmerilado, `backdrop-filter`.
- Inter; negritas de 700; títulos en mayúsculas con tracking; más de una palabra en cursiva.
- El botón principal en otro lugar; el logo en otro tamaño; el logo en la píldora.
- Tarjetas dentro de tarjetas; sombras fuera de las tres definidas; tarjetas en las páginas del uso
  diario (van renglones).
- Píldora en reposo.
- Texto de menos de 14 px; gris más claro que `tinta-3` para texto.
- Etiquetas de corrección sin su comprobación exacta.
- Jerga, inglés, puntos rojos de estado, emojis.
- Redibujar o vectorizar el isotipo.

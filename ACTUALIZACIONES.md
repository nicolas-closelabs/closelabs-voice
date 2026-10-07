# ACTUALIZACIONES — cómo se publica una versión y cómo se actualiza sola

> **Desde la 0.9.x (2026-10-07).** Antes, cada versión nueva había que mandarla e instalarla a mano en
> cada computador. Ahora, en **Windows**, la app baja la versión nueva en segundo plano y el médico la
> instala con un clic ("Reiniciar ahora"). **Mac todavía no** (ver abajo).

## ⚠️ La llave del updater

Las actualizaciones van firmadas con **nuestra** llave (no es la firma de Windows ni la de Apple: es
otra, de Tauri). La app instalada trae la llave pública y **solo acepta lo que esa llave firmó**:
nadie puede colarle un instalador ajeno.

| Qué | Dónde |
|---|---|
| Llave privada | `~/.tauri/closelabs-voice-updater.key` en el Mac de Nicolás, y el secreto `TAURI_SIGNING_PRIVATE_KEY` en GitHub |
| Contraseña | `~/.tauri/closelabs-voice-updater.password`, y el secreto `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` |
| Llave pública | `plugins.updater.pubkey` en `src-tauri/tauri.conf.json` |

**Si se pierde la llave privada, las apps instaladas no aceptan ninguna actualización más**: habría
que reinstalar a mano en cada computador. **Guardar la llave y la contraseña en un gestor de
contraseñas** (1Password, Bitwarden…) y no borrarlas de ahí nunca. GitHub no deja leer los secretos
de vuelta: no sirve de respaldo.

## Cómo funciona

1. **El CI** genera, además de los instaladores, los archivos de actualización firmados (`.sig`).
   Solo en el CI: localmente no está la llave y `tauri build` funciona como siempre.
2. **`scripts/publicar-version.sh <run-id>`** sube los instaladores a un GitHub Release del
   repositorio público de descargas y registra la versión en la tabla `versiones`, con las URL y las
   firmas.
3. **La función `update`** le contesta a cada app si hay algo para ella: la versión de
   `app_config.version_automatica`, si es más nueva que la suya y tiene archivos para su plataforma.
   Ante cualquier duda contesta "nada" (una app que no se actualiza sigue dictando).
4. **La app** pregunta al abrir y cada 6 horas. Si hay versión, la baja en segundo plano, avisa
   "La versión X está lista" y deja un botón en el pie de la ventana. **Se instala solo cuando el
   médico toca "Reiniciar ahora"**: nunca a mitad de una consulta.

**Dos columnas, a propósito:**
- `latest_version`: el **aviso** de "hay versión nueva" con el enlace de descarga. Lo ven todas las
  versiones, también la 0.8.4.
- `version_automatica`: lo que **se instala solo**. Solo lo leen las apps 0.9.x en adelante. Así se
  puede probar una versión con el equipo sin que los médicos vean nada.

## Publicar una versión

```bash
# 1. Compilar: GitHub → Actions → "CloseLabs Voice — Build" → Run workflow. Anotar el número de la corrida.
# 2. Publicar como prerelease (nadie la recibe; la web sigue con la anterior):
scripts/publicar-version.sh <run-id> --notas "Qué trae"
# 3a. Probarla con el equipo (se instala sola en las 0.9.x; los médicos con la 0.8.4 no ven nada):
scripts/publicar-version.sh <run-id> --notas "Qué trae" --probar
# 3b. O darla a todos (la web pasa a bajar esta y las apps la reciben):
scripts/publicar-version.sh <run-id> --notas "Qué trae" --a-todos
```

⚠️ **La web descarga siempre "la última" versión publicada** (`/releases/latest/download/…`). Por eso
el script publica como **prerelease** salvo con `--a-todos`.

**Frenar una versión mala:** `update app_config set version_automatica = '<la anterior buena>';`.
Las apps que ya la instalaron no vuelven atrás solas (la app nunca baja de versión): para eso está
`min_supported_version`, que bloquea la versión y muestra el enlace.

## Mac: todavía no

Sin la firma de Apple, cada versión nueva le quita a la app el permiso de **Accesibilidad** (macOS lo
ata a la huella exacta del programa) y el dictado deja de pegarse **sin que el médico sepa por qué**.
Con actualización automática eso le pasaría sin haber hecho nada. Por eso el script no incluye Mac
salvo con `--con-mac`, que se usa **solo cuando haya firma de Apple** (ver `FIRMA-Y-DISTRIBUCION.md`).
Mientras tanto, en Mac la app sigue mostrando el aviso con el enlace de descarga.

## La primera vez

Las instalaciones **0.8.4 y anteriores no tienen actualización automática** (traían la configuración
de Handy, que no servía). Hay que instalarles a mano la 0.9.x una vez; de ahí en adelante, solas.

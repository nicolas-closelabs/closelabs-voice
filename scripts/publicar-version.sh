#!/usr/bin/env bash
# CloseLabs Voice — publicar una versión (ver ACTUALIZACIONES.md).
#
#   scripts/publicar-version.sh <run-id-del-CI> [--notas "texto"] [--con-mac] [--a-todos]
#
# Toma los instaladores de una corrida del CI ("CloseLabs Voice — Build") y:
#   1. Crea el GitHub Release vX.Y.Z en el repositorio público de descargas, con los nombres de
#      siempre (CloseLabs-Voice-Windows.exe / .msi, CloseLabs-Voice-Mac.dmg) más el archivo de
#      actualización de Mac (CloseLabs-Voice-Mac.app.tar.gz).
#   2. Registra la versión en la tabla `versiones` con las URL y las firmas del updater.
#
# Por defecto se publica como PRERELEASE y NO se ofrece a nadie: la web (que baja siempre "la
# última") sigue con la anterior, y ninguna app la recibe.
#
#   --probar    además pone app_config.version_automatica: se instala sola en las apps que ya tienen
#               actualización automática (0.9.x en adelante; hoy, solo las del equipo). Los médicos
#               con la 0.8.4 no ven nada. La web sigue igual.
#   --a-todos   la marca como la última (la web pasa a bajar esta) y pone latest_version (el aviso
#               con enlace, para todos) y version_automatica (Windows se actualiza solo).
#   --con-mac   incluye a Mac en la actualización automática. ⚠️ SOLO con la firma de Apple: sin ella,
#               cada versión nueva le quita a la app el permiso de Accesibilidad y el dictado deja de
#               pegarse sin que el médico sepa por qué.
#
# Necesita: gh (con acceso a los dos repos) y el CLI de Supabase con el proyecto enlazado.
set -euo pipefail

REPO_APP="nicolas-closelabs/closelabs-voice"
REPO_DESCARGAS="nicolas-closelabs/closelabs-voice-releases"
PROYECTO="gdizmbuzepxnkiahbeoz"
BASE="https://$PROYECTO.supabase.co"

RUN="${1:-}"; shift || true
NOTAS=""; CON_MAC=0; A_TODOS=0; PROBAR=0
while [ $# -gt 0 ]; do
  case "$1" in
    --notas) NOTAS="${2:-}"; shift 2 ;;
    --con-mac) CON_MAC=1; shift ;;
    --a-todos) A_TODOS=1; shift ;;
    --probar) PROBAR=1; shift ;;
    *) echo "Opción desconocida: $1" >&2; exit 1 ;;
  esac
done
[ -n "$RUN" ] || { echo "Uso: $0 <run-id> [--notas texto] [--con-mac] [--probar | --a-todos]" >&2; exit 1; }

DIR="$(mktemp -d)"; trap 'rm -rf "$DIR"' EXIT
echo "== Bajando los instaladores de la corrida $RUN =="
gh run download "$RUN" --repo "$REPO_APP" -n closelabs-voice-macos-universal -D "$DIR/mac"
gh run download "$RUN" --repo "$REPO_APP" -n closelabs-voice-x86_64-pc-windows-msvc -D "$DIR/win"

uno() { # el único archivo que cumple el patrón, o error
  local n; n=$(find "$1" -type f -name "$2" | wc -l | tr -d ' ')
  [ "$n" = "1" ] || { echo "Esperaba 1 archivo '$2' en $1 y hay $n" >&2; exit 1; }
  find "$1" -type f -name "$2"
}
DMG=$(uno "$DIR/mac" "*.dmg")
TGZ=$(uno "$DIR/mac" "*.app.tar.gz")
TGZ_SIG=$(uno "$DIR/mac" "*.app.tar.gz.sig")
EXE=$(uno "$DIR/win" "*-setup.exe")
EXE_SIG=$(uno "$DIR/win" "*-setup.exe.sig")
MSI=$(uno "$DIR/win" "*.msi")

VERSION=$(basename "$EXE" | sed -E 's/.*_([0-9]+\.[0-9]+\.[0-9]+)_x64-setup\.exe/\1/')
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "No pude leer la versión de $(basename "$EXE")" >&2; exit 1; }
echo "Versión: $VERSION"

# Nombres estables (los que enlaza closelabs.co). La firma es del contenido: renombrar no la afecta.
mkdir -p "$DIR/sube"
cp "$EXE" "$DIR/sube/CloseLabs-Voice-Windows.exe"
cp "$MSI" "$DIR/sube/CloseLabs-Voice-Windows.msi"
cp "$DMG" "$DIR/sube/CloseLabs-Voice-Mac.dmg"
cp "$TGZ" "$DIR/sube/CloseLabs-Voice-Mac.app.tar.gz"

echo "== Creando el release v$VERSION en $REPO_DESCARGAS =="
BANDERAS=(--prerelease)
[ "$A_TODOS" = 1 ] && BANDERAS=(--latest)
gh release create "v$VERSION" --repo "$REPO_DESCARGAS" --title "CloseLabs Voice $VERSION" \
  --notes "${NOTAS:-CloseLabs Voice $VERSION}" "${BANDERAS[@]}" "$DIR"/sube/*

URL="https://github.com/$REPO_DESCARGAS/releases/download/v$VERSION"
SK=$(supabase projects api-keys --project-ref "$PROYECTO" -o json 2>/dev/null \
  | python3 -c "import sys,json; print([k['api_key'] for k in json.load(sys.stdin) if k['name']=='service_role'][0])")

echo "== Registrando la versión en la base =="
FILA=$(VERSION="$VERSION" NOTAS="$NOTAS" URL="$URL" CON_MAC="$CON_MAC" EXE_SIG="$EXE_SIG" TGZ_SIG="$TGZ_SIG" python3 - <<'PY'
import json, os
archivos = {"windows-x86_64": {"url": os.environ["URL"] + "/CloseLabs-Voice-Windows.exe",
                               "signature": open(os.environ["EXE_SIG"]).read().strip()}}
if os.environ["CON_MAC"] == "1":
    archivos["darwin-universal"] = {"url": os.environ["URL"] + "/CloseLabs-Voice-Mac.app.tar.gz",
                                    "signature": open(os.environ["TGZ_SIG"]).read().strip()}
print(json.dumps({"version": os.environ["VERSION"], "notas": os.environ["NOTAS"] or None, "archivos": archivos}))
PY
)
curl -sf -X POST "$BASE/rest/v1/versiones" -H "apikey: $SK" -H "authorization: Bearer $SK" \
  -H "content-type: application/json" -H "prefer: resolution=merge-duplicates,return=minimal" \
  -d "$FILA" > /dev/null
echo "Registrada (Windows$( [ "$CON_MAC" = 1 ] && echo " y Mac") en la actualización automática)."

config() { # PATCH a app_config con el JSON dado
  curl -sf -X PATCH "$BASE/rest/v1/app_config?id=eq.true" -H "apikey: $SK" -H "authorization: Bearer $SK" \
    -H "content-type: application/json" -H "prefer: return=minimal" -d "$1" > /dev/null
}
if [ "$A_TODOS" = 1 ]; then
  config "{\"latest_version\":\"$VERSION\",\"version_automatica\":\"$VERSION\"}"
  echo "== v$VERSION ofrecida a todos: la web baja esta versión y las apps la reciben =="
elif [ "$PROBAR" = 1 ]; then
  config "{\"version_automatica\":\"$VERSION\"}"
  echo "== v$VERSION en PRUEBA: se instala sola en las apps 0.9.x (el equipo); la web y la 0.8.4 no cambian =="
else
  echo "== v$VERSION publicada como PRERELEASE: nadie la recibe todavía =="
  echo "   Para probarla con el equipo: update app_config set version_automatica = '$VERSION';"
  echo "   Para todos: gh release edit v$VERSION --repo $REPO_DESCARGAS --prerelease=false --latest"
  echo "               y update app_config set latest_version = '$VERSION', version_automatica = '$VERSION';"
fi

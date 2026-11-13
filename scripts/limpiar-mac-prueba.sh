#!/bin/bash
# Deja un Mac como si nunca hubiera tenido CloseLabs Voice, para probar el primer uso de verdad.
#
#   bash scripts/limpiar-mac-prueba.sh
#
# Borra la app, sus datos, el inicio automático y —lo que faltaba el 2026-11-13— la memoria del
# navegador interno (WebKit), donde la app guarda "ya entró alguien en este computador": sin borrarla,
# la app abre en "Inicia sesión" y salta la bienvenida, aunque todo lo demás esté limpio.
# El registro (~/Library/Logs/com.closelabs.voice) se conserva a propósito: sirve para revisar.
# Los permisos de Accesibilidad y Micrófono los quita la persona en Ajustes del Sistema (no se tocan
# los ajustes de seguridad desde aquí).
set -u
ID="com.closelabs.voice"

osascript -e "tell application id \"$ID\" to quit" >/dev/null 2>&1
sleep 2
pkill -f closelabs-voice 2>/dev/null
sleep 1

for v in /Volumes/CloseLabs*; do
  [ -d "$v" ] && hdiutil detach "$v" -force -quiet
done

rm -rf \
  "/Applications/CloseLabs Voice.app" \
  "$HOME/Applications/CloseLabs Voice.app" \
  "$HOME/Library/Application Support/$ID" \
  "$HOME/Library/WebKit/$ID" \
  "$HOME/Library/Caches/$ID" \
  "$HOME/Library/Caches/closelabs-voice" \
  "$HOME/Library/LaunchAgents/CloseLabs Voice.plist" \
  "$HOME/Library/Saved Application State/$ID.savedState"
rm -f /tmp/com_closelabs_voice_si.sock

echo "Quedó limpio:"
pgrep -fl closelabs-voice >/dev/null && echo "  ⚠️ todavía hay un proceso de CloseLabs Voice" || echo "  sin procesos"
for p in "/Applications/CloseLabs Voice.app" "$HOME/Library/Application Support/$ID" "$HOME/Library/WebKit/$ID"; do
  [ -e "$p" ] && echo "  ⚠️ sigue: $p" || echo "  borrado: $p"
done
echo "Falta (lo haces tú): Ajustes del Sistema › Privacidad y seguridad › Accesibilidad y Micrófono → quitar CloseLabs Voice."

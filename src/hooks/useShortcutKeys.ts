import { useSettings } from "./useSettings";
import { useOsType } from "./useOsType";
import { shortcutKeys } from "../lib/utils/shortcutLabels";

/**
 * El atajo que el médico tiene configurado HOY, escrito como está en su teclado.
 *
 * Lee el atajo real, no el de fábrica: si lo cambió en Configuración, las instrucciones tienen que
 * decir el nuevo. `text` es para frases ("presiona Ctrl + Espacio"); `keys`, para dibujar teclas.
 */
export function useShortcutKeys(id = "transcribe") {
  const { getSetting } = useSettings();
  const os = useOsType();
  const bindings = getSetting("bindings") as
    | Record<string, { current_binding?: string }>
    | undefined;
  const keys = shortcutKeys(bindings?.[id]?.current_binding, os);
  return { keys, text: keys.join(" + "), os };
}

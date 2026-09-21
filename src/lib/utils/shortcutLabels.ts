import type { OSType } from "./keyboard";

/**
 * Cómo se le muestra un atajo al médico, según SU teclado.
 *
 * ⚠️ Existe porque la app le decía a los usuarios de Windows que presionaran "⌥ + Espacio": una
 * tecla que no existe en su teclado. Casi todos los médicos usan Windows, así que lo primero que
 * leían en Instrucciones y en Ayuda estaba mal. Toda pantalla que muestre un atajo debe pasar por
 * aquí (o por `useShortcutKeys`), nunca escribir las teclas a mano.
 */

const MAC: Record<string, string> = {
  option: "⌥",
  alt: "⌥",
  ctrl: "⌃",
  control: "⌃",
  cmd: "⌘",
  command: "⌘",
  super: "⌘",
  meta: "⌘",
  shift: "⇧",
  enter: "↩",
};

// Como vienen impresas en los teclados de Windows en Latinoamérica.
const PC: Record<string, string> = {
  ctrl: "Ctrl",
  control: "Ctrl",
  alt: "Alt",
  option: "Alt",
  shift: "Shift",
  cmd: "Win",
  command: "Win",
  super: "Win",
  meta: "Win",
  enter: "Enter",
};

const COMUNES: Record<string, string> = {
  space: "Espacio",
  escape: "Esc",
  esc: "Esc",
  tab: "Tab",
  backspace: "Borrar",
};

/** Lo que usa la app cuando no hay atajo guardado. Coincide con `default_bindings` en settings.rs. */
function porDefecto(os: OSType): string {
  return os === "macos" ? "option+space" : "ctrl+space";
}

function etiqueta(parte: string, os: OSType): string {
  let base = parte.trim().toLowerCase();
  let lado = "";
  if (base.endsWith("_left")) {
    base = base.slice(0, -5);
    lado = " izquierdo";
  } else if (base.endsWith("_right")) {
    base = base.slice(0, -6);
    lado = " derecho";
  }

  const tabla = os === "macos" ? MAC : PC;
  const nombre =
    tabla[base] ??
    COMUNES[base] ??
    (base.length === 1 || /^f\d{1,2}$/.test(base)
      ? base.toUpperCase()
      : base.charAt(0).toUpperCase() + base.slice(1));
  return nombre + lado;
}

/** "ctrl+space" en Windows → ["Ctrl", "Espacio"]; "option+space" en Mac → ["⌥", "Espacio"]. */
export function shortcutKeys(binding: string | undefined, os: OSType): string[] {
  const combinacion = binding?.trim() || porDefecto(os);
  return combinacion
    .split("+")
    .filter((p) => p.trim())
    .map((p) => etiqueta(p, os));
}

/** El atajo de pegar del sistema, para las instrucciones de "solo copiar". */
export function pasteShortcut(os: OSType): string {
  return os === "macos" ? "⌘ + V" : "Ctrl + V";
}

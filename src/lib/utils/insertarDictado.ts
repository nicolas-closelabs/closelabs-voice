/**
 * Escribe un dictado dentro de la propia app (evento `dictado-en-la-app`).
 *
 * Dentro de nuestra ventana el backend no puede pegar con Cmd+V / Ctrl+V (ver
 * `VENTANA_PRINCIPAL_ENFOCADA` en `clipboard.rs`), así que nos manda el texto y lo escribimos aquí.
 *
 * Destino: el campo donde está el cursor; si el cursor no está en un campo, el marcado con
 * `data-dictado-destino` (el cuadro de "Tu primer dictado"), para que el médico no tenga que
 * acordarse de hacer clic antes. Devuelve `false` si no hubo dónde escribir.
 */

type Campo = HTMLInputElement | HTMLTextAreaElement;

function esCampoEditable(el: Element | null): el is Campo {
  if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled;
  if (el instanceof HTMLInputElement) {
    const tipos = ["text", "search", "email", "url", "tel", ""];
    return tipos.includes(el.type) && !el.readOnly && !el.disabled;
  }
  return false;
}

export function insertarDictado(texto: string): boolean {
  const activo = document.activeElement;
  const destino = esCampoEditable(activo)
    ? activo
    : document.querySelector<Campo>("[data-dictado-destino]");
  if (!destino || !esCampoEditable(destino)) return false;

  destino.focus();
  // execCommand respeta el cursor, deja deshacer con Cmd+Z y dispara el evento `input` que React
  // escucha. Está marcado como obsoleto pero lo soportan WebKit (Mac) y WebView2 (Windows).
  if (document.execCommand("insertText", false, texto)) return true;

  // Respaldo: escribir el valor con el setter nativo para que React vea el cambio.
  const inicio = destino.selectionStart ?? destino.value.length;
  const fin = destino.selectionEnd ?? destino.value.length;
  const nuevo = destino.value.slice(0, inicio) + texto + destino.value.slice(fin);
  const proto = destino instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(destino, nuevo);
  destino.setSelectionRange(inicio + texto.length, inicio + texto.length);
  destino.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
}

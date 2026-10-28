import { create } from "zustand";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { platform } from "@tauri-apps/plugin-os";

/**
 * Actualización automática (ver ACTUALIZACIONES.md).
 *
 * El servidor dice si hay versión nueva PARA ESTE COMPUTADOR (función `update`). Si la hay, se baja
 * en segundo plano y queda "lista": el médico ve un aviso y un botón en el pie de la ventana, y se
 * instala cuando él toca "Reiniciar ahora".
 *
 * Desde el 2026-10-28, en Windows también se instala SOLA, pero solo al arrancar y si nadie la está
 * usando (ver `puedeInstalarSola`): el computador se prende en la mañana, la app arranca oculta y
 * se actualiza antes del primer dictado. La regla de siempre se mantiene: nunca a mitad de una
 * consulta.
 *
 * Si no la hay —Mac hasta tener la firma de Apple, o una versión publicada sin archivos para esta
 * plataforma—, `buscar` devuelve `false` y la app muestra el aviso de siempre con el enlace de
 * descarga.
 *
 * La firma de lo que se baja la comprueba el updater de Tauri con nuestra llave pública
 * (`plugins.updater.pubkey`): si no coincide, no se instala nada.
 */
type Estado = "nada" | "descargando" | "lista" | "instalando";

/** Pasado esto desde que arrancó la app, ya no se instala sola: puede haber un paciente delante. */
const VENTANA_ARRANQUE_MS = 15 * 60_000;
const ARRANQUE = Date.now();
let huboDictado = false;
// El overlay avisa cada vez que empieza una grabación; el evento llega a todas las ventanas.
void listen<string>("show-overlay", (e) => {
  if (e.payload === "recording" || e.payload === "streaming") huboDictado = true;
});

/**
 * ¿Se puede instalar sin preguntarle al médico? Solo si se cumplen TODAS:
 * - Windows. En Mac, sin la firma de Apple, cada versión le quita el permiso de Accesibilidad: si
 *   se instalara sola, el médico amanecería sin poder pegar y sin saber por qué.
 * - La app arrancó hace menos de `VENTANA_ARRANQUE_MS`.
 * - No se ha dictado desde que arrancó.
 * - La ventana está cerrada (así arranca con el computador). Si el médico la tiene abierta, la está
 *   usando: se le deja el botón.
 */
export async function puedeInstalarSola(): Promise<boolean> {
  if (platform() !== "windows") return false;
  if (huboDictado) return false;
  if (Date.now() - ARRANQUE > VENTANA_ARRANQUE_MS) return false;
  try {
    return !(await getCurrentWindow().isVisible());
  } catch {
    return false;
  }
}

interface ActualizacionState {
  estado: Estado;
  version: string | null;
  notas: string | null;
  update: Update | null;
  /** `true` si la actualización automática se encarga (descargando o lista). */
  buscar: () => Promise<boolean>;
  instalar: () => Promise<void>;
}

export const useActualizacion = create<ActualizacionState>((set, get) => ({
  estado: "nada",
  version: null,
  notas: null,
  update: null,

  buscar: async () => {
    if (get().estado !== "nada") return true;
    let update: Update | null;
    try {
      update = await check();
    } catch (e) {
      console.warn("No se pudo buscar actualización:", e);
      return false;
    }
    if (!update) return false;

    set({ estado: "descargando", version: update.version, notas: update.body ?? null });
    try {
      await update.download();
      set({ estado: "lista", update });
      return true;
    } catch (e) {
      // Se cayó la descarga: que vuelva a intentarlo en la próxima revisión (cada pocas horas).
      console.warn("No se pudo descargar la actualización:", e);
      set({ estado: "nada", version: null, notas: null });
      return false;
    }
  },

  instalar: async () => {
    const { update } = get();
    if (!update) return;
    set({ estado: "instalando" });
    try {
      // En Windows el instalador cierra la app y la vuelve a abrir. En Mac se reemplaza y se reabre.
      await update.install();
      await relaunch();
    } catch (e) {
      set({ estado: "lista" });
      throw e;
    }
  },
}));

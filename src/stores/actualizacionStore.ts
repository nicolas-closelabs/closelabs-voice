import { create } from "zustand";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

/**
 * Actualización automática (ver ACTUALIZACIONES.md).
 *
 * El servidor dice si hay versión nueva PARA ESTE COMPUTADOR (función `update`). Si la hay, se baja
 * en segundo plano y queda "lista": el médico ve un aviso y un botón en el pie de la ventana, y se
 * instala **solo cuando él toca "Reiniciar ahora"**. Nunca se instala sola: podría estar en plena
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

/* eslint-disable i18next/no-literal-string */
import React, { useEffect, useState } from "react";
import { platform } from "@tauri-apps/plugin-os";
import { BotonSecundario } from "./tinta/Botones";

/**
 * Video "Así se dicta" (40 s, sin sonido): clic en el campo, ⌥/Ctrl + Espacio, hablar, presionar otra
 * vez, el texto limpio y el Diccionario. Pedido de Nicolás (2026-11-12). Fuente:
 * `diseno/video/como-funciona.html`, grabado con `diseno/herramientas/grabar-video.mjs`; hay una
 * versión por sistema porque el atajo y las ventanas cambian.
 *
 * Cualquier pantalla lo abre con `window.dispatchEvent(new Event(ABRIR_VIDEO_TUTORIAL))`; App lo monta
 * una sola vez.
 */
export const ABRIR_VIDEO_TUTORIAL = "clv:abrir-video-tutorial";

export const VideoComoFunciona: React.FC = () => {
  const [abierto, setAbierto] = useState(false);
  const esWindows = (() => {
    try {
      return platform() === "windows";
    } catch {
      return false;
    }
  })();

  useEffect(() => {
    const abrir = () => setAbierto(true);
    window.addEventListener(ABRIR_VIDEO_TUTORIAL, abrir);
    return () => window.removeEventListener(ABRIR_VIDEO_TUTORIAL, abrir);
  }, []);

  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [abierto]);

  if (!abierto) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Así se dicta"
      className="fixed inset-0 z-50 flex items-center justify-center bg-tinta/55 p-8"
      onClick={() => setAbierto(false)}
    >
      <div
        className="w-full max-w-[880px] rounded-[16px] bg-papel shadow-2 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <video
          src={esWindows ? "/guias/como-funciona-win.mp4" : "/guias/como-funciona-mac.mp4"}
          autoPlay
          controls
          playsInline
          muted
          className="block w-full aspect-[16/10] bg-lino"
        />
        <div className="flex items-center justify-between gap-6 px-6 py-4">
          <p className="text-[16px] text-tinta-2">
            Funciona en cualquier programa: la historia clínica, WhatsApp, el correo.
          </p>
          <BotonSecundario medida="corto" onClick={() => setAbierto(false)}>
            Cerrar
          </BotonSecundario>
        </div>
      </div>
    </div>
  );
};

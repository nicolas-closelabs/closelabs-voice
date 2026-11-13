/* eslint-disable i18next/no-literal-string */
import React from "react";
import { platform } from "@tauri-apps/plugin-os";
import { Titulo, Apoyo } from "../../tinta/Titulo";
import { Enlace } from "../../tinta/Botones";
import { ABRIR_PRIMER_DICTADO } from "../../onboarding/PrimerDictado";

/**
 * "Cómo funciona": sección propia del menú con el video "Así se dicta" (Nicolás, 2026-11-13: "el
 * video debe tener un apartado único"). 40 s sin sonido; una versión por sistema porque el atajo y
 * las ventanas cambian. Fuente: `diseno/video/como-funciona.html` (ver public/guias/README.txt).
 */
export const ComoFunciona: React.FC = () => {
  const esWindows = (() => {
    try {
      return platform() === "windows";
    } catch {
      return false;
    }
  })();

  return (
    <div>
      <Titulo>Cómo *funciona*</Titulo>
      <Apoyo className="mt-2">
        Cuarenta segundos: cómo dictar y cómo usar el Diccionario.
      </Apoyo>
      <video
        src={esWindows ? "/guias/como-funciona-win.mp4" : "/guias/como-funciona-mac.mp4"}
        autoPlay
        controls
        playsInline
        muted
        className="mt-7 block w-full aspect-[16/10] rounded-[16px] border border-linea shadow-2 bg-lino"
      />
      <p className="mt-5 text-[16px] text-tinta-2">
        Funciona en cualquier programa: la historia clínica, WhatsApp, el correo.{" "}
        <Enlace onClick={() => window.dispatchEvent(new Event(ABRIR_PRIMER_DICTADO))}>
          Hacer un dictado de prueba
        </Enlace>
      </p>
    </div>
  );
};

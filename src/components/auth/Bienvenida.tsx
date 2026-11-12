/* eslint-disable i18next/no-literal-string */
import React, { useState } from "react";
import { Mic } from "lucide-react";
import Logo from "../icons/Logo";

/**
 * Bienvenida: lo primero que ve quien abre la app por primera vez en este computador.
 *
 * Por qué existe (plan del primer uso aprobado por Nicolás, 2026-11-11): antes la app abría
 * directo en un formulario. El médico de 55 años que acaba de instalar algo que le recomendaron
 * todavía no sabe qué hace la app; ver en 10 segundos a alguien dictando y el texto apareciendo
 * convence más que cualquier frase, y le dice qué va a pasar después del registro.
 *
 * El video vive en `public/guias/bienvenida.mp4` (sin sonido, en bucle). Mientras no exista, se ve
 * una tarjeta quieta con la misma idea: el texto en un campo y el micrófono.
 */
const VIDEO = "/guias/bienvenida.mp4";

export const Bienvenida: React.FC<{
  onEmpezar: () => void;
  onYaTengoCuenta: () => void;
}> = ({ onEmpezar, onYaTengoCuenta }) => {
  const [hayVideo, setHayVideo] = useState(false);
  return (
    <div className="h-screen overflow-y-auto flex px-8 py-6 select-none">
      <div className="m-auto w-full max-w-md flex flex-col items-center text-center gap-5">
        <Logo width={150} />
        <h1 className="font-heading text-[26px] font-bold leading-tight">
          Escribe tus historias clínicas hablando
        </h1>

        <video
          src={VIDEO}
          autoPlay
          loop
          muted
          playsInline
          onLoadedData={() => setHayVideo(true)}
          onError={() => setHayVideo(false)}
          className={
            hayVideo
              ? "w-full rounded-2xl border border-brand-border shadow-sm"
              : "hidden"
          }
          aria-label="Video: un médico dicta y el texto aparece en la historia clínica"
        />
        {!hayVideo && <Ilustracion />}

        <p className="text-[18px] leading-relaxed text-brand-text-secondary">
          Hablas, y el texto aparece donde tengas el cursor, con puntos y comas.
          En 5 minutos estás dictando.
        </p>

        <button
          type="button"
          autoFocus
          onClick={onEmpezar}
          className="w-full px-4 py-3.5 rounded-xl text-[18px] font-semibold bg-brand-accent text-white hover:bg-brand-accent-secondary transition-colors"
        >
          Empezar
        </button>
        <button
          type="button"
          onClick={onYaTengoCuenta}
          className="text-[16px] text-brand-text-secondary hover:text-brand-accent hover:underline"
        >
          Ya tengo una cuenta
        </button>
      </div>
    </div>
  );
};

/** La idea del video, quieta: un campo de la historia clínica con el dictado y el micrófono. */
const Ilustracion: React.FC = () => (
  <div className="w-full rounded-2xl border border-brand-border bg-brand-surface p-4 flex flex-col gap-3 text-left">
    <div className="text-[13px] font-semibold uppercase tracking-wide text-brand-text-muted">
      Historia clínica · Motivo de consulta
    </div>
    <div className="rounded-xl border-2 border-brand-accent bg-white px-4 py-3 text-[16px] leading-relaxed">
      Paciente de 45 años con dolor abdominal de tres días, sin fiebre.
      <span className="inline-block w-0.5 h-5 align-middle ml-0.5 bg-brand-accent animate-pulse" />
    </div>
    <div className="self-center inline-flex items-center gap-2 rounded-full bg-[#17161C] px-4 py-2 text-white text-[14px]">
      <Mic className="w-4 h-4 text-brand-accent" />
      Te escucho…
    </div>
  </div>
);

export default Bienvenida;

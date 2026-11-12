/* eslint-disable i18next/no-literal-string */
import React, { useState } from "react";

/**
 * Campos de «Tinta y voz» (diseno/SISTEMA.md §9). La etiqueta va siempre ARRIBA y visible: solo con
 * el texto gris de adentro, al empezar a escribir ya no se sabe qué era cada casilla.
 * ⚠️ Los formularios llevan `noValidate`: los mensajes son nuestros y en español (el navegador
 * decía "Fill out this field").
 */

export const CLASE_CAMPO =
  "w-full h-[50px] px-4 rounded-[12px] border-[1.5px] border-linea-fuerte bg-papel text-[17px] text-tinta placeholder:text-tinta-3 focus:outline-none focus:border-tinta focus:shadow-[0_0_0_3px_var(--foco)] disabled:bg-tarjeta-cab disabled:text-tinta-3 transition-[border-color,box-shadow] duration-150 select-text";

export const Campo: React.FC<
  React.InputHTMLAttributes<HTMLInputElement> & {
    id: string;
    etiqueta: string;
    /** Algo a la derecha del renglón de la etiqueta ("Mostrar"). */
    accesorio?: React.ReactNode;
    error?: string | null;
  }
> = ({ id, etiqueta, accesorio, error, className = "", ...resto }) => (
  <div className="flex flex-col gap-1.5 text-left">
    <div className="flex items-baseline justify-between">
      <label htmlFor={id} className="text-[15px] leading-[22px] font-semibold text-tinta">
        {etiqueta}
      </label>
      {accesorio}
    </div>
    <input
      id={id}
      className={`${CLASE_CAMPO} ${error ? "border-error" : ""} ${className}`}
      aria-invalid={Boolean(error)}
      {...resto}
    />
    {error && (
      <p role="alert" className="text-[15px] leading-[22px] text-error">
        {error}
      </p>
    )}
  </div>
);

/** Contraseña con "Mostrar" en el renglón de la etiqueta: escribir a ciegas es donde más se equivoca quien teclea despacio. */
export const CampoClave: React.FC<
  Omit<React.ComponentProps<typeof Campo>, "type" | "accesorio">
> = (props) => {
  const [visible, setVisible] = useState(false);
  return (
    <Campo
      {...props}
      type={visible ? "text" : "password"}
      accesorio={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="text-[15px] font-semibold text-tinta underline underline-offset-4 decoration-linea-fuerte hover:decoration-tinta"
        >
          {visible ? "Ocultar" : "Mostrar"}
        </button>
      }
    />
  );
};

/** Casilla de 22 px: vacía con borde, marcada en tinta con visto blanco. */
export const Casilla: React.FC<{
  id: string;
  marcada: boolean;
  onCambio: (v: boolean) => void;
  disabled?: boolean;
  children: React.ReactNode;
}> = ({ id, marcada, onCambio, disabled, children }) => (
  <label
    htmlFor={id}
    className="flex items-start gap-3 text-[15px] leading-[22px] text-tinta-2 cursor-pointer text-left"
  >
    <input
      id={id}
      type="checkbox"
      checked={marcada}
      onChange={(e) => onCambio(e.target.checked)}
      disabled={disabled}
      className="peer sr-only"
    />
    <span
      aria-hidden
      className={`mt-0 grid place-items-center w-[22px] h-[22px] shrink-0 rounded-[6px] border-[1.5px] transition-colors peer-focus-visible:shadow-[0_0_0_3px_var(--foco)] ${
        marcada ? "bg-tinta border-tinta" : "bg-papel border-linea-fuerte"
      }`}
    >
      {marcada && (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
          <path
            d="M5 12.5l4.5 4.5L19 7.5"
            stroke="#fff"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </span>
    <span>{children}</span>
  </label>
);

/** Aviso amable: qué pasó y qué hacer, sin rojo (fondo ámbar suave). */
export const Aviso: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = "",
}) => (
  <div
    role="alert"
    className={`rounded-[12px] bg-aviso-fondo text-aviso text-[16px] leading-[24px] px-[18px] py-[14px] text-left ${className}`}
  >
    {children}
  </div>
);

/** Interruptor de 52 × 30: encendido en tinta (nunca lila). */
export const Interruptor: React.FC<{
  encendido: boolean;
  onCambio: (v: boolean) => void;
  etiqueta: string;
  disabled?: boolean;
}> = ({ encendido, onCambio, etiqueta, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={encendido}
    aria-label={etiqueta}
    disabled={disabled}
    onClick={() => onCambio(!encendido)}
    className={`relative w-[52px] h-[30px] shrink-0 rounded-[15px] transition-colors duration-150 focus:outline-none focus-visible:shadow-[0_0_0_3px_var(--foco)] disabled:opacity-50 ${
      encendido ? "bg-tinta" : "bg-linea-fuerte"
    }`}
  >
    <span
      className={`absolute top-[3px] w-6 h-6 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,.2)] transition-[left] duration-150 ${
        encendido ? "left-[25px]" : "left-[3px]"
      }`}
    />
  </button>
);

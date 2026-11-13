/* eslint-disable i18next/no-literal-string */
import React from "react";
import { Loader2 } from "lucide-react";

/**
 * Botones y enlaces de «Tinta y voz» (diseno/SISTEMA.md §9).
 *
 * ⚠️ Un solo botón principal (lila) por vista. Un segundo botón es siempre secundario (contorno).
 * Los enlaces son de tinta con subrayado, nunca lila.
 *
 * Letra (Nicolás, 2026-11-12, opción D): los BOTONES van en Newsreader, 500, dos puntos más grandes
 * que la sans de antes (la serif se lee más chica); los enlaces siguen en la sans (Schibsted).
 */

const TRANSICION = "transition-colors duration-150 ease-[cubic-bezier(.2,.8,.2,1)]";
const FOCO =
  "focus:outline-none focus-visible:shadow-[0_0_0_3px_var(--foco)]";

type BotonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  /** `completo`: alto 56 y todo el ancho (primer uso). `corto`: alto 44, dentro de un renglón. */
  medida?: "completo" | "normal" | "corto";
  ocupado?: boolean;
};

function medidas(medida: BotonProps["medida"]): string {
  if (medida === "corto") return "h-11 px-5 text-[18px] rounded-[12px]";
  if (medida === "normal") return "h-14 px-7 text-[19px] rounded-[12px]";
  return "h-14 w-full px-7 text-[19px] rounded-[12px]";
}

export const BotonPrincipal: React.FC<BotonProps> = ({
  medida = "completo",
  ocupado,
  disabled,
  className = "",
  children,
  type = "button",
  ...resto
}) => (
  <button
    type={type}
    disabled={disabled || ocupado}
    className={`inline-flex items-center justify-center gap-2 font-serif font-medium bg-lila text-white hover:bg-lila-hover active:bg-lila-presion disabled:bg-linea disabled:text-tinta-3 disabled:cursor-not-allowed ${medidas(medida)} ${TRANSICION} ${FOCO} ${className}`}
    {...resto}
  >
    {ocupado && <Loader2 className="w-5 h-5 animate-spin" />}
    {children}
  </button>
);

export const BotonSecundario: React.FC<
  BotonProps & { peligro?: boolean }
> = ({
  medida = "completo",
  ocupado,
  peligro,
  disabled,
  className = "",
  children,
  type = "button",
  ...resto
}) => (
  <button
    type={type}
    disabled={disabled || ocupado}
    className={`inline-flex items-center justify-center gap-2 font-serif font-medium bg-papel border-[1.5px] hover:bg-lino disabled:opacity-50 disabled:cursor-not-allowed ${
      peligro ? "text-error border-error-borde" : "text-tinta border-linea-fuerte"
    } ${medidas(medida)} ${TRANSICION} ${FOCO} ${className}`}
    {...resto}
  >
    {ocupado && <Loader2 className="w-5 h-5 animate-spin" />}
    {children}
  </button>
);

/** Enlace de tinta con subrayado (16 px en el pie y las notas; 15 px dentro de un renglón). */
export const Enlace: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    chico?: boolean;
    oscuro?: boolean;
  }
> = ({ chico, oscuro, className = "", children, type = "button", ...resto }) => (
  <button
    type={type}
    className={`font-semibold underline underline-offset-4 decoration-1 disabled:opacity-50 ${
      oscuro
        ? "text-white decoration-white/40 hover:decoration-white"
        : "text-tinta decoration-linea-fuerte hover:decoration-tinta"
    } ${chico ? "text-[15px]" : "text-[16px]"} ${TRANSICION} ${FOCO} rounded-sm ${className}`}
    {...resto}
  >
    {children}
  </button>
);

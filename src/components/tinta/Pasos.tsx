/* eslint-disable i18next/no-literal-string */
import React from "react";

/**
 * Lista de pasos (permisos, instalación) con su marca de 28 px (diseno/SISTEMA.md §9):
 * pendiente (borde gris), toca ahora (borde tinta), en curso (borde lila girando), hecho (relleno
 * verde con visto y "Listo" a la derecha).
 */
export type EstadoPaso = "pendiente" | "ahora" | "en-curso" | "hecho";

export const Marca: React.FC<{ estado: EstadoPaso }> = ({ estado }) => {
  if (estado === "hecho") {
    return (
      <span className="grid place-items-center w-7 h-7 shrink-0 rounded-full bg-hecho">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M5 12.5l4.5 4.5L19 7.5"
            stroke="#fff"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }
  if (estado === "en-curso") {
    return (
      <span
        aria-hidden
        className="w-7 h-7 shrink-0 rounded-full border-2 border-lila border-r-transparent animate-[spin_900ms_linear_infinite]"
      />
    );
  }
  return (
    <span
      aria-hidden
      className={`w-7 h-7 shrink-0 rounded-full border-2 ${
        estado === "ahora" ? "border-tinta" : "border-linea-fuerte"
      }`}
    />
  );
};

export interface Paso {
  nombre: string;
  frase?: string;
  estado: EstadoPaso;
}

/**
 * `conectarActual`: el paso de ahora se ata al escenario de la derecha (fondo lila suave, "Mira cómo →"
 * y una línea lila hasta el borde de la columna), para que el médico mire la guía viva de Permisos.
 */
export const ListaPasos: React.FC<{
  pasos: Paso[];
  compacta?: boolean;
  conectarActual?: boolean;
}> = ({ pasos, compacta, conectarActual }) => (
  <ul className="border-t border-linea">
    {pasos.map((p) => {
      const conectado =
        conectarActual && (p.estado === "ahora" || p.estado === "en-curso");
      return (
      <li
        key={p.nombre}
        className={`relative flex items-center gap-4 border-b border-linea ${
          compacta ? "py-3.5" : "py-[18px]"
        } ${
          conectado
            ? "bg-gradient-to-r from-transparent to-lila-suave after:content-[''] after:absolute after:top-1/2 after:left-full after:h-[2px] after:w-10 min-[1120px]:after:w-14 after:bg-lila"
            : ""
        }`}
      >
        <Marca estado={p.estado} />
        <div className="flex-1 min-w-0">
          <div
            className={`text-[17px] leading-6 ${
              p.estado === "pendiente"
                ? "text-tinta-3 font-medium"
                : "text-tinta font-semibold"
            }`}
          >
            {p.nombre}
            {p.estado === "en-curso" && "…"}
          </div>
          {p.frase && (
            <div className="text-[15px] leading-[22px] text-tinta-2">
              {p.frase}
            </div>
          )}
        </div>
        {p.estado === "hecho" && (
          <span className="text-[15px] font-semibold text-hecho">Listo</span>
        )}
        {conectado && (
          <span className="mr-3.5 shrink-0 text-[14px] font-semibold text-lila whitespace-nowrap">
            Mira cómo →
          </span>
        )}
      </li>
      );
    })}
  </ul>
);

export default ListaPasos;

/* eslint-disable i18next/no-literal-string */
import React from "react";

/**
 * Tecla dibujada (diseno/SISTEMA.md §9). Las teclas salen SIEMPRE de `useShortcutKeys`: nunca se
 * escriben a mano (la app le decía "⌥ + Espacio" a usuarios de Windows).
 *
 * Tamaños: `linea` (36 de alto, dentro de un texto), `inicio` (46), `grande` (112, la prueba del
 * atajo), `oscura` (26, sobre la píldora). Presionada: fondo lila y baja 5 px.
 */
type Medida = "linea" | "inicio" | "grande" | "oscura";

const ESTILO: Record<Medida, string> = {
  linea:
    "h-9 min-w-9 px-2.5 text-[16px] rounded-[9px] border-[1.5px] border-b-[3.5px]",
  inicio:
    "h-[46px] min-w-[46px] px-3 text-[20px] rounded-[11px] border-[1.5px] border-b-[3.5px]",
  grande:
    "h-[112px] min-w-[112px] px-[34px] text-[30px] rounded-[22px] border-2 border-b-[8px]",
  oscura:
    "h-[26px] min-w-[26px] px-2 text-[14px] rounded-[7px] border bg-white/14 border-white/30 text-white",
};

export const Tecla: React.FC<{
  children: React.ReactNode;
  medida?: Medida;
  presionada?: boolean;
}> = ({ children, medida = "linea", presionada }) => (
  <kbd
    className={`inline-flex items-center justify-center font-sans font-semibold align-middle transition-all duration-150 ease-[cubic-bezier(.2,.8,.2,1)] ${
      ESTILO[medida]
    } ${
      medida === "oscura"
        ? ""
        : presionada
          ? "bg-lila border-lila-presion text-white translate-y-[5px] !border-b-[3px]"
          : "bg-papel border-linea-fuerte text-tinta"
    }`}
  >
    {children}
  </kbd>
);

/** Varias teclas con "+" entre ellas. */
export const Teclas: React.FC<{
  keys: string[];
  medida?: Medida;
  /** Índices de las teclas presionadas ahora (la prueba del atajo). */
  presionadas?: boolean[];
}> = ({ keys, medida = "linea", presionadas }) => (
  <span
    className={`inline-flex items-center align-middle ${
      medida === "grande" ? "gap-[18px]" : "gap-[5px]"
    }`}
  >
    {keys.map((k, i) => (
      <React.Fragment key={i}>
        {i > 0 && (
          <span
            className={`font-medium ${
              medida === "oscura" ? "text-white/60" : "text-tinta-3"
            } ${medida === "grande" ? "text-[30px]" : ""}`}
          >
            +
          </span>
        )}
        <Tecla medida={medida} presionada={presionadas?.[i]}>
          {k}
        </Tecla>
      </React.Fragment>
    ))}
  </span>
);

export default Teclas;

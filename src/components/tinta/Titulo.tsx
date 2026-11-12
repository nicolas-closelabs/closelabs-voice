/* eslint-disable i18next/no-literal-string */
import React from "react";

/**
 * Título en serif con UNA palabra en cursiva y en lila (diseno/SISTEMA.md §2 y §5).
 *
 * El texto marca la palabra con asteriscos: "Escribe tus historias *hablando*." Así cada pantalla
 * escribe su título como se lee, y la regla de "una sola palabra en cursiva" queda en un solo
 * sitio. Sobre fondo oscuro (la recompensa) la cursiva va en `lila-claro`.
 */
export function conCursiva(texto: string, oscuro = false): React.ReactNode[] {
  return texto.split(/(\*[^*]+\*)/g).map((parte, i) =>
    parte.startsWith("*") && parte.endsWith("*") ? (
      <em
        key={i}
        className={`italic ${oscuro ? "text-lila-claro" : "text-lila"}`}
      >
        {parte.slice(1, -1)}
      </em>
    ) : (
      <React.Fragment key={i}>{parte}</React.Fragment>
    ),
  );
}

export const Titulo: React.FC<{
  children: string;
  oscuro?: boolean;
  /** `titulo` (40/46) por defecto; `vacio` (28/34) para estados vacíos. */
  tamano?: "titulo" | "vacio";
  className?: string;
}> = ({ children, oscuro, tamano = "titulo", className = "" }) => (
  <h1
    className={`font-serif font-medium ${
      tamano === "vacio"
        ? "text-[28px] leading-[34px]"
        : "text-[40px] leading-[46px] tracking-[-0.015em]"
    } ${oscuro ? "text-white" : "text-tinta"} ${className}`}
  >
    {conCursiva(children, oscuro)}
  </h1>
);

/** La línea de apoyo bajo el título (18/28, `tinta-2`). */
export const Apoyo: React.FC<{
  children: React.ReactNode;
  oscuro?: boolean;
  className?: string;
}> = ({ children, oscuro, className = "" }) => (
  <p
    className={`text-[18px] leading-[28px] ${
      oscuro ? "text-white/72" : "text-tinta-2"
    } ${className}`}
  >
    {children}
  </p>
);

export default Titulo;

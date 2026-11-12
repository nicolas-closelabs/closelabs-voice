import React from "react";

interface SettingsGroupProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
}

/**
 * Un grupo de renglones del uso diario («Tinta y voz», diseno/SISTEMA.md §9): encabezado pequeño
 * en `tinta-3` con una línea debajo, y renglones separados por líneas. Sin tarjetas: "Tarjetas en las
 * páginas del uso diario" está en la lista "Nunca" del sistema.
 */
export const SettingsGroup: React.FC<SettingsGroupProps> = ({
  title,
  description,
  children,
}) => {
  return (
    <section className="mt-6 first:mt-[18px]">
      {title && (
        <div className="pb-2.5 border-b border-linea">
          <h2 className="font-sans text-[14px] leading-5 font-semibold text-tinta-3">
            {title}
          </h2>
          {description && (
            <p className="text-[15px] leading-[22px] text-tinta-2 mt-1">
              {description}
            </p>
          )}
        </div>
      )}
      <div className="divide-y divide-linea border-b border-linea">{children}</div>
    </section>
  );
};

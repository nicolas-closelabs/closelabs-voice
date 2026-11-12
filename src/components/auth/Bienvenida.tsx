/* eslint-disable i18next/no-literal-string */
import React from "react";
import PlantillaPrimerUso from "../tinta/PlantillaPrimerUso";

/**
 * Bienvenida: lo primero que ve quien abre la app por primera vez en este computador.
 *
 * Por qué existe (plan del primer uso, 2026-11-11): antes la app abría directo en un formulario. El
 * médico de 55 años que acaba de instalar algo que le recomendaron todavía no sabe qué hace la app;
 * una frase y el dibujo de la voz volviéndose renglón le dicen qué va a pasar.
 *
 * Diseño «Tinta y voz» (diseno/SISTEMA.md §7, pantalla 1). El dibujo es el mismo de "Instalando":
 * al pasar de una a otra solo cambia la columna de texto.
 */
export const Bienvenida: React.FC<{
  onEmpezar: () => void;
  onYaTengoCuenta: () => void;
}> = ({ onEmpezar, onYaTengoCuenta }) => (
  <PlantillaPrimerUso
    clave="bienvenida"
    titulo="Escribe tus historias *hablando*."
    apoyo="Tú hablas. El texto aparece donde tengas el cursor, con sus puntos y sus comas."
    principal={{ texto: "Crear mi cuenta", onClick: onEmpezar }}
    enlace={{ texto: "Ya tengo una cuenta", onClick: onYaTengoCuenta }}
    escenario={<IlustracionVoz />}
  />
);

export const IlustracionVoz: React.FC = () => (
  <img
    src="/ilustraciones/voz-a-texto.svg"
    alt=""
    width={520}
    height={400}
    className="max-w-full h-auto"
    draggable={false}
  />
);

export default Bienvenida;

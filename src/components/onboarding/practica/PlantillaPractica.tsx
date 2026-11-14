/* eslint-disable i18next/no-literal-string */
import React from "react";
import { ArrowLeft } from "lucide-react";
import { BarraPrimerUso } from "../../tinta/PlantillaPrimerUso";
import { BotonPrincipal, Enlace } from "../../tinta/Botones";

/**
 * La plantilla de las prácticas: «arriba tu pantalla, abajo tu voz» (diseno/maquetas/practicas-v2.html,
 * diseño de Fable aprobado por Nicolás el 2026-11-13). Es la única excepción a la plantilla de
 * columna + escenario (diseno/SISTEMA.md §6):
 *
 *   barra (64): la misma de todo el primer uso
 *   franja de lino (316): ← Atrás · Práctica n de 3 · el programa del médico (donde hace clic)
 *   papel: UN renglón de guía y, cuando toca, la frase; abajo, el enlace a la izquierda y el botón
 *          a la derecha (el botón solo existe en el resultado: nunca hay un botón apagado)
 *
 * Por qué: con la columna de instrucciones a la izquierda y la tarjeta a la derecha, el médico no
 * entendía qué hacer (walkthrough del 2026-11-13: "está difícil de entender qué tengo que hacer").
 * Aquí las dos franjas nunca cambian de papel y en cada momento hay una sola cosa viva.
 */
export const PlantillaPractica: React.FC<{
  numero: number;
  total: number;
  atras: () => void;
  programa: React.ReactNode;
  /** Cambia con cada momento de la práctica, para la animación de entrada del renglón. */
  clave: string;
  children: React.ReactNode;
  enlace: { texto: string; onClick: () => void };
  boton?: { texto: string; onClick: () => void };
  mensajeAyuda: string;
}> = ({
  numero,
  total,
  atras,
  programa,
  clave,
  children,
  enlace,
  boton,
  mensajeAyuda,
}) => {
  const columna = "w-[760px] max-w-[calc(100%-64px)] mx-auto";
  return (
    <div className="h-screen w-screen flex items-center justify-center select-none cursor-default bg-papel">
      <div className="w-full h-full max-w-[1280px] max-h-[760px] flex flex-col">
        <BarraPrimerUso etapa="practica" mensajeAyuda={mensajeAyuda} />

        {/* ---- Arriba: tu pantalla ---- */}
        <section className="h-[316px] shrink-0 bg-lino pt-5">
          <div className={columna}>
            <div className="flex items-center justify-between text-[15px] leading-5 font-semibold">
              <button
                type="button"
                onClick={atras}
                className="inline-flex items-center gap-1.5 text-tinta-2 hover:text-tinta"
              >
                <ArrowLeft className="w-4 h-4" />
                Atrás
              </button>
              <span className="font-medium text-tinta-3">
                Práctica {numero} de {total}
              </span>
            </div>
            {programa}
          </div>
        </section>

        {/* ---- Abajo: tu voz ---- */}
        <section className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div
              key={clave}
              className={`${columna} pt-7 pb-2 animate-[entrar_240ms_cubic-bezier(.2,.8,.2,1)]`}
            >
              {children}
            </div>
          </div>
          <div className="shrink-0 pb-6 pt-2">
            <div
              className={`${columna} h-14 flex items-center justify-between`}
            >
              <Enlace onClick={enlace.onClick}>{enlace.texto}</Enlace>
              {boton && (
                <BotonPrincipal
                  medida="normal"
                  onClick={boton.onClick}
                  className="min-w-[260px] animate-[entrar_240ms_cubic-bezier(.2,.8,.2,1)]"
                >
                  {boton.texto}
                </BotonPrincipal>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default PlantillaPractica;

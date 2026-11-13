/* eslint-disable i18next/no-literal-string */
import React from "react";
import { ArrowLeft } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { supportWhatsappUrl } from "../../branding";
import { useOsType } from "../../hooks/useOsType";
import Logo from "../icons/Logo";
import { Apoyo, Titulo } from "./Titulo";
import { BotonPrincipal, Enlace } from "./Botones";

/**
 * La plantilla de TODAS las pantallas del primer uso (diseno/SISTEMA.md §6).
 *
 * Por qué una sola: en la revisión del 2026-11-11 cada pantalla tenía otra estructura (el logo en
 * cinco tamaños, el botón en distintos lugares, la ventana moviéndose) y parecían varias apps. Aquí
 * la barra superior, el logo de 132 px, las etapas, la columna de texto, el escenario y el botón
 * abajo no cambian nunca de lugar; entre pantallas solo cambia el contenido.
 *
 *   barra (64): logo · etapas · ¿Necesitas ayuda?
 *   columna (500, papel): ← Atrás · título · apoyo · contenido · [botón principal] · enlace
 *   escenario (lino): una ilustración o una tarjeta, centrada
 */

export type Etapa = "cuenta" | "permisos" | "prueba" | "practica";

const NOMBRES: Record<Etapa, string> = {
  cuenta: "Cuenta",
  permisos: "Permisos",
  prueba: "Prueba",
  practica: "Práctica",
};

/** En Windows no hay etapa de Permisos (no hay permiso de Accesibilidad que dar). */
export function useEtapas(): Etapa[] {
  const os = useOsType();
  return os === "macos"
    ? ["cuenta", "permisos", "prueba", "practica"]
    : ["cuenta", "prueba", "practica"];
}

export interface AccionPrincipal {
  texto: string;
  onClick?: () => void;
  disabled?: boolean;
  ocupado?: boolean;
  /** Si el botón envía un formulario de la columna, su id. */
  form?: string;
}

export interface AccionEnlace {
  texto: string;
  onClick: () => void;
  disabled?: boolean;
}

export const PlantillaPrimerUso: React.FC<{
  /** Etapa en curso; `undefined` = sin etapas marcadas (instalando, bienvenida); `"todas"` = todas hechas. */
  etapa?: Etapa | "todas";
  titulo: string;
  apoyo?: React.ReactNode;
  atras?: () => void;
  /** Contenido propio de la columna (campos, lista de pasos). */
  children?: React.ReactNode;
  principal?: AccionPrincipal;
  enlace?: AccionEnlace;
  escenario: React.ReactNode;
  /** Una línea opcional bajo el escenario (16/24, `tinta-2`, máx. 380). */
  notaEscenario?: React.ReactNode;
  /** La recompensa: la única pantalla oscura. */
  oscura?: boolean;
  /** Cambia cuando cambia la pantalla, para la animación de entrada. */
  clave?: string;
  mensajeAyuda?: string;
}> = ({
  etapa,
  titulo,
  apoyo,
  atras,
  children,
  principal,
  enlace,
  escenario,
  notaEscenario,
  oscura,
  clave,
  mensajeAyuda = "Hola, necesito ayuda para empezar con CloseLabs Voice.",
}) => {
  const etapas = useEtapas();
  const indice =
    etapa === "todas"
      ? etapas.length
      : etapa
        ? etapas.indexOf(etapa)
        : -1;

  return (
    <div
      className={`h-screen w-screen flex items-center justify-center select-none cursor-default ${
        oscura ? "bg-noche" : "bg-papel"
      }`}
    >
      <div className="w-full h-full max-w-[1280px] max-h-[760px] flex flex-col">
        {/* ---- Barra superior ---- */}
        <header
          className={`h-16 shrink-0 grid grid-cols-[1fr_auto_1fr] items-center pl-6 pr-8 border-b ${
            oscura ? "border-white/12" : "border-linea"
          }`}
        >
          <Logo width={132} blanco={oscura} />
          <nav aria-label="Etapas" className="flex gap-3">
            {indice >= 0 &&
              etapas.map((e, i) => {
                const hecha = i < indice;
                const actual = i === indice;
                return (
                  <div key={e} className="w-[104px] flex flex-col gap-2">
                    <span
                      className={`text-[14px] leading-[20px] font-semibold ${
                        oscura
                          ? "text-white"
                          : hecha || actual
                            ? "text-tinta"
                            : "text-tinta-3"
                      }`}
                    >
                      {NOMBRES[e]}
                    </span>
                    <span
                      className={`h-[3px] rounded-[2px] ${
                        oscura
                          ? "bg-white"
                          : actual
                            ? "bg-lila origin-left animate-[crecer_240ms_cubic-bezier(.2,.8,.2,1)]"
                            : hecha
                              ? "bg-tinta"
                              : "bg-linea"
                      }`}
                    />
                  </div>
                );
              })}
          </nav>
          <div className="justify-self-end">
            <Enlace
              chico
              oscuro={oscura}
              onClick={() => void openUrl(supportWhatsappUrl(mensajeAyuda))}
            >
              ¿Necesitas ayuda?
            </Enlace>
          </div>
        </header>

        {/* ---- Cuerpo: columna + escenario ---- */}
        <div className="flex-1 min-h-0 grid grid-cols-[440px_1fr] min-[1120px]:grid-cols-[500px_1fr]">
          {/* El contenido de la columna puede desplazarse SOLO si un aviso largo no cabe (no debería
              pasar a 1120 × 680); el pie con el botón queda siempre fijo abajo y visible. */}
          <section className="min-h-0 flex flex-col pl-12 pr-10 min-[1120px]:pl-16 min-[1120px]:pr-14">
            <div
              key={clave}
              className="flex-1 min-h-0 overflow-y-auto pt-9 pb-4 animate-[entrar_240ms_cubic-bezier(.2,.8,.2,1)]"
            >
              <div className="h-6">
                {atras && (
                  <button
                    type="button"
                    onClick={atras}
                    className={`inline-flex items-center gap-1.5 text-[15px] leading-6 font-semibold ${
                      oscura
                        ? "text-white/72 hover:text-white"
                        : "text-tinta-2 hover:text-tinta"
                    }`}
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Atrás
                  </button>
                )}
              </div>
              <Titulo oscuro={oscura} className="mt-6">
                {titulo}
              </Titulo>
              {apoyo && (
                <Apoyo oscuro={oscura} className="mt-3.5">
                  {apoyo}
                </Apoyo>
              )}
              {children && <div className="mt-6">{children}</div>}
            </div>

            {(principal || enlace) && (
              <div className="shrink-0 pb-8 pt-2 flex flex-col items-center gap-3">
                {principal && (
                  <BotonPrincipal
                    type={principal.form ? "submit" : "button"}
                    form={principal.form}
                    onClick={principal.onClick}
                    disabled={principal.disabled}
                    ocupado={principal.ocupado}
                  >
                    {principal.texto}
                  </BotonPrincipal>
                )}
                <div className="h-6 flex items-center">
                  {enlace && (
                    <Enlace
                      oscuro={oscura}
                      onClick={enlace.onClick}
                      disabled={enlace.disabled}
                    >
                      {enlace.texto}
                    </Enlace>
                  )}
                </div>
              </div>
            )}
          </section>

          <section
            className={`min-w-0 overflow-hidden flex flex-col items-center justify-center gap-5 px-8 ${
              oscura ? "bg-noche-2" : "bg-lino"
            }`}
          >
            <div
              key={clave}
              className="flex flex-col items-center gap-5 animate-[entrar_240ms_cubic-bezier(.2,.8,.2,1)]"
            >
              {escenario}
              {notaEscenario && (
                <p
                  className={`max-w-[380px] text-center text-[16px] leading-[24px] ${
                    oscura ? "text-white/72" : "text-tinta-2"
                  }`}
                >
                  {notaEscenario}
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

/** Tarjeta del escenario (468 de ancho): cabecera de 52 con nombre y contexto, y cuerpo. */
export const TarjetaEscenario: React.FC<{
  nombre: React.ReactNode;
  contexto?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ nombre, contexto, children, className = "" }) => (
  <div
    className={`w-[468px] max-w-full bg-papel border border-linea rounded-[16px] shadow-2 overflow-hidden text-left ${className}`}
  >
    <div className="h-[52px] px-5 flex items-center justify-between gap-3 bg-tarjeta-cab border-b border-linea">
      <span className="text-[15px] font-semibold text-tinta truncate">
        {nombre}
      </span>
      {contexto && (
        <span className="text-[15px] font-medium text-tinta-2 truncate">
          {contexto}
        </span>
      )}
    </div>
    {children}
  </div>
);

export default PlantillaPrimerUso;

/* eslint-disable i18next/no-literal-string */
import React, { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { commands, type EstadoCuenta } from "@/bindings";
import { abrirCobro, avisarErrorDeCobro, ContenidoFin, situacion, type Fin } from "./Suscripcion";

/**
 * El pop-up que sale cuando el médico intenta dictar y su prueba (o su suscripción) ya terminó.
 *
 * Por qué un pop-up y no solo "Mi cuenta": Nicolás probó la primera versión (solo el panel) y no
 * se entendía que había que suscribirse. La norma para este momento —el usuario intentó algo y no
 * puede— es contárselo AHÍ, en primer plano, con una sola acción y una salida clara ("Ahora no").
 * Debajo queda "Mi cuenta" abierta, con el mismo contenido, para quien cierre el pop-up.
 *
 * `motivo` es el código del servidor (`trial_ended` o `subscription_inactive`); sirve para el texto
 * mientras llega el estado de la cuenta, que trae los números y distingue "terminada" de "sin pagar".
 */
export const FinDePruebaModal: React.FC<{
  motivo: string | null;
  onCerrar: () => void;
  onCobroAbierto: () => void;
}> = ({ motivo, onCerrar, onCobroAbierto }) => {
  const [estado, setEstado] = useState<EstadoCuenta | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const idTitulo = useId();
  const idDescripcion = useId();
  const caja = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!motivo) return;
    setEstado(null);
    let vivo = true;
    void commands.accountState().then((r) => {
      if (vivo && r.status === "ok" && !r.data.offline) setEstado(r.data);
    });
    return () => {
      vivo = false;
    };
  }, [motivo]);

  // Foco en el botón principal; Esc cierra; Tab no se sale del pop-up.
  useEffect(() => {
    if (!motivo) return;
    const anterior = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => boton.current?.focus());
    const teclas = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCerrar();
        return;
      }
      if (e.key !== "Tab" || !caja.current) return;
      const enfocables = Array.from(caja.current.querySelectorAll<HTMLElement>("button:not([disabled])"));
      if (enfocables.length === 0) return;
      const primero = enfocables[0];
      const ultimo = enfocables[enfocables.length - 1];
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    };
    document.addEventListener("keydown", teclas);
    return () => {
      document.removeEventListener("keydown", teclas);
      anterior?.focus();
    };
  }, [motivo, onCerrar]);

  if (!motivo) return null;

  const s: Fin = (() => {
    const desdeEstado = estado ? situacion(estado) : null;
    if (desdeEstado === "fin_prueba" || desdeEstado === "terminada" || desdeEstado === "sin_pagar") {
      return desdeEstado;
    }
    return motivo === "trial_ended" ? "fin_prueba" : "terminada";
  })();

  const pagar = async () => {
    setOcupado(true);
    const error = await abrirCobro(s === "sin_pagar" ? "portal" : "checkout");
    setOcupado(false);
    if (error) {
      avisarErrorDeCobro(error);
      return;
    }
    // Se abrió Stripe. El pop-up ya cumplió; "Mi cuenta" (detrás) espera la vuelta del navegador.
    onCobroAbierto();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[#1a1620]/45 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <div
        ref={caja}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        aria-describedby={idDescripcion}
        className="w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl bg-white px-7 pt-9 pb-6 shadow-2xl"
      >
        <ContenidoFin
          estado={estado}
          situacion={s}
          ocupado={ocupado}
          onPagar={() => void pagar()}
          idTitulo={idTitulo}
          idDescripcion={idDescripcion}
          refBoton={boton}
        />
        <div className="mt-4 flex justify-center">
          <button
            onClick={onCerrar}
            className="px-4 py-2 rounded-xl text-sm font-medium text-brand-text-secondary hover:bg-brand-surface transition-colors"
          >
            Ahora no
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

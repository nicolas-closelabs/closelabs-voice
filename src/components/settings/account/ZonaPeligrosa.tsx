/* eslint-disable i18next/no-literal-string */
import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { commands, type EstadoCuenta } from "@/bindings";
import { nombreSocio, situacion } from "./Suscripcion";

/**
 * "Eliminar mi cuenta" (Ley 1581). Decidido con Nicolás (2026-10-05): separado de cancelar y que se
 * note la diferencia — al final de Mi cuenta, en rojo, con DOBLE confirmación al estilo GitHub:
 * primero se explica qué se borra; después hay que escribir el correo. El servidor vuelve a
 * comprobar ese correo (`account`, acción `delete`): un botón mal cableado no puede borrar a nadie.
 */
export const ZonaPeligrosa: React.FC<{ estado: EstadoCuenta }> = ({ estado }) => {
  const [abierta, setAbierta] = useState(false);
  const [escrito, setEscrito] = useState("");
  const [borrando, setBorrando] = useState(false);

  const correo = (estado.email ?? "").trim().toLowerCase();
  const coincide = correo !== "" && escrito.trim().toLowerCase() === correo;
  const s = situacion(estado);
  const pagando = estado.has_billing && ["prueba_con_tarjeta", "activa", "cobro_fallido"].includes(s);

  const eliminar = async () => {
    setBorrando(true);
    const r = await commands.accountDelete(escrito.trim());
    setBorrando(false);
    if (r.status === "ok") {
      // La app vuelve sola a la pantalla de entrar (evento `sesion-cerrada`).
      toast.success("Tu cuenta fue eliminada", {
        description: "Borramos tus datos. Gracias por haber usado CloseLabs Voice.",
      });
      return;
    }
    toast.error(
      r.error === "confirmacion" ? "El correo no coincide" : "No se pudo eliminar la cuenta",
      {
        description:
          r.error === "confirmacion"
            ? "Escribe exactamente el correo con el que entras."
            : r.error === "sin_conexion"
              ? "Revisa tu internet e inténtalo de nuevo. No se borró nada."
              : "No se borró nada. Inténtalo de nuevo o escríbenos por WhatsApp desde Ayuda.",
      },
    );
  };

  return (
    // «Tinta y voz»: el último grupo de Mi cuenta, al que se llega desplazándose. Sin caja roja:
    // solo el botón de peligro (texto y borde en rojo apagado) y la doble confirmación.
    <section>
      <div className="pb-2.5 border-b border-linea">
        <h2 className="text-[14px] leading-5 font-semibold text-tinta-3">Eliminar la cuenta</h2>
      </div>

      {!abierta ? (
        <div className="min-h-[66px] py-2 flex items-center justify-between gap-6 border-b border-linea">
          <div>
            <div className="text-[17px] leading-6 font-semibold text-tinta">Eliminar mi cuenta</div>
            <p className="text-[15px] leading-[22px] text-tinta-2">
              Se borran tu cuenta, tu diccionario y tu suscripción. No se puede deshacer.
            </p>
          </div>
          <button
            onClick={() => setAbierta(true)}
            className="shrink-0 h-11 px-5 rounded-[12px] text-[16px] font-semibold text-error border-[1.5px] border-error-borde bg-papel hover:bg-lino transition-colors"
          >
            Eliminar mi cuenta
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 pt-4 text-[16px] text-tinta-2 leading-relaxed">
          <p>Si eliminas tu cuenta, se borra para siempre:</p>
          <ul className="list-disc pl-5 flex flex-col gap-1">
            <li>Tu perfil (nombre, correo y teléfono).</li>
            <li>Tus equipos: CloseLabs Voice deja de funcionar en todos tus computadores.</li>
            <li>Tu suscripción{pagando ? ": se cancela en este momento, sin reembolso de los días que te quedan" : ""}.</li>
            <li>Tu diccionario en este computador.</li>
          </ul>
          {s === "socio" && (
            <p className="rounded-[12px] bg-lino px-4 py-3">
              Esto <strong>no cancela tu suscripción con {nombreSocio(estado.canal)}</strong>: para
              dejar de pagar, comunícate con {nombreSocio(estado.canal)}.
            </p>
          )}
          {pagando && (
            <p className="rounded-[12px] bg-lino px-4 py-3">
              Si solo quieres dejar de pagar, mejor <strong>cancela tu suscripción</strong> (arriba):
              sigues dictando hasta el fin de tu período y tu cuenta te espera si vuelves.
            </p>
          )}
          <label htmlFor="confirmar-correo" className="mt-1">
            Para confirmar, escribe tu correo: <strong className="text-error select-text">{estado.email}</strong>
          </label>
          <input
            id="confirmar-correo"
            type="email"
            autoComplete="off"
            spellCheck={false}
            value={escrito}
            onChange={(e) => setEscrito(e.target.value)}
            className="w-full max-w-sm h-[50px] px-4 rounded-[12px] border-[1.5px] border-linea-fuerte bg-papel text-[17px] text-tinta focus:outline-none focus:border-error"
          />
          <div className="flex flex-wrap items-center gap-3 mt-1">
            <button
              onClick={() => void eliminar()}
              disabled={!coincide || borrando}
              className="inline-flex items-center gap-2 h-11 px-5 rounded-[12px] text-[16px] font-semibold bg-error text-white hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {borrando && <Loader2 className="w-4 h-4 animate-spin" />}
              Eliminar mi cuenta para siempre
            </button>
            <button
              onClick={() => {
                setAbierta(false);
                setEscrito("");
              }}
              disabled={borrando}
              className="text-[15px] font-semibold text-tinta underline underline-offset-4 decoration-linea-fuerte"
            >
              No, volver
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

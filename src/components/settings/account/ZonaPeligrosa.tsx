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
    <section className="rounded-2xl border border-red-200 p-5 mt-4">
      <h2 className="font-heading font-semibold text-[15px] text-red-700">Zona peligrosa</h2>

      {!abierta ? (
        <div className="flex flex-wrap items-center justify-between gap-3 mt-1">
          <p className="text-sm text-brand-text-secondary leading-relaxed max-w-md">
            Borra para siempre tu cuenta y todos sus datos. No se puede deshacer.
          </p>
          <button
            onClick={() => setAbierta(true)}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-red-700 border border-red-300 hover:bg-red-50 transition-colors"
          >
            Eliminar mi cuenta
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 mt-2 text-sm text-brand-text-secondary leading-relaxed">
          <p>Si eliminas tu cuenta, se borra para siempre:</p>
          <ul className="list-disc pl-5 flex flex-col gap-1">
            <li>Tu perfil (nombre, correo y teléfono).</li>
            <li>Tus equipos: CloseLabs Voice deja de funcionar en todos tus computadores.</li>
            <li>Tu suscripción{pagando ? ": se cancela en este momento, sin reembolso de los días que te quedan" : ""}.</li>
            <li>Tu diccionario en este computador.</li>
          </ul>
          {s === "socio" && (
            <p className="rounded-xl bg-brand-surface border border-brand-border px-4 py-3">
              Esto <strong>no cancela tu suscripción con {nombreSocio(estado.canal)}</strong>: para
              dejar de pagar, comunícate con {nombreSocio(estado.canal)}.
            </p>
          )}
          {pagando && (
            <p className="rounded-xl bg-brand-surface border border-brand-border px-4 py-3">
              Si solo quieres dejar de pagar, mejor <strong>cancela tu suscripción</strong> (arriba):
              sigues dictando hasta el fin de tu período y tu cuenta te espera si vuelves.
            </p>
          )}
          <label htmlFor="confirmar-correo" className="mt-1">
            Para confirmar, escribe tu correo: <strong className="text-red-700 select-text">{estado.email}</strong>
          </label>
          <input
            id="confirmar-correo"
            type="email"
            autoComplete="off"
            spellCheck={false}
            value={escrito}
            onChange={(e) => setEscrito(e.target.value)}
            className="w-full max-w-sm px-3 py-2 rounded-xl border border-brand-border bg-white text-[15px] focus:outline-none focus:border-red-400"
          />
          <div className="flex flex-wrap items-center gap-3 mt-1">
            <button
              onClick={() => void eliminar()}
              disabled={!coincide || borrando}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
              className="text-sm font-medium text-brand-text-secondary hover:underline"
            >
              No, volver
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

/* eslint-disable i18next/no-literal-string */
import React, { useState } from "react";
import { Loader2, FolderDown } from "lucide-react";
import { commands } from "@/bindings";
import Logo from "../icons/Logo";

/**
 * Se abrió la app desde el instalador (.dmg) sin moverla a Aplicaciones. Ver `instalacion_mac.rs`
 * para el porqué: parece funcionar, pero al expulsar el disco o reiniciar, "se borra".
 *
 * Va ANTES que la cuenta y los permisos: lo que se haga aquí quedaría amarrado a una copia que va
 * a desaparecer. Un solo botón; si la copia falla, el paso a paso para hacerlo a mano.
 */
export const InstalarEnAplicaciones: React.FC = () => {
  const [ocupado, setOcupado] = useState(false);
  const [fallo, setFallo] = useState(false);

  const instalar = async () => {
    setOcupado(true);
    const r = await commands.moverAAplicaciones();
    // Si salió bien, esta ventana se cierra y la app se abre sola desde Aplicaciones.
    if (r.status === "error") {
      setOcupado(false);
      setFallo(true);
    }
  };

  return (
    <div className="h-screen overflow-y-auto flex items-center justify-center px-8 py-10 select-none">
      <div className="w-full max-w-md flex flex-col items-center text-center gap-5">
        <Logo width={150} />
        <span className="grid place-items-center w-14 h-14 rounded-full bg-brand-accent-soft">
          <FolderDown className="w-7 h-7 text-brand-accent" />
        </span>
        <h1 className="font-heading text-2xl font-bold">
          Falta un paso para instalarla
        </h1>

        {!fallo ? (
          <>
            <p className="text-[17px] leading-relaxed text-brand-text-secondary">
              Abriste CloseLabs Voice desde el instalador. Si la dejas así,
              desaparece cuando apagues el computador.
            </p>
            <button
              type="button"
              onClick={() => void instalar()}
              disabled={ocupado}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl text-[17px] font-semibold bg-brand-accent text-white hover:bg-brand-accent-secondary transition-colors disabled:opacity-60"
            >
              {ocupado && <Loader2 className="w-5 h-5 animate-spin" />}
              {ocupado ? "Instalando…" : "Instalar en Aplicaciones"}
            </button>
            <p className="text-[15px] text-brand-text-muted">
              La app se cerrará y se volverá a abrir sola en unos segundos.
            </p>
          </>
        ) : (
          <>
            <p className="text-[17px] leading-relaxed text-brand-text-secondary">
              No pudimos hacerlo automáticamente. Hazlo así:
            </p>
            <ol className="w-full flex flex-col gap-2 text-left text-[16px] leading-snug">
              {[
                "Cierra esta ventana.",
                "En la ventana del instalador, arrastra el ícono de CloseLabs Voice sobre la carpeta Aplicaciones.",
                "Abre CloseLabs Voice desde la carpeta Aplicaciones.",
              ].map((paso, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="grid place-items-center w-6 h-6 shrink-0 rounded-full bg-brand-accent text-white text-[13px] font-semibold font-heading">
                    {i + 1}
                  </span>
                  <span className="text-brand-text-secondary">{paso}</span>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </div>
  );
};

export default InstalarEnAplicaciones;

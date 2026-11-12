/* eslint-disable i18next/no-literal-string */
import React, { useEffect, useRef, useState } from "react";
import { Loader2, MessageCircle } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { commands } from "@/bindings";
import { supportWhatsappUrl } from "../../branding";
import Logo from "../icons/Logo";

/**
 * La app se abrió desde el instalador (.dmg). Ver `instalacion_mac.rs` para el porqué.
 *
 * Desde 2026-11-11 el .dmg dice "Haz doble clic aquí para instalar" y no trae la carpeta
 * Aplicaciones: el doble clic ES la instalación. Por eso aquí no hay botón: en cuanto se abre, la
 * app se copia sola a Aplicaciones, expulsa el instalador y se vuelve a abrir desde ahí. El médico
 * solo ve "Instalando…" un par de segundos.
 *
 * Va ANTES que la cuenta y los permisos: lo que se haga en esta copia se perdería al expulsar el disco.
 * Si la copia falla, se explica cómo hacerlo a mano y se ofrece ayuda por WhatsApp.
 */
export const InstalarEnAplicaciones: React.FC = () => {
  const [fallo, setFallo] = useState(false);
  const empezo = useRef(false);

  const instalar = async () => {
    setFallo(false);
    const r = await commands.moverAAplicaciones();
    // Si salió bien, esta ventana se cierra y la app se abre sola desde Aplicaciones.
    if (r.status === "error") setFallo(true);
  };

  useEffect(() => {
    // Una sola vez aunque React monte dos veces en desarrollo.
    if (empezo.current) return;
    empezo.current = true;
    // Un respiro para que el médico alcance a leer qué está pasando.
    const t = setTimeout(() => void instalar(), 1200);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="h-screen overflow-y-auto flex px-8 py-8 select-none">
      <div className="m-auto w-full max-w-md flex flex-col items-center text-center gap-5">
        <Logo width={150} />

        {!fallo ? (
          <>
            <Loader2 className="w-10 h-10 animate-spin text-brand-accent" />
            <h1 className="font-heading text-2xl font-bold">
              Instalando CloseLabs Voice…
            </h1>
            <p className="text-[17px] leading-relaxed text-brand-text-secondary">
              No toques nada. En unos segundos la app se abre sola, ya
              instalada.
            </p>
          </>
        ) : (
          <>
            <h1 className="font-heading text-2xl font-bold">
              No pudimos instalarla sola
            </h1>
            <p className="text-[17px] leading-relaxed text-brand-text-secondary">
              Escríbenos y te ayudamos en un momento, o hazlo así:
            </p>
            <ol className="w-full flex flex-col gap-2 text-left text-[16px] leading-snug">
              {[
                "Cierra esta ventana.",
                "Abre el Finder y, en la columna de la izquierda, haz clic en Aplicaciones.",
                "Arrastra el ícono de CloseLabs Voice de la ventana del instalador a esa ventana de Aplicaciones.",
                "Abre CloseLabs Voice desde Aplicaciones.",
              ].map((paso, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="grid place-items-center w-6 h-6 shrink-0 rounded-full bg-brand-accent text-white text-[13px] font-semibold font-heading">
                    {i + 1}
                  </span>
                  <span className="text-brand-text-secondary">{paso}</span>
                </li>
              ))}
            </ol>
            <button
              type="button"
              onClick={() =>
                void openUrl(
                  supportWhatsappUrl(
                    "Hola, no logro instalar CloseLabs Voice en mi Mac.",
                  ),
                )
              }
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl text-[17px] font-semibold bg-[#128C7E] text-white hover:opacity-90 transition-opacity"
            >
              <MessageCircle className="w-5 h-5" />
              Pedir ayuda por WhatsApp
            </button>
            <button
              type="button"
              onClick={() => void instalar()}
              className="text-[15px] text-brand-text-secondary hover:text-brand-accent hover:underline"
            >
              Intentar otra vez
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default InstalarEnAplicaciones;

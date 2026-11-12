/* eslint-disable i18next/no-literal-string */
import React from "react";
import { Loader2, PlayCircle } from "lucide-react";
import { useShortcutKeys } from "../../../hooks/useShortcutKeys";
import { useModelStore } from "../../../stores/modelStore";
import { useSettings } from "../../../hooks/useSettings";
import Logo from "../../icons/Logo";
import { ABRIR_PRIMER_DICTADO } from "../../onboarding/PrimerDictado";

/**
 * Inicio: UNA frase, la única que hay que recordar (plan del primer uso, 2026-11-11).
 *
 * Antes había un lema, una tarjeta de estado, un botón de práctica y tres tarjetas de "Cómo usar":
 * cinco cosas que leer para decir lo mismo. El médico que vuelve a la app solo necesita acordarse
 * de qué teclas presionar; lo demás (el modo sin conexión, la práctica) va abajo, pequeño.
 */
export const HomeSettings: React.FC = () => {
  const { downloadProgress } = useModelStore();
  const { keys } = useShortcutKeys();
  // Con "mantener presionado" se termina soltando, no presionando otra vez.
  const mantener = useSettings().getSetting("push_to_talk") === true;
  const downloading = Object.values(downloadProgress)[0];

  return (
    <div className="max-w-2xl w-full mx-auto flex flex-col items-center text-center gap-8 py-10">
      <Logo width={172} />

      <p className="font-heading text-[26px] font-bold leading-snug text-brand-text max-w-xl">
        Haz clic donde quieras escribir,{" "}
        {mantener ? "mantén presionado" : "presiona"}{" "}
        <span className="inline-flex items-center gap-1.5 align-middle">
          {keys.map((k, i) => (
            <React.Fragment key={i}>
              {i > 0 && (
                <span className="text-brand-text-muted text-[20px]">+</span>
              )}
              <kbd className="px-3 py-1 rounded-lg border border-brand-border bg-white font-heading text-[22px] font-semibold shadow-[0_2px_0_rgba(26,22,32,0.08)]">
                {k}
              </kbd>
            </React.Fragment>
          ))}
        </span>
        {mantener
          ? " mientras hablas, y suelta para terminar."
          : ", habla, y presiona otra vez para terminar."}
      </p>

      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event(ABRIR_PRIMER_DICTADO))}
          className="inline-flex items-center gap-2 text-[16px] font-semibold text-brand-accent hover:underline"
        >
          <PlayCircle className="w-5 h-5" />
          Hacer un dictado de prueba
        </button>
        {downloading && (
          <p className="inline-flex items-center gap-2 text-[14px] text-brand-text-muted">
            <Loader2 className="w-4 h-4 animate-spin" />
            Descargando el modo sin internet:{" "}
            {Math.round(downloading.percentage)}%. Mientras tanto ya puedes
            dictar.
          </p>
        )}
      </div>
    </div>
  );
};

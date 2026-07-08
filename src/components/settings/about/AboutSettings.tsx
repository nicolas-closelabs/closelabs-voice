/* eslint-disable i18next/no-literal-string */
import React, { useState, useEffect } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { ArrowUpRight } from "lucide-react";
import Logo from "../../icons/Logo";

export const AboutSettings: React.FC = () => {
  const [version, setVersion] = useState("");

  useEffect(() => {
    getVersion()
      .then(setVersion)
      .catch(() => setVersion("0.4.0"));
  }, []);

  return (
    <div className="max-w-2xl w-full mx-auto flex flex-col gap-6 py-4">
      <div className="rounded-3xl border border-brand-border bg-white shadow-[0_2px_10px_rgba(26,22,32,0.05)] p-8 flex flex-col items-center text-center gap-5">
        <Logo width={200} />

        <p className="text-brand-text-secondary max-w-md leading-relaxed">
          CloseLabs Voice convierte tu voz en texto, al instante y en tu idioma.
          Dictado privado y local para que dediques menos tiempo a escribir y más
          a tus pacientes.
        </p>

        <div className="flex items-center gap-2 text-sm text-brand-text-muted">
          <span className="px-2.5 py-1 rounded-full bg-brand-surface border border-brand-border font-heading font-medium tabular-nums">
            v{version}
          </span>
        </div>

        <button
          onClick={() => openUrl("https://www.closelabs.co")}
          className="inline-flex items-center gap-1 text-brand-accent font-medium hover:underline"
        >
          Automatiza tu consultorio con CloseLabs
          <ArrowUpRight className="w-4 h-4" />
        </button>
      </div>

      <p className="text-center text-xs text-brand-text-muted">
        Hecho por CloseLabs · closelabs.co
      </p>
    </div>
  );
};

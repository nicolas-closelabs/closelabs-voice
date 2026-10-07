/* eslint-disable i18next/no-literal-string */
import React from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useActualizacion } from "@/stores/actualizacionStore";

/** En el pie de la ventana: la actualización que se está bajando o que ya está lista. */
export const ActualizacionPie: React.FC = () => {
  const { estado, version, instalar } = useActualizacion();
  if (estado === "nada") return null;

  if (estado === "descargando") {
    return (
      <span className="inline-flex items-center gap-1.5 text-brand-text-muted">
        <Loader2 className="w-3 h-3 animate-spin" />
        Descargando la versión {version}…
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={estado === "instalando"}
      onClick={() =>
        void instalar().catch(() =>
          toast.error("No se pudo instalar la actualización", {
            description: "Sigues con tu versión actual. Lo intentaremos de nuevo más tarde.",
          }),
        )
      }
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-accent-soft text-brand-accent font-semibold hover:bg-brand-accent hover:text-white transition-colors disabled:opacity-60"
    >
      {estado === "instalando" ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
      {estado === "instalando" ? "Instalando…" : `Versión ${version} lista · Reiniciar`}
    </button>
  );
};

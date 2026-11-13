/* eslint-disable i18next/no-literal-string */
import React, { useState } from "react";
import { Bug, Check, Loader2, MessageCircle } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { commands } from "@/bindings";
import { supportWhatsappUrl } from "../../../branding";

type Estado =
  | { fase: "escribiendo" }
  | { fase: "enviando" }
  | { fase: "listo"; id: string }
  | { fase: "error"; motivo: string };

const MOTIVOS: Record<string, string> = {
  sin_conexion:
    "No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.",
  fallo_servidor:
    "El servidor no pudo recibir el reporte. Inténtalo de nuevo en unos minutos.",
};

/**
 * "Reportar un problema".
 *
 * Manda lo que el médico escribe junto con el final del log, que se limpia en el backend antes
 * de salir del computador (`problem_report.rs`: sin nombre de usuario, sin credenciales, sin el
 * diccionario, sin correos).
 *
 * El aviso de "no incluyas datos de pacientes" va ARRIBA del campo, no debajo ni en gris: es lo
 * único de esta pantalla que el médico tiene que leer antes de escribir, no después.
 */
export const ReportProblem: React.FC = () => {
  const [texto, setTexto] = useState("");
  const [estado, setEstado] = useState<Estado>({ fase: "escribiendo" });

  const enviar = async () => {
    setEstado({ fase: "enviando" });
    const res = await commands.sendProblemReport(texto.trim());
    if (res.status === "ok") {
      setEstado({ fase: "listo", id: res.data });
      setTexto("");
    } else {
      setEstado({
        fase: "error",
        motivo: MOTIVOS[res.error] ?? "No se pudo enviar el reporte.",
      });
    }
  };

  if (estado.fase === "listo") {
    return (
      <div className="rounded-2xl border border-brand-border bg-brand-surface p-5 flex items-start gap-3">
        <span className="grid place-items-center w-9 h-9 shrink-0 rounded-full bg-brand-accent-soft text-brand-accent">
          <Check className="w-5 h-5" />
        </span>
        <div className="min-w-0">
          <div className="font-heading font-semibold text-[15px]">
            Reporte enviado
          </div>
          <p className="text-sm text-brand-text-secondary mt-0.5">
            Gracias. Si quieres que te respondamos más rápido, avísanos por
            WhatsApp: el mensaje ya lleva el número de tu reporte.
          </p>
          {/* Antes se le pedía al médico que copiara este código a mano. Nadie copia un UUID
              de 36 caracteres; por eso ahora viaja dentro del mensaje de WhatsApp. */}
          <button
            onClick={() =>
              void openUrl(
                supportWhatsappUrl(
                  `Hola, acabo de reportar un problema en CloseLabs Voice. Número de reporte: ${estado.id}`,
                ),
              )
            }
            className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-[#25D366] text-white hover:bg-[#1EBE5A] transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            Avisar por WhatsApp
          </button>
          <code className="block mt-2 text-xs text-brand-text-muted break-all">
            Reporte {estado.id}
          </code>
          <button
            onClick={() => setEstado({ fase: "escribiendo" })}
            className="block mt-3 text-sm font-semibold text-brand-accent hover:underline"
          >
            Enviar otro reporte
          </button>
        </div>
      </div>
    );
  }

  const enviando = estado.fase === "enviando";

  return (
    <div className="rounded-2xl border border-brand-border bg-brand-surface p-5 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="grid place-items-center w-9 h-9 shrink-0 rounded-full bg-brand-accent-soft text-brand-accent">
          <Bug className="w-5 h-5" />
        </span>
        <div>
          <div className="font-heading font-semibold text-[15px]">
            Reportar un problema
          </div>
          <div className="text-sm text-brand-text-secondary">
            Cuéntanos qué pasó. Se envía junto con el registro técnico de la
            app, que no contiene tus dictados.
          </div>
        </div>
      </div>

      <p className="text-sm rounded-xl bg-brand-accent-soft text-brand-text-primary px-3 py-2">
        <strong className="font-semibold">
          No escribas datos de tus pacientes
        </strong>{" "}
        aquí: nombres, documentos ni diagnósticos. Describe solo lo que hizo la
        app.
      </p>

      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        disabled={enviando}
        rows={4}
        maxLength={4000}
        placeholder="Ejemplo: al dictar con el atajo, el texto se pega dos veces en WhatsApp."
        className="w-full rounded-xl border border-brand-border bg-white px-3 py-2 text-sm resize-none focus:outline-none focus:border-brand-accent disabled:opacity-50"
      />

      {estado.fase === "error" && (
        <p className="text-sm text-red-600">{estado.motivo}</p>
      )}

      <div className="flex justify-end">
        <button
          onClick={enviar}
          disabled={enviando || texto.trim().length < 5}
          className="px-4 py-2 rounded-xl text-sm font-semibold bg-brand-accent text-white hover:bg-brand-accent-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2"
        >
          {enviando && <Loader2 className="w-4 h-4 animate-spin" />}
          {enviando ? "Enviando…" : "Enviar reporte"}
        </button>
      </div>
    </div>
  );
};

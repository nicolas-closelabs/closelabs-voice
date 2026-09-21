/* eslint-disable i18next/no-literal-string */
import React, { useState } from "react";
import { ChevronDown, MessageCircle } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { ReportProblem } from "./ReportProblem";
import { BRANDING, supportWhatsappUrl } from "../../../branding";
import { useShortcutKeys } from "../../../hooks/useShortcutKeys";
import { pasteShortcut } from "../../../lib/utils/shortcutLabels";
import type { OSType } from "../../../lib/utils/keyboard";

interface QA {
  q: string;
  a: string;
}

/**
 * Las preguntas frecuentes, escritas para el sistema del médico.
 *
 * ⚠️ Antes eran un solo texto de Mac para todos: a los usuarios de Windows —casi todos— les
 * decían que presionaran ⌥ y que buscaran permisos de Accesibilidad en "Ajustes del Sistema",
 * cosas que no existen en su computador.
 */
function buildFaq(os: OSType, atajo: string): QA[] {
  const mac = os === "macos";
  return [
    {
      q: "¿Cuál es el atajo y puedo cambiarlo?",
      a: `Tu atajo es ${atajo}. Puedes cambiarlo en Configuración → Atajo de Transcripción.`,
    },
    {
      q: "No transcribe nada, ¿qué hago?",
      a: mac
        ? "Revisa que CloseLabs Voice tenga permiso de Micrófono y de Accesibilidad en Ajustes del Sistema → Privacidad y seguridad. Sin esos permisos no puede grabar ni escribir el texto."
        : "Revisa que Windows le permita usar el micrófono: Configuración → Privacidad y seguridad → Micrófono, y que esté activado «Permitir que las aplicaciones de escritorio accedan al micrófono». Revisa también que el micrófono no esté silenciado.",
    },
    {
      q: "No encuentro la ventana de la app.",
      a: mac
        ? "CloseLabs Voice vive en el ícono del Dock y en la barra de menú (arriba a la derecha). Haz clic en cualquiera de los dos para abrir esta ventana."
        : "CloseLabs Voice vive en los íconos de abajo a la derecha, junto al reloj. Si no ves el ícono, haz clic en la flechita ^ para mostrar los íconos escondidos. También puedes buscar «CloseLabs Voice» en el menú Inicio.",
    },
    {
      q: "¿Cómo cambio entre pegar automático y solo copiar?",
      a: `Ve a Configuración → Entrega del texto y elige “Pegar automáticamente” o “Solo copiar”. En modo copiar, el texto queda en el portapapeles y lo pegas con ${pasteShortcut(os)}.`,
    },
    {
      q: "¿Es privado? ¿Se sube mi voz?",
      a: "Sí, es 100% privado y seguro: tus dictados no se almacenan ni se usan para entrenar modelos. Sin conexión, la transcripción ocurre 100% en tu computador.",
    },
  ];
}

const Item: React.FC<{ qa: QA; open: boolean; onClick: () => void }> = ({
  qa,
  open,
  onClick,
}) => (
  <div className="rounded-2xl border border-brand-border bg-white overflow-hidden">
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-brand-surface transition-colors"
    >
      <span className="font-heading font-medium text-[15px]">{qa.q}</span>
      <ChevronDown
        className={`w-4 h-4 shrink-0 text-brand-text-muted transition-transform ${
          open ? "rotate-180" : ""
        }`}
      />
    </button>
    {open && (
      <div className="px-5 pb-4 text-sm text-brand-text-secondary leading-relaxed">
        {qa.a}
      </div>
    )}
  </div>
);

export const HelpSettings: React.FC = () => {
  const [open, setOpen] = useState<number | null>(0);
  const { os, text: atajo } = useShortcutKeys();
  const FAQ = buildFaq(os, atajo);

  return (
    <div className="max-w-2xl w-full mx-auto flex flex-col gap-6 py-4">
      <div>
        <h1 className="font-heading font-bold text-2xl">Ayuda</h1>
        <p className="text-brand-text-secondary mt-1">
          Preguntas frecuentes y soporte.
        </p>
      </div>

      {/* WhatsApp va PRIMERO: para un médico poco familiarizado con la tecnología es la red de
          seguridad más importante. Antes era un "Contactar" al final que abría la portada de
          la web, sin ningún canal de soporte. */}
      <div className="rounded-2xl border border-brand-border bg-brand-surface p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid place-items-center w-10 h-10 rounded-full bg-[#25D366]/15 text-[#128C7E]">
            <MessageCircle className="w-5 h-5" />
          </span>
          <div>
            <div className="font-heading font-semibold text-[15px]">
              ¿Necesitas ayuda? Escríbenos por WhatsApp
            </div>
            <div className="text-sm text-brand-text-secondary">
              {BRANDING.supportWhatsappDisplay}
            </div>
          </div>
        </div>
        <button
          onClick={() => void openUrl(supportWhatsappUrl())}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[15px] font-semibold bg-[#25D366] text-white hover:bg-[#1EBE5A] transition-colors"
        >
          <MessageCircle className="w-4 h-4" />
          Abrir WhatsApp
        </button>
      </div>

      <div className="flex flex-col gap-2.5">
        {FAQ.map((qa, i) => (
          <Item
            key={i}
            qa={qa}
            open={open === i}
            onClick={() => setOpen(open === i ? null : i)}
          />
        ))}
      </div>

      <ReportProblem />

    </div>
  );
};

/* eslint-disable i18next/no-literal-string */
import React, { useState } from "react";
import { ChevronDown, LifeBuoy } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";

interface QA {
  q: string;
  a: string;
}

const FAQ: QA[] = [
  {
    q: "¿Cómo cambio entre pegar automático y solo copiar?",
    a: "Ve a Configuración → Entrega del texto y elige “Pegar automáticamente” o “Solo copiar”. En modo copiar, el texto queda en el portapapeles y lo pegas con ⌘ + V.",
  },
  {
    q: "No transcribe nada, ¿qué hago?",
    a: "Revisa que CloseLabs Voice tenga permiso de Micrófono y de Accesibilidad en Ajustes del Sistema → Privacidad y seguridad. Sin esos permisos no puede grabar ni escribir el texto.",
  },
  {
    q: "¿Cuál es el atajo y puedo cambiarlo?",
    a: "Por defecto es ⌥ + Espacio. Puedes cambiarlo en Configuración → Atajo de transcripción.",
  },
  {
    q: "¿Es privado? ¿Se sube mi voz?",
    a: "La transcripción ocurre 100% en tu computador; tu voz nunca se sube a internet y funciona sin conexión. Solo la limpieza opcional del texto usa la nube (sin audio).",
  },
  {
    q: "No encuentro la ventana de la app.",
    a: "CloseLabs Voice vive en el ícono del Dock y en la barra de menú (arriba a la derecha). Haz clic en cualquiera de los dos para abrir esta ventana.",
  },
];

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

  return (
    <div className="max-w-2xl w-full mx-auto flex flex-col gap-6 py-4">
      <div>
        <h1 className="font-heading font-bold text-2xl">Ayuda</h1>
        <p className="text-brand-text-secondary mt-1">
          Preguntas frecuentes y soporte.
        </p>
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

      <div className="rounded-2xl border border-brand-border bg-brand-surface p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid place-items-center w-9 h-9 rounded-full bg-brand-accent-soft text-brand-accent">
            <LifeBuoy className="w-5 h-5" />
          </span>
          <div>
            <div className="font-heading font-semibold text-[15px]">
              ¿Necesitas más ayuda?
            </div>
            <div className="text-sm text-brand-text-secondary">
              Escríbenos y te ayudamos.
            </div>
          </div>
        </div>
        <button
          onClick={() => openUrl("https://www.closelabs.co")}
          className="px-4 py-2 rounded-xl text-sm font-semibold bg-brand-accent text-white hover:bg-brand-accent-secondary transition-colors"
        >
          Contactar
        </button>
      </div>
    </div>
  );
};

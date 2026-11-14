/* eslint-disable i18next/no-literal-string */
import React, { useState } from "react";
import { ChevronDown, Flag, MessageCircle, PlayCircle } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { ReportProblem } from "./ReportProblem";
import { supportWhatsappUrl } from "../../../branding";
import { useShortcutKeys } from "../../../hooks/useShortcutKeys";
import { pasteShortcut } from "../../../lib/utils/shortcutLabels";
import type { OSType } from "../../../lib/utils/keyboard";
import { Titulo } from "../../tinta/Titulo";
import { IR_A_SECCION } from "../home/HomeSettings";
import { SettingsGroup } from "../../ui/SettingsGroup";

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
      a: `Tu atajo es ${atajo}. Puedes cambiarlo en Configuración → Atajo para dictar.`,
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
      // ⚠️ Nunca "100 % privado / local": con internet el audio SÍ sale a nuestro servidor (CLAUDE.md).
      a: "Tus dictados no se almacenan ni se usan para entrenar modelos. Con internet, el audio viaja a nuestro servidor solo para convertirse en texto; sin internet, todo ocurre en tu computador.",
    },
  ];
}

/** Una pregunta: renglón bajo con flecha; abierta, la respuesta debajo. Una abierta a la vez. */
const Item: React.FC<{ qa: QA; open: boolean; onClick: () => void }> = ({
  qa,
  open,
  onClick,
}) => (
  <li>
    <button
      onClick={onClick}
      aria-expanded={open}
      className="w-full min-h-[54px] flex items-center justify-between gap-6 text-left"
    >
      <span
        className={`text-[17px] leading-6 text-tinta ${open ? "font-semibold pt-4" : "font-medium"}`}
      >
        {qa.q}
      </span>
      <ChevronDown
        className={`w-3.5 h-3.5 shrink-0 text-tinta-2 transition-transform duration-150 ${
          open ? "rotate-180" : ""
        }`}
      />
    </button>
    {open && (
      <p className="max-w-[640px] pb-[18px] pt-1 text-[16px] leading-[26px] text-tinta-2">
        {qa.a}
      </p>
    )}
  </li>
);

/**
 * Ayuda («Tinta y voz», diseno/SISTEMA.md §10). WhatsApp va PRIMERO: para un médico poco
 * familiarizado con la tecnología es la red de seguridad más importante.
 */
export const HelpSettings: React.FC = () => {
  const [open, setOpen] = useState<number | null>(null);
  const [reportando, setReportando] = useState(false);
  const { os, text: atajo } = useShortcutKeys();
  const FAQ = buildFaq(os, atajo);

  return (
    <div>
      <Titulo>Ayuda</Titulo>

      {/* Tres tarjetas y no tres renglones: Nicolás, recorrido 4 (2026-11-14), "que queden así tres
          cuadros, para que no se vea tanto texto". Es la única excepción a "sin tarjetas en el uso
          diario" (diseno/SISTEMA.md §14). WhatsApp es la del lila: la red de seguridad del médico. */}
      <section className="mt-[18px]">
        <h2 className="pb-2.5 font-sans text-[14px] leading-5 font-semibold text-tinta-3">
          Hablar con nosotros
        </h2>
        <div className="grid grid-cols-3 gap-3">
          <Tarjeta
            icono={<PlayCircle className="w-5 h-5" />}
            nombre="Ver cómo funciona"
            frase="Un video de 40 segundos."
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent(IR_A_SECCION, { detail: "howto" }),
              )
            }
          />
          <Tarjeta
            lila
            icono={<MessageCircle className="w-5 h-5" />}
            nombre="Escríbenos por WhatsApp"
            frase="Te responde una persona."
            onClick={() => void openUrl(supportWhatsappUrl())}
          />
          <Tarjeta
            icono={<Flag className="w-5 h-5" />}
            nombre="Reportar un problema"
            frase="Sin el texto de tus dictados."
            activa={reportando}
            onClick={() => setReportando((v) => !v)}
          />
        </div>
      </section>
      {reportando && (
        <div className="mt-4">
          <ReportProblem />
        </div>
      )}

      <SettingsGroup title="Preguntas frecuentes">
        <ul className="divide-y divide-linea">
          {FAQ.map((qa, i) => (
            <Item
              key={i}
              qa={qa}
              open={open === i}
              onClick={() => setOpen(open === i ? null : i)}
            />
          ))}
        </ul>
      </SettingsGroup>
    </div>
  );
};

/** Una de las tres tarjetas de "Hablar con nosotros": toda la tarjeta es el botón. */
const Tarjeta: React.FC<{
  icono: React.ReactNode;
  nombre: string;
  frase: string;
  onClick: () => void;
  lila?: boolean;
  activa?: boolean;
}> = ({ icono, nombre, frase, onClick, lila, activa }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={activa}
    className={`min-h-[132px] rounded-[16px] border p-[18px] flex flex-col items-start gap-3 text-left transition-colors duration-150 focus:outline-none focus-visible:shadow-[0_0_0_3px_var(--foco)] ${
      lila
        ? "bg-lila-suave border-transparent hover:border-lila-claro"
        : activa
          ? "bg-papel border-tinta"
          : "bg-papel border-linea hover:border-linea-fuerte"
    }`}
  >
    <span
      className={`grid place-items-center w-10 h-10 rounded-full ${
        lila ? "bg-lila text-white" : "bg-lino text-tinta"
      }`}
    >
      {icono}
    </span>
    <span className="flex flex-col gap-0.5">
      <span className="text-[16px] leading-[22px] font-semibold text-tinta">
        {nombre}
      </span>
      <span className="text-[14px] leading-5 text-tinta-2">{frase}</span>
    </span>
  </button>
);

/** Renglón del uso diario: nombre y frase a la izquierda, un control a la derecha. */
export const Renglon: React.FC<{
  nombre: React.ReactNode;
  frase?: React.ReactNode;
  children?: React.ReactNode;
}> = ({ nombre, frase, children }) => (
  <div className="min-h-[66px] py-2 flex items-center justify-between gap-6">
    <div className="min-w-0">
      <div className="text-[17px] leading-6 font-semibold text-tinta">
        {nombre}
      </div>
      {frase && (
        <div className="text-[15px] leading-[22px] text-tinta-2">{frase}</div>
      )}
    </div>
    {children && (
      <div className="shrink-0 flex items-center gap-3.5">{children}</div>
    )}
  </div>
);

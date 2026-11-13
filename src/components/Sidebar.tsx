import React from "react";
import { useTranslation } from "react-i18next";
import Logo from "./icons/Logo";
import { ActualizacionPie } from "./footer/ActualizacionPie";
import {
  HomeSettings,
  DictionarySettings,
  GeneralSettings,
  AboutSettings,
  HelpSettings,
  AccountSettings,
} from "./settings";
import { ComoFunciona } from "./settings/como-funciona/ComoFunciona";

export type SidebarSection = keyof typeof SECTIONS_CONFIG;

interface SectionConfig {
  labelKey: string;
  component: React.ComponentType;
  enabled: (settings: any) => boolean;
}

// CloseLabs Voice: menú tipo Aztec, limpio y para no-técnicos.
// La clave `general` = pantalla "Configuración" (App usa `general` como fallback).
// Sin "Instrucciones" desde 2026-11-11: su carrusel de 6 pasos repetía la frase de Inicio y el
// dictado de prueba (que se abre desde Inicio). Siete secciones eran demasiadas.
export const SECTIONS_CONFIG = {
  home: {
    labelKey: "sidebar.home",
    component: HomeSettings,
    enabled: () => true,
  },
  // Sección propia del video "Así se dicta" (Nicolás, 2026-11-13).
  howto: {
    labelKey: "sidebar.howTo",
    component: ComoFunciona,
    enabled: () => true,
  },
  dictionary: {
    labelKey: "sidebar.dictionary",
    component: DictionarySettings,
    enabled: () => true,
  },
  account: {
    labelKey: "sidebar.account",
    component: AccountSettings,
    enabled: () => true,
  },
  general: {
    labelKey: "sidebar.config",
    component: GeneralSettings,
    enabled: () => true,
  },
  about: {
    labelKey: "sidebar.about",
    component: AboutSettings,
    enabled: () => true,
  },
  help: {
    labelKey: "sidebar.help",
    component: HelpSettings,
    enabled: () => true,
  },
} as const satisfies Record<string, SectionConfig>;

interface SidebarProps {
  activeSection: SidebarSection;
  onSectionChange: (section: SidebarSection) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onSectionChange,
}) => {
  const { t } = useTranslation();

  // Todas las secciones están siempre visibles (menú simple, sin condicionales).
  const sections = Object.entries(SECTIONS_CONFIG).map(([id, config]) => ({
    id: id as SidebarSection,
    ...config,
  }));

  // «Tinta y voz» (diseno/SISTEMA.md §9): menú de 248 en lino, sin íconos; la sección activa en
  // papel con una raya lila de 3 px a la izquierda; abajo, el estado ("Lista para dictar").
  return (
    <div className="flex flex-col w-[248px] h-full shrink-0 bg-lino pt-3.5 px-4 pb-5">
      <div className="pt-1 pb-[26px] px-2">
        <Logo width={132} />
      </div>
      <nav className="flex flex-col gap-0.5">
        {sections.map((section) => {
          const isActive = activeSection === section.id;
          return (
            <button
              key={section.id}
              onClick={() => onSectionChange(section.id)}
              className={`relative h-[46px] w-full px-4 rounded-[10px] text-left text-[17px] transition-colors duration-150 ${
                isActive
                  ? "bg-papel shadow-1 text-tinta font-semibold"
                  : "text-tinta-2 font-medium hover:bg-white/60"
              }`}
            >
              {isActive && (
                <span className="absolute left-0 top-[11px] bottom-[11px] w-[3px] rounded-[2px] bg-lila" />
              )}
              <span className="truncate">{t(section.labelKey)}</span>
            </button>
          );
        })}
      </nav>
      <div className="mt-auto px-4 flex flex-col items-start gap-3">
        <ActualizacionPie />
        <EstadoConexion />
      </div>
    </div>
  );
};

/**
 * El estado al pie del menú: punto verde "Lista para dictar", o ámbar "Sin internet" (sin internet
 * se sigue dictando con el modo local, sin pulir). Reemplaza al pie de página de antes, que decía
 * "Sin Modelo - Descarga Requerida" en rojo (revisión del 2026-11-11).
 */
const EstadoConexion: React.FC = () => {
  const [enLinea, setEnLinea] = React.useState(() => navigator.onLine);
  React.useEffect(() => {
    const si = () => setEnLinea(true);
    const no = () => setEnLinea(false);
    window.addEventListener("online", si);
    window.addEventListener("offline", no);
    return () => {
      window.removeEventListener("online", si);
      window.removeEventListener("offline", no);
    };
  }, []);
  return (
    // eslint-disable-next-line i18next/no-literal-string
    <span className="inline-flex items-center gap-2 text-[15px] leading-[22px] text-tinta-2">
      <span
        className={`w-[9px] h-[9px] rounded-full ${enLinea ? "bg-hecho" : "bg-aviso-punto"}`}
      />
      {enLinea ? "Lista para dictar" : "Sin internet"}
    </span>
  );
};

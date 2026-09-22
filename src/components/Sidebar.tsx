import React from "react";
import { useTranslation } from "react-i18next";
import {
  Home,
  BookMarked,
  Settings,
  GraduationCap,
  Info,
  LifeBuoy,
  UserRound,
} from "lucide-react";
import Logo from "./icons/Logo";
import {
  HomeSettings,
  DictionarySettings,
  GeneralSettings,
  InstructionsSettings,
  AboutSettings,
  HelpSettings,
  AccountSettings,
} from "./settings";

export type SidebarSection = keyof typeof SECTIONS_CONFIG;

interface IconProps {
  width?: number | string;
  height?: number | string;
  size?: number | string;
  className?: string;
  [key: string]: any;
}

interface SectionConfig {
  labelKey: string;
  icon: React.ComponentType<IconProps>;
  component: React.ComponentType;
  enabled: (settings: any) => boolean;
}

// CloseLabs Voice: menú tipo Aztec, limpio y para no-técnicos.
// La clave `general` = pantalla "Configuración" (App usa `general` como fallback).
export const SECTIONS_CONFIG = {
  home: {
    labelKey: "sidebar.home",
    icon: Home,
    component: HomeSettings,
    enabled: () => true,
  },
  dictionary: {
    labelKey: "sidebar.dictionary",
    icon: BookMarked,
    component: DictionarySettings,
    enabled: () => true,
  },
  instructions: {
    labelKey: "sidebar.instructions",
    icon: GraduationCap,
    component: InstructionsSettings,
    enabled: () => true,
  },
  account: {
    labelKey: "sidebar.account",
    icon: UserRound,
    component: AccountSettings,
    enabled: () => true,
  },
  general: {
    labelKey: "sidebar.config",
    icon: Settings,
    component: GeneralSettings,
    enabled: () => true,
  },
  about: {
    labelKey: "sidebar.about",
    icon: Info,
    component: AboutSettings,
    enabled: () => true,
  },
  help: {
    labelKey: "sidebar.help",
    icon: LifeBuoy,
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

  return (
    <div className="flex flex-col w-48 h-full shrink-0 bg-brand-sidebar border-e border-brand-border px-3 pt-5 pb-3">
      <div className="px-2 pb-5">
        <Logo width={128} />
      </div>
      <nav className="flex flex-col gap-1">
        {sections.map((section) => {
          const Icon = section.icon;
          const isActive = activeSection === section.id;
          return (
            <button
              key={section.id}
              onClick={() => onSectionChange(section.id)}
              className={`flex gap-2.5 items-center px-3 py-2.5 w-full rounded-xl text-[14px] transition-colors ${
                isActive
                  ? "bg-brand-accent-soft text-brand-accent font-semibold"
                  : "text-brand-text-secondary hover:bg-brand-surface hover:text-text font-medium"
              }`}
            >
              <Icon
                width={18}
                height={18}
                className="shrink-0"
                strokeWidth={isActive ? 2.4 : 2}
              />
              <span className="truncate">{t(section.labelKey)}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};

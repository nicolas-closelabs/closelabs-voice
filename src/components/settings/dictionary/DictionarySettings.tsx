import React from "react";
import { useTranslation } from "react-i18next";
import { SettingsGroup } from "../../ui/SettingsGroup";
import { CustomWords } from "../CustomWords";

/**
 * Sección "Diccionario" (CloseLabs Voice): términos personalizados que el médico agrega
 * (medicamentos, diagnósticos, nombres) para que la transcripción los corrija hacia la
 * forma correcta. Reutiliza el componente `CustomWords`.
 */
export const DictionarySettings: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="max-w-3xl w-full mx-auto space-y-6">
      <SettingsGroup title={t("sidebar.dictionary")}>
        <CustomWords descriptionMode="inline" grouped />
      </SettingsGroup>
    </div>
  );
};

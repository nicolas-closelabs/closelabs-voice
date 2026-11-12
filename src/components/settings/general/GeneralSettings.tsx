/* eslint-disable i18next/no-literal-string */
import React from "react";
import { ShortcutInput } from "../ShortcutInput";
import { SettingsGroup } from "../../ui/SettingsGroup";
import { PasteMethodSetting } from "../PasteMethod";
import { TodoMayusculas } from "../TodoMayusculas";
import { MicrophoneSelector } from "../MicrophoneSelector";
import { AudioFeedback } from "../AudioFeedback";
import { AutostartToggle } from "../AutostartToggle";
import { Titulo } from "../../tinta/Titulo";

/**
 * Configuración («Tinta y voz», diseno/SISTEMA.md §10): renglones con su explicación a la vista,
 * sin jerga ni inglés. Solo lo que un médico cambia de verdad; lo técnico (aceleración, VAD,
 * teclado, tiempos, volumen, dispositivo de salida, ícono de la bandeja) queda en sus valores.
 *
 * "Entrega del texto" (pegar solo / solo copiar) se mantiene aunque el diseño no la dibuja: es la
 * salida para los sistemas donde el pegado automático no entra (caso gMedic, 2026-10-28).
 */
export const GeneralSettings: React.FC = () => {
  return (
    <div>
      <Titulo>Configuración</Titulo>

      <SettingsGroup title="Dictado">
        <ShortcutInput shortcutId="transcribe" grouped={true} />
        <MicrophoneSelector descriptionMode="inline" grouped={true} />
      </SettingsGroup>

      <SettingsGroup title="El texto">
        <TodoMayusculas descriptionMode="inline" grouped={true} />
        <AudioFeedback descriptionMode="inline" grouped={true} />
        <PasteMethodSetting descriptionMode="inline" grouped={true} />
      </SettingsGroup>

      <SettingsGroup title="El computador">
        <AutostartToggle descriptionMode="inline" grouped={true} />
      </SettingsGroup>
    </div>
  );
};

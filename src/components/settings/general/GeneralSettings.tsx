/* eslint-disable i18next/no-literal-string */
import React from "react";
import { type } from "@tauri-apps/plugin-os";
import { ShortcutInput } from "../ShortcutInput";
import { SettingsGroup } from "../../ui/SettingsGroup";
import { PushToTalk } from "../PushToTalk";
import { PasteMethodSetting } from "../PasteMethod";
import { MicrophoneSelector } from "../MicrophoneSelector";
import { MuteWhileRecording } from "../MuteWhileRecording";
import { AudioFeedback } from "../AudioFeedback";
import { OutputDeviceSelector } from "../OutputDeviceSelector";
import { VolumeSlider } from "../VolumeSlider";
import { AutostartToggle } from "../AutostartToggle";
import { ShowTrayIcon } from "../ShowTrayIcon";
import { useSettings } from "../../../hooks/useSettings";

/**
 * Configuración (CloseLabs Voice): una sola pantalla simple para el médico. Junta lo
 * esencial de General + Avanzado en grupos claros y ESCONDE lo técnico (aceleración,
 * VAD, keyboard impl, timeouts, experimental…), que se quedan con sus defaults.
 */
export const GeneralSettings: React.FC = () => {
  const { audioFeedbackEnabled, getSetting } = useSettings();
  const pushToTalk = getSetting("push_to_talk");
  const isLinux = type() === "linux";

  return (
    <div className="max-w-3xl w-full mx-auto space-y-6 py-2">
      <h1 className="font-heading font-bold text-2xl px-1">Configuración</h1>

      <SettingsGroup title="General">
        <ShortcutInput shortcutId="transcribe" grouped={true} />
        <PushToTalk descriptionMode="tooltip" grouped={true} />
        {!isLinux && !pushToTalk && (
          <ShortcutInput shortcutId="cancel" grouped={true} />
        )}
      </SettingsGroup>

      <SettingsGroup title="Entrega del texto">
        <PasteMethodSetting descriptionMode="tooltip" grouped={true} />
      </SettingsGroup>

      <SettingsGroup title="Sonido">
        <MicrophoneSelector descriptionMode="tooltip" grouped={true} />
        <MuteWhileRecording descriptionMode="tooltip" grouped={true} />
        <AudioFeedback descriptionMode="tooltip" grouped={true} />
        <OutputDeviceSelector
          descriptionMode="tooltip"
          grouped={true}
          disabled={!audioFeedbackEnabled}
        />
        <VolumeSlider disabled={!audioFeedbackEnabled} />
      </SettingsGroup>

      <SettingsGroup title="Aplicación">
        <AutostartToggle descriptionMode="tooltip" grouped={true} />
        <ShowTrayIcon descriptionMode="tooltip" grouped={true} />
      </SettingsGroup>
    </div>
  );
};

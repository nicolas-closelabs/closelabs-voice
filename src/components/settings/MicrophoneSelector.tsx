import React from "react";
import { useTranslation } from "react-i18next";
import { Dropdown } from "../ui/Dropdown";
import { SettingContainer } from "../ui/SettingContainer";
import { ResetButton } from "../ui/ResetButton";
import { useSettings } from "../../hooks/useSettings";
import {
  classifyMicrophone,
  findBuiltInMicrophone,
} from "../../lib/utils/microphone";

interface MicrophoneSelectorProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
}

export const MicrophoneSelector: React.FC<MicrophoneSelectorProps> = React.memo(
  ({ descriptionMode = "tooltip", grouped = false }) => {
    const { t } = useTranslation();
    const {
      getSetting,
      updateSetting,
      resetSetting,
      isUpdating,
      isLoading,
      audioDevices,
      refreshAudioDevices,
    } = useSettings();

    const selectedMicrophone =
      getSetting("selected_microphone") === "default"
        ? "Default"
        : getSetting("selected_microphone") || "Default";

    const handleMicrophoneSelect = async (deviceName: string) => {
      await updateSetting("selected_microphone", deviceName);
    };

    const handleReset = async () => {
      await resetSetting("selected_microphone");
    };

    // El micrófono del computador se marca como recomendado: arranca al instante, a
    // diferencia de los audífonos Bluetooth.
    const builtInName = findBuiltInMicrophone(audioDevices.map((d) => d.name));
    const microphoneOptions = audioDevices.map((device) => ({
      value: device.name,
      label:
        device.name === builtInName
          ? `${device.name} — ${t("settings.sound.microphone.recommended")}`
          : device.name,
    }));

    // Con "Default" el sistema decide, así que el aviso también aplica si hay audífonos
    // Bluetooth conectados y podrían tomar el turno.
    const bluetoothSelected =
      classifyMicrophone(selectedMicrophone) === "bluetooth" ||
      (selectedMicrophone === "Default" &&
        audioDevices.some((d) => classifyMicrophone(d.name) === "bluetooth"));

    return (
      <SettingContainer
        title={t("settings.sound.microphone.title")}
        description={t("settings.sound.microphone.description")}
        descriptionMode={descriptionMode}
        grouped={grouped}
      >
        <div className="flex items-center space-x-1">
          <Dropdown
            options={microphoneOptions}
            selectedValue={selectedMicrophone}
            onSelect={handleMicrophoneSelect}
            placeholder={
              isLoading || audioDevices.length === 0
                ? t("settings.sound.microphone.loading")
                : t("settings.sound.microphone.placeholder")
            }
            disabled={
              isUpdating("selected_microphone") ||
              isLoading ||
              audioDevices.length === 0
            }
            onRefresh={refreshAudioDevices}
          />
          <ResetButton
            onClick={handleReset}
            disabled={isUpdating("selected_microphone") || isLoading}
          />
        </div>
        {bluetoothSelected && (
          <p className="mt-2 text-xs text-brand-text-secondary">
            {t("settings.sound.microphone.bluetoothWarning")}
          </p>
        )}
      </SettingContainer>
    );
  },
);

import React from "react";
import { ToggleSwitch } from "../ui/ToggleSwitch";
import { useSettings } from "../../hooks/useSettings";

interface TodoMayusculasProps {
  descriptionMode?: "inline" | "tooltip";
  grouped?: boolean;
}

/**
 * Todo el dictado en MAYÚSCULAS. Lo pidió el primer médico real (2026-10-09): en su historia
 * clínica todo se escribe así. Se aplica en la app al final de todo (`process_transcription_output`
 * en actions.rs), sin tocar la limpieza del texto.
 */
export const TodoMayusculas: React.FC<TodoMayusculasProps> = React.memo(
  ({ descriptionMode = "tooltip", grouped = false }) => {
    const { getSetting, updateSetting, isUpdating } = useSettings();

    return (
      <ToggleSwitch
        checked={getSetting("uppercase_output") ?? false}
        onChange={(enabled) => updateSetting("uppercase_output", enabled)}
        isUpdating={isUpdating("uppercase_output")}
        label="Escribir todo en MAYÚSCULAS"
        description="El texto dictado se pega completo en mayúsculas, incluidos los nombres de medicamentos y las unidades."
        descriptionMode={descriptionMode}
        grouped={grouped}
      />
    );
  },
);

import { useTranslation } from "react-i18next";
import { openUrl } from "@tauri-apps/plugin-opener";
import { AlertTriangle } from "lucide-react";
import { Button } from "./ui/Button";

interface VersionBlockedProps {
  message: string;
  downloadUrl: string;
}

/**
 * Pantalla que reemplaza toda la app cuando el servidor marca esta versión como no soportada.
 *
 * Es deliberadamente un callejón sin salida: no hay "continuar de todos modos". Solo aparece
 * cuando la versión instalada está rota o es peligrosa, y en ese caso dejarla usar sería el
 * problema, no la solución. El dictado ya está detenido en el backend (`actions.rs`), así que
 * esconder esta pantalla tampoco devolvería la función.
 *
 * El mensaje lo escribe quien toma la decisión, en la base de datos, y llega tal cual: así se
 * puede explicar el motivo real sin publicar una versión nueva solo para cambiar un texto.
 */
export default function VersionBlocked({
  message,
  downloadUrl,
}: VersionBlockedProps) {
  const { t } = useTranslation();

  return (
    <div className="h-screen flex flex-col items-center justify-center gap-5 px-10 text-center select-none">
      <div className="w-12 h-12 rounded-2xl bg-brand-accent-soft flex items-center justify-center">
        <AlertTriangle className="w-6 h-6 text-brand-accent" />
      </div>

      <h1 className="font-heading text-lg font-semibold">
        {t("blocked.title")}
      </h1>

      <p className="text-sm text-brand-text-secondary max-w-sm leading-relaxed">
        {message}
      </p>

      <Button variant="primary" size="lg" onClick={() => void openUrl(downloadUrl)}>
        {t("blocked.download")}
      </Button>

      {/* Sin internet el enlace no abre nada útil, así que la dirección queda a la vista para
          poder escribirla en otro equipo. */}
      <p className="text-xs text-brand-text-muted break-all">{downloadUrl}</p>
    </div>
  );
}

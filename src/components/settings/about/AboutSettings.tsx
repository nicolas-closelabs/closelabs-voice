/* eslint-disable i18next/no-literal-string */
import React, { useState, useEffect } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useActualizacion } from "@/stores/actualizacionStore";
import { Titulo } from "../../tinta/Titulo";
import { BotonSecundario, Enlace } from "../../tinta/Botones";
import { SettingsGroup } from "../../ui/SettingsGroup";
import { Renglon } from "../help/HelpSettings";

/**
 * Acerca de («Tinta y voz», diseno/SISTEMA.md §10): la versión con su estado de actualización,
 * privacidad, términos y quién la hace. Renglones, sin tarjeta.
 */
export const AboutSettings: React.FC = () => {
  const [version, setVersion] = useState("");
  const { estado, version: nueva, buscar } = useActualizacion();
  const [buscando, setBuscando] = useState(false);
  const [alDia, setAlDia] = useState<boolean | null>(null);

  useEffect(() => {
    getVersion()
      .then(setVersion)
      .catch(() => setVersion(""));
  }, []);

  const estadoVersion =
    estado === "descargando"
      ? `Descargando la versión ${nueva}…`
      : estado === "lista" || estado === "instalando"
        ? `La versión ${nueva} está lista: se instala al reiniciar.`
        : alDia === false
          ? "Hay una versión nueva."
          : "Tienes la última versión.";

  return (
    <div>
      <Titulo>Acerca de</Titulo>

      <SettingsGroup title="La aplicación">
        <Renglon nombre={`CloseLabs Voice ${version}`} frase={estadoVersion}>
          <BotonSecundario
            medida="corto"
            ocupado={buscando}
            onClick={async () => {
              setBuscando(true);
              try {
                const hay = await buscar();
                setAlDia(!hay);
              } finally {
                setBuscando(false);
              }
            }}
          >
            Buscar actualizaciones
          </BotonSecundario>
        </Renglon>
        <Renglon
          nombre="Privacidad"
          frase="Tus dictados no se almacenan ni se usan para entrenar modelos."
        >
          <Enlace chico onClick={() => void openUrl("https://closelabs.co/privacidad")}>
            Leer
          </Enlace>
        </Renglon>
        <Renglon nombre="Términos" frase="Las condiciones de uso del servicio.">
          <Enlace chico onClick={() => void openUrl("https://closelabs.co/terminos")}>
            Leer
          </Enlace>
        </Renglon>
      </SettingsGroup>

      <SettingsGroup title="Quién la hace">
        <Renglon
          nombre="CLOSELABS GROUP LLC"
          frase="Herramientas para que los médicos escriban menos y atiendan más."
        >
          <Enlace chico onClick={() => void openUrl("https://www.closelabs.co")}>
            closelabs.co
          </Enlace>
        </Renglon>
        <Renglon
          nombre="Basada en Handy"
          frase="Proyecto de código abierto de CJ Pais, con licencia MIT."
        />
      </SettingsGroup>
    </div>
  );
};

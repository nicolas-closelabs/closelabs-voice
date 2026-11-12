/* eslint-disable i18next/no-literal-string */
import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { platform } from "@tauri-apps/plugin-os";
import {
  checkAccessibilityPermission,
  requestAccessibilityPermission,
  checkMicrophonePermission,
  requestMicrophonePermission,
} from "tauri-plugin-macos-permissions-api";
import { toast } from "sonner";
import { commands } from "@/bindings";
import { useSettingsStore } from "@/stores/settingsStore";
import PlantillaPrimerUso from "../tinta/PlantillaPrimerUso";
import { ListaPasos, type EstadoPaso } from "../tinta/Pasos";
import { IlustracionVoz } from "../auth/Bienvenida";

interface AccessibilityOnboardingProps {
  onComplete: () => void;
}

type PermissionStatus = "checking" | "needed" | "waiting" | "granted";
type PermissionPlatform = "macos" | "windows" | "other";

interface PermissionsState {
  accessibility: PermissionStatus;
  microphone: PermissionStatus;
}

const AccessibilityOnboarding: React.FC<AccessibilityOnboardingProps> = ({
  onComplete,
}) => {
  const { t } = useTranslation();
  const refreshAudioDevices = useSettingsStore(
    (state) => state.refreshAudioDevices,
  );
  const refreshOutputDevices = useSettingsStore(
    (state) => state.refreshOutputDevices,
  );
  const [permissionPlatform, setPermissionPlatform] =
    useState<PermissionPlatform | null>(null);
  const [permissions, setPermissions] = useState<PermissionsState>({
    accessibility: "checking",
    microphone: "checking",
  });
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorCountRef = useRef<number>(0);
  const MAX_POLLING_ERRORS = 3;

  const isMacOS = permissionPlatform === "macos";
  const isWindows = permissionPlatform === "windows";
  const showMicrophonePermission = isMacOS || isWindows;
  const showAccessibilityPermission = isMacOS;

  const allGranted = isMacOS
    ? permissions.accessibility === "granted" &&
      permissions.microphone === "granted"
    : isWindows
      ? permissions.microphone === "granted"
      : true;

  const completeOnboarding = useCallback(async () => {
    await Promise.all([refreshAudioDevices(), refreshOutputDevices()]);
    timeoutRef.current = setTimeout(() => onComplete(), 300);
  }, [onComplete, refreshAudioDevices, refreshOutputDevices]);

  const hasWindowsMicrophoneAccess = useCallback(async (): Promise<boolean> => {
    const microphoneStatus =
      await commands.getWindowsMicrophonePermissionStatus();

    if (!microphoneStatus.supported) {
      return true;
    }

    return microphoneStatus.overall_access !== "denied";
  }, []);

  // Check platform and permission status on mount
  useEffect(() => {
    const currentPlatform = platform();
    const nextPlatform: PermissionPlatform =
      currentPlatform === "macos"
        ? "macos"
        : currentPlatform === "windows"
          ? "windows"
          : "other";

    setPermissionPlatform(nextPlatform);

    // Skip immediately on unsupported platforms
    if (nextPlatform === "other") {
      onComplete();
      return;
    }

    const checkInitial = async () => {
      if (nextPlatform === "macos") {
        try {
          const [accessibilityGranted, microphoneGranted] = await Promise.all([
            checkAccessibilityPermission(),
            checkMicrophonePermission(),
          ]);

          // If accessibility is granted, initialize Enigo and shortcuts
          if (accessibilityGranted) {
            try {
              await Promise.all([
                commands.initializeEnigo(),
                commands.initializeShortcuts(),
              ]);
            } catch (e) {
              console.warn("Failed to initialize after permission grant:", e);
            }
          }

          const newState: PermissionsState = {
            accessibility: accessibilityGranted ? "granted" : "needed",
            microphone: microphoneGranted ? "granted" : "needed",
          };

          setPermissions(newState);

          if (accessibilityGranted && microphoneGranted) {
            await completeOnboarding();
          }
        } catch (error) {
          console.error("Failed to check macOS permissions:", error);
          toast.error(t("onboarding.permissions.errors.checkFailed"));
          setPermissions({
            accessibility: "needed",
            microphone: "needed",
          });
        }

        return;
      }

      try {
        const microphoneGranted = await hasWindowsMicrophoneAccess();

        setPermissions({
          accessibility: "granted",
          microphone: microphoneGranted ? "granted" : "needed",
        });

        if (microphoneGranted) {
          await completeOnboarding();
        }
      } catch (error) {
        console.warn("Failed to check Windows microphone permissions:", error);
        setPermissions({
          accessibility: "granted",
          microphone: "granted",
        });
        await completeOnboarding();
      }
    };

    checkInitial();
  }, [completeOnboarding, hasWindowsMicrophoneAccess, onComplete, t]);

  // Polling for permissions after user clicks a button
  const startPolling = useCallback(() => {
    if (pollingRef.current || permissionPlatform === null) return;

    pollingRef.current = setInterval(async () => {
      try {
        if (permissionPlatform === "windows") {
          const microphoneGranted = await hasWindowsMicrophoneAccess();

          if (microphoneGranted) {
            setPermissions((prev) => ({ ...prev, microphone: "granted" }));

            if (pollingRef.current) {
              clearInterval(pollingRef.current);
              pollingRef.current = null;
            }

            await completeOnboarding();
          }

          errorCountRef.current = 0;
          return;
        }

        const [accessibilityGranted, microphoneGranted] = await Promise.all([
          checkAccessibilityPermission(),
          checkMicrophonePermission(),
        ]);

        setPermissions((prev) => {
          const newState = { ...prev };

          if (accessibilityGranted && prev.accessibility !== "granted") {
            newState.accessibility = "granted";
            // Initialize Enigo and shortcuts when accessibility is granted
            Promise.all([
              commands.initializeEnigo(),
              commands.initializeShortcuts(),
            ]).catch((e) => {
              console.warn("Failed to initialize after permission grant:", e);
            });
          }

          if (microphoneGranted && prev.microphone !== "granted") {
            newState.microphone = "granted";
          }

          return newState;
        });

        // If both granted, stop polling, refresh audio devices, and proceed
        if (accessibilityGranted && microphoneGranted) {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          // El médico está mirando Ajustes del Sistema, que tapa nuestra ventana. Se la traemos al
          // frente: un "vuelve aquí" escrito no basta para quien no sabe cambiar de ventana.
          await commands.ocultarGuiaAjustes().catch(() => {});
          await commands.showMainWindowCommand().catch(() => {});
          await completeOnboarding();
        }

        // Reset error count on success
        errorCountRef.current = 0;
      } catch (error) {
        console.error("Error checking permissions:", error);
        errorCountRef.current += 1;

        if (errorCountRef.current >= MAX_POLLING_ERRORS) {
          // Stop polling after too many consecutive errors
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          toast.error(t("onboarding.permissions.errors.checkFailed"));
        }
      }
    }, 1000);
  }, [completeOnboarding, hasWindowsMicrophoneAccess, permissionPlatform, t]);

  // Cleanup polling and timeouts on unmount
  useEffect(() => {
    return () => {
      void commands.ocultarGuiaAjustes().catch(() => {});
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleGrantAccessibility = async () => {
    try {
      await requestAccessibilityPermission();
      setPermissions((prev) => ({ ...prev, accessibility: "waiting" }));
      // La ventanita pegada debajo de Ajustes del Sistema: dice qué tocar (guia_ajustes.rs).
      void commands.mostrarGuiaAjustes().catch(() => {});
      startPolling();
    } catch (error) {
      console.error("Failed to request accessibility permission:", error);
      toast.error(t("onboarding.permissions.errors.requestFailed"));
    }
  };

  const handleGrantMicrophone = async () => {
    try {
      if (isWindows) {
        await commands.openMicrophonePrivacySettings();
      } else {
        await requestMicrophonePermission();
      }

      setPermissions((prev) => ({ ...prev, microphone: "waiting" }));
      startPolling();
    } catch (error) {
      console.error("Failed to request microphone permission:", error);
      toast.error(t("onboarding.permissions.errors.requestFailed"));
    }
  };

  const isChecking =
    permissionPlatform === null ||
    (isMacOS &&
      permissions.accessibility === "checking" &&
      permissions.microphone === "checking") ||
    (isWindows && permissions.microphone === "checking");

  // Mientras se averigua (un instante): la misma hoja en blanco, sin ruedas girando.
  if (isChecking) {
    return <div className="h-screen w-screen bg-papel" />;
  }

  // «Tinta y voz» (diseno/SISTEMA.md §7, pantalla 4): una lista de dos pasos y UN botón.
  //
  // ⚠️ El botón hace lo que toca ahora: primero pide el micrófono (macOS muestra su aviso) y después
  // abre Ajustes del Sistema. Al abrir Ajustes aparece la ventanita pegada debajo de Ajustes
  // (`guia_ajustes.rs`) que dice qué tocar: el dibujo de antes quedaba DETRÁS de Ajustes justo cuando
  // el médico lo necesitaba.
  const micListo = permissions.microphone === "granted";
  const accListo = permissions.accessibility === "granted";
  const estadoDe = (p: PermissionStatus, turno: boolean): EstadoPaso =>
    p === "granted"
      ? "hecho"
      : p === "waiting"
        ? "en-curso"
        : turno
          ? "ahora"
          : "pendiente";

  const pasos = [
    {
      nombre: "Micrófono",
      frase: "Para oír lo que dictas.",
      estado: estadoDe(permissions.microphone, true),
    },
    ...(isMacOS
      ? [
          {
            nombre: "Accesibilidad",
            frase: "Para escribir el texto donde tengas el cursor.",
            estado: estadoDe(permissions.accessibility, micListo),
          },
        ]
      : []),
  ];

  const principal = allGranted
    ? undefined
    : !micListo
      ? {
          texto: isWindows
            ? "Abrir la configuración de Windows"
            : "Permitir el micrófono",
          onClick: () => void handleGrantMicrophone(),
        }
      : {
          texto:
            permissions.accessibility === "waiting"
              ? "Abrir Ajustes del Sistema otra vez"
              : "Abrir Ajustes del Sistema",
          onClick: () => void handleGrantAccessibility(),
        };

  return (
    <PlantillaPrimerUso
      clave="permisos"
      etapa={isMacOS ? "permisos" : "cuenta"}
      titulo={isMacOS ? "Dos permisos y *listo*." : "Un permiso y *listo*."}
      apoyo={
        isMacOS
          ? "macOS te los pide una sola vez."
          : "Windows te lo pide una sola vez."
      }
      principal={principal}
      escenario={isMacOS && micListo && !accListo ? <MiniAjustes /> : <IlustracionVoz />}
      notaEscenario={
        isMacOS && micListo && !accListo
          ? "Se abre Ajustes del Sistema y te señalamos dónde tocar."
          : undefined
      }
      mensajeAyuda="Hola, no logro dar los permisos de CloseLabs Voice."
    >
      <ListaPasos pasos={pasos} />
    </PlantillaPrimerUso>
  );
};

/**
 * Adelanto de lo que va a ver: Ajustes del Sistema en Accesibilidad, con CloseLabs Voice apagado, y
 * nuestra ventanita pegada debajo. Dibujado con la interfaz del sistema, no con nuestro estilo, para
 * que lo reconozca al verlo de verdad.
 */
const MiniAjustes: React.FC = () => {
  const filas: [string, boolean, boolean][] = [
    ["Google Chrome", true, false],
    ["CloseLabs Voice", false, true],
    ["Microsoft Word", true, false],
    ["Zoom", false, false],
  ];
  return (
    <div className="flex flex-col items-center" aria-hidden>
      <div className="w-[436px] h-[250px] rounded-[12px] bg-[#F6F5F8] shadow-2 border border-linea overflow-hidden flex">
        <div className="w-[120px] bg-[#ECEAF0] p-4 flex flex-col gap-2.5">
          {[70, 54, 82, 64, 76, 50].map((w, i) => (
            <span key={i} className="h-2 rounded bg-[#D6D3DC]" style={{ width: w }} />
          ))}
        </div>
        <div className="flex-1 p-4 font-[system-ui] text-left">
          <div className="text-[13px] font-semibold text-[#1d1d1f]">Accesibilidad</div>
          <div className="text-[10px] text-[#6e6e73] mb-3">
            Permite que estas apps controlen tu computador.
          </div>
          <div className="rounded-[8px] bg-white border border-[#E3E1E7] overflow-hidden">
            {filas.map(([nombre, on, nuestra]) => (
              <div
                key={nombre}
                className="h-[34px] px-3 flex items-center gap-2.5 border-b last:border-b-0 border-[#EEECF1]"
              >
                {nuestra ? (
                  <img
                    src="/brand/closelabs-isotype-black.png"
                    alt=""
                    className="w-[18px] h-[18px] object-contain"
                  />
                ) : (
                  <span className="w-[18px] h-[18px] rounded-[5px] bg-[#E3E1E7]" />
                )}
                <span className="flex-1 text-[12px] text-[#1d1d1f]">{nombre}</span>
                <span
                  className={`w-[30px] h-[18px] rounded-full relative ${
                    on ? "bg-[#3478F6]" : "bg-[#E1DFE5]"
                  } ${nuestra ? "ring-[3px] ring-lila ring-offset-1" : ""}`}
                >
                  <span
                    className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow ${
                      on ? "left-[14px]" : "left-[2px]"
                    }`}
                  />
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="-mt-2 w-[380px] rounded-[14px] bg-noche border border-white/18 shadow-flota px-4 py-3 flex items-center gap-3">
        <span className="grid place-items-center w-8 h-8 shrink-0 rounded-full bg-lila">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 19V5M12 5l-6 6M12 5l6 6"
              stroke="#fff"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className="flex-1 text-[13px] leading-[18px] text-white text-left">
          Busca <strong>CloseLabs Voice</strong> en la lista de arriba y enciende
          su interruptor.
        </span>
      </div>
    </div>
  );
};

export default AccessibilityOnboarding;

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
import Logo from "../icons/Logo";
import GuiaAccesibilidadMac from "./GuiaAccesibilidadMac";
import { Keyboard, Mic, Check, Loader2 } from "lucide-react";

interface AccessibilityOnboardingProps {
  onComplete: () => void;
  /** Ya usaba la app (viene de una versión anterior): solo a esa persona le sirve el aviso de
      apagar y encender el interruptor. */
  actualizando?: boolean;
}

type PermissionStatus = "checking" | "needed" | "waiting" | "granted";
type PermissionPlatform = "macos" | "windows" | "other";

interface PermissionsState {
  accessibility: PermissionStatus;
  microphone: PermissionStatus;
}

const AccessibilityOnboarding: React.FC<AccessibilityOnboardingProps> = ({
  onComplete,
  actualizando = false,
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

  // Still checking platform/initial permissions
  if (isChecking) {
    return (
      <div className="h-screen w-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-text/50" />
      </div>
    );
  }

  // All permissions granted - show success briefly
  if (allGranted) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center gap-4">
        <div className="p-4 rounded-full bg-emerald-500/20">
          <Check className="w-12 h-12 text-emerald-400" />
        </div>
        <p className="text-lg font-medium text-text">
          {t("onboarding.permissions.allGranted")}
        </p>
      </div>
    );
  }

  // Un permiso a la vez, y en macOS la guía ANTES de abrir Ajustes del Sistema.
  //
  // ⚠️ Por qué: antes se mostraban los dos permisos juntos y la guía visual aparecía DESPUÉS de
  // presionar "Conceder permiso". Para entonces el médico ya estaba mirando la ventana del
  // sistema y no volvía a la nuestra: la ayuda llegaba tarde. Ahora primero ve el dibujo de lo
  // que va a pasar, y el botón abre Ajustes cuando él dice que está listo.
  const pasoActual = permissions.microphone !== "granted" ? "microfono" : "accesibilidad";
  const totalPasos = isMacOS ? 2 : 1;
  const numeroPaso = pasoActual === "microfono" ? 1 : 2;

  return (
    <div className="min-h-screen w-screen overflow-y-auto flex justify-center px-6 py-7">
      <div className="w-full max-w-md flex flex-col items-center gap-5">
        <div className="flex flex-col items-center gap-2 shrink-0">
          <Logo width={130} />
          <span className="text-[13px] font-semibold text-brand-text-muted">
            {t("onboarding.permissions.step", { actual: numeroPaso, total: totalPasos })}
          </span>
        </div>

        {pasoActual === "microfono" ? (
          <Paso
            icono={<Mic className="w-7 h-7 text-brand-accent" />}
            titulo={t("onboarding.permissions.microphone.title")}
            descripcion={t("onboarding.permissions.microphone.description")}
          >
            {permissions.microphone === "waiting" ? (
              <Esperando texto={t("onboarding.permissions.waitingMic")} />
            ) : (
              <>
                <p className="text-[15px] leading-relaxed text-brand-text-secondary">
                  {isWindows
                    ? t("onboarding.permissions.microphone.avisoWindows")
                    : t("onboarding.permissions.microphone.avisoMac")}
                </p>
                <BotonGrande onClick={handleGrantMicrophone}>
                  {isWindows
                    ? t("accessibility.openWindowsSettings")
                    : t("onboarding.permissions.microphone.boton")}
                </BotonGrande>
              </>
            )}
          </Paso>
        ) : (
          <Paso
            icono={<Keyboard className="w-7 h-7 text-brand-accent" />}
            titulo={t("onboarding.permissions.accessibility.title")}
            descripcion={t("onboarding.permissions.accessibility.description")}
          >
            <GuiaAccesibilidadMac actualizando={actualizando} />
            {permissions.accessibility === "waiting" ? (
              <Esperando texto={t("onboarding.permissions.waitingAcc")} />
            ) : (
              <BotonGrande onClick={handleGrantAccessibility}>
                {t("onboarding.permissions.accessibility.boton")}
              </BotonGrande>
            )}
          </Paso>
        )}
      </div>
    </div>
  );
};

/** La tarjeta de un paso: ícono, título, explicación y lo que toque hacer. */
const Paso: React.FC<{
  icono: React.ReactNode;
  titulo: string;
  descripcion: string;
  children: React.ReactNode;
}> = ({ icono, titulo, descripcion, children }) => (
  <div className="w-full flex flex-col gap-4">
    <div className="flex flex-col items-center text-center gap-2">
      <span className="grid place-items-center w-14 h-14 rounded-full bg-brand-accent-soft shrink-0">
        {icono}
      </span>
      <h2 className="font-heading text-2xl font-bold text-brand-text">{titulo}</h2>
      <p className="text-[16px] leading-relaxed text-brand-text-secondary">{descripcion}</p>
    </div>
    {children}
  </div>
);

const BotonGrande: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({
  onClick,
  children,
}) => (
  <button
    onClick={onClick}
    className="w-full shrink-0 px-4 py-3.5 rounded-xl text-[17px] font-semibold bg-brand-accent text-white hover:bg-brand-accent-secondary transition-colors"
  >
    {children}
  </button>
);

const Esperando: React.FC<{ texto: string }> = ({ texto }) => (
  <div className="flex items-center justify-center gap-2 text-[15px] text-brand-text-secondary">
    <Loader2 className="w-5 h-5 animate-spin text-brand-accent" />
    {texto}
  </div>
);

export default AccessibilityOnboarding;

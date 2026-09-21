import { useEffect, useState, useRef } from "react";
import { toast, Toaster } from "sonner";
import { useTranslation } from "react-i18next";
import { listen } from "@tauri-apps/api/event";
import { platform } from "@tauri-apps/plugin-os";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  checkAccessibilityPermission,
  checkMicrophonePermission,
  requestAccessibilityPermission,
} from "tauri-plugin-macos-permissions-api";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ModelStateEvent, RecordingErrorEvent } from "./lib/types/events";
import "./App.css";
import AccessibilityPermissions from "./components/AccessibilityPermissions";
import VersionBlocked from "./components/VersionBlocked";
import AuthGate from "./components/auth/AuthGate";
import Footer from "./components/footer";
import Onboarding, { AccessibilityOnboarding } from "./components/onboarding";
import { Sidebar, SidebarSection, SECTIONS_CONFIG } from "./components/Sidebar";
import { useSettings } from "./hooks/useSettings";
import { useSettingsStore } from "./stores/settingsStore";
import { commands } from "@/bindings";
import { getLanguageDirection, initializeRTL } from "@/lib/utils/rtl";

type OnboardingStep = "accessibility" | "model" | "done";

const renderSettingsContent = (section: SidebarSection) => {
  const ActiveComponent =
    SECTIONS_CONFIG[section]?.component || SECTIONS_CONFIG.general.component;
  return <ActiveComponent />;
};

function App() {
  const { t, i18n } = useTranslation();
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep | null>(
    null,
  );
  // Track if this is a returning user who just needs to grant permissions
  // (vs a new user who needs full onboarding including model selection)
  const [isReturningUser, setIsReturningUser] = useState(false);
  const [currentSection, setCurrentSection] = useState<SidebarSection>("home");
  const { settings, updateSetting } = useSettings();
  const direction = getLanguageDirection(i18n.language);
  const refreshAudioDevices = useSettingsStore(
    (state) => state.refreshAudioDevices,
  );
  const refreshOutputDevices = useSettingsStore(
    (state) => state.refreshOutputDevices,
  );
  const hasCompletedPostOnboardingInit = useRef(false);
  // Configuración remota: `null` mientras esta versión siga siendo válida.
  const [blocked, setBlocked] = useState<{
    message: string;
    download_url: string;
  } | null>(null);
  // Sesión. `null` mientras se averigua; después, si hay cuenta o no.
  const [signedIn, setSignedIn] = useState<boolean | null>(null);


  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  // Initialize RTL direction when language changes
  useEffect(() => {
    initializeRTL(i18n.language);
  }, [i18n.language]);

  // Initialize Enigo, shortcuts, and refresh audio devices when main app loads
  useEffect(() => {
    if (onboardingStep === "done" && !hasCompletedPostOnboardingInit.current) {
      hasCompletedPostOnboardingInit.current = true;
      Promise.all([
        commands.initializeEnigo(),
        commands.initializeShortcuts(),
      ]).catch((e) => {
        console.warn("Failed to initialize:", e);
      });
      refreshAudioDevices();
      refreshOutputDevices();
    }
  }, [onboardingStep, refreshAudioDevices, refreshOutputDevices]);

  // Handle keyboard shortcuts for debug mode toggle
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Ctrl+Shift+D (Windows/Linux) or Cmd+Shift+D (macOS)
      const isDebugShortcut =
        event.shiftKey &&
        event.key.toLowerCase() === "d" &&
        (event.ctrlKey || event.metaKey);

      if (isDebugShortcut) {
        event.preventDefault();
        const currentDebugMode = settings?.debug_mode ?? false;
        updateSetting("debug_mode", !currentDebugMode);
      }
    };

    // Add event listener when component mounts
    document.addEventListener("keydown", handleKeyDown);

    // Cleanup event listener when component unmounts
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [settings?.debug_mode, updateSetting]);

  // Listen for recording errors from the backend and show a toast
  useEffect(() => {
    const unlisten = listen<RecordingErrorEvent>("recording-error", (event) => {
      const { error_type, detail } = event.payload;

      if (error_type === "microphone_permission_denied") {
        const currentPlatform = platform();
        const platformKey = `errors.micPermissionDenied.${currentPlatform}`;
        const description = t(platformKey, {
          defaultValue: t("errors.micPermissionDenied.generic"),
        });
        toast.error(t("errors.micPermissionDeniedTitle"), { description });
      } else if (error_type === "no_input_device") {
        toast.error(t("errors.noInputDeviceTitle"), {
          description: t("errors.noInputDevice"),
        });
      } else {
        toast.error(
          t("errors.recordingFailed", { error: detail ?? "Unknown error" }),
        );
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [t]);

  // Listen for paste failures and show a toast.
  // The technical error detail is logged to handy.log on the Rust side
  // (see actions.rs `error!("Failed to paste transcription: ...")`),
  // so we show a localized, user-friendly message here instead of the raw error.
  useEffect(() => {
    const unlisten = listen("paste-error", () => {
      toast.error(t("errors.pasteFailedTitle"), {
        description: t("errors.pasteFailed"),
      });
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [t]);

  // El atajo de reprocesar se apretó sin tener audio en memoria. Se avisa para que el médico
  // no crea que el atajo está roto.
  useEffect(() => {
    const unlisten = listen("reprocess-unavailable", () => {
      toast.info(t("errors.reprocessUnavailableTitle"), {
        description: t("errors.reprocessUnavailable"),
      });
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [t]);

  // Sesión del médico. Se pregunta al montar y tras entrar o salir.
  const refreshAuth = async () => {
    try {
      const estado = await commands.accountState();
      // ⚠️ `signed_in` es true cuando hay sesión GUARDADA, aunque ahora mismo no haya internet
      // (ver `account_state` en auth.rs). Por eso esto no expulsa a nadie por un corte de red.
      setSignedIn(estado.status === "ok" ? estado.data.signed_in : false);
    } catch (e) {
      console.warn("No se pudo leer el estado de la cuenta:", e);
      setSignedIn(false);
    }
  };

  useEffect(() => {
    void refreshAuth();
  }, []);

  // Configuración remota (`remote_config.rs`). Dos caminos porque hay una carrera real: el
  // backend consulta al servidor a los pocos segundos de arrancar y puede responder ANTES de que
  // esta ventana exista, y entonces el evento se emitiría sin que nadie lo escuche. Por eso
  // también se pregunta el estado al montar.
  useEffect(() => {
    commands
      .getBlockState()
      .then((state) => setBlocked(state ?? null))
      .catch((e) => console.warn("No se pudo leer el estado de bloqueo:", e));

    const unBlocked = listen<{ message: string; download_url: string }>(
      "app-blocked",
      async (event) => {
        setBlocked(event.payload);
        // Si la app estaba oculta en la bandeja, el médico solo vería que el atajo dejó de
        // responder. La ventana tiene que aparecer para explicar por qué.
        const win = getCurrentWindow();
        await win.show();
        await win.setFocus();
      },
    );
    const unUnblocked = listen("app-unblocked", () => setBlocked(null));

    return () => {
      unBlocked.then((fn) => fn());
      unUnblocked.then((fn) => fn());
    };
  }, []);

  // Hay una versión nueva, pero esta sigue sirviendo: se avisa y se puede cerrar el aviso.
  useEffect(() => {
    const unlisten = listen<{ latest_version: string; download_url: string }>(
      "update-available",
      (event) => {
        toast.info(t("blocked.updateTitle"), {
          description: t("blocked.updateBody", {
            version: event.payload.latest_version,
          }),
          duration: 15000,
          action: {
            label: t("blocked.download"),
            onClick: () => void openUrl(event.payload.download_url),
          },
        });
      },
    );
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [t]);

  // macOS sin permiso de Accesibilidad: el texto quedó en el portapapeles. Se muestra la
  // ventana (si estaba oculta el toast no se vería) con la acción para dar el permiso.
  useEffect(() => {
    const unlisten = listen("paste-needs-manual", async () => {
      const win = getCurrentWindow();
      await win.show();
      await win.setFocus();
      toast.warning(t("errors.pasteNeedsManualTitle"), {
        description: t("errors.pasteNeedsManual"),
        duration: 15000,
        action: {
          label: t("errors.grantAccessibility"),
          onClick: () => {
            requestAccessibilityPermission().catch((e) =>
              console.error("Failed to request accessibility permission:", e),
            );
          },
        },
      });
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [t]);

  // Listen for transcription failures and show a toast.
  // The payload is the backend error message (also logged to handy.log).
  useEffect(() => {
    const unlisten = listen<string>("transcription-error", (event) => {
      toast.error(t("errors.transcriptionFailedTitle"), {
        description: event.payload,
      });
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [t]);

  // Listen for model loading failures and show a toast
  useEffect(() => {
    const unlisten = listen<ModelStateEvent>("model-state-changed", (event) => {
      if (event.payload.event_type === "loading_failed") {
        toast.error(
          t("errors.modelLoadFailed", {
            model:
              event.payload.model_name || t("errors.modelLoadFailedUnknown"),
          }),
          {
            description: event.payload.error,
          },
        );
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [t]);

  const revealMainWindowForPermissions = async () => {
    try {
      await commands.showMainWindowCommand();
    } catch (e) {
      console.warn("Failed to show main window for permission onboarding:", e);
    }
  };

  const checkOnboardingStatus = async () => {
    try {
      const settingsResult = await commands.getAppSettings();
      const hasCompletedOnboarding =
        settingsResult.status === "ok" &&
        settingsResult.data.onboarding_completed === true;
      const currentPlatform = platform();

      if (hasCompletedOnboarding) {
        // Returning user - check if they need to grant permissions first
        setIsReturningUser(true);

        if (currentPlatform === "macos") {
          try {
            const [hasAccessibility, hasMicrophone] = await Promise.all([
              checkAccessibilityPermission(),
              checkMicrophonePermission(),
            ]);
            if (!hasAccessibility || !hasMicrophone) {
              await revealMainWindowForPermissions();
              setOnboardingStep("accessibility");
              return;
            }
          } catch (e) {
            console.warn("Failed to check macOS permissions:", e);
            // If we can't check, proceed to main app and let them fix it there
          }
        }

        if (currentPlatform === "windows") {
          try {
            const microphoneStatus =
              await commands.getWindowsMicrophonePermissionStatus();
            if (
              microphoneStatus.supported &&
              microphoneStatus.overall_access === "denied"
            ) {
              await revealMainWindowForPermissions();
              setOnboardingStep("accessibility");
              return;
            }
          } catch (e) {
            console.warn("Failed to check Windows microphone permissions:", e);
            // If we can't check, proceed to main app and let them fix it there
          }
        }

        setOnboardingStep("done");
      } else {
        // New user - start full onboarding
        setIsReturningUser(false);
        setOnboardingStep("accessibility");
      }
    } catch (error) {
      console.error("Failed to check onboarding status:", error);
      setOnboardingStep("accessibility");
    }
  };

  const handleAccessibilityComplete = async () => {
    // Returning users already have models, skip to main app
    if (isReturningUser) {
      setOnboardingStep("done");
      return;
    }

    // CloseLabs Voice: con la transcripción híbrida no hay que esperar al modelo local. Si
    // hay internet y la nube está activa, el médico dicta desde ya y Parakeet (el respaldo
    // sin conexión) sigue bajando en segundo plano; el progreso se ve en Inicio.
    try {
      const settingsResult = await commands.getAppSettings();
      const cloudReady =
        settingsResult.status === "ok" &&
        settingsResult.data.cloud_transcription_enabled === true &&
        navigator.onLine;
      if (cloudReady) {
        await commands.completeOnboarding();
        setOnboardingStep("done");
        return;
      }
    } catch (e) {
      console.warn("Failed to check cloud transcription availability:", e);
    }

    // Sin nube disponible, el modelo local es imprescindible: se espera la descarga.
    setOnboardingStep("model");
  };

  const handleModelSelected = () => {
    // Transition to main app - user has started a download
    setOnboardingStep("done");
  };

  // El bloqueo manda sobre todo lo demás, incluido el onboarding: si esta versión no debe
  // usarse, tampoco debe poder configurarse ni descargar un modelo de 550 MB.
  if (blocked) {
    return (
      <VersionBlocked
        message={blocked.message}
        downloadUrl={blocked.download_url}
      />
    );
  }

  // Still checking onboarding status
  if (onboardingStep === null || signedIn === null) {
    return null;
  }

  // Sin sesión, no se entra. La cuenta es obligatoria: es lo que permite cobrar, limitar los
  // equipos y cortarle el acceso a quien deje de pagar.
  if (!signedIn) {
    return <AuthGate onSignedIn={() => void refreshAuth()} />;
  }

  if (onboardingStep === "accessibility") {
    return <AccessibilityOnboarding onComplete={handleAccessibilityComplete} />;
  }

  if (onboardingStep === "model") {
    return <Onboarding onModelSelected={handleModelSelected} />;
  }

  return (
    <div
      dir={direction}
      className="h-screen flex flex-col select-none cursor-default"
    >
      <Toaster
        theme="system"
        toastOptions={{
          unstyled: true,
          classNames: {
            toast:
              "bg-background border border-mid-gray/20 rounded-lg shadow-lg px-4 py-3 flex items-center gap-3 text-sm",
            title: "font-medium",
            description: "text-mid-gray",
          },
        }}
      />
      {/* Main content area that takes remaining space */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          activeSection={currentSection}
          onSectionChange={setCurrentSection}
        />
        {/* Scrollable content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <div className="flex flex-col items-center p-4 gap-4">
              <AccessibilityPermissions />
              {renderSettingsContent(currentSection)}
            </div>
          </div>
        </div>
      </div>
      {/* Fixed footer at bottom */}
      <Footer />
    </div>
  );
}

export default App;

/* eslint-disable i18next/no-literal-string */
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import "./RecordingOverlay.css";
import { commands, events } from "@/bindings";
import type {
  StreamPhase,
  StreamPhaseEvent,
  StreamTextEvent,
  StreamWorkKind,
} from "@/bindings";
import i18n, { syncLanguageFromSettings } from "@/i18n";
import { getLanguageDirection } from "@/lib/utils/rtl";
import { shortcutKeys } from "@/lib/utils/shortcutLabels";

type OverlayState =
  | "recording"
  | "streaming"
  | "transcribing"
  | "processing"
  // «Tinta y voz»: "¿No apareció? Quedó copiado…" (ver `mostrar_aviso_pegado` en overlay.rs).
  | "pegado";

/**
 * Aviso "Presiona ⌥ + Espacio para terminar" en la píldora, en vez del lema, durante los primeros
 * días (plan del primer uso, 2026-11-11). Lo que más se olvida al principio no es cómo empezar (lo
 * acaba de hacer) sino cómo terminar: el médico habla, espera, y la píldora sigue escuchando.
 * Se cuenta desde el primer dictado en este computador (la ventana de la píldora comparte el
 * almacenamiento con la principal).
 */
const DIAS_CON_AVISO = 7;
const MARCA_PRIMER_DICTADO = "closelabs.pildora.primerDictado";

function enLosPrimerosDias(): boolean {
  try {
    const guardado = Number(localStorage.getItem(MARCA_PRIMER_DICTADO));
    if (!guardado) {
      localStorage.setItem(MARCA_PRIMER_DICTADO, String(Date.now()));
      return true;
    }
    return Date.now() - guardado < DIAS_CON_AVISO * 86_400_000;
  } catch {
    return false;
  }
}

// Barras de la onda. Los niveles llegan en 16 bandas; «Tinta y voz» pide 22 barras (SISTEMA.md §9),
// así que se reparten las 16 en 22.
const WAVE_BARS = 22;

const RecordingOverlay: React.FC = () => {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);
  const [state, setState] = useState<OverlayState>("recording");
  const [levels, setLevels] = useState<number[]>(Array(WAVE_BARS).fill(0));
  const [streamText, setStreamText] = useState<StreamTextEvent>({
    committed: "",
    tentative: "",
  });
  const [phase, setPhase] = useState<StreamPhase>("listening");
  const [workKind, setWorkKind] = useState<StreamWorkKind>("transcribing");
  const [elapsed, setElapsed] = useState(0);
  // Bumped on each new streaming session so the Live card remounts fresh (replays
  // the pop-in, and never animates in from the previous panel's open size).
  const [session, setSession] = useState(0);
  // Overlay placement (top vs bottom of the screen). The Live panel grows downward
  // from a top overlay (oldest line under the pill) and upward from a bottom one.
  const [position, setPosition] = useState<"top" | "bottom" | "center">(
    "center",
  );
  // True once live text overflows the cap. A top overlay fades its top edge only
  // while overflowing, so the resting first line stays crisp flush under the pill.
  const [overflowing, setOverflowing] = useState(false);

  /** El aviso de cómo terminar, o `null` si ya pasaron los primeros días. */
  const [aviso, setAviso] = useState<string | null>(null);

  const smoothedLevelsRef = useRef<number[]>(Array(16).fill(0));
  // Live-text scroll-back: the text region "sticks" to the newest line while the
  // user is at the bottom; if they scroll up to read history, auto-follow pauses
  // until they scroll back down.
  const capRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);
  const direction = getLanguageDirection(i18n.language);

  useEffect(() => {
    const setupEventListeners = async () => {
      const unlistenShow = await listen("show-overlay", async (event) => {
        await syncLanguageFromSettings();
        // The Live panel flows downward from a top overlay and upward from a
        // bottom one; read the placement so the layout can flip to match.
        try {
          const settings = await commands.getAppSettings();
          if (settings.status === "ok") {
            const p = settings.data.overlay_position;
            setPosition(
              p === "top" ? "top" : p === "bottom" ? "bottom" : "center",
            );
          }
        } catch {
          // Keep the previous/default placement if settings can't be read.
        }
        const overlayState = event.payload as OverlayState;
        if (overlayState === "recording") {
          let texto: string | null = null;
          if (enLosPrimerosDias()) {
            try {
              const r = await commands.getAppSettings();
              if (r.status === "ok") {
                const os = /Mac/i.test(navigator.userAgent)
                  ? "macos"
                  : "windows";
                const atajo = shortcutKeys(
                  r.data.bindings?.transcribe?.current_binding,
                  os,
                ).join(" + ");
                texto = r.data.push_to_talk
                  ? `Suelta ${atajo} para terminar`
                  : `Presiona ${atajo} para terminar`;
              }
            } catch {
              // Sin ajustes, el lema de siempre.
            }
          }
          setAviso(texto);
        }
        setState(overlayState);
        if (overlayState === "recording" || overlayState === "streaming") {
          setStreamText({ committed: "", tentative: "" });
        }
        if (overlayState === "streaming") {
          setPhase("listening");
          setWorkKind("transcribing");
          setElapsed(0);
          setSession((s) => s + 1); // remount the card fresh for this session
        }
        setIsVisible(true);
      });

      const unlistenHide = await listen("hide-overlay", () => {
        setIsVisible(false);
      });

      const unlistenLevel = await listen<number[]>("mic-level", (event) => {
        const newLevels = event.payload as number[];
        // Exponential smoothing across the 16 buckets, then take the first N
        // bars for the shared waveform.
        const smoothed = smoothedLevelsRef.current.map((prev, i) => {
          const target = newLevels[i] || 0;
          return prev * 0.7 + target * 0.3;
        });
        smoothedLevelsRef.current = smoothed;
        setLevels(
          Array.from(
            { length: WAVE_BARS },
            (_, i) => smoothed[Math.floor((i / WAVE_BARS) * smoothed.length)] ?? 0,
          ),
        );
      });

      const unlistenStream = await events.streamTextEvent.listen((event) => {
        setStreamText(event.payload);
      });

      const unlistenPhase = await events.streamPhaseEvent.listen((event) => {
        const payload: StreamPhaseEvent = event.payload;
        setPhase(payload.phase);
        if (payload.kind) setWorkKind(payload.kind);
      });

      return () => {
        unlistenShow();
        unlistenHide();
        unlistenLevel();
        unlistenStream();
        unlistenPhase();
      };
    };

    setupEventListeners();
  }, []);

  // Elapsed timer while the Live overlay is visible.
  useEffect(() => {
    if (state !== "streaming" || !isVisible) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [state, isVisible]);

  // Stick to the bottom as text streams in — but only while pinned, so a user who
  // has scrolled up to read history isn't yanked back down by the next chunk.
  useLayoutEffect(() => {
    const el = capRef.current;
    if (!el) return;
    // Fade the top edge only once text actually overflows the cap.
    setOverflowing(el.scrollHeight > el.clientHeight + 1);
    if (pinnedRef.current) el.scrollTop = el.scrollHeight;
  }, [streamText]);

  // Each fresh streaming session starts pinned to the bottom, fade cleared.
  useEffect(() => {
    pinnedRef.current = true;
    setOverflowing(false);
  }, [session]);

  // Re-pin when the user is within ~a line of the bottom; unpin otherwise.
  const handleStreamScroll = () => {
    const el = capRef.current;
    if (!el) return;
    pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight <= 16;
  };

  const fmtTime = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  // ---- Shared building blocks (one visual language for every overlay form) ----
  const waveform = (
    <div className="swave">
      {levels.map((v, i) => (
        <i
          key={i}
          style={{
            height: `${Math.max(3, Math.min(18, 3 + Math.pow(v, 0.7) * 15))}px`,
          }}
        />
      ))}
    </div>
  );

  const cancelBtn = (
    <button
      className="sx"
      aria-label="cancel"
      onClick={() => commands.cancelOperation()}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path
          d="M4 4 L12 12 M12 4 L4 12"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );

  // dot (left) | waveform (center) | timer + cancel (right) — same structure for
  // pill & panel, so the Live morph is a pure width change.
  const listeningRow = (showTimer: boolean, showCancel: boolean) => (
    <div className="sbase">
      <div className="sbase-l">
        <span className="sdot" />
      </div>
      {waveform}
      <div className="sbase-r">
        {showTimer && <span className="stimer">{fmtTime(elapsed)}</span>}
        {showCancel && cancelBtn}
      </div>
    </div>
  );

  // spinner (left) | label (center) | cancel (right) — same 3-zone grid as the
  // listening row, so the label is centered.
  const workingRow = (label: string, showCancel: boolean) => (
    <div className="sbase">
      <div className="sbase-l">
        <span className="sspinner" />
      </div>
      <span className="swork-label">{label}</span>
      <div className="sbase-r">{showCancel && cancelBtn}</div>
    </div>
  );

  // Arrastre del overlay. El NSPanel "no-activable" (macOS) NO entrega pointermove al
  // webview, así que ni el arrastre manual ni startDragging funcionan. En su lugar, en
  // pointerdown arrancamos un loop en Rust (start_overlay_drag) que lee el cursor global y
  // mueve la ventana hasta pointerup (stop_overlay_drag). pointerdown/pointerup SÍ llegan.
  const onCardPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    // No arrastrar al presionar el botón de cancelar (X).
    if ((e.target as HTMLElement).closest(".sx")) return;
    void invoke("start_overlay_drag");
    const stop = () => {
      void invoke("stop_overlay_drag");
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  };

  // ---- Live overlay: a pill that sculpts open into a panel ----
  if (state === "streaming") {
    const hasText =
      streamText.committed.length > 0 || streamText.tentative.length > 0;
    const working = phase === "working";
    // Keep the panel open whenever there's text — even while finalizing — so the
    // transcript stays put under a working spinner instead of collapsing and
    // squishing the text mid-stream. Only fall back to the small working pill
    // when there was no text to preserve.
    const open = hasText;
    const collapsed = working && !hasText;

    return (
      <div dir={direction} className={`ov-stage ${position}`}>
        <div
          key={session}
          onPointerDown={onCardPointerDown}
          className={`scard ${open ? "open" : ""} ${collapsed ? "working" : ""} ${
            isVisible ? "" : "leaving"
          }`}
        >
          <div className="stext">
            <div className="stext-clip">
              <div
                className={`stext-cap ${overflowing ? "overflowing" : ""}`}
                ref={capRef}
                onScroll={handleStreamScroll}
              >
                <p>
                  <span className="committed">
                    {streamText.committed ? streamText.committed + " " : ""}
                  </span>
                  <span className="tentative">{streamText.tentative}</span>
                  {/* Drop the blinking caret once finalizing — it's no longer
                      capturing, and a static spinner conveys the work. */}
                  {!working && <span className="scaret" />}
                </p>
              </div>
            </div>
          </div>
          {working
            ? workingRow(
                workKind === "polishing"
                  ? t("overlay.processing")
                  : t("overlay.transcribing"),
                true,
              )
            : listeningRow(open, true)}
        </div>
      </div>
    );
  }

  // ---- «Tinta y voz» (diseno/SISTEMA.md §9): la píldora mínima ----
  // Una cápsula oscura que solo existe mientras se graba o se escribe, o para un mensaje. Grabando:
  // ✕ (cancela) · la onda · ✓ (termina). Escribiendo: "Escribiendo" y tres puntos. Sin logo ni lema
  // (revisión del 2026-11-11: lo más grande era el logo, no que estaba grabando ni cómo terminar).
  const working = state === "transcribing" || state === "processing";
  const esMac = /Mac/i.test(navigator.userAgent);

  let pildora: React.ReactNode;
  if (state === "pegado") {
    pildora = (
      <div className="tv-pill tv-msg">
        ¿No apareció? Quedó copiado: pega con{" "}
        <kbd className="tv-kbd">{esMac ? "⌘" : "Ctrl"}</kbd> +{" "}
        <kbd className="tv-kbd">V</kbd>
      </div>
    );
  } else if (working) {
    pildora = (
      <div className="tv-pill tv-msg">
        Escribiendo
        <span className="tv-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </div>
    );
  } else {
    pildora = (
      <div className="tv-pill">
        <button
          className="tv-x sx"
          aria-label="Cancelar el dictado"
          onClick={() => commands.cancelOperation()}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M4.5 4.5 L11.5 11.5 M11.5 4.5 L4.5 11.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <div className="tv-wave" aria-hidden="true">
          {levels.map((v, i) => (
            <i
              key={i}
              style={{
                height: `${Math.max(4, Math.min(26, 4 + Math.pow(v, 0.7) * 22))}px`,
              }}
            />
          ))}
        </div>
        <button
          className="tv-ok sx"
          aria-label="Terminar el dictado"
          onClick={() => commands.terminarDictado()}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M3.5 8.5 L6.6 11.4 L12.5 4.8"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div
      dir={direction}
      className={`tv-stage ov-fade ${isVisible ? "show" : ""}`}
      onPointerDown={onCardPointerDown}
    >
      {aviso && state === "recording" && (
        <div className="tv-pista">{aviso}</div>
      )}
      {pildora}
    </div>
  );
};

export default RecordingOverlay;

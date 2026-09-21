/* eslint-disable i18next/no-literal-string */
import React, { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Check, Loader2, Mic, MessageCircle } from "lucide-react";
import { useShortcutKeys } from "../../hooks/useShortcutKeys";
import { pasteShortcut } from "../../lib/utils/shortcutLabels";
import { supportWhatsappUrl } from "../../branding";
import type { RecordingErrorEvent } from "../../lib/types/events";
import Logo from "../icons/Logo";

/**
 * "Tu primer dictado": el tutorial que se hace dictando, no leyendo.
 *
 * Por qué existe: el público son médicos de 40-50 años o más, poco familiarizados con la
 * tecnología. Antes, al terminar los permisos llegaban a Inicio con tres tarjetas de texto, y
 * la primera vez que dictaban de verdad era en su historia clínica, frente a un paciente. Si algo
 * fallaba —el micrófono, el atajo, el pegado—, fallaba ahí, sin explicación.
 *
 * Aquí dictan una frase de prueba en un cuadro de texto DENTRO de la app. Así aprenden haciendo,
 * y de paso se comprueba todo el camino real (micrófono → atajo → transcripción → pegado). Si se
 * traba, la pantalla dice qué hacer, usando los eventos que ya emite el backend.
 *
 * Se muestra una sola vez, al terminar el registro. Se puede repetir desde Inicio.
 */

/** Evento para abrir el tutorial desde cualquier pantalla (el botón de Inicio). */
export const ABRIR_PRIMER_DICTADO = "clv:abrir-primer-dictado";

const CLAVE_HECHO = "closelabs.primerDictado";

export function primerDictadoHecho(): boolean {
  try {
    return localStorage.getItem(CLAVE_HECHO) === "hecho";
  } catch {
    // Sin almacenamiento no se sabe: mejor no volver a mostrarlo en cada arranque.
    return true;
  }
}

function marcarHecho() {
  try {
    localStorage.setItem(CLAVE_HECHO, "hecho");
  } catch {
    /* sin almacenamiento, no pasa nada: solo se volvería a ofrecer */
  }
}

const FRASE =
  "Paciente de cuarenta y cinco años con dolor abdominal de tres días de evolución.";

/** Si en este tiempo no empezó a grabar, se le explica cómo presionar el atajo. */
const PISTA_SIN_GRABAR_MS = 25_000;
/** Si terminó de procesar y el texto no apareció en este tiempo, algo falló al pegar. */
const PISTA_SIN_TEXTO_MS = 5_000;

type Fase = "esperando" | "grabando" | "procesando" | "listo";

/** "⌥" → "la tecla ⌥ (Option)", "Ctrl" → "la tecla Ctrl", "Espacio" → "la barra espaciadora". */
function nombreTecla(k: string): string {
  const mac: Record<string, string> = {
    "⌥": "⌥ (Option)",
    "⌘": "⌘ (Command)",
    "⌃": "⌃ (Control)",
    "⇧": "⇧ (Shift)",
  };
  if (k === "Espacio") return "la barra espaciadora";
  return `la tecla ${mac[k] ?? k}`;
}

/** Cómo se presiona un atajo, dicho para alguien que nunca ha usado uno. */
function comoPresionar(keys: string[]): string {
  if (keys.length < 2) return `Presiona ${nombreTecla(keys[0] ?? "")}.`;
  const mods = keys.slice(0, -1).map(nombreTecla);
  const ultima = nombreTecla(keys[keys.length - 1]);
  return mods.length === 1
    ? `Mantén presionada ${mods[0]} y, sin soltarla, toca ${ultima}.`
    : `Mantén presionadas ${mods.join(" y ")} y, sin soltarlas, toca ${ultima}.`;
}

/**
 * ⚠️ Hay que exigir letras, no solo "que no esté vacío": en Mac, ⌥ + Espacio escribe un espacio
 * duro en el cuadro si el sistema deja pasar la tecla, y eso contaría como éxito sin haber dictado.
 */
const tieneDictado = (texto: string) => /\p{L}{2,}/u.test(texto);

const Teclas: React.FC<{ keys: string[] }> = ({ keys }) => (
  <span className="inline-flex items-center gap-1.5 align-middle">
    {keys.map((k, i) => (
      <React.Fragment key={i}>
        {i > 0 && <span className="text-brand-text-muted">+</span>}
        <kbd className="px-2.5 py-1 rounded-lg border border-brand-border bg-white font-heading text-base font-semibold shadow-[0_1px_0_rgba(26,22,32,0.05)]">
          {k}
        </kbd>
      </React.Fragment>
    ))}
  </span>
);

export const PrimerDictado: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const { keys, os } = useShortcutKeys();
  const [texto, setTexto] = useState("");
  const [fase, setFase] = useState<Fase>("esperando");
  const [pista, setPista] = useState<string | null>(null);
  const [enfocado, setEnfocado] = useState(true);
  const cuadro = useRef<HTMLTextAreaElement>(null);
  const faseRef = useRef<Fase>("esperando");
  faseRef.current = fase;

  const terminar = () => {
    marcarHecho();
    onDone();
  };

  // Éxito: llegó texto de verdad al cuadro.
  useEffect(() => {
    if (fase !== "listo" && tieneDictado(texto)) {
      setFase("listo");
      setPista(null);
    }
  }, [texto, fase]);

  // Si no ha empezado a grabar, explicarle cómo se presiona el atajo.
  useEffect(() => {
    if (fase !== "esperando") return;
    const t = setTimeout(() => {
      if (faseRef.current === "esperando") {
        setPista(
          `¿No pasa nada? ${comoPresionar(keys)} Primero haz clic dentro del cuadro blanco.`,
        );
      }
    }, PISTA_SIN_GRABAR_MS);
    return () => clearTimeout(t);
  }, [fase, keys]);

  // Lo que ya avisa el backend, traducido a instrucciones concretas.
  useEffect(() => {
    let sinTexto: ReturnType<typeof setTimeout> | undefined;
    const suscripciones = [
      listen<string>("show-overlay", (e) => {
        if (faseRef.current === "listo") return;
        if (e.payload === "recording" || e.payload === "streaming") {
          setFase("grabando");
          setPista(null);
        } else {
          setFase("procesando");
        }
      }),
      listen("hide-overlay", () => {
        if (faseRef.current === "listo") return;
        clearTimeout(sinTexto);
        sinTexto = setTimeout(() => {
          if (faseRef.current !== "listo") {
            setFase("esperando");
            setPista(
              "El texto no apareció en el cuadro. Haz clic dentro del cuadro blanco y vuelve a intentarlo.",
            );
          }
        }, PISTA_SIN_TEXTO_MS);
      }),
      listen<RecordingErrorEvent>("recording-error", () => {
        setFase("esperando");
        setPista(
          "No pudimos usar el micrófono. Revisa que esté conectado y que la app tenga permiso para usarlo, y vuelve a intentarlo.",
        );
      }),
      listen("transcription-error", () => {
        setFase("esperando");
        setPista(
          "No pudimos convertir tu voz en texto. Revisa tu conexión a internet y vuelve a intentarlo.",
        );
      }),
      listen("paste-needs-manual", () => {
        setPista(
          `Tu texto quedó copiado. Haz clic en el cuadro blanco y presiona ${pasteShortcut(os)} para pegarlo.`,
        );
      }),
      listen("paste-error", () => {
        setPista(
          `Tu texto quedó copiado. Haz clic en el cuadro blanco y presiona ${pasteShortcut(os)} para pegarlo.`,
        );
      }),
    ];
    return () => {
      clearTimeout(sinTexto);
      suscripciones.forEach((p) => void p.then((quitar) => quitar()));
    };
  }, [os]);

  // El cursor tiene que estar en el cuadro para que el texto caiga ahí: se devuelve al volver a
  // la ventana.
  useEffect(() => {
    const alVolver = () => {
      if (faseRef.current !== "listo") cuadro.current?.focus();
    };
    window.addEventListener("focus", alVolver);
    return () => window.removeEventListener("focus", alVolver);
  }, []);

  const pasos = [
    <>Haz clic dentro del cuadro blanco de abajo.</>,
    <>
      Presiona <Teclas keys={keys} /> para empezar a grabar.
    </>,
    <>
      Di en voz alta: <em className="not-italic font-semibold text-brand-text">«{FRASE}»</em>
    </>,
    <>
      Vuelve a presionar <Teclas keys={keys} /> para terminar.
    </>,
  ];
  // El paso en curso, según lo que va pasando. Si el cursor salió del cuadro, se vuelve al paso 1:
  // el texto caería en otro lado.
  const pasoActual =
    fase === "esperando" ? (enfocado ? 1 : 0) : fase === "grabando" ? 2 : 3;

  return (
    <div className="h-screen overflow-y-auto flex justify-center px-8 py-10 select-none">
      <div className="w-full max-w-xl flex flex-col gap-6">
        <div className="flex flex-col items-center text-center gap-2">
          <Logo width={150} />
          <h1 className="font-heading text-2xl font-bold mt-2">
            {fase === "listo" ? "¡Perfecto! Así de fácil" : "Tu primer dictado"}
          </h1>
          <p className="text-[17px] text-brand-text-secondary">
            {fase === "listo"
              ? "Tu voz se convirtió en texto, con la puntuación puesta sola."
              : "Probemos juntos. Toma menos de un minuto."}
          </p>
        </div>

        {fase !== "listo" && (
          <ol className="flex flex-col gap-3">
            {pasos.map((p, i) => (
              <li
                key={i}
                className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-[16px] leading-relaxed transition-colors ${
                  i === pasoActual
                    ? "border-brand-accent bg-brand-surface"
                    : "border-brand-border bg-white"
                }`}
              >
                <span
                  className={`grid place-items-center w-7 h-7 shrink-0 rounded-full text-sm font-semibold font-heading ${
                    i <= pasoActual
                      ? "bg-brand-accent text-white"
                      : "bg-brand-accent-soft text-brand-accent"
                  }`}
                >
                  {i < pasoActual ? <Check className="w-4 h-4" strokeWidth={3} /> : i + 1}
                </span>
                <span className="text-brand-text-secondary">{p}</span>
              </li>
            ))}
          </ol>
        )}

        {/* El cuadro donde cae el dictado. Es un campo de texto normal a propósito: así se prueba
            el pegado real, el mismo que después irá a la historia clínica. */}
        <textarea
          ref={cuadro}
          id="primer-dictado"
          autoFocus
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onFocus={() => setEnfocado(true)}
          onBlur={() => setEnfocado(false)}
          placeholder="Aquí aparecerá tu texto…"
          rows={4}
          className={`w-full rounded-2xl border-2 bg-white px-4 py-3 text-[17px] leading-relaxed resize-none focus:outline-none transition-colors select-text ${
            fase === "listo" ? "border-green-500" : "border-brand-accent"
          }`}
        />

        {fase === "grabando" && (
          <div className="flex items-center justify-center gap-2 text-[16px] font-medium text-brand-accent">
            <Mic className="w-5 h-5 animate-pulse" />
            Te estoy escuchando… cuando termines, presiona <Teclas keys={keys} />
          </div>
        )}
        {fase === "procesando" && (
          <div className="flex items-center justify-center gap-2 text-[16px] text-brand-text-secondary">
            <Loader2 className="w-5 h-5 animate-spin" />
            Escribiendo tu texto…
          </div>
        )}

        {pista && (
          <p
            role="alert"
            className="text-[15px] leading-relaxed text-amber-900 bg-amber-50 border border-amber-300 rounded-xl px-4 py-3"
          >
            {pista}
          </p>
        )}

        {fase === "listo" ? (
          <div className="flex flex-col gap-4">
            <p className="text-[16px] leading-relaxed text-brand-text-secondary text-center">
              Ahora hazlo igual en tu historia clínica, WhatsApp o donde escribas:{" "}
              <strong className="text-brand-text">
                haz clic donde quieras escribir y presiona <Teclas keys={keys} />
              </strong>
              .
            </p>
            <button
              type="button"
              onClick={terminar}
              className="w-full px-4 py-3 rounded-xl text-[17px] font-semibold bg-brand-accent text-white hover:bg-brand-accent-secondary transition-colors"
            >
              Empezar a usar CloseLabs Voice
            </button>
            <button
              type="button"
              onClick={() => {
                setTexto("");
                setFase("esperando");
                cuadro.current?.focus();
              }}
              className="text-sm font-semibold text-brand-accent hover:underline"
            >
              Probar otra vez
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() =>
                void openUrl(
                  supportWhatsappUrl(
                    "Hola, estoy haciendo mi primer dictado en CloseLabs Voice y necesito ayuda.",
                  ),
                )
              }
              className="inline-flex items-center gap-1.5 text-sm text-brand-text-muted hover:text-[#128C7E] transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              ¿Necesitas ayuda? Escríbenos por WhatsApp
            </button>
            <button
              type="button"
              onClick={terminar}
              className="text-sm text-brand-text-muted hover:underline"
            >
              Saltar por ahora
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PrimerDictado;

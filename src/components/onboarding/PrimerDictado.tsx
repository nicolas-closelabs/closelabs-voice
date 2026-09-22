/* eslint-disable i18next/no-literal-string */
import React, { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import { BookOpen, Check, Loader2, Mic, MessageCircle, X } from "lucide-react";
import { useSettings } from "../../hooks/useSettings";
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
 * y de paso se comprueba el micrófono, el atajo y la transcripción. ⚠️ El pegado NO es el mismo que
 * afuera: dentro de nuestra ventana el texto llega por el evento `dictado-en-la-app` (ver
 * `clipboard.rs`, VENTANA_PRINCIPAL_ENFOCADA), porque el Cmd+V simulado nunca llegaba aquí. Si se
 * traba, la pantalla dice qué hacer, usando los eventos que ya emite el backend.
 *
 * Dos pasos: el dictado de prueba y luego el diccionario (`PasoDiccionario`).
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

const FRASE = "Paciente de 45 años con dolor abdominal.";

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

const Teclas: React.FC<{ keys: string[]; grande?: boolean }> = ({ keys, grande }) => (
  <span className={`inline-flex items-center align-middle ${grande ? "gap-3" : "gap-1.5"}`}>
    {keys.map((k, i) => (
      <React.Fragment key={i}>
        {i > 0 && (
          <span className={`text-brand-text-muted ${grande ? "text-2xl" : ""}`}>+</span>
        )}
        <kbd
          className={`rounded-lg border border-brand-border bg-white font-heading font-semibold shadow-[0_2px_0_rgba(26,22,32,0.08)] ${
            grande ? "px-5 py-3 text-3xl rounded-xl" : "px-2.5 py-1 text-base"
          }`}
        >
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
  const [etapa, setEtapa] = useState<"dictar" | "diccionario">("dictar");
  const [pista, setPista] = useState<string | null>(null);
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
          `¿No pasa nada? ${comoPresionar(keys)}`,
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
              "El texto no apareció. Vuelve a intentarlo.",
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
          `Tu texto quedó copiado. Haz clic en el cuadro y presiona ${pasteShortcut(os)} para pegarlo.`,
        );
      }),
      listen("paste-error", () => {
        setPista(
          `Tu texto quedó copiado. Haz clic en el cuadro y presiona ${pasteShortcut(os)} para pegarlo.`,
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

  // Una sola instrucción a la vez, grande. El público se pierde con listas de pasos: la primera
  // versión tenía cuatro tarjetas numeradas, avisos y enlaces, y resultó abrumadora.
  const instruccion =
    fase === "grabando" ? (
      <>
        <span className="grid place-items-center w-16 h-16 rounded-full bg-brand-accent text-white">
          <Mic className="w-8 h-8 animate-pulse" />
        </span>
        <p className="font-heading text-2xl font-bold">Te escucho…</p>
        <p className="text-[18px] text-brand-text-secondary">
          Cuando termines, presiona otra vez
        </p>
        <Teclas keys={keys} grande />
      </>
    ) : fase === "procesando" ? (
      <>
        <Loader2 className="w-12 h-12 animate-spin text-brand-accent" />
        <p className="font-heading text-2xl font-bold">Escribiendo…</p>
      </>
    ) : fase === "listo" ? (
      <>
        <span className="grid place-items-center w-16 h-16 rounded-full bg-green-500 text-white">
          <Check className="w-9 h-9" strokeWidth={3} />
        </span>
        <p className="font-heading text-2xl font-bold">¡Listo! Así de fácil</p>
        <p className="text-[18px] text-brand-text-secondary max-w-md">
          Hazlo igual en tu historia clínica o donde escribas: haz clic ahí y presiona{" "}
          <Teclas keys={keys} />
        </p>
      </>
    ) : (
      <>
        <p className="text-[18px] text-brand-text-secondary">Presiona</p>
        <Teclas keys={keys} grande />
        <p className="text-[18px] text-brand-text-secondary max-w-md">
          y di en voz alta:{" "}
          <span className="font-semibold text-brand-text">«{FRASE}»</span>
        </p>
      </>
    );

  if (etapa === "diccionario") return <PasoDiccionario onDone={terminar} />;

  return (
    <div className="h-screen overflow-y-auto flex justify-center px-8 py-10 select-none">
      <div className="w-full max-w-xl flex flex-col gap-8">
        <div className="flex flex-col items-center gap-3">
          <Logo width={130} />
          <h1 className="font-heading text-[28px] font-bold">Probemos tu voz</h1>
        </div>

        <div
          className="flex flex-col items-center text-center gap-4 min-h-[220px] justify-center"
          aria-live="polite"
        >
          {instruccion}
        </div>

        {/* El cuadro donde cae el dictado. `data-dictado-destino`: el texto llega aquí aunque el
            cursor no esté dentro (ver insertarDictado.ts). */}
        <textarea
          ref={cuadro}
          id="primer-dictado"
          data-dictado-destino
          autoFocus
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Aquí aparecerá lo que digas"
          rows={3}
          className={`w-full rounded-2xl border-2 bg-white px-4 py-3 text-[18px] leading-relaxed resize-none focus:outline-none transition-colors select-text ${
            fase === "listo" ? "border-green-500" : "border-brand-border"
          }`}
        />

        {pista && (
          <div
            role="alert"
            className="flex flex-col items-center gap-2 text-center text-[16px] leading-relaxed text-amber-900 bg-amber-50 border border-amber-300 rounded-xl px-4 py-3"
          >
            {pista}
            <button
              type="button"
              onClick={() =>
                void openUrl(
                  supportWhatsappUrl(
                    "Hola, estoy haciendo mi primer dictado en CloseLabs Voice y necesito ayuda.",
                  ),
                )
              }
              className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-[#128C7E] hover:underline"
            >
              <MessageCircle className="w-4 h-4" />
              Pedir ayuda por WhatsApp
            </button>
          </div>
        )}

        {fase === "listo" ? (
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => setEtapa("diccionario")}
              className="w-full px-4 py-4 rounded-xl text-[18px] font-semibold bg-brand-accent text-white hover:bg-brand-accent-secondary transition-colors"
            >
              Siguiente
            </button>
            <button
              type="button"
              onClick={() => {
                setTexto("");
                setFase("esperando");
                cuadro.current?.focus();
              }}
              className="text-[15px] text-brand-text-muted hover:underline"
            >
              Probar otra vez
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={terminar}
            className="self-center text-[15px] text-brand-text-muted hover:underline"
          >
            Saltar por ahora
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * Segundo paso: el diccionario. Es lo que más mejora la calidad para un médico (nombres de
 * medicamentos, de colegas, de su clínica) y antes no aparecía en ningún lado: había que
 * descubrir la sección por cuenta propia. Aquí agrega su primera palabra en el mismo momento en
 * que acaba de ver funcionar el dictado. Usa el mismo ajuste que la sección Diccionario
 * (`custom_words`) y las mismas reglas que `CustomWords.tsx`.
 */
const PasoDiccionario: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const { getSetting, updateSetting } = useSettings();
  const palabras = getSetting("custom_words") || [];
  const [nueva, setNueva] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);

  const agregar = () => {
    const limpia = nueva.trim().replace(/[<>"'&]/g, "");
    if (!limpia) return;
    if (limpia.split(/\s+/).length > 3 || limpia.length > 50) {
      setAviso("Escribe una palabra o un nombre corto, de máximo tres palabras.");
      return;
    }
    if (palabras.includes(limpia)) {
      setAviso(`«${limpia}» ya está en tu diccionario.`);
      return;
    }
    updateSetting("custom_words", [...palabras, limpia]);
    setNueva("");
    setAviso(null);
  };

  return (
    <div className="h-screen overflow-y-auto flex justify-center px-8 py-10 select-none">
      <div className="w-full max-w-xl flex flex-col gap-8">
        <div className="flex flex-col items-center text-center gap-3">
          <Logo width={130} />
          <span className="grid place-items-center w-16 h-16 mt-2 rounded-full bg-brand-accent-soft text-brand-accent">
            <BookOpen className="w-8 h-8" />
          </span>
          <h1 className="font-heading text-[28px] font-bold">Enséñale tus palabras</h1>
          <p className="text-[18px] leading-relaxed text-brand-text-secondary max-w-md">
            Si escribe mal un medicamento, un nombre o una palabra que usas mucho, agrégala aquí y
            la escribirá bien siempre.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <input
              id="primer-dictado-palabra"
              type="text"
              autoFocus
              value={nueva}
              onChange={(e) => setNueva(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  agregar();
                }
              }}
              placeholder="Ej.: Losartán"
              className="flex-1 min-w-0 rounded-xl border-2 border-brand-border bg-white px-4 py-3 text-[18px] focus:outline-none focus:border-brand-accent select-text"
            />
            <button
              type="button"
              onClick={agregar}
              disabled={!nueva.trim()}
              className="px-5 rounded-xl text-[17px] font-semibold bg-brand-accent text-white hover:bg-brand-accent-secondary disabled:opacity-40 transition-colors"
            >
              Agregar
            </button>
          </div>
          {aviso && <p className="text-[15px] text-amber-900">{aviso}</p>}
          {palabras.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {palabras.map((p) => (
                <span
                  key={p}
                  className="inline-flex items-center gap-1.5 rounded-full bg-brand-surface border border-brand-border pl-3 pr-2 py-1 text-[16px]"
                >
                  {p}
                  <button
                    type="button"
                    aria-label={`Quitar ${p}`}
                    onClick={() =>
                      updateSetting(
                        "custom_words",
                        palabras.filter((x) => x !== p),
                      )
                    }
                    className="text-brand-text-muted hover:text-brand-text"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <p className="text-[15px] text-brand-text-muted">
            Puedes agregar más cuando quieras en <strong>Diccionario</strong>, en el menú de la
            izquierda.
          </p>
        </div>

        <button
          type="button"
          onClick={onDone}
          className="w-full px-4 py-4 rounded-xl text-[18px] font-semibold bg-brand-accent text-white hover:bg-brand-accent-secondary transition-colors"
        >
          Empezar a usar CloseLabs Voice
        </button>
      </div>
    </div>
  );
};

export default PrimerDictado;

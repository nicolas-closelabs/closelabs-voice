/* eslint-disable i18next/no-literal-string */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { commands, type AudioDevice } from "@/bindings";
import { useSettings } from "../../hooks/useSettings";
import { useShortcutKeys } from "../../hooks/useShortcutKeys";
import { pasteShortcut } from "../../lib/utils/shortcutLabels";
import PlantillaPrimerUso from "../tinta/PlantillaPrimerUso";
import { conCursiva } from "../tinta/Titulo";
import PlantillaPractica from "./practica/PlantillaPractica";
import {
  Chat,
  Formula,
  HistoriaClinica,
  SenalClic,
  type EstadoCampo,
} from "./practica/Programas";
import { Teclas } from "../tinta/Teclas";
import { Aviso } from "../tinta/Campos";
import { Enlace } from "../tinta/Botones";

/**
 * El tutorial del primer uso: probar el micrófono, probar el atajo y dictar tres veces dentro de
 * imitaciones de lo que el médico usa (historia clínica, WhatsApp, fórmula). Termina con la
 * recompensa: cuánto más rápido dictó que lo que escribe.
 *
 * Por qué así (revisión del 2026-11-11 y referente Wispr Flow, decisiones de Nicolás):
 * - Antes la segunda práctica abría TextEdit, que tapaba nuestras instrucciones justo cuando el
 *   médico las necesitaba. Ahora todo pasa dentro de la app, en tarjetas que se parecen a su trabajo.
 * - 2026-11-13 (diseño de Fable, `diseno/maquetas/practicas-v2.html`): «arriba tu pantalla, abajo tu
 *   voz». Arriba, un programa que se parece al suyo (historia clínica, chat, fórmula); abajo, un solo
 *   renglón que dice qué hacer ahora. La frase, con una muletilla y una autocorrección a propósito,
 *   aparece ANTES de grabar para leerla con calma, y en el resultado se ve tachado lo que se quitó.
 * - Las etiquetas de lo que arregló ("Corrigió izquierda → derecha") salen SOLO si una comprobación
 *   exacta sobre el texto final lo confirma (regla del proyecto: en producción, solo comprobaciones
 *   exactas). Si una no se cumple, esa etiqueta no sale.
 *
 * Diseño: diseno/SISTEMA.md §7 (pantallas 5 a 10). El texto dictado llega por `dictado-en-la-app`
 * (ver `insertarDictado`): el campo de práctica lleva `data-dictado-destino`, así cae ahí aunque el
 * médico no haya hecho clic.
 */

/** Evento para abrir el tutorial desde cualquier pantalla (el botón de Inicio). */
export const ABRIR_PRIMER_DICTADO = "clv:abrir-primer-dictado";

/**
 * ⚠️ La marca va POR CUENTA, no por computador. Con una sola marca global, quien creaba una
 * segunda cuenta en el mismo equipo nunca veía el tutorial. `v2`: la 0.8.1 intentó heredar la marca
 * vieja del computador y se la quedó la cuenta equivocada.
 */
const clave = (cuenta: string) =>
  `closelabs.primerDictado.v2.${cuenta.trim().toLowerCase()}`;

export function primerDictadoHecho(cuenta: string): boolean {
  try {
    return localStorage.getItem(clave(cuenta)) === "hecho";
  } catch {
    // Sin almacenamiento no se sabe: mejor no volver a mostrarlo en cada arranque.
    return true;
  }
}

/**
 * También lo usa la pantalla de entrar: si el servidor reconoce que esta cuenta ya había usado este
 * computador (`equipo_conocido`, huella del hardware), no se repite el tutorial aunque la marca
 * local se haya perdido (cambio de cuenta, datos de la app borrados). Nicolás, 2026-11-14: "eso solo
 * debe pasar si es un computador nuevo".
 */
export function marcarPrimerDictadoHecho(cuenta: string) {
  marcarHecho(cuenta);
}

function marcarHecho(cuenta: string) {
  try {
    localStorage.setItem(clave(cuenta), "hecho");
  } catch {
    /* sin almacenamiento, no pasa nada: solo se volvería a ofrecer */
  }
}

// ---------------------------------------------------------------------------------------------
// Las tres prácticas y sus comprobaciones exactas
// ---------------------------------------------------------------------------------------------

/** Minúsculas y sin tildes, para comparar ("Izquierda" y "izquierda" cuentan igual). */
const normal = (t: string) =>
  t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const palabra = (t: string, p: string) =>
  new RegExp(`(^|[^a-z0-9])${p}([^a-z0-9]|$)`).test(normal(t));

interface Etiqueta {
  texto: string;
  cumple: (final: string) => boolean;
}

/** Un pedazo de la frase. `quita`: la etiqueta que, si se cumple, lo muestra tachado en el resultado. */
interface Tramo {
  t: string;
  quita?: number;
}

interface Practica {
  programa: "historia" | "chat" | "formula";
  /** Momento 1, falta el clic: el renglón de guía y su apoyo. */
  clic: string;
  clicApoyo: string;
  /** Momento 2: "Presiona [teclas] y {verbo}:" */
  verbo: string;
  nota: string;
  /** Momento 3, grabando. */
  escucho: string;
  /** Momento 4, el resultado. */
  tituloHecho: string;
  tramos: Tramo[];
  /**
   * Palabras que tienen que estar para afirmar que leyó ESTA frase. Sin esto, las comprobaciones
   * ("no hay «eh»") se cumplían con cualquier texto: quien dijera otra cosa veía "Quitó «eh»"
   * (lo notó Fable al rediseñar, 2026-11-13). Son palabras que la limpieza no quita.
   */
  ancla: string[];
  etiquetas: Etiqueta[];
}

const termina = (t: string) => t.trim().endsWith(".");
const fraseDe = (p: Practica) => p.tramos.map((x) => x.t).join("");

const PRACTICAS: Practica[] = [
  {
    programa: "historia",
    clic: "Haz clic en *Motivo de consulta*.",
    clicApoyo: "Lo que dictes aparece siempre donde hayas hecho clic.",
    verbo: "*lee* esto",
    nota: "En voz alta y tal como está, con el «eh» y la equivocación.",
    escucho: "Te *escucho*. Léela con calma.",
    tituloHecho: "Te corregiste al hablar. Quedó *limpio*.",
    tramos: [
      { t: "Paciente de 58 años que consulta por, " },
      { t: "eh,", quita: 0 },
      { t: " dolor en la rodilla " },
      { t: "izquierda, no, perdón, en la rodilla", quita: 1 },
      { t: " derecha, desde hace tres días." },
    ],
    ancla: ["paciente", "rodilla", "dolor"],
    etiquetas: [
      { texto: "Quitó «eh»", cumple: (f) => !palabra(f, "eh") },
      {
        texto: "Corrigió izquierda → derecha",
        cumple: (f) => !palabra(f, "izquierda") && palabra(f, "derecha"),
      },
      { texto: "Puso la puntuación", cumple: termina },
    ],
  },
  {
    programa: "chat",
    clic: "Haz clic en el *mensaje*.",
    clicApoyo: "Ahí, donde escribirías la respuesta a don Jaime.",
    verbo: "*respóndele*",
    nota: "Tal como está, con el «este» y la corrección.",
    escucho: "Te *escucho*. Respóndele a don Jaime.",
    tituloHecho: "Lo que retiraste no *llegó*.",
    tramos: [
      { t: "Hola, don Jaime. Tómela, " },
      { t: "este,", quita: 0 },
      { t: " " },
      { t: "después del almuerzo, no, perdón,", quita: 1 },
      { t: " después del desayuno, con un vaso de agua." },
    ],
    ancla: ["jaime", "vaso", "agua"],
    etiquetas: [
      { texto: "Quitó «este»", cumple: (f) => !palabra(f, "este") },
      {
        texto: "Corrigió almuerzo → desayuno",
        cumple: (f) => !palabra(f, "almuerzo") && palabra(f, "desayuno"),
      },
      { texto: "Puso la puntuación", cumple: termina },
    ],
  },
  {
    programa: "formula",
    clic: "Haz clic junto a *Rp.*",
    clicApoyo: "Aquí te vas a corregir en la dosis.",
    verbo: "*lee* la fórmula",
    nota: "Tal como está, con la corrección de la dosis.",
    escucho: "Te *escucho*. Léela con calma.",
    tituloHecho: "La dosis quedó como la *corregiste*.",
    tramos: [
      { t: "Losartán de 50 miligramos, una tableta " },
      { t: "cada 12 horas, no, mentira,", quita: 0 },
      { t: " cada 24 horas, por 30 días." },
    ],
    ancla: ["losartan", "tableta", "dias"],
    etiquetas: [
      {
        texto: "Corrigió cada 12 → cada 24 horas",
        cumple: (f) => !palabra(f, "12") && palabra(f, "24"),
      },
      { texto: "Puso la puntuación", cumple: termina },
    ],
  },
];

/** Velocidad promedio al teclado (supuesto escrito en pantalla, SISTEMA.md §7). */
const PPM_TECLADO = 40;
/** Tras presionar una tecla, si no empezó a grabar en este tiempo, se explica el atajo. */
const PISTA_TRAS_INTENTO_MS = 2_000;
/** Respaldo: si nunca empezó a grabar ni llegó ninguna tecla. */
const PISTA_SIN_GRABAR_MS = 60_000;
/** Si terminó de procesar y el texto no apareció en este tiempo, algo falló al pegar. */
const PISTA_SIN_TEXTO_MS = 5_000;

/** Exige letras, no solo "que no esté vacío": ⌥ + Espacio puede escribir un espacio duro. */
const tieneDictado = (texto: string) => /\p{L}{2,}/u.test(texto);

type Paso =
  | { tipo: "microfono" }
  | { tipo: "atajo" }
  | { tipo: "practica"; indice: number }
  | { tipo: "recompensa" };

// ---------------------------------------------------------------------------------------------

export const PrimerDictado: React.FC<{
  cuenta: string;
  onDone: () => void;
}> = ({ cuenta, onDone }) => {
  const [paso, setPaso] = useState<Paso>({ tipo: "microfono" });
  // Lo medido en las prácticas (segundos de audio y palabras), para la recompensa.
  const medido = useRef({ segundos: 0, palabras: 0 });

  useEffect(() => {
    const quitar = listen<{ segundos: number; palabras: number }>(
      "dictado-medido",
      (e) => {
        medido.current.segundos += e.payload.segundos;
        medido.current.palabras += e.payload.palabras;
      },
    );
    return () => void quitar.then((f) => f());
  }, []);

  const terminar = () => {
    marcarHecho(cuenta);
    onDone();
  };

  if (paso.tipo === "microfono") {
    return (
      <PruebaMicrofono
        onSi={() => setPaso({ tipo: "atajo" })}
        onSaltar={terminar}
      />
    );
  }
  if (paso.tipo === "atajo") {
    return (
      <PruebaAtajo
        atras={() => setPaso({ tipo: "microfono" })}
        onSi={() => {
          medido.current = { segundos: 0, palabras: 0 };
          setPaso({ tipo: "practica", indice: 0 });
        }}
      />
    );
  }
  if (paso.tipo === "practica") {
    return (
      <PracticaDictado
        key={paso.indice}
        indice={paso.indice}
        atras={() =>
          setPaso(
            paso.indice === 0
              ? { tipo: "atajo" }
              : { tipo: "practica", indice: paso.indice - 1 },
          )
        }
        onContinuar={() =>
          setPaso(
            paso.indice + 1 < PRACTICAS.length
              ? { tipo: "practica", indice: paso.indice + 1 }
              : { tipo: "recompensa" },
          )
        }
        // "Saltar la práctica" lleva a Inicio sin pasar por la recompensa.
        onSaltar={terminar}
      />
    );
  }
  return (
    <Recompensa
      segundos={medido.current.segundos}
      palabras={medido.current.palabras}
      onListo={terminar}
    />
  );
};

// ---------------------------------------------------------------------------------------------
// Pantalla 5: ¿Se mueven las barras cuando hablas?
// ---------------------------------------------------------------------------------------------

const BARRAS = 30;

const PruebaMicrofono: React.FC<{ onSi: () => void; onSaltar: () => void }> = ({
  onSi,
  onSaltar,
}) => {
  const [niveles, setNiveles] = useState<number[]>(() => Array(BARRAS).fill(0));
  const [noSeMueven, setNoSeMueven] = useState(false);
  const [sinMicrofono, setSinMicrofono] = useState(false);
  const [micros, setMicros] = useState<AudioDevice[]>([]);
  const [elegido, setElegido] = useState<string>("");

  const abrir = async () => {
    setSinMicrofono(false);
    const r = await commands.pruebaMicrofono(true);
    if (r.status === "error") setSinMicrofono(true);
  };

  useEffect(() => {
    void abrir();
    // Los niveles llegan por bandas de frecuencia (400-4000 Hz). Repartirlas en las barras dejaba
    // casi todo quieto: la voz cae en las bandas bajas y solo se movían unas pocas a la izquierda,
    // unos píxeles (Nicolás, 2026-11-12: "no se mueven"). Ahora cada barra es el VOLUMEN de un
    // instante: entra por la derecha y corre a la izquierda, así todas responden al hablar.
    let volumen = 0;
    const quitar = listen<number[]>("mic-level", (e) => {
      const v = e.payload;
      if (!v?.length) return;
      const pico = Math.max(...v);
      // Por debajo de esto es ruido de fondo: la barra se queda en reposo.
      const crudo = pico < 0.04 ? 0 : Math.min(1, Math.pow(pico, 0.6) * 1.3);
      // Sube rápido y baja despacio, como un vúmetro.
      volumen = crudo > volumen ? crudo : volumen * 0.75 + crudo * 0.25;
      setNiveles((antes) => [...antes.slice(1), volumen]);
    });
    void commands.getAvailableMicrophones().then((r) => {
      if (r.status === "ok") setMicros(r.data);
    });
    void commands.getSelectedMicrophone().then((r) => {
      if (r.status === "ok") setElegido(r.data);
    });
    return () => {
      void quitar.then((f) => f());
      void commands.pruebaMicrofono(false).catch(() => {});
    };
  }, []);

  const cambiar = async (nombre: string) => {
    setElegido(nombre);
    await commands.pruebaMicrofono(false).catch(() => {});
    await commands.setSelectedMicrophone(nombre).catch(() => {});
    await abrir();
  };

  const nombreMicro =
    elegido && elegido !== "default" && elegido !== "Default"
      ? elegido
      : "El micrófono de tu computador";

  return (
    <PlantillaPrimerUso
      clave="microfono"
      etapa="prueba"
      titulo="¿Se mueven las barras cuando *hablas*?"
      apoyo={
        sinMicrofono
          ? "No encontramos un micrófono. Conéctalo y vuelve a intentar."
          : noSeMueven
            ? "Elige otro micrófono y vuelve a hablar."
            : "Di cualquier cosa, con tu voz de siempre."
      }
      principal={{ texto: "Sí, se mueven", onClick: onSi }}
      enlace={
        noSeMueven
          ? { texto: "Saltar por ahora", onClick: onSaltar }
          : { texto: "No se mueven", onClick: () => setNoSeMueven(true) }
      }
      escenario={
        <div className="w-[468px] max-w-full bg-papel border border-linea rounded-[16px] shadow-2 overflow-hidden">
          <div className="h-[150px] flex items-center justify-center gap-1.5">
            {niveles.map((n, i) => (
              <span
                key={i}
                className="w-2 rounded-[4px] bg-lila transition-[height] duration-75"
                style={{ height: `${8 + Math.round(n * 120)}px` }}
              />
            ))}
          </div>
          <div className="border-t border-linea px-5 py-4 flex items-center justify-between gap-4">
            {noSeMueven && micros.length > 0 ? (
              <select
                aria-label="Micrófono"
                value={elegido}
                onChange={(e) => void cambiar(e.target.value)}
                className="flex-1 h-11 px-3.5 rounded-[10px] border-[1.5px] border-linea-fuerte bg-papel text-[16px] text-tinta focus:outline-none focus:border-tinta"
              >
                {micros.map((m) => (
                  <option key={m.name} value={m.name}>
                    {m.name === "default" || m.name === "Default"
                      ? "El del computador"
                      : m.name}
                  </option>
                ))}
              </select>
            ) : (
              <>
                <span className="text-[16px] text-tinta truncate">
                  {nombreMicro}
                </span>
                <Enlace chico onClick={() => setNoSeMueven(true)}>
                  Cambiar
                </Enlace>
              </>
            )}
          </div>
        </div>
      }
      mensajeAyuda="Hola, CloseLabs Voice no me escucha el micrófono."
    />
  );
};

// ---------------------------------------------------------------------------------------------
// Pantalla 6: Presiona las dos teclas. ¿Se encienden?
// ---------------------------------------------------------------------------------------------

/** ¿Esta tecla (como se muestra: "⌥", "Ctrl", "Espacio") está presionada en este evento? */
function presionada(etiqueta: string, e: KeyboardEvent): boolean {
  switch (etiqueta) {
    case "⌥":
    case "Alt":
      return e.altKey;
    case "⌃":
    case "Ctrl":
      return e.ctrlKey;
    case "⌘":
    case "Win":
      return e.metaKey;
    case "⇧":
    case "Shift":
      return e.shiftKey;
    case "Espacio":
      return e.code === "Space" && e.type === "keydown";
    default:
      return (
        e.type === "keydown" && e.key.toLowerCase() === etiqueta.toLowerCase()
      );
  }
}

const PruebaAtajo: React.FC<{ atras: () => void; onSi: () => void }> = ({
  atras,
  onSi,
}) => {
  const { keys } = useShortcutKeys();
  const [encendidas, setEncendidas] = useState<boolean[]>([]);
  const [funciono, setFunciono] = useState(false);
  const [noSeEncienden, setNoSeEncienden] = useState(false);

  useEffect(() => {
    const alPresionar = (e: KeyboardEvent) =>
      setEncendidas(keys.map((k) => presionada(k, e)));
    const alSoltar = (e: KeyboardEvent) =>
      setEncendidas(
        keys.map((k) => (k === "Espacio" ? false : presionada(k, e))),
      );
    window.addEventListener("keydown", alPresionar);
    window.addEventListener("keyup", alSoltar);
    // El atajo de verdad empezó a grabar: funciona. Se cancela esa grabación (no es un dictado).
    const quitar = listen<string>("show-overlay", (e) => {
      if (e.payload === "recording" || e.payload === "streaming") {
        setFunciono(true);
        setEncendidas(keys.map(() => true));
        void commands.cancelOperation();
        setTimeout(() => setEncendidas(keys.map(() => false)), 700);
      }
    });
    return () => {
      window.removeEventListener("keydown", alPresionar);
      window.removeEventListener("keyup", alSoltar);
      void quitar.then((f) => f());
    };
  }, [keys]);

  const instruccion =
    keys.length > 1
      ? `Primero ${keys.slice(0, -1).join(" + ")} y, sin soltarla, ${keys[keys.length - 1]}.`
      : `Presiona ${keys[0] ?? ""}.`;

  return (
    <PlantillaPrimerUso
      clave="atajo"
      etapa="prueba"
      atras={atras}
      titulo="Presiona las dos teclas. ¿Se *encienden*?"
      apoyo={
        noSeEncienden
          ? `${instruccion} Si sigue sin encenderse, escríbenos.`
          : "Con ellas empiezas y terminas cada dictado."
      }
      principal={{ texto: "Sí, se encienden", onClick: onSi }}
      enlace={
        noSeEncienden
          ? { texto: "Continuar de todos modos", onClick: onSi }
          : { texto: "No se encienden", onClick: () => setNoSeEncienden(true) }
      }
      escenario={
        <Teclas keys={keys} medida="grande" presionadas={encendidas} />
      }
      notaEscenario={
        funciono ? "Funciona. Así empiezas cada dictado." : instruccion
      }
      mensajeAyuda="Hola, el atajo de CloseLabs Voice no me funciona."
    />
  );
};

// ---------------------------------------------------------------------------------------------
// Pantallas 7 a 9: las prácticas («arriba tu pantalla, abajo tu voz», ver PlantillaPractica)
// ---------------------------------------------------------------------------------------------

/**
 * Los momentos de una práctica. `sin-clic` es nuevo (2026-11-13): el campo ya NO toma el foco
 * solo, porque hacer clic donde va el texto es lo primero que hay que aprender. Si el médico
 * presiona el atajo sin hacer clic, se avanza igual: el texto cae en `data-dictado-destino`.
 */
type Fase = "sin-clic" | "esperando" | "grabando" | "procesando" | "listo";

/** El renglón de guía: serif 30/44, una palabra en cursiva lila, teclas dentro de la oración. */
const Guia: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="font-serif font-medium text-[30px] leading-[44px] tracking-[-0.012em] text-tinta">
    {children}
  </p>
);

const Frase: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="mt-3 font-serif italic text-[25px] leading-[36px] text-tinta">
    «{children}»
  </p>
);

const PracticaDictado: React.FC<{
  indice: number;
  atras: () => void;
  onContinuar: () => void;
  onSaltar: () => void;
}> = ({ indice, atras, onContinuar, onSaltar }) => {
  const practica = PRACTICAS[indice];
  const ultima = indice === PRACTICAS.length - 1;
  const { keys, os } = useShortcutKeys();
  const mantener = useSettings().getSetting("push_to_talk") === true;
  const [texto, setTexto] = useState("");
  const [fase, setFase] = useState<Fase>("sin-clic");
  const [pista, setPista] = useState<string | null>(null);
  const [medico, setMedico] = useState("");
  const faseRef = useRef<Fase>("sin-clic");
  faseRef.current = fase;
  const campo = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    void commands.accountState().then((r) => {
      if (r.status === "ok" && r.data.full_name) setMedico(r.data.full_name);
    });
  }, []);

  // Éxito: llegó texto de verdad al campo.
  useEffect(() => {
    if (fase !== "listo" && tieneDictado(texto)) {
      setFase("listo");
      setPista(null);
    }
  }, [texto, fase]);

  // "¿No pasa nada?" SOLO tras un intento (una tecla sin que empiece la grabación), nunca a
  // ciegas mientras el médico todavía lee (revisión del 2026-11-11). El respaldo de 60 s, solo
  // cuando ya hizo clic: antes de eso lo que falta es el clic, y eso ya lo dice el renglón.
  useEffect(() => {
    if (fase !== "esperando" && fase !== "sin-clic") return;
    const mostrar = () => {
      const f = faseRef.current;
      if (f === "esperando" || f === "sin-clic") {
        setPista(
          keys.length > 1
            ? "¿No pasa nada? Las teclas van al mismo tiempo, no una después de la otra."
            : `¿No pasa nada? Presiona ${keys[0]}.`,
        );
      }
    };
    let trasIntento: ReturnType<typeof setTimeout> | undefined;
    const alPresionar = () => {
      clearTimeout(trasIntento);
      trasIntento = setTimeout(mostrar, PISTA_TRAS_INTENTO_MS);
    };
    window.addEventListener("keydown", alPresionar);
    const respaldo =
      fase === "esperando"
        ? setTimeout(mostrar, PISTA_SIN_GRABAR_MS)
        : undefined;
    return () => {
      window.removeEventListener("keydown", alPresionar);
      clearTimeout(trasIntento);
      clearTimeout(respaldo);
    };
  }, [fase, keys]);

  // Lo que ya avisa el backend, traducido a qué hacer.
  useEffect(() => {
    let sinTexto: ReturnType<typeof setTimeout> | undefined;
    const subs = [
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
            setPista("El texto no apareció. Vuelve a intentarlo.");
          }
        }, PISTA_SIN_TEXTO_MS);
      }),
      listen("recording-error", () => {
        setFase("esperando");
        setPista(
          "No pudimos usar el micrófono. Revisa que esté conectado y vuelve a intentarlo.",
        );
      }),
      listen("transcription-error", () => {
        setFase("esperando");
        setPista(
          "Sin internet no pudimos limpiar el texto. Revisa tu conexión y vuelve a intentarlo.",
        );
      }),
      listen("paste-needs-manual", () =>
        setPista(
          `Tu texto quedó copiado. Haz clic en el campo y presiona ${pasteShortcut(os)}.`,
        ),
      ),
      listen("paste-error", () =>
        setPista(
          `Tu texto quedó copiado. Haz clic en el campo y presiona ${pasteShortcut(os)}.`,
        ),
      ),
    ];
    return () => {
      clearTimeout(sinTexto);
      subs.forEach((p) => void p.then((f) => f()));
    };
  }, [os]);

  // Al volver a la ventana, el cursor vuelve al campo… solo si ya había hecho clic una vez.
  useEffect(() => {
    const alVolver = () => {
      const f = faseRef.current;
      if (f !== "listo" && f !== "sin-clic") campo.current?.focus();
    };
    window.addEventListener("focus", alVolver);
    return () => window.removeEventListener("focus", alVolver);
  }, []);

  const listo = fase === "listo";
  // Las etiquetas y los tachados, solo si el texto es ESTA frase y su comprobación exacta se cumple.
  const leyoLaFrase = listo && practica.ancla.every((a) => palabra(texto, a));
  const cumplidas = useMemo(
    () =>
      leyoLaFrase
        ? practica.etiquetas.map((e) => e.cumple(texto))
        : practica.etiquetas.map(() => false),
    [leyoLaFrase, texto, practica],
  );

  const repetir = () => {
    setTexto("");
    setFase("esperando");
    setPista(null);
    setTimeout(() => campo.current?.focus(), 0);
  };

  const estadoCampo: EstadoCampo =
    fase === "sin-clic" ? "toca" : listo ? "hecho" : "foco";
  const campoPractica = (
    <div
      className={`pp-campo ${estadoCampo}`}
      onClick={() => campo.current?.focus()}
    >
      <textarea
        ref={campo}
        data-dictado-destino
        aria-label="Campo de práctica"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onFocus={() => {
          if (faseRef.current === "sin-clic") setFase("esperando");
        }}
        readOnly={listo}
      />
      {fase === "sin-clic" && <SenalClic />}
    </div>
  );

  const windows = os === "windows";
  const Programa =
    practica.programa === "chat"
      ? Chat
      : practica.programa === "formula"
        ? Formula
        : HistoriaClinica;

  const teclas = <Teclas keys={keys} medida="inicio" />;
  const teclasLinea = <Teclas keys={keys} />;
  const frase = fraseDe(practica);

  let guia: React.ReactNode;
  if (fase === "sin-clic") {
    guia = (
      <>
        <Guia>{conCursiva(practica.clic)}</Guia>
        <p className="mt-2.5 text-[18px] leading-[28px] text-tinta-2">
          {practica.clicApoyo}
        </p>
      </>
    );
  } else if (fase === "esperando") {
    guia = (
      <>
        <Guia>
          {mantener ? "Mantén presionadas" : "Presiona"}{" "}
          <span className="inline-block align-[3px]">{teclas}</span> y{" "}
          {conCursiva(practica.verbo)}:
        </Guia>
        <Frase>{frase}</Frase>
        <p className="mt-3.5 text-[16px] leading-[24px] text-tinta-2">
          {practica.nota}
        </p>
      </>
    );
  } else if (fase === "grabando" || fase === "procesando") {
    guia = (
      <>
        <Guia>
          {conCursiva(
            fase === "grabando"
              ? practica.escucho
              : "Ya casi: lo estoy *escribiendo*.",
          )}
        </Guia>
        <Frase>{frase}</Frase>
        {fase === "grabando" && (
          <p className="mt-3.5 inline-flex flex-wrap items-center gap-1.5 text-[17px] leading-9 font-semibold text-tinta">
            {mantener ? (
              "Al terminar, suelta las teclas."
            ) : (
              <>Al terminar, presiona {teclasLinea} otra vez.</>
            )}
          </p>
        )}
      </>
    );
  } else if (leyoLaFrase) {
    guia = (
      <>
        <Guia>{conCursiva(practica.tituloHecho)}</Guia>
        <p className="mt-3 font-serif italic text-[19px] leading-[28px] text-tinta-2">
          <span className="not-italic font-sans font-semibold text-[14px] text-tinta-3 mr-2">
            Leíste
          </span>
          «
          {practica.tramos.map((x, i) =>
            x.quita !== undefined && cumplidas[x.quita] ? (
              <s key={i} className="text-tinta-3 decoration-lila decoration-2">
                {x.t}
              </s>
            ) : (
              <React.Fragment key={i}>{x.t}</React.Fragment>
            ),
          )}
          »
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {practica.etiquetas.map((e, i) =>
            cumplidas[i] ? (
              <span
                key={e.texto}
                className="h-[34px] inline-flex items-center gap-2 rounded-[17px] pl-2.5 pr-3.5 bg-lila-suave text-lila-tinta text-[15px] font-semibold whitespace-nowrap opacity-0 animate-[etiqueta_200ms_cubic-bezier(.2,.8,.2,1)_forwards]"
                style={{ animationDelay: `${i * 120}ms` }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden
                >
                  <path
                    d="M5 12.5l4.5 4.5L19 7.5"
                    stroke="var(--lila-hover)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {e.texto}
              </span>
            ) : null,
          )}
        </div>
      </>
    );
  } else {
    // Dijo otra cosa: quedó escrito, pero no se afirma nada sobre lo que limpió.
    guia = (
      <>
        <Guia>{conCursiva("Quedó *escrito*.")}</Guia>
        <p className="mt-2.5 text-[18px] leading-[28px] text-tinta-2">
          Para ver cómo quita las muletillas y respeta tus correcciones, repite
          leyendo la frase tal como está.
        </p>
      </>
    );
  }

  return (
    <PlantillaPractica
      numero={indice + 1}
      total={PRACTICAS.length}
      atras={atras}
      clave={`${indice}-${fase === "procesando" ? "grabando" : fase}`}
      programa={
        <Programa campo={campoPractica} medico={medico} windows={windows} />
      }
      enlace={
        listo
          ? { texto: "Repetir", onClick: repetir }
          : { texto: "Saltar la práctica", onClick: onSaltar }
      }
      boton={
        listo
          ? {
              texto: ultima ? "Ver cuánto tiempo ahorras" : "Continuar",
              onClick: onContinuar,
            }
          : undefined
      }
      mensajeAyuda="Hola, estoy haciendo mi primer dictado en CloseLabs Voice y necesito ayuda."
    >
      {guia}
      {pista && <Aviso className="mt-4">{pista}</Aviso>}
    </PlantillaPractica>
  );
};

// ---------------------------------------------------------------------------------------------
// Pantalla 10: la recompensa (la única pantalla oscura)
// ---------------------------------------------------------------------------------------------

const Recompensa: React.FC<{
  segundos: number;
  palabras: number;
  onListo: () => void;
}> = ({ segundos, palabras, onListo }) => {
  const { keys } = useShortcutKeys();
  const ppm = segundos > 3 ? (palabras / segundos) * 60 : 0;
  const veces = ppm / PPM_TECLADO;
  const mostrarCifra = veces >= 1.5;
  // Ahorro: 20 historias de 120 palabras al día (2.400 palabras), redondeado a 5 minutos.
  const minutos =
    ppm > 0
      ? Math.max(0, Math.round((2400 / PPM_TECLADO - 2400 / ppm) / 5) * 5)
      : 0;

  // La cifra cuenta de 1,0 a N en 800 ms.
  const [mostrada, setMostrada] = useState(1);
  useEffect(() => {
    if (!mostrarCifra) return;
    const inicio = performance.now();
    let cuadro = 0;
    const paso = (t: number) => {
      const p = Math.min(1, (t - inicio) / 800);
      const suave = 1 - Math.pow(1 - p, 3);
      setMostrada(1 + (veces - 1) * suave);
      if (p < 1) cuadro = requestAnimationFrame(paso);
    };
    cuadro = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(cuadro);
  }, [mostrarCifra, veces]);

  const fmt = (n: number) => n.toFixed(1).replace(".", ",");

  return (
    <PlantillaPrimerUso
      clave="recompensa"
      oscura
      etapa="todas"
      titulo={
        mostrarCifra
          ? `Dictaste *${Math.round(veces)} veces* más rápido de lo que escribes.`
          : "Ya sabes *dictar*."
      }
      apoyo={
        mostrarCifra
          ? "Lo medimos con lo que acabas de dictar."
          : "Haz clic donde quieras escribir, presiona las dos teclas y habla."
      }
      principal={{ texto: "Empezar a usar CloseLabs Voice", onClick: onListo }}
      escenario={
        mostrarCifra ? (
          <div className="flex flex-col items-center gap-5">
            <div className="font-serif text-[136px] leading-[136px] tracking-[-0.03em] text-white">
              {fmt(mostrada)}
              <em className="italic text-lila-claro">×</em>
            </div>
            <div className="w-[440px] flex flex-col gap-5">
              <Comparacion
                nombre="Tú, dictando"
                dato={`${Math.round(ppm)} palabras por minuto`}
                ancho={100}
                lila
              />
              <Comparacion
                nombre="Escribiendo en el teclado"
                dato={`${PPM_TECLADO} por minuto, en promedio`}
                ancho={Math.max(6, (PPM_TECLADO / ppm) * 100)}
              />
            </div>
            {minutos > 0 && (
              <div className="w-[440px] border-t border-white/16 pt-[18px]">
                <p className="text-[17px] leading-[26px] text-white">
                  En 20 historias al día, son unos {minutos} minutos menos
                  frente al teclado.
                </p>
                <p className="text-[14px] leading-5 text-white/60">
                  Calculado con historias de 120 palabras.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-white/72">
            <Teclas keys={keys} medida="grande" />
          </div>
        )
      }
    />
  );
};

const Comparacion: React.FC<{
  nombre: string;
  dato: string;
  ancho: number;
  lila?: boolean;
}> = ({ nombre, dato, ancho, lila }) => (
  <div className="flex flex-col gap-2">
    <div className="flex items-baseline justify-between text-[15px]">
      <span className="font-semibold text-white">{nombre}</span>
      <span className="text-white/72">{dato}</span>
    </div>
    <div className="h-2.5 rounded-[5px] bg-white/8">
      <div
        className={`h-full rounded-[5px] origin-left animate-[crecer_600ms_cubic-bezier(.2,.8,.2,1)_200ms_both] ${
          lila ? "bg-lila" : "bg-white/30"
        }`}
        style={{ width: `${ancho}%` }}
      />
    </div>
  </div>
);

export default PrimerDictado;

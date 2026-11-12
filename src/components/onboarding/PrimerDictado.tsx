/* eslint-disable i18next/no-literal-string */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { commands, type AudioDevice } from "@/bindings";
import { useSettings } from "../../hooks/useSettings";
import { useShortcutKeys } from "../../hooks/useShortcutKeys";
import { pasteShortcut } from "../../lib/utils/shortcutLabels";
import PlantillaPrimerUso, { TarjetaEscenario } from "../tinta/PlantillaPrimerUso";
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
 * - La frase a decir está DENTRO del campo donde cae el texto, con una muletilla y una autocorrección
 *   a propósito, para que vea en la primera vez que la app las limpia.
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
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

const palabra = (t: string, p: string) =>
  new RegExp(`(^|[^a-z0-9])${p}([^a-z0-9]|$)`).test(normal(t));

interface Etiqueta {
  texto: string;
  cumple: (final: string) => boolean;
}

interface Practica {
  titulo: string;
  apoyo: string;
  tituloHecho: string;
  apoyoHecho: string;
  frase: string;
  etiquetas: Etiqueta[];
  tarjeta: "historia" | "whatsapp" | "formula";
}

const termina = (t: string) => t.trim().endsWith(".");

const PRACTICAS: Practica[] = [
  {
    tarjeta: "historia",
    titulo: "Dicta el *motivo* de consulta.",
    apoyo:
      "Haz clic en el campo y lee la frase tal como está, con el «eh» y la equivocación.",
    tituloHecho: "Te corregiste al hablar. Quedó *limpio*.",
    apoyoHecho: "Así puedes dictar siempre: sin cuidarte de hablar perfecto.",
    frase:
      "Paciente de 58 años que consulta por, eh, dolor en la rodilla izquierda, no, perdón, en la rodilla derecha, desde hace tres días.",
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
    tarjeta: "whatsapp",
    titulo: "Ahora, respóndele a un *paciente*.",
    apoyo: "Igual que antes: clic en el campo, las dos teclas y hablas.",
    tituloHecho: "Lo que retiraste no *llegó*.",
    apoyoHecho: "El paciente solo lee lo que quisiste decir.",
    frase:
      "Hola, don Jaime. Tómela, este, después del almuerzo, no, perdón, después del desayuno, con un vaso de agua.",
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
    tarjeta: "formula",
    titulo: "Por último, una *fórmula*.",
    apoyo: "Aquí te vas a corregir en la dosis.",
    tituloHecho: "La dosis quedó como la *corregiste*.",
    apoyoHecho: "Lo que retiras al hablar no llega al texto.",
    frase:
      "Losartán de 50 miligramos, una tableta cada 12 horas, no, mentira, cada 24 horas, por 30 días.",
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
    const quitar = listen<number[]>("mic-level", (e) => {
      const v = e.payload;
      if (!v?.length) return;
      // Los niveles vienen por bandas de frecuencia; se reparten en 30 barras.
      setNiveles(
        Array.from({ length: BARRAS }, (_, i) => {
          const x = v[Math.floor((i / BARRAS) * v.length)] ?? 0;
          return Math.max(0, Math.min(1, x));
        }),
      );
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
                style={{ height: `${18 + Math.round(n * 110)}px` }}
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
      return e.type === "keydown" && e.key.toLowerCase() === etiqueta.toLowerCase();
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
      setEncendidas(keys.map((k) => (k === "Espacio" ? false : presionada(k, e))));
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
      escenario={<Teclas keys={keys} medida="grande" presionadas={encendidas} />}
      notaEscenario={funciono ? "Funciona. Así empiezas cada dictado." : instruccion}
      mensajeAyuda="Hola, el atajo de CloseLabs Voice no me funciona."
    />
  );
};

// ---------------------------------------------------------------------------------------------
// Pantallas 7 a 9: las prácticas
// ---------------------------------------------------------------------------------------------

type Fase = "esperando" | "grabando" | "procesando" | "listo";

const PracticaDictado: React.FC<{
  indice: number;
  atras: () => void;
  onContinuar: () => void;
  onSaltar: () => void;
}> = ({ indice, atras, onContinuar, onSaltar }) => {
  const practica = PRACTICAS[indice];
  const { keys, os } = useShortcutKeys();
  const mantener = useSettings().getSetting("push_to_talk") === true;
  const [texto, setTexto] = useState("");
  const [fase, setFase] = useState<Fase>("esperando");
  const [pista, setPista] = useState<string | null>(null);
  const faseRef = useRef<Fase>("esperando");
  faseRef.current = fase;
  const campo = useRef<HTMLTextAreaElement>(null);

  // Éxito: llegó texto de verdad al campo.
  useEffect(() => {
    if (fase !== "listo" && tieneDictado(texto)) {
      setFase("listo");
      setPista(null);
    }
  }, [texto, fase]);

  // "¿No pasa nada?" SOLO tras un intento (una tecla sin que empiece la grabación), nunca a
  // ciegas mientras el médico todavía lee (revisión del 2026-11-11).
  useEffect(() => {
    if (fase !== "esperando") return;
    const mostrar = () => {
      if (faseRef.current === "esperando") {
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
    const respaldo = setTimeout(mostrar, PISTA_SIN_GRABAR_MS);
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
        setPista("Sin internet no pudimos limpiar el texto. Revisa tu conexión y vuelve a intentarlo.");
      }),
      listen("paste-needs-manual", () =>
        setPista(`Tu texto quedó copiado. Haz clic en el campo y presiona ${pasteShortcut(os)}.`),
      ),
      listen("paste-error", () =>
        setPista(`Tu texto quedó copiado. Haz clic en el campo y presiona ${pasteShortcut(os)}.`),
      ),
    ];
    return () => {
      clearTimeout(sinTexto);
      subs.forEach((p) => void p.then((f) => f()));
    };
  }, [os]);

  // El cursor en el campo al volver a la ventana.
  useEffect(() => {
    campo.current?.focus();
    const alVolver = () => {
      if (faseRef.current !== "listo") campo.current?.focus();
    };
    window.addEventListener("focus", alVolver);
    return () => window.removeEventListener("focus", alVolver);
  }, []);

  const listo = fase === "listo";
  const etiquetas = useMemo(
    () => (listo ? practica.etiquetas.filter((e) => e.cumple(texto)) : []),
    [listo, texto, practica],
  );

  const repetir = () => {
    setTexto("");
    setFase("esperando");
    setPista(null);
    setTimeout(() => campo.current?.focus(), 0);
  };

  const guiaInicio = (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-[15px] leading-[22px] text-tinta-2">
      {fase === "grabando" ? (
        <span className="font-semibold text-lila-hover">Te escucho…</span>
      ) : (
        <>
          {mantener ? "Mantén presionadas" : "Presiona"} <Teclas keys={keys} />
          {mantener ? " mientras dices:" : " y di:"}
        </>
      )}
    </span>
  );
  const guiaFin = (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-[15px] leading-[22px] text-tinta-2">
      {mantener ? (
        "Suelta las teclas para terminar."
      ) : (
        <>
          Presiona <Teclas keys={keys} />
          {fase === "grabando" ? " para terminar." : " otra vez para terminar."}
        </>
      )}
    </span>
  );

  const campoPractica = (
    <div
      className={`relative rounded-[10px] border-[1.5px] border-tinta px-4 py-3.5 text-left ${
        listo ? "" : "cursor-text"
      } focus-within:shadow-[0_0_0_3px_var(--foco)]`}
      onClick={() => campo.current?.focus()}
    >
      {!listo && (
        <div aria-hidden className="flex flex-col">
          {guiaInicio}
          <p className="font-serif italic text-[20px] leading-[29px] text-tinta mt-2 mb-2.5">
            «{practica.frase}»
          </p>
          {guiaFin}
        </div>
      )}
      <textarea
        ref={campo}
        data-dictado-destino
        aria-label="Campo de práctica"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        readOnly={listo}
        rows={listo ? 3 : 1}
        className={
          listo
            ? "w-full resize-none bg-transparent text-[16px] leading-[25px] text-tinta focus:outline-none select-text"
            : "absolute inset-0 w-full h-full opacity-0 resize-none cursor-text"
        }
      />
    </div>
  );

  return (
    <PlantillaPrimerUso
      clave={`practica-${indice}-${listo ? "hecha" : "dictar"}`}
      etapa="practica"
      atras={atras}
      titulo={listo ? practica.tituloHecho : practica.titulo}
      apoyo={listo ? practica.apoyoHecho : practica.apoyo}
      principal={{ texto: "Continuar", onClick: onContinuar, disabled: !listo }}
      enlace={
        listo
          ? { texto: "Repetir", onClick: repetir }
          : { texto: "Saltar la práctica", onClick: onSaltar }
      }
      escenario={
        <div className="flex flex-col items-center gap-5">
          <Tarjeta tipo={practica.tarjeta}>{campoPractica}</Tarjeta>
          {listo && etiquetas.length > 0 && (
            <div className="flex flex-nowrap justify-center gap-2">
              {etiquetas.map((e, i) => (
                <span
                  key={e.texto}
                  className="h-[34px] inline-flex items-center gap-2 rounded-[17px] pl-2.5 pr-3.5 bg-lila-suave text-lila-tinta text-[15px] font-semibold whitespace-nowrap opacity-0 animate-[etiqueta_200ms_cubic-bezier(.2,.8,.2,1)_forwards]"
                  style={{ animationDelay: `${i * 120}ms` }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
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
              ))}
            </div>
          )}
        </div>
      }
      mensajeAyuda="Hola, estoy haciendo mi primer dictado en CloseLabs Voice y necesito ayuda."
    >
      {pista && <Aviso>{pista}</Aviso>}
    </PlantillaPrimerUso>
  );
};

/** Las tres tarjetas del escenario: historia clínica, WhatsApp y fórmula médica. */
const Tarjeta: React.FC<{
  tipo: Practica["tarjeta"];
  children: React.ReactNode;
}> = ({ tipo, children }) => {
  const [medico, setMedico] = useState<string>("");
  useEffect(() => {
    if (tipo !== "formula") return;
    void commands.accountState().then((r) => {
      if (r.status === "ok" && r.data.full_name) setMedico(r.data.full_name);
    });
  }, [tipo]);

  if (tipo === "whatsapp") {
    return (
      <TarjetaEscenario
        nombre={
          <span className="inline-flex items-center gap-2.5">
            <span className="grid place-items-center w-8 h-8 rounded-full bg-lino-2 text-[13px] font-semibold text-tinta-2">
              JP
            </span>
            Jaime Pardo
          </span>
        }
        contexto="WhatsApp"
      >
        <div className="bg-[#EEEAF1] px-4 py-4">
          <div className="max-w-[330px] bg-papel rounded-[4px_14px_14px_14px] px-3.5 py-2.5 text-[16px] leading-6 text-tinta">
            Buenas tardes. ¿La pastilla de la presión me la tomo antes o después
            de comer?
            <span className="block text-right text-[13px] text-tinta-3 mt-1">
              3:42 p. m.
            </span>
          </div>
        </div>
        <div className="px-4 pt-3.5 pb-4">{children}</div>
      </TarjetaEscenario>
    );
  }

  if (tipo === "formula") {
    const hoy = new Date().toLocaleDateString("es", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    return (
      <TarjetaEscenario nombre={medico || "Tu fórmula"} contexto="Fórmula médica">
        <div className="p-5 flex flex-col gap-3">
          <div className="flex items-baseline justify-between pb-2.5 border-b border-linea text-[15px] text-tinta-2">
            <span>
              Paciente: <strong className="text-tinta font-semibold">Marta Rojas</strong>
            </span>
            <span>{hoy}</span>
          </div>
          <span className="font-serif text-[30px] leading-none font-medium text-tinta">
            Rp.
          </span>
          {children}
        </div>
      </TarjetaEscenario>
    );
  }

  return (
    <TarjetaEscenario nombre="Historia clínica" contexto="Marta Rojas · 58 años">
      <div className="p-5 flex flex-col gap-2">
        <span className="text-[14px] font-semibold text-tinta-2">
          Motivo de consulta
        </span>
        {children}
        <span className="text-[14px] font-semibold text-tinta-2 mt-3">
          Examen físico
        </span>
        <div className="h-[52px] rounded-[10px] border-[1.5px] border-linea bg-tarjeta-cab" />
      </div>
    </TarjetaEscenario>
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
                  En 20 historias al día, son unos {minutos} minutos menos frente
                  al teclado.
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

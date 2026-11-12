/* eslint-disable i18next/no-literal-string */
import React, { useEffect, useState } from "react";
import { useShortcutKeys } from "../../../hooks/useShortcutKeys";
import { useSettings } from "../../../hooks/useSettings";
import { ABRIR_PRIMER_DICTADO } from "../../onboarding/PrimerDictado";
import { Teclas } from "../../tinta/Teclas";
import { BotonSecundario, Enlace } from "../../tinta/Botones";
import { Aviso } from "../../tinta/Campos";

/** Evento para cambiar de sección desde una página (Inicio → Diccionario). Lo escucha App. */
export const IR_A_SECCION = "clv:ir-a-seccion";

/**
 * Inicio: UNA frase, la única que hay que recordar (plan del primer uso, 2026-11-11; diseño «Tinta y
 * voz», diseno/SISTEMA.md §10). Sin historial ni cifras (decisión de Nicolás). Abajo, el dictado de
 * prueba y el camino al Diccionario, que salió del tutorial.
 */
export const HomeSettings: React.FC = () => {
  const { keys } = useShortcutKeys();
  // Con "mantener presionado" se termina soltando, no presionando otra vez.
  const mantener = useSettings().getSetting("push_to_talk") === true;
  const [enLinea, setEnLinea] = useState(() => navigator.onLine);

  useEffect(() => {
    const si = () => setEnLinea(true);
    const no = () => setEnLinea(false);
    window.addEventListener("online", si);
    window.addEventListener("offline", no);
    return () => {
      window.removeEventListener("online", si);
      window.removeEventListener("offline", no);
    };
  }, []);

  return (
    <div className="min-h-[calc(100vh-88px)] flex flex-col">
      {!enLinea && (
        <Aviso>
          <strong className="font-semibold">Sin internet.</strong> Puedes seguir
          dictando; el texto sale sin pulir hasta que vuelva la conexión.
        </Aviso>
      )}

      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <p className="max-w-[700px] font-serif font-medium text-[42px] leading-[60px] tracking-[-0.015em] text-tinta">
          Haz clic donde quieras escribir,{" "}
          {mantener ? "mantén presionadas" : "presiona"}{" "}
          <Teclas keys={keys} medida="inicio" />
          {mantener ? " mientras hablas, y suelta para " : ", habla, y presiona otra vez para "}
          <em className="italic text-lila">terminar</em>.
        </p>

        <BotonSecundario
          medida="corto"
          className="mt-9"
          onClick={() => window.dispatchEvent(new Event(ABRIR_PRIMER_DICTADO))}
        >
          Hacer un dictado de prueba
        </BotonSecundario>
      </div>

      <p className="pb-8 text-center text-[16px] text-tinta-2">
        ¿Escribió mal una palabra?{" "}
        <Enlace
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent(IR_A_SECCION, { detail: "dictionary" }),
            )
          }
        >
          Agrégala al Diccionario
        </Enlace>
      </p>
    </div>
  );
};

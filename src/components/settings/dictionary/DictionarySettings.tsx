/* eslint-disable i18next/no-literal-string */
import React, { useState } from "react";
import { useSettings } from "../../../hooks/useSettings";
import { Titulo, Apoyo } from "../../tinta/Titulo";
import { BotonPrincipal, Enlace } from "../../tinta/Botones";
import { CLASE_CAMPO } from "../../tinta/Campos";

/**
 * Diccionario (diseno/SISTEMA.md §10): las palabras que la app debe escribir siempre igual
 * (medicamentos, nombres de colegas, siglas). Mismo ajuste (`custom_words`) y mismas reglas que
 * antes: hasta tres palabras y 50 caracteres por término, sin repetidos.
 */
export const DictionarySettings: React.FC = () => {
  const { getSetting, updateSetting, isUpdating } = useSettings();
  const palabras: string[] = getSetting("custom_words") || [];
  const [nueva, setNueva] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const ocupado = isUpdating("custom_words");

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
    <div>
      <Titulo>Diccionario</Titulo>
      <Apoyo className="mt-2">
        Nombres, medicamentos o siglas que la app debe escribir siempre igual.
      </Apoyo>

      <form
        noValidate
        className="mt-[22px] flex gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          agregar();
        }}
      >
        <input
          aria-label="Palabra nueva"
          value={nueva}
          onChange={(e) => {
            setNueva(e.target.value);
            setAviso(null);
          }}
          placeholder="Escribe la palabra como debe quedar"
          className={`${CLASE_CAMPO} flex-1`}
          disabled={ocupado}
        />
        <BotonPrincipal
          type="submit"
          medida="normal"
          className="!h-[50px]"
          disabled={!nueva.trim() || ocupado}
        >
          Agregar
        </BotonPrincipal>
      </form>
      {aviso && <p className="mt-2 text-[15px] text-aviso">{aviso}</p>}

      {palabras.length === 0 ? (
        <div className="mt-6 mb-10 rounded-[16px] bg-lino px-8 py-16 flex flex-col items-center text-center">
          <Titulo tamano="vacio">Todavía no hay palabras.</Titulo>
          <p className="mt-3 max-w-[460px] text-[17px] leading-[26px] text-tinta-2">
            Cuando la app escriba mal un nombre o un medicamento, agrégalo aquí
            una vez. No vuelve a fallar.
          </p>
        </div>
      ) : (
        <section className="mt-6">
          <div className="pb-2.5 border-b border-linea">
            <h2 className="text-[14px] leading-5 font-semibold text-tinta-3">
              Tus palabras · {palabras.length}
            </h2>
          </div>
          <ul className="divide-y divide-linea border-b border-linea">
            {palabras.map((p) => (
              <li
                key={p}
                className="min-h-[54px] flex items-center justify-between gap-6"
              >
                <span className="text-[17px] font-medium text-tinta">{p}</span>
                <Enlace
                  chico
                  disabled={ocupado}
                  onClick={() =>
                    updateSetting(
                      "custom_words",
                      palabras.filter((x) => x !== p),
                    )
                  }
                >
                  Quitar
                </Enlace>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

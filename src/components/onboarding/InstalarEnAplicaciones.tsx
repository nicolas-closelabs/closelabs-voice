/* eslint-disable i18next/no-literal-string */
import React, { useEffect, useRef, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { commands } from "@/bindings";
import { supportWhatsappUrl } from "../../branding";
import PlantillaPrimerUso from "../tinta/PlantillaPrimerUso";
import { ListaPasos, type EstadoPaso } from "../tinta/Pasos";
import { IlustracionVoz } from "../auth/Bienvenida";

/**
 * "Instalando" (Mac). Ver `instalacion_mac.rs` para el porqué del .dmg de doble clic.
 *
 * Desde 2026-11-13 esto corre SIN VENTANA: la copia que se abre desde el disco del instalador no
 * muestra la ventana (`lib.rs`), copia la app a Aplicaciones, quita la cuarentena y relanza la de
 * Aplicaciones, que abre directo en la bienvenida. Antes se veía un cuadro "Instalando" que aparecía
 * y se iba, y Nicolás lo vio como un bug ("esa ventana está sobrando").
 *
 * La ventana solo aparece si algo sale mal (no se pudo copiar o relanzar) o si tarda más de 8 s: ahí
 * el médico necesita saber qué pasa.
 */
const LENTO_MS = 8000;

const NOMBRES = [
  "Copiando a Aplicaciones",
  "Preparando tu computador",
  "Abriendo CloseLabs Voice",
];

const mostrarVentana = () => void commands.showMainWindowCommand().catch(() => {});

export const InstalarEnAplicaciones: React.FC = () => {
  // Cuántos pasos están hechos (0 a 3). Solo se ven si la ventana llega a mostrarse.
  const [hechos, setHechos] = useState(0);
  const [fallo, setFallo] = useState(false);
  const [lento, setLento] = useState(false);
  const empezo = useRef(false);

  const instalar = async () => {
    setFallo(false);
    setLento(false);
    setHechos(0);
    const alarma = setTimeout(() => {
      setLento(true);
      mostrarVentana();
    }, LENTO_MS);
    const r = await commands.copiarAAplicaciones();
    if (r.status === "error") {
      clearTimeout(alarma);
      setFallo(true);
      mostrarVentana();
      return;
    }
    setHechos(2);
    // Si sale bien, esta copia se cierra y la de Aplicaciones abre en la bienvenida.
    const r2 = await commands.relanzarInstalada(r.data);
    clearTimeout(alarma);
    if (r2.status === "error") {
      setFallo(true);
      mostrarVentana();
    }
  };

  useEffect(() => {
    // Una sola vez aunque React monte dos veces en desarrollo.
    if (empezo.current) return;
    empezo.current = true;
    void instalar();
  }, []);

  const estado = (i: number): EstadoPaso =>
    i < hechos ? "hecho" : i === hechos && !fallo ? "en-curso" : "pendiente";

  if (fallo) {
    return (
      <PlantillaPrimerUso
        clave="instalar-fallo"
        titulo="No se pudo *instalar*."
        apoyo="Escríbenos y te ayudamos en un momento, o hazlo a mano: cierra esta ventana, abre el Finder y arrastra CloseLabs Voice a Aplicaciones."
        principal={{ texto: "Reintentar", onClick: () => void instalar() }}
        enlace={{
          texto: "Pedir ayuda",
          onClick: () =>
            void openUrl(
              supportWhatsappUrl(
                "Hola, no logro instalar CloseLabs Voice en mi Mac.",
              ),
            ),
        }}
        escenario={<IlustracionVoz />}
        mensajeAyuda="Hola, no logro instalar CloseLabs Voice en mi Mac."
      />
    );
  }

  return (
    <PlantillaPrimerUso
      clave="instalando"
      titulo="*Instalando* CloseLabs Voice."
      apoyo={
        lento
          ? "Está tardando más de lo normal. No cierres esta ventana."
          : "No tienes que hacer nada. Tarda unos segundos."
      }
      escenario={<IlustracionVoz />}
      mensajeAyuda="Hola, no logro instalar CloseLabs Voice en mi Mac."
    >
      <LineaAvance hechos={hechos} />
      <div className="mt-3">
        <ListaPasos
          compacta
          pasos={NOMBRES.map((nombre, i) => ({ nombre, estado: estado(i) }))}
        />
      </div>
    </PlantillaPrimerUso>
  );
};

/**
 * La línea de avance: renglón de tinta ya recorrido, la onda lila en la punta y puntos por
 * recorrer. La onda que se vuelve renglón es el motivo propio de la marca (SISTEMA.md §11).
 */
const LineaAvance: React.FC<{ hechos: number }> = ({ hechos }) => {
  const avance = [30, 62, 97, 100][Math.min(hechos, 3)];
  return (
    <div className="relative h-9 w-full" aria-hidden>
      {/* Por recorrer: puntos */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[3px] bg-[radial-gradient(circle,var(--linea-fuerte)_1.5px,transparent_1.6px)] bg-[length:9px_3px]" />
      {/* Recorrido: renglón de tinta + la onda en la punta */}
      <div
        className="absolute left-0 top-0 h-full bg-papel transition-[width] duration-[600ms] ease-in-out flex items-center"
        style={{ width: `${avance}%` }}
      >
        <div className="flex-1 h-[3px] rounded-full bg-tinta" />
        <svg width="64" height="36" viewBox="0 0 64 36" className="-ml-px shrink-0">
          <path
            d="M0 18 C6 18 8 6 13 6 S20 30 26 30 S33 8 38 8 S45 26 50 26 S57 18 64 18"
            stroke="var(--lila)"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
};

export default InstalarEnAplicaciones;

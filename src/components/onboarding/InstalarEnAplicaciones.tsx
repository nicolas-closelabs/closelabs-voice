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
 * Diseño (diseno/SISTEMA.md §8): la MISMA plantilla, tamaño y dibujo que la bienvenida, con tres
 * pasos que se ven al menos 1,2 s cada uno. En la revisión del 2026-11-11 la ventana "Instalando…"
 * duraba 3-4 s y Nicolás la vio como un parpadeo ("parece un bug"); ahora se ve qué está pasando.
 *
 * Dos usos:
 * - La copia que corre desde el disco (`recienInstalada = false`): copia, quita la cuarentena y
 *   relanza la de Aplicaciones con `--recien-instalada`.
 * - La copia recién abierta desde Aplicaciones (`recienInstalada = true`): muestra el mismo cuadro con
 *   los pasos 1 y 2 hechos y el 3 en curso, lo cierra y sigue a la bienvenida (`onListo`).
 */
const MINIMO_POR_PASO_MS = 1200;
const LENTO_MS = 8000;

const NOMBRES = [
  "Copiando a Aplicaciones",
  "Preparando tu computador",
  "Abriendo CloseLabs Voice",
];

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const InstalarEnAplicaciones: React.FC<{
  recienInstalada?: boolean;
  onListo?: () => void;
}> = ({ recienInstalada = false, onListo }) => {
  // Cuántos pasos están hechos (0 a 3).
  const [hechos, setHechos] = useState(recienInstalada ? 2 : 0);
  const [fallo, setFallo] = useState(false);
  const [lento, setLento] = useState(false);
  const empezo = useRef(false);

  const instalar = async () => {
    setFallo(false);
    setLento(false);
    setHechos(0);
    const alarma = setTimeout(() => setLento(true), LENTO_MS);
    const inicio = Date.now();
    const r = await commands.copiarAAplicaciones();
    clearTimeout(alarma);
    if (r.status === "error") {
      setFallo(true);
      return;
    }
    await esperar(Math.max(0, MINIMO_POR_PASO_MS - (Date.now() - inicio)));
    setHechos(1);
    await esperar(MINIMO_POR_PASO_MS);
    setHechos(2);
    await esperar(MINIMO_POR_PASO_MS);
    // Si sale bien, esta ventana se cierra y la de Aplicaciones abre con el mismo cuadro.
    const r2 = await commands.relanzarInstalada(r.data);
    if (r2.status === "error") setFallo(true);
  };

  useEffect(() => {
    // Una sola vez aunque React monte dos veces en desarrollo.
    if (empezo.current) return;
    empezo.current = true;
    if (recienInstalada) {
      // La copia nueva: el mismo cuadro 800 ms, el paso 3 hecho 400 ms, y a la bienvenida.
      void (async () => {
        await esperar(800);
        setHechos(3);
        await esperar(400);
        onListo?.();
      })();
    } else {
      void instalar();
    }
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

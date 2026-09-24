/* eslint-disable i18next/no-literal-string */
import React from "react";

/**
 * Guía visual del permiso de Accesibilidad en Mac.
 *
 * Por qué existe: es el punto donde más se pierde un médico poco técnico. La app abre Ajustes del
 * Sistema, pero al otro lado aparece una ventana llena de opciones y nadie le dijo QUÉ tocar.
 * Antes solo decía "Conceder permiso" y el médico se quedaba mirando la pantalla del sistema.
 *
 * El dibujo es DELIBERADAMENTE genérico: no imita la interfaz de Apple ni usa sus íconos; solo
 * reproduce la forma que el médico va a ver (una lista con el nombre de la app y un interruptor)
 * para que reconozca dónde está parado.
 */

const PASOS = [
  "Se abrió Ajustes del Sistema en Privacidad y seguridad › Accesibilidad.",
  "Busca CloseLabs Voice en la lista.",
  "Toca el interruptor para encenderlo.",
];

/**
 * `actualizando`: solo quien YA usaba la app necesita el aviso de apagar y volver a encender. A un
 * médico nuevo no le dice nada y le mete ruido justo donde menos sobra.
 */
export const GuiaAccesibilidadMac: React.FC<{ actualizando?: boolean }> = ({
  actualizando = false,
}) => (
  <div className="w-full rounded-2xl border border-brand-border bg-brand-surface p-4 flex flex-col gap-3">
    <p className="text-[15px] font-semibold text-brand-text">
      Así se ve en tu Mac:
    </p>

    <Dibujo />

    <ol className="flex flex-col gap-1.5">
      {PASOS.map((paso, i) => (
        <li key={i} className="flex items-start gap-2 text-[14px] leading-snug">
          <span className="grid place-items-center w-5 h-5 shrink-0 rounded-full bg-brand-accent text-white text-[11px] font-semibold font-heading">
            {i + 1}
          </span>
          <span className="text-brand-text-secondary">{paso}</span>
        </li>
      ))}
    </ol>

    <p className="text-[13px] leading-snug text-brand-text-muted">
      Si te pide la contraseña de tu Mac o tu huella, es normal: la pide el sistema, no nosotros.
      Cuando lo enciendas, vuelve aquí; esta pantalla sigue sola.
    </p>

    {/* El permiso de macOS va atado a la versión exacta del programa: tras actualizar, el
        interruptor se ve encendido pero ya no vale. Sin el aviso, el médico jura que ya lo dio y
        se queda trancado. ⚠️ Solo se le muestra a quien ya usaba la app: al recién llegado le
        sobra. ⚠️ AL FIRMAR CON DEVELOPER ID ESTO SE BORRA: el permiso sobrevivirá a las
        actualizaciones y el aviso pasará a ser mentira. */}
    {actualizando && (
      <p className="text-[13px] leading-snug text-brand-text-muted">
        <strong className="text-brand-text">¿Ya aparece encendido?</strong> Apágalo y vuelve a
        encenderlo. Al instalar una versión nueva, el permiso anterior deja de servir.
      </p>
    )}
  </div>
);

/** La ventana de ajustes, simplificada: lista de apps y el interruptor señalado. */
const Dibujo: React.FC = () => (
  <svg
    viewBox="0 0 420 200"
    className="w-full h-auto rounded-xl border border-brand-border bg-white"
    role="img"
    aria-label="Dibujo de la ventana de Ajustes del Sistema con el interruptor de CloseLabs Voice encendido"
  >
    {/* Barra de la ventana */}
    <rect x="0" y="0" width="420" height="26" fill="#f2eef8" />
    <circle cx="16" cy="13" r="4" fill="#d8cfe4" />
    <circle cx="30" cy="13" r="4" fill="#d8cfe4" />
    <circle cx="44" cy="13" r="4" fill="#d8cfe4" />
    <text x="62" y="17" fontSize="10" fontWeight="600" fill="#5e4a6b">
      Privacidad y seguridad › Accesibilidad
    </text>
    <line x1="0" y1="26" x2="420" y2="26" stroke="#e2d6ee" />

    {/* Dos apps cualquiera, apagadas: dan contexto de lista */}
    <FilaApp y={44} nombre="Otra aplicación" encendido={false} />
    <FilaApp y={80} nombre="Otra aplicación" encendido={false} />

    {/* La nuestra, resaltada y encendida */}
    <rect x="12" y="108" width="396" height="36" rx="9" fill="#f3e9ff" stroke="#a439ff" />
    <rect x="24" y="117" width="18" height="18" rx="5" fill="#1a1620" />
    <text x="52" y="131" fontSize="12" fontWeight="700" fill="#1a1620">
      CloseLabs Voice
    </text>
    <g>
      <rect x="346" y="116" width="42" height="22" rx="11" fill="#a439ff" />
      <circle cx="377" cy="127" r="8.5" fill="#ffffff" />
    </g>

    {/* La flecha que dice dónde tocar */}
    <path
      d="M330 172 C348 172 366 160 374 146"
      stroke="#a439ff"
      strokeWidth="2.5"
      fill="none"
      strokeLinecap="round"
    />
    <path d="M374 146 l-7 6 M374 146 l1 9" stroke="#a439ff" strokeWidth="2.5" strokeLinecap="round" />
    <text x="196" y="178" fontSize="12" fontWeight="700" fill="#8b2ff3">
      enciéndelo aquí
    </text>
  </svg>
);

const FilaApp: React.FC<{ y: number; nombre: string; encendido: boolean }> = ({
  y,
  nombre,
  encendido,
}) => (
  <g opacity="0.55">
    <rect x="24" y={y + 1} width="16" height="16" rx="4" fill="#d8cfe4" />
    <text x="52" y={y + 14} fontSize="11" fill="#7d6f88">
      {nombre}
    </text>
    <rect
      x="348"
      y={y - 1}
      width="38"
      height="20"
      rx="10"
      fill={encendido ? "#a439ff" : "#e2d6ee"}
    />
    <circle cx={encendido ? 376 : 358} cy={y + 9} r="7.5" fill="#ffffff" />
  </g>
);

export default GuiaAccesibilidadMac;

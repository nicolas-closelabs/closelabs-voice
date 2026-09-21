import React, { useState } from "react";
import { BRANDING } from "../../branding";

interface LogoProps {
  width?: number | string;
  className?: string;
}

/**
 * Logo de CloseLabs Voice (wordmark: isotipo + "CloseLabs").
 *
 * Renderiza el ARCHIVO de logo provisto por el cliente (regla de marca: nunca
 * recrear/redibujar el isotipo). Coloca los PNG en `public/brand/`:
 *   - closelabs-black.png (fondos claros)  ·  closelabs-white.png (fondos oscuros)
 * Mientras los archivos no existan, cae a un wordmark de texto (sin dibujar el
 * hexágono, para respetar la regla de marca).
 */
const Logo: React.FC<LogoProps> = ({ width = 140, className = "" }) => {
  const [failed, setFailed] = useState(false);

  if (failed) {
    const fontSize = typeof width === "number" ? Math.round(width / 7) : 20;
    return (
      <span
        className={`font-heading font-extrabold tracking-tight text-text ${className}`}
        style={{ fontSize }}
        aria-label={BRANDING.appName}
      >
        {BRANDING.company}
      </span>
    );
  }

  return (
    <>
      <img
        src={BRANDING.logo.fullBlack}
        alt={BRANDING.appName}
        width={width}
        className={`block dark:hidden ${className}`}
        onError={() => setFailed(true)}
      />
      <img
        src={BRANDING.logo.fullWhite}
        alt={BRANDING.appName}
        width={width}
        className={`hidden dark:block ${className}`}
        onError={() => setFailed(true)}
      />
    </>
  );
};

export default Logo;

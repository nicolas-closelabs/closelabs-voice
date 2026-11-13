/* eslint-disable i18next/no-literal-string */
import React from "react";
import "@fontsource-variable/schibsted-grotesk";

/**
 * La ventanita pegada debajo de Ajustes del Sistema (ver `guia_ajustes.rs`): una sola instrucción
 * con una flecha hacia arriba, porque lo que hay que tocar está justo encima. No tiene botones: el
 * médico no tiene que hacer nada en ella, y se va sola cuando el permiso queda dado.
 */
const GuiaAjustes: React.FC = () => (
  <div
    style={{
      height: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: '"Schibsted Grotesk Variable", system-ui, sans-serif',
      userSelect: "none",
      cursor: "default",
    }}
  >
    <div
      style={{
        width: "calc(100% - 8px)",
        height: "calc(100% - 8px)",
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "0 16px",
        borderRadius: 16,
        background: "#18141D",
        border: "1px solid rgba(255,255,255,0.14)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
        color: "#FFFFFF",
      }}
    >
      <span
        aria-hidden
        style={{
          display: "grid",
          placeItems: "center",
          width: 36,
          height: 36,
          flexShrink: 0,
          borderRadius: 999,
          background: "#A439FF",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 19V5M12 5l-6 6M12 5l6 6"
            stroke="#fff"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <p style={{ margin: 0, flex: 1, fontSize: 16, lineHeight: "22px" }}>
        Busca <strong>CloseLabs Voice</strong> en la lista de arriba y enciende
        su interruptor.
      </p>
      {/* El ícono de la app, para reconocer la fila de la lista. */}
      <span
        aria-hidden
        style={{
          display: "grid",
          placeItems: "center",
          width: 40,
          height: 40,
          flexShrink: 0,
          borderRadius: 10,
          background: "#FFFFFF",
        }}
      >
        <img
          src="/brand/closelabs-isotype-black.png"
          alt=""
          style={{ width: 26, height: 26, objectFit: "contain" }}
        />
      </span>
    </div>
  </div>
);

export default GuiaAjustes;

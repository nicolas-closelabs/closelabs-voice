import React from "react";
import ReactDOM from "react-dom/client";
import RecordingOverlay from "./RecordingOverlay";
import "@/i18n";
import "@fontsource-variable/plus-jakarta-sans";
// La píldora escribe en Newsreader ("Escribiendo", la pista, los avisos): pedido de Nicolás, 2026-11-12.
import "@fontsource-variable/newsreader/opsz.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <RecordingOverlay />
  </React.StrictMode>,
);

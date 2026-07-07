CloseLabs Voice — Assets de marca
=================================

Coloca aquí los archivos de logo PROVISTOS por CloseLabs (regla de marca: usar los
archivos tal cual, nunca recrear/redibujar el isotipo hexagonal). El componente
`src/components/icons/Logo.tsx` los referencia por estas rutas exactas:

  closelabs-black.png          Logo completo (isotipo + wordmark), NEGRO  -> fondos claros
  closelabs-white.png          Logo completo (isotipo + wordmark), BLANCO -> fondos oscuros
  closelabs-isotype-black.png  Solo isotipo (hexágono), negro
  closelabs-isotype-white.png  Solo isotipo (hexágono), blanco

Mientras estos archivos no existan, la UI muestra un wordmark de texto de respaldo.

Para el ÍCONO de la app (dock/tray/instalador), se genera aparte desde el isotipo:
  bun tauri icon <ruta-al-isotipo-1024x1024.png>
Eso regenera src-tauri/icons/*. Usa el isotipo cuadrado 1024x1024 con fondo transparente.

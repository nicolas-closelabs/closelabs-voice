Videos cortos que reemplazan a los dibujos de la app (se muestran solo si el archivo existe).

- accesibilidad-mac.mp4 — encender CloseLabs Voice en Ajustes del Sistema › Privacidad y
  seguridad › Accesibilidad. 10-15 s, sin sonido, H.264, ~900 px de ancho, menos de 1,5 MB
  (va dentro del instalador). Grabado en un Mac real con la app firmada instalada.
- como-funciona-mac.mp4 / como-funciona-win.mp4 — "Así se dicta" (40 s, sin sonido, ~540 KB cada uno).
  Animación, no grabación de pantalla: fuente en diseno/video/como-funciona.html, se regenera con
  `node diseno/herramientas/grabar-video.mjs diseno/video/como-funciona.html <salida.mp4> --so mac|win`.
  Se abre desde Inicio ("Ver cómo funciona") y Ayuda (src/components/VideoComoFunciona.tsx).

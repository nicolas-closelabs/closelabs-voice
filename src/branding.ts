/**
 * CloseLabs Voice — Fuente única de verdad de la marca.
 *
 * Todo texto/identidad de marca en la UI debe consumir estas constantes en vez de
 * hardcodear "CloseLabs Voice" u otros valores. Para cambiar nombre, enlaces o colores
 * de marca, edita SOLO este archivo (y `src/styles/theme.css` para el color).
 */

export const BRANDING = {
  /** Nombre visible completo de la app. */
  appName: "CloseLabs Voice",
  /** Nombre corto (tray, títulos compactos). */
  appShortName: "CloseLabs Voice",
  /** Empresa. */
  company: "CloseLabs",
  /** Tagline del producto. */
  tagline: "Dictado por voz para médicos",
  /** Sitio web. */
  website: "https://www.closelabs.co",
  /** Identificador del bundle (debe coincidir con tauri.conf.json). */
  bundleId: "com.closelabs.voice",

  /**
   * WhatsApp de soporte. Para cambiarlo, SOLO esta línea: todos los botones leen de aquí.
   * Formato internacional sin "+" ni espacios (lo exige wa.me).
   */
  supportWhatsapp: "573102991182",
  /** El mismo número, como se le muestra al médico. */
  supportWhatsappDisplay: "+57 310 299 1182",

  /** Colores de marca (referencia; la fuente para CSS es src/styles/theme.css). */
  colors: {
    accent: "#A439FF",
    accentSecondary: "#8B2FF3",
    bg: "#F5EDFF",
    textPrimary: "#1A1620",
  },

  /**
   * Rutas de los assets de logo provistos por el cliente (se colocan en /public).
   * REGLA: usar los archivos tal cual — nunca recrear/redibujar el isotipo.
   */
  logo: {
    /** Logo completo (isotipo + wordmark), negro, para fondos claros. */
    fullBlack: "/brand/closelabs-black.png",
    /** Logo completo, blanco, para fondos oscuros. */
    fullWhite: "/brand/closelabs-white.png",
    /** Solo isotipo (hexágono) negro. */
    isotypeBlack: "/brand/closelabs-isotype-black.png",
    /** Solo isotipo (hexágono) blanco. */
    isotypeWhite: "/brand/closelabs-isotype-white.png",
  },
} as const;

export type Branding = typeof BRANDING;

/**
 * Enlace para abrir un chat de soporte con el mensaje ya escrito.
 *
 * El mensaje va prellenado a propósito: para un médico poco familiarizado con la tecnología,
 * "abrir WhatsApp y darle a enviar" es un paso; "abrir WhatsApp y pensar qué escribir" es
 * donde se rinde.
 */
export function supportWhatsappUrl(
  mensaje = "Hola, necesito ayuda con CloseLabs Voice.",
): string {
  return `https://wa.me/${BRANDING.supportWhatsapp}?text=${encodeURIComponent(mensaje)}`;
}

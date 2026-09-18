/**
 * Clasificación del micrófono por su nombre.
 *
 * cpal no expone cómo está conectado el dispositivo, así que se deduce del nombre (es lo que
 * hace Aztec). Sirve para dos cosas: recomendar el micrófono del computador y avisar que los
 * audífonos Bluetooth tardan 1-2 s en arrancar, por lo que se pierden las primeras palabras.
 */
export type MicrophoneTransport = "builtin" | "bluetooth" | "wired" | "unknown";

const BLUETOOTH_HINTS = [
  "airpods",
  "bluetooth",
  "wireless",
  "buds",
  "beats",
  "wh-1000",
  "wf-1000",
  "jabra",
  "galaxy",
  "soundcore",
  "freebuds",
  "inalámbric",
  "inalambric",
];

const BUILTIN_HINTS = [
  "built-in",
  "builtin",
  "internal",
  "macbook",
  "imac",
  "integrado",
  "integrada",
  "interno",
  "interna",
  "microphone array",
  "matriz de micrófonos",
];

const WIRED_HINTS = [
  "usb",
  "yeti",
  "rode",
  "shure",
  "audio-technica",
  "webcam",
  "hdmi",
];

export function classifyMicrophone(name: string): MicrophoneTransport {
  const n = name.toLowerCase();
  if (BLUETOOTH_HINTS.some((hint) => n.includes(hint))) return "bluetooth";
  if (BUILTIN_HINTS.some((hint) => n.includes(hint))) return "builtin";
  if (WIRED_HINTS.some((hint) => n.includes(hint))) return "wired";
  return "unknown";
}

/** Nombre del micrófono del computador, si se pudo identificar entre los disponibles. */
export function findBuiltInMicrophone(names: string[]): string | undefined {
  return names.find((name) => classifyMicrophone(name) === "builtin");
}

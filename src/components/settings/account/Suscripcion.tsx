/* eslint-disable i18next/no-literal-string */
import React, { useCallback, useEffect, useState } from "react";
import { CreditCard, ExternalLink, Hourglass, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { commands, type EstadoCuenta } from "@/bindings";

/**
 * La suscripción en "Mi cuenta": qué estado tiene el médico y el botón que le toca.
 *
 * Lo decidido con Nicolás (ROADMAP, Fase 2, y STRIPE.md):
 * - La prueba arranca sin tarjeta; se pone al final. El botón existe durante la prueba, pero solo
 *   se destaca en los últimos días.
 * - El pago, el cambio de tarjeta y la cancelación son páginas de Stripe en el navegador. Al
 *   volver a la app, esto se pone al día solo (`sync` al recuperar el foco).
 * - Cancelar es fácil y sin trucos: un botón, que lleva al portal de Stripe.
 * - Al terminar la prueba sin pagar, NO un error: la pantalla amable `FinDePrueba`, con lo que
 *   dictó y UN botón.
 *
 * ⚠️ Quién puede dictar lo decide el servidor (`authorize_device_v2`). `situacion` repite su regla
 * (la fecha manda sobre el estado) solo para escoger qué mostrar.
 */

/** El precio vive en Stripe; esto es solo el texto. Si cambia allá, cambiarlo aquí. */
const PRECIO = "US$11 al mes";

/** Después de abrir Stripe, cuánto tiempo seguimos poniéndonos al día (en silencio) cada vez que vuelve a la app. */
const ESPERA_MAX_MS = 15 * 60_000;

function fecha(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" });
}

function diasHasta(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Number.isNaN(ms) ? null : Math.ceil(ms / 86_400_000);
}

const futura = (iso: string | null) => !!iso && new Date(iso).getTime() > Date.now();

type Situacion =
  | "prueba" // en prueba, sin tarjeta
  | "prueba_con_tarjeta" // en prueba, ya suscrito: el primer cobro llega al terminar la prueba
  | "activa"
  | "cancelada_vigente" // canceló, pero sigue dictando hasta el fin del período
  | "cobro_fallido" // Stripe está reintentando; sigue dictando
  | "fin_prueba" // la prueba terminó y nunca pagó
  | "sin_pagar" // se agotaron los reintentos de cobro
  | "terminada"; // tuvo suscripción y ya terminó

export function situacion(e: EstadoCuenta): Situacion {
  const vigente = futura(e.trial_ends_at) || futura(e.current_period_end);
  const status = e.status ?? "trialing";
  const viva = status === "trialing" || status === "active" || status === "past_due";

  if (vigente && viva && e.cancel_at_period_end) return "cancelada_vigente";
  if (status === "past_due") return "cobro_fallido";
  if (vigente) {
    if (status === "active") return "activa";
    if (status === "trialing") return e.has_billing ? "prueba_con_tarjeta" : "prueba";
    // `canceled` con la fecha viva: canceló y le queda período (ver authorize_device_v2).
    return "cancelada_vigente";
  }
  if (status === "active" && !e.current_period_end) return "activa";
  if (status === "unpaid") return "sin_pagar";
  if (!e.has_billing) return "fin_prueba";
  return "terminada";
}

/** "4 horas y 12 minutos", "38 minutos", "1 hora". */
function duracion(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  const hs = h === 1 ? "1 hora" : `${h} horas`;
  const ms = m === 1 ? "1 minuto" : `${m} minutos`;
  if (h === 0) return ms;
  return m === 0 ? hs : `${hs} y ${ms}`;
}

const MENSAJES_ERROR: Record<string, { titulo: string; detalle: string }> = {
  sin_conexion: { titulo: "Sin conexión", detalle: "Revisa tu internet e inténtalo de nuevo." },
  sin_navegador: {
    titulo: "No se pudo abrir el navegador",
    detalle: "Escríbenos por WhatsApp desde Ayuda y te mandamos el enlace.",
  },
  cobro_no_disponible: {
    titulo: "El pago no está disponible en este momento",
    detalle: "Escríbenos por WhatsApp desde Ayuda y lo resolvemos.",
  },
};

const ERROR_GENERICO = {
  titulo: "Algo no salió bien",
  detalle: "Inténtalo de nuevo en un momento. Si se repite, escríbenos por WhatsApp desde Ayuda.",
};

const BOTON =
  "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[15px] font-semibold transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2";
const BOTON_PRINCIPAL = `${BOTON} bg-brand-accent text-white hover:bg-brand-accent-secondary`;
const BOTON_SECUNDARIO = `${BOTON} border border-brand-border bg-white hover:border-brand-accent hover:text-brand-accent`;

/**
 * Se abrió una página de Stripe (desde "Mi cuenta" o desde el pop-up de fin de prueba).
 *
 * Vive FUERA del componente a propósito: si viviera dentro, cambiar de sección lo borraba (Nicolás
 * lo notó: el aviso solo se iba al pasar por Diccionario y volver), y el pop-up, que abre el pago
 * desde otro lado, no podía avisarle a "Mi cuenta" que esperara la vuelta del navegador.
 * - `avisoPendiente`: mostrar "vuelve aquí" hasta que el médico vuelva a la app.
 * - `escucharHasta`: hasta cuándo cada vuelta a la app pone al día el estado, en silencio.
 */
const cobroAbierto = { avisoPendiente: false, escucharHasta: 0 };
const COBRO_ABIERTO = "closelabs:cobro-abierto";

/** Abre el pago o el portal en el navegador. `null` si salió bien; si no, el código de error. */
export async function abrirCobro(accion: "checkout" | "portal"): Promise<string | null> {
  let r = await commands.accountOpenBilling(accion);
  // Pidió el portal sin haber pagado nunca: lo que necesita es suscribirse.
  if (r.status === "error" && r.error === "sin_pago") r = await commands.accountOpenBilling("checkout");
  if (r.status === "error") return r.error;
  cobroAbierto.avisoPendiente = true;
  cobroAbierto.escucharHasta = Date.now() + ESPERA_MAX_MS;
  // Para el panel de "Mi cuenta" si ya está abierto (el pop-up abre el pago desde encima de él).
  window.dispatchEvent(new Event(COBRO_ABIERTO));
  return null;
}

export function avisarErrorDeCobro(codigo: string) {
  const m = MENSAJES_ERROR[codigo] ?? ERROR_GENERICO;
  toast.error(m.titulo, { description: m.detalle });
}

interface Props {
  estado: EstadoCuenta;
  onEstado: (e: EstadoCuenta) => void;
}

export const Suscripcion: React.FC<Props> = ({ estado, onEstado }) => {
  const [ocupado, setOcupado] = useState<null | "checkout" | "portal" | "resume" | "sync">(null);
  /**
   * El aviso "vuelve aquí" (ver `cobroAbierto`): se quita en cuanto el médico vuelve a la app, y
   * esa vuelta pone al día el estado EN SILENCIO, sin ruedita ni botones grises. Lo encontró
   * Nicolás probando la 0.9.0: el aviso quedaba pegado y cada vuelta ponía los botones en gris.
   */
  const [esperando, setEsperandoLocal] = useState(cobroAbierto.avisoPendiente);
  const setEsperando = (v: boolean) => {
    cobroAbierto.avisoPendiente = v;
    setEsperandoLocal(v);
  };

  const ponerAlDia = useCallback(async (visible: boolean) => {
    if (visible) setOcupado("sync");
    const r = await commands.accountBillingRefresh("sync");
    if (visible) setOcupado(null);
    if (r.status === "ok") onEstado(r.data);
  }, [onEstado]);

  useEffect(() => {
    const alVolver = () => {
      if (Date.now() > cobroAbierto.escucharHasta) return;
      cobroAbierto.avisoPendiente = false;
      setEsperandoLocal(false);
      void ponerAlDia(false);
    };
    const alAbrirCobro = () => setEsperandoLocal(true);
    window.addEventListener("focus", alVolver);
    window.addEventListener(COBRO_ABIERTO, alAbrirCobro);
    return () => {
      window.removeEventListener("focus", alVolver);
      window.removeEventListener(COBRO_ABIERTO, alAbrirCobro);
    };
  }, [ponerAlDia]);

  const yaTermine = () => {
    setEsperando(false);
    void ponerAlDia(true);
  };

  const abrir = async (accion: "checkout" | "portal") => {
    setOcupado(accion);
    const error = await abrirCobro(accion);
    setOcupado(null);
    if (error) avisarErrorDeCobro(error);
  };

  const reanudar = async () => {
    setOcupado("resume");
    const r = await commands.accountBillingRefresh("resume");
    setOcupado(null);
    if (r.status === "ok") {
      onEstado(r.data);
      setEsperando(false);
      toast.success("Listo: tu suscripción sigue activa", {
        description: "No cambia nada: sigues dictando como siempre.",
      });
      return;
    }
    if (r.error === "vencida") {
      toast.error("Tu suscripción ya terminó", { description: "Puedes volver a suscribirte aquí mismo." });
      void ponerAlDia(true);
      return;
    }
    const m = MENSAJES_ERROR[r.error] ?? ERROR_GENERICO;
    toast.error(m.titulo, { description: m.detalle });
  };

  const girando = (accion: typeof ocupado) =>
    ocupado === accion ? <Loader2 className="w-4 h-4 animate-spin" /> : null;

  const s = situacion(estado);

  if (s === "fin_prueba" || s === "terminada" || s === "sin_pagar") {
    return (
      <FinDePrueba
        estado={estado}
        situacion={s}
        ocupado={ocupado}
        esperando={esperando}
        onPagar={() => void abrir(s === "sin_pagar" ? "portal" : "checkout")}
        onYaTermine={yaTermine}
      />
    );
  }

  const dias = diasHasta(estado.trial_ends_at);
  let titulo = "";
  let detalle = "";
  let tono = "border-brand-border bg-brand-surface";
  let acciones: React.ReactNode = null;

  const administrar = (
    <button onClick={() => void abrir("portal")} disabled={ocupado !== null} className={BOTON_SECUNDARIO}>
      {girando("portal") ?? <ExternalLink className="w-4 h-4" />}
      Administrar pago
    </button>
  );
  // Cancelar sin trucos: un botón visible que lleva al portal, donde se confirma.
  const cancelar = (
    <button
      onClick={() => void abrir("portal")}
      disabled={ocupado !== null}
      className="text-sm font-medium text-brand-text-secondary hover:text-red-600 hover:underline disabled:opacity-50"
    >
      Cancelar suscripción
    </button>
  );

  switch (s) {
    case "prueba": {
      const ultimos = dias !== null && dias <= 5;
      titulo = "Prueba gratuita";
      detalle = `Te ${dias === 1 ? "queda 1 día" : `quedan ${dias} días`}, hasta el ${fecha(estado.trial_ends_at)}. No necesitas tarjeta hasta entonces.`;
      acciones = (
        <div className="flex flex-col items-start gap-1.5">
          <button
            onClick={() => void abrir("checkout")}
            disabled={ocupado !== null}
            className={ultimos ? BOTON_PRINCIPAL : BOTON_SECUNDARIO}
          >
            {girando("checkout")}
            Suscribirme · {PRECIO}
          </button>
          <span className="text-xs text-brand-text-muted">
            Si te suscribes ahora, el primer cobro es el {fecha(estado.trial_ends_at)}: no pierdes
            ningún día de prueba.
          </span>
        </div>
      );
      break;
    }
    case "prueba_con_tarjeta":
      titulo = "Prueba gratuita · suscripción lista";
      detalle = `Tu tarjeta quedó guardada. El primer cobro de US$11 será el ${fecha(estado.trial_ends_at)}, cuando termine tu prueba.`;
      acciones = <>{administrar}{cancelar}</>;
      break;
    case "activa":
      titulo = "Suscripción activa";
      detalle = estado.current_period_end
        ? `Se renueva el ${fecha(estado.current_period_end)} por US$11.`
        : "Todo en orden.";
      acciones = <>{administrar}{cancelar}</>;
      break;
    case "cancelada_vigente": {
      const hasta = [estado.current_period_end, estado.trial_ends_at]
        .filter(futura)
        .sort()
        .pop() ?? null;
      titulo = "Cancelaste tu suscripción";
      detalle = `Puedes seguir dictando con normalidad hasta el ${fecha(hasta)}. No se te hará ningún cobro más.`;
      tono = "border-amber-300 bg-amber-50";
      acciones = (
        <>
          <button onClick={() => void reanudar()} disabled={ocupado !== null} className={BOTON_PRINCIPAL}>
            {girando("resume")}
            Reanudar suscripción
          </button>
          {administrar}
        </>
      );
      break;
    }
    case "cobro_fallido":
      // ⚠️ NO dice "bloqueado", porque no lo está: el servidor deja dictar mientras Stripe
      // reintenta. Decirle que perdió el acceso cuando no es cierto lo haría llamar asustado.
      titulo = "No pudimos cobrar tu tarjeta";
      detalle = "Sigues dictando con normalidad. Actualiza tu tarjeta para no perder el acceso más adelante.";
      tono = "border-amber-300 bg-amber-50";
      acciones = (
        <button onClick={() => void abrir("portal")} disabled={ocupado !== null} className={BOTON_PRINCIPAL}>
          {girando("portal") ?? <ExternalLink className="w-4 h-4" />}
          Actualizar tarjeta
        </button>
      );
      break;
  }

  return (
    <section className={`rounded-2xl border p-5 ${tono}`}>
      <div className="font-heading font-semibold text-[15px]">{titulo}</div>
      <p className="text-sm text-brand-text-secondary mt-1 leading-relaxed">{detalle}</p>
      {acciones && <div className="flex flex-wrap items-center gap-3 mt-4">{acciones}</div>}
      {esperando && <AvisoNavegador ocupado={ocupado === "sync"} onYaTermine={yaTermine} />}
    </section>
  );
};

const AvisoNavegador: React.FC<{ ocupado: boolean; onYaTermine: () => void }> = ({ ocupado, onYaTermine }) => (
  <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-white/70 border border-brand-border px-4 py-3 text-sm text-brand-text-secondary">
    <span>Se abrió una página segura de Stripe en tu navegador. Cuando termines, vuelve aquí.</span>
    <button onClick={onYaTermine} disabled={ocupado} className="font-semibold text-brand-accent hover:underline inline-flex items-center gap-1.5">
      {ocupado && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      Ya terminé
    </button>
  </div>
);

export type Fin = "fin_prueba" | "terminada" | "sin_pagar";

const TEXTOS_FIN: Record<Fin, { titulo: string; subtitulo: string; boton: string; conPrecio: boolean }> = {
  fin_prueba: {
    titulo: "Tu prueba gratuita terminó",
    subtitulo: "Suscríbete para seguir dictando.",
    boton: "Suscribirme",
    conPrecio: true,
  },
  terminada: {
    titulo: "Tu suscripción terminó",
    subtitulo: "Vuelve a suscribirte para seguir dictando.",
    boton: "Volver a suscribirme",
    conPrecio: true,
  },
  sin_pagar: {
    titulo: "No pudimos cobrar tu tarjeta",
    subtitulo:
      "Pausamos el dictado porque el cobro no pasó después de varios intentos. Actualiza tu tarjeta y sigues de inmediato.",
    boton: "Actualizar tarjeta",
    conPrecio: false,
  },
};

/**
 * El contenido de fin de prueba (o de suscripción vencida), el mismo en "Mi cuenta" y en el
 * pop-up que sale al intentar dictar (`FinDePruebaModal`).
 *
 * Decisión de Nicolás: amable, sin rojo ni "error", UN botón. La primera versión abría con "Gracias
 * por probar" y los números en grande; Nicolás la probó y no se entendía que había que suscribirse
 * ("toca leerlo mucho y la gente puede pensar que es un fallo"). Por eso el orden es el de las
 * pantallas de pago: QUÉ pasó (título), QUÉ hacer (subtítulo), CUÁNTO cuesta, el botón, y lo que
 * dictó al final, como dato. El botón dice lo que hace ("Suscribirme"): "Seguir dictando" prometía
 * dictar y abría una página de pago.
 */
export const ContenidoFin: React.FC<{
  estado: EstadoCuenta | null;
  situacion: Fin;
  ocupado: boolean;
  onPagar: () => void;
  idTitulo?: string;
  idDescripcion?: string;
  refBoton?: React.Ref<HTMLButtonElement>;
  /** El estado todavía no llega (el pop-up sale antes que los números): se reserva su espacio. */
  cargando?: boolean;
}> = ({ estado, situacion: s, ocupado, onPagar, idTitulo, idDescripcion, refBoton, cargando = false }) => {
  const t = TEXTOS_FIN[s];
  const Icono = s === "sin_pagar" ? CreditCard : Hourglass;
  const dictados = estado?.dictados ?? 0;
  const minutos = estado?.minutos_dictados ?? 0;

  return (
    <div className="flex flex-col items-center text-center">
      <span className="grid place-items-center w-14 h-14 rounded-full bg-brand-accent-soft text-brand-accent">
        <Icono className="w-6 h-6" aria-hidden="true" />
      </span>
      <h2 id={idTitulo} className="mt-5 font-heading font-bold text-2xl text-balance">
        {t.titulo}
      </h2>
      <p id={idDescripcion} className="mt-2 text-[15px] text-brand-text-secondary leading-relaxed max-w-sm">
        {t.subtitulo}
      </p>

      {t.conPrecio && (
        <div className="mt-6 flex items-baseline justify-center gap-2">
          <span className="font-heading font-bold text-4xl tabular-nums">US$11</span>
          <span className="text-[15px] text-brand-text-secondary">al mes · cancelas cuando quieras</span>
        </div>
      )}

      <button
        ref={refBoton}
        onClick={onPagar}
        disabled={ocupado}
        className={`${BOTON_PRINCIPAL} mt-6 w-full max-w-xs py-3 text-base`}
      >
        {ocupado && <Loader2 className="w-4 h-4 animate-spin" />}
        {t.boton}
      </button>
      <p className="mt-2.5 text-xs text-brand-text-muted">
        Se abre una página segura de Stripe en tu navegador.
      </p>

      {/* Mientras carga, el espacio queda reservado y el texto entra con un fundido: antes la línea
          aparecía medio segundo después y empujaba el pop-up (lo notó Nicolás). */}
      {(cargando || dictados > 0) && (
        <p
          aria-hidden={cargando}
          className={`mt-6 pt-5 border-t border-brand-border w-full min-h-[4.75rem] text-sm text-brand-text-secondary leading-relaxed transition-opacity duration-300 ${cargando ? "opacity-0" : "opacity-100"}`}
        >
          {s === "fin_prueba" ? "En tu prueba dictaste" : "Con CloseLabs Voice dictaste"}{" "}
          <strong className="font-semibold text-brand-text-secondary">
            {dictados.toLocaleString("es")} {dictados === 1 ? "vez" : "veces"}
          </strong>
          {minutos > 0 && <>: {duracion(minutos)} de voz que no tuviste que escribir</>}. Tu
          diccionario y tus equipos siguen aquí.
        </p>
      )}
    </div>
  );
};

/** El mismo contenido, como panel de "Mi cuenta". */
const FinDePrueba: React.FC<{
  estado: EstadoCuenta;
  situacion: Fin;
  ocupado: string | null;
  esperando: boolean;
  onPagar: () => void;
  onYaTermine: () => void;
}> = ({ estado, situacion, ocupado, esperando, onPagar, onYaTermine }) => (
  <section className="rounded-3xl border border-brand-border bg-brand-surface px-6 py-9 sm:px-10">
    <ContenidoFin
      estado={estado}
      situacion={situacion}
      ocupado={ocupado === "checkout" || ocupado === "portal"}
      onPagar={onPagar}
    />
    {esperando && <AvisoNavegador ocupado={ocupado === "sync"} onYaTermine={onYaTermine} />}
  </section>
);

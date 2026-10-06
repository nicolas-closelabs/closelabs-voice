/* eslint-disable i18next/no-literal-string */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
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

/** Después de abrir Stripe, cuánto tiempo seguimos poniéndonos al día cada vez que vuelve a la app. */
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
  "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[15px] font-semibold transition-colors disabled:opacity-50";
const BOTON_PRINCIPAL = `${BOTON} bg-brand-accent text-white hover:bg-brand-accent-secondary`;
const BOTON_SECUNDARIO = `${BOTON} border border-brand-border bg-white hover:border-brand-accent hover:text-brand-accent`;

interface Props {
  estado: EstadoCuenta;
  onEstado: (e: EstadoCuenta) => void;
}

export const Suscripcion: React.FC<Props> = ({ estado, onEstado }) => {
  const [ocupado, setOcupado] = useState<null | "checkout" | "portal" | "resume" | "sync">(null);
  /** Abrimos una página de Stripe y esperamos que vuelva: al recuperar el foco, se pone al día. */
  const [esperando, setEsperando] = useState(false);
  const desde = useRef(0);

  const ponerAlDia = useCallback(async () => {
    setOcupado("sync");
    const r = await commands.accountBillingRefresh("sync");
    setOcupado(null);
    if (r.status === "ok") onEstado(r.data);
  }, [onEstado]);

  useEffect(() => {
    if (!esperando) return;
    const alVolver = () => {
      if (Date.now() - desde.current > ESPERA_MAX_MS) {
        setEsperando(false);
        return;
      }
      void ponerAlDia();
    };
    window.addEventListener("focus", alVolver);
    return () => window.removeEventListener("focus", alVolver);
  }, [esperando, ponerAlDia]);

  const abrir = async (accion: "checkout" | "portal") => {
    setOcupado(accion);
    const r = await commands.accountOpenBilling(accion);
    setOcupado(null);
    if (r.status === "ok") {
      desde.current = Date.now();
      setEsperando(true);
      return;
    }
    if (r.error === "sin_pago") {
      // Pidió el portal sin haber pagado nunca: lo que necesita es suscribirse.
      void abrir("checkout");
      return;
    }
    const m = MENSAJES_ERROR[r.error] ?? ERROR_GENERICO;
    toast.error(m.titulo, { description: m.detalle });
  };

  const reanudar = async () => {
    setOcupado("resume");
    const r = await commands.accountBillingRefresh("resume");
    setOcupado(null);
    if (r.status === "ok") {
      onEstado(r.data);
      toast.success("Listo: tu suscripción sigue activa", {
        description: "No cambia nada: sigues dictando como siempre.",
      });
      return;
    }
    if (r.error === "vencida") {
      toast.error("Tu suscripción ya terminó", { description: "Puedes volver a suscribirte aquí mismo." });
      void ponerAlDia();
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
        onYaTermine={() => void ponerAlDia()}
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
      {esperando && <AvisoNavegador ocupado={ocupado === "sync"} onYaTermine={() => void ponerAlDia()} />}
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

/**
 * Fin de la prueba (o de la suscripción). Decisión de Nicolás: una pantalla amable, con lo que el
 * médico dictó y UN botón para seguir. Nada de rojo, nada de "error".
 */
const FinDePrueba: React.FC<{
  estado: EstadoCuenta;
  situacion: "fin_prueba" | "terminada" | "sin_pagar";
  ocupado: string | null;
  esperando: boolean;
  onPagar: () => void;
  onYaTermine: () => void;
}> = ({ estado, situacion: s, ocupado, esperando, onPagar, onYaTermine }) => {
  const dictados = estado.dictados ?? 0;
  const minutos = estado.minutos_dictados ?? 0;

  const titulo = {
    fin_prueba: "Gracias por probar CloseLabs Voice",
    terminada: "Tu suscripción terminó",
    sin_pagar: "No pudimos cobrar tu tarjeta",
  }[s];

  const texto = {
    fin_prueba: `Tu prueba gratuita terminó. Para seguir dictando, activa tu suscripción: ${PRECIO}, y cancelas cuando quieras.`,
    terminada: `Para volver a dictar, suscríbete de nuevo: ${PRECIO}, y cancelas cuando quieras.`,
    sin_pagar: "Pausamos el dictado porque el cobro no pasó después de varios intentos. Actualiza tu tarjeta y sigues de inmediato.",
  }[s];

  const boton = {
    fin_prueba: "Seguir dictando",
    terminada: "Volver a suscribirme",
    sin_pagar: "Actualizar tarjeta",
  }[s];

  return (
    <section className="rounded-3xl border border-brand-border bg-brand-surface px-6 py-8 sm:px-8">
      <h2 className="font-heading font-bold text-xl text-balance">{titulo}</h2>

      {dictados > 0 && (
        <div className="mt-5 flex flex-wrap gap-x-10 gap-y-4">
          <div>
            <div className="font-heading font-bold text-3xl text-brand-accent tabular-nums">
              {dictados.toLocaleString("es")}
            </div>
            <div className="text-sm text-brand-text-secondary">
              {dictados === 1 ? "dictado" : "dictados"}
              {s === "fin_prueba" ? " en tu prueba" : ""}
            </div>
          </div>
          {minutos > 0 && (
            <div>
              <div className="font-heading font-bold text-3xl text-brand-accent">{duracion(minutos)}</div>
              <div className="text-sm text-brand-text-secondary">de voz que no tuviste que escribir</div>
            </div>
          )}
        </div>
      )}

      <p className="mt-5 text-[15px] text-brand-text-secondary leading-relaxed max-w-prose">{texto}</p>

      <button onClick={onPagar} disabled={ocupado !== null} className={`${BOTON_PRINCIPAL} mt-6 px-6`}>
        {ocupado === "checkout" || ocupado === "portal" ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        {boton}
      </button>
      <p className="mt-3 text-xs text-brand-text-muted">
        Se abre una página segura de Stripe para poner tu tarjeta. Tu diccionario y tus equipos
        siguen aquí.
      </p>

      {esperando && <AvisoNavegador ocupado={ocupado === "sync"} onYaTermine={onYaTermine} />}
    </section>
  );
};

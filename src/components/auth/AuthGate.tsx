/* eslint-disable i18next/no-literal-string */
import React, { useEffect, useRef, useState } from "react";
import {
  Loader2,
  ArrowLeft,
  MailCheck,
  MessageCircle,
  Eye,
  EyeOff,
} from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { commands } from "@/bindings";
import { supportWhatsappUrl } from "../../branding";
import Logo from "../icons/Logo";

interface AuthGateProps {
  /** Se llama cuando el médico entra. El contenedor recarga el estado de la cuenta. */
  onSignedIn: () => void;
}

type Modo =
  | "entrar"
  | "crear"
  | "recuperar"
  | "revisa-correo"
  | "correo-enviado";

/** Indicativos de los países donde están los médicos. El primero es el caso mayoritario. */
const PAISES = [
  { code: "+57", pais: "Colombia" },
  { code: "+52", pais: "México" },
  { code: "+51", pais: "Perú" },
  { code: "+56", pais: "Chile" },
  { code: "+593", pais: "Ecuador" },
  { code: "+54", pais: "Argentina" },
  { code: "+507", pais: "Panamá" },
  { code: "+1", pais: "EE. UU." },
];

/**
 * Traduce el vocabulario cerrado del backend a algo que un médico entienda.
 *
 * El backend nunca manda el texto original del proveedor de identidad: viene en inglés, a veces
 * es críptico y puede filtrar detalles de la cuenta. Manda un código, y aquí se explica.
 */
const MENSAJES: Record<string, string> = {
  credenciales: "El correo o la contraseña no coinciden.",
  sin_confirmar:
    "Todavía no confirmaste tu correo. Busca el mensaje que te enviamos (revisa también el correo no deseado).",
  ya_existe: "Ya existe una cuenta con ese correo. Prueba a iniciar sesión.",
  demasiados_intentos:
    "Demasiados intentos seguidos. Espera unos minutos y vuelve a probar.",
  clave_debil:
    "Esa contraseña es muy fácil de adivinar. Usa al menos 8 caracteres.",
  sin_conexion: "No hay conexión con el servidor. Revisa tu internet.",
  servidor: "Tuvimos un problema de nuestro lado. Inténtalo en un momento.",
  codigo_invalido:
    "Ese código no es el correcto o ya venció. Revisa el último correo que te enviamos.",
  desconocido: "No pudimos completar la operación. Inténtalo de nuevo.",
};

const explicar = (codigo: string) => MENSAJES[codigo] ?? MENSAJES.desconocido;

const base =
  "px-3.5 py-3 rounded-xl border border-brand-border bg-white text-[16px] focus:outline-none focus:border-brand-accent transition-colors disabled:opacity-50";
const campo = `w-full ${base}`;

/**
 * ¿Ya entró alguien a una cuenta en este computador? Decide si la pantalla abre en "Crear tu
 * cuenta" o en "Inicia sesión". Antes abría SIEMPRE en "Inicia sesión", y el médico que acababa de
 * descargar la app (el caso normal) se encontraba pidiéndole una contraseña que nunca creó.
 */
const MARCA_YA_ENTRO = "closelabs.yaEntroAqui";
function yaEntroAqui(): boolean {
  try {
    return localStorage.getItem(MARCA_YA_ENTRO) === "si";
  } catch {
    return false;
  }
}
function marcarQueEntro() {
  try {
    localStorage.setItem(MARCA_YA_ENTRO, "si");
  } catch {
    /* sin almacenamiento: la próxima vez abrirá en "Crear tu cuenta", que tiene el enlace a entrar */
  }
}

/** Lo que le falta al formulario, dicho en concreto. `null` si está completo. */
function queFalta(f: {
  creando: boolean;
  nombre: string;
  correo: string;
  telefono: string;
  clave: string;
  acepta: boolean;
}): string | null {
  if (f.creando && !f.nombre.trim()) return "Escribe tu nombre y apellido.";
  if (!/^\S+@\S+\.\S+$/.test(f.correo.trim()))
    return "Revisa tu correo: debe verse así, nombre@correo.com.";
  if (f.creando && f.telefono.length < 7)
    return "Escribe tu número de celular completo.";
  if (!f.clave) return "Escribe tu contraseña.";
  if (f.creando && f.clave.length < 8)
    return `La contraseña necesita al menos 8 caracteres (llevas ${f.clave.length}).`;
  if (f.creando && !f.acepta)
    return "Marca la casilla de abajo para aceptar los Términos y la Política de Datos.";
  return null;
}

/** Lo más largo que puede medir un celular en los países donde estamos, con holgura. */
const MAX_TELEFONO = 12;

export const AuthGate: React.FC<AuthGateProps> = ({ onSignedIn }) => {
  const [modo, setModo] = useState<Modo>(() =>
    yaEntroAqui() ? "entrar" : "crear",
  );
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [nombre, setNombre] = useState("");
  const [indicativo, setIndicativo] = useState("+57");
  const [telefono, setTelefono] = useState("");
  const [acepta, setAcepta] = useState(false);

  const entro = () => {
    marcarQueEntro();
    onSignedIn();
  };

  const entrar = async () => {
    setOcupado(true);
    setError(null);
    const r = await commands.authSignIn(correo, clave);
    setOcupado(false);
    if (r.status === "ok") entro();
    // Se registró antes y no confirmó: en vez de solo un aviso, la pantalla donde se escribe el
    // código (y desde donde se pide uno nuevo si el primero ya venció).
    else if (r.error === "sin_confirmar") setModo("revisa-correo");
    else setError(explicar(r.error));
  };

  const crear = async () => {
    setOcupado(true);
    setError(null);
    const r = await commands.authSignUp(
      correo,
      clave,
      nombre,
      indicativo,
      telefono,
    );
    setOcupado(false);
    if (r.status === "ok") setModo("revisa-correo");
    else setError(explicar(r.error));
  };

  const recuperar = async () => {
    setOcupado(true);
    setError(null);
    const r = await commands.authSendRecovery(correo);
    setOcupado(false);
    // Se muestra lo mismo exista o no la cuenta: decir "ese correo no existe" le confirmaría a
    // un desconocido quién es cliente nuestro.
    if (r.status === "ok") setModo("correo-enviado");
    else setError(explicar(r.error));
  };

  // -------------------------------------------------------------------------------------------
  // Pantallas de "ya hicimos lo nuestro, revisa tu correo"
  // -------------------------------------------------------------------------------------------
  if (modo === "revisa-correo") {
    return (
      <EsperandoConfirmacion
        correo={correo}
        clave={clave}
        onSignedIn={entro}
        onCorregir={() => {
          // Vuelve al formulario con todo lo que escribió, para corregir solo el correo.
          setModo("crear");
          setError(null);
        }}
      />
    );
  }

  if (modo === "correo-enviado") {
    return (
      <Marco>
        <div className="w-12 h-12 rounded-2xl bg-brand-accent-soft grid place-items-center mb-1">
          <MailCheck className="w-6 h-6 text-brand-accent" />
        </div>
        <h1 className="font-heading text-xl font-bold">
          Te enviamos un enlace
        </h1>
        <p className="text-[15px] text-brand-text-secondary leading-relaxed">
          Si existe una cuenta con <strong>{correo}</strong>, ahí llegará el
          enlace para cambiar la contraseña.
        </p>
        <p className="text-[15px] text-brand-text-muted">
          ¿No lo ves? Revisa el correo no deseado.
        </p>
        <button
          onClick={() => {
            setModo("entrar");
            setError(null);
          }}
          className="text-[15px] font-semibold text-brand-accent hover:underline"
        >
          Volver a iniciar sesión
        </button>
      </Marco>
    );
  }

  // -------------------------------------------------------------------------------------------
  // Recuperar contraseña
  // -------------------------------------------------------------------------------------------
  if (modo === "recuperar") {
    return (
      <Marco>
        <button
          onClick={() => {
            setModo("entrar");
            setError(null);
          }}
          className="self-start inline-flex items-center gap-1.5 text-[15px] text-brand-text-secondary hover:text-brand-accent"
        >
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
        <h1 className="font-heading text-xl font-bold">Recuperar contraseña</h1>
        <p className="text-[15px] text-brand-text-secondary leading-relaxed">
          Escribe tu correo y te enviamos un enlace para elegir una nueva.
        </p>
        <form
          className="w-full flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void recuperar();
          }}
        >
          <input
            id="recuperar-correo"
            type="email"
            autoComplete="email"
            required
            placeholder="tu@correo.com"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            disabled={ocupado}
            className={campo}
          />
          {error && <Aviso>{error}</Aviso>}
          <Principal ocupado={ocupado} disabled={!correo.trim()}>
            Enviarme el enlace
          </Principal>
        </form>
      </Marco>
    );
  }

  // -------------------------------------------------------------------------------------------
  // Entrar y crear cuenta
  // -------------------------------------------------------------------------------------------
  const creando = modo === "crear";

  return (
    <Marco>
      <Logo width={170} className="mb-1" />
      <h1 className="font-heading text-xl font-bold">
        {creando ? "Crea tu cuenta" : "Inicia sesión"}
      </h1>
      <p className="text-[15px] text-brand-text-secondary leading-relaxed">
        {/* Sin "30 días de prueba": esta pantalla la ve también el médico de gMedic, que no tiene
            prueba (le cobra gMedic). Lo de la prueba lo dice "Mi cuenta", que sí sabe el canal. */}
        {creando
          ? "Crea tu cuenta para empezar a dictar. No pedimos tarjeta."
          : "Entra para dictar en este computador."}
      </p>

      <form
        className="w-full flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          // El botón nunca queda gris sin explicación: antes, si faltaba un dígito del celular o la
          // casilla, el botón no respondía y el médico no sabía por qué. Ahora dice qué falta.
          const falta = queFalta({
            creando,
            nombre,
            correo,
            telefono,
            clave,
            acepta,
          });
          if (falta) {
            setError(falta);
            return;
          }
          void (creando ? crear() : entrar());
        }}
      >
        {creando && (
          <Etiqueta htmlFor="registro-nombre" texto="Tu nombre">
            <input
              id="registro-nombre"
              type="text"
              autoComplete="name"
              required
              placeholder="Nombre y apellido"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              disabled={ocupado}
              className={campo}
            />
          </Etiqueta>
        )}

        <Etiqueta htmlFor="auth-correo" texto="Tu correo">
          <input
            id="auth-correo"
            type="email"
            autoComplete="email"
            required
            placeholder="tu@correo.com"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            disabled={ocupado}
            className={campo}
          />
        </Etiqueta>

        {creando && (
          <Etiqueta htmlFor="registro-telefono" texto="Tu celular">
            <div className="flex gap-2">
              <select
                id="registro-indicativo"
                value={indicativo}
                onChange={(e) => setIndicativo(e.target.value)}
                disabled={ocupado}
                className={`${base} w-24 shrink-0`}
                aria-label="Indicativo del país"
              >
                {PAISES.map((p) => (
                  // Solo el indicativo: el nombre del país hacía el selector tan ancho que el
                  // número se quedaba sin sitio y no se veía lo que se estaba escribiendo.
                  <option key={p.code} value={p.code} title={p.pais}>
                    {p.code}
                  </option>
                ))}
              </select>
              <input
                id="registro-telefono"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                required
                maxLength={MAX_TELEFONO}
                placeholder="Número de celular"
                value={telefono}
                // Solo dígitos y con tope. Sin esto se coló un número repetido de 19 cifras: el
                // campo estaba tan estrecho que no se veía el error al escribirlo.
                onChange={(e) =>
                  setTelefono(
                    e.target.value.replace(/\D/g, "").slice(0, MAX_TELEFONO),
                  )
                }
                disabled={ocupado}
                className={`${base} flex-1 min-w-0`}
              />
            </div>
          </Etiqueta>
        )}

        <Etiqueta
          htmlFor="auth-clave"
          texto={
            creando
              ? "Crea una contraseña (mínimo 8 caracteres)"
              : "Tu contraseña"
          }
        >
          <CampoClave
            creando={creando}
            value={clave}
            onChange={setClave}
            disabled={ocupado}
          />
        </Etiqueta>

        {creando && (
          <label className="flex items-start gap-2.5 text-[15px] text-brand-text-secondary leading-snug cursor-pointer">
            <input
              id="registro-consentimiento"
              type="checkbox"
              checked={acepta}
              onChange={(e) => setAcepta(e.target.checked)}
              disabled={ocupado}
              className="mt-0.5 w-5 h-5 shrink-0 accent-brand-accent cursor-pointer"
            />
            <span>
              Acepto los{" "}
              <a
                href="https://closelabs.co/terminos"
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-brand-accent hover:underline"
              >
                Términos
              </a>{" "}
              y la{" "}
              <a
                href="https://closelabs.co/privacidad"
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-brand-accent hover:underline"
              >
                Política de Tratamiento de Datos
              </a>{" "}
              de CloseLabs.
            </span>
          </label>
        )}

        {error && <Aviso>{error}</Aviso>}

        <Principal ocupado={ocupado} disabled={false}>
          {creando ? "Crear mi cuenta" : "Entrar"}
        </Principal>
      </form>

      {!creando && (
        <button
          onClick={() => {
            setModo("recuperar");
            setError(null);
          }}
          className="text-[15px] text-brand-text-secondary hover:text-brand-accent"
        >
          Olvidé mi contraseña
        </button>
      )}

      {/* Cambiar entre crear y entrar es un botón de verdad, no un enlace pequeño: quien ya tiene
          cuenta (creada en otro computador) tiene que encontrarlo sin buscar. */}
      <div className="w-full flex flex-col items-center gap-2 pt-2 border-t border-brand-border/40">
        <span className="text-[15px] text-brand-text-secondary">
          {creando ? "¿Ya tienes una cuenta?" : "¿Es tu primera vez?"}
        </span>
        <button
          onClick={() => {
            setModo(creando ? "entrar" : "crear");
            setError(null);
          }}
          className="w-full px-4 py-3 rounded-xl text-[16px] font-semibold border-2 border-brand-accent text-brand-accent hover:bg-brand-accent-soft transition-colors"
        >
          {creando ? "Iniciar sesión" : "Crear mi cuenta"}
        </button>
      </div>
    </Marco>
  );
};

/**
 * Cada cuánto se reintenta entrar mientras el médico confirma su correo: rápido al principio (casi
 * todos confirman en los primeros minutos, y si confirma en el CELULAR la app no se entera por el
 * foco: solo por este reintento), más despacio después.
 */
const REINTENTO_RAPIDO_MS = 10_000;
const FASE_RAPIDA_MS = 3 * 60_000;
const REINTENTO_MS = 30_000;
/** Pasado este tiempo se deja de reintentar solo; queda el botón "Ya confirmé". */
const ESPERA_MAX_MS = 60 * 60_000;
/**
 * Números del código del correo. ⚠️ Tiene que coincidir con `otp_length` en supabase/config.toml
 * (y en el proyecto: se sube con `config push`). Si no coinciden, nadie puede confirmar con código.
 */
const LARGO_CODIGO = 6;
/** Si Supabase frena por exceso de intentos, se descansa esto antes de seguir. */
const PAUSA_POR_LIMITE_MS = 5 * 60_000;
/** Mínimo entre intentos automáticos: cambiar de ventana muchas veces no debe disparar una ráfaga. */
const SEPARACION_MIN_MS = 5_000;

/**
 * "Revisa tu correo" que entra SOLA cuando el médico confirma.
 *
 * Antes, después de tocar "Confirmar mi correo", el médico aterrizaba en la portada de
 * closelabs.co sin ningún mensaje, y tenía que volver a la app, encontrar "Volver a iniciar
 * sesión" y escribir otra vez correo y contraseña. Para un médico de 55 años poco familiarizado
 * con la tecnología, ahí se pierde gente.
 *
 * Ahora la app reintenta entrar con lo que acaba de escribir: cada 30 s, y en cuanto la ventana
 * vuelve a tener el foco (que es justo cuando regresa del navegador). Mientras el correo no esté
 * confirmado, Supabase responde `sin_confirmar` y no pasa nada visible.
 *
 * ⚠️ El ritmo está medido contra el límite de Supabase: 30 intentos de entrar cada 5 minutos por
 * IP. Cada 10 s los primeros 3 minutos y cada 30 s después son ~22 en los primeros 5 minutos, y en
 * un consultorio varios médicos comparten IP. Si aun así frena, se hace una pausa en vez de
 * insistir.
 *
 * Lo que vio Nicolás (2026-10-06): "siempre toca poner «Ya confirmé»". Entrar tarda unos segundos
 * (sesión + vincular el equipo + leer la cuenta) y la pantalla seguía diciendo "Esperando…" como si
 * nada; si tocaba el botón en ese momento, el botón no hacía nada visible porque ya había un
 * intento en curso, y parecía que el botón era lo que lo dejaba entrar. Ahora, al volver a la
 * ventana o al tocar el botón, la pantalla dice "Comprobando…" mientras dura el intento.
 *
 * La contraseña vive solo en la memoria de esta pantalla, la misma que ya tenía el formulario.
 */
const EsperandoConfirmacion: React.FC<{
  correo: string;
  clave: string;
  onSignedIn: () => void;
  onCorregir: () => void;
}> = ({ correo, clave, onSignedIn, onCorregir }) => {
  const [aviso, setAviso] = useState<string | null>(null);
  const [probando, setProbando] = useState(false);
  /** Hay un intento a la vista del médico (volvió a la ventana o tocó el botón). */
  const [comprobando, setComprobando] = useState(false);
  /** Reenvío del correo: `null` sin tocar; si no, lo que hay que decirle. */
  const [reenvio, setReenvio] = useState<"enviando" | "enviado" | null>(null);
  const enCurso = useRef(false);
  const pausaHasta = useRef(0);
  const terminado = useRef(false);
  const ultimo = useRef(0);

  /** `manual`: tocó el botón. `foco`: volvió a la ventana. `reloj`: el reintento periódico. */
  const intentar = async (origen: "manual" | "foco" | "reloj") => {
    const manual = origen === "manual";
    if (terminado.current) return;
    if (enCurso.current) {
      // Ya hay un intento andando: que se VEA, en vez de un botón que no hace nada.
      if (origen !== "reloj") setComprobando(true);
      return;
    }
    if (!manual && Date.now() < pausaHasta.current) return;
    if (!manual && Date.now() - ultimo.current < SEPARACION_MIN_MS) return;
    ultimo.current = Date.now();
    enCurso.current = true;
    if (origen !== "reloj") setComprobando(true);
    if (manual) {
      setProbando(true);
      setAviso(null);
    }
    const r = await commands.authSignIn(correo, clave);
    enCurso.current = false;
    setProbando(false);
    setComprobando(false);

    if (r.status === "ok") {
      entrarUnaVez();
      return;
    }
    if (r.error === "demasiados_intentos") {
      pausaHasta.current = Date.now() + PAUSA_POR_LIMITE_MS;
    }
    // En automático no se molesta al médico: seguir esperando es lo normal.
    if (manual) {
      setAviso(
        r.error === "sin_confirmar"
          ? "Todavía no vemos la confirmación. Abre el correo que te enviamos y toca el botón «Confirmar mi correo»."
          : explicar(r.error),
      );
    }
  };

  // La referencia a `intentar` cambia en cada render; el efecto usa siempre la última.
  const intentarRef = useRef(intentar);
  intentarRef.current = intentar;

  useEffect(() => {
    const inicio = Date.now();
    let tick: ReturnType<typeof setTimeout>;
    const programar = () => {
      const transcurrido = Date.now() - inicio;
      if (transcurrido > ESPERA_MAX_MS) return;
      tick = setTimeout(
        () => {
          void intentarRef.current("reloj");
          programar();
        },
        transcurrido < FASE_RAPIDA_MS ? REINTENTO_RAPIDO_MS : REINTENTO_MS,
      );
    };
    programar();

    const alVolver = () => {
      if (document.visibilityState === "visible")
        void intentarRef.current("foco");
    };
    window.addEventListener("focus", alVolver);
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      clearTimeout(tick);
      window.removeEventListener("focus", alVolver);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, []);

  const reenviar = async () => {
    setReenvio("enviando");
    setAviso(null);
    const r = await commands.authResendConfirmation(correo);
    if (r.status === "ok") {
      setReenvio("enviado");
    } else {
      setReenvio(null);
      setAviso(explicar(r.error));
    }
  };

  /** El código y el reintento de fondo pueden acertar casi a la vez: se entra una sola vez. */
  function entrarUnaVez() {
    if (terminado.current) return;
    terminado.current = true;
    onSignedIn();
  }

  const [codigo, setCodigo] = useState("");
  const [verificando, setVerificando] = useState(false);

  /**
   * El camino principal: el médico escribe el código del correo sin salir de la app. Si es
   * correcto, se entra con la contraseña que acaba de escribir (eso también vincula el equipo).
   */
  const verificar = async (valor: string) => {
    if (valor.length < LARGO_CODIGO) {
      setAviso(
        `El código tiene ${LARGO_CODIGO} números. Revisa el correo que te enviamos.`,
      );
      return;
    }
    setVerificando(true);
    setAviso(null);
    const v = await commands.authVerifyCode(correo, valor);
    if (v.status === "error") {
      setVerificando(false);
      setCodigo("");
      setAviso(explicar(v.error));
      return;
    }
    const r = await commands.authSignIn(correo, clave);
    setVerificando(false);
    if (r.status === "ok") entrarUnaVez();
    else setAviso(explicar(r.error));
  };

  // ⚠️ UNA sola cosa en movimiento a la vez. Antes había un "Esperando tu confirmación…" girando
  // siempre, y al volver a la ventana se sumaba el botón con su propio "Comprobando…": dos ruedas
  // girando y textos cambiando, y el médico no sabía si tenía que hacer algo o esperar. Ahora el
  // reintento de fondo no se ve; solo cuando de verdad se está comprobando, aparece una línea que
  // lo dice.
  //
  // El enlace del correo sigue sirviendo: si el médico toca el botón en vez de copiar el código, el
  // reintento de fondo lo hace entrar al volver a esta ventana.
  const ocupadoAhora = verificando || probando || comprobando;
  return (
    <Marco>
      <div className="w-14 h-14 rounded-2xl bg-brand-accent-soft grid place-items-center mb-1">
        <MailCheck className="w-7 h-7 text-brand-accent" />
      </div>
      <h1 className="font-heading text-2xl font-bold">Revisa tu correo</h1>
      <p className="text-[16px] text-brand-text-secondary leading-relaxed">
        Te enviamos un código de {LARGO_CODIGO} números a{" "}
        <strong className="text-brand-text">{correo}</strong>. Escríbelo aquí:
      </p>

      <form
        className="w-full flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void verificar(codigo);
        }}
      >
        <input
          id="codigo-confirmacion"
          aria-label="Código del correo"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          value={codigo}
          onChange={(e) => {
            // Solo números: si lo pega desde el correo con espacios o guiones, se limpian.
            const limpio = e.target.value
              .replace(/\D/g, "")
              .slice(0, LARGO_CODIGO);
            setCodigo(limpio);
            setAviso(null);
            // Al completar el último número se comprueba solo: un botón menos que encontrar.
            if (limpio.length === LARGO_CODIGO) void verificar(limpio);
          }}
          disabled={verificando}
          placeholder={"•".repeat(LARGO_CODIGO)}
          className="w-full px-4 py-4 rounded-xl border-2 border-brand-border bg-white text-center font-heading text-[32px] font-bold tracking-[0.4em] focus:outline-none focus:border-brand-accent disabled:opacity-50 select-text"
        />

        {aviso && <Aviso>{aviso}</Aviso>}

        {ocupadoAhora ? (
          <div className="w-full py-3 inline-flex items-center justify-center gap-2 text-[16px] font-semibold text-brand-accent">
            <Loader2 className="w-5 h-5 animate-spin" />
            Comprobando…
          </div>
        ) : (
          <Principal ocupado={false} disabled={false}>
            Confirmar
          </Principal>
        )}
      </form>

      <div className="w-full flex flex-col items-center gap-2 pt-2 border-t border-brand-border/40 text-[15px] text-brand-text-secondary">
        <span>¿No te llegó? Búscalo también en «Correo no deseado».</span>
        {reenvio === "enviado" ? (
          <span className="font-semibold text-green-700">
            Listo, te lo enviamos otra vez.
          </span>
        ) : (
          <button
            type="button"
            onClick={() => void reenviar()}
            disabled={reenvio === "enviando"}
            className="font-semibold text-brand-accent hover:underline disabled:opacity-50"
          >
            {reenvio === "enviando"
              ? "Enviando…"
              : "Enviarme el correo otra vez"}
          </button>
        )}
        <button
          type="button"
          onClick={() => void intentar("manual")}
          disabled={ocupadoAhora}
          className="text-brand-text-secondary hover:text-brand-accent hover:underline"
        >
          Ya toqué el botón del correo
        </button>
        <button
          type="button"
          onClick={onCorregir}
          className="text-brand-text-secondary hover:text-brand-accent hover:underline"
        >
          ¿Escribiste mal tu correo? Corrígelo aquí
        </button>
      </div>
    </Marco>
  );
};

/**
 * ⚠️ El enlace de WhatsApp va en TODAS las pantallas de cuenta, y no es un adorno: la cuenta es
 * obligatoria y no hay forma de dictar sin ella. Un médico que no logra registrarse o entrar no
 * tiene ninguna otra salida — si no ve a quién escribir, cierra la app y no vuelve.
 */
const Marco: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="h-screen overflow-y-auto flex items-center justify-center px-8 py-10 select-none">
    <div className="w-full max-w-sm flex flex-col items-center text-center gap-4">
      {children}
      <button
        type="button"
        onClick={() =>
          void openUrl(
            supportWhatsappUrl(
              "Hola, tengo problemas para entrar a CloseLabs Voice.",
            ),
          )
        }
        className="mt-4 inline-flex items-center gap-1.5 text-[15px] text-brand-text-muted hover:text-[#128C7E] transition-colors"
      >
        <MessageCircle className="w-4 h-4" />
        ¿Problemas para entrar? Escríbenos por WhatsApp
      </button>
    </div>
  </div>
);

/**
 * Etiqueta visible ENCIMA del campo. Solo con el texto gris de adentro, al empezar a escribir ya
 * no se sabe qué era cada casilla — y en un formulario de cinco, el médico se pierde.
 */
const Etiqueta: React.FC<{
  htmlFor: string;
  texto: string;
  children: React.ReactNode;
}> = ({ htmlFor, texto, children }) => (
  <div className="w-full flex flex-col gap-1.5 text-left">
    <label
      htmlFor={htmlFor}
      className="text-[15px] font-semibold text-brand-text"
    >
      {texto}
    </label>
    {children}
  </div>
);

/** Contraseña con "Mostrar": escribir a ciegas es donde más se equivoca quien teclea despacio. */
const CampoClave: React.FC<{
  creando: boolean;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}> = ({ creando, value, onChange, disabled }) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative w-full">
      <input
        id="auth-clave"
        type={visible ? "text" : "password"}
        autoComplete={creando ? "new-password" : "current-password"}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`${campo} pr-28`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[14px] font-semibold text-brand-text-secondary hover:text-brand-accent"
      >
        {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        {visible ? "Ocultar" : "Mostrar"}
      </button>
    </div>
  );
};

const Aviso: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p
    role="alert"
    className="text-[15px] text-left text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2 leading-snug"
  >
    {children}
  </p>
);

const Principal: React.FC<{
  ocupado: boolean;
  disabled: boolean;
  children: React.ReactNode;
}> = ({ ocupado, disabled, children }) => (
  <button
    type="submit"
    disabled={ocupado || disabled}
    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[15px] font-semibold bg-brand-accent text-white hover:bg-brand-accent-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
  >
    {ocupado && <Loader2 className="w-4 h-4 animate-spin" />}
    {children}
  </button>
);

export default AuthGate;

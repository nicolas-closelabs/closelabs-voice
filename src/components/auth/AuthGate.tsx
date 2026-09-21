/* eslint-disable i18next/no-literal-string */
import React, { useEffect, useRef, useState } from "react";
import { Loader2, ArrowLeft, MailCheck, MessageCircle } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { commands } from "@/bindings";
import { supportWhatsappUrl } from "../../branding";
import Logo from "../icons/Logo";

interface AuthGateProps {
  /** Se llama cuando el médico entra. El contenedor recarga el estado de la cuenta. */
  onSignedIn: () => void;
}

type Modo = "entrar" | "crear" | "recuperar" | "revisa-correo" | "correo-enviado";

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
  clave_debil: "Esa contraseña es muy fácil de adivinar. Usa al menos 8 caracteres.",
  sin_conexion: "No hay conexión con el servidor. Revisa tu internet.",
  servidor: "Tuvimos un problema de nuestro lado. Inténtalo en un momento.",
  desconocido: "No pudimos completar la operación. Inténtalo de nuevo.",
};

const explicar = (codigo: string) => MENSAJES[codigo] ?? MENSAJES.desconocido;

const base =
  "px-3.5 py-2.5 rounded-xl border border-brand-border bg-white text-[15px] focus:outline-none focus:border-brand-accent transition-colors disabled:opacity-50";
const campo = `w-full ${base}`;

/** Lo más largo que puede medir un celular en los países donde estamos, con holgura. */
const MAX_TELEFONO = 12;

export const AuthGate: React.FC<AuthGateProps> = ({ onSignedIn }) => {
  const [modo, setModo] = useState<Modo>("entrar");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [nombre, setNombre] = useState("");
  const [indicativo, setIndicativo] = useState("+57");
  const [telefono, setTelefono] = useState("");
  const [acepta, setAcepta] = useState(false);

  const entrar = async () => {
    setOcupado(true);
    setError(null);
    const r = await commands.authSignIn(correo, clave);
    setOcupado(false);
    if (r.status === "ok") onSignedIn();
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
        onSignedIn={onSignedIn}
        onVolver={() => {
          setModo("entrar");
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
        <h1 className="font-heading text-xl font-bold">Te enviamos un enlace</h1>
        <p className="text-[15px] text-brand-text-secondary leading-relaxed">
          Si existe una cuenta con <strong>{correo}</strong>, ahí llegará el
          enlace para cambiar la contraseña.
        </p>
        <p className="text-sm text-brand-text-muted">
          ¿No lo ves? Revisa el correo no deseado.
        </p>
        <button
          onClick={() => {
            setModo("entrar");
            setError(null);
          }}
          className="text-sm font-semibold text-brand-accent hover:underline"
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
          className="self-start inline-flex items-center gap-1.5 text-sm text-brand-text-secondary hover:text-brand-accent"
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
  const puedeEnviar = creando
    ? correo.trim() &&
      clave.length >= 8 &&
      nombre.trim() &&
      telefono.length >= 7 &&
      acepta
    : correo.trim() && clave.length > 0;

  return (
    <Marco>
      <Logo width={170} className="mb-1" />
      <h1 className="font-heading text-xl font-bold">
        {creando ? "Crea tu cuenta" : "Inicia sesión"}
      </h1>
      <p className="text-[15px] text-brand-text-secondary leading-relaxed">
        {creando
          ? "30 días de prueba. No pedimos tarjeta para empezar."
          : "Entra para dictar en este computador."}
      </p>

      <form
        className="w-full flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void (creando ? crear() : entrar());
        }}
      >
        {creando && (
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
        )}

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

        {creando && (
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
                setTelefono(e.target.value.replace(/\D/g, "").slice(0, MAX_TELEFONO))
              }
              disabled={ocupado}
              className={`${base} flex-1 min-w-0`}
            />
          </div>
        )}

        <input
          id="auth-clave"
          type="password"
          autoComplete={creando ? "new-password" : "current-password"}
          required
          placeholder={creando ? "Contraseña (mínimo 8 caracteres)" : "Contraseña"}
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          disabled={ocupado}
          className={campo}
        />

        {creando && (
          <label className="flex items-start gap-2.5 text-sm text-brand-text-secondary leading-snug cursor-pointer">
            <input
              id="registro-consentimiento"
              type="checkbox"
              checked={acepta}
              onChange={(e) => setAcepta(e.target.checked)}
              disabled={ocupado}
              className="mt-0.5 w-4 h-4 shrink-0 accent-brand-accent cursor-pointer"
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

        <Principal ocupado={ocupado} disabled={!puedeEnviar}>
          {creando ? "Crear cuenta" : "Entrar"}
        </Principal>
      </form>

      <div className="flex flex-col items-center gap-2 text-sm">
        {!creando && (
          <button
            onClick={() => {
              setModo("recuperar");
              setError(null);
            }}
            className="text-brand-text-secondary hover:text-brand-accent"
          >
            Olvidé mi contraseña
          </button>
        )}
        <button
          onClick={() => {
            setModo(creando ? "entrar" : "crear");
            setError(null);
          }}
          className="font-semibold text-brand-accent hover:underline"
        >
          {creando ? "Ya tengo cuenta" : "Crear una cuenta"}
        </button>
      </div>
    </Marco>
  );
};

/** Cada cuánto se reintenta entrar mientras el médico confirma su correo. */
const REINTENTO_MS = 30_000;
/** Pasado este tiempo se deja de reintentar solo; queda el botón "Ya confirmé". */
const ESPERA_MAX_MS = 60 * 60_000;
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
 * IP. Cada 30 s son 10, y en un consultorio varios médicos comparten IP. Si aun así frena, se hace
 * una pausa en vez de insistir.
 *
 * La contraseña vive solo en la memoria de esta pantalla, la misma que ya tenía el formulario.
 */
const EsperandoConfirmacion: React.FC<{
  correo: string;
  clave: string;
  onSignedIn: () => void;
  onVolver: () => void;
}> = ({ correo, clave, onSignedIn, onVolver }) => {
  const [aviso, setAviso] = useState<string | null>(null);
  const [probando, setProbando] = useState(false);
  const enCurso = useRef(false);
  const pausaHasta = useRef(0);
  const terminado = useRef(false);
  const ultimo = useRef(0);

  const intentar = async (manual: boolean) => {
    if (enCurso.current || terminado.current) return;
    if (!manual && Date.now() < pausaHasta.current) return;
    if (!manual && Date.now() - ultimo.current < SEPARACION_MIN_MS) return;
    ultimo.current = Date.now();
    enCurso.current = true;
    if (manual) {
      setProbando(true);
      setAviso(null);
    }
    const r = await commands.authSignIn(correo, clave);
    enCurso.current = false;
    setProbando(false);

    if (r.status === "ok") {
      terminado.current = true;
      onSignedIn();
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
    const tick = setInterval(() => {
      if (Date.now() - inicio > ESPERA_MAX_MS) {
        clearInterval(tick);
        return;
      }
      void intentarRef.current(false);
    }, REINTENTO_MS);

    const alVolver = () => {
      if (document.visibilityState === "visible") void intentarRef.current(false);
    };
    window.addEventListener("focus", alVolver);
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      clearInterval(tick);
      window.removeEventListener("focus", alVolver);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, []);

  return (
    <Marco>
      <div className="w-12 h-12 rounded-2xl bg-brand-accent-soft grid place-items-center mb-1">
        <MailCheck className="w-6 h-6 text-brand-accent" />
      </div>
      <h1 className="font-heading text-xl font-bold">Revisa tu correo</h1>
      <p className="text-[15px] text-brand-text-secondary leading-relaxed">
        Te enviamos un mensaje a <strong>{correo}</strong>. Ábrelo y toca el
        botón <strong>«Confirmar mi correo»</strong>.
      </p>
      <p className="text-[15px] text-brand-text-secondary leading-relaxed">
        Se abrirá nuestra página web: puedes cerrarla.{" "}
        <strong className="text-brand-text">Cuando vuelvas aquí, entrarás solo.</strong>
      </p>

      <div className="flex items-center gap-2 text-sm text-brand-text-muted">
        <Loader2 className="w-4 h-4 animate-spin" />
        Esperando tu confirmación…
      </div>

      {aviso && <Aviso>{aviso}</Aviso>}

      <button
        type="button"
        onClick={() => void intentar(true)}
        disabled={probando}
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[15px] font-semibold bg-brand-accent text-white hover:bg-brand-accent-secondary transition-colors disabled:opacity-40"
      >
        {probando && <Loader2 className="w-4 h-4 animate-spin" />}
        Ya confirmé mi correo
      </button>

      <p className="text-sm text-brand-text-muted">
        ¿No lo ves? Revisa el correo no deseado.
      </p>
      <button
        type="button"
        onClick={onVolver}
        className="text-sm font-semibold text-brand-accent hover:underline"
      >
        Volver a iniciar sesión
      </button>
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
            supportWhatsappUrl("Hola, tengo problemas para entrar a CloseLabs Voice."),
          )
        }
        className="mt-4 inline-flex items-center gap-1.5 text-sm text-brand-text-muted hover:text-[#128C7E] transition-colors"
      >
        <MessageCircle className="w-4 h-4" />
        ¿Problemas para entrar? Escríbenos por WhatsApp
      </button>
    </div>
  </div>
);

const Aviso: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p
    role="alert"
    className="text-sm text-left text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2 leading-snug"
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

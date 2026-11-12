/* eslint-disable i18next/no-literal-string */
import React, { useEffect, useRef, useState } from "react";
import { commands } from "@/bindings";
import Bienvenida from "./Bienvenida";
import PlantillaPrimerUso from "../tinta/PlantillaPrimerUso";
import { Aviso, Campo, CampoClave, Casilla } from "../tinta/Campos";
import { Enlace } from "../tinta/Botones";

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
  clave: string;
  acepta: boolean;
}): string | null {
  if (f.creando && !f.nombre.trim()) return "Escribe tu nombre y apellido.";
  if (!/^\S+@\S+\.\S+$/.test(f.correo.trim()))
    return "Revisa tu correo: debe verse así, nombre@correo.com.";
  if (!f.clave) return "Escribe tu contraseña.";
  if (f.creando && f.clave.length < 8)
    return `La contraseña necesita al menos 8 caracteres (llevas ${f.clave.length}).`;
  if (f.creando && !f.acepta)
    return "Marca la casilla de abajo para aceptar los Términos y la Política de Datos.";
  return null;
}

export const AuthGate: React.FC<AuthGateProps> = ({ onSignedIn }) => {
  const [modo, setModo] = useState<Modo>(() =>
    yaEntroAqui() ? "entrar" : "crear",
  );
  // La bienvenida con video, solo si nadie ha entrado antes en este computador (ver Bienvenida.tsx).
  const [bienvenida, setBienvenida] = useState(() => !yaEntroAqui());
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [nombre, setNombre] = useState("");
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
    // Sin celular (decisión de Nicolás, 2026-11-11): un campo menos donde trabarse, y el soporte
    // va por WhatsApp desde el número del médico, no desde uno que le pedimos.
    const r = await commands.authSignUp(correo, clave, nombre);
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

  if (bienvenida) {
    return (
      <Bienvenida
        onEmpezar={() => {
          setModo("crear");
          setBienvenida(false);
        }}
        onYaTengoCuenta={() => {
          setModo("entrar");
          setBienvenida(false);
        }}
      />
    );
  }

  /** Volver a la bienvenida solo si se llegó desde ella (nadie entró antes en este computador). */
  const volverABienvenida = yaEntroAqui()
    ? undefined
    : () => {
        setError(null);
        setBienvenida(true);
      };

  // -------------------------------------------------------------------------------------------
  // El código del correo
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
      <PlantillaPrimerUso
        clave="correo-enviado"
        etapa="cuenta"
        titulo="Revisa tu *correo*."
        apoyo={
          <>
            Si existe una cuenta con <strong className="text-tinta">{correo}</strong>, ahí
            llegará el enlace para elegir una contraseña nueva. Si no lo ves, revisa el correo no
            deseado.
          </>
        }
        principal={{
          texto: "Volver a iniciar sesión",
          onClick: () => {
            setModo("entrar");
            setError(null);
          },
        }}
        escenario={<Ilustracion archivo="correo-codigo" />}
        mensajeAyuda="Hola, no logro recuperar mi contraseña de CloseLabs Voice."
      />
    );
  }

  // -------------------------------------------------------------------------------------------
  // Recuperar contraseña
  // -------------------------------------------------------------------------------------------
  if (modo === "recuperar") {
    return (
      <PlantillaPrimerUso
        clave="recuperar"
        etapa="cuenta"
        atras={() => {
          setModo("entrar");
          setError(null);
        }}
        titulo="Recupera tu *contraseña*."
        apoyo="Escribe tu correo y te enviamos un enlace para elegir una nueva."
        principal={{
          texto: "Enviarme el enlace",
          form: "form-recuperar",
          ocupado,
          disabled: !correo.trim(),
        }}
        escenario={<Ilustracion archivo="correo-codigo" />}
        mensajeAyuda="Hola, no logro recuperar mi contraseña de CloseLabs Voice."
      >
        <form
          id="form-recuperar"
          noValidate
          className="flex flex-col gap-3.5"
          onSubmit={(e) => {
            e.preventDefault();
            void recuperar();
          }}
        >
          <Campo
            id="recuperar-correo"
            etiqueta="Correo"
            type="email"
            autoComplete="email"
            autoFocus
            placeholder="tu@correo.com"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            disabled={ocupado}
          />
          {error && <Aviso>{error}</Aviso>}
        </form>
      </PlantillaPrimerUso>
    );
  }

  // -------------------------------------------------------------------------------------------
  // Crear cuenta e iniciar sesión
  // -------------------------------------------------------------------------------------------
  const creando = modo === "crear";

  return (
    <PlantillaPrimerUso
      clave={modo}
      etapa="cuenta"
      atras={
        creando
          ? volverABienvenida
          : volverABienvenida ??
            (() => {
              setModo("crear");
              setError(null);
            })
      }
      titulo={creando ? "Crea tu *cuenta*." : "Inicia *sesión*."}
      principal={{
        texto: creando ? "Crear mi cuenta" : "Entrar",
        form: "form-cuenta",
        ocupado,
      }}
      enlace={
        creando
          ? {
              texto: "Ya tengo una cuenta",
              onClick: () => {
                setModo("entrar");
                setError(null);
              },
            }
          : {
              texto: "Olvidé mi contraseña",
              onClick: () => {
                setModo("recuperar");
                setError(null);
              },
            }
      }
      escenario={<Ilustracion archivo="privacidad" />}
      notaEscenario="Tus dictados no se almacenan ni se usan para entrenar modelos."
      mensajeAyuda="Hola, tengo problemas para entrar a CloseLabs Voice."
    >
      <form
        id="form-cuenta"
        // Sin la validación del navegador: mostraba "Fill out this field", en inglés, y tapaba
        // nuestro aviso en español de qué falta (revisión del 2026-11-11).
        noValidate
        className="flex flex-col gap-3.5"
        onSubmit={(e) => {
          e.preventDefault();
          // El botón nunca queda gris sin explicación: si falta algo, se dice qué.
          const falta = queFalta({ creando, nombre, correo, clave, acepta });
          if (falta) {
            setError(falta);
            return;
          }
          void (creando ? crear() : entrar());
        }}
      >
        {creando && (
          <Campo
            id="registro-nombre"
            etiqueta="Nombre y apellido"
            type="text"
            autoComplete="name"
            autoFocus
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            disabled={ocupado}
          />
        )}
        <Campo
          id="auth-correo"
          etiqueta="Correo"
          type="email"
          autoComplete="email"
          autoFocus={!creando}
          placeholder="tu@correo.com"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          disabled={ocupado}
        />
        <CampoClave
          id="auth-clave"
          etiqueta="Contraseña"
          autoComplete={creando ? "new-password" : "current-password"}
          placeholder={creando ? "Mínimo 8 caracteres" : undefined}
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          disabled={ocupado}
        />
        {creando && (
          <div className="pt-1">
            <Casilla
              id="registro-consentimiento"
              marcada={acepta}
              onCambio={setAcepta}
              disabled={ocupado}
            >
              Acepto los{" "}
              <a
                href="https://closelabs.co/terminos"
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="font-semibold text-tinta underline underline-offset-4 decoration-linea-fuerte"
              >
                Términos
              </a>{" "}
              y la{" "}
              <a
                href="https://closelabs.co/privacidad"
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="font-semibold text-tinta underline underline-offset-4 decoration-linea-fuerte"
              >
                Política de Datos
              </a>
              .
            </Casilla>
          </div>
        )}
        {error && <Aviso>{error}</Aviso>}
        {!creando && (
          <p className="text-[15px] leading-[22px] text-tinta-2">
            ¿Es tu primera vez?{" "}
            <Enlace
              chico
              onClick={() => {
                setModo("crear");
                setError(null);
              }}
            >
              Crear mi cuenta
            </Enlace>
          </p>
        )}
      </form>
    </PlantillaPrimerUso>
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
    <PlantillaPrimerUso
      clave="codigo"
      etapa="cuenta"
      atras={onCorregir}
      titulo="Revisa tu *correo*."
      apoyo={
        <>
          Te enviamos un código de {LARGO_CODIGO} números a{" "}
          <strong className="text-tinta font-semibold">{correo}</strong>
        </>
      }
      principal={{
        texto: "Confirmar",
        form: "form-codigo",
        disabled: codigo.length < LARGO_CODIGO,
        ocupado: ocupadoAhora,
      }}
      enlace={
        reenvio === "enviado"
          ? { texto: "Listo, te lo enviamos otra vez", onClick: () => {}, disabled: true }
          : {
              texto:
                reenvio === "enviando"
                  ? "Enviando…"
                  : "No me llegó: enviar otro código",
              onClick: () => void reenviar(),
              disabled: reenvio === "enviando",
            }
      }
      escenario={<Ilustracion archivo="correo-codigo" />}
      notaEscenario="¿No lo ves? Búscalo también en «Correo no deseado»."
      mensajeAyuda="Hola, no me llega el código para entrar a CloseLabs Voice."
    >
      <form
        id="form-codigo"
        // Sin la validación del navegador (decía "Fill out this field", en inglés).
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void verificar(codigo);
        }}
      >
        <CasillasCodigo
          valor={codigo}
          largo={LARGO_CODIGO}
          disabled={verificando}
          onCambio={(limpio) => {
            setCodigo(limpio);
            setAviso(null);
            // Al completar el último número se comprueba solo: un botón menos que encontrar.
            if (limpio.length === LARGO_CODIGO) void verificar(limpio);
          }}
        />
        {comprobando && !verificando && (
          <p className="text-[15px] text-tinta-2">Comprobando…</p>
        )}
        {aviso && <Aviso>{aviso}</Aviso>}
        <div className="flex flex-col items-start gap-2 text-[15px] text-tinta-2">
          <span>
            ¿Tocaste el botón del correo en vez de copiar el código?{" "}
            <Enlace chico onClick={() => void intentar("manual")} disabled={ocupadoAhora}>
              Ya lo toqué
            </Enlace>
          </span>
          <span>
            ¿Escribiste mal tu correo?{" "}
            <Enlace chico onClick={onCorregir}>
              Corrígelo
            </Enlace>
          </span>
        </div>
      </form>
    </PlantillaPrimerUso>
  );
};

/**
 * ⚠️ La ayuda por WhatsApp está en TODAS las pantallas de cuenta ("¿Necesitas ayuda?", arriba a
 * la derecha de la plantilla), y no es un adorno: la cuenta es obligatoria y no hay forma de dictar
 * sin ella. Un médico que no logra registrarse o entrar no tiene ninguna otra salida.
 */

/** Las ilustraciones de «Tinta y voz» (public/ilustraciones). */
const Ilustracion: React.FC<{
  archivo: "privacidad" | "correo-codigo" | "voz-a-texto";
}> = ({ archivo }) => (
  <img
    src={`/ilustraciones/${archivo}.svg`}
    alt=""
    width={520}
    height={400}
    className="max-w-full h-auto"
    draggable={false}
  />
);

/**
 * Las seis casillas del código (54 × 68, dígito en serif). Por debajo es UN solo campo: así pegar
 * los seis números desde el correo funciona de una vez, y borrar retrocede como en cualquier texto.
 */
const CasillasCodigo: React.FC<{
  valor: string;
  largo: number;
  disabled: boolean;
  onCambio: (limpio: string) => void;
}> = ({ valor, largo, disabled, onCambio }) => {
  const campo = useRef<HTMLInputElement>(null);
  const [enfocado, setEnfocado] = useState(true);
  return (
    <div
      className="relative flex gap-2.5 cursor-text"
      onClick={() => campo.current?.focus()}
    >
      <input
        ref={campo}
        id="codigo-confirmacion"
        aria-label="Código del correo"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        value={valor}
        disabled={disabled}
        onFocus={() => setEnfocado(true)}
        onBlur={() => setEnfocado(false)}
        onChange={(e) =>
          // Solo números: si lo pega con espacios o guiones, se limpian.
          onCambio(e.target.value.replace(/\D/g, "").slice(0, largo))
        }
        className="absolute inset-0 opacity-0 select-text"
      />
      {Array.from({ length: largo }).map((_, i) => {
        const activa = enfocado && i === Math.min(valor.length, largo - 1);
        return (
          <span
            key={i}
            aria-hidden
            className={`grid place-items-center w-[54px] h-[68px] rounded-[12px] border-[1.5px] bg-papel font-serif text-[34px] font-medium text-tinta transition-[border-color,box-shadow] duration-150 ${
              activa
                ? "border-tinta shadow-[0_0_0_3px_var(--foco)]"
                : "border-linea-fuerte"
            } ${disabled ? "opacity-60" : ""}`}
          >
            {valor[i] ?? ""}
          </span>
        );
      })}
    </div>
  );
};

export default AuthGate;

/* eslint-disable i18next/no-literal-string */
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * La guía VIVA de la pantalla de Permisos (maqueta aprobada por Nicolás el 2026-11-12:
 * `diseno/maquetas/permisos.html`). Antes la derecha era un dibujo quieto y "no se le para bolas":
 * ahora es un tutorial corto que avanza solo —como el de la página de descarga— y dice en vivo en
 * qué va ("Así se hace" / "Te estamos esperando…").
 *
 * - Mac: Ajustes del Sistema › Accesibilidad → buscar CloseLabs Voice → encender → huella/contraseña.
 * - Windows: Configuración › Privacidad y seguridad › Micrófono → los dos interruptores.
 *
 * Los dibujos imitan la cara del sistema (no nuestro estilo) para que el médico lo reconozca al
 * verlo de verdad.
 */

type Momento = "antes" | "esperando";
const CADA_MS = 2800;

/** Cuadro actual del tutorial; mientras espera, se salta el primero ("se abre…", ya pasó). */
function useCuadro(total: number, momento: Momento) {
  const primero = momento === "esperando" ? 1 : 0;
  const [cuadro, setCuadro] = useState(primero);
  useEffect(() => {
    setCuadro(primero);
    const id = setInterval(
      () => setCuadro((c) => (c + 1 >= total ? primero : c + 1)),
      CADA_MS,
    );
    return () => clearInterval(id);
  }, [total, primero]);
  return cuadro;
}

/** `true` desde ~1 s después de entrar al cuadro (el momento del clic del cursor). */
function useClic(cuadro: number) {
  const [clic, setClic] = useState(false);
  useEffect(() => {
    setClic(false);
    const id = setTimeout(() => setClic(true), 950);
    return () => clearTimeout(id);
  }, [cuadro]);
  return clic;
}

const Estado: React.FC<{ momento: Momento; esperandoEn: string }> = ({
  momento,
  esperandoEn,
}) => (
  <span className="inline-flex items-center gap-2.5 h-[34px] px-3.5 rounded-full bg-papel border border-linea text-[14px] font-semibold text-tinta-2">
    <i
      className={`w-[9px] h-[9px] rounded-full ${
        momento === "esperando"
          ? "bg-lila motion-safe:animate-[late_1.2s_ease-in-out_infinite]"
          : "bg-linea-fuerte"
      }`}
    />
    {momento === "esperando" ? `Te estamos esperando en ${esperandoEn}…` : "Así se hace"}
  </span>
);

const Leyenda: React.FC<{
  cuadros: { b: string; s: string }[];
  cuadro: number;
}> = ({ cuadros, cuadro }) => (
  <>
    <div className="text-center min-h-[62px] max-w-[430px]">
      <b className="block text-[19px] leading-[26px] font-semibold text-tinta">
        {cuadros[cuadro].b}
      </b>
      <span className="block mt-1 text-[15px] leading-[22px] text-tinta-2">
        {cuadros[cuadro].s}
      </span>
    </div>
    <div className="flex gap-2" aria-hidden>
      {cuadros.map((_, i) => (
        <i
          key={i}
          className={`w-7 h-1 rounded-sm ${
            i < cuadro ? "bg-tinta" : i === cuadro ? "bg-lila" : "bg-linea-fuerte"
          }`}
        />
      ))}
    </div>
  </>
);

const Cursor: React.FC<{ x: number; y: number; clic: boolean }> = ({ x, y, clic }) => (
  <svg
    viewBox="0 0 24 24"
    className="absolute w-[22px] h-[22px] z-10 motion-safe:transition-[left,top,transform] motion-safe:duration-[900ms] motion-safe:ease-[cubic-bezier(.2,.8,.2,1)]"
    style={{ left: x, top: y, transform: clic ? "scale(.82)" : undefined }}
  >
    <path
      d="M4 2l15 9-6.5 1.5L9 19z"
      fill="#fff"
      stroke="#18141d"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </svg>
);

const Cuadro = React.forwardRef<HTMLDivElement, { children: React.ReactNode }>(
  ({ children }, ref) => (
    <div
      ref={ref}
      className="relative w-[470px] max-w-full h-[300px] bg-papel border border-linea rounded-[16px] overflow-hidden shadow-[0_0_0_2px_var(--lila-suave)]"
      aria-hidden
    >
      {children}
    </div>
  ),
);
Cuadro.displayName = "Cuadro";

/**
 * Dónde poner el cursor: el centro (o el punto `fx`, `fy` en fracciones) del elemento objetivo, medido
 * DE VERDAD dentro del cuadro. Antes eran coordenadas fijas y en la app real el cursor caía sobre el
 * interruptor de Google Chrome, no el de CloseLabs Voice (Nicolás, 2026-11-13: "el mouse está como
 * descalibrado"). Sin objetivo, la esquina de abajo a la derecha. La punta de la flecha está en
 * (4, 2) del dibujo de 22 px: se resta para que sea la punta la que toque.
 */
type Objetivo = { ref: React.RefObject<HTMLElement | null>; fx?: number; fy?: number } | null;
function usePunteria(
  cuadroRef: React.RefObject<HTMLDivElement | null>,
  objetivo: Objetivo,
  clave: unknown,
) {
  const [pos, setPos] = useState({ x: 400, y: 250 });
  useLayoutEffect(() => {
    const medir = () => {
      const c = cuadroRef.current;
      if (!c) return;
      const rc = c.getBoundingClientRect();
      const el = objetivo?.ref.current;
      if (!el) {
        setPos({ x: rc.width - 70, y: rc.height - 50 });
        return;
      }
      const r = el.getBoundingClientRect();
      setPos({
        x: r.left - rc.left + r.width * (objetivo?.fx ?? 0.5) - 4,
        y: r.top - rc.top + r.height * (objetivo?.fy ?? 0.5) - 2,
      });
    };
    medir();
    // Una segunda medida cuando terminan las transiciones (la ventanita aparece con opacidad).
    const id = setTimeout(medir, 380);
    window.addEventListener("resize", medir);
    return () => {
      clearTimeout(id);
      window.removeEventListener("resize", medir);
    };
  }, [clave]);
  return pos;
}

// --------------------------------------------------------------------------------------------
// Mac: Ajustes del Sistema › Accesibilidad
// --------------------------------------------------------------------------------------------

const CUADROS_MAC = [
  { b: "Se abre Ajustes del Sistema", s: "Ya en la sección Accesibilidad. Nosotros te la abrimos." },
  { b: "Busca CloseLabs Voice", s: "Está en la lista. La ventanita negra de abajo te la señala." },
  { b: "Enciende su interruptor", s: "Un clic. Se pone azul." },
  { b: "Pon tu huella o tu contraseña", s: "Es la de tu Mac, no la de CloseLabs." },
];

const InterruptorMac: React.FC<{
  on: boolean;
  marcado?: boolean;
  refObj?: React.Ref<HTMLSpanElement>;
}> = ({ on, marcado, refObj }) => (
  <span
    ref={refObj}
    className={`w-[30px] h-[18px] rounded-full relative motion-safe:transition-colors ${
      on ? "bg-[#3478F6]" : "bg-[#E1DFE5]"
    } ${marcado ? "ring-[3px] ring-lila ring-offset-1" : ""}`}
  >
    <span
      className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow motion-safe:transition-[left] ${
        on ? "left-[14px]" : "left-[2px]"
      }`}
    />
  </span>
);

export const GuiaPermisosMac: React.FC<{ momento: Momento }> = ({ momento }) => {
  const cuadro = useCuadro(CUADROS_MAC.length, momento);
  const clic = useClic(cuadro);
  const encendido = cuadro === 3 || (cuadro === 2 && clic);
  const cuadroRef = useRef<HTMLDivElement>(null);
  const filaRef = useRef<HTMLDivElement>(null);
  const interruptorRef = useRef<HTMLSpanElement>(null);
  const huellaRef = useRef<HTMLDivElement>(null);
  const objetivos: Objetivo[] = [
    null,
    { ref: filaRef, fx: 0.45 },
    { ref: interruptorRef },
    { ref: huellaRef, fy: 0.86 },
  ];
  const cursor = usePunteria(cuadroRef, objetivos[cuadro], cuadro);
  const filas: [string, boolean, boolean][] = [
    ["Google Chrome", true, false],
    ["CloseLabs Voice", encendido, true],
    ["Microsoft Word", true, false],
    ["Zoom", false, false],
  ];
  return (
    <div className="flex flex-col items-center gap-[18px]">
      <Estado momento={momento} esperandoEn="Ajustes" />
      <Cuadro ref={cuadroRef}>
        <div
          className={`absolute left-[26px] top-[22px] w-[418px] h-[256px] rounded-[11px] bg-[#F6F5F8] border border-[#DCD9E0] shadow-2 flex overflow-hidden font-[system-ui] motion-safe:transition-opacity ${
            cuadro === 0 && !clic ? "opacity-0" : "opacity-100"
          }`}
        >
          <div className="w-[104px] bg-[#ECEAF0] px-3 py-[30px] flex flex-col gap-[9px]">
            {[62, 48, 72, 56, 66, 44].map((w, i) => (
              <span
                key={i}
                className={`h-[7px] rounded ${i === 2 ? "bg-[#3478F6]/85" : "bg-[#D6D3DC]"}`}
                style={{ width: w }}
              />
            ))}
          </div>
          <div className="flex-1 px-3.5 py-4 text-left">
            <div className="text-[13px] font-semibold text-[#1d1d1f]">Accesibilidad</div>
            <div className="text-[10px] text-[#6e6e73] mb-2.5">
              Permite que estas apps controlen tu computador.
            </div>
            <div className="rounded-[8px] bg-white border border-[#E3E1E7] overflow-hidden">
              {filas.map(([nombre, on, nuestra]) => (
                <div
                  key={nombre}
                  ref={nuestra ? filaRef : undefined}
                  className={`h-[34px] px-[11px] flex items-center gap-[9px] border-b last:border-b-0 border-[#EEECF1] ${
                    nuestra && cuadro >= 1 ? "shadow-[inset_0_0_0_2px_var(--lila)] rounded-[6px]" : ""
                  }`}
                >
                  {nuestra ? (
                    <img
                      src="/brand/closelabs-isotype-black.png"
                      alt=""
                      className="w-[18px] h-[18px] object-contain"
                    />
                  ) : (
                    <span className="w-[18px] h-[18px] rounded-[5px] bg-[#E3E1E7]" />
                  )}
                  <span className="flex-1 text-[12px] text-[#1d1d1f]">{nombre}</span>
                  <InterruptorMac on={on} refObj={nuestra ? interruptorRef : undefined} />
                </div>
              ))}
            </div>
          </div>
        </div>
        {(cuadro === 1 || cuadro === 2) && (
          <div className="absolute left-[46px] top-[236px] w-[378px] h-11 rounded-[12px] bg-noche text-white flex items-center gap-2.5 px-3 text-[12px] leading-4 shadow-flota">
            <span className="grid place-items-center w-6 h-6 shrink-0 rounded-full bg-lila">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M12 19V5M12 5l-6 6M12 5l6 6" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span>
              Busca <b>CloseLabs Voice</b> arriba y enciende su interruptor.
            </span>
          </div>
        )}
        {cuadro === 3 && (
          <div ref={huellaRef} className="absolute left-[110px] top-16 w-[250px] p-4 rounded-[12px] bg-[#FBFBFD] border border-[#DCD9E0] shadow-[0_14px_34px_rgba(24,20,29,.22)] text-center font-[system-ui] z-[5]">
            <div className="w-10 h-10 mx-auto mb-2 rounded-full border-2 border-[#F0506E] grid place-items-center">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F0506E" strokeWidth="1.8" strokeLinecap="round">
                <path d="M7 11a5 5 0 0 1 10 0v2M9.5 11a2.5 2.5 0 0 1 5 0v4M12 11v6M7 15v-1M17 16v-1" />
              </svg>
            </div>
            <b className="block text-[12px] text-[#1d1d1f]">Ajustes del Sistema quiere hacer cambios</b>
            <small className="block mt-0.5 text-[10px] text-[#6e6e73]">
              Usa Touch ID o escribe tu contraseña del Mac.
            </small>
            <div className="mt-2.5 h-5 rounded-md bg-[#E9E7EC]" />
          </div>
        )}
        <Cursor x={cursor.x} y={cursor.y} clic={cuadro === 2 && clic} />
      </Cuadro>
      <Leyenda cuadros={CUADROS_MAC} cuadro={cuadro} />
    </div>
  );
};

// --------------------------------------------------------------------------------------------
// Windows: Configuración › Privacidad y seguridad › Micrófono
// --------------------------------------------------------------------------------------------

const CUADROS_WIN = [
  { b: "Se abre la Configuración de Windows", s: "En Privacidad y seguridad › Micrófono. Nosotros te la abrimos." },
  { b: "Enciende «Acceso al micrófono»", s: "El primer interruptor. Un clic." },
  { b: "Y el de «aplicaciones de escritorio»", s: "Más abajo. Otro clic, y queda azul." },
  { b: "Vuelve aquí", s: "No hay que reiniciar nada: la app lo nota sola." },
];

const InterruptorWin: React.FC<{ on: boolean; refObj?: React.Ref<HTMLSpanElement> }> = ({
  on,
  refObj,
}) => (
  <>
    <span className="w-[58px] shrink-0 text-right text-[10px] text-[#444]">
      {on ? "Activado" : "Desactivado"}
    </span>
    <span
      ref={refObj}
      className={`relative shrink-0 w-[34px] h-[17px] rounded-full border-[1.5px] motion-safe:transition-colors ${
        on ? "bg-[#0067C0] border-[#0067C0]" : "border-[#5F5F5F]"
      }`}
    >
      <span
        className={`absolute top-[2.5px] w-[9px] h-[9px] rounded-full motion-safe:transition-[left] ${
          on ? "left-[19px] bg-white" : "left-[3px] bg-[#5F5F5F]"
        }`}
      />
    </span>
  </>
);

export const GuiaPermisosWindows: React.FC<{ momento: Momento }> = ({ momento }) => {
  const cuadro = useCuadro(CUADROS_WIN.length, momento);
  const clic = useClic(cuadro);
  const primero = cuadro >= 2 || (cuadro === 1 && clic);
  const segundo = cuadro === 3 || (cuadro === 2 && clic);
  const cuadroRef = useRef<HTMLDivElement>(null);
  const primeroRef = useRef<HTMLSpanElement>(null);
  const segundoRef = useRef<HTMLSpanElement>(null);
  const objetivos: Objetivo[] = [null, { ref: primeroRef }, { ref: segundoRef }, null];
  const cursor = usePunteria(cuadroRef, objetivos[cuadro], cuadro);
  const segoe = { fontFamily: '"Segoe UI", system-ui, sans-serif' };
  return (
    <div className="flex flex-col items-center gap-[18px]">
      <Estado momento={momento} esperandoEn="la Configuración" />
      <Cuadro ref={cuadroRef}>
        <div
          className={`absolute left-5 top-[18px] w-[430px] h-[264px] rounded-[8px] bg-[#F3F3F3] border border-[#D6D6D6] shadow-2 flex overflow-hidden motion-safe:transition-opacity ${
            cuadro === 0 && !clic ? "opacity-0" : "opacity-100"
          }`}
          style={segoe}
        >
          <div className="w-[112px] px-2.5 py-[30px] flex flex-col gap-2.5">
            {[70, 52, 64, 84, 58, 46].map((w, i) => (
              <span
                key={i}
                className={`h-[7px] rounded ${i === 3 ? "bg-[#0067C0]/80" : "bg-[#D9D9D9]"}`}
                style={{ width: w }}
              />
            ))}
          </div>
          <div className="flex-1 pt-4 pr-3.5 pl-1 text-left">
            <div className="text-[15px] font-semibold text-[#1b1b1b] mb-2.5">
              <span className="font-normal text-[#666]">Privacidad y seguridad › </span>
              Micrófono
            </div>
            <div
              className={`bg-white border border-[#E5E5E5] rounded-md px-3 py-2.5 flex items-center gap-2.5 mb-1.5 ${
                cuadro === 1 ? "shadow-[0_0_0_2px_var(--lila)]" : ""
              }`}
            >
              <div className="flex-1 text-[11px] leading-[14px] text-[#1b1b1b]">
                Acceso al micrófono
                <small className="block text-[9.5px] text-[#666]">
                  Cualquiera que use este dispositivo puede elegir…
                </small>
              </div>
              <InterruptorWin on={primero} refObj={primeroRef} />
            </div>
            <div className="bg-white border border-[#E5E5E5] rounded-md px-3 py-2.5 flex items-center gap-2.5 mb-1.5">
              <div className="flex-1 text-[11px] leading-[14px] text-[#9A9A9A]">
                Permitir que las aplicaciones accedan al micrófono
              </div>
            </div>
            <div
              className={`bg-white border border-[#E5E5E5] rounded-md px-3 py-2.5 flex items-center gap-2.5 ${
                cuadro === 2 ? "shadow-[0_0_0_2px_var(--lila)]" : ""
              }`}
            >
              <div className="flex-1 text-[11px] leading-[14px] text-[#1b1b1b]">
                Permitir que las aplicaciones de escritorio accedan al micrófono
              </div>
              <InterruptorWin on={segundo} refObj={segundoRef} />
            </div>
          </div>
        </div>
        {cuadro === 3 && (
          <div className="absolute inset-0 bg-papel flex flex-col items-center justify-center gap-3 z-[5]">
            <span className="grid place-items-center w-16 h-16 rounded-full bg-hecho">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            </span>
            <b className="font-serif font-medium text-[24px]">Listo. Vuelve aquí.</b>
            <span className="text-[14px] text-tinta-2">CloseLabs Voice lo nota sola.</span>
          </div>
        )}
        <Cursor x={cursor.x} y={cursor.y} clic={(cuadro === 1 || cuadro === 2) && clic} />
      </Cuadro>
      <Leyenda cuadros={CUADROS_WIN} cuadro={cuadro} />
    </div>
  );
};

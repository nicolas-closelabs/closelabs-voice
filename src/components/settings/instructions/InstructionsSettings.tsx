/* eslint-disable i18next/no-literal-string */
import React, { useState } from "react";
import { ShieldCheck, ArrowLeft, ArrowRight, Check } from "lucide-react";
import "./Instructions.css";

interface Step {
  title: string;
  desc: string;
  demo: React.ReactNode;
}

const KeysDemo = () => (
  <div className="clv-keys clv-rise">
    <span className="clv-key k1">⌥</span>
    <span className="clv-plus">+</span>
    <span className="clv-key k2">Espacio</span>
  </div>
);

const OverlayDemo = () => (
  <div className="clv-overlay clv-rise">
    <span className="clv-brand">◈ CloseLabs</span>
    <div className="clv-bars">
      {Array.from({ length: 9 }).map((_, i) => (
        <i key={i} style={{ animationDelay: `${i * 0.08}s` }} />
      ))}
    </div>
    <span className="clv-tag">Escuchando…</span>
  </div>
);

const TypeDemo = () => (
  <div className="clv-field clv-rise">
    <span className="clv-type">Hola, ¿cómo está hoy el paciente?</span>
  </div>
);

const DictDemo = () => (
  <div className="clv-chips">
    <span className="clv-chip">Amoxicilina</span>
    <span className="clv-chip accent">
      <Check className="w-3.5 h-3.5" /> CloseLabs
    </span>
    <span className="clv-chip">Ibuprofeno</span>
    <span className="clv-chip">Dr. Pérez</span>
  </div>
);

const PrivateDemo = () => (
  <div className="flex flex-col items-center gap-3">
    <div className="clv-shield">
      <ShieldCheck className="w-11 h-11" />
    </div>
    <span className="clv-rise text-sm font-heading font-semibold text-brand-text-secondary">
      100% privado y seguro
    </span>
  </div>
);

const STEPS: Step[] = [
  {
    title: "1. Presiona el atajo",
    desc: "En cualquier campo de texto (historia clínica, WhatsApp, correo…) presiona ⌥ + Espacio para empezar a grabar.",
    demo: <KeysDemo />,
  },
  {
    title: "2. Habla natural",
    desc: "Dicta como hablas normalmente, en español. No necesitas decir la puntuación: se agrega sola.",
    demo: <OverlayDemo />,
  },
  {
    title: "3. Vuelve a presionar el atajo",
    desc: "Presiona ⌥ + Espacio otra vez para terminar de grabar.",
    demo: <KeysDemo />,
  },
  {
    title: "4. ¡Listo! Se pega solo",
    desc: "El texto se limpia (quita muletillas y puntúa) y se pega donde tenías el cursor.",
    demo: <TypeDemo />,
  },
  {
    title: "5. Tu diccionario",
    desc: "En la sección Diccionario agrega nombres, medicamentos o términos para que siempre se escriban bien.",
    demo: <DictDemo />,
  },
  {
    title: "6. Privado y seguro",
    desc: "Tus dictados son privados y seguros: no se almacenan ni se usan para entrenar modelos. Sin conexión, la transcripción ocurre 100% en tu computador.",
    demo: <PrivateDemo />,
  },
];

export const InstructionsSettings: React.FC = () => {
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  return (
    <div className="max-w-2xl w-full mx-auto flex flex-col gap-6 py-4">
      <div className="text-center">
        <h1 className="font-heading font-bold text-2xl">Instrucciones</h1>
        <p className="text-brand-text-secondary mt-1">
          Un recorrido rápido para dominar CloseLabs Voice.
        </p>
      </div>

      {/* Escenario animado (se remonta por paso para reproducir la animación) */}
      <div key={i} className="clv-stage">
        {step.demo}
      </div>

      {/* Texto del paso */}
      <div className="text-center px-4 min-h-[72px]">
        <h2 className="font-heading font-semibold text-lg">{step.title}</h2>
        <p className="text-brand-text-secondary max-w-md mx-auto leading-relaxed mt-1">
          {step.desc}
        </p>
      </div>

      {/* Navegación */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setI((v) => Math.max(0, v - 1))}
          disabled={i === 0}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium text-brand-text-secondary hover:bg-brand-surface disabled:opacity-0 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Atrás
        </button>

        <div className="flex items-center gap-2">
          {STEPS.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setI(idx)}
              aria-label={`Paso ${idx + 1}`}
              className={`h-2 rounded-full transition-all ${
                idx === i
                  ? "w-6 bg-brand-accent"
                  : "w-2 bg-brand-border-strong hover:bg-brand-text-muted"
              }`}
            />
          ))}
        </div>

        <button
          onClick={() => !last && setI((v) => Math.min(STEPS.length - 1, v + 1))}
          disabled={last}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
            last
              ? "opacity-0 pointer-events-none"
              : "bg-brand-accent text-white hover:bg-brand-accent-secondary"
          }`}
        >
          Siguiente <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

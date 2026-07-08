/* eslint-disable i18next/no-literal-string */
import React, { useState } from "react";
import {
  Keyboard,
  Mic,
  ClipboardCheck,
  BookMarked,
  ShieldCheck,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";

interface Step {
  icon: React.ReactNode;
  title: string;
  desc: string;
}

const STEPS: Step[] = [
  {
    icon: <Keyboard className="w-8 h-8" />,
    title: "1. Presiona el atajo",
    desc: "Ponte en cualquier campo de texto (historia clínica, WhatsApp, correo…) y presiona ⌥ + Espacio para empezar a grabar.",
  },
  {
    icon: <Mic className="w-8 h-8" />,
    title: "2. Habla natural",
    desc: "Dicta como hablas normalmente, en español. No necesitas decir la puntuación: CloseLabs Voice la agrega por ti.",
  },
  {
    icon: <ClipboardCheck className="w-8 h-8" />,
    title: "3. Termina y listo",
    desc: "Presiona ⌥ + Espacio otra vez para terminar. El texto se limpia (quita muletillas) y se pega solo donde tenías el cursor.",
  },
  {
    icon: <BookMarked className="w-8 h-8" />,
    title: "4. Tu diccionario",
    desc: "En la sección Diccionario agrega nombres, medicamentos o términos que quieras que escriba siempre bien.",
  },
  {
    icon: <ShieldCheck className="w-8 h-8" />,
    title: "5. Privado y offline",
    desc: "La transcripción ocurre en tu computador; tu voz nunca se sube a internet. Funciona incluso sin conexión.",
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

      {/* Tarjeta del paso */}
      <div className="rounded-3xl border border-brand-border bg-white shadow-[0_2px_10px_rgba(26,22,32,0.05)] p-8 flex flex-col items-center text-center gap-4 min-h-[240px] justify-center">
        <div className="grid place-items-center w-16 h-16 rounded-2xl bg-brand-accent-soft text-brand-accent">
          {step.icon}
        </div>
        <h2 className="font-heading font-semibold text-lg">{step.title}</h2>
        <p className="text-brand-text-secondary max-w-md leading-relaxed">
          {step.desc}
        </p>
      </div>

      {/* Dots + navegación */}
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

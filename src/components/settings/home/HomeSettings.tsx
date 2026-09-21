/* eslint-disable i18next/no-literal-string */
import React from "react";
import { Mic, Keyboard, ClipboardCheck, Loader2, Check, PlayCircle } from "lucide-react";
import { useShortcutKeys } from "../../../hooks/useShortcutKeys";
import { useModelStore } from "../../../stores/modelStore";
import Logo from "../../icons/Logo";
import { ABRIR_PRIMER_DICTADO } from "../../onboarding/PrimerDictado";

const Step: React.FC<{
  n: number;
  icon: React.ReactNode;
  title: string;
  desc: string;
}> = ({ n, icon, title, desc }) => (
  <div className="flex-1 rounded-2xl border border-brand-border bg-brand-surface p-5 flex flex-col gap-2">
    <div className="flex items-center gap-2">
      <span className="grid place-items-center w-7 h-7 rounded-full bg-brand-accent text-white text-sm font-semibold font-heading">
        {n}
      </span>
      <span className="text-brand-accent">{icon}</span>
    </div>
    <div className="font-heading font-semibold text-[15px]">{title}</div>
    <div className="text-sm text-brand-text-secondary leading-snug">{desc}</div>
  </div>
);

export const HomeSettings: React.FC = () => {
  const { models, downloadProgress } = useModelStore();
  const { keys, text: atajo } = useShortcutKeys();

  const downloading = Object.values(downloadProgress)[0];
  const ready = models.some((m) => m.is_downloaded);

  return (
    <div className="max-w-3xl w-full mx-auto flex flex-col gap-8 py-4">
      {/* Hero */}
      <div className="flex flex-col items-center text-center gap-3 pt-2">
        <Logo width={172} />
        <p className="text-brand-text-secondary max-w-md">
          Dicta por voz y el texto aparece donde tengas el cursor. Rápido,
          privado y en tu idioma.
        </p>
      </div>

      {/* Estado */}
      <div className="rounded-2xl border border-brand-border bg-white shadow-[0_1px_2px_rgba(26,22,32,0.04)] p-5 flex items-center justify-between gap-4">
        {downloading ? (
          <>
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-brand-accent animate-spin" />
              <div>
                <div className="font-heading font-semibold text-[15px]">
                  Ya puedes dictar
                </div>
                <div className="text-sm text-brand-text-secondary">
                  Mientras tanto se descarga el modo sin conexión (solo la
                  primera vez).
                </div>
              </div>
            </div>
            <div className="text-brand-accent font-heading font-semibold tabular-nums">
              {Math.round(downloading.percentage)}%
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <span className="grid place-items-center w-9 h-9 rounded-full bg-brand-accent-soft text-brand-accent">
                <Check className="w-5 h-5" strokeWidth={2.5} />
              </span>
              <div>
                <div className="font-heading font-semibold text-[15px]">
                  {ready ? "Listo para dictar" : "Casi listo"}
                </div>
                <div className="text-sm text-brand-text-secondary">
                  Presiona tu atajo en cualquier app y empieza a hablar.
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {keys.map((k, i) => (
                <kbd
                  key={i}
                  className="px-2.5 py-1.5 rounded-lg border border-brand-border bg-brand-surface font-heading text-sm font-medium shadow-[0_1px_0_rgba(26,22,32,0.05)]"
                >
                  {k}
                </kbd>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Práctica: el mismo tutorial del primer arranque, para cuando quieran repasar o probar
          que todo sigue funcionando (un micrófono nuevo, por ejemplo). */}
      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event(ABRIR_PRIMER_DICTADO))}
        className="rounded-2xl border border-brand-border bg-brand-surface p-5 flex items-center gap-4 text-left hover:border-brand-accent transition-colors"
      >
        <span className="grid place-items-center w-10 h-10 shrink-0 rounded-full bg-brand-accent text-white">
          <PlayCircle className="w-5 h-5" />
        </span>
        <div>
          <div className="font-heading font-semibold text-[15px]">
            Hacer un dictado de prueba
          </div>
          <div className="text-sm text-brand-text-secondary">
            Practica aquí mismo, sin riesgo, antes de dictar en tu historia clínica.
          </div>
        </div>
      </button>

      {/* Cómo usar */}
      <div className="flex flex-col gap-3">
        <h2 className="font-heading font-semibold text-brand-text-secondary text-sm tracking-wide uppercase">
          Cómo usar
        </h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <Step
            n={1}
            icon={<Keyboard className="w-4 h-4" />}
            title="Presiona el atajo"
            desc={`Usa ${atajo} en cualquier campo de texto.`}
          />
          <Step
            n={2}
            icon={<Mic className="w-4 h-4" />}
            title="Habla natural"
            desc="Dicta en español; presiona de nuevo para terminar."
          />
          <Step
            n={3}
            icon={<ClipboardCheck className="w-4 h-4" />}
            title="Listo"
            desc="El texto limpio se pega solo donde tenías el cursor."
          />
        </div>
      </div>
    </div>
  );
};

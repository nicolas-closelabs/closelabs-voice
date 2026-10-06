/* eslint-disable i18next/no-literal-string */
import React, { useCallback, useEffect, useState } from "react";
import { Laptop, Monitor, LogOut, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { listen } from "@tauri-apps/api/event";
import { commands, type EstadoCuenta } from "@/bindings";
import { Suscripcion } from "./Suscripcion";

export const AccountSettings: React.FC = () => {
  const [estado, setEstado] = useState<EstadoCuenta | null>(null);
  const [cargando, setCargando] = useState(true);
  const [soltando, setSoltando] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    const r = await commands.accountState();
    if (r.status === "ok") setEstado(r.data);
    setCargando(false);
  }, []);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  // Si el servidor acaba de negar un dictado (fin de la prueba, por ejemplo), la app trae esta
  // pantalla al frente: que muestre el estado de ahora, no el de cuando se abrió.
  useEffect(() => {
    const unlisten = listen("dictado-sin-permiso", () => void recargar());
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [recargar]);

  const soltar = async (id: string, etiqueta: string) => {
    setSoltando(id);
    const r = await commands.authUnlinkDevice(id);
    setSoltando(null);
    if (r.status === "ok") {
      toast.success(`Se soltó ${etiqueta}`);
      void recargar();
    } else {
      toast.error("No se pudo soltar el equipo", {
        description: "Revisa tu conexión e inténtalo de nuevo.",
      });
    }
  };

  const salir = async () => {
    await commands.authSignOut();
    void recargar();
  };

  if (cargando) {
    return (
      <div className="max-w-2xl w-full mx-auto py-16 flex justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-brand-text-muted" />
      </div>
    );
  }

  if (!estado?.signed_in) {
    return (
      <div className="max-w-2xl w-full mx-auto flex flex-col gap-4 py-4">
        <h1 className="font-heading font-bold text-2xl">Mi cuenta</h1>
        <p className="text-brand-text-secondary">
          No has iniciado sesión.
        </p>
      </div>
    );
  }

  // Sesión válida pero sin poder hablar con el servidor. Se dice claro y sin alarmar: el médico
  // sigue dentro, solo que ahora no sabemos el estado exacto de su suscripción.
  if (estado.offline) {
    return (
      <div className="max-w-2xl w-full mx-auto flex flex-col gap-6 py-4">
        <div>
          <h1 className="font-heading font-bold text-2xl">Mi cuenta</h1>
          <p className="text-brand-text-secondary mt-1">{estado.email}</p>
        </div>
        <section className="rounded-2xl border border-brand-border bg-brand-surface p-5">
          <div className="font-heading font-semibold text-[15px]">
            Sin conexión con el servidor
          </div>
          <p className="text-sm text-brand-text-secondary mt-1 leading-relaxed">
            Tu sesión sigue abierta y puedes dictar sin conexión. Cuando vuelva el
            internet verás aquí tu suscripción y tus equipos.
          </p>
          <button
            onClick={() => {
              setCargando(true);
              void recargar();
            }}
            className="mt-3 text-sm font-semibold text-brand-accent hover:underline"
          >
            Reintentar
          </button>
        </section>
        <button
          onClick={() => void salir()}
          className="self-start inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-brand-text-secondary border border-brand-border hover:border-red-300 hover:text-red-600 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Cerrar sesión en este equipo
        </button>
      </div>
    );
  }

  const libres = estado.max_devices - estado.devices.length;

  return (
    <div className="max-w-2xl w-full mx-auto flex flex-col gap-6 py-4">
      <div>
        <h1 className="font-heading font-bold text-2xl">Mi cuenta</h1>
        <p className="text-brand-text-secondary mt-1">
          {estado.full_name ? `${estado.full_name} · ` : ""}
          {estado.email}
        </p>
      </div>

      <Suscripcion estado={estado} onEstado={setEstado} />

      <section className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-heading font-semibold text-[15px]">Tus equipos</h2>
          <span className="text-sm text-brand-text-muted">
            {estado.devices.length} de {estado.max_devices}
            {libres > 0 && ` · ${libres} libre${libres === 1 ? "" : "s"}`}
          </span>
        </div>

        <p className="text-sm text-brand-text-secondary leading-relaxed">
          Puedes usar CloseLabs Voice en {estado.max_devices} computadores. Si
          reinstalas en el mismo, no gasta un puesto.
        </p>

        <div className="flex flex-col gap-2 mt-1">
          {estado.devices.map((d) => {
            const Icono = d.platform === "windows" ? Monitor : Laptop;
            return (
              <div
                key={d.id}
                className="flex items-center gap-3 rounded-2xl border border-brand-border bg-white px-4 py-3"
              >
                <span className="grid place-items-center w-9 h-9 shrink-0 rounded-full bg-brand-accent-soft text-brand-accent">
                  <Icono className="w-4 h-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-heading font-medium text-[15px] truncate">
                    {d.label || "Equipo sin nombre"}
                    {d.is_this_device && (
                      <span className="ml-2 text-xs font-semibold text-brand-accent">
                        Este
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-brand-text-muted">
                    {d.platform === "windows" ? "Windows" : "Mac"}
                    {d.app_version ? ` · versión ${d.app_version}` : ""}
                  </div>
                </div>
                {/* El equipo actual no se puede soltar desde aquí: dejaría al médico sin dictar
                    en el computador que está usando, y sin forma obvia de deshacerlo. */}
                {!d.is_this_device && (
                  <button
                    onClick={() => void soltar(d.id, d.label || "el equipo")}
                    disabled={soltando === d.id}
                    className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-brand-text-secondary hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    {soltando === d.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                    Soltar
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <button
        onClick={() => void salir()}
        className="self-start inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-brand-text-secondary border border-brand-border hover:border-red-300 hover:text-red-600 transition-colors"
      >
        <LogOut className="w-4 h-4" />
        Cerrar sesión en este equipo
      </button>
    </div>
  );
};

export default AccountSettings;

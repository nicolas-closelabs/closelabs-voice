/* eslint-disable i18next/no-literal-string */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { listen } from "@tauri-apps/api/event";
import { commands, type EstadoCuenta, type Equipo } from "@/bindings";
import { Titulo, Apoyo } from "../../tinta/Titulo";
import { BotonPrincipal, BotonSecundario, Enlace } from "../../tinta/Botones";
import { Aviso, CLASE_CAMPO } from "../../tinta/Campos";
import { SettingsGroup } from "../../ui/SettingsGroup";
import { Renglon } from "../help/HelpSettings";
import { Suscripcion } from "./Suscripcion";
import { ZonaPeligrosa } from "./ZonaPeligrosa";

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
      toast.success(`Se quitó ${etiqueta}`);
      void recargar();
    } else {
      toast.error("No se pudo quitar el computador", {
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
      <div className="py-16 flex justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-tinta-3" />
      </div>
    );
  }

  if (!estado?.signed_in) {
    return (
      <div>
        <Titulo>Mi cuenta</Titulo>
        <Apoyo className="mt-2">No has iniciado sesión.</Apoyo>
      </div>
    );
  }

  const cerrarSesion = (
    <SettingsGroup title="Sesión">
      <Renglon nombre="Cerrar sesión" frase="Solo en este computador.">
        <BotonSecundario medida="corto" onClick={() => void salir()}>
          Cerrar sesión
        </BotonSecundario>
      </Renglon>
    </SettingsGroup>
  );

  // Sesión válida pero sin poder hablar con el servidor. Se dice claro y sin alarmar: el médico
  // sigue dentro, solo que ahora no sabemos el estado exacto de su suscripción.
  if (estado.offline) {
    return (
      <div>
        <Titulo>Mi cuenta</Titulo>
        <Apoyo className="mt-2">{estado.email}</Apoyo>
        <Aviso className="mt-6">
          <strong className="font-semibold">Sin conexión con el servidor.</strong>{" "}
          Tu sesión sigue abierta y puedes dictar. Cuando vuelva el internet verás
          aquí tu suscripción y tus computadores.{" "}
          <button
            className="font-semibold underline underline-offset-4"
            onClick={() => {
              setCargando(true);
              void recargar();
            }}
          >
            Reintentar
          </button>
        </Aviso>
        {cerrarSesion}
      </div>
    );
  }

  return (
    <div>
      <Titulo>Mi cuenta</Titulo>

      <SettingsGroup title="Tus datos">
        <Renglon nombre={estado.full_name || "Tu nombre"} frase={estado.email ?? ""}>
          <Enlace
            chico
            onClick={async () => {
              if (!estado.email) return;
              const r = await commands.authSendRecovery(estado.email);
              if (r.status === "ok")
                toast.success("Te enviamos un correo para cambiar la contraseña");
              else toast.error("No se pudo enviar el correo. Revisa tu conexión.");
            }}
          >
            Cambiar contraseña
          </Enlace>
        </Renglon>
      </SettingsGroup>

      <SettingsGroup title="Suscripción">
        <div className="py-3">
          <Suscripcion estado={estado} onEstado={setEstado} />
        </div>
      </SettingsGroup>

      <SettingsGroup
        title={`Computadores · ${estado.devices.length} de ${estado.max_devices}`}
      >
        {estado.devices.map((d) => (
          <Computador
            key={d.id}
            equipo={d}
            soltando={soltando === d.id}
            onSoltar={() =>
              void soltar(d.id, nombreDe(d) || "el computador")
            }
            onRenombrado={() => void recargar()}
          />
        ))}
      </SettingsGroup>

      {cerrarSesion}

      <div className="mt-10">
        <ZonaPeligrosa estado={estado} />
      </div>
    </div>
  );
};

/** Lo que se muestra de un computador: el nombre que le puso el médico, o el de red limpio. */
function nombreDe(d: Equipo): string {
  return d.nombre?.trim() || nombreLegible(d.label);
}

/**
 * Un computador de la cuenta, con el lapicito para renombrarlo (decisión de Nicolás, 2026-11-12:
 * por defecto el nombre de red limpio, y un lápiz para cambiarlo). Enter guarda, Esc cancela; vacío
 * vuelve al nombre de red.
 */
const Computador: React.FC<{
  equipo: Equipo;
  soltando: boolean;
  onSoltar: () => void;
  onRenombrado: () => void;
}> = ({ equipo, soltando, onSoltar, onRenombrado }) => {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState("");
  const [guardando, setGuardando] = useState(false);
  const campo = useRef<HTMLInputElement>(null);

  const empezar = () => {
    setValor(nombreDe(equipo));
    setEditando(true);
    setTimeout(() => campo.current?.select(), 0);
  };

  const guardar = async () => {
    setGuardando(true);
    const r = await commands.authRenameDevice(equipo.id, valor.trim().slice(0, 40));
    setGuardando(false);
    if (r.status === "ok") {
      setEditando(false);
      onRenombrado();
    } else {
      toast.error("No se pudo cambiar el nombre", {
        description: "Revisa tu conexión e inténtalo de nuevo.",
      });
    }
  };

  const sistema = equipo.platform === "windows" ? "Windows" : "Mac";
  const frase = equipo.is_this_device
    ? `Este computador · ${sistema}`
    : `${sistema}${equipo.last_seen_at ? ` · Último dictado: ${new Date(equipo.last_seen_at).toLocaleDateString("es", { day: "numeric", month: "long" })}` : ""}`;

  if (editando) {
    return (
      <form
        noValidate
        className="min-h-[66px] py-2 flex items-center gap-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          void guardar();
        }}
      >
        <input
          ref={campo}
          aria-label="Nombre del computador"
          value={valor}
          maxLength={40}
          onChange={(e) => setValor(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setEditando(false);
          }}
          className={`${CLASE_CAMPO} !h-[46px] w-[340px]`}
          disabled={guardando}
        />
        <BotonPrincipal type="submit" medida="corto" ocupado={guardando}>
          Guardar
        </BotonPrincipal>
        <Enlace chico onClick={() => setEditando(false)}>
          Cancelar
        </Enlace>
      </form>
    );
  }

  return (
    <Renglon
      nombre={
        <span className="inline-flex items-center gap-1.5">
          {nombreDe(equipo) || "Computador sin nombre"}
          <button
            type="button"
            aria-label="Cambiar el nombre"
            onClick={empezar}
            className="grid place-items-center w-[30px] h-[30px] rounded-[8px] border-[1.5px] border-linea-fuerte hover:bg-lino transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z"
                stroke="var(--tinta)"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </span>
      }
      frase={`${frase}${equipo.app_version ? ` · versión ${equipo.app_version}` : ""}`}
    >
      {/* El equipo actual no se puede soltar desde aquí: dejaría al médico sin dictar en el
          computador que está usando, y sin forma obvia de deshacerlo. */}
      {!equipo.is_this_device && (
        <Enlace chico onClick={onSoltar} disabled={soltando}>
          {soltando ? "Quitando…" : "Quitar"}
        </Enlace>
      )}
    </Renglon>
  );
};

/**
 * El nombre que guarda el equipo es el de red ("Nicolass-MacBook-Air-2.local"): se ve técnico y
 * con letras de más. Solo para mostrarlo se limpia; el guardado no se toca porque con él se
 * reconoce cuál es "este" equipo (`is_this_device` en `auth.rs`).
 */
function nombreLegible(label: string | null | undefined): string {
  const sin = (label ?? "").replace(/\.(local|lan)$/i, "").trim();
  // Los nombres de Windows todo en mayúsculas ("CONSULTORIO-PC") se dejan como están.
  if (sin && sin === sin.toUpperCase()) return sin;
  return sin.replace(/[-_]+/g, " ").trim();
}

export default AccountSettings;

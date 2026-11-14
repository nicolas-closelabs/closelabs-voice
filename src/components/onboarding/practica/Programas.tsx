/* eslint-disable i18next/no-literal-string */
import React from "react";
import "./programas.css";

/**
 * Los programas donde el médico practica: una historia clínica electrónica, un chat y una fórmula
 * médica, dibujados para que se parezcan a los que usa (sin marcas reales). Maqueta:
 * diseno/maquetas/practicas-v2.html. El campo de práctica (`campo`) es lo único vivo; el resto va
 * atenuado (`pp-m`).
 */

export type EstadoCampo = "toca" | "foco" | "hecho";

interface ProgramaProps {
  campo: React.ReactNode;
  /** Nombre de la cuenta (o vacío): va donde el programa muestra al médico. */
  medico: string;
  windows: boolean;
}

const hoyCorto = () =>
  new Date().toLocaleDateString("es", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
const hoyLargo = () =>
  new Date().toLocaleDateString("es", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

/** El cursor dibujado y "clic aquí", dentro del campo mientras falta el clic. */
export const SenalClic: React.FC = () => (
  <span className="pp-senal" aria-hidden>
    <svg width="22" height="26" viewBox="0 0 22 26" fill="none">
      <path
        d="M3 2v18l5-4.6 3.6 8 3.2-1.5-3.6-7.7H18L3 2z"
        fill="#fff"
        stroke="#18141D"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
    <span>clic aquí</span>
  </span>
);

export const HistoriaClinica: React.FC<ProgramaProps> = ({
  campo,
  medico,
  windows,
}) => (
  <div className={`pp ${windows ? "pp-win" : ""}`}>
    <div className="pp-hc-top pp-m">
      <span className="logo">HC</span>
      <b>Historia Clínica Electrónica</b>
      <nav>
        <span>Agenda</span>
        <span>Pacientes</span>
        <span className="on">Consulta</span>
        <span>Reportes</span>
      </nav>
      <span className="usr">{medico || "Mi usuario"} ▾</span>
      {windows && (
        <span className="ctl">
          <i>─</i>
          <i>☐</i>
          <i>✕</i>
        </span>
      )}
    </div>
    <div className="pp-hc-pac pp-m">
      <b>ROJAS PÉREZ, MARTA</b>
      <span>58 años · F</span>
      <span>CC 41.782.305</span>
      <span>Consulta externa · {hoyCorto()}</span>
      <span className="alg">Alergias: penicilina</span>
    </div>
    <div className="pp-hc-tabs pp-m">
      <span className="on">Anamnesis</span>
      <span>Examen físico</span>
      <span>Diagnóstico</span>
      <span>Plan</span>
      <span>Fórmulas</span>
      <span className="guardar">Guardar</span>
    </div>
    <div className="pp-hc-body">
      <div>
        <span className="lb">
          Motivo de consulta <i>*</i>
        </span>
        {campo}
        <span className="lb pp-m" style={{ marginTop: 7 }}>
          Enfermedad actual
        </span>
        <div className="pp-mudo pp-m" />
      </div>
      <div className="pp-sv pp-m">
        <h6>Signos vitales</h6>
        <div>
          <span>T. arterial</span>
          <span>138/86</span>
        </div>
        <div>
          <span>F. cardíaca</span>
          <span>76 lpm</span>
        </div>
        <div>
          <span>Temperatura</span>
          <span>36,5 °C</span>
        </div>
        <div>
          <span>Peso</span>
          <span>68 kg</span>
        </div>
        <div>
          <span>Talla</span>
          <span>1,58 m</span>
        </div>
      </div>
    </div>
  </div>
);

const Icono: React.FC<{ d: React.ReactNode; tam?: number }> = ({
  d,
  tam = 20,
}) => (
  <svg
    width={tam}
    height={tam}
    viewBox="0 0 24 24"
    fill="none"
    stroke="#54656F"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    {d}
  </svg>
);

const Vistos = () => (
  <svg
    width="16"
    height="11"
    viewBox="0 0 16 11"
    fill="none"
    stroke="#53BDEB"
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M1 6l3 3 6-7.5M6.5 8.2l.8.8 6-7.5" />
  </svg>
);

/** El chat: parecido a WhatsApp Web, sin su logo ni su nombre. */
export const Chat: React.FC<ProgramaProps> = ({ campo, windows }) => (
  <div className={`pp pp-wa ${windows ? "pp-win" : ""}`}>
    <div className="pp-wa-cab pp-m">
      <span className="av">JP</span>
      <span className="n">
        Jaime Pardo
        <small>en línea</small>
      </span>
      <span className="ic">
        <Icono
          d={
            <>
              <circle cx="11" cy="11" r="6.5" />
              <path d="M16 16l4.5 4.5" />
            </>
          }
        />
        <Icono
          d={
            <>
              <circle cx="12" cy="5" r="1" />
              <circle cx="12" cy="12" r="1" />
              <circle cx="12" cy="19" r="1" />
            </>
          }
        />
      </span>
    </div>
    <div className="pp-wa-chat">
      <span className="dia pp-m">HOY</span>
      <div className="b out pp-m">
        Don Jaime, ya le dejé la fórmula del losartán en la recepción.
        <small>
          3:40 p. m. <Vistos />
        </small>
      </div>
      <div className="b in pp-m">
        Muchas gracias. ¿La pastilla de la presión me la tomo antes o después de
        comer?
        <small>3:42 p. m.</small>
      </div>
    </div>
    <div className="pp-wa-bar">
      <span className="pp-m" style={{ display: "flex", gap: 14 }}>
        <Icono
          tam={24}
          d={
            <>
              <circle cx="12" cy="12" r="9" />
              <path d="M8.5 14.5c1.8 2.2 5.2 2.2 7 0" />
              <path d="M9 9.8v.4M15 9.8v.4" />
            </>
          }
        />
        <Icono tam={24} d={<path d="M12 5v14M5 12h14" />} />
      </span>
      {campo}
      <span className="pp-m">
        <Icono
          tam={24}
          d={
            <>
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5.5 11.5a6.5 6.5 0 0013 0M12 18v3" />
            </>
          }
        />
      </span>
    </div>
  </div>
);

export const Formula: React.FC<ProgramaProps> = ({
  campo,
  medico,
  windows,
}) => (
  <div className={`pp ${windows ? "pp-win" : ""}`}>
    <div className="pp-rx">
      <div className="pp-rx-cab pp-m">
        <div>
          <b>{medico || "Tu nombre"}</b>
          Registro médico ··········
        </div>
        <div className="der">
          <b>FÓRMULA MÉDICA</b>
          N.º 004182 · {hoyLargo()}
        </div>
      </div>
      <div className="pp-rx-pac pp-m">
        <span>
          Paciente: <b>Marta Rojas Pérez</b>
        </span>
        <span>CC 41.782.305</span>
        <span>58 años</span>
        <span>Dx: I10 Hipertensión esencial</span>
      </div>
      <table className="pp-m">
        <thead>
          <tr>
            <th style={{ width: "40%" }}>Medicamento</th>
            <th>Dosis</th>
            <th>Frecuencia</th>
            <th>Duración</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Hidroclorotiazida 25 mg, tabletas</td>
            <td>1 tableta</td>
            <td>Cada 24 horas</td>
            <td>30 días</td>
          </tr>
        </tbody>
      </table>
      <div className="pp-rx-rp">
        <span>Rp.</span>
        {campo}
      </div>
      <div className="pp-rx-firma pp-m">Firma y sello</div>
    </div>
  </div>
);

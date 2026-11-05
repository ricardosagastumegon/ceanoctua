import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { formatMoney } from '@/lib/money';

/**
 * Las piezas del tablero de quien no opera el sistema.
 *
 * Nacieron dentro de `GerenteView` --el tablero de quien firma-- y se sacaron
 * aqui al construir el de Tesoreria. Los dos tableros son para el mismo tipo
 * de persona: entra desde el telefono, a hacer UNA cosa, y se va. Una columna,
 * bloques grandes, contador a la vista y un vacio que se lea como respuesta
 * --«no tienes nada pendiente»-- y no como un error.
 *
 * Si se tocan estos componentes se tocan los dos tableros. Es a proposito:
 * que se vean distintos seria el defecto, no la gracia.
 */

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/**
 * Una fecha legible, o nada.
 *
 * Hay registros con el año mal tecleado --20266-- que ordenan al final de todo
 * y se leen como un error. Se tratan como si no tuvieran fecha en vez de
 * mostrar un disparate.
 */
export function dia(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return null;
  const a = d.getFullYear();
  if (a < 2000 || a > 2100) return null;
  return `${d.getDate()} ${MESES[d.getMonth()]}${a === new Date().getFullYear() ? '' : ` ${a}`}`;
}

/** Días desde (negativo) o hasta (positivo) una fecha. */
export function enDias(valor: string | null | undefined): number | null {
  if (!valor) return null;
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return null;
  const a = d.getFullYear();
  if (a < 2000 || a > 2100) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - hoy.getTime()) / 86_400_000);
}

export function saludo(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

export function money(n: number, moneda: string | null): string {
  if (!moneda || moneda === 'GTQ') return formatMoney(Number(n));
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: moneda }).format(Number(n));
}

/** La cabecera con el saludo. Es lo primero que se ve al entrar. */
export function Cabecera({ nombre, resumen }: { nombre?: string | null; resumen: string }) {
  return (
    <header
      className="rounded-card px-5 py-6 text-white shadow-sm sm:px-7"
      style={{ background: 'linear-gradient(135deg,#0d2b2e 0%,#077e84 55%,#00b4c5 100%)' }}
    >
      <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-white/60">
        CEA · Board Assistant
      </p>
      <h1 className="mt-1 font-heading text-2xl font-extrabold leading-tight sm:text-3xl">
        {saludo()}
        {nombre ? `, ${nombre.split(' ')[0]}` : ''}
      </h1>
      <p className="mt-1 text-sm text-white/80">{resumen}</p>
    </header>
  );
}

/** Bloque con encabezado, contador y lista. */
export function Bloque({
  titulo,
  bajada,
  icono,
  cuenta,
  color,
  verMas,
  cargando,
  vacio,
  children,
}: {
  titulo: string;
  bajada: string;
  icono: string;
  cuenta: number;
  color: string;
  /** A dónde lleva «Ver todas». Si no hay otra pantalla, se omite. */
  verMas?: string;
  cargando: boolean;
  vacio: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-card border border-sand bg-white p-4 shadow-sm sm:p-5">
      <header className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-heading text-base font-extrabold text-dark">
            {icono} {titulo}
          </h2>
          <p className="text-[11px] text-dark-3">{bajada}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className="font-heading text-2xl font-extrabold leading-none"
            style={{ color: cuenta > 0 ? color : '#9a8f86' }}
          >
            {cuenta}
          </span>
          {verMas && (
            <Link
              to={verMas}
              className="shrink-0 rounded-md border border-teal/40 px-2 py-1 text-[11px] font-extrabold text-teal-d hover:bg-teal-l"
            >
              Ver todas →
            </Link>
          )}
        </div>
      </header>

      {cargando ? (
        <p className="text-xs text-dark-3">Cargando…</p>
      ) : cuenta === 0 ? (
        <p className="text-sm italic text-dark-3">{vacio}</p>
      ) : (
        <ul className="space-y-1.5">{children}</ul>
      )}
    </section>
  );
}

/** Un renglón de cualquiera de las listas. */
export function Renglon({
  etiqueta,
  tono,
  titulo,
  detalle,
  cifra,
  pie,
  alerta,
  accion,
}: {
  etiqueta: string;
  tono: string;
  titulo: string;
  detalle: string;
  cifra: string | null;
  pie: string | null;
  alerta: boolean;
  accion?: ReactNode;
}) {
  return (
    <li className="rounded-md border border-sand bg-sand-l/30 px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ${tono}`}
        >
          {etiqueta}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-extrabold text-dark">{titulo}</span>
        {cifra && (
          <span className="shrink-0 font-mono text-sm font-extrabold text-dark">{cifra}</span>
        )}
      </div>
      {detalle && <p className="mt-0.5 line-clamp-2 text-[11px] text-dark-3">{detalle}</p>}
      <div className="mt-1 flex items-end justify-between gap-2">
        {pie ? (
          <p className={`text-[10px] ${alerta ? 'font-extrabold text-rust' : 'text-dark-3'}`}>
            {pie}
          </p>
        ) : (
          <span />
        )}
        {accion}
      </div>
    </li>
  );
}

/**
 * El botón grande de la acción principal.
 *
 * Grande a propósito: se usa desde el teléfono y con el pulgar. Es la acción
 * por la que esta persona entra a la aplicación.
 */
export function BotonPrincipal({
  onClick,
  children,
  disabled,
}: {
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="shrink-0 rounded-md bg-teal px-3 py-1.5 text-xs font-extrabold text-white shadow-sm hover:bg-teal-d disabled:opacity-50"
    >
      {children}
    </button>
  );
}

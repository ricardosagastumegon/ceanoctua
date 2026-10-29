import { PrintableModal } from '@/components/ui/PrintableModal';
import { SERVICE_META } from '../constants/serviceMeta';
import { fmtDate } from '../utils';
import type { RenglonPeriodo, TarjetaPeriodo } from '../viajes/liquidacion-periodo';
import logoColor from '../arriaza-logo-color.png';

const money = (v: number) => v.toFixed(2);

type Props = {
  open: boolean;
  onClose: () => void;
  tarjeta: TarjetaPeriodo;
  /** El color de la tarjeta en Admin. El bucket sin identificar no tiene. */
  color?: string | null;
  subtitulo?: string | null;
  desde: string;
  hasta: string;
};

/** Lo que una tarjeta movió en los viajes del período, renglón por renglón. */
export function EstadoCuentaTcModal({
  open,
  onClose,
  tarjeta,
  color,
  subtitulo,
  desde,
  hasta,
}: Props) {
  const tinte = color ?? '#1e2a4a';

  // Una tarjeta puede moverse en dos monedas en el mismo período. Sumarlas
  // seria mentir, asi que cada una lleva su propio total.
  const porMoneda = new Map<string, { cargos: number; reintegros: number; neto: number }>();
  for (const r of tarjeta.renglones) {
    const t = porMoneda.get(r.moneda) ?? { cargos: 0, reintegros: 0, neto: 0 };
    t.cargos += r.cargo;
    t.reintegros += r.reintegro;
    t.neto += r.neto;
    porMoneda.set(r.moneda, t);
  }

  const ordenados = [...tarjeta.renglones].sort((a, b) =>
    (a.fechaEfectiva ?? '').localeCompare(b.fechaEfectiva ?? ''),
  );

  return (
    <PrintableModal open={open} onClose={onClose} title={`Estado de cuenta · ${tarjeta.etiqueta}`}>
      <article style={{ fontFamily: 'Nunito, sans-serif', color: '#321201' }}>
        <header
          className="flex items-center justify-between px-8 py-5 text-white"
          style={{ background: `linear-gradient(135deg, ${tinte}dd, ${tinte})` }}
        >
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-[.2em] text-white/55">
              Estado de cuenta · Arriaza Tour &amp; Travel
            </div>
            <div className="font-heading text-2xl font-extrabold">{tarjeta.etiqueta}</div>
            {subtitulo && <div className="mt-0.5 text-[12px] text-white/75">{subtitulo}</div>}
            <div className="mt-1 text-[12px] text-white/75">
              {fmtDate(desde)} — {fmtDate(hasta)}
            </div>
          </div>
          <img
            src={logoColor}
            alt="Arriaza Tour &amp; Travel"
            style={{ height: '42px', filter: 'brightness(0) invert(1)' }}
          />
        </header>

        {ordenados.length === 0 ? (
          <p className="px-8 py-8 text-sm italic text-dark-3">
            Esta tarjeta no movió nada en el período.
          </p>
        ) : (
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr style={{ backgroundColor: '#eef1f6' }}>
                <Th>Fecha</Th>
                <Th>Viaje</Th>
                <Th>Servicio</Th>
                <Th className="text-right">Cargo</Th>
                <Th className="text-right">Reintegro</Th>
                <Th className="text-right">Neto</Th>
              </tr>
            </thead>
            <tbody>
              {ordenados.map((r, i) => (
                <Fila key={`${r.viajeId}-${r.nombre}-${i}`} r={r} />
              ))}
            </tbody>
          </table>
        )}

        <footer className="px-8 py-5 text-white" style={{ background: tinte }}>
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-white/70">
            {tarjeta.renglones.length} {tarjeta.renglones.length === 1 ? 'renglón' : 'renglones'} ·{' '}
            {tarjeta.viajes.length} viaje{tarjeta.viajes.length === 1 ? '' : 's'}
          </div>
          <div className="mt-1 space-y-0.5">
            {[...porMoneda.entries()].map(([m, t]) => (
              <div key={m} className="flex items-baseline justify-between">
                <span className="text-[11px] text-white/70">
                  Cargos {m} {money(t.cargos)}
                  {t.reintegros > 0 ? ` · reintegros ${m} ${money(t.reintegros)}` : ''}
                </span>
                <span className="font-heading text-xl font-extrabold">
                  {m} {money(t.neto)}
                </span>
              </div>
            ))}
          </div>
        </footer>

        <div
          className="px-8 py-2 text-center text-[10px] font-extrabold uppercase tracking-widest text-white/40"
          style={{ backgroundColor: tinte }}
        >
          Arriaza Tour &amp; Travel · Documento de uso interno
        </div>
      </article>
    </PrintableModal>
  );
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={`border-b border-sand px-3 py-2 text-left text-[10px] font-extrabold uppercase tracking-wider text-dark-2 ${className}`}
    >
      {children}
    </th>
  );
}

function Fila({ r }: { r: RenglonPeriodo }) {
  const meta = SERVICE_META[r.servicio];
  const cancelado = r.estadoPago === 'CANCELADO';
  return (
    <tr className="border-b border-sand/60">
      <td className="whitespace-nowrap px-3 py-1.5 text-dark-2">
        {r.fechaEfectiva ? fmtDate(r.fechaEfectiva) : '—'}
      </td>
      <td className="px-3 py-1.5">
        <span className="font-semibold text-dark">{r.viajeTitulo}</span>
        {r.viajeNo && <span className="ml-1 font-mono text-[10px] text-dark-3">{r.viajeNo}</span>}
      </td>
      <td className="px-3 py-1.5">
        <span style={{ color: meta.dark }}>{meta.icon}</span>{' '}
        <span className={cancelado ? 'text-dark-3 line-through' : 'text-dark'}>{r.nombre}</span>
        {r.esCargo && <span className="ml-1 text-[10px] text-dark-3">· cargo adicional</span>}
      </td>
      <td className="whitespace-nowrap px-3 py-1.5 text-right font-mono text-dark">
        {r.moneda} {money(r.cargo)}
      </td>
      <td
        className="whitespace-nowrap px-3 py-1.5 text-right font-mono"
        style={{ color: r.reintegro > 0 ? '#8f3406' : '#9a8f86' }}
      >
        {r.reintegro > 0 ? `− ${money(r.reintegro)}` : '—'}
      </td>
      <td className="whitespace-nowrap px-3 py-1.5 text-right font-mono font-extrabold text-dark">
        {money(r.neto)}
      </td>
    </tr>
  );
}

import { formatDate, formatDateTime } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import type { Database } from '@/types/database';

type Consumo = Database['public']['Tables']['tc_consumos']['Row'];
type Tarjeta = Database['public']['Tables']['tarjetas_credito']['Row'];

function fmt(n: number, currency: string): string {
  if (currency === 'GTQ') return formatMoney(n);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
}

type Props = {
  tarjeta: Tarjeta;
  consumos: Consumo[];
  /** Rango opcional. Si no se especifica usa los extremos de los consumos. */
  desde?: string;
  hasta?: string;
};

export function EstadoCuentaPrintable({ tarjeta, consumos, desde, hasta }: Props) {
  const tint = tarjeta.color ?? '#1e1b4b';

  // Totales por moneda
  const totalsByMoneda = new Map<string, number>();
  for (const c of consumos) {
    totalsByMoneda.set(c.moneda, (totalsByMoneda.get(c.moneda) ?? 0) + Number(c.monto));
  }

  // Rango automático
  const fechas = consumos.map((c) => c.fecha).sort();
  const rangoDesde = desde ?? fechas[0];
  const rangoHasta = hasta ?? fechas[fechas.length - 1];

  return (
    <article className="text-dark">
      {/* Header con gradient del color de la TC */}
      <header
        className="rounded-t-md p-6 text-white"
        style={{ background: `linear-gradient(135deg, ${tint}ee 0%, ${tint} 60%, ${tint}cc 100%)` }}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
          Estado de Cuenta · TC Corporativa
        </p>
        <h1 className="mt-2 font-heading text-2xl font-bold leading-tight">
          {tarjeta.empresa ?? 'Tarjeta Corporativa'}
        </h1>
        <p className="mt-1 font-mono text-sm text-white/90">{tarjeta.tc_id}</p>
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-white/80">
          {tarjeta.banco && <span>Banco: <strong>{tarjeta.banco}</strong></span>}
          {tarjeta.red && <span>Red: <strong>{tarjeta.red}</strong></span>}
          {tarjeta.limite && <span>Límite: <strong>{tarjeta.limite}</strong></span>}
        </div>
        {rangoDesde && rangoHasta && (
          <p className="mt-3 text-xs text-white/80">
            Período: <strong>{formatDate(rangoDesde)}</strong> → <strong>{formatDate(rangoHasta)}</strong>
          </p>
        )}
      </header>

      {/* KPIs */}
      <section className="grid grid-cols-3 gap-3 border-b border-sand bg-sand-l/40 px-6 py-4 text-center">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-dark-3">Consumos</p>
          <p className="mt-1 font-mono text-2xl font-bold text-dark">{consumos.length}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-dark-3">Reintegrados</p>
          <p className="mt-1 font-mono text-2xl font-bold text-teal-d">
            {consumos.filter((c) => c.reintegro_id !== null).length}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-dark-3">Pendientes</p>
          <p className="mt-1 font-mono text-2xl font-bold text-rust">
            {consumos.filter((c) => !c.reintegro_id !== null).length}
          </p>
        </div>
      </section>

      {/* Tabla de consumos */}
      <section className="px-6 py-4">
        {consumos.length === 0 ? (
          <p className="py-8 text-center text-sm text-dark-3">Sin consumos registrados.</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b-2 border-dark/20 text-left text-[10px] uppercase tracking-wider text-dark-3">
                <th className="py-2 pr-2">Voucher</th>
                <th className="py-2 pr-2">Fecha</th>
                <th className="py-2 pr-2">Proveedor</th>
                <th className="py-2 pr-2">Concepto</th>
                <th className="py-2 pr-2 text-right">Monto</th>
                <th className="py-2 pr-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {consumos.map((c) => (
                <tr key={c.id} className="border-b border-sand/60">
                  <td className="py-2 pr-2 font-mono text-[10px] text-dark-2">{c.voucher_num ?? '—'}</td>
                  <td className="py-2 pr-2">{formatDate(c.fecha)}</td>
                  <td className="py-2 pr-2 font-medium">{c.proveedor}</td>
                  <td className="py-2 pr-2 text-dark-2">
                    <span className="line-clamp-2">{c.concepto}</span>
                  </td>
                  <td className="py-2 pr-2 text-right font-mono font-semibold">
                    {fmt(Number(c.monto), c.moneda)}
                  </td>
                  <td className="py-2 pr-2 text-center">
                    {c.reintegro_id ? (
                      <span className="rounded-full bg-teal-l px-2 py-0.5 text-[9px] font-semibold text-teal-d">
                        Reintegrado
                      </span>
                    ) : (
                      <span className="rounded-full bg-rust-l px-2 py-0.5 text-[9px] font-semibold text-rust">
                        Pendiente
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              {Array.from(totalsByMoneda.entries()).map(([moneda, total]) => (
                <tr key={moneda} className="border-t-2 border-dark/30 font-bold">
                  <td colSpan={4} className="py-2 pr-2 text-right text-dark-2">
                    Total {moneda}
                  </td>
                  <td className="py-2 pr-2 text-right font-mono text-base">
                    {fmt(total, moneda)}
                  </td>
                  <td />
                </tr>
              ))}
            </tfoot>
          </table>
        )}
      </section>

      {/* Footer */}
      <footer
        className="border-t border-sand px-6 py-3 text-center text-[10px] text-white"
        style={{ background: `linear-gradient(135deg, ${tint} 0%, ${tint}cc 100%)` }}
      >
        CEA · Estado de Cuenta · {tarjeta.tc_id} · Generado {formatDateTime(new Date())}
      </footer>
    </article>
  );
}

import { formatDate, formatDateTime } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import type { LiqRow, Liquidacion } from './api';

function fmt(n: number, currency: string): string {
  if (currency === 'GTQ') return formatMoney(n);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
}

type Props = { liq: Liquidacion; rows: LiqRow[] };

export function LiquidacionPrintable({ liq, rows }: Props) {
  const total = rows.reduce((s, r) => s + Number(r.cantidad ?? 0) * Number(r.unitario ?? 0), 0);
  const vale = Number(liq.vale_monto ?? 0);
  const diff = total - vale;

  return (
    <article className="text-dark">
      <header
        className="rounded-t-md p-6 text-white"
        style={{ background: 'linear-gradient(135deg, #0d2b2e 0%, #077e84 50%, #00b4c5 100%)' }}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
          Liquidación de gastos · Caja chica
        </p>
        <h1 className="mt-2 font-heading text-2xl font-bold">{liq.motivo ?? 'Liquidación'}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {liq.serial && (
            <span className="rounded-full bg-white/15 px-3 py-1 font-mono text-xs font-semibold">
              {liq.serial}
            </span>
          )}
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
            {liq.estado}
          </span>
        </div>
      </header>

      {/* Meta */}
      <section className="grid grid-cols-2 gap-4 border-b border-sand bg-sand-l/40 px-6 py-4 text-sm sm:grid-cols-4">
        <Meta label="Fecha" value={formatDate(liq.fecha)} />
        <Meta label="Entidad" value={liq.entidad ?? '—'} />
        <Meta label="Forma de pago" value={liq.payment_method ?? '—'} />
        <Meta label="Moneda" value={liq.moneda} />
        <Meta label="Solicitado por" value={liq.solicitado ?? '—'} />
        <Meta label="Reintegrar a" value={liq.reintegrar_a ?? '—'} />
        {liq.producto && <Meta label="Producto / Servicio" value={liq.producto} />}
        {liq.vale_serial && <Meta label="Vale vinculado" value={liq.vale_serial} />}
      </section>

      {/* Rows */}
      <section className="px-6 py-4">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-dark-2">
          Detalle de compras
        </h2>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-sand bg-sand-l/50 text-[10px] uppercase tracking-wider text-dark-3">
              <th className="px-2 py-2 text-left">#</th>
              <th className="px-2 py-2 text-left">Fecha</th>
              <th className="px-2 py-2 text-left">Factura</th>
              <th className="px-2 py-2 text-left">Proveedor</th>
              <th className="px-2 py-2 text-left">Concepto</th>
              <th className="px-2 py-2 text-right">Cant</th>
              <th className="px-2 py-2 text-right">P. Unit</th>
              <th className="px-2 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-2 py-4 text-center text-xs text-dark-3">
                  Sin compras
                </td>
              </tr>
            ) : (
              rows.map((r, idx) => {
                const tot = Number(r.cantidad ?? 0) * Number(r.unitario ?? 0);
                return (
                  <tr key={r.id} className="border-b border-sand/60">
                    <td className="px-2 py-1.5 font-mono text-xs text-dark-3">{idx + 1}</td>
                    <td className="px-2 py-1.5">{r.fecha ? formatDate(r.fecha) : '—'}</td>
                    <td className="px-2 py-1.5 font-mono text-xs">{r.factura ?? '—'}</td>
                    <td className="px-2 py-1.5">{r.proveedor ?? '—'}</td>
                    <td className="px-2 py-1.5 text-xs">{r.concepto ?? '—'}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{Number(r.cantidad)}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{fmt(Number(r.unitario), liq.moneda)}</td>
                    <td className="px-2 py-1.5 text-right font-mono font-semibold">{fmt(tot, liq.moneda)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>

      {/* Totales */}
      <section className="grid grid-cols-3 gap-3 border-t border-sand px-6 py-4">
        <TotalBox label="Total compras" value={fmt(total, liq.moneda)} />
        <TotalBox label="Vale recibido" value={fmt(vale, liq.moneda)} />
        <TotalBox
          label="Diferencia"
          value={fmt(diff, liq.moneda)}
          tone={diff < 0 ? 'danger' : 'success'}
        />
      </section>

      {liq.comentarios && (
        <section className="border-t border-sand px-6 py-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-dark-3">Comentarios</p>
          <p className="whitespace-pre-line text-sm">{liq.comentarios}</p>
        </section>
      )}

      {/* Firmas */}
      <section className="grid grid-cols-2 gap-8 border-t border-sand px-6 py-8">
        <div className="text-center">
          <div className="mb-2 h-16 border-b-2 border-dark/40" />
          <p className="text-xs font-semibold uppercase tracking-wider text-dark-2">Elaborado por</p>
          <p className="mt-1 text-sm">Angeles Quezada</p>
        </div>
        <div className="text-center">
          <div className="mb-2 h-16 border-b-2 border-dark/40" />
          <p className="text-xs font-semibold uppercase tracking-wider text-dark-2">Autorizado por</p>
          <p className="mt-1 text-sm">{liq.solicitado ?? ''}</p>
        </div>
      </section>

      <footer className="border-t border-sand bg-sand-l px-6 py-3 text-center text-[10px] text-dark-3">
        Board Assistant · CC Board · Liquidación · {formatDateTime(new Date())}
      </footer>
    </article>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-dark-3">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
    </div>
  );
}

function TotalBox({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'success' | 'danger' }) {
  const toneClass =
    tone === 'danger' ? 'border-rust/40 bg-rust-l text-rust' : tone === 'success' ? 'border-teal/40 bg-teal-l/30 text-teal-d' : 'border-sand bg-sand-l/30 text-dark';
  return (
    <div className={`rounded-md border p-3 text-center ${toneClass}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70">{label}</p>
      <p className="mt-1 font-mono text-lg font-bold">{value}</p>
    </div>
  );
}

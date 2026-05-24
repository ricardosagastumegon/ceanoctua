import { formatDate, formatDateTime } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import type { Constancia } from './api';

function fmt(n: number, currency: string): string {
  if (currency === 'GTQ') return formatMoney(n);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
}

export function ConstanciaPrintable({ c }: { c: Constancia }) {
  const sub475 = Number(c.cant475) * Number(c.precio475);
  const sub1000 = Number(c.cant1000) * Number(c.precio1000);
  const envioCosto = c.envio ? Number(c.envio_costo ?? 0) : 0;

  return (
    <article className="text-dark">
      <header
        className="rounded-t-md p-6 text-center text-white"
        style={{ background: 'linear-gradient(135deg, #0a1f3d 0%, #102a52 100%)' }}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/70">
          Constancia de entrega
        </p>
        <h1 className="mt-2 font-heading text-3xl font-bold italic" style={{ fontFamily: 'Cormorant Garamond, Georgia, serif' }}>
          Miel Orgánica San Joaquín
        </h1>
        <p className="mt-1 text-2xl">🍯</p>
        {c.correlativo && (
          <span
            className="mt-3 inline-block rounded-full bg-white/15 px-4 py-1 font-mono text-sm font-semibold"
            style={{ color: '#f5b919' }}
          >
            {c.correlativo}
          </span>
        )}
        <p className="mt-2 text-xs text-white/70">
          Finca San Joaquín · Santa Lucía Milpas Altas
        </p>
      </header>

      {/* Meta */}
      <section className="grid grid-cols-3 gap-4 border-b border-sand bg-[#f9f7ed] px-6 py-4 text-sm">
        <Meta label="Fecha" value={formatDate(c.fecha)} />
        <Meta label="Destinatario" value={c.nombre} />
        <Meta label="Total general" value={fmt(Number(c.total), c.moneda)} highlight />
      </section>

      {/* Body */}
      <section className="space-y-4 px-6 py-5">
        {c.direccion && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-dark-3">
              🏠 Dirección de entrega
            </p>
            <p className="mt-1 whitespace-pre-line text-sm">{c.direccion}</p>
          </div>
        )}

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-dark/20 text-[11px] uppercase tracking-wider text-dark-3">
              <th className="py-2 text-left">Presentación</th>
              <th className="py-2 text-right">Cantidad</th>
              <th className="py-2 text-right">Precio unit.</th>
              <th className="py-2 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {Number(c.cant475) > 0 && (
              <tr className="border-b border-sand">
                <td className="py-2">Botella 475 ml</td>
                <td className="py-2 text-right font-mono">{Number(c.cant475)}</td>
                <td className="py-2 text-right font-mono">{fmt(Number(c.precio475), c.moneda)}</td>
                <td className="py-2 text-right font-mono font-semibold">{fmt(sub475, c.moneda)}</td>
              </tr>
            )}
            {Number(c.cant1000) > 0 && (
              <tr className="border-b border-sand">
                <td className="py-2">Litro 1000 ml</td>
                <td className="py-2 text-right font-mono">{Number(c.cant1000)}</td>
                <td className="py-2 text-right font-mono">{fmt(Number(c.precio1000), c.moneda)}</td>
                <td className="py-2 text-right font-mono font-semibold">{fmt(sub1000, c.moneda)}</td>
              </tr>
            )}
            {c.envio && envioCosto > 0 && (
              <tr className="border-b border-sand">
                <td className="py-2">🚚 Envío</td>
                <td className="py-2 text-right">—</td>
                <td className="py-2 text-right">—</td>
                <td className="py-2 text-right font-mono font-semibold">{fmt(envioCosto, c.moneda)}</td>
              </tr>
            )}
            <tr className="border-t-2 border-dark/40">
              <td colSpan={3} className="py-3 text-right text-sm font-bold uppercase tracking-wider">
                Total general
              </td>
              <td className="py-3 text-right font-mono text-lg font-bold" style={{ color: '#f5b919' }}>
                {fmt(Number(c.total), c.moneda)}
              </td>
            </tr>
          </tbody>
        </table>

        {c.envio && c.envio_dir && (
          <div className="rounded-md border border-sand bg-sand-l/40 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-dark-3">
              🚚 Dirección de envío
            </p>
            <p className="mt-1 whitespace-pre-line text-sm">{c.envio_dir}</p>
          </div>
        )}

        {c.notas && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-dark-3">Notas</p>
            <p className="mt-1 whitespace-pre-line text-sm">{c.notas}</p>
          </div>
        )}
      </section>

      {/* Firmas */}
      <section className="grid grid-cols-2 gap-8 border-t border-sand px-6 py-8">
        <div className="text-center">
          <div className="mb-2 h-16 border-b-2 border-dark/40" />
          <p className="text-xs font-semibold uppercase tracking-wider text-dark-2">
            Firma de quien entrega
          </p>
          {c.entregado && <p className="mt-1 text-sm">{c.entregado}</p>}
        </div>
        <div className="text-center">
          <div className="mb-2 h-16 border-b-2 border-dark/40" />
          <p className="text-xs font-semibold uppercase tracking-wider text-dark-2">
            Firma de quien recibe
          </p>
          {c.recibido && <p className="mt-1 text-sm">{c.recibido}</p>}
        </div>
      </section>

      <footer
        className="border-t border-sand px-6 py-3 text-center text-[10px] text-white"
        style={{ background: 'linear-gradient(135deg, #0a1f3d 0%, #102a52 100%)' }}
      >
        Miel Orgánica San Joaquín · Constancia de entrega · Finca San Joaquín · PBX 2386-6060<br />
        {formatDateTime(new Date())}
      </footer>
    </article>
  );
}

function Meta({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-dark-3">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold ${highlight ? 'text-[#f5b919]' : ''}`}>{value}</p>
    </div>
  );
}

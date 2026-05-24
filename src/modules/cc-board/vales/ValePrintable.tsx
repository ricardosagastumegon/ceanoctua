import { formatDate, formatDateTime } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import type { Vale } from './api';

function fmt(n: number, currency: string): string {
  if (currency === 'GTQ') return formatMoney(n);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
}

export function ValePrintable({ vale }: { vale: Vale }) {
  return (
    <article className="text-dark">
      {/* Header */}
      <header
        className="rounded-t-md p-6 text-white"
        style={{ background: 'linear-gradient(135deg, #0d2b2e 0%, #077e84 50%, #00b4c5 100%)' }}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
          Vale por Desembolso
        </p>
        <h1 className="mt-2 font-heading text-3xl font-bold">{vale.vale_a}</h1>
        <p className="mt-3 font-mono text-4xl font-bold" style={{ color: '#a0ffe8' }}>
          {fmt(Number(vale.monto), vale.moneda)}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {vale.serial && (
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-mono font-semibold">
              {vale.serial}
            </span>
          )}
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
            {vale.estado}
          </span>
        </div>
      </header>

      {/* Body */}
      <section className="space-y-4 px-6 py-6">
        {vale.concepto && (
          <Field label="Concepto" value={vale.concepto} />
        )}
        {vale.entidad && <Field label="Entidad a liquidar" value={vale.entidad} />}
        <div className="grid grid-cols-2 gap-4">
          {vale.lugar && <Field label="Lugar" value={vale.lugar} />}
          {vale.fecha && <Field label="Fecha" value={formatDate(vale.fecha)} />}
        </div>
        {vale.notas && <Field label="Notas" value={vale.notas} />}
      </section>

      {/* Firmas */}
      <section className="grid grid-cols-2 gap-8 border-t border-sand px-6 py-8">
        <SignatureBlock label="Firma del Solicitante" name={vale.vale_a} />
        <SignatureBlock label="Autorizado por" name="" />
      </section>

      {/* Footer */}
      <footer className="border-t border-sand bg-sand-l px-6 py-3 text-center text-[10px] text-dark-3">
        Board Assistant · CC Board · Vale por Desembolso ·{' '}
        {formatDateTime(new Date())}
      </footer>
    </article>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-sand bg-sand-l/40 px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-dark-3">{label}</p>
      <p className="mt-1 whitespace-pre-line text-sm text-dark">{value}</p>
    </div>
  );
}

function SignatureBlock({ label, name }: { label: string; name: string }) {
  return (
    <div className="text-center">
      <div className="mb-2 h-16 border-b-2 border-dark/40" />
      <p className="text-xs font-semibold uppercase tracking-wider text-dark-2">{label}</p>
      {name && <p className="mt-1 text-sm text-dark">{name}</p>}
    </div>
  );
}

import { formatDate, formatDateTime } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { PAGO_STEPS, type Pago } from './api';

function fmt(n: number, currency: string): string {
  if (currency === 'GTQ') return formatMoney(n);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
}

export function PagoPrintable({ pago }: { pago: Pago }) {
  const moneda = pago.moneda;
  const monto = Number(pago.monto);
  return (
    <article className="text-dark">
      <header
        className="rounded-t-md p-6 text-white"
        style={{ background: 'linear-gradient(135deg, #0d2b2e 0%, #077e84 60%, #00b4c5 100%)' }}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
          Solicitud de pago
        </p>
        <h1 className="mt-2 font-heading text-2xl font-bold">{pago.proveedor ?? '—'}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {pago.serial && (
            <span className="rounded-full bg-white/15 px-3 py-1 font-mono text-xs">{pago.serial}</span>
          )}
          {pago.tipo_label && (
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">{pago.tipo_label}</span>
          )}
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
            {pago.status}
          </span>
        </div>
        <p className="mt-3 font-mono text-3xl font-bold" style={{ color: '#a0ffe8' }}>
          {fmt(monto, moneda)}
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 border-b border-sand bg-sand-l/40 px-6 py-4 text-sm sm:grid-cols-3">
        <Field label="Fecha" value={formatDate(pago.fecha)} />
        {pago.entidad && <Field label="Entidad" value={pago.entidad} />}
        {pago.nit && <Field label="NIT" value={pago.nit} />}
        {pago.concepto && <Field label="Concepto" value={pago.concepto} />}
        {pago.referencia && <Field label="Referencia" value={pago.referencia} />}
        {pago.banco && <Field label="Banco" value={pago.banco} />}
        {pago.cotizacion != null && (
          <Field label="Tipo de cambio" value={String(pago.cotizacion)} />
        )}
        {pago.pct_anticipo != null && pago.pct_anticipo > 0 && (
          <Field label="% anticipo" value={`${pago.pct_anticipo}%`} />
        )}
      </section>

      <section className="px-6 py-4">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-dark-2">
          Flujo del pago
        </h2>
        {/* Timeline horizontal con línea conectora + círculos numerados + fechas */}
        <div className="relative">
          {/* Línea horizontal background */}
          <div className="absolute left-4 right-4 top-4 h-0.5 bg-sand" aria-hidden />
          {/* Línea progreso teal */}
          <div
            className="absolute left-4 top-4 h-0.5 bg-gradient-to-r from-teal to-teal-d"
            style={{
              width: pago.step_idx === 0 ? '0%' : `calc(${(pago.step_idx / (PAGO_STEPS.length - 1)) * 100}% - 1rem)`,
            }}
            aria-hidden
          />
          <ol className="relative grid grid-cols-6 gap-1 text-center">
            {PAGO_STEPS.map((label, i) => {
              const done = i < pago.step_idx;
              const active = i === pago.step_idx;
              const date = pago.step_dates?.[i];
              return (
                <li key={label} className="space-y-1.5">
                  <div
                    className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full border-2 text-[10px] font-bold ${
                      done
                        ? 'border-teal-d bg-teal text-white'
                        : active
                          ? 'border-teal-d bg-white text-teal-d ring-2 ring-teal-l'
                          : 'border-sand bg-sand-l text-dark-3'
                    }`}
                  >
                    {done ? '✓' : i + 1}
                  </div>
                  <p
                    className={`text-[10px] font-semibold uppercase tracking-wider leading-tight ${
                      active ? 'text-teal-d' : done ? 'text-dark-2' : 'text-dark-3'
                    }`}
                  >
                    {label}
                  </p>
                  {date ? (
                    <p className="font-mono text-[9px] text-dark-3">{date}</p>
                  ) : (
                    <p className="text-[9px] text-dark-3/40">—</p>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-8 border-t border-sand px-6 py-8">
        <Sig label="Solicitado" />
        <Sig label="Autorizado" />
      </section>

      <footer className="border-t border-sand bg-sand-l px-6 py-3 text-center text-[10px] text-dark-3">
        Board Assistant · Finanzas · Pago · {formatDateTime(new Date())}
      </footer>
    </article>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-dark-3">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
    </div>
  );
}
function Sig({ label, name = '' }: { label: string; name?: string }) {
  return (
    <div className="text-center">
      <div className="mb-2 h-16 border-b-2 border-dark/40" />
      <p className="text-xs font-semibold uppercase tracking-wider text-dark-2">{label}</p>
      {name && <p className="mt-1 text-sm">{name}</p>}
    </div>
  );
}

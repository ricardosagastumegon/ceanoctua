import { formatDate, formatDateTime } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import type { Consumo } from './api';

// Fase 17 · F-4 — vista imprimible del consumo TC corporativa.
// Mockup de referencia: reference/finanzas-mockups/image37.png e image23.png.
// Header púrpura-azul (distintivo de TC corporativas) en vez del teal
// que usan vales/liquidaciones/pagos.

function fmt(n: number, currency: string): string {
  if (currency === 'GTQ') return formatMoney(n);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
}

export function ConsumoPrintable({ consumo }: { consumo: Consumo }) {
  return (
    <article className="text-dark">
      {/* Header púrpura-azul */}
      <header
        className="rounded-t-md p-6 text-white"
        style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #2563a8 100%)' }}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
          CEA · TC Corporativas
        </p>
        <h1 className="mt-2 font-heading text-2xl font-bold leading-tight">
          {consumo.empresa ?? consumo.proveedor}
        </h1>
        <p className="mt-1 text-sm text-white/80">
          {consumo.proveedor}
          {consumo.empresa && consumo.empresa !== consumo.proveedor && (
            <span className="ml-2 text-xs text-white/60">· cargado a {consumo.empresa}</span>
          )}
        </p>
        <p className="mt-3 font-mono text-3xl font-bold tracking-tight" style={{ color: '#a5b4fc' }}>
          {fmt(Number(consumo.monto), consumo.moneda)}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {consumo.voucher_num && (
            <span className="rounded-full bg-white/15 px-3 py-1 font-mono text-xs font-semibold">
              {consumo.voucher_num}
            </span>
          )}
          <span className="rounded-full bg-white/15 px-3 py-1 font-mono text-xs">
            {consumo.card_id}
          </span>
        </div>
      </header>

      {/* Meta */}
      <section className="grid grid-cols-2 gap-3 border-b border-sand bg-sand-l/40 px-6 py-4 text-sm sm:grid-cols-4">
        <Meta label="Fecha" value={formatDate(consumo.fecha)} />
        <Meta label="Moneda" value={consumo.moneda} />
        {consumo.no_autorizacion && <Meta label="No. autorización" value={consumo.no_autorizacion} />}
        {consumo.solicitado_por && <Meta label="Solicitado por" value={consumo.solicitado_por} />}
        {consumo.pagado_por && <Meta label="Pagado por" value={consumo.pagado_por} />}
        {consumo.empresa_codigo && <Meta label="Código empresa" value={consumo.empresa_codigo} />}
      </section>

      {/* Concepto */}
      <section className="border-b border-sand px-6 py-4">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-dark-3">Concepto</p>
        <p className="whitespace-pre-line text-sm">{consumo.concepto}</p>
      </section>

      {/* Firmas */}
      <section className="grid grid-cols-2 gap-8 px-6 py-8">
        <Sig label="Solicitado por" name={consumo.solicitado_por ?? ''} />
        <Sig label="Autorizado por" name="" />
      </section>

      <footer
        className="border-t border-sand px-6 py-3 text-center text-[10px] text-white"
        style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 60%, #2563a8 100%)' }}
      >
        CEA · TC Corporativas · {consumo.voucher_num ?? '—'} · {formatDateTime(new Date())}
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

function Sig({ label, name = '' }: { label: string; name?: string }) {
  return (
    <div className="text-center">
      <div className="mb-2 h-16 border-b-2 border-dark/40" />
      <p className="text-xs font-semibold uppercase tracking-wider text-dark-2">{label}</p>
      {name && <p className="mt-1 text-sm">{name}</p>}
    </div>
  );
}

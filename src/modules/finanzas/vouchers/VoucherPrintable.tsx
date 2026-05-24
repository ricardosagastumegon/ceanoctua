import { formatDate, formatDateTime } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import type { Database } from '@/types/database';

type Voucher = Database['public']['Tables']['vouchers']['Row'];
type Consumo = Database['public']['Tables']['tc_consumos']['Row'];

function fmt(n: number, currency: string): string {
  if (currency === 'GTQ') return formatMoney(n);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
}

type Props = { voucher: Voucher; consumo?: Consumo | null };

export function VoucherPrintable({ voucher, consumo }: Props) {
  const moneda = voucher.moneda ?? consumo?.moneda ?? 'GTQ';
  const monto = Number(voucher.monto ?? consumo?.monto ?? 0);
  return (
    <article className="text-dark">
      <header
        className="rounded-t-md p-6 text-white"
        style={{ background: 'linear-gradient(135deg, #0d2b2e 0%, #077e84 60%, #00b4c5 100%)' }}
      >
        <div className="flex items-center justify-between">
          <p className="font-heading text-xl font-bold">CEA NOCTUA</p>
          {voucher.serial && (
            <span className="rounded-full bg-white/15 px-3 py-1 font-mono text-xs">
              {voucher.serial}
            </span>
          )}
        </div>
        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
          Voucher de pago
        </p>
        <p className="mt-1 font-mono text-3xl font-bold" style={{ color: '#a0ffe8' }}>
          {fmt(monto, moneda)}
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 px-6 py-5 text-sm">
        <Field label="Fecha de pago" value={formatDate(voucher.fecha)} />
        <Field label="Estado" value={voucher.estado ?? '—'} />
        {voucher.pagado_por && <Field label="Pagado por" value={voucher.pagado_por} />}
        {voucher.concepto && <Field label="Concepto" value={voucher.concepto} />}
        {consumo?.voucher_num && (
          <Field label="Voucher consumo" value={consumo.voucher_num} />
        )}
        {consumo?.proveedor && <Field label="Proveedor" value={consumo.proveedor} />}
        {consumo?.card_id && <Field label="Tarjeta" value={consumo.card_id} />}
        {voucher.notas && <Field label="Notas" value={voucher.notas} />}
      </section>

      <section className="border-t border-sand px-6 py-6 text-center">
        <div className="mx-auto mb-2 h-16 max-w-xs border-b-2 border-dark/40" />
        <p className="text-xs font-semibold uppercase tracking-wider text-dark-2">
          Autorizado por
        </p>
      </section>

      <footer className="border-t border-sand bg-sand-l px-6 py-3 text-center text-[10px] text-dark-3">
        Board Assistant · Finanzas · Voucher · {formatDateTime(new Date())}
      </footer>
    </article>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-sand bg-sand-l/40 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-dark-3">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
    </div>
  );
}

import { useState } from 'react';
import { CatalogPage } from '@/modules/admin/components/CatalogPage';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { PrintableModal } from '@/components/ui/PrintableModal';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { useCreateVoucher, useDeleteVoucher, useUpdateVoucher, useVouchers } from './hooks';
import { useConsumos } from '../consumos/hooks';
import type { Voucher } from './api';
import type { Consumo } from '../consumos/api';
import { VoucherForm } from './VoucherForm';
import { VoucherPrintable } from './VoucherPrintable';

function fmt(n: number | null, currency: string | null): string {
  if (n == null) return '—';
  if (currency === 'GTQ') return formatMoney(Number(n));
  if (currency) return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(n));
  return String(n);
}

export function VouchersSection({ canEdit }: { canEdit: boolean }) {
  const query = useVouchers();
  const consumosQ = useConsumos();
  const create = useCreateVoucher();
  const update = useUpdateVoucher();
  const remove = useDeleteVoucher();
  const [viewing, setViewing] = useState<Voucher | null>(null);

  const consumoById = new Map<string, Consumo>();
  for (const c of consumosQ.data ?? []) consumoById.set(c.id, c);

  const columns: DataTableColumn<Voucher>[] = [
    { key: 'serial', header: 'Serial', sortable: true, accessor: (r) => r.serial, render: (r) => <span className="font-mono text-xs text-teal-d">{r.serial ?? '—'}</span> },
    { key: 'fecha', header: 'Fecha', sortable: true, accessor: (r) => r.fecha, render: (r) => formatDate(r.fecha) },
    { key: 'pagado_por', header: 'Pagado por', sortable: true, accessor: (r) => r.pagado_por, render: (r) => r.pagado_por ?? '—' },
    { key: 'consumo', header: 'Consumo', render: (r) => (r.consumo_id ? <span className="text-xs text-teal-d">✓</span> : <span className="text-xs text-rust">faltante</span>) },
    { key: 'concepto', header: 'Concepto', accessor: (r) => r.concepto, render: (r) => <span className="line-clamp-1 block max-w-md">{r.concepto ?? '—'}</span> },
    { key: 'monto', header: 'Monto', sortable: true, accessor: (r) => Number(r.monto ?? 0), render: (r) => <span className="font-mono font-semibold">{fmt(r.monto, r.moneda)}</span> },
  ];

  return (
    <>
      <CatalogPage<Voucher, import('./api').VoucherInsert>
        title="Vouchers"
        description="Comprobantes de pago enlazados a consumos de TC."
        newLabel="+ Nuevo voucher"
        modalSize="lg"
        columns={columns}
        rows={query.data ?? []}
        loading={query.isLoading}
        isError={query.isError}
        error={query.error}
        onRetry={() => void query.refetch()}
        onCreate={(values) => create.mutateAsync(values)}
        onUpdate={(id, patch) => update.mutateAsync({ id, patch })}
        onDelete={(id) => remove.mutateAsync(id)}
        submitting={create.isPending || update.isPending}
        Form={VoucherForm}
        rowLabel={(r) => r.serial ?? r.pagado_por ?? r.fecha}
        canEdit={canEdit}
        extraActions={(row) => (
          <button
            type="button"
            onClick={() => setViewing(row)}
            className="rounded-md border border-teal/40 px-2 py-1 text-xs font-semibold text-teal-d hover:bg-teal-l"
            title="Ver PDF"
          >
            👁
          </button>
        )}
      />

      <PrintableModal
        open={viewing !== null}
        onClose={() => setViewing(null)}
        title={viewing?.serial ?? 'Voucher'}
      >
        {viewing && (
          <VoucherPrintable
            voucher={viewing}
            consumo={viewing.consumo_id ? consumoById.get(viewing.consumo_id) ?? null : null}
          />
        )}
      </PrintableModal>
    </>
  );
}

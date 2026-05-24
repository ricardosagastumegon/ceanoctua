import { CatalogPage } from '@/modules/admin/components/CatalogPage';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { useCreateVoucher, useDeleteVoucher, useUpdateVoucher, useVouchers } from './hooks';
import type { Voucher } from './api';
import { VoucherForm } from './VoucherForm';

function fmt(n: number | null, currency: string | null): string {
  if (n == null) return '—';
  if (currency === 'GTQ') return formatMoney(Number(n));
  if (currency) return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(n));
  return String(n);
}

export function VouchersSection({ canEdit }: { canEdit: boolean }) {
  const query = useVouchers();
  const create = useCreateVoucher();
  const update = useUpdateVoucher();
  const remove = useDeleteVoucher();

  const columns: DataTableColumn<Voucher>[] = [
    { key: 'fecha', header: 'Fecha', sortable: true, accessor: (r) => r.fecha, render: (r) => formatDate(r.fecha) },
    { key: 'pagado_por', header: 'Pagado por', sortable: true, accessor: (r) => r.pagado_por, render: (r) => r.pagado_por ?? '—' },
    { key: 'consumo', header: 'Consumo', render: (r) => (r.consumo_id ? <span className="text-xs text-teal-d">✓</span> : <span className="text-xs text-rust">faltante</span>) },
    { key: 'concepto', header: 'Concepto', accessor: (r) => r.concepto, render: (r) => <span className="line-clamp-1 block max-w-md">{r.concepto ?? '—'}</span> },
    { key: 'monto', header: 'Monto', sortable: true, accessor: (r) => Number(r.monto ?? 0), render: (r) => <span className="font-mono font-semibold">{fmt(r.monto, r.moneda)}</span> },
  ];

  return (
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
      rowLabel={(r) => r.pagado_por ?? r.fecha}
      canEdit={canEdit}
    />
  );
}

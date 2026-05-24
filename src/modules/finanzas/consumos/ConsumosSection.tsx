import { CatalogPage } from '@/modules/admin/components/CatalogPage';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { useConsumos, useCreateConsumo, useDeleteConsumo, useUpdateConsumo } from './hooks';
import type { Consumo } from './api';
import { ConsumoForm } from './ConsumoForm';

function fmt(n: number, currency: string): string {
  if (currency === 'GTQ') return formatMoney(Number(n));
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(n));
}

export function ConsumosSection({ canEdit }: { canEdit: boolean }) {
  const query = useConsumos();
  const create = useCreateConsumo();
  const update = useUpdateConsumo();
  const remove = useDeleteConsumo();

  const columns: DataTableColumn<Consumo>[] = [
    { key: 'voucher_num', header: 'Voucher', sortable: true, accessor: (r) => r.voucher_num, render: (r) => <span className="font-mono text-dark">{r.voucher_num ?? '—'}</span> },
    { key: 'fecha', header: 'Fecha', sortable: true, accessor: (r) => r.fecha, render: (r) => formatDate(r.fecha) },
    { key: 'card_id', header: 'Tarjeta', sortable: true, accessor: (r) => r.card_id, render: (r) => <span className="font-mono text-dark-2">{r.card_id}</span> },
    { key: 'proveedor', header: 'Proveedor', sortable: true, accessor: (r) => r.proveedor, render: (r) => <span className="font-medium text-dark">{r.proveedor}</span> },
    { key: 'concepto', header: 'Concepto', accessor: (r) => r.concepto, render: (r) => <span className="line-clamp-1 block max-w-md">{r.concepto}</span> },
    { key: 'monto', header: 'Monto', sortable: true, accessor: (r) => Number(r.monto), render: (r) => <span className="font-mono font-semibold text-dark">{fmt(Number(r.monto), r.moneda)}</span> },
    {
      key: 'reintegro',
      header: 'Reintegro',
      render: (r) => (r.reintegro_id ? <span className="text-xs text-teal-d">✓ enlazado</span> : <span className="text-xs text-dark-3">—</span>),
    },
  ];

  return (
    <CatalogPage<Consumo, import('./api').ConsumoInsert>
      title="Consumos de tarjeta de crédito"
      description="Cada consumo genera un voucher serial automáticamente."
      newLabel="+ Nuevo consumo"
      modalSize="xl"
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
      Form={ConsumoForm}
      rowLabel={(r) => r.voucher_num ?? r.proveedor}
      canEdit={canEdit}
    />
  );
}

import { CatalogPage } from '@/modules/admin/components/CatalogPage';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { useCreateLiquidacion, useDeleteLiquidacion, useLiquidaciones, useUpdateLiquidacion } from './hooks';
import type { Liquidacion } from './api';
import { LiquidacionForm } from './LiquidacionForm';

function fmt(n: number, currency: string): string {
  if (currency === 'GTQ') return formatMoney(Number(n));
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(n));
}

export function LiquidacionesSection({ canEdit }: { canEdit: boolean }) {
  const query = useLiquidaciones();
  const create = useCreateLiquidacion();
  const update = useUpdateLiquidacion();
  const remove = useDeleteLiquidacion();

  const columns: DataTableColumn<Liquidacion>[] = [
    { key: 'fecha', header: 'Fecha', sortable: true, accessor: (r) => r.fecha, render: (r) => formatDate(r.fecha) },
    { key: 'periodo', header: 'Período', sortable: true, accessor: (r) => r.periodo, render: (r) => r.periodo ?? '—' },
    { key: 'responsable', header: 'Responsable', accessor: (r) => r.responsable, render: (r) => r.responsable ?? '—' },
    {
      key: 'estado',
      header: 'Estado',
      sortable: true,
      accessor: (r) => r.estado,
      render: (r) => <span className="inline-flex rounded-full bg-sand-l px-2 py-0.5 text-xs font-semibold text-dark-2">{r.estado}</span>,
    },
    { key: 'monto_total', header: 'Total', accessor: (r) => Number(r.monto_total), render: (r) => <span className="font-mono font-semibold">{fmt(Number(r.monto_total), r.moneda)}</span> },
  ];

  return (
    <CatalogPage<Liquidacion, import('./api').LiquidacionInsert>
      title="Liquidaciones de caja chica"
      description="Agrupa vales asignados. El total se recalcula automáticamente."
      newLabel="+ Nueva liquidación"
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
      Form={LiquidacionForm}
      rowLabel={(r) => r.periodo ?? r.fecha}
      canEdit={canEdit}
    />
  );
}

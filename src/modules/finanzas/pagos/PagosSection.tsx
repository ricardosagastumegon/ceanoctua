import { CatalogPage } from '@/modules/admin/components/CatalogPage';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { useCreatePago, useDeletePago, usePagos, useUpdatePago } from './hooks';
import type { Pago } from './api';
import { PagoForm } from './PagoForm';

function fmt(n: number, currency: string): string {
  if (currency === 'GTQ') return formatMoney(Number(n));
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(n));
}

const estadoBg: Record<Pago['estado'], string> = {
  Programado: 'bg-sand text-dark',
  Aprobado: 'bg-blue-light text-blue',
  Pagado: 'bg-teal-l text-teal-d',
  Conciliado: 'bg-teal text-white',
  Anulado: 'bg-rust-l text-rust',
  Devuelto: 'bg-rust text-white',
};

export function PagosSection({ canEdit }: { canEdit: boolean }) {
  const query = usePagos();
  const create = useCreatePago();
  const update = useUpdatePago();
  const remove = useDeletePago();

  const columns: DataTableColumn<Pago>[] = [
    { key: 'fecha', header: 'Fecha', sortable: true, accessor: (r) => r.fecha, render: (r) => formatDate(r.fecha) },
    {
      key: 'tipo',
      header: 'Tipo',
      sortable: true,
      accessor: (r) => (r.consumo_id ? 'TC-Reintegro' : r.tipo),
      render: (r) => <span className="text-dark-2">{r.consumo_id ? 'TC-Reintegro' : r.tipo}</span>,
    },
    { key: 'proveedor', header: 'Proveedor', sortable: true, accessor: (r) => r.proveedor, render: (r) => <span className="font-medium text-dark">{r.proveedor ?? '—'}</span> },
    { key: 'concepto', header: 'Concepto', accessor: (r) => r.concepto, render: (r) => <span className="line-clamp-1 block max-w-md">{r.concepto ?? '—'}</span> },
    { key: 'monto', header: 'Monto', sortable: true, accessor: (r) => Number(r.monto), render: (r) => <span className="font-mono font-semibold">{fmt(Number(r.monto), r.moneda)}</span> },
    {
      key: 'estado',
      header: 'Estado',
      sortable: true,
      accessor: (r) => r.estado,
      render: (r) => <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${estadoBg[r.estado]}`}>{r.estado}</span>,
    },
  ];

  return (
    <CatalogPage<Pago, import('./api').PagoInsert>
      title="Pagos"
      description="Pagos a proveedores. Pueden enlazarse a un consumo de TC (TC-Reintegro)."
      newLabel="+ Nuevo pago"
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
      Form={PagoForm}
      rowLabel={(r) => `${r.proveedor ?? ''} · ${r.monto} ${r.moneda}`}
      canEdit={canEdit}
    />
  );
}

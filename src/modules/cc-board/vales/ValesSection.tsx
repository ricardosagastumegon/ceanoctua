import { CatalogPage } from '@/modules/admin/components/CatalogPage';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import type { Vale } from './api';
import { ValeForm } from './ValeForm';
import { useCreateVale, useDeleteVale, useUpdateVale, useVales } from './hooks';

function fmtMoney(n: number, currency: string): string {
  if (currency === 'GTQ') return formatMoney(Number(n));
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(n));
}

const statusLabel: Record<Vale['estado'], string> = {
  Creado: 'Creado',
  Aprobado: 'Aprobado',
  EnLiquidacion: 'En liquidación',
  Liquidado: 'Liquidado',
  Pagado: 'Pagado',
  Reintegrado: 'Reintegrado',
  Cancelado: 'Cancelado',
  Anulado: 'Anulado',
};
const statusBg: Record<Vale['estado'], string> = {
  Creado: 'bg-sand text-dark',
  Aprobado: 'bg-blue-light text-blue',
  EnLiquidacion: 'bg-gold-light text-gold',
  Liquidado: 'bg-teal-l text-teal-d',
  Pagado: 'bg-teal text-white',
  Reintegrado: 'bg-purple text-white',
  Cancelado: 'bg-rust-l text-rust',
  Anulado: 'bg-rust text-white',
};

export function ValesSection({ canEdit }: { canEdit: boolean }) {
  const query = useVales();
  const create = useCreateVale();
  const update = useUpdateVale();
  const remove = useDeleteVale();

  const columns: DataTableColumn<Vale>[] = [
    { key: 'serial', header: 'Serial', sortable: true, accessor: (r) => r.serial, render: (r) => <span className="font-mono text-dark">{r.serial ?? '—'}</span> },
    { key: 'fecha', header: 'Fecha', sortable: true, accessor: (r) => r.fecha, render: (r) => (r.fecha ? formatDate(r.fecha) : '—') },
    { key: 'vale_a', header: 'Vale a', sortable: true, accessor: (r) => r.vale_a, render: (r) => <span className="font-medium text-dark">{r.vale_a}</span> },
    { key: 'concepto', header: 'Concepto', accessor: (r) => r.concepto, render: (r) => <span className="line-clamp-1 block max-w-md">{r.concepto ?? '—'}</span> },
    { key: 'monto', header: 'Monto', sortable: true, accessor: (r) => Number(r.monto), render: (r) => <span className="font-mono font-semibold text-dark">{fmtMoney(Number(r.monto), r.moneda)}</span> },
    {
      key: 'estado',
      header: 'Estado',
      sortable: true,
      accessor: (r) => r.estado,
      render: (r) => <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusBg[r.estado]}`}>{statusLabel[r.estado]}</span>,
    },
  ];

  return (
    <CatalogPage<Vale, import('./api').ValeInsert>
      title="Vales de caja chica"
      description="Vales individuales. Asignar uno a una liquidación cambia su estado automáticamente."
      newLabel="+ Nuevo vale"
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
      Form={ValeForm}
      rowLabel={(r) => r.serial ?? r.vale_a}
      canEdit={canEdit}
    />
  );
}

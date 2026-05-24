import { CatalogPage } from '@/modules/admin/components/CatalogPage';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { useCreateReintegro, useDeleteReintegro, useReintegros, useUpdateReintegro } from './hooks';
import type { Reintegro } from './api';
import { ReintegroForm } from './ReintegroForm';

function fmt(n: number, currency: string): string {
  if (currency === 'GTQ') return formatMoney(Number(n));
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(n));
}

const statusBg: Record<Reintegro['estado'], string> = {
  generada: 'bg-sand text-dark',
  firmada: 'bg-blue-light text-blue',
  presentada: 'bg-gold-light text-gold',
  procesada: 'bg-teal-l text-teal-d',
  reintegrada: 'bg-teal text-white',
};

export function ReintegrosSection({ canEdit }: { canEdit: boolean }) {
  const query = useReintegros();
  const create = useCreateReintegro();
  const update = useUpdateReintegro();
  const remove = useDeleteReintegro();

  const columns: DataTableColumn<Reintegro>[] = [
    { key: 'fecha', header: 'Fecha', sortable: true, accessor: (r) => r.fecha, render: (r) => formatDate(r.fecha) },
    { key: 'empresa', header: 'Empresa', sortable: true, accessor: (r) => r.empresa, render: (r) => <span className="font-medium text-dark">{r.empresa}</span> },
    { key: 'card_id', header: 'Tarjeta', accessor: (r) => r.card_id, render: (r) => <span className="font-mono text-dark-2">{r.card_id}</span> },
    { key: 'consumo', header: 'Consumo', render: (r) => (r.consumo_id ? <span className="text-xs text-teal-d">✓</span> : <span className="text-xs text-dark-3">—</span>) },
    { key: 'monto', header: 'Monto', sortable: true, accessor: (r) => Number(r.monto), render: (r) => <span className="font-mono font-semibold">{fmt(Number(r.monto), r.moneda)}</span> },
    {
      key: 'estado',
      header: 'Estado',
      sortable: true,
      accessor: (r) => r.estado,
      render: (r) => <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusBg[r.estado]}`}>{r.estado}</span>,
    },
  ];

  return (
    <CatalogPage<Reintegro, import('./api').ReintegroInsert>
      title="Reintegros"
      description="Reembolsos enlazados a consumos de TC."
      newLabel="+ Nuevo reintegro"
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
      Form={ReintegroForm}
      rowLabel={(r) => `${r.empresa} · ${r.monto} ${r.moneda}`}
      canEdit={canEdit}
    />
  );
}

import { CatalogPage } from '@/modules/admin/components/CatalogPage';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { formatDate } from '@/lib/dates';
import { useCreateRestaurante, useDeleteRestaurante, useRestaurantes, useUpdateRestaurante } from './hooks';
import type { AttRestaurante } from './api';
import { RestauranteForm } from './RestauranteForm';

function fmtMoney(n: number | null, currency: string | null): string {
  if (n == null) return '—';
  if (currency) return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(n));
  return String(n);
}

export function RestaurantesSection({ viajeId, canEdit }: { viajeId: string; canEdit: boolean }) {
  const query = useRestaurantes(viajeId);
  const create = useCreateRestaurante(viajeId);
  const update = useUpdateRestaurante(viajeId);
  const remove = useDeleteRestaurante(viajeId);

  const columns: DataTableColumn<AttRestaurante>[] = [
    {
      key: 'nombre',
      header: 'Restaurante',
      sortable: true,
      accessor: (r) => r.nombre,
      render: (r) => (
        <span className="font-medium text-dark">
          {r.nombre}
          {r.stars != null && r.stars > 0 && (
            <span className="ml-2 text-gold">{'★'.repeat(Math.min(r.stars, 3))}</span>
          )}
        </span>
      ),
    },
    { key: 'specialty', header: 'Especialidad', accessor: (r) => r.specialty, render: (r) => r.specialty ?? '—' },
    {
      key: 'cuando',
      header: 'Cuándo',
      sortable: true,
      accessor: (r) => r.fecha,
      render: (r) => (
        <span>
          {r.fecha ? formatDate(r.fecha) : '—'}
          {r.hora && <span className="ml-1 text-xs text-dark-3">{r.hora.slice(0, 5)}</span>}
        </span>
      ),
    },
    { key: 'covers', header: 'Pax', accessor: (r) => r.covers, render: (r) => (r.covers != null ? String(r.covers) : '—') },
    { key: 'total', header: 'Total', render: (r) => <span className="font-mono">{fmtMoney(r.monto, r.moneda)}</span> },
  ];

  return (
    <CatalogPage<AttRestaurante, import('./api').AttRestauranteInsert>
      title="Restaurantes"
      description="Reservas de comidas durante el viaje."
      newLabel="+ Nuevo restaurante"
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
      Form={RestauranteForm}
      rowLabel={(r) => r.nombre}
      canEdit={canEdit}
    />
  );
}

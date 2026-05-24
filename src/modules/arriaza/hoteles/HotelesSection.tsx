import { CatalogPage } from '@/modules/admin/components/CatalogPage';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { formatDate } from '@/lib/dates';
import { useCreateHotel, useDeleteHotel, useHoteles, useUpdateHotel } from './hooks';
import type { AttHotel } from './api';
import { HotelForm } from './HotelForm';

function fmtMoney(n: number | null, currency: string | null): string {
  if (n == null) return '—';
  if (currency) return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(n));
  return String(n);
}

export function HotelesSection({ viajeId, canEdit }: { viajeId: string; canEdit: boolean }) {
  const query = useHoteles(viajeId);
  const create = useCreateHotel(viajeId);
  const update = useUpdateHotel(viajeId);
  const remove = useDeleteHotel(viajeId);

  const columns: DataTableColumn<AttHotel>[] = [
    { key: 'nombre', header: 'Hotel', sortable: true, accessor: (r) => r.nombre, render: (r) => <span className="font-medium text-dark">{r.nombre}</span> },
    { key: 'location', header: 'Ubicación', accessor: (r) => r.location, render: (r) => r.location ?? '—' },
    {
      key: 'fechas',
      header: 'Estancia',
      sortable: true,
      accessor: (r) => r.checkin,
      render: (r) => (
        <span>
          {r.checkin ? formatDate(r.checkin) : '?'} <span className="text-dark-3">→</span> {r.checkout ? formatDate(r.checkout) : '?'}
          {r.nights != null && <span className="ml-1 text-xs text-dark-3">({r.nights}n)</span>}
        </span>
      ),
    },
    { key: 'confirmacion', header: 'Conf.', accessor: (r) => r.confirmacion, render: (r) => r.confirmacion ?? '—' },
    { key: 'total', header: 'Total', render: (r) => <span className="font-mono">{fmtMoney(r.monto, r.moneda)}</span> },
  ];

  return (
    <CatalogPage<AttHotel, import('./api').AttHotelInsert>
      title="Hoteles"
      description="Reservas de hospedaje del viaje."
      newLabel="+ Nuevo hotel"
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
      Form={HotelForm}
      rowLabel={(r) => r.nombre}
      canEdit={canEdit}
    />
  );
}

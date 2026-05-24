import { CatalogPage } from '@/modules/admin/components/CatalogPage';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { formatDateTime } from '@/lib/dates';
import { useCreateTicket, useDeleteTicket, useTickets, useUpdateTicket } from './hooks';
import type { AttTicket } from './api';
import { TicketForm } from './TicketForm';

export function TicketsSection({ viajeId, canEdit }: { viajeId: string; canEdit: boolean }) {
  const query = useTickets(viajeId);
  const create = useCreateTicket(viajeId);
  const update = useUpdateTicket(viajeId);
  const remove = useDeleteTicket(viajeId);

  const columns: DataTableColumn<AttTicket>[] = [
    { key: 'aerolinea', header: 'Aerolínea', sortable: true, accessor: (r) => r.aerolinea, render: (r) => <span className="font-medium text-dark">{r.aerolinea ?? '—'}</span> },
    { key: 'numero_vuelo', header: 'Vuelo', accessor: (r) => r.numero_vuelo, render: (r) => r.numero_vuelo ?? '—' },
    {
      key: 'ruta',
      header: 'Ruta',
      accessor: (r) => `${r.origen ?? ''}${r.destino ?? ''}`,
      render: (r) => (
        <span>
          <span className="font-mono">{r.origen ?? '?'}</span>
          <span className="mx-1 text-dark-3">→</span>
          <span className="font-mono">{r.destino ?? '?'}</span>
        </span>
      ),
    },
    { key: 'salida', header: 'Salida', sortable: true, accessor: (r) => r.fecha_salida, render: (r) => (r.fecha_salida ? formatDateTime(r.fecha_salida) : '—') },
    { key: 'codigo_reserva', header: 'PNR', accessor: (r) => r.codigo_reserva, render: (r) => r.codigo_reserva ?? '—' },
  ];

  return (
    <CatalogPage<AttTicket, import('./api').AttTicketInsert>
      title="Vuelos"
      description="Boletos del viaje."
      newLabel="+ Nuevo vuelo"
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
      Form={TicketForm}
      rowLabel={(r) => r.numero_vuelo ?? r.aerolinea ?? 'vuelo'}
      canEdit={canEdit}
    />
  );
}

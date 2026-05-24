import { CatalogPage } from '@/modules/admin/components/CatalogPage';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { formatDateTime } from '@/lib/dates';
import { useCreateEvento, useDeleteEvento, useEventos, useUpdateEvento } from './hooks';
import type { Evento } from './api';
import { EventoForm } from './EventoForm';

const tipoLabel: Record<NonNullable<Evento['tipo']>, string> = {
  reunion: 'Reunión',
  cumpleanos: 'Cumpleaños',
  aniversario: 'Aniversario',
  viaje: 'Viaje',
  religioso: 'Religioso',
  otro: 'Otro',
};

export function EventosSection({ miembroId, canEdit }: { miembroId: string; canEdit: boolean }) {
  const query = useEventos(miembroId);
  const create = useCreateEvento(miembroId);
  const update = useUpdateEvento(miembroId);
  const remove = useDeleteEvento(miembroId);

  const columns: DataTableColumn<Evento>[] = [
    {
      key: 'titulo',
      header: 'Título',
      sortable: true,
      accessor: (r) => r.titulo,
      render: (r) => <span className="font-medium text-dark">{r.titulo}</span>,
    },
    {
      key: 'fecha',
      header: 'Fecha',
      sortable: true,
      accessor: (r) => r.fecha,
      render: (r) => (r.fecha ? formatDateTime(r.fecha) : '—'),
    },
    {
      key: 'tipo',
      header: 'Tipo',
      sortable: true,
      accessor: (r) => r.tipo,
      render: (r) => (r.tipo ? tipoLabel[r.tipo] : '—'),
    },
    {
      key: 'lugar',
      header: 'Lugar',
      accessor: (r) => r.lugar,
      render: (r) => r.lugar ?? '—',
    },
  ];

  return (
    <CatalogPage<Evento, import('./api').EventoInsert>
      title="Eventos"
      description="Citas y compromisos. Adjunta documentos al editar un evento existente."
      newLabel="+ Nuevo evento"
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
      Form={EventoForm}
      rowLabel={(r) => r.titulo}
      canEdit={canEdit}
    />
  );
}

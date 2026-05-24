import { CatalogPage } from '@/modules/admin/components/CatalogPage';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { useCreateLavanderia, useDeleteLavanderia, useLavanderia, useUpdateLavanderia } from './hooks';
import type { Lavanderia } from './api';
import { LavanderiaForm } from './LavanderiaForm';

export function LavanderiaSection({ canEdit }: { canEdit: boolean }) {
  const query = useLavanderia();
  const create = useCreateLavanderia();
  const update = useUpdateLavanderia();
  const remove = useDeleteLavanderia();

  const columns: DataTableColumn<Lavanderia>[] = [
    {
      key: 'asunto',
      header: 'Asunto',
      sortable: true,
      accessor: (r) => r.asunto,
      render: (r) => <span className="font-medium text-dark">{r.asunto ?? '—'}</span>,
    },
    { key: 'solicitado', header: 'Solicitado por', sortable: true, accessor: (r) => r.solicitado, render: (r) => r.solicitado ?? '—' },
    {
      key: 'descripcion',
      header: 'Descripción',
      accessor: (r) => r.descripcion,
      render: (r) => (
        <span className="text-dark-2 line-clamp-2 block max-w-xl">{r.descripcion ?? '—'}</span>
      ),
    },
  ];

  return (
    <CatalogPage<Lavanderia, import('./api').LavanderiaInsert>
      title="Lavandería"
      description="Solicitudes y bitácora de lavandería."
      newLabel="+ Nueva solicitud"
      modalSize="md"
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
      Form={LavanderiaForm}
      rowLabel={(r) => r.asunto ?? 'solicitud'}
      canEdit={canEdit}
    />
  );
}

import { CatalogPage } from '@/modules/admin/components/CatalogPage';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { formatDate, isOverdue } from '@/lib/dates';
import { useCeaTodos, useCreateCeaTodo, useDeleteCeaTodo, useToggleCeaTodo, useUpdateCeaTodo } from './hooks';
import type { CeaTodo } from './api';
import { CeaTodoForm } from './CeaTodoForm';

const priorityLabel: Record<NonNullable<CeaTodo['prioridad']>, string> = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
};
const statusLabel: Record<CeaTodo['estado'], string> = {
  pendiente: 'Pendiente',
  en_progreso: 'En progreso',
  completada: 'Completada',
  cancelada: 'Cancelada',
};
const statusBg: Record<CeaTodo['estado'], string> = {
  pendiente: 'bg-sand text-dark',
  en_progreso: 'bg-blue-light text-blue',
  completada: 'bg-teal-l text-teal-d',
  cancelada: 'bg-rust-l text-rust',
};

export function CeaTodosSection({ canEdit }: { canEdit: boolean }) {
  const query = useCeaTodos();
  const create = useCreateCeaTodo();
  const update = useUpdateCeaTodo();
  const toggle = useToggleCeaTodo();
  const remove = useDeleteCeaTodo();

  const columns: DataTableColumn<CeaTodo>[] = [
    {
      key: 'done',
      header: '✓',
      className: 'w-10',
      render: (r) => (
        <input
          type="checkbox"
          checked={r.done}
          disabled={!canEdit}
          onChange={(e) => void toggle.mutateAsync({ id: r.id, done: e.target.checked })}
          className="h-4 w-4 rounded border-sand text-teal focus:ring-teal disabled:opacity-50"
        />
      ),
    },
    {
      key: 'asunto',
      header: 'Asunto',
      sortable: true,
      accessor: (r) => r.asunto,
      render: (r) => <span className={`font-medium ${r.done ? 'text-dark-3 line-through' : 'text-dark'}`}>{r.asunto}</span>,
    },
    {
      key: 'fecha',
      header: 'Fecha',
      sortable: true,
      accessor: (r) => r.fecha,
      render: (r) => {
        if (!r.fecha) return <span className="text-dark-3">—</span>;
        const overdue = !r.done && isOverdue(r.fecha);
        return <span className={overdue ? 'font-semibold text-rust' : 'text-dark'}>{formatDate(r.fecha)}{overdue && ' ⚠'}</span>;
      },
    },
    { key: 'prioridad', header: 'Prio.', sortable: true, accessor: (r) => r.prioridad, render: (r) => (r.prioridad ? priorityLabel[r.prioridad] : '—') },
    {
      key: 'estado',
      header: 'Estado',
      sortable: true,
      accessor: (r) => r.estado,
      render: (r) => <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusBg[r.estado]}`}>{statusLabel[r.estado]}</span>,
    },
  ];

  return (
    <CatalogPage<CeaTodo, import('./api').CeaTodoInsert>
      title="To-dos del asistente"
      description="Pendientes operativos del CEA."
      newLabel="+ Nuevo to-do"
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
      Form={CeaTodoForm}
      rowLabel={(r) => r.asunto}
      canEdit={canEdit}
    />
  );
}

import { CatalogPage } from '@/modules/admin/components/CatalogPage';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { formatDate, isOverdue } from '@/lib/dates';
import { useCeaTodos, useCreateCeaTodo, useDeleteCeaTodo, useToggleCeaTodo, useUpdateCeaTodo } from './hooks';
import {
  CEA_TODO_ESTADO_COLOR,
  CEA_TODO_PRI_COLOR,
  type CeaTodo,
} from './api';
import { CeaTodoForm } from './CeaTodoForm';

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
          aria-label="Marcar como hecha"
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
    {
      key: 'prioridad_label',
      header: 'Prio.',
      sortable: true,
      accessor: (r) => r.prioridad_label,
      render: (r) => {
        const p = r.prioridad_label ?? 'Media';
        return (
          <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${CEA_TODO_PRI_COLOR[p] ?? 'bg-sand text-dark-2'}`}>
            {p}
          </span>
        );
      },
    },
    {
      key: 'estado_label',
      header: 'Estado',
      sortable: true,
      accessor: (r) => r.estado_label,
      render: (r) => {
        const s = r.estado_label ?? 'Comentado';
        return (
          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${CEA_TODO_ESTADO_COLOR[s] ?? 'bg-sand text-dark'}`}>
            {s}
          </span>
        );
      },
    },
  ];

  return (
    <CatalogPage<CeaTodo, import('./api').CeaTodoInsert>
      title="To-dos del asistente"
      description="Pendientes operativos del CEA con prioridad (Alta/Hold/TKIM/Media/Baja) y estado del flujo (Comentado → Solicitado → Planeado → Ejecutado → Finalizado)."
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

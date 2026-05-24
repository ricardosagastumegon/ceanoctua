import { useMemo, useState } from 'react';
import { CatalogPage } from '@/modules/admin/components/CatalogPage';
import { Select } from '@/components/ui/Select';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { formatDate, isOverdue } from '@/lib/dates';
import {
  useCreateTarea,
  useDeleteTarea,
  useTareas,
  useToggleTarea,
  useUpdateTarea,
} from './hooks';
import type { Tarea } from './api';
import { TareaForm } from './TareaForm';

const ALL = '__all__';

const priorityLabel: Record<NonNullable<Tarea['prioridad']>, string> = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
};
const statusLabel: Record<Tarea['estado'], string> = {
  pendiente: 'Pendiente',
  en_progreso: 'En progreso',
  completada: 'Completada',
  cancelada: 'Cancelada',
};
const statusBg: Record<Tarea['estado'], string> = {
  pendiente: 'bg-sand text-dark',
  en_progreso: 'bg-blue-light text-blue',
  completada: 'bg-teal-l text-teal-d',
  cancelada: 'bg-rust-l text-rust',
};

export function TareasSection({ miembroId, canEdit }: { miembroId: string; canEdit: boolean }) {
  const query = useTareas(miembroId);
  const create = useCreateTarea(miembroId);
  const update = useUpdateTarea(miembroId);
  const toggle = useToggleTarea(miembroId);
  const remove = useDeleteTarea(miembroId);

  const [listFilter, setListFilter] = useState<string>(ALL);

  const allListas = useMemo(() => {
    const set = new Set<string>();
    for (const t of query.data ?? []) if (t.lista) set.add(t.lista);
    return Array.from(set).sort();
  }, [query.data]);

  const rows = useMemo(() => {
    const data = query.data ?? [];
    if (listFilter === ALL) return data;
    if (listFilter === '__none__') return data.filter((t) => !t.lista);
    return data.filter((t) => t.lista === listFilter);
  }, [query.data, listFilter]);

  const columns: DataTableColumn<Tarea>[] = [
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
      key: 'texto',
      header: 'Tarea',
      sortable: true,
      accessor: (r) => r.texto,
      render: (r) => (
        <span className={`font-medium ${r.done ? 'text-dark-3 line-through' : 'text-dark'}`}>
          {r.texto}
        </span>
      ),
    },
    {
      key: 'lista',
      header: 'Lista',
      sortable: true,
      accessor: (r) => r.lista,
      render: (r) =>
        r.lista ? (
          <span className="inline-flex rounded-full bg-sand-l px-2 py-0.5 text-xs text-dark-2">
            {r.lista}
          </span>
        ) : (
          <span className="text-dark-3">—</span>
        ),
    },
    {
      key: 'fecha',
      header: 'Fecha',
      sortable: true,
      accessor: (r) => r.fecha,
      render: (r) => {
        if (!r.fecha) return <span className="text-dark-3">—</span>;
        const overdue = !r.done && isOverdue(r.fecha);
        return (
          <span className={overdue ? 'font-semibold text-rust' : 'text-dark'}>
            {formatDate(r.fecha)}
            {overdue && <span className="ml-1 text-xs">⚠</span>}
          </span>
        );
      },
    },
    {
      key: 'prioridad',
      header: 'Prio.',
      sortable: true,
      accessor: (r) => r.prioridad,
      render: (r) => (r.prioridad ? priorityLabel[r.prioridad] : '—'),
    },
    {
      key: 'estado',
      header: 'Estado',
      sortable: true,
      accessor: (r) => r.estado,
      render: (r) => (
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusBg[r.estado]}`}>
          {statusLabel[r.estado]}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {(allListas.length > 0 || true) && (
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-semibold uppercase tracking-wider text-dark-2">Lista:</label>
          <Select
            name="list-filter"
            value={listFilter}
            onChange={(e) => setListFilter(e.target.value)}
            className="w-auto min-w-40"
          >
            <option value={ALL}>Todas</option>
            <option value="__none__">Sin lista</option>
            {allListas.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </Select>
        </div>
      )}

      <CatalogPage<Tarea, ReturnType<typeof toInputShape>>
        title="Tareas"
        description="Pendientes de este miembro. Marca la casilla para completar."
        newLabel="+ Nueva tarea"
        columns={columns}
        rows={rows}
        loading={query.isLoading}
        isError={query.isError}
        error={query.error}
        onRetry={() => void query.refetch()}
        onCreate={(values) => create.mutateAsync(values)}
        onUpdate={(id, patch) => update.mutateAsync({ id, patch })}
        onDelete={(id) => remove.mutateAsync(id)}
        submitting={create.isPending || update.isPending}
        Form={TareaForm}
        rowLabel={(r) => r.texto}
        canEdit={canEdit}
        emptyMessage={
          listFilter === ALL ? 'Sin tareas todavía.' : `Sin tareas en "${listFilter === '__none__' ? 'sin lista' : listFilter}".`
        }
      />
    </div>
  );
}

// Helper just to type the TareaForm input shape for the generic
function toInputShape() {
  return {} as import('./api').TareaInsert;
}

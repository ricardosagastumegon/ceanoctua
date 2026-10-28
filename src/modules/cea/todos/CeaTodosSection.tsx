import { useMemo, useState } from 'react';
import { CatalogPage } from '@/modules/admin/components/CatalogPage';
import { PrintableModal } from '@/components/ui/PrintableModal';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { formatDate, isOverdue } from '@/lib/dates';
import { usePersonas } from '@/modules/admin/hooks';
import { useCeaTodos, useCreateCeaTodo, useDeleteCeaTodo, useToggleCeaTodo, useUpdateCeaTodo } from './hooks';
import {
  CEA_TODO_ESTADO_COLOR,
  CEA_TODO_PRI_COLOR,
  type CeaTodo,
} from './api';
import { CeaTodoForm } from './CeaTodoForm';
import { CeaTodosPrintable } from './CeaTodosPrintable';

/** El valor del filtro para «los que no tienen a nadie asignado». */
const SIN_ASIGNAR = 'sin';

export function CeaTodosSection({ canEdit }: { canEdit: boolean }) {
  const query = useCeaTodos();
  const create = useCreateCeaTodo();
  const update = useUpdateCeaTodo();
  const toggle = useToggleCeaTodo();
  const remove = useDeleteCeaTodo();
  const personas = usePersonas();

  const [filtro, setFiltro] = useState('');
  const [viendo, setViendo] = useState(false);

  const gente = useMemo(
    () => [...(personas.data ?? [])].sort(
      (a, b) => Number(b.es_jd) - Number(a.es_jd) || a.nombre.localeCompare(b.nombre),
    ),
    [personas.data],
  );

  const nombrePersona = useMemo(() => {
    const mapa = new Map(gente.map((p) => [p.id, p.nombre]));
    return (id: string | null) => (id ? mapa.get(id) ?? '—' : '—');
  }, [gente]);

  const todos = query.data ?? [];
  const filtrados = useMemo(() => {
    if (!filtro) return todos;
    if (filtro === SIN_ASIGNAR) return todos.filter((t) => !t.persona_id);
    return todos.filter((t) => t.persona_id === filtro);
  }, [todos, filtro]);

  /** Solo se ofrecen en el filtro los que de verdad tienen pendientes. */
  const conPendientes = useMemo(() => {
    const ids = new Set(todos.map((t) => t.persona_id).filter(Boolean));
    return gente.filter((p) => ids.has(p.id));
  }, [gente, todos]);

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
      key: 'persona_id',
      header: 'Personal JD',
      sortable: true,
      accessor: (r) => nombrePersona(r.persona_id),
      render: (r) =>
        r.persona_id ? (
          <span className="text-dark-2">{nombrePersona(r.persona_id)}</span>
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

  const nombreFiltrado =
    filtro && filtro !== SIN_ASIGNAR ? nombrePersona(filtro)
      : filtro === SIN_ASIGNAR ? 'Sin asignar'
        : null;

  return (
    <>
      <CatalogPage<CeaTodo, import('./api').CeaTodoInsert>
        title="To-dos del asistente"
        description="Pendientes operativos del CEA con prioridad (Alta/Hold/TKIM/Media/Baja) y estado del flujo (Comentado → Solicitado → Planeado → Ejecutado → Finalizado)."
        newLabel="+ Nuevo to-do"
        modalSize="lg"
        columns={columns}
        rows={filtrados}
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
        emptyMessage={
          filtro ? 'Esta persona no tiene pendientes con ese filtro.' : undefined
        }
        headerExtra={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              aria-label="Filtrar por personal de JD"
              className="rounded-md border border-sand bg-white px-3 py-2 text-xs text-dark focus:border-teal focus:outline-none"
            >
              <option value="">Todo el personal de JD</option>
              {conPendientes.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
              <option value={SIN_ASIGNAR}>— Sin asignar —</option>
            </select>
            <button
              type="button"
              onClick={() => setViendo(true)}
              className="rounded-md border border-sand px-3 py-2 text-xs font-extrabold text-dark-2 hover:bg-sand-l"
            >
              👁 Vista previa
            </button>
          </div>
        }
      />

      {/* Lo que se imprime es lo que se está viendo: si hay filtro, la hoja
          sale con el nombre arriba y lista para mandársela a esa persona. */}
      {viendo && (
        <PrintableModal
          open
          onClose={() => setViendo(false)}
          title={`Pendientes${nombreFiltrado ? ` · ${nombreFiltrado}` : ''}`}
        >
          <CeaTodosPrintable
            todos={filtrados}
            persona={nombreFiltrado}
            nombrePersona={nombrePersona}
          />
        </PrintableModal>
      )}
    </>
  );
}

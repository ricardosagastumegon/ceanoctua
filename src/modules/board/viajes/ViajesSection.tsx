import { CatalogPage } from '@/modules/admin/components/CatalogPage';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { businessDaysUntil, formatDate, isOverdue } from '@/lib/dates';
import { useCreateViaje, useDeleteViaje, useUpdateViaje, useViajes, useChecklist } from './hooks';
import type { Viaje } from './api';
import { ViajeForm } from './ViajeForm';

const tripTypeLabel: Record<NonNullable<Viaje['tipo']>, string> = {
  personal: 'Personal',
  trabajo: 'Trabajo',
  familia: 'Familia',
  salud: 'Salud',
  otro: 'Otro',
};
const statusLabel: Record<Viaje['estado'], string> = {
  planificado: 'Planificado',
  en_curso: 'En curso',
  completado: 'Completado',
  cancelado: 'Cancelado',
};
const statusBg: Record<Viaje['estado'], string> = {
  planificado: 'bg-blue-light text-blue',
  en_curso: 'bg-gold-light text-gold',
  completado: 'bg-teal-l text-teal-d',
  cancelado: 'bg-rust-l text-rust',
};

function Countdown({ fecha }: { fecha: string | null }) {
  if (!fecha) return <span className="text-dark-3">—</span>;
  const d = businessDaysUntil(fecha);
  if (d > 0) {
    return <span className="text-teal-d">en {d} día{d !== 1 ? 's' : ''} hábil{d !== 1 ? 'es' : ''}</span>;
  }
  if (d === 0) return <span className="font-semibold text-rust">¡hoy!</span>;
  return <span className="text-dark-3">hace {-d} día{-d !== 1 ? 's' : ''}</span>;
}

function ChecklistProgress({ viajeId }: { viajeId: string }) {
  const { data } = useChecklist(viajeId);
  if (!data) return <span className="text-xs text-dark-3">—</span>;
  const done = data.filter((i) => i.done).length;
  const total = data.length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-sand">
        <div className="h-full bg-teal" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-dark-3">{done}/{total}</span>
    </div>
  );
}

export function ViajesSection({ miembroId, canEdit }: { miembroId: string; canEdit: boolean }) {
  const query = useViajes(miembroId);
  const create = useCreateViaje(miembroId);
  const update = useUpdateViaje(miembroId);
  const remove = useDeleteViaje(miembroId);

  const columns: DataTableColumn<Viaje>[] = [
    {
      key: 'destino',
      header: 'Destino',
      sortable: true,
      accessor: (r) => r.destino,
      render: (r) => <span className="font-medium text-dark">{r.destino}</span>,
    },
    {
      key: 'fecha_ini',
      header: 'Inicio',
      sortable: true,
      accessor: (r) => r.fecha_ini,
      render: (r) => {
        if (!r.fecha_ini) return <span className="text-dark-3">—</span>;
        const past = isOverdue(r.fecha_ini);
        return (
          <div>
            <div className={past && r.estado === 'planificado' ? 'font-semibold text-rust' : 'text-dark'}>
              {formatDate(r.fecha_ini)}
            </div>
            {r.estado === 'planificado' && <div className="text-xs"><Countdown fecha={r.fecha_ini} /></div>}
          </div>
        );
      },
    },
    {
      key: 'fecha_fin',
      header: 'Fin',
      accessor: (r) => r.fecha_fin,
      render: (r) => (r.fecha_fin ? formatDate(r.fecha_fin) : '—'),
    },
    {
      key: 'tipo',
      header: 'Tipo',
      sortable: true,
      accessor: (r) => r.tipo,
      render: (r) => (r.tipo ? tripTypeLabel[r.tipo] : '—'),
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
    {
      key: 'checklist',
      header: 'Checklist',
      render: (r) => <ChecklistProgress viajeId={r.id} />,
    },
  ];

  return (
    <CatalogPage<Viaje, import('./api').ViajeInsert>
      title="Viajes"
      description="Al crear un viaje se genera automáticamente un checklist de 6 ítems. Edita el viaje para marcarlos."
      newLabel="+ Nuevo viaje"
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
      Form={ViajeForm}
      rowLabel={(r) => r.destino}
      canEdit={canEdit}
    />
  );
}

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Modal } from '@/components/ui/Modal';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { describeError } from '@/modules/admin/hooks';
import { formatDate } from '@/lib/dates';
import { ArriazaMap } from './ArriazaMap';
import { ViajeForm } from './viajes/ViajeForm';
import {
  useAttViajes,
  useCreateAttViaje,
  useDeleteAttViaje,
  useUpdateAttViaje,
} from './viajes/hooks';
import type { AttViaje, AttViajeInsert } from './viajes/api';
import { TicketsSection } from './tickets/TicketsSection';
import { HotelesSection } from './hoteles/HotelesSection';
import { RestaurantesSection } from './restaurantes/RestaurantesSection';

type SubTab = 'tickets' | 'hoteles' | 'restaurantes';

const statusLabel: Record<AttViaje['estado'], string> = {
  planificado: 'Planificado',
  en_curso: 'En curso',
  completado: 'Completado',
  cancelado: 'Cancelado',
};
const statusBg: Record<AttViaje['estado'], string> = {
  planificado: 'bg-blue-light text-blue',
  en_curso: 'bg-gold-light text-gold',
  completado: 'bg-teal-l text-teal-d',
  cancelado: 'bg-rust-l text-rust',
};

export function AttPage() {
  const { profile } = useAuth();
  const canEdit = profile?.rol === 'admin' || profile?.rol === 'asistente';

  const query = useAttViajes();
  const create = useCreateAttViaje();
  const update = useUpdateAttViaje();
  const remove = useDeleteAttViaje();
  const toast = useToast();
  const confirm = useConfirm();

  const [editingViaje, setEditingViaje] = useState<AttViaje | null | undefined>(undefined);
  const [openViajeId, setOpenViajeId] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<SubTab>('tickets');

  const viajes = query.data ?? [];
  const openViaje = openViajeId ? viajes.find((v) => v.id === openViajeId) : null;

  async function handleSave(values: AttViajeInsert) {
    try {
      if (editingViaje && editingViaje.id) {
        await update.mutateAsync({ id: editingViaje.id, patch: values });
        toast.success('Viaje actualizado.');
      } else {
        const created = await create.mutateAsync(values);
        toast.success('Viaje creado.');
        setOpenViajeId(created.id);
      }
      setEditingViaje(undefined);
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  async function handleDelete(viaje: AttViaje) {
    const ok = await confirm({
      title: 'Borrar viaje',
      message: <>¿Borrar el viaje <strong>{viaje.titulo}</strong> y todas sus reservas?</>,
      danger: true,
      confirmLabel: 'Borrar',
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(viaje.id);
      toast.success('Viaje borrado.');
      if (openViajeId === viaje.id) setOpenViajeId(null);
    } catch (err) {
      toast.error(describeError(err, 'delete'));
    }
  }

  const columns: DataTableColumn<AttViaje>[] = [
    {
      key: 'titulo',
      header: 'Viaje',
      sortable: true,
      accessor: (r) => r.titulo,
      render: (r) => <span className="font-medium text-dark">{r.titulo}</span>,
    },
    {
      key: 'destino',
      header: 'Destino',
      sortable: true,
      accessor: (r) => r.destino,
      render: (r) => r.destino ?? (`${r.ciudad ?? ''} ${r.pais ?? ''}`.trim() || '—'),
    },
    {
      key: 'fechas',
      header: 'Fechas',
      sortable: true,
      accessor: (r) => r.fecha_ini,
      render: (r) => (
        <span>
          {r.fecha_ini ? formatDate(r.fecha_ini) : '—'}{' '}
          <span className="text-dark-3">→</span>{' '}
          {r.fecha_fin ? formatDate(r.fecha_fin) : '—'}
        </span>
      ),
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
    <section className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-dark">Arriaza T&T</h1>
          <p className="mt-1 text-sm text-dark-2">
            Viajes de la agencia con vuelos, hoteles, restaurantes y mapa.
            {canEdit ? '' : ' Solo lectura.'}
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setEditingViaje(null)}
            className="rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-d"
          >
            + Nuevo viaje
          </button>
        )}
      </header>

      <ArriazaMap viajes={viajes} onMarkerClick={(v) => setOpenViajeId(v.id)} />

      <DataTable<AttViaje>
        data={viajes}
        columns={columns}
        loading={query.isLoading}
        error={query.isError ? describeError(query.error) : null}
        onRetry={() => void query.refetch()}
        emptyMessage="Sin viajes registrados."
        rowKey={(r) => r.id}
        actions={(row) => (
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setOpenViajeId(row.id);
                setSubTab('tickets');
              }}
              className="rounded-md border border-teal/40 px-3 py-1 text-xs font-semibold text-teal-d hover:bg-teal-l"
            >
              Abrir
            </button>
            {canEdit && (
              <>
                <button
                  type="button"
                  onClick={() => setEditingViaje(row)}
                  className="rounded-md border border-sand px-3 py-1 text-xs font-semibold text-dark-2 hover:bg-sand-l"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(row)}
                  className="rounded-md border border-rust/40 px-3 py-1 text-xs font-semibold text-rust hover:bg-rust-l"
                >
                  Borrar
                </button>
              </>
            )}
          </div>
        )}
      />

      {/* Viaje detail (when one is opened) */}
      {openViaje && (
        <section className="space-y-4 rounded-card border border-teal/40 bg-white p-6 shadow-md">
          <header className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-heading text-xl font-semibold text-dark">{openViaje.titulo}</h2>
              {openViaje.destino && <p className="text-sm text-dark-2">{openViaje.destino}</p>}
            </div>
            <button
              type="button"
              onClick={() => setOpenViajeId(null)}
              className="rounded-md border border-sand px-3 py-1 text-xs font-semibold text-dark-2 hover:bg-sand-l"
            >
              Cerrar
            </button>
          </header>

          <div className="overflow-hidden rounded-card border border-sand bg-white p-1">
            <nav className="flex gap-1">
              {(['tickets', 'hoteles', 'restaurantes'] as SubTab[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setSubTab(t)}
                  className={[
                    'rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors',
                    subTab === t ? 'bg-teal text-white shadow-sm' : 'text-dark-2 hover:bg-sand-l hover:text-teal-d',
                  ].join(' ')}
                >
                  {t === 'tickets' ? 'Vuelos' : t === 'hoteles' ? 'Hoteles' : 'Restaurantes'}
                </button>
              ))}
            </nav>
          </div>

          {subTab === 'tickets' && <TicketsSection viajeId={openViaje.id} canEdit={canEdit} />}
          {subTab === 'hoteles' && <HotelesSection viajeId={openViaje.id} canEdit={canEdit} />}
          {subTab === 'restaurantes' && <RestaurantesSection viajeId={openViaje.id} canEdit={canEdit} />}
        </section>
      )}

      <Modal
        open={editingViaje !== undefined}
        onClose={() => setEditingViaje(undefined)}
        title={editingViaje ? `Editar — ${editingViaje.titulo}` : 'Nuevo viaje'}
        size="lg"
      >
        <ViajeForm
          initial={editingViaje ?? null}
          submitting={create.isPending || update.isPending}
          onSubmit={handleSave}
          onCancel={() => setEditingViaje(undefined)}
        />
      </Modal>
    </section>
  );
}

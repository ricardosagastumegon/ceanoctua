import { useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { describeError } from '@/modules/admin/hooks';
import { ArriazaMap } from './ArriazaMap';
import { TripFormModal } from './TripFormModal';
import { TripCard } from './TripCard';
import { BackupModal } from './BackupModal';
import { FinishedFolder } from './FinishedFolder';
import { CalendarPanel } from './CalendarPanel';
import {
  useAttViajes,
  useCreateAttViaje,
  useDeleteAttViaje,
  useUpdateAttViaje,
} from './viajes/hooks';
import type { AttViaje, AttViajeInsert } from './viajes/api';
import { autoTripStatus } from './utils';
import type { ManualStatus } from './constants/serviceMeta';

type StatusFilter = '' | 'proximo' | 'curso' | 'finalizado';
type SortMode = 'start-asc' | 'start-desc' | 'created-desc';

// AttPage T&T · rebuild F19-3 · paridad con TT_modulo.html.
// Estructura: hero + toolbar + grid de trip cards (izq) + calendario/mapa (der).
// Los viajes con manual_status = 'Finalizado' se ocultan del dashboard principal
// y se muestran en la carpeta "Viajes Realizados" (F19-3f, pendiente).
export function AttPage() {
  const { profile } = useAuth();
  const canEdit = profile?.rol === 'admin' || profile?.rol === 'asistente';

  const query = useAttViajes();
  const create = useCreateAttViaje();
  const update = useUpdateAttViaje();
  const remove = useDeleteAttViaje();
  const toast = useToast();
  const confirm = useConfirm();

  const [editing, setEditing] = useState<AttViaje | null | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [sortMode, setSortMode] = useState<SortMode>('start-asc');
  const [backupOpen, setBackupOpen] = useState(false);

  const viajes = query.data ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return viajes
      .filter((v) => (v.manual_status ?? 'Solicitado') !== 'Finalizado')
      .filter((v) => {
        if (!q) return true;
        const hay = `${v.titulo} ${v.destino ?? ''} ${v.pais ?? ''} ${v.acompanantes ?? ''}`.toLowerCase();
        return hay.includes(q);
      })
      .filter((v) => {
        if (!statusFilter) return true;
        return autoTripStatus(v) === statusFilter;
      })
      .sort((a, b) => {
        if (sortMode === 'start-asc') return (a.fecha_ini ?? '').localeCompare(b.fecha_ini ?? '');
        if (sortMode === 'start-desc') return (b.fecha_ini ?? '').localeCompare(a.fecha_ini ?? '');
        return (b.created_at ?? '').localeCompare(a.created_at ?? '');
      });
  }, [viajes, search, statusFilter, sortMode]);

  const kpis = useMemo(() => {
    const active = viajes.filter((v) => (v.manual_status ?? 'Solicitado') !== 'Finalizado');
    return {
      total: active.length,
      curso: active.filter((v) => autoTripStatus(v) === 'curso').length,
      proximo: active.filter((v) => autoTripStatus(v) === 'proximo').length,
    };
  }, [viajes]);

  async function handleSave(values: AttViajeInsert) {
    try {
      if (editing && editing.id) {
        await update.mutateAsync({ id: editing.id, patch: values });
        toast.success('Viaje actualizado.');
      } else {
        await create.mutateAsync(values);
        toast.success('Viaje creado.');
      }
      setEditing(undefined);
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  async function handleDelete(v: AttViaje) {
    const ok = await confirm({
      title: 'Borrar viaje',
      message: (
        <>
          ¿Borrar el viaje <strong>{v.titulo}</strong> y todas sus reservas?
        </>
      ),
      danger: true,
      confirmLabel: 'Borrar',
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(v.id);
      toast.success('Viaje borrado.');
    } catch (err) {
      toast.error(describeError(err, 'delete'));
    }
  }

  async function handleManualStatusChange(v: AttViaje, status: ManualStatus) {
    try {
      await update.mutateAsync({ id: v.id, patch: { manual_status: status } });
      if (status === 'Finalizado') toast.success('🎉 Viaje movido a Viajes Realizados');
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  return (
    <section className="space-y-4">
      {/* HERO */}
      <div className="relative overflow-hidden rounded-card border-b-4 border-gold bg-gradient-to-br from-navy via-teal-d to-aqua p-6 text-white shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-[.22em] text-white/50">
              Arriaza · Tour &amp; Travel
            </div>
            <h1 className="mt-1 font-heading text-2xl font-extrabold">
              Investigación · Planeación · Organización · Ejecución · Seguimiento
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <Kpi label="Viajes" value={kpis.total} />
            <Kpi label="En curso" value={kpis.curso} />
            <Kpi label="Próximos" value={kpis.proximo} />
            {canEdit && (
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg border border-white/30 bg-white/20 px-4 py-2 text-sm font-extrabold text-white backdrop-blur hover:bg-white/30"
              >
                ➕ Crear Viaje
              </button>
            )}
          </div>
        </div>
      </div>

      {/* TOOLBAR */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Buscar viaje, destino o participante…"
          className="w-64 rounded-md border border-sand bg-white px-3 py-2 text-sm text-dark placeholder:text-dark-3 focus:border-teal focus:outline-none"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="rounded-md border border-sand bg-white px-3 py-2 text-sm text-dark focus:border-teal focus:outline-none"
        >
          <option value="">Todos los estados</option>
          <option value="proximo">Próximo</option>
          <option value="curso">En curso</option>
          <option value="finalizado">Finalizado</option>
        </select>
        <select
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value as SortMode)}
          className="rounded-md border border-sand bg-white px-3 py-2 text-sm text-dark focus:border-teal focus:outline-none"
        >
          <option value="start-asc">Fecha inicio ↑</option>
          <option value="start-desc">Fecha inicio ↓</option>
          <option value="created-desc">Creado recientemente</option>
        </select>
        <button
          type="button"
          onClick={() => setBackupOpen(true)}
          className="ml-auto rounded-md border border-gold/40 bg-gold-light px-3 py-2 text-xs font-extrabold text-gold hover:opacity-90"
        >
          💾 Respaldo
        </button>
      </div>

      {/* GRID: viajes (izq) + mapa (der) */}
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div>
          {query.isLoading && <div className="text-sm text-dark-2">Cargando viajes…</div>}
          {query.isError && (
            <div className="rounded-md border border-rust bg-rust-l px-3 py-2 text-sm text-rust">
              {describeError(query.error)}
            </div>
          )}
          {!query.isLoading && filtered.length === 0 && (
            <div className="rounded-card border-2 border-dashed border-sand-d bg-white px-8 py-16 text-center">
              <div className="mb-3 text-4xl">✈️</div>
              <div className="font-heading text-lg font-bold text-dark">
                {viajes.length === 0 ? 'Sin viajes creados' : 'Sin resultados'}
              </div>
              <div className="mt-1 text-sm text-dark-3">
                {viajes.length === 0
                  ? 'Haz clic en "Crear Viaje" para comenzar a planificar.'
                  : 'Ajusta la búsqueda o los filtros.'}
              </div>
              {canEdit && viajes.length === 0 && (
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="mt-4 rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-d"
                >
                  ➕ Crear primer viaje
                </button>
              )}
            </div>
          )}
          {filtered.map((v) => (
            <TripCard
              key={v.id}
              viaje={v}
              canEdit={canEdit}
              onEdit={() => setEditing(v)}
              onDelete={() => void handleDelete(v)}
              onManualStatusChange={(s) => void handleManualStatusChange(v, s)}
            />
          ))}
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-4 space-y-3">
            <CalendarPanel viajes={viajes} />
            <ArriazaMap viajes={viajes} onMarkerClick={() => {}} />
          </div>
        </aside>
      </div>

      <FinishedFolder viajes={viajes} canEdit={canEdit} />

      <TripFormModal
        open={editing !== undefined}
        editing={editing ?? null}
        submitting={create.isPending || update.isPending}
        onClose={() => setEditing(undefined)}
        onSubmit={handleSave}
      />

      <BackupModal open={backupOpen} onClose={() => setBackupOpen(false)} />
    </section>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <div className="font-heading text-xl font-extrabold text-white">{value}</div>
      <div className="text-[10px] font-extrabold uppercase tracking-wider text-white/60">{label}</div>
    </div>
  );
}

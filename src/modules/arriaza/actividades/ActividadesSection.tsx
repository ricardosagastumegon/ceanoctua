import { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { describeError } from '@/modules/admin/hooks';
import { SERVICE_META } from '../constants/serviceMeta';
import { fmtDate, fmtMoney } from '../utils';
import { EstadoPagoBadge } from '../shared/EstadoPagoBadge';
import { ActividadForm } from './ActividadForm';
import {
  useAttActividades,
  useCreateAttActividad,
  useUpdateAttActividad,
  useDeleteAttActividad,
  useCreateAttActividadTicket,
  useUpdateAttActividadTicket,
  useDeleteAttActividadTicket,
  useCreateAttActividadSubticket,
  useDeleteAttActividadSubticket,
} from './hooks';
import { attActividadTicketsApi, actividadTotal } from './api';
import type { AttActividad, AttActividadInsert, AttActividadTicket } from './api';

type Props = { viajeId: string; canEdit: boolean; autoOpenCreate?: boolean; onDidOpenCreate?: () => void };

// Section para actividades · maneja cascada de tickets + subtickets al guardar.
export function ActividadesSection({ viajeId, canEdit, autoOpenCreate, onDidOpenCreate }: Props) {
  const query = useAttActividades();
  const create = useCreateAttActividad();
  const update = useUpdateAttActividad();
  const remove = useDeleteAttActividad();
  const createTicket = useCreateAttActividadTicket();
  const updateTicket = useUpdateAttActividadTicket();
  const deleteTicket = useDeleteAttActividadTicket();
  const createSub = useCreateAttActividadSubticket();
  const deleteSub = useDeleteAttActividadSubticket();
  const toast = useToast();
  const confirm = useConfirm();

  const [editing, setEditing] = useState<AttActividad | null | undefined>(undefined);
  const [existingTickets, setExistingTickets] = useState<AttActividadTicket[]>([]);

  // Filtro por viaje (la useAttActividades trae todas; filtramos en cliente).
  const rows = (query.data ?? []).filter((r) => r.viaje_id === viajeId);
  const meta = SERVICE_META.actividades;

  // Al empezar a editar, precargar los tickets existentes.
  useEffect(() => {
    if (editing && editing.id) {
      void attActividadTicketsApi.listByActividad(editing.id).then(setExistingTickets);
    } else {
      setExistingTickets([]);
    }
  }, [editing]);

  if (autoOpenCreate && editing === undefined) { setEditing(null); onDidOpenCreate?.(); }

  async function handleSave(
    values: AttActividadInsert,
    ticketDrafts: Parameters<Parameters<typeof ActividadForm>[0]['onSubmit']>[1],
  ) {
    try {
      let actividadId: string;
      if (editing && editing.id) {
        await update.mutateAsync({ id: editing.id, patch: values });
        actividadId = editing.id;
        // Borrar tickets existentes que ya no están en el draft.
        const draftIds = new Set(ticketDrafts.filter((t) => t.id).map((t) => t.id!));
        for (const et of existingTickets) {
          if (!draftIds.has(et.id)) await deleteTicket.mutateAsync({ id: et.id, actividadId });
        }
      } else {
        const created = await create.mutateAsync(values);
        actividadId = created.id;
      }
      // Crear/actualizar tickets del draft + sus subtickets.
      for (const t of ticketDrafts) {
        const payload = {
          actividad_id: actividadId,
          nombres: t.nombres.trim() || null,
          personas: t.personas ? Number(t.personas) : null,
          confirmacion: t.confirmacion.trim() || null,
          lugares: t.lugares.trim() || null,
          tarifa: t.tarifa ? Number(t.tarifa) : null,
          extras: t.extras.trim() || null,
          monto_extras: t.monto_extras ? Number(t.monto_extras) : null,
          tiene_subtickets: t.tiene_subtickets,
        };
        let ticketId: string;
        if (t.id) {
          await updateTicket.mutateAsync({ id: t.id, patch: payload });
          ticketId = t.id;
        } else {
          const createdTk = await createTicket.mutateAsync(payload);
          ticketId = createdTk.id;
        }
        if (t.tiene_subtickets) {
          // Estrategia simple: solo agregar los nuevos (los existentes no se editan aquí).
          for (const s of t.subtickets) {
            if (!s.id && (s.nombre || s.ticket || s.lugar)) {
              await createSub.mutateAsync({
                ticket_id: ticketId,
                nombre: s.nombre.trim() || null,
                ticket: s.ticket.trim() || null,
                lugar: s.lugar.trim() || null,
              });
            }
          }
        }
      }
      toast.success(editing ? 'Actividad actualizada.' : 'Actividad agregada.');
      setEditing(undefined);
    } catch (err) { toast.error(describeError(err)); }
  }

  async function handleDelete(x: AttActividad) {
    const ok = await confirm({ title: 'Eliminar actividad', message: <>¿Eliminar <strong>{x.evento}</strong> y todos sus tickets?</>, danger: true, confirmLabel: 'Eliminar' });
    if (!ok) return;
    try { await remove.mutateAsync(x.id); toast.success('Actividad eliminada.'); } catch (err) { toast.error(describeError(err, 'delete')); }
  }

  // Suprime warning de lint: deleteSub no se usa aquí (el subticket se borra por cascade).
  void deleteSub;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-extrabold uppercase tracking-wider" style={{ color: meta.dark }}>
          {meta.icon} Actividades <span className="ml-1 rounded-full bg-sand px-1.5 text-[10px]">{rows.length}</span>
        </div>
        {canEdit && <button type="button" onClick={() => setEditing(null)} style={{ backgroundColor: meta.solid }} className="rounded-md px-2 py-1 text-[11px] font-semibold text-white hover:opacity-90">+ Nueva</button>}
      </div>
      {query.isLoading && <div className="text-xs text-dark-3">Cargando…</div>}
      {!query.isLoading && rows.length === 0 && <div className="italic text-xs text-dark-3">Sin actividades.</div>}
      {rows.map((x) => (
        <ActivityRow key={x.id} act={x} canEdit={canEdit} onEdit={() => setEditing(x)} onDelete={() => void handleDelete(x)} />
      ))}
      <ActividadForm
        open={editing !== undefined}
        viajeId={viajeId}
        editing={editing ?? null}
        existingTickets={existingTickets}
        submitting={create.isPending || update.isPending || createTicket.isPending}
        onClose={() => setEditing(undefined)}
        onSubmit={handleSave}
      />
    </div>
  );
}

function ActivityRow({ act, canEdit, onEdit, onDelete }: { act: AttActividad; canEdit: boolean; onEdit: () => void; onDelete: () => void }) {
  const meta = SERVICE_META.actividades;
  // Total on-demand: fetch tickets para mostrar el gran total.
  const [total, setTotal] = useState(0);
  useEffect(() => {
    let cancel = false;
    void attActividadTicketsApi.listByActividad(act.id).then((tks) => {
      if (!cancel) setTotal(actividadTotal(tks));
    });
    return () => { cancel = true; };
  }, [act.id]);

  return (
    <div className="mb-1 flex items-center gap-2 rounded-md border-l-4 bg-sand-l px-2 py-1.5" style={{ borderLeftColor: meta.solid }}>
      <span className="text-lg" style={{ color: meta.solid }}>{meta.icon}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-extrabold text-dark-2">
          {act.evento}
          <EstadoPagoBadge estado={act.estado_pago} />
        </div>
        <div className="truncate text-[10px] text-dark-3">
          {act.ciudad ?? '—'}{act.fecha ? ` · ${fmtDate(act.fecha)}` : ''}{act.inicio ? ` · ${act.inicio}` : ''}
        </div>
      </div>
      <div className="text-xs font-extrabold text-teal-d">{fmtMoney(total)}</div>
      <div className="flex shrink-0 gap-1">
        {canEdit && (
          <>
            <button type="button" onClick={onEdit} className="rounded border border-sand px-1.5 py-0.5 text-[10px] hover:border-teal">✏️</button>
            <button type="button" onClick={onDelete} className="rounded border border-sand px-1.5 py-0.5 text-[10px] hover:border-rust">🗑</button>
          </>
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { describeError } from '@/modules/admin/hooks';
import { SERVICE_META } from '../constants/serviceMeta';
import { fmtMoney } from '../utils';
import { EstadoPagoBadge } from '../shared/EstadoPagoBadge';
import { RentaForm } from './RentaForm';
import { useAttRentasByViaje, useCreateAttRenta, useUpdateAttRenta, useDeleteAttRenta } from './hooks';
import { rentaTotal, type AttRenta, type AttRentaInsert } from './api';

type Props = { viajeId: string; canEdit: boolean; autoOpenCreate?: boolean; onDidOpenCreate?: () => void };

export function RentasSection({ viajeId, canEdit, autoOpenCreate, onDidOpenCreate }: Props) {
  const query = useAttRentasByViaje(viajeId);
  const create = useCreateAttRenta();
  const update = useUpdateAttRenta();
  const remove = useDeleteAttRenta();
  const toast = useToast();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<AttRenta | null | undefined>(undefined);

  if (autoOpenCreate && editing === undefined) { setEditing(null); onDidOpenCreate?.(); }

  const rows = query.data ?? [];
  const meta = SERVICE_META.renta;

  async function handleSave(values: AttRentaInsert) {
    try {
      if (editing && editing.id) {
        await update.mutateAsync({ id: editing.id, patch: values });
        toast.success('Renta actualizada.');
      } else {
        await create.mutateAsync(values);
        toast.success('Renta agregada.');
      }
      setEditing(undefined);
    } catch (err) { toast.error(describeError(err)); }
  }

  async function handleDelete(r: AttRenta) {
    const ok = await confirm({ title: 'Eliminar renta', message: <>¿Eliminar <strong>{r.nombre}</strong>?</>, danger: true, confirmLabel: 'Eliminar' });
    if (!ok) return;
    try {
      await remove.mutateAsync({ id: r.id, viajeId });
      toast.success('Renta eliminada.');
    } catch (err) { toast.error(describeError(err, 'delete')); }
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-extrabold uppercase tracking-wider" style={{ color: meta.dark }}>
          {meta.icon} Rentas <span className="ml-1 rounded-full bg-sand px-1.5 text-[10px]">{rows.length}</span>
        </div>
        {canEdit && (
          <button type="button" onClick={() => setEditing(null)} style={{ backgroundColor: meta.solid }} className="rounded-md px-2 py-1 text-[11px] font-semibold text-white hover:opacity-90">+ Nueva</button>
        )}
      </div>
      {query.isLoading && <div className="text-xs text-dark-3">Cargando…</div>}
      {query.isError && <div className="rounded-md border border-rust bg-rust-l px-3 py-2 text-xs text-rust">{describeError(query.error)}</div>}
      {!query.isLoading && rows.length === 0 && <div className="italic text-xs text-dark-3">Sin rentas.</div>}
      {rows.map((r) => (
        <div key={r.id} className="mb-1 flex items-center gap-2 rounded-md border-l-4 bg-sand-l px-2 py-1.5" style={{ borderLeftColor: meta.solid }}>
          <span className="text-lg" style={{ color: meta.solid }}>{meta.icon}</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-extrabold text-dark-2">
              {r.nombre}
              <EstadoPagoBadge estado={r.estado_pago} />
            </div>
            <div className="truncate text-[10px] text-dark-3">
              {r.tipo_veh ?? '—'}{r.ciudad ? ` · ${r.ciudad}` : ''}{r.dias ? ` · ${r.dias} días` : ''}
            </div>
          </div>
          <div className="text-xs font-extrabold text-teal-d">{fmtMoney(rentaTotal(r))}</div>
          <div className="flex shrink-0 gap-1">
            {canEdit && (
              <>
                <button type="button" onClick={() => setEditing(r)} className="rounded border border-sand px-1.5 py-0.5 text-[10px] hover:border-teal" title="Editar">✏️</button>
                <button type="button" onClick={() => void handleDelete(r)} className="rounded border border-sand px-1.5 py-0.5 text-[10px] hover:border-rust" title="Eliminar">🗑</button>
              </>
            )}
          </div>
        </div>
      ))}
      <RentaForm open={editing !== undefined} viajeId={viajeId} editing={editing ?? null} submitting={create.isPending || update.isPending} onClose={() => setEditing(undefined)} onSubmit={handleSave} />
    </div>
  );
}

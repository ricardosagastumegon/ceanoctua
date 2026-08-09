import { useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { describeError } from '@/modules/admin/hooks';
import { SERVICE_META } from '../constants/serviceMeta';
import { fmtMoney } from '../utils';
import { EstadoPagoBadge } from '../shared/EstadoPagoBadge';
import { AcuaticoForm } from './AcuaticoForm';
import { useAttAcuaticosByViaje, useCreateAttAcuatico, useUpdateAttAcuatico, useDeleteAttAcuatico } from './hooks';
import { acuaticoTotal, type AttAcuatico, type AttAcuaticoInsert } from './api';

type Props = { viajeId: string; canEdit: boolean; autoOpenCreate?: boolean; onDidOpenCreate?: () => void };

export function AcuaticosSection({ viajeId, canEdit, autoOpenCreate, onDidOpenCreate }: Props) {
  const query = useAttAcuaticosByViaje(viajeId);
  const create = useCreateAttAcuatico();
  const update = useUpdateAttAcuatico();
  const remove = useDeleteAttAcuatico();
  const toast = useToast();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<AttAcuatico | null | undefined>(undefined);
  if (autoOpenCreate && editing === undefined) { setEditing(null); onDidOpenCreate?.(); }
  const rows = query.data ?? [];
  const meta = SERVICE_META.acuatico;

  async function handleSave(values: AttAcuaticoInsert) {
    try {
      if (editing && editing.id) { await update.mutateAsync({ id: editing.id, patch: values }); toast.success('Traslado actualizado.'); }
      else { await create.mutateAsync(values); toast.success('Traslado agregado.'); }
      setEditing(undefined);
    } catch (err) { toast.error(describeError(err)); }
  }
  async function handleDelete(x: AttAcuatico) {
    const ok = await confirm({ title: 'Eliminar traslado', message: <>¿Eliminar <strong>{x.prestador}</strong>?</>, danger: true, confirmLabel: 'Eliminar' });
    if (!ok) return;
    try { await remove.mutateAsync({ id: x.id, viajeId }); toast.success('Traslado eliminado.'); } catch (err) { toast.error(describeError(err, 'delete')); }
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-extrabold uppercase tracking-wider" style={{ color: meta.dark }}>
          {meta.icon} Traslados Acuáticos <span className="ml-1 rounded-full bg-sand px-1.5 text-[10px]">{rows.length}</span>
        </div>
        {canEdit && <button type="button" onClick={() => setEditing(null)} style={{ backgroundColor: meta.solid }} className="rounded-md px-2 py-1 text-[11px] font-semibold text-white hover:opacity-90">+ Nuevo</button>}
      </div>
      {query.isLoading && <div className="text-xs text-dark-3">Cargando…</div>}
      {query.isError && <div className="rounded-md border border-rust bg-rust-l px-3 py-2 text-xs text-rust">{describeError(query.error)}</div>}
      {!query.isLoading && rows.length === 0 && <div className="italic text-xs text-dark-3">Sin traslados acuáticos.</div>}
      {rows.map((x) => (
        <div key={x.id} className="mb-1 flex items-center gap-2 rounded-md border-l-4 bg-sand-l px-2 py-1.5" style={{ borderLeftColor: meta.solid }}>
          <span className="text-lg" style={{ color: meta.solid }}>{meta.icon}</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-extrabold text-dark-2">
              {x.prestador} <span className="text-[10px] font-normal text-dark-3">· {x.tipo}</span>
              <EstadoPagoBadge estado={x.estado_pago} />
            </div>
            <div className="truncate text-[10px] text-dark-3">{x.origen ?? '—'} → {x.destino ?? '—'}</div>
          </div>
          <div className="text-xs font-extrabold text-teal-d">{fmtMoney(acuaticoTotal(x))}</div>
          <div className="flex shrink-0 gap-1">
            {canEdit && (
              <>
                <button type="button" onClick={() => setEditing(x)} className="rounded border border-sand px-1.5 py-0.5 text-[10px] hover:border-teal" title="Editar">✏️</button>
                <button type="button" onClick={() => void handleDelete(x)} className="rounded border border-sand px-1.5 py-0.5 text-[10px] hover:border-rust" title="Eliminar">🗑</button>
              </>
            )}
          </div>
        </div>
      ))}
      <AcuaticoForm open={editing !== undefined} viajeId={viajeId} editing={editing ?? null} submitting={create.isPending || update.isPending} onClose={() => setEditing(undefined)} onSubmit={handleSave} />
    </div>
  );
}

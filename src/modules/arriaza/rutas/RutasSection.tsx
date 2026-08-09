import { useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { describeError } from '@/modules/admin/hooks';
import { SERVICE_META } from '../constants/serviceMeta';
import { fmtDate } from '../utils';
import { RutaForm } from './RutaForm';
import { useAttRutasByViaje, useCreateAttRuta, useUpdateAttRuta, useDeleteAttRuta } from './hooks';
import type { AttRuta, AttRutaInsert } from './api';

type Props = { viajeId: string; canEdit: boolean; autoOpenCreate?: boolean; onDidOpenCreate?: () => void };

export function RutasSection({ viajeId, canEdit, autoOpenCreate, onDidOpenCreate }: Props) {
  const query = useAttRutasByViaje(viajeId);
  const create = useCreateAttRuta();
  const update = useUpdateAttRuta();
  const remove = useDeleteAttRuta();
  const toast = useToast();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<AttRuta | null | undefined>(undefined);

  if (autoOpenCreate && editing === undefined) {
    setEditing(null);
    onDidOpenCreate?.();
  }

  const rows = query.data ?? [];
  const meta = SERVICE_META.ruta;

  async function handleSave(values: AttRutaInsert) {
    try {
      if (editing && editing.id) {
        await update.mutateAsync({ id: editing.id, patch: values });
        toast.success('Ruta actualizada.');
      } else {
        await create.mutateAsync(values);
        toast.success('Ruta agregada.');
      }
      setEditing(undefined);
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  async function handleDelete(r: AttRuta) {
    const ok = await confirm({ title: 'Eliminar ruta', message: <>¿Eliminar <strong>{r.nombre}</strong>?</>, danger: true, confirmLabel: 'Eliminar' });
    if (!ok) return;
    try {
      await remove.mutateAsync({ id: r.id, viajeId });
      toast.success('Ruta eliminada.');
    } catch (err) { toast.error(describeError(err, 'delete')); }
  }

  function copyLink(link: string) {
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(link).then(() => toast.success('Link copiado al portapapeles.'));
    } else {
      toast.error('No se pudo copiar. Selecciona el link manualmente.');
    }
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-extrabold uppercase tracking-wider" style={{ color: meta.dark }}>
          {meta.icon} Rutas <span className="ml-1 rounded-full bg-sand px-1.5 text-[10px]">{rows.length}</span>
        </div>
        {canEdit && (
          <button type="button" onClick={() => setEditing(null)} style={{ backgroundColor: meta.solid }} className="rounded-md px-2 py-1 text-[11px] font-semibold text-white hover:opacity-90">+ Nueva</button>
        )}
      </div>
      {query.isLoading && <div className="text-xs text-dark-3">Cargando…</div>}
      {query.isError && <div className="rounded-md border border-rust bg-rust-l px-3 py-2 text-xs text-rust">{describeError(query.error)}</div>}
      {!query.isLoading && rows.length === 0 && <div className="italic text-xs text-dark-3">Sin rutas agregadas.</div>}
      {rows.map((r) => (
        <div key={r.id} className="mb-1 flex items-center gap-2 rounded-md border-l-4 bg-sand-l px-2 py-1.5" style={{ borderLeftColor: meta.solid }}>
          <span className="text-lg" style={{ color: meta.solid }}>{meta.icon}</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-extrabold text-dark-2">{r.nombre}</div>
            <div className="truncate text-[10px] text-dark-3">
              {r.fecha ? `${fmtDate(r.fecha)} · ` : ''}<a href={r.link} target="_blank" rel="noopener" className="underline">Ver ruta</a>
            </div>
          </div>
          <div className="flex shrink-0 gap-1">
            <button type="button" onClick={() => copyLink(r.link)} className="rounded border border-sand px-1.5 py-0.5 text-[10px] hover:border-teal" title="Copiar link">📋</button>
            {canEdit && (
              <>
                <button type="button" onClick={() => setEditing(r)} className="rounded border border-sand px-1.5 py-0.5 text-[10px] hover:border-teal" title="Editar">✏️</button>
                <button type="button" onClick={() => void handleDelete(r)} className="rounded border border-sand px-1.5 py-0.5 text-[10px] hover:border-rust" title="Eliminar">🗑</button>
              </>
            )}
          </div>
        </div>
      ))}
      <RutaForm open={editing !== undefined} viajeId={viajeId} editing={editing ?? null} submitting={create.isPending || update.isPending} onClose={() => setEditing(undefined)} onSubmit={handleSave} />
    </div>
  );
}

import { useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { describeError } from '@/modules/admin/hooks';
import { SERVICE_META } from '../constants/serviceMeta';
import { ServicePrintable } from '../ServicePrintable';
import { PoiForm } from './PoiForm';
import { readPoiPuntos } from './api';
import { useAttPoisByViaje, useCreateAttPoi, useUpdateAttPoi, useDeleteAttPoi } from './hooks';
import type { AttPoi, AttPoiInsert } from './api';

type Props = { viajeId: string; canEdit: boolean; autoOpenCreate?: boolean; onDidOpenCreate?: () => void };

export function PoisSection({ viajeId, canEdit, autoOpenCreate, onDidOpenCreate }: Props) {
  const query = useAttPoisByViaje(viajeId);
  const create = useCreateAttPoi();
  const update = useUpdateAttPoi();
  const remove = useDeleteAttPoi();
  const toast = useToast();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<AttPoi | null | undefined>(undefined);
  const [printing, setPrinting] = useState<AttPoi | null>(null);

  if (autoOpenCreate && editing === undefined) { setEditing(null); onDidOpenCreate?.(); }

  const rows = query.data ?? [];
  const meta = SERVICE_META.poi;

  async function handleSave(values: AttPoiInsert) {
    try {
      if (editing && editing.id) {
        await update.mutateAsync({ id: editing.id, patch: values });
        toast.success('Lista actualizada.');
      } else {
        await create.mutateAsync(values);
        toast.success('Lista agregada.');
      }
      setEditing(undefined);
    } catch (err) { toast.error(describeError(err)); }
  }

  async function handleDelete(p: AttPoi) {
    const ok = await confirm({ title: 'Eliminar puntos', message: <>¿Eliminar <strong>{p.titulo}</strong>?</>, danger: true, confirmLabel: 'Eliminar' });
    if (!ok) return;
    try {
      await remove.mutateAsync({ id: p.id, viajeId });
      toast.success('Lista eliminada.');
    } catch (err) { toast.error(describeError(err, 'delete')); }
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-extrabold uppercase tracking-wider" style={{ color: meta.dark }}>
          {meta.icon} Puntos de Interés <span className="ml-1 rounded-full bg-sand px-1.5 text-[10px]">{rows.length}</span>
        </div>
        {canEdit && (
          <button type="button" onClick={() => setEditing(null)} style={{ backgroundColor: meta.solid }} className="rounded-md px-2 py-1 text-[11px] font-semibold text-white hover:opacity-90">+ Nueva</button>
        )}
      </div>
      {query.isLoading && <div className="text-xs text-dark-3">Cargando…</div>}
      {query.isError && <div className="rounded-md border border-rust bg-rust-l px-3 py-2 text-xs text-rust">{describeError(query.error)}</div>}
      {!query.isLoading && rows.length === 0 && <div className="italic text-xs text-dark-3">Sin listas de puntos.</div>}
      {rows.map((p) => {
        const puntos = readPoiPuntos(p);
        return (
          <div key={p.id} className="mb-1 flex items-center gap-2 rounded-md border-l-4 bg-sand-l px-2 py-1.5" style={{ borderLeftColor: meta.solid }}>
            <span className="text-lg" style={{ color: meta.solid }}>{meta.icon}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-extrabold text-dark-2">{p.titulo}</div>
              <div className="truncate text-[10px] text-dark-3">
                {p.ciudad ?? '—'} · {puntos.length} punto{puntos.length !== 1 ? 's' : ''}
              </div>
            </div>
            <div className="flex shrink-0 gap-1">
              <button type="button" onClick={() => setPrinting(p)} className="rounded border border-sand px-1.5 py-0.5 text-[10px] hover:border-teal" title="Imprimir">🖨</button>
              {canEdit && (
                <>
                  <button type="button" onClick={() => setEditing(p)} className="rounded border border-sand px-1.5 py-0.5 text-[10px] hover:border-teal" title="Editar">✏️</button>
                  <button type="button" onClick={() => void handleDelete(p)} className="rounded border border-sand px-1.5 py-0.5 text-[10px] hover:border-rust" title="Eliminar">🗑</button>
                </>
              )}
            </div>
          </div>
        );
      })}
      <ServicePrintable
        open={!!printing}
        onClose={() => setPrinting(null)}
        serviceKey="poi"
        title={printing?.titulo ?? ''}
        subtitle={printing?.ciudad ?? null}
        rows={printing ? [
          { label: 'Puntos', value: `${readPoiPuntos(printing).length} lugares` },
        ] : []}
        extras={
          printing && readPoiPuntos(printing).length > 0 ? (
            <ol className="space-y-2">
              {readPoiPuntos(printing).map((pt, i) => (
                <li key={i} className="rounded-md border border-gold/20 bg-gold-light/30 p-2">
                  <div className="font-extrabold text-dark-2">
                    <span className="mr-1 text-gold">{i + 1}.</span>
                    {pt.nombre ?? '—'}
                  </div>
                  {pt.descripcion && (
                    <div className="mt-0.5 text-[11px] text-dark-3">{pt.descripcion}</div>
                  )}
                </li>
              ))}
            </ol>
          ) : undefined
        }
      />
      <PoiForm open={editing !== undefined} viajeId={viajeId} editing={editing ?? null} submitting={create.isPending || update.isPending} onClose={() => setEditing(undefined)} onSubmit={handleSave} />
    </div>
  );
}

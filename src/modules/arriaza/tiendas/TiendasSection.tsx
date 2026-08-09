import { useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { describeError } from '@/modules/admin/hooks';
import { SERVICE_META } from '../constants/serviceMeta';
import { TiendaForm } from './TiendaForm';
import {
  useAttTiendasByViaje,
  useCreateAttTienda,
  useUpdateAttTienda,
  useDeleteAttTienda,
} from './hooks';
import type { AttTienda, AttTiendaInsert } from './api';

type Props = {
  viajeId: string;
  canEdit: boolean;
  autoOpenCreate?: boolean;
  onDidOpenCreate?: () => void;
};

// Lista compacta de tiendas asociadas al viaje + acciones · paridad HTML.
export function TiendasSection({ viajeId, canEdit, autoOpenCreate, onDidOpenCreate }: Props) {
  const query = useAttTiendasByViaje(viajeId);
  const create = useCreateAttTienda();
  const update = useUpdateAttTienda();
  const remove = useDeleteAttTienda();
  const toast = useToast();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<AttTienda | null | undefined>(undefined);

  // Si el padre dispara autoOpenCreate (ej. desde "+ Agregar Servicios" > Tienda),
  // abrimos el modal de crear una sola vez.
  if (autoOpenCreate && editing === undefined) {
    setEditing(null);
    onDidOpenCreate?.();
  }

  const rows = query.data ?? [];
  const meta = SERVICE_META.tiendas;

  async function handleSave(values: AttTiendaInsert) {
    try {
      if (editing && editing.id) {
        await update.mutateAsync({ id: editing.id, patch: values });
        toast.success('Tienda actualizada.');
      } else {
        await create.mutateAsync(values);
        toast.success('Tienda agregada.');
      }
      setEditing(undefined);
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  async function handleDelete(t: AttTienda) {
    const ok = await confirm({
      title: 'Eliminar tienda',
      message: <>¿Eliminar la tienda <strong>{t.nombre}</strong>?</>,
      danger: true,
      confirmLabel: 'Eliminar',
    });
    if (!ok) return;
    try {
      await remove.mutateAsync({ id: t.id, viajeId });
      toast.success('Tienda eliminada.');
    } catch (err) {
      toast.error(describeError(err, 'delete'));
    }
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-extrabold uppercase tracking-wider" style={{ color: meta.dark }}>
          {meta.icon} {meta.label}s <span className="ml-1 rounded-full bg-sand px-1.5 text-[10px]">{rows.length}</span>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setEditing(null)}
            style={{ backgroundColor: meta.solid }}
            className="rounded-md px-2 py-1 text-[11px] font-semibold text-white hover:opacity-90"
          >
            + Nueva
          </button>
        )}
      </div>

      {query.isLoading && <div className="text-xs text-dark-3">Cargando…</div>}
      {query.isError && (
        <div className="rounded-md border border-rust bg-rust-l px-3 py-2 text-xs text-rust">
          {describeError(query.error)}
        </div>
      )}
      {!query.isLoading && rows.length === 0 && (
        <div className="italic text-xs text-dark-3">Sin tiendas agregadas.</div>
      )}

      {rows.map((t) => (
        <div
          key={t.id}
          className="mb-1 flex items-center gap-2 rounded-md border-l-4 bg-sand-l px-2 py-1.5"
          style={{ borderLeftColor: meta.solid }}
        >
          <span className="text-lg" style={{ color: meta.solid }}>{meta.icon}</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-extrabold text-dark-2">{t.nombre}</div>
            <div className="truncate text-[10px] text-dark-3">
              {t.ciudad ?? '—'}
              {t.apertura ? ` · ${t.apertura}–${t.cierre ?? '—'}` : ''}
            </div>
          </div>
          <div className="flex shrink-0 gap-1">
            {canEdit && (
              <>
                <button
                  type="button"
                  onClick={() => setEditing(t)}
                  className="rounded border border-sand px-1.5 py-0.5 text-[10px] hover:border-teal"
                  title="Editar"
                >
                  ✏️
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(t)}
                  className="rounded border border-sand px-1.5 py-0.5 text-[10px] hover:border-rust"
                  title="Eliminar"
                >
                  🗑
                </button>
              </>
            )}
          </div>
        </div>
      ))}

      <TiendaForm
        open={editing !== undefined}
        viajeId={viajeId}
        editing={editing ?? null}
        submitting={create.isPending || update.isPending}
        onClose={() => setEditing(undefined)}
        onSubmit={handleSave}
      />
    </div>
  );
}

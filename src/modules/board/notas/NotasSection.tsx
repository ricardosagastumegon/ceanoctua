import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { describeError } from '@/modules/admin/hooks';
import { formatDate } from '@/lib/dates';
import { useCreateNota, useDeleteNota, useNotas, useUpdateNota } from './hooks';
import type { Nota } from './api';
import { NotaForm } from './NotaForm';

const NOTE_COLORS = [
  'bg-sand text-dark',
  'bg-teal-l text-teal-d',
  'bg-rust-l text-rust',
  'bg-gold-light text-gold',
  'bg-blue-light text-blue',
];

function colorFor(index: number, id: string): string {
  // Deterministic palette based on id, so each note keeps its color across renders
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return NOTE_COLORS[(hash + index) % NOTE_COLORS.length];
}

export function NotasSection({ miembroId, canEdit }: { miembroId: string; canEdit: boolean }) {
  const query = useNotas(miembroId);
  const create = useCreateNota(miembroId);
  const update = useUpdateNota(miembroId);
  const remove = useDeleteNota(miembroId);
  const toast = useToast();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<Nota | null | undefined>(undefined);

  async function handleSave(values: import('./api').NotaInsert) {
    try {
      if (editing && editing.id) {
        await update.mutateAsync({ id: editing.id, patch: values });
        toast.success('Nota actualizada.');
      } else {
        await create.mutateAsync(values);
        toast.success('Nota creada.');
      }
      setEditing(undefined);
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  async function handleDelete(n: Nota) {
    const ok = await confirm({
      title: 'Borrar nota',
      message: <>¿Borrar esta nota? Esta acción no se puede deshacer.</>,
      danger: true,
      confirmLabel: 'Borrar',
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(n.id);
      toast.success('Nota borrada.');
    } catch (err) {
      toast.error(describeError(err, 'delete'));
    }
  }

  const notas = query.data ?? [];

  return (
    <section className="space-y-4">
      <header className="flex items-end justify-between">
        <div>
          <h2 className="font-heading text-xl font-semibold text-dark">Notas</h2>
          <p className="mt-1 text-sm text-dark-2">Pequeñas notas adhesivas del miembro.</p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setEditing(null)}
            className="rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-d"
          >
            + Nueva nota
          </button>
        )}
      </header>

      {query.isLoading ? (
        <p className="text-sm text-dark-3">Cargando notas…</p>
      ) : query.isError ? (
        <div className="rounded-card border border-rust/40 bg-rust-l p-4 text-sm text-rust">
          {describeError(query.error)}
          <button
            type="button"
            onClick={() => void query.refetch()}
            className="ml-3 rounded-md border border-rust px-2 py-0.5 text-xs font-semibold hover:bg-white/50"
          >
            Reintentar
          </button>
        </div>
      ) : notas.length === 0 ? (
        <div className="rounded-card border border-dashed border-sand bg-white p-10 text-center text-sm text-dark-3">
          Sin notas todavía.
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {notas.map((n, i) => (
            <li key={n.id} className={`flex flex-col rounded-card p-4 shadow-sm ${colorFor(i, n.id)}`}>
              {n.titulo && <h3 className="mb-2 font-heading text-sm font-bold">{n.titulo}</h3>}
              <p className="flex-1 whitespace-pre-wrap text-sm">{n.contenido}</p>
              <div className="mt-3 flex items-center justify-between text-xs opacity-70">
                <span>{formatDate(n.updated_at)}</span>
                {canEdit && (
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setEditing(n)} className="rounded border border-current px-2 py-0.5 font-semibold hover:bg-white/30">
                      Editar
                    </button>
                    <button type="button" onClick={() => void handleDelete(n)} className="rounded border border-current px-2 py-0.5 font-semibold hover:bg-white/30">
                      Borrar
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={editing !== undefined}
        onClose={() => setEditing(undefined)}
        title={editing ? 'Editar nota' : 'Nueva nota'}
        size="md"
      >
        <NotaForm
          initial={editing ?? null}
          submitting={create.isPending || update.isPending}
          onSubmit={handleSave}
          onCancel={() => setEditing(undefined)}
        />
      </Modal>
    </section>
  );
}

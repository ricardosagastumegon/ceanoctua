import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { StepTracker } from '@/components/ui/StepTracker';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { describeError } from '@/modules/admin/hooks';
import { formatDate } from '@/lib/dates';
import {
  useAdvanceLavanderia,
  useCreateLavanderia,
  useDeleteLavanderia,
  useLavanderia,
  useUpdateLavanderia,
} from './hooks';
import { LAV_STEPS, type Lavanderia } from './api';
import { LavanderiaForm } from './LavanderiaForm';

export function LavanderiaSection({ canEdit }: { canEdit: boolean }) {
  const query = useLavanderia();
  const create = useCreateLavanderia();
  const update = useUpdateLavanderia();
  const advance = useAdvanceLavanderia();
  const remove = useDeleteLavanderia();
  const toast = useToast();
  const confirm = useConfirm();

  const [editing, setEditing] = useState<Lavanderia | null | undefined>(undefined);

  async function handleSave(values: import('./api').LavanderiaInsert) {
    try {
      if (editing && editing.id) {
        await update.mutateAsync({ id: editing.id, patch: values });
        toast.success('Actualizado.');
      } else {
        await create.mutateAsync(values);
        toast.success('Solicitud creada.');
      }
      setEditing(undefined);
    } catch (e) {
      toast.error(describeError(e));
    }
  }

  async function handleAdvance(row: Lavanderia) {
    try {
      await advance.mutateAsync({ id: row.id, current: row });
    } catch (e) {
      toast.error(describeError(e));
    }
  }

  async function handleDelete(row: Lavanderia) {
    const ok = await confirm({
      title: 'Borrar solicitud',
      message: <>¿Borrar la solicitud <strong>{row.asunto ?? '(sin asunto)'}</strong>?</>,
      danger: true,
      confirmLabel: 'Borrar',
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(row.id);
      toast.success('Borrado.');
    } catch (e) {
      toast.error(describeError(e, 'delete'));
    }
  }

  const items = query.data ?? [];

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-heading text-xl font-semibold text-dark">👕 Lavandería</h2>
          <p className="mt-1 text-sm text-dark-2">
            Bitácora con flujo de 5 pasos: Recibido → Espera → Entregado a lav. → Recibido de lav. → Entregado al solicitante.
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setEditing(null)}
            className="rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-d"
          >
            + Nueva solicitud
          </button>
        )}
      </header>

      {query.isLoading ? (
        <p className="text-sm text-dark-3">Cargando…</p>
      ) : query.isError ? (
        <p className="text-sm text-rust">Error: {describeError(query.error)}</p>
      ) : items.length === 0 ? (
        <p className="rounded-md border border-dashed border-sand bg-white p-6 text-center text-sm text-dark-3">
          Sin solicitudes de lavandería.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((row) => {
            const isLast = row.step_idx >= LAV_STEPS.length - 1;
            return (
              <li key={row.id} className="rounded-card border border-sand bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1">
                    <h3 className="font-medium text-dark">
                      👕 {row.asunto ?? '(sin asunto)'}
                    </h3>
                    {row.solicitado && <p className="text-xs text-dark-2">Solicitado por: {row.solicitado}</p>}
                    {row.descripcion && <p className="mt-1 text-sm text-dark-2">{row.descripcion}</p>}
                    <p className="mt-1 text-[11px] text-dark-3">Creada {formatDate(row.created_at)}</p>
                  </div>
                  {canEdit && (
                    <div className="flex gap-1">
                      {!isLast && (
                        <button
                          type="button"
                          onClick={() => void handleAdvance(row)}
                          className="rounded-md bg-teal px-3 py-1 text-xs font-semibold text-white hover:bg-teal-d"
                        >
                          → Siguiente
                        </button>
                      )}
                      {isLast && (
                        <span className="rounded-md bg-teal-l px-3 py-1 text-xs font-semibold text-teal-d">✓ Completo</span>
                      )}
                      <button
                        type="button"
                        onClick={() => setEditing(row)}
                        className="rounded-md border border-sand px-2 py-1 text-xs font-semibold text-dark-2 hover:bg-sand-l"
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(row)}
                        className="rounded-md border border-rust/40 px-2 py-1 text-xs font-semibold text-rust hover:bg-rust-l"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>
                <div className="mt-3">
                  <StepTracker
                    steps={LAV_STEPS}
                    currentIdx={row.step_idx}
                    stepDates={row.step_dates}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        open={editing !== undefined}
        onClose={() => setEditing(undefined)}
        title={editing?.id ? `Editar — ${editing.asunto ?? ''}` : 'Nueva solicitud de lavandería'}
        size="md"
      >
        <LavanderiaForm
          initial={editing ?? null}
          submitting={create.isPending || update.isPending}
          onSubmit={handleSave}
          onCancel={() => setEditing(undefined)}
        />
      </Modal>
    </section>
  );
}

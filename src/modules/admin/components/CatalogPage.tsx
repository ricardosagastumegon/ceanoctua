import { useState, type ComponentType, type ReactNode } from 'react';
import { Modal } from '@/components/ui/Modal';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { describeError } from '../hooks';

export type CatalogFormProps<TRow, TInput> = {
  initial?: TRow | null;
  submitting?: boolean;
  onSubmit: (values: TInput) => void | Promise<void>;
  onCancel: () => void;
};

export type CatalogPageProps<TRow extends { id: string }, TInput> = {
  title: string;
  description?: string;
  emptyMessage?: string;
  columns: DataTableColumn<TRow>[];
  rows: TRow[];
  loading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  onCreate: (values: TInput) => Promise<unknown>;
  onUpdate: (id: string, patch: TInput) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
  submitting: boolean;
  Form: ComponentType<CatalogFormProps<TRow, TInput>>;
  rowLabel: (row: TRow) => string;
  canEdit: boolean;
  newLabel?: string;
  modalSize?: 'sm' | 'md' | 'lg' | 'xl';
  /** Optional extra actions rendered before Editar/Borrar (e.g. "Ver PDF"). */
  extraActions?: (row: TRow) => ReactNode;
};

export function CatalogPage<TRow extends { id: string }, TInput>({
  title,
  description,
  emptyMessage,
  columns,
  rows,
  loading,
  isError,
  error,
  onRetry,
  onCreate,
  onUpdate,
  onDelete,
  submitting,
  Form,
  rowLabel,
  canEdit,
  newLabel = '+ Nuevo',
  modalSize = 'lg',
  extraActions,
}: CatalogPageProps<TRow, TInput>) {
  const toast = useToast();
  const confirm = useConfirm();

  const [editing, setEditing] = useState<TRow | null | undefined>(undefined);
  // undefined = closed, null = creating new, TRow = editing existing

  async function handleSave(values: TInput) {
    try {
      if (editing && 'id' in editing) {
        await onUpdate(editing.id, values);
        toast.success('Guardado.');
      } else {
        await onCreate(values);
        toast.success('Creado.');
      }
      setEditing(undefined);
    } catch (e) {
      toast.error(describeError(e));
    }
  }

  async function handleDelete(row: TRow) {
    const ok = await confirm({
      title: 'Borrar registro',
      message: (
        <>
          ¿Borrar <strong>{rowLabel(row)}</strong>? Esta acción no se puede deshacer.
        </>
      ),
      danger: true,
      confirmLabel: 'Borrar',
    });
    if (!ok) return;
    try {
      await onDelete(row.id);
      toast.success('Borrado.');
    } catch (e) {
      toast.error(describeError(e, 'delete'));
    }
  }

  return (
    <section className="space-y-4">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h2 className="font-heading text-xl font-semibold text-dark">{title}</h2>
          {description && <p className="mt-1 text-sm text-dark-2">{description}</p>}
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setEditing(null)}
            className="rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-d"
          >
            {newLabel}
          </button>
        )}
      </header>

      <DataTable<TRow>
        data={rows}
        columns={columns}
        loading={loading}
        error={isError ? describeError(error) : null}
        onRetry={onRetry}
        emptyMessage={emptyMessage ?? 'Sin registros todavía.'}
        rowKey={(r) => r.id}
        actions={
          (canEdit || extraActions)
            ? (row) => (
                <div className="flex justify-end gap-2">
                  {extraActions?.(row)}
                  {canEdit && (
                    <>
                      <button
                        type="button"
                        onClick={() => setEditing(row)}
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
              )
            : undefined
        }
      />

      <Modal
        open={editing !== undefined}
        onClose={() => setEditing(undefined)}
        title={editing ? `Editar — ${rowLabel(editing)}` : 'Nuevo registro'}
        size={modalSize}
      >
        <Form
          initial={editing ?? null}
          submitting={submitting}
          onSubmit={handleSave}
          onCancel={() => setEditing(undefined)}
        />
      </Modal>
    </section>
  );
}

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useAuth } from '@/lib/auth';
import {
  useCreateEntidad,
  useDeleteEntidad,
  useEntidades,
  useEntidadesRealtime,
  useUpdateEntidad,
} from './hooks';
import type { Entidad, EntidadInsert } from './api';
import { EntidadForm } from './components/EntidadForm';

export default function AdminPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.rol === 'admin';

  const query = useEntidades();
  const create = useCreateEntidad();
  const update = useUpdateEntidad();
  const remove = useDeleteEntidad();

  useEntidadesRealtime();

  const toast = useToast();
  const confirm = useConfirm();

  const [editing, setEditing] = useState<Entidad | null | undefined>(undefined);
  // undefined = modal closed, null = creating new, Entidad = editing

  function openCreate() {
    setEditing(null);
  }

  function openEdit(row: Entidad) {
    setEditing(row);
  }

  function close() {
    setEditing(undefined);
  }

  async function handleSave(values: EntidadInsert) {
    try {
      if (editing && editing.id) {
        await update.mutateAsync({ id: editing.id, patch: values });
        toast.success('Entidad actualizada.');
      } else {
        await create.mutateAsync(values);
        toast.success('Entidad creada.');
      }
      close();
    } catch (e) {
      toast.error(messageFromError(e));
    }
  }

  async function handleDelete(row: Entidad) {
    const ok = await confirm({
      title: 'Borrar entidad',
      message: (
        <>
          ¿Borrar la entidad <strong>{row.nombre}</strong>? Esta acción no se puede deshacer.
        </>
      ),
      danger: true,
      confirmLabel: 'Borrar',
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(row.id);
      toast.success('Entidad borrada.');
    } catch (e) {
      toast.error(messageFromError(e));
    }
  }

  const columns: DataTableColumn<Entidad>[] = [
    {
      key: 'nombre',
      header: 'Nombre',
      sortable: true,
      accessor: (r) => r.nombre,
      render: (r) => <span className="font-medium text-dark">{r.nombre}</span>,
    },
    { key: 'nit', header: 'NIT', sortable: true, accessor: (r) => r.nit, render: (r) => r.nit ?? '—' },
    {
      key: 'contacto',
      header: 'Contacto',
      sortable: true,
      accessor: (r) => r.contacto,
      render: (r) => r.contacto ?? '—',
    },
    {
      key: 'telefono',
      header: 'Teléfono',
      accessor: (r) => r.telefono,
      render: (r) => r.telefono ?? '—',
    },
    { key: 'email', header: 'Email', accessor: (r) => r.email, render: (r) => r.email ?? '—' },
  ];

  return (
    <section className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-dark">Admin — Entidades</h1>
          <p className="mt-1 text-sm text-dark-2">
            Catálogo compartido. {isAdmin ? 'Puedes crear, editar y borrar.' : 'Solo lectura.'}
          </p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={openCreate}
            className="rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-d"
          >
            + Nueva entidad
          </button>
        )}
      </header>

      <DataTable<Entidad>
        data={query.data ?? []}
        columns={columns}
        loading={query.isLoading}
        error={query.isError ? messageFromError(query.error) : null}
        onRetry={() => void query.refetch()}
        emptyMessage={
          isAdmin
            ? 'Aún no hay entidades. Crea la primera con "+ Nueva entidad".'
            : 'Aún no hay entidades.'
        }
        rowKey={(r) => r.id}
        actions={
          isAdmin
            ? (row) => (
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(row)}
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
                </div>
              )
            : undefined
        }
      />

      <Modal
        open={editing !== undefined}
        onClose={close}
        title={editing ? 'Editar entidad' : 'Nueva entidad'}
        size="lg"
      >
        <EntidadForm
          initial={editing ?? null}
          submitting={create.isPending || update.isPending}
          onSubmit={handleSave}
          onCancel={close}
        />
      </Modal>
    </section>
  );
}

function messageFromError(e: unknown): string {
  if (!e) return 'Error desconocido.';
  if (typeof e === 'string') return e;
  if (e instanceof Error) return e.message;
  const m = (e as { message?: string }).message;
  return m ?? 'Error desconocido.';
}

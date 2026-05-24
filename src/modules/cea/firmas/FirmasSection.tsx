import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { describeError } from '@/modules/admin/hooks';
import { formatDate } from '@/lib/dates';
import { useBoardMiembros, useCreateFirma, useDeleteFirma, useFirmas, useUpdateFirma } from './hooks';
import type { FirmaInsert, FirmaWithSigners } from './api';
import { FirmaForm } from './FirmaForm';

const statusLabel: Record<FirmaWithSigners['status_firma'], string> = {
  en_espera: 'En espera',
  firmado: 'Firmado',
  stand_by: 'Stand By',
  denegada: 'Denegada',
};
const statusBg: Record<FirmaWithSigners['status_firma'], string> = {
  en_espera: 'bg-sand text-dark',
  firmado: 'bg-teal-l text-teal-d',
  stand_by: 'bg-blue-light text-blue',
  denegada: 'bg-rust-l text-rust',
};

const urgenciaLabel: Record<NonNullable<FirmaWithSigners['urgencia']>, string> = {
  urgente: 'Urgente',
  importante: 'Importante',
  programado: 'Programado',
};
const urgenciaBg: Record<NonNullable<FirmaWithSigners['urgencia']>, string> = {
  urgente: 'bg-rust text-white',
  importante: 'bg-gold-light text-gold',
  programado: 'bg-sand-l text-dark-2',
};

export function FirmasSection({ canEdit }: { canEdit: boolean }) {
  const query = useFirmas();
  const create = useCreateFirma();
  const update = useUpdateFirma();
  const remove = useDeleteFirma();
  const miembros = useBoardMiembros();
  const toast = useToast();
  const confirm = useConfirm();

  const [editing, setEditing] = useState<FirmaWithSigners | null | undefined>(undefined);

  const codigoById = new Map<string, string>();
  for (const m of miembros.data ?? []) codigoById.set(m.id, m.codigo);

  async function handleSave(values: FirmaInsert, miembroIds: string[]) {
    try {
      if (editing && editing.id) {
        await update.mutateAsync({ id: editing.id, patch: values, miembroIds });
        toast.success('Firma actualizada.');
      } else {
        await create.mutateAsync({ input: values, miembroIds });
        toast.success('Firma creada.');
      }
      setEditing(undefined);
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  async function handleDelete(row: FirmaWithSigners) {
    const ok = await confirm({
      title: 'Borrar firma',
      message: <>¿Borrar la firma <strong>{row.tipo}</strong>?</>,
      danger: true,
      confirmLabel: 'Borrar',
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(row.id);
      toast.success('Firma borrada.');
    } catch (err) {
      toast.error(describeError(err, 'delete'));
    }
  }

  const columns: DataTableColumn<FirmaWithSigners>[] = [
    {
      key: 'recepcion',
      header: 'Recepción',
      sortable: true,
      accessor: (r) => r.recepcion,
      render: (r) => (r.recepcion ? formatDate(r.recepcion) : '—'),
    },
    {
      key: 'tipo',
      header: 'Documento',
      sortable: true,
      accessor: (r) => r.tipo,
      render: (r) => <span className="font-medium text-dark">{r.tipo}</span>,
    },
    {
      key: 'urgencia',
      header: 'Urgencia',
      sortable: true,
      accessor: (r) => r.urgencia,
      render: (r) =>
        r.urgencia ? (
          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${urgenciaBg[r.urgencia]}`}>
            {urgenciaLabel[r.urgencia]}
          </span>
        ) : (
          '—'
        ),
    },
    {
      key: 'status_firma',
      header: 'Estado',
      sortable: true,
      accessor: (r) => r.status_firma,
      render: (r) => (
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusBg[r.status_firma]}`}>
          {statusLabel[r.status_firma]}
        </span>
      ),
    },
    {
      key: 'firmantes',
      header: 'Firmantes',
      render: (r) => {
        if (r.miembro_ids.length === 0) return <span className="text-dark-3">—</span>;
        return (
          <span className="flex flex-wrap gap-1">
            {r.miembro_ids.map((mid) => (
              <span key={mid} className="inline-flex rounded bg-sand-l px-1.5 py-0.5 text-xs font-semibold text-dark-2">
                {codigoById.get(mid) ?? '?'}
              </span>
            ))}
          </span>
        );
      },
    },
  ];

  return (
    <section className="space-y-4">
      <header className="flex items-end justify-between">
        <div>
          <h2 className="font-heading text-xl font-semibold text-dark">Firmas</h2>
          <p className="mt-1 text-sm text-dark-2">
            Documentos que requieren firma de uno o varios miembros del board.
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setEditing(null)}
            className="rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-d"
          >
            + Nueva firma
          </button>
        )}
      </header>

      <DataTable<FirmaWithSigners>
        data={query.data ?? []}
        columns={columns}
        loading={query.isLoading}
        error={query.isError ? describeError(query.error) : null}
        onRetry={() => void query.refetch()}
        emptyMessage="Sin firmas todavía."
        rowKey={(r) => r.id}
        actions={
          canEdit
            ? (row) => (
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setEditing(row)} className="rounded-md border border-sand px-3 py-1 text-xs font-semibold text-dark-2 hover:bg-sand-l">
                    Editar
                  </button>
                  <button type="button" onClick={() => void handleDelete(row)} className="rounded-md border border-rust/40 px-3 py-1 text-xs font-semibold text-rust hover:bg-rust-l">
                    Borrar
                  </button>
                </div>
              )
            : undefined
        }
      />

      <Modal
        open={editing !== undefined}
        onClose={() => setEditing(undefined)}
        title={editing ? `Editar — ${editing.tipo}` : 'Nueva firma'}
        size="xl"
      >
        <FirmaForm
          initial={editing ?? null}
          submitting={create.isPending || update.isPending}
          onSubmit={handleSave}
          onCancel={() => setEditing(undefined)}
        />
      </Modal>
    </section>
  );
}

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { PrintableModal } from '@/components/ui/PrintableModal';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { describeError } from '@/modules/admin/hooks';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import type { Vale, ValeInsert } from './api';
import { ValeForm } from './ValeForm';
import { ValePrintable } from './ValePrintable';
import { useCreateVale, useDeleteVale, useUpdateVale, useVales } from './hooks';

function fmtMoney(n: number, currency: string): string {
  if (currency === 'GTQ') return formatMoney(n);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
}

const statusBg: Record<Vale['estado'], string> = {
  Creado: 'bg-sand text-dark',
  Solicitado: 'bg-gold-light text-gold',
  Acreditado: 'bg-blue-light text-blue',
  Aprobado: 'bg-blue-light text-blue',
  EnLiquidacion: 'bg-blue-light text-blue',
  'Asignado a Liquidación': 'bg-blue-light text-blue',
  'Pendiente de Liquidar': 'bg-rust-l text-rust',
  'Pendiente de Reintegro': 'bg-gold-light text-gold',
  Liquidado: 'bg-teal-l text-teal-d',
  Pagado: 'bg-teal text-white',
  Reintegrado: 'bg-purple text-white',
  Cancelado: 'bg-rust-l text-rust',
  Anulado: 'bg-rust text-white',
};

export function ValesSection({ canEdit }: { canEdit: boolean }) {
  const query = useVales();
  const create = useCreateVale();
  const update = useUpdateVale();
  const remove = useDeleteVale();
  const toast = useToast();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<Vale | null | undefined>(undefined);
  const [viewing, setViewing] = useState<Vale | null>(null);

  async function handleSave(values: ValeInsert) {
    try {
      if (editing && editing.id) {
        await update.mutateAsync({ id: editing.id, patch: values });
        toast.success('Vale actualizado.');
      } else {
        await create.mutateAsync(values);
        toast.success('Vale creado.');
      }
      setEditing(undefined);
    } catch (e) {
      toast.error(describeError(e));
    }
  }
  async function handleDelete(row: Vale) {
    const ok = await confirm({
      title: 'Borrar vale',
      message: <>¿Borrar <strong>{row.serial ?? row.vale_a}</strong>?</>,
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

  const columns: DataTableColumn<Vale>[] = [
    {
      key: 'serial',
      header: 'Serial',
      sortable: true,
      accessor: (r) => r.serial,
      render: (r) => <span className="font-mono text-xs font-semibold text-teal-d">{r.serial ?? '—'}</span>,
    },
    {
      key: 'vale_a',
      header: 'Vale a',
      sortable: true,
      accessor: (r) => r.vale_a,
      render: (r) => (
        <div>
          <div className="font-medium text-dark">{r.vale_a}</div>
          {r.entidad && <div className="text-xs text-dark-3">{r.entidad}</div>}
          {r.concepto && <div className="line-clamp-1 max-w-xs text-xs text-dark-3">{r.concepto}</div>}
        </div>
      ),
    },
    {
      key: 'monto',
      header: 'Monto',
      sortable: true,
      accessor: (r) => Number(r.monto),
      render: (r) => <span className="font-mono font-semibold text-dark">{fmtMoney(Number(r.monto), r.moneda)}</span>,
    },
    {
      key: 'fecha',
      header: 'Fecha',
      sortable: true,
      accessor: (r) => r.fecha,
      render: (r) => (r.fecha ? formatDate(r.fecha) : '—'),
    },
    {
      key: 'estado',
      header: 'Estado',
      sortable: true,
      accessor: (r) => r.estado,
      render: (r) => (
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusBg[r.estado] ?? 'bg-sand text-dark'}`}>
          {r.estado}
        </span>
      ),
    },
    {
      key: 'liquidacion_id',
      header: 'Liq.',
      accessor: (r) => r.liquidacion_id,
      render: (r) => r.liquidacion_id
        ? <span className="rounded bg-teal-l px-1.5 py-0.5 text-[10px] font-semibold text-teal-d">📎 vinculado</span>
        : <span className="text-dark-3">—</span>,
    },
  ];

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-heading text-xl font-semibold text-dark">Vales de caja chica</h2>
          <p className="mt-1 text-sm text-dark-2">
            Serial VL-AAAA-NNNN. Asignar uno a una liquidación lo marca como 'Asignado a Liquidación'.
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setEditing(null)}
            className="rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-d"
          >
            + Nuevo vale
          </button>
        )}
      </header>

      <DataTable<Vale>
        data={query.data ?? []}
        columns={columns}
        loading={query.isLoading}
        error={query.isError ? describeError(query.error) : null}
        onRetry={() => void query.refetch()}
        emptyMessage="Sin vales registrados."
        rowKey={(r) => r.id}
        actions={(row) => (
          <div className="flex justify-end gap-1">
            <button
              type="button"
              onClick={() => setViewing(row)}
              className="rounded-md border border-teal/40 px-2 py-1 text-xs font-semibold text-teal-d hover:bg-teal-l"
              title="Ver PDF"
            >
              👁
            </button>
            {canEdit && (
              <>
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
              </>
            )}
          </div>
        )}
      />

      <Modal
        open={editing !== undefined}
        onClose={() => setEditing(undefined)}
        title={editing?.id ? `Editar — ${editing.serial ?? editing.vale_a}` : 'Nuevo vale'}
        size="lg"
      >
        <ValeForm
          initial={editing ?? null}
          submitting={create.isPending || update.isPending}
          onSubmit={handleSave}
          onCancel={() => setEditing(undefined)}
        />
      </Modal>

      <PrintableModal
        open={viewing !== null}
        onClose={() => setViewing(null)}
        title={viewing?.serial ?? 'Vale'}
      >
        {viewing && <ValePrintable vale={viewing} />}
      </PrintableModal>
    </section>
  );
}

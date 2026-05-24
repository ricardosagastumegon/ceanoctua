import { useState } from 'react';
import { CatalogPage } from '@/modules/admin/components/CatalogPage';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { PrintableModal } from '@/components/ui/PrintableModal';
import { useAuth } from '@/lib/auth';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { ConstanciaForm } from './ConstanciaForm';
import { ConstanciaPrintable } from './ConstanciaPrintable';
import { useConstancias, useCreateConstancia, useDeleteConstancia, useUpdateConstancia } from './hooks';
import type { Constancia } from './api';

function formatTotal(n: number, currency: string): string {
  if (currency === 'GTQ') return formatMoney(n);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
}

export default function MielSjPage() {
  const { profile } = useAuth();
  const canEdit = profile?.rol === 'admin' || profile?.rol === 'asistente';

  const query = useConstancias();
  const create = useCreateConstancia();
  const update = useUpdateConstancia();
  const remove = useDeleteConstancia();
  const [viewing, setViewing] = useState<Constancia | null>(null);

  const columns: DataTableColumn<Constancia>[] = [
    {
      key: 'correlativo',
      header: 'Correlativo',
      sortable: true,
      accessor: (r) => r.correlativo,
      render: (r) => <span className="font-mono text-dark">{r.correlativo ?? '—'}</span>,
    },
    {
      key: 'fecha',
      header: 'Fecha',
      sortable: true,
      accessor: (r) => r.fecha,
      render: (r) => formatDate(r.fecha),
    },
    {
      key: 'nombre',
      header: 'Destinatario',
      sortable: true,
      accessor: (r) => r.nombre,
      render: (r) => <span className="font-medium text-dark">{r.nombre}</span>,
    },
    {
      key: 'items',
      header: 'Productos',
      render: (r) => (
        <span className="text-xs text-dark-2">
          {r.cant475 > 0 && <span className="block">{r.cant475} × 475g</span>}
          {r.cant1000 > 0 && <span className="block">{r.cant1000} × 1000g</span>}
          {r.envio && <span className="block text-teal-d">+ envío</span>}
        </span>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      sortable: true,
      accessor: (r) => Number(r.total),
      render: (r) => <span className="font-mono font-semibold text-dark">{formatTotal(Number(r.total), r.moneda)}</span>,
    },
  ];

  return (
    <>
      <CatalogPage<Constancia, import('./api').ConstanciaInsert>
        title="Miel SJ — Constancias"
        description="Comprobantes de entrega/venta. El correlativo se genera automáticamente en el servidor."
        newLabel="+ Nueva constancia"
        modalSize="xl"
        columns={columns}
        rows={query.data ?? []}
        loading={query.isLoading}
        isError={query.isError}
        error={query.error}
        onRetry={() => void query.refetch()}
        onCreate={(values) => create.mutateAsync(values)}
        onUpdate={(id, patch) => update.mutateAsync({ id, patch })}
        onDelete={(id) => remove.mutateAsync(id)}
        submitting={create.isPending || update.isPending}
        Form={ConstanciaForm}
        rowLabel={(r) => r.correlativo ?? r.nombre}
        canEdit={canEdit}
        extraActions={(row) => (
          <button
            type="button"
            onClick={() => setViewing(row)}
            className="rounded-md border border-teal/40 px-2 py-1 text-xs font-semibold text-teal-d hover:bg-teal-l"
            title="Ver PDF"
          >
            👁
          </button>
        )}
      />

      <PrintableModal
        open={viewing !== null}
        onClose={() => setViewing(null)}
        title={viewing?.correlativo ?? 'Constancia'}
      >
        {viewing && <ConstanciaPrintable c={viewing} />}
      </PrintableModal>
    </>
  );
}

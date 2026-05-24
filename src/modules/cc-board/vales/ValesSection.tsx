import { CatalogPage } from '@/modules/admin/components/CatalogPage';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import type { Vale } from './api';
import { ValeForm } from './ValeForm';
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
    <CatalogPage<Vale, import('./api').ValeInsert>
      title="Vales de caja chica"
      description="Vales individuales con serial VL-AAAA-NNNN. Asignar uno a una liquidación lo marca automáticamente como 'Asignado a Liquidación'."
      newLabel="+ Nuevo vale"
      modalSize="lg"
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
      Form={ValeForm}
      rowLabel={(r) => r.serial ?? r.vale_a}
      canEdit={canEdit}
    />
  );
}

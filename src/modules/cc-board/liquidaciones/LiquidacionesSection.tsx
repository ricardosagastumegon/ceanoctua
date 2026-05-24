import { useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { PrintableModal } from '@/components/ui/PrintableModal';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { describeError } from '@/modules/admin/hooks';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { KPI } from '@/modules/dashboard/widgets';
import { LiquidacionForm, type LiquidacionFormValues } from './LiquidacionForm';
import { LiquidacionPrintable } from './LiquidacionPrintable';
import {
  useCreateLiquidacion,
  useDeleteLiquidacion,
  useLiqRows,
  useLiquidaciones,
  useUpdateLiquidacion,
} from './hooks';
import { LIQ_ESTADOS, type Liquidacion } from './api';

function fmt(n: number, currency: string): string {
  if (currency === 'GTQ') return formatMoney(n);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
}

function csvCell(s: unknown): string {
  if (s == null) return '';
  return `"${String(s).replace(/"/g, '""')}"`;
}
function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const estadoBg: Record<string, string> = {
  Generada: 'bg-sand text-dark-2',
  Autorizada: 'bg-blue-light text-blue',
  Presentada: 'bg-gold-light text-gold',
  Procesada: 'bg-teal-l text-teal-d',
  Pagada: 'bg-teal text-white',
};

export function LiquidacionesSection({ canEdit }: { canEdit: boolean }) {
  const query = useLiquidaciones();
  const create = useCreateLiquidacion();
  const update = useUpdateLiquidacion();
  const remove = useDeleteLiquidacion();
  const toast = useToast();
  const confirm = useConfirm();

  const [editing, setEditing] = useState<Liquidacion | null | undefined>(undefined);
  const [viewing, setViewing] = useState<Liquidacion | null>(null);
  const viewingRows = useLiqRows(viewing?.id);
  const [search, setSearch] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [filterName, setFilterName] = useState('');

  const all = query.data ?? [];

  // Filtros
  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return all.filter((r) => {
      if (filterEstado && r.estado !== filterEstado) return false;
      if (filterName && r.solicitado !== filterName) return false;
      if (s) {
        const blob = [r.serial, r.fecha, r.entidad, r.motivo, r.solicitado, r.producto]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!blob.includes(s)) return false;
      }
      return true;
    });
  }, [all, search, filterEstado, filterName]);

  // KPIs
  const kpis = useMemo(() => {
    const totalCount = all.length;
    const holdToPay = all.filter((r) => r.estado !== 'Pagada' && r.estado !== 'Anulada').length;
    const pagadas = all.filter((r) => r.estado === 'Pagada').length;
    const reintegradas = all.filter(
      (r) => r.estado === 'Pagada' && (!r.vale_monto || Number(r.vale_monto) === 0),
    ).length;
    return { totalCount, holdToPay, pagadas, reintegradas };
  }, [all]);

  // Totals por moneda (filtered footer)
  const totalsByMoneda = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of filtered) {
      m.set(r.moneda, (m.get(r.moneda) ?? 0) + Number(r.monto_total));
    }
    return Array.from(m.entries());
  }, [filtered]);

  // Nombres únicos para filtro
  const names = useMemo(() => {
    const s = new Set<string>();
    for (const r of all) if (r.solicitado) s.add(r.solicitado);
    return Array.from(s).sort();
  }, [all]);

  async function handleSave(values: LiquidacionFormValues) {
    try {
      if (editing && editing.id) {
        await update.mutateAsync({ id: editing.id, patch: values.patch, rows: values.rows });
        toast.success('Liquidación actualizada.');
      } else {
        await create.mutateAsync({ input: values.patch, rows: values.rows });
        toast.success('Liquidación creada.');
      }
      setEditing(undefined);
    } catch (e) {
      toast.error(describeError(e));
    }
  }

  async function handleDelete(row: Liquidacion) {
    const ok = await confirm({
      title: 'Borrar liquidación',
      message: <>¿Borrar la liquidación <strong>{row.serial ?? row.fecha}</strong>?</>,
      danger: true,
      confirmLabel: 'Borrar',
    });
    if (!ok) return;
    try {
      await remove.mutateAsync(row.id);
      toast.success('Borrada.');
    } catch (e) {
      toast.error(describeError(e, 'delete'));
    }
  }

  const columns: DataTableColumn<Liquidacion>[] = [
    {
      key: 'serial',
      header: 'Serie',
      sortable: true,
      accessor: (r) => r.serial,
      render: (r) => <span className="font-mono text-xs font-semibold text-teal-d">{r.serial ?? '—'}</span>,
    },
    {
      key: 'fecha',
      header: 'Fecha',
      sortable: true,
      accessor: (r) => r.fecha,
      render: (r) => formatDate(r.fecha),
    },
    {
      key: 'solicitado',
      header: 'Solicitado por',
      sortable: true,
      accessor: (r) => r.solicitado,
      render: (r) => <span className="font-medium text-dark">{r.solicitado ?? '—'}</span>,
    },
    {
      key: 'motivo',
      header: 'Motivo',
      accessor: (r) => r.motivo,
      render: (r) => <span className="line-clamp-1 block max-w-xs" title={r.motivo ?? ''}>{r.motivo ?? '—'}</span>,
    },
    {
      key: 'entidad',
      header: 'Entidad',
      accessor: (r) => r.entidad,
      render: (r) => r.entidad ?? <span className="text-dark-3">—</span>,
    },
    {
      key: 'payment_method',
      header: 'Forma de pago',
      accessor: (r) => r.payment_method,
      render: (r) => r.payment_method ? <span className="rounded bg-sand-l px-1.5 py-0.5 text-xs">{r.payment_method}</span> : '—',
    },
    {
      key: 'monto_total',
      header: 'Total',
      sortable: true,
      accessor: (r) => Number(r.monto_total),
      render: (r) => <span className="font-mono font-semibold">{fmt(Number(r.monto_total), r.moneda)}</span>,
    },
    {
      key: 'estado',
      header: 'Estado',
      sortable: true,
      accessor: (r) => r.estado,
      render: (r) => (
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${estadoBg[r.estado] ?? 'bg-sand text-dark-2'}`}>
          {r.estado}
        </span>
      ),
    },
  ];

  function exportCsv() {
    if (filtered.length === 0) return;
    const header = ['Serial', 'Fecha', 'Solicitado', 'Motivo', 'Producto', 'Entidad', 'Forma pago', 'Moneda', 'Total', 'Vale', 'Diferencia', 'Estado', 'Vale serial']
      .map(csvCell).join(',');
    const lines = filtered.map((r) =>
      [
        r.serial,
        formatDate(r.fecha),
        r.solicitado,
        r.motivo,
        r.producto,
        r.entidad,
        r.payment_method,
        r.moneda,
        Number(r.monto_total).toFixed(2),
        Number(r.vale_monto ?? 0).toFixed(2),
        Number(r.diff ?? 0).toFixed(2),
        r.estado,
        r.vale_serial,
      ].map(csvCell).join(','),
    );
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    downloadCsv(`liquidaciones_${date}.csv`, [header, ...lines].join('\n'));
  }

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-heading text-xl font-semibold text-dark">Liquidaciones de caja chica</h2>
          <p className="mt-1 text-sm text-dark-2">
            Agrupa compras con motivo, forma de pago y opcional vínculo a un vale.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={exportCsv}
            disabled={filtered.length === 0}
            className="rounded-md border border-teal/40 px-3 py-1.5 text-xs font-semibold text-teal-d hover:bg-teal-l disabled:opacity-50"
          >
            ⬇ Exportar CSV ({filtered.length})
          </button>
          {canEdit && (
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-d"
            >
              + Nueva liquidación
            </button>
          )}
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KPI label="Total liquidaciones" value={kpis.totalCount} />
        <KPI label="Hold to pay" value={kpis.holdToPay} tone={kpis.holdToPay > 0 ? 'danger' : 'default'} hint="pendientes" />
        <KPI label="Pagadas" value={kpis.pagadas} tone="success" />
        <KPI label="Reintegradas" value={kpis.reintegradas} tone="warn" hint="pagadas sin vale" />
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 gap-3 rounded-md border border-sand bg-white p-3 sm:grid-cols-4">
        <input
          type="search"
          placeholder="Buscar (serie, motivo, entidad, solicitado…)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded border border-sand px-3 py-1.5 text-sm sm:col-span-2"
        />
        <select
          value={filterEstado}
          onChange={(e) => setFilterEstado(e.target.value)}
          className="rounded border border-sand px-2 py-1.5 text-sm"
        >
          <option value="">Todos los estados</option>
          {LIQ_ESTADOS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={filterName}
          onChange={(e) => setFilterName(e.target.value)}
          className="rounded border border-sand px-2 py-1.5 text-sm"
        >
          <option value="">Todos los nombres</option>
          {names.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

      <DataTable<Liquidacion>
        data={filtered}
        columns={columns}
        loading={query.isLoading}
        error={query.isError ? describeError(query.error) : null}
        onRetry={() => void query.refetch()}
        emptyMessage="Sin liquidaciones con estos filtros."
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

      {/* Footer totals */}
      {totalsByMoneda.length > 0 && (
        <div className="flex flex-wrap items-center justify-end gap-3 rounded-md border border-sand bg-sand-l/30 px-4 py-2 text-sm">
          <span className="text-dark-2">Total — <strong>{filtered.length}</strong> liquidación{filtered.length === 1 ? '' : 'es'}</span>
          {totalsByMoneda.map(([m, sum]) => (
            <span key={m} className="font-mono font-semibold text-dark">{fmt(sum, m)}</span>
          ))}
        </div>
      )}

      <Modal
        open={editing !== undefined}
        onClose={() => setEditing(undefined)}
        title={editing?.id ? `Editar — ${editing.serial ?? editing.motivo ?? editing.fecha}` : 'Nueva liquidación'}
        size="xl"
      >
        <LiquidacionForm
          initial={editing ?? null}
          submitting={create.isPending || update.isPending}
          onSubmit={handleSave}
          onCancel={() => setEditing(undefined)}
        />
      </Modal>

      <PrintableModal
        open={viewing !== null}
        onClose={() => setViewing(null)}
        title={viewing?.serial ?? 'Liquidación'}
      >
        {viewing && (
          <LiquidacionPrintable liq={viewing} rows={viewingRows.data ?? []} />
        )}
      </PrintableModal>
    </section>
  );
}

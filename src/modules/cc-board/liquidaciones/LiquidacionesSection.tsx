import { useEffect, useMemo, useState } from 'react';
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
  useReplaceLinkedVales,
  useUpdateLiquidacion,
} from './hooks';
import { LIQ_ESTADOS, type Liquidacion, type LiquidacionInsert } from './api';
import { pushPagoNotificacion } from '@/modules/finanzas/pagos/NotificacionesPanel';
import { CsvImporter, type ColumnMapping } from '@/components/ui/CsvImporter';
import { useEntidades } from '@/modules/admin/hooks';

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
  const replaceVales = useReplaceLinkedVales();
  const entidadesList = useEntidades();
  const [importerOpen, setImporterOpen] = useState(false);
  // Estado para pre-vincular un vale al abrir la sección desde el botón
  // "+ Liquidar" de ValesSection (vía sessionStorage).
  const [preLinkValeId, setPreLinkValeId] = useState<string | null>(null);

  useEffect(() => {
    const id = sessionStorage.getItem('preLinkValeId');
    if (id) {
      sessionStorage.removeItem('preLinkValeId');
      setPreLinkValeId(id);
      // Abre el form de nueva liquidación; el LiquidacionForm leerá
      // preLinkValeId al inicializar selectedValeIds.
      setEditing(null);
    }
  }, []);

  const entidadByNombre = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of entidadesList.data ?? []) m.set(e.nombre.toLowerCase().trim(), e.id);
    return m;
  }, [entidadesList.data]);

  const importMappings: ColumnMapping<LiquidacionInsert>[] = [
    { headerAlias: 'fecha|date', field: 'fecha', required: true },
    { headerAlias: 'motivo|motivo|reason', field: 'motivo', required: true },
    { headerAlias: 'solicitado|solicitado_por|solicitante', field: 'solicitado', required: true },
    { headerAlias: 'entidad|empresa', field: 'entidad' },
    { headerAlias: 'producto|producto_servicio|servicio', field: 'producto_servicio' },
    { headerAlias: 'forma_pago|payment_method|pago', field: 'forma_pago' },
    { headerAlias: 'reintegrar_a|reintegrar', field: 'reintegrar_a' },
    { headerAlias: 'moneda|currency', field: 'moneda', transform: (s) => {
      const v = s.toUpperCase().trim();
      return ['GTQ', 'USD', 'EUR', 'GBP'].includes(v) ? v : 'GTQ';
    } },
    { headerAlias: 'monto_total|total|monto', field: 'monto_total', transform: (s) => Number(s.replace(/[^0-9.-]/g, '')) },
    { headerAlias: 'estado|status', field: 'estado' },
    { headerAlias: 'comentarios|notas', field: 'comentarios' },
  ];
  void entidadByNombre; // por ahora solo se valida texto; el lookup queda
  // disponible para una futura iteración con entidad_id.
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
      let liqId: string;
      if (editing && editing.id) {
        await update.mutateAsync({ id: editing.id, patch: values.patch, rows: values.rows });
        liqId = editing.id;
        toast.success('Liquidación actualizada.');
      } else {
        const created = await create.mutateAsync({ input: values.patch, rows: values.rows });
        liqId = created.id;
        toast.success('Liquidación creada.');
      }
      // Fase 17 · F-2: sync junction de vales vinculados.
      await replaceVales.mutateAsync({ liqId, valeIds: values.valeIds });
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
          {canEdit && (
            <button
              type="button"
              onClick={() => setImporterOpen(true)}
              className="rounded-md border border-teal/40 px-3 py-1.5 text-xs font-semibold text-teal-d hover:bg-teal-l"
            >
              ⬆ Importar
            </button>
          )}
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
        actions={(row) => {
          const isSP =
            row.forma_pago === 'Solicitud de Pago' ||
            row.payment_method === 'Solicitud de Pago';
          return (
            <div className="flex justify-end gap-1">
              <button
                type="button"
                onClick={() => setViewing(row)}
                className="rounded-md border border-teal/40 px-2 py-1 text-xs font-semibold text-teal-d hover:bg-teal-l"
                title="Ver PDF"
              >
                👁
              </button>
              {canEdit && isSP && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await pushPagoNotificacion({
                        origen_tipo: 'liquidacion',
                        origen_id: row.id,
                        monto: Number(row.monto_total),
                        moneda: row.moneda,
                        resumen: `Liquidación ${row.serial ?? ''} · ${row.motivo ?? '(sin motivo)'} · ${row.solicitado ?? ''}`,
                      });
                      toast.success('Enviado a Pagos · ver Notificaciones');
                    } catch (e) {
                      toast.error(describeError(e));
                    }
                  }}
                  className="rounded-md border border-purple/40 bg-purple/10 px-2 py-1 text-xs font-semibold text-purple hover:bg-purple/20"
                  title="Enviar a Pagos como notificación"
                >
                  💸 PAGOS
                </button>
              )}
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
          );
        }}
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
          preLinkValeId={editing?.id ? null : preLinkValeId}
          submitting={create.isPending || update.isPending}
          onSubmit={(values) => {
            setPreLinkValeId(null);
            return handleSave(values);
          }}
          onCancel={() => {
            setPreLinkValeId(null);
            setEditing(undefined);
          }}
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

      <CsvImporter<LiquidacionInsert>
        open={importerOpen}
        onClose={() => setImporterOpen(false)}
        title="Importar liquidaciones (solo headers — renglones/vales se agregan editando cada una)"
        mappings={importMappings}
        onImportRow={async (row) => {
          const r = row as LiquidacionInsert;
          if (!r.moneda) r.moneda = 'GTQ';
          if (!r.estado) r.estado = 'Generada';
          await create.mutateAsync({ input: r, rows: [] });
        }}
        exampleCsv={'fecha,motivo,solicitado,entidad,forma_pago,moneda,monto_total\n2026-05-15,Compra plantas oficina,Lissa Arriaza,AGROATLANTIC,Caja Chica,GTQ,1500\n2026-05-16,Reparación AC,Angeles Quezada,SUREÑA S.A.,Solicitud de Pago,GTQ,3200'}
      />
    </section>
  );
}

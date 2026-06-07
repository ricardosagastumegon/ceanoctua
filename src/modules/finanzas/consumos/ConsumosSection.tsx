import { useMemo, useState } from 'react';
import { CatalogPage } from '@/modules/admin/components/CatalogPage';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { addBusinessDays, bizDaysLeft, dueStateFor, formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { useToast } from '@/components/ui/Toast';
import { describeError } from '@/modules/admin/hooks';
import { useConsumos, useCreateConsumo, useDeleteConsumo, useUpdateConsumo } from './hooks';
import type { Consumo } from './api';
import { ConsumoForm } from './ConsumoForm';
import { pushPagoNotificacion } from '@/modules/finanzas/pagos/NotificacionesPanel';
import { TcGallery } from './TcGallery';
import { CsvImporter, type ColumnMapping } from '@/components/ui/CsvImporter';
import { PrintableModal } from '@/components/ui/PrintableModal';
import { useAutorizadores, useProveedores, useTarjetas } from '@/modules/admin/hooks';
import type { ConsumoInsert } from './api';
import { ConsumoPrintable } from './ConsumoPrintable';

function fmt(n: number, currency: string): string {
  if (currency === 'GTQ') return formatMoney(Number(n));
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(n));
}

const REINTEGRO_DEADLINE_BIZDAYS = 7;

function venceBadge(consumo: Consumo): { label: string; tone: string } | null {
  if (consumo.reintegro_id) return { label: '✓ reintegrado', tone: 'bg-teal-l text-teal-d' };
  const due = addBusinessDays(consumo.fecha, REINTEGRO_DEADLINE_BIZDAYS);
  const left = bizDaysLeft(due);
  const state = dueStateFor(due, false, 2);
  if (state === 'over') return { label: 'VENCIDO', tone: 'bg-rust text-white' };
  if (state === 'warn') return { label: `⚡ ${left}d`, tone: 'bg-gold-light text-gold' };
  return { label: `${left}d`, tone: 'bg-teal-l text-teal-d' };
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function csvCell(s: string | number | null | undefined): string {
  if (s == null) return '';
  const str = String(s).replace(/"/g, '""');
  return `"${str}"`;
}

export function ConsumosSection({ canEdit }: { canEdit: boolean }) {
  const toast = useToast();
  const query = useConsumos();
  const create = useCreateConsumo();
  const tarjetasList = useTarjetas();
  const proveedoresList = useProveedores();
  const autorizadoresList = useAutorizadores();
  const [importerOpen, setImporterOpen] = useState(false);
  const [viewing, setViewing] = useState<import('./api').Consumo | null>(null);

  // Lookups por nombre/tc_id case-insensitive.
  const tarjetaByTcId = useMemo(() => {
    const m = new Map<string, { id: string; tc_id: string; empresa: string | null }>();
    for (const t of tarjetasList.data ?? []) {
      m.set(t.tc_id.toLowerCase().trim(), { id: t.id, tc_id: t.tc_id, empresa: t.empresa });
    }
    return m;
  }, [tarjetasList.data]);
  const proveedorByNombre = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of proveedoresList.data ?? []) m.set(p.nombre.toLowerCase().trim(), p.id);
    return m;
  }, [proveedoresList.data]);
  const autorizadorByNombre = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of autorizadoresList.data ?? []) m.set(a.nombre.toLowerCase().trim(), a.id);
    return m;
  }, [autorizadoresList.data]);

  const importMappings: ColumnMapping<ConsumoInsert>[] = [
    { headerAlias: 'fecha|date', field: 'fecha', required: true },
    { headerAlias: 'card_id|tarjeta|tc_id|terminacion|terminación', field: 'card_id', required: true },
    { headerAlias: 'tarjeta_id|tarjeta_uuid', field: 'tarjeta_id', transform: (s) => {
      // Si llega un tc_id (como "TC Corp Agro Term. 7274"), lookup al uuid.
      const direct = tarjetaByTcId.get(s.toLowerCase().trim());
      return direct?.id ?? null;
    } },
    { headerAlias: 'empresa|company', field: 'empresa' },
    { headerAlias: 'empresa_codigo|prefijo|code', field: 'empresa_codigo', transform: (s) => s.toUpperCase() },
    { headerAlias: 'proveedor|supplier', field: 'proveedor', required: true },
    { headerAlias: 'proveedor_id|proveedor_uuid', field: 'proveedor_id', transform: (s) =>
      proveedorByNombre.get(s.toLowerCase().trim()) ?? null,
    },
    { headerAlias: 'concepto|concept|description', field: 'concepto', required: true },
    { headerAlias: 'monto|amount|total', field: 'monto', required: true, transform: (s) => Number(s.replace(/[^0-9.-]/g, '')) },
    { headerAlias: 'moneda|currency', field: 'moneda', transform: (s) => {
      const v = s.toUpperCase().trim();
      return ['GTQ', 'USD', 'EUR', 'GBP'].includes(v) ? v : 'GTQ';
    } },
    { headerAlias: 'autorizo|autorizador|autorizado_por', field: 'autorizador_id', transform: (s) =>
      autorizadorByNombre.get(s.toLowerCase().trim()) ?? null,
    },
    { headerAlias: 'solicitado_por|solicitado', field: 'solicitado_por' },
    { headerAlias: 'no_autorizacion|no_aut|num_aut', field: 'no_autorizacion' },
    { headerAlias: 'pagado_por', field: 'pagado_por' },
  ];
  const update = useUpdateConsumo();
  const remove = useDeleteConsumo();

  const [filterCard, setFilterCard] = useState('');
  const [filterText, setFilterText] = useState('');

  const all = query.data ?? [];

  const cards = useMemo(() => {
    const s = new Set<string>();
    for (const r of all) s.add(r.card_id);
    return Array.from(s).sort();
  }, [all]);

  const filtered = useMemo(() => {
    const tx = filterText.trim().toLowerCase();
    return all.filter((r) => {
      if (filterCard && r.card_id !== filterCard) return false;
      if (tx) {
        const blob = [r.proveedor, r.concepto, r.voucher_num, r.empresa].filter(Boolean).join(' ').toLowerCase();
        if (!blob.includes(tx)) return false;
      }
      return true;
    });
  }, [all, filterCard, filterText]);

  const totalsByMoneda = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of filtered) m.set(r.moneda, (m.get(r.moneda) ?? 0) + Number(r.monto));
    return Array.from(m.entries());
  }, [filtered]);

  function exportCsv() {
    if (filtered.length === 0) return;
    const header = ['Fecha', 'Empresa', 'Tarjeta', 'Proveedor', 'Concepto', 'Moneda', 'Monto', 'Voucher', 'Vence', 'Reintegro'].map(csvCell).join(',');
    const lines = filtered.map((r) => {
      const due = r.reintegro_id ? '' : addBusinessDays(r.fecha, REINTEGRO_DEADLINE_BIZDAYS);
      const left = r.reintegro_id ? '' : `${bizDaysLeft(due)}d`;
      return [
        formatDate(r.fecha),
        r.empresa,
        r.card_id,
        r.proveedor,
        r.concepto,
        r.moneda,
        Number(r.monto).toFixed(2),
        r.voucher_num,
        left,
        r.reintegro_id ? '✓' : '',
      ].map(csvCell).join(',');
    });
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    downloadCsv(`consumos_tc_${date}.csv`, [header, ...lines].join('\n'));
  }

  const columns: DataTableColumn<Consumo>[] = [
    { key: 'voucher_num', header: 'Voucher', sortable: true, accessor: (r) => r.voucher_num, render: (r) => <span className="font-mono text-xs text-dark">{r.voucher_num ?? '—'}</span> },
    { key: 'fecha', header: 'Fecha', sortable: true, accessor: (r) => r.fecha, render: (r) => formatDate(r.fecha) },
    { key: 'card_id', header: 'Tarjeta', sortable: true, accessor: (r) => r.card_id, render: (r) => <span className="font-mono text-xs text-dark-2">{r.card_id}</span> },
    { key: 'proveedor', header: 'Proveedor', sortable: true, accessor: (r) => r.proveedor, render: (r) => <span className="font-medium text-dark">{r.proveedor}</span> },
    { key: 'concepto', header: 'Concepto', accessor: (r) => r.concepto, render: (r) => <span className="line-clamp-1 block max-w-md">{r.concepto}</span> },
    { key: 'monto', header: 'Monto', sortable: true, accessor: (r) => Number(r.monto), render: (r) => <span className="font-mono font-semibold text-dark">{fmt(Number(r.monto), r.moneda)}</span> },
    {
      key: 'vence',
      header: 'Vence (7d háb.)',
      render: (r) => {
        const b = venceBadge(r);
        if (!b) return <span className="text-dark-3">—</span>;
        return <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${b.tone}`}>{b.label}</span>;
      },
    },
  ];

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-xl font-semibold text-dark">Consumos de TC</h2>
          <p className="mt-1 text-sm text-dark-2">
            Cada consumo genera un voucher serial. El badge VENCE muestra los días hábiles hasta el límite de 7 días para reintegro.
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
            ⬇ Exportar CSV
          </button>
        </div>
      </header>

      <TcGallery filterCard={filterCard} onSelectCard={setFilterCard} />

      <div className="grid grid-cols-1 gap-2 rounded-md border border-sand bg-white p-3 sm:grid-cols-3">
        <select
          value={filterCard}
          onChange={(e) => setFilterCard(e.target.value)}
          className="rounded border border-sand px-2 py-1.5 text-sm"
        >
          <option value="">Todas las tarjetas</option>
          {cards.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input
          type="search"
          placeholder="Buscar proveedor, concepto, voucher…"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          className="rounded border border-sand px-3 py-1.5 text-sm sm:col-span-2"
        />
      </div>

      <CatalogPage<Consumo, import('./api').ConsumoInsert>
        title=""
        description=""
        newLabel="+ Nuevo consumo"
        modalSize="xl"
        columns={columns}
        rows={filtered}
        loading={query.isLoading}
        isError={query.isError}
        error={query.error}
        onRetry={() => void query.refetch()}
        onCreate={(values) => create.mutateAsync(values)}
        onUpdate={(id, patch) => update.mutateAsync({ id, patch })}
        onDelete={(id) => remove.mutateAsync(id)}
        submitting={create.isPending || update.isPending}
        Form={ConsumoForm}
        rowLabel={(r) => r.voucher_num ?? r.proveedor}
        canEdit={canEdit}
        extraActions={(row) => (
          <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setViewing(row)}
            className="rounded-md border border-teal/40 px-2 py-1 text-xs font-semibold text-teal-d hover:bg-teal-l"
            title="Ver PDF"
          >
            👁
          </button>
          <button
            type="button"
            onClick={async () => {
              try {
                await pushPagoNotificacion({
                  origen_tipo: 'consumo_tc',
                  origen_id: row.id,
                  monto: Number(row.monto),
                  moneda: row.moneda,
                  resumen: `Consumo ${row.voucher_num ?? ''} · ${row.proveedor} · ${row.concepto.slice(0, 40)}`,
                });
                toast.success('Enviado a Pagos · ver Notificaciones');
              } catch (e) {
                toast.error(describeError(e));
              }
            }}
            className="rounded-md border border-purple/40 bg-purple/10 px-2 py-1 text-xs font-semibold text-purple hover:bg-purple/20"
            title="Enviar a Pagos como notificación"
          >
            💸
          </button>
          </div>
        )}
      />

      <PrintableModal
        open={viewing !== null}
        onClose={() => setViewing(null)}
        title={viewing?.voucher_num ?? 'Consumo TC'}
      >
        {viewing && <ConsumoPrintable consumo={viewing} />}
      </PrintableModal>

      {totalsByMoneda.length > 0 && (
        <div className="flex flex-wrap items-center justify-end gap-3 rounded-md border border-sand bg-sand-l/30 px-4 py-2 text-sm">
          <span className="text-dark-2">Total — <strong>{filtered.length}</strong> consumo{filtered.length === 1 ? '' : 's'}</span>
          {totalsByMoneda.map(([m, sum]) => (
            <span key={m} className="font-mono font-semibold text-dark">{fmt(sum, m)}</span>
          ))}
        </div>
      )}

      <CsvImporter<ConsumoInsert>
        open={importerOpen}
        onClose={() => setImporterOpen(false)}
        title="Importar consumos TC desde CSV/Excel"
        mappings={importMappings}
        onImportRow={async (row) => {
          const r = row as ConsumoInsert;
          if (!r.moneda) r.moneda = 'GTQ';
          // Si vino tc_id como card_id pero no tarjeta_id, lookup ahora
          if (r.card_id && !r.tarjeta_id) {
            const t = tarjetaByTcId.get(r.card_id.toLowerCase().trim());
            if (t) r.tarjeta_id = t.id;
          }
          await create.mutateAsync(r);
        }}
        exampleCsv={'fecha,card_id,empresa,proveedor,concepto,monto,moneda,autorizo,solicitado_por\n2026-05-15,TC Corp Agro Term. 7274,AGROATLANTIC,Office Depot,Materiales,1250.50,GTQ,Javier Arriaza,Lucía Monrroy\n2026-05-16,TC Corp Bananera Term. 5523,BANANERA IZABAL,UBER Eats,Comida ejecutiva,275,GTQ,Lissa Arriaza,Angeles Quezada'}
      />
    </section>
  );
}

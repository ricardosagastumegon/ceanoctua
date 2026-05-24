import { useMemo, useState } from 'react';
import { CatalogPage } from '@/modules/admin/components/CatalogPage';
import type { DataTableColumn } from '@/components/ui/DataTable';
import { addBusinessDays, bizDaysLeft, dueStateFor, formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { useConsumos, useCreateConsumo, useDeleteConsumo, useUpdateConsumo } from './hooks';
import type { Consumo } from './api';
import { ConsumoForm } from './ConsumoForm';

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
  const query = useConsumos();
  const create = useCreateConsumo();
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
        <button
          type="button"
          onClick={exportCsv}
          disabled={filtered.length === 0}
          className="rounded-md border border-teal/40 px-3 py-1.5 text-xs font-semibold text-teal-d hover:bg-teal-l disabled:opacity-50"
        >
          ⬇ Exportar CSV
        </button>
      </header>

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
      />

      {totalsByMoneda.length > 0 && (
        <div className="flex flex-wrap items-center justify-end gap-3 rounded-md border border-sand bg-sand-l/30 px-4 py-2 text-sm">
          <span className="text-dark-2">Total — <strong>{filtered.length}</strong> consumo{filtered.length === 1 ? '' : 's'}</span>
          {totalsByMoneda.map(([m, sum]) => (
            <span key={m} className="font-mono font-semibold text-dark">{fmt(sum, m)}</span>
          ))}
        </div>
      )}
    </section>
  );
}

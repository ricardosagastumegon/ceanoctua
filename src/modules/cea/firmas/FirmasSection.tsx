import { useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { PrintableModal } from '@/components/ui/PrintableModal';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { describeError } from '@/modules/admin/hooks';
import { formatDate } from '@/lib/dates';
import { useBoardMiembros, useCreateFirma, useDeleteFirma, useFirmas, useUpdateFirma } from './hooks';
import type { FirmaInsert, FirmaWithSigners } from './api';
import { FirmaForm } from './FirmaForm';
import { FirmaPrintable } from './FirmaPrintable';

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
  const [viewing, setViewing] = useState<FirmaWithSigners | null>(null);
  const [reportFrom, setReportFrom] = useState('');
  const [reportTo, setReportTo] = useState('');

  const codigoById = new Map<string, string>();
  for (const m of miembros.data ?? []) codigoById.set(m.id, m.codigo);

  const filtered = useMemo(() => {
    const all = query.data ?? [];
    if (!reportFrom && !reportTo) return all;
    return all.filter((r) => {
      const d = r.recepcion?.slice(0, 10) ?? r.created_at.slice(0, 10);
      if (reportFrom && d < reportFrom) return false;
      if (reportTo && d > reportTo) return false;
      return true;
    });
  }, [query.data, reportFrom, reportTo]);

  function exportReport() {
    if (filtered.length === 0) return;
    const header = ['Serial', 'Recepción', 'Tipo', 'Urgencia', 'Estado', 'Firmantes', 'Solicitado', 'Entregado', 'Fecha firma', 'Fecha entrega', 'Quien recibe', 'Justificación'].map(csvCell).join(',');
    const lines = filtered.map((r) => {
      const firmantes = r.miembro_ids.map((mid) => codigoById.get(mid) ?? '?').join(' ');
      return [
        r.serial,
        r.recepcion ? formatDate(r.recepcion) : '',
        r.tipo,
        r.urgencia ?? '',
        r.status_firma,
        firmantes,
        r.solicitado ?? '',
        r.entregado ?? '',
        r.fecha_firma ? formatDate(r.fecha_firma) : '',
        r.fecha_entrega ? formatDate(r.fecha_entrega) : '',
        r.quien_recibe ?? '',
        r.justificacion ?? '',
      ].map(csvCell).join(',');
    });
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    downloadCsv(`firmas_${date}.csv`, [header, ...lines].join('\n'));
  }

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
      key: 'serial',
      header: 'Serial',
      sortable: true,
      accessor: (r) => r.serial,
      render: (r) => <span className="font-mono text-xs text-teal-d">{r.serial ?? '—'}</span>,
    },
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
      render: (r) => (
        <span className="font-medium text-dark">
          {r.tipo}
          {(r.fecha_firma || r.quien_recibe) && (
            <span className="ml-2 rounded-full bg-teal-l px-1.5 py-0.5 text-[9px] font-semibold text-teal-d">
              ✓ constancia
            </span>
          )}
        </span>
      ),
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

      {/* Reporte por rango */}
      <div className="grid grid-cols-1 gap-2 rounded-md border border-sand bg-white p-3 sm:grid-cols-4">
        <label className="text-xs text-dark-2">
          Desde
          <input type="date" value={reportFrom} onChange={(e) => setReportFrom(e.target.value)} className="mt-1 block w-full rounded border border-sand px-2 py-1 text-sm" />
        </label>
        <label className="text-xs text-dark-2">
          Hasta
          <input type="date" value={reportTo} onChange={(e) => setReportTo(e.target.value)} className="mt-1 block w-full rounded border border-sand px-2 py-1 text-sm" />
        </label>
        <button
          type="button"
          onClick={() => { setReportFrom(''); setReportTo(''); }}
          className="self-end rounded-md border border-sand px-3 py-1.5 text-xs font-semibold text-dark-2 hover:bg-sand-l"
        >
          Limpiar
        </button>
        <button
          type="button"
          onClick={exportReport}
          disabled={filtered.length === 0}
          className="self-end rounded-md border border-teal/40 px-3 py-1.5 text-xs font-semibold text-teal-d hover:bg-teal-l disabled:opacity-50"
        >
          ⬇ Exportar CSV ({filtered.length})
        </button>
      </div>

      <DataTable<FirmaWithSigners>
        data={filtered}
        columns={columns}
        loading={query.isLoading}
        error={query.isError ? describeError(query.error) : null}
        onRetry={() => void query.refetch()}
        emptyMessage="Sin firmas todavía."
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
                <button type="button" onClick={() => setEditing(row)} className="rounded-md border border-sand px-2 py-1 text-xs font-semibold text-dark-2 hover:bg-sand-l">
                  ✏️
                </button>
                <button type="button" onClick={() => void handleDelete(row)} className="rounded-md border border-rust/40 px-2 py-1 text-xs font-semibold text-rust hover:bg-rust-l">
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

      <PrintableModal
        open={viewing !== null}
        onClose={() => setViewing(null)}
        title={viewing?.serial ?? viewing?.tipo ?? 'Firma'}
      >
        {viewing && (
          <FirmaPrintable
            firma={viewing}
            codigos={viewing.miembro_ids.map((mid) => codigoById.get(mid) ?? '?')}
          />
        )}
      </PrintableModal>
    </section>
  );
}

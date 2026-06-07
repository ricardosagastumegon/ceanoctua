import { useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { PrintableModal } from '@/components/ui/PrintableModal';
import { CsvImporter, type ColumnMapping } from '@/components/ui/CsvImporter';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { describeError, useEmpleados, useEntidades } from '@/modules/admin/hooks';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import type { Database } from '@/types/database';
import type { Vale, ValeInsert } from './api';
import { ValeForm } from './ValeForm';
import { ValePrintable } from './ValePrintable';
import { useCreateVale, useDeleteVale, useUpdateVale, useVales } from './hooks';

type ValeTipo = Database['public']['Enums']['vale_tipo'];

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
  const empleados = useEmpleados();
  const entidades = useEntidades();
  const toast = useToast();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<Vale | null | undefined>(undefined);
  // Cuando se crea un nuevo vale, recuerda el tipo (desembolso o entidad)
  const [newTipo, setNewTipo] = useState<ValeTipo>('desembolso');
  const [viewing, setViewing] = useState<Vale | null>(null);
  const [importerOpen, setImporterOpen] = useState(false);

  // Importer: lookup por nombre case-insensitive → uuid.
  const empleadoByNombre = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of empleados.data ?? []) m.set(e.nombre.toLowerCase().trim(), e.id);
    return m;
  }, [empleados.data]);
  const entidadByNombre = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of entidades.data ?? []) m.set(e.nombre.toLowerCase().trim(), e.id);
    return m;
  }, [entidades.data]);

  const importMappings: ColumnMapping<ValeInsert>[] = [
    { headerAlias: 'tipo|kind', field: 'tipo', transform: (s) => {
      const v = s.toLowerCase().trim();
      return v === 'entidad' || v === 'a entidad' ? 'entidad' : 'desembolso';
    } },
    { headerAlias: 'fecha|date', field: 'fecha' },
    { headerAlias: 'monto|amount|total', field: 'monto', required: true, transform: (s) => Number(s.replace(/[^0-9.-]/g, '')) },
    { headerAlias: 'moneda|currency', field: 'moneda', transform: (s) => {
      const v = s.toUpperCase().trim();
      return ['GTQ', 'USD', 'EUR', 'GBP'].includes(v) ? v : 'GTQ';
    } },
    { headerAlias: 'vale_a|nombre|beneficiario', field: 'vale_a', required: true },
    { headerAlias: 'concepto|description|descripcion', field: 'concepto' },
    { headerAlias: 'lugar|place', field: 'lugar' },
    { headerAlias: 'empleado|vale_a_empleado|empleado_nombre', field: 'vale_a_empleado_id', transform: (s) =>
      empleadoByNombre.get(s.toLowerCase().trim()) ?? null,
    },
    { headerAlias: 'entidad|liquidar_a_entidad|entidad_nombre', field: 'liquidar_a_entidad_id', transform: (s) =>
      entidadByNombre.get(s.toLowerCase().trim()) ?? null,
    },
    { headerAlias: 'notas', field: 'notas' },
  ];

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

  function openNew(tipo: ValeTipo) {
    setNewTipo(tipo);
    setEditing(null);
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
      key: 'tipo',
      header: 'Tipo',
      sortable: true,
      accessor: (r) => r.tipo,
      render: (r) => (
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${r.tipo === 'entidad' ? 'bg-purple/10 text-purple' : 'bg-teal-l text-teal-d'}`}
        >
          {r.tipo === 'entidad' ? 'A entidad' : 'Desembolso'}
        </span>
      ),
    },
    {
      key: 'vale_a',
      header: 'Vale a',
      sortable: true,
      accessor: (r) => r.vale_a,
      render: (r) => (
        <div>
          <div className="font-medium text-dark">{r.vale_a}</div>
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
      header: 'Status',
      sortable: true,
      accessor: (r) => r.estado,
      render: (r) => (
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusBg[r.estado] ?? 'bg-sand text-dark'}`}>
          {r.estado}
        </span>
      ),
    },
  ];

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-heading text-xl font-semibold text-dark">Vales</h2>
          <p className="mt-1 text-sm text-dark-2">
            Serial <span className="font-mono">VL-AAAA-NNNN</span>. Vale por desembolso (empleado → entidad) o Vale a Entidad (entidad → empleado).
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setImporterOpen(true)}
              className="rounded-md border border-teal/40 px-3 py-2 text-sm font-semibold text-teal-d hover:bg-teal-l"
              title="Importar vales desde CSV/Excel"
            >
              ⬆ Importar
            </button>
            <button
              type="button"
              onClick={() => openNew('desembolso')}
              className="rounded-md bg-teal px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-d"
            >
              + Nuevo Vale
            </button>
            <button
              type="button"
              onClick={() => openNew('entidad')}
              className="rounded-md border border-purple/40 bg-purple/10 px-3 py-2 text-sm font-semibold text-purple hover:bg-purple/20"
            >
              + Vale a Entidad
            </button>
          </div>
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
        title={editing?.id ? `Editar — ${editing.serial ?? editing.vale_a}` : (newTipo === 'entidad' ? 'Vale a Entidad' : 'Nuevo Vale')}
        size="lg"
      >
        <ValeForm
          initial={editing ?? null}
          defaultTipo={newTipo}
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

      <CsvImporter<ValeInsert>
        open={importerOpen}
        onClose={() => setImporterOpen(false)}
        title="Importar vales desde CSV/Excel"
        mappings={importMappings}
        onImportRow={async (row) => {
          // El parser deja moneda undefined si la columna no existe — el insert necesita un default.
          const r = row as ValeInsert;
          if (!r.moneda) r.moneda = 'GTQ';
          await create.mutateAsync(r);
        }}
        exampleCsv={'tipo,fecha,monto,moneda,vale_a,concepto,empleado,entidad\ndesembolso,2026-05-15,1000,GTQ,Angeles Quezada,Compra de plantas,Angeles Quezada,AGROATLANTIC\nentidad,2026-05-20,500,GTQ,SUREÑA S.A.,Reembolso,Juan Perez,SUREÑA S.A.'}
      />
    </section>
  );
}

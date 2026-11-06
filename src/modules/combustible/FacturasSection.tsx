import { useMemo, useState } from 'react';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { TextInput } from '@/components/ui/TextInput';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { useProveedores } from '@/modules/admin/hooks';
import { FacturaForm } from './FacturaForm';
import type { Factura, FacturaInsert } from './api';
import { mensajeDeError, useBorrarFactura, useFacturas, useGuardarFactura, useSolicitudes } from './hooks';

/**
 * Las facturas de la gasolinera.
 *
 * Una factura cubre uno o varios vales del mismo dia --la usuaria lo
 * confirmo: por despacho casi siempre, por dos despachos a veces, por
 * quincena nunca. La tabla ensena las dos cifras que importan: lo que dice el
 * papel y lo que suman los despachos que cubre. Mientras coincidan no hay
 * nada que mirar; cuando no, se ve de un vistazo y en que factura.
 */
export function FacturasSection({ canEdit, canDelete }: { canEdit: boolean; canDelete: boolean }) {
  const toast = useToast();
  const confirm = useConfirm();

  const facturasQ = useFacturas();
  const solicitudesQ = useSolicitudes();
  const proveedoresQ = useProveedores();

  const { guardar: guardarFactura, guardando } = useGuardarFactura();
  const borrar = useBorrarFactura();

  const [dlg, setDlg] = useState<{ tipo: 'cerrado' } | { tipo: 'nueva' } | { tipo: 'editar'; f: Factura }>(
    { tipo: 'cerrado' },
  );
  const [busca, setBusca] = useState('');

  const proveedorPorId = useMemo(
    () => new Map((proveedoresQ.data ?? []).map((p) => [p.id, p.nombre])),
    [proveedoresQ.data],
  );

  const valesDe = (f: Factura) =>
    (solicitudesQ.data ?? []).filter((s) => s.factura_id === f.id);

  const filas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return facturasQ.data ?? [];
    return (facturasQ.data ?? []).filter((f) =>
      [f.serie, f.numero, f.contrasena_num, proveedorPorId.get(f.proveedor_id ?? '')]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [facturasQ.data, busca, proveedorPorId]);

  async function guardar(valores: FacturaInsert, solicitudIds: string[]) {
    try {
      await guardarFactura(dlg.tipo === 'editar' ? dlg.f.id : null, valores, solicitudIds);
      toast.success(dlg.tipo === 'editar' ? 'Factura actualizada.' : 'Factura registrada.');
      setDlg({ tipo: 'cerrado' });
    } catch (e) {
      toast.error(mensajeDeError(e));
    }
  }

  const columnas: DataTableColumn<Factura>[] = [
    {
      key: 'numero',
      header: 'Factura',
      sortable: true,
      accessor: (f) => f.numero,
      render: (f) => (
        <div>
          <div className="font-medium text-dark">
            {[f.serie, f.numero].filter(Boolean).join(' · ') || '—'}
          </div>
          <div className="text-xs text-dark-3">{f.fecha ? formatDate(f.fecha) : ''}</div>
        </div>
      ),
    },
    {
      key: 'proveedor',
      header: 'Proveedor',
      render: (f) => proveedorPorId.get(f.proveedor_id ?? '') ?? <span className="text-dark-3">—</span>,
    },
    {
      key: 'vales',
      header: 'Vales',
      className: 'text-right',
      render: (f) => {
        const v = valesDe(f);
        if (v.length === 0) return <span className="text-rust">ninguno</span>;
        return v.length;
      },
    },
    {
      key: 'monto',
      header: 'Monto',
      className: 'text-right',
      sortable: true,
      accessor: (f) => f.monto,
      render: (f) => {
        const suma = valesDe(f).reduce((a, s) => a + (s.monto ?? 0), 0);
        const difiere = f.monto != null && suma > 0 && Math.abs(f.monto - suma) >= 0.01;
        return (
          <div>
            <div>{f.monto != null ? formatMoney(f.monto) : <span className="text-dark-3">—</span>}</div>
            {difiere && (
              <div className="text-xs text-rust" title="Lo que suman los despachos que cubre">
                vales: {formatMoney(suma)}
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'contrasena',
      header: 'Contraseña',
      render: (f) =>
        f.contrasena_num ? (
          <span>
            {f.contrasena_num}
            {f.contrasena_vencimiento && (
              <span className="block text-xs text-dark-3">
                vence {formatDate(f.contrasena_vencimiento)}
              </span>
            )}
          </span>
        ) : (
          <span className="text-dark-3">—</span>
        ),
    },
  ];

  const boton =
    'rounded-md border border-sand px-3 py-1 text-xs font-semibold text-dark-2 hover:bg-sand-l disabled:opacity-40';
  const botonRojo =
    'rounded-md border border-rust/40 px-3 py-1 text-xs font-semibold text-rust hover:bg-rust-l disabled:opacity-40';

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <TextInput
          label="Buscar"
          placeholder="Número, serie, contraseña…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="w-64"
        />
        {canEdit && (
          <button
            type="button"
            onClick={() => setDlg({ tipo: 'nueva' })}
            className="rounded-md bg-teal px-4 py-2 text-sm font-medium text-white hover:bg-teal/90"
          >
            Nueva factura
          </button>
        )}
      </div>

      <DataTable
        data={filas}
        columns={columnas}
        rowKey={(f) => f.id}
        loading={facturasQ.isLoading}
        error={facturasQ.error?.message ?? null}
        onRetry={() => void facturasQ.refetch()}
        emptyMessage="Todavía no hay facturas."
        actions={(f) => (
          <div className="flex flex-wrap justify-end gap-2">
            {canEdit && (
              <button className={boton} onClick={() => setDlg({ tipo: 'editar', f })}>
                Editar
              </button>
            )}
            {canDelete && (
              <button
                className={botonRojo}
                disabled={borrar.isPending}
                onClick={async () => {
                  const n = valesDe(f).length;
                  const ok = await confirm({
                    title: `Borrar la factura ${f.numero ?? ''}`.trim(),
                    message:
                      n > 0
                        ? `Sus ${n} vale(s) vuelven a quedar sin factura y pasan a «Despachada». Los vales no se borran.`
                        : 'Desaparece de la lista. Queda el rastro en auditoría.',
                    danger: true,
                  });
                  if (!ok) return;
                  try {
                    await borrar.mutateAsync(f.id);
                    toast.success('Factura borrada.');
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : 'No se pudo borrar.');
                  }
                }}
              >
                Borrar
              </button>
            )}
          </div>
        )}
      />

      <Modal
        open={dlg.tipo !== 'cerrado'}
        onClose={() => setDlg({ tipo: 'cerrado' })}
        title={dlg.tipo === 'editar' ? 'Editar factura' : 'Nueva factura'}
        size="lg"
      >
        {dlg.tipo !== 'cerrado' && (
          <FacturaForm
            inicial={dlg.tipo === 'editar' ? dlg.f : null}
            guardando={guardando}
            onCancel={() => setDlg({ tipo: 'cerrado' })}
            onSubmit={(valores, ids) => void guardar(valores, ids)}
          />
        )}
      </Modal>
    </section>
  );
}

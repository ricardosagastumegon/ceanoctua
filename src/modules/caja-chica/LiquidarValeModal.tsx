import { useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { formatMoney } from '@/lib/money';
import {
  useValeFacturas,
  useCreateValeFactura,
  useUpdateValeFactura,
  useDeleteValeFactura,
  useUpdateLinea,
} from './hooks';
import { totalLinea, totalValeFactura, vueltoVale, type Linea } from './types';

type Props = {
  linea: Linea | null;
  periodoId: string;
  onClose: () => void;
  canEdit: boolean;
};

// Modal para liquidar una línea con forma_pago='Vale'. Muestra el monto
// entregado (total de la línea), permite agregar/editar sub-facturas, y
// calcula el vuelto en vivo. Al confirmar, marca la línea vale_estado='Liquidado'.
export function LiquidarValeModal({ linea, periodoId, onClose, canEdit }: Props) {
  const facturas = useValeFacturas(linea?.id);
  const createFactura = useCreateValeFactura(linea?.id ?? '', periodoId);
  const updateFactura = useUpdateValeFactura(linea?.id ?? '', periodoId);
  const deleteFactura = useDeleteValeFactura(linea?.id ?? '', periodoId);
  const updateLinea = useUpdateLinea(periodoId);
  const toast = useToast();

  const [nueva, setNueva] = useState({
    fecha: new Date().toISOString().slice(0, 10),
    factura: '',
    nombre: '',
    cantidad: '1',
    p_unitario: '',
  });

  if (!linea) return null;

  const items = facturas.data ?? [];
  const montoVale = totalLinea(linea);
  const gastado = items.reduce((s, f) => s + totalValeFactura(f), 0);
  const vuelto = vueltoVale(linea, items);

  async function handleAgregar(e: FormEvent) {
    e.preventDefault();
    if (!linea) return;
    const c = Number(nueva.cantidad);
    const pu = Number(nueva.p_unitario);
    if (!Number.isFinite(c) || !Number.isFinite(pu) || c <= 0 || pu <= 0) {
      toast.error('Cantidad y precio unitario deben ser mayores a 0.');
      return;
    }
    try {
      await createFactura.mutateAsync({
        linea_id: linea.id,
        fecha: nueva.fecha || null,
        factura: nueva.factura || null,
        nombre: nueva.nombre || null,
        cantidad: c,
        p_unitario: pu,
      });
      setNueva({ fecha: new Date().toISOString().slice(0, 10), factura: '', nombre: '', cantidad: '1', p_unitario: '' });
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleMarcarLiquidado() {
    if (!linea) return;
    if (items.length === 0) {
      const ok = window.confirm(
        'No hay facturas registradas. El vale se marcará como liquidado con vuelto = ' +
          formatMoney(montoVale) +
          '. ¿Continuar?',
      );
      if (!ok) return;
    }
    try {
      await updateLinea.mutateAsync({ id: linea.id, patch: { vale_estado: 'Liquidado' } });
      toast.success('Vale liquidado. Vuelto: ' + formatMoney(vuelto));
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleReabrir() {
    if (!linea) return;
    try {
      await updateLinea.mutateAsync({ id: linea.id, patch: { vale_estado: 'Abierto' } });
      toast.success('Vale reabierto.');
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const liquidado = linea.vale_estado === 'Liquidado';

  return (
    <Modal
      open={!!linea}
      onClose={onClose}
      title={`Liquidar Vale · ${linea.nombre ?? '(sin nombre)'}`}
      size="lg"
    >
      <div className="space-y-4">
        {/* Resumen */}
        <div className="grid grid-cols-3 gap-3 rounded-md border border-sand bg-sand-l p-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-dark-3">Monto Vale</div>
            <div className="font-mono text-lg font-bold text-teal-d">{formatMoney(montoVale)}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-dark-3">Gastado (facturas)</div>
            <div className="font-mono text-lg font-bold text-rust">{formatMoney(gastado)}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-dark-3">
              {vuelto >= 0 ? 'Vuelto a caja' : 'Faltante'}
            </div>
            <div className={`font-mono text-lg font-bold ${vuelto >= 0 ? 'text-teal' : 'text-rust'}`}>
              {formatMoney(Math.abs(vuelto))}
            </div>
          </div>
        </div>

        {/* Lista de facturas */}
        <div>
          <h3 className="mb-2 text-sm font-semibold text-dark">Facturas del vale</h3>
          {facturas.isLoading ? (
            <div className="text-sm text-dark-3">Cargando…</div>
          ) : items.length === 0 ? (
            <div className="rounded-md border border-dashed border-sand-d bg-white p-4 text-center text-sm italic text-dark-3">
              Sin facturas todavía. Agrega abajo las facturas que sustenta este vale.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border border-sand">
              <table className="w-full text-sm">
                <thead className="bg-navy text-white">
                  <tr>
                    <th className="px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider">Fecha</th>
                    <th className="px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider">Factura</th>
                    <th className="px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider">Nombre</th>
                    <th className="px-2 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wider">Cant.</th>
                    <th className="px-2 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wider">P. Unit</th>
                    <th className="px-2 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wider">Total</th>
                    {canEdit && <th className="w-16 px-2 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wider"></th>}
                  </tr>
                </thead>
                <tbody>
                  {items.map((f) => (
                    <FacturaRow
                      key={f.id}
                      factura={f}
                      onUpdate={async (patch) => {
                        try {
                          await updateFactura.mutateAsync({ id: f.id, patch });
                        } catch (err) {
                          toast.error((err as Error).message);
                        }
                      }}
                      onDelete={async () => {
                        if (!window.confirm('¿Eliminar esta factura?')) return;
                        try {
                          await deleteFactura.mutateAsync(f.id);
                        } catch (err) {
                          toast.error((err as Error).message);
                        }
                      }}
                      canEdit={canEdit && !liquidado}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Formulario agregar */}
        {canEdit && !liquidado && (
          <form onSubmit={handleAgregar} className="rounded-md border border-teal/30 bg-teal-l/40 p-3">
            <div className="mb-2 text-xs font-semibold text-teal-d">+ Nueva factura</div>
            <div className="grid grid-cols-6 gap-2">
              <input
                type="date"
                value={nueva.fecha}
                onChange={(e) => setNueva({ ...nueva, fecha: e.target.value })}
                className="rounded border border-sand px-2 py-1 text-sm"
              />
              <input
                type="text"
                placeholder="No. factura"
                value={nueva.factura}
                onChange={(e) => setNueva({ ...nueva, factura: e.target.value })}
                className="rounded border border-sand px-2 py-1 text-sm"
              />
              <input
                type="text"
                placeholder="Nombre / concepto"
                value={nueva.nombre}
                onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })}
                className="col-span-2 rounded border border-sand px-2 py-1 text-sm"
              />
              <input
                type="number"
                step="0.01"
                placeholder="Cant."
                value={nueva.cantidad}
                onChange={(e) => setNueva({ ...nueva, cantidad: e.target.value })}
                className="rounded border border-sand px-2 py-1 text-right text-sm"
              />
              <input
                type="number"
                step="0.01"
                placeholder="P. Unit"
                value={nueva.p_unitario}
                onChange={(e) => setNueva({ ...nueva, p_unitario: e.target.value })}
                className="rounded border border-sand px-2 py-1 text-right text-sm"
              />
            </div>
            <div className="mt-2 flex justify-end">
              <button
                type="submit"
                disabled={createFactura.isPending}
                className="rounded-md bg-teal px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-d disabled:opacity-50"
              >
                + Agregar factura
              </button>
            </div>
          </form>
        )}

        {/* Acciones finales */}
        <div className="flex items-center justify-between border-t border-sand pt-3">
          <div className="text-xs text-dark-3">
            {liquidado ? (
              <span className="font-semibold text-teal">✓ Este vale ya está liquidado.</span>
            ) : (
              <span>Al marcar como liquidado, el vuelto queda registrado en el saldo del período.</span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-sand px-3 py-1.5 text-sm font-semibold text-dark-2 hover:bg-sand-l"
            >
              Cerrar
            </button>
            {canEdit && !liquidado && (
              <button
                type="button"
                onClick={handleMarcarLiquidado}
                disabled={updateLinea.isPending}
                className="rounded-md bg-green px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: '#2a6e24' }}
              >
                💾 Marcar liquidado
              </button>
            )}
            {canEdit && liquidado && (
              <button
                type="button"
                onClick={handleReabrir}
                className="rounded-md border border-rust/40 px-3 py-1.5 text-sm font-semibold text-rust hover:bg-rust-l"
              >
                ↩ Reabrir vale
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// Fila editable inline de una sub-factura de vale.
function FacturaRow({
  factura,
  onUpdate,
  onDelete,
  canEdit,
}: {
  factura: import('./types').ValeFactura;
  onUpdate: (patch: import('./types').ValeFacturaUpdate) => Promise<void>;
  onDelete: () => Promise<void>;
  canEdit: boolean;
}) {
  const total = totalValeFactura(factura);
  const dis = canEdit ? '' : 'disabled:cursor-default';
  return (
    <tr className="border-t border-sand">
      <td className="px-2 py-1">
        <input
          type="date"
          disabled={!canEdit}
          defaultValue={factura.fecha ?? ''}
          onBlur={(e) => void onUpdate({ fecha: e.target.value || null })}
          className={`w-full rounded border border-transparent px-1 text-xs hover:border-sand-d ${dis}`}
        />
      </td>
      <td className="px-2 py-1">
        <input
          type="text"
          disabled={!canEdit}
          defaultValue={factura.factura ?? ''}
          onBlur={(e) => void onUpdate({ factura: e.target.value || null })}
          className={`w-full rounded border border-transparent px-1 text-xs hover:border-sand-d ${dis}`}
        />
      </td>
      <td className="px-2 py-1">
        <input
          type="text"
          disabled={!canEdit}
          defaultValue={factura.nombre ?? ''}
          onBlur={(e) => void onUpdate({ nombre: e.target.value || null })}
          className={`w-full rounded border border-transparent px-1 text-xs hover:border-sand-d ${dis}`}
        />
      </td>
      <td className="px-2 py-1">
        <input
          type="number"
          step="0.01"
          disabled={!canEdit}
          defaultValue={factura.cantidad ?? 0}
          onBlur={(e) => void onUpdate({ cantidad: Number(e.target.value) })}
          className={`w-full rounded border border-transparent px-1 text-right text-xs hover:border-sand-d ${dis}`}
        />
      </td>
      <td className="px-2 py-1">
        <input
          type="number"
          step="0.01"
          disabled={!canEdit}
          defaultValue={factura.p_unitario ?? 0}
          onBlur={(e) => void onUpdate({ p_unitario: Number(e.target.value) })}
          className={`w-full rounded border border-transparent px-1 text-right text-xs hover:border-sand-d ${dis}`}
        />
      </td>
      <td className="px-2 py-1 text-right font-mono text-xs font-bold text-teal-d">{formatMoney(total)}</td>
      {canEdit && (
        <td className="px-2 py-1 text-center">
          <button
            type="button"
            onClick={() => void onDelete()}
            className="rounded border border-rust/40 px-1.5 py-0.5 text-[10px] text-rust hover:bg-rust-l"
            title="Eliminar factura"
          >
            🗑
          </button>
        </td>
      )}
    </tr>
  );
}

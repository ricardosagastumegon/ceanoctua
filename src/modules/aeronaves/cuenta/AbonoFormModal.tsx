import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { TextInput } from '@/components/ui/TextInput';
import { useToast } from '@/components/ui/Toast';
import { describeError } from '@/modules/admin/hooks';
import { fmtDate } from '@/modules/arriaza/utils';
import { subirArchivo, type Aeronave } from '../api';
import { acento } from '../constants';
import { cuentaApi, type Abono, type FacturaPendiente } from './api';
import { useGuardarAbono } from './hooks';

const money = (n: number) =>
  n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Props = {
  aeronave: Aeronave;
  cuentaId: string;
  moneda: string;
  /** Las facturas que ninguna reposición cubre todavía. */
  pendientes: FacturaPendiente[];
  editando: Abono | null;
  onClose: () => void;
};

/**
 * Una reposición al depósito del proveedor.
 *
 * Lo propio de esta pantalla es que la reposición **cubre un grupo de
 * facturas**. El usuario: «se hace una solicitud por cada factura con su
 * vale, y la mayoría de las veces contabilidad agrupa solicitudes y hace un
 * solo pago que abarca un grupo de facturas». Verificado contra el estado de
 * cuenta del proveedor: 67 de 75 abonos son la suma exacta de un grupo.
 *
 * Por eso el comprobante vive acá y no en cada solicitud de pago: es un solo
 * papel del banco para varias SP.
 */
export function AbonoFormModal({
  aeronave, cuentaId, moneda, pendientes, editando, onClose,
}: Props) {
  const col = acento(aeronave.acento);
  const toast = useToast();
  const guardar = useGuardarAbono(aeronave.id);

  const [fecha, setFecha] = useState('');
  const [monto, setMonto] = useState('');
  const [documento, setDocumento] = useState('');
  const [notas, setNotas] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Al editar hay que volver a traer qué facturas cubría.
  const previas = useQuery({
    queryKey: ['avn_fuel_abono_regs', editando?.id],
    enabled: !!editando,
    queryFn: () => cuentaApi.registrosDe(editando?.id as string),
  });

  useEffect(() => {
    setFecha(editando?.fecha ?? new Date().toISOString().slice(0, 10));
    setMonto(editando?.monto != null ? String(editando.monto) : '');
    setDocumento(editando?.documento ?? '');
    setNotas(editando?.notas ?? '');
    setArchivo(null);
    setError(null);
  }, [editando]);

  useEffect(() => {
    if (previas.data) setMarcados(new Set(previas.data));
    else if (!editando) setMarcados(new Set());
  }, [previas.data, editando]);

  const sumaMarcada = useMemo(
    () => pendientes.filter((p) => marcados.has(p.id)).reduce((s, p) => s + p.total, 0),
    [pendientes, marcados],
  );
  const montoNum = Number(monto) || 0;
  const descuadre = Math.abs(sumaMarcada - montoNum) > 0.005;

  function alternar(id: string) {
    setMarcados((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!fecha) return setError('Falta la fecha.');
    if (montoNum <= 0) return setError('El monto tiene que ser mayor que cero.');
    setError(null);
    setGuardando(true);

    try {
      let comprobante_path = editando?.comprobante_path ?? null;
      let comprobante_nombre = editando?.comprobante_nombre ?? null;
      if (archivo) {
        const subido = await subirArchivo(
          `${aeronave.matricula}/reposiciones`,
          Number(fecha.slice(0, 4)),
          archivo,
        );
        comprobante_path = subido.path;
        comprobante_nombre = subido.nombre;
      }

      await guardar.mutateAsync({
        id: editando?.id,
        cuentaId,
        datos: {
          cuenta_id: cuentaId,
          fecha,
          monto: montoNum,
          moneda,
          documento: documento.trim() || null,
          comprobante_path,
          comprobante_nombre,
          notas: notas.trim() || null,
        },
        registroIds: [...marcados],
      });
      toast.success(editando ? 'Reposición actualizada.' : 'Reposición registrada.');
      onClose();
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`${editando ? 'Editar' : 'Nueva'} reposición al depósito`}
      size="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <TextInput label="Fecha del pago" type="date" value={fecha}
            onChange={(e) => setFecha(e.target.value)} />
          <TextInput label={`Monto (${moneda})`} type="number" min="0" step="0.01" value={monto}
            onChange={(e) => setMonto(e.target.value)} />
          <TextInput label="Documento del proveedor" value={documento}
            onChange={(e) => setDocumento(e.target.value)}
            placeholder="AP / AG / NC" hint="el que devuelve Aeroclub" />
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-dark-2">Comprobante</span>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/*"
              onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
              className="block w-full text-xs text-dark-2 file:mr-3 file:rounded-md file:border-0 file:bg-teal-l file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-teal-d"
            />
            {editando?.comprobante_nombre && !archivo && (
              <span className="mt-1 block text-[11px] text-dark-3">
                Ya tiene «{editando.comprobante_nombre}».
              </span>
            )}
          </label>
        </div>

        {/* Qué facturas cubre este pago. */}
        <div className="overflow-hidden rounded-lg border" style={{ borderColor: `${col.solid}55` }}>
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
            style={{ backgroundColor: col.light }}>
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider"
                style={{ color: col.dark }}>
                Facturas que cubre este pago
              </span>
              <p className="text-[11px] text-dark-3">
                Contabilidad agrupa varias solicitudes en un solo pago. Marcá las que van en este.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setMarcados(new Set(pendientes.map((p) => p.id)))}
              className="rounded-md border px-2 py-1 text-[11px] font-extrabold hover:opacity-80"
              style={{ borderColor: `${col.solid}66`, color: col.dark }}
            >
              Marcar todas
            </button>
          </div>

          {pendientes.length === 0 ? (
            /* Vacío no siempre quiere decir lo mismo, y adivinar cuál de los
               dos casos es le costó un rato a la usuaria. La pantalla lo dice. */
            <div className="px-3 py-3 text-[12px] text-dark-3">
              <p className="italic">No hay facturas pendientes de reponer.</p>
              <p className="mt-1">
                Acá solo aparecen las facturas capturadas en <b>Combustible</b>. Las que vienen
                del estado de cuenta del proveedor no se pueden marcar: son parte de la historia
                importada, no registros de CEA.
              </p>
              <p className="mt-1">
                Podés guardar la reposición igual —el monto y el comprobante son lo que mueve el
                saldo— y anotar en las notas a qué facturas corresponde.
              </p>
            </div>
          ) : (
            <div className="max-h-60 overflow-y-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-left text-dark-3">
                    <th className="px-3 py-1.5" />
                    <th className="px-2 py-1.5 font-extrabold">Registro</th>
                    <th className="px-2 py-1.5 font-extrabold">Fecha</th>
                    <th className="px-2 py-1.5 font-extrabold">Vale</th>
                    <th className="px-2 py-1.5 font-extrabold">Factura</th>
                    <th className="px-2 py-1.5 font-extrabold">FER/AP</th>
                    <th className="px-3 py-1.5 text-right font-extrabold">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {pendientes.map((p) => (
                    <tr key={p.id} className="border-t border-sand">
                      <td className="px-3 py-1.5">
                        <input
                          type="checkbox"
                          checked={marcados.has(p.id)}
                          onChange={() => alternar(p.id)}
                          className="h-3.5 w-3.5 accent-teal"
                        />
                      </td>
                      <td className="px-2 py-1.5 font-mono text-[11px] font-extrabold text-dark">
                        {p.serial ?? '—'}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-dark-2">{fmtDate(p.fecha)}</td>
                      <td className="px-2 py-1.5 text-dark-2">{p.vale ?? '—'}</td>
                      <td className="px-2 py-1.5 text-dark-2">{p.factura ?? '—'}</td>
                      <td className="px-2 py-1.5 text-dark-2">{p.fer_ap ?? '—'}</td>
                      <td className="whitespace-nowrap px-3 py-1.5 text-right font-extrabold text-dark">
                        {moneda} {money(p.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Si lo marcado no suma el monto, casi siempre falta una factura. */}
          <div className="flex flex-wrap items-baseline justify-end gap-x-4 border-t px-3 py-2 text-[11px]"
            style={{ borderColor: `${col.solid}33` }}>
            <span className="text-dark-3">
              {marcados.size} factura{marcados.size === 1 ? '' : 's'} marcada
              {marcados.size === 1 ? '' : 's'}: {moneda} {money(sumaMarcada)}
            </span>
            {marcados.size > 0 && (
              descuadre ? (
                <span className="font-extrabold text-rust">
                  No cuadra con el monto por {moneda} {money(Math.abs(sumaMarcada - montoNum))}
                </span>
              ) : (
                <span className="font-extrabold" style={{ color: '#2a6e24' }}>
                  Cuadra con el monto
                </span>
              )
            )}
          </div>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-dark-2">Notas</span>
          <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2}
            className="block w-full rounded-md border border-sand bg-white px-3 py-2 text-sm text-dark focus:border-teal focus:outline-none" />
        </label>

        {error && (
          <p className="rounded-md border border-rust/30 bg-rust-l px-3 py-2 text-sm text-rust">{error}</p>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose}
            className="rounded-md border border-sand px-4 py-2 text-sm font-semibold text-dark-2 hover:bg-sand-l">
            Cancelar
          </button>
          <button type="submit" disabled={guardando}
            className="rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: col.solid }}>
            {guardando ? 'Guardando…' : 'Guardar reposición'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

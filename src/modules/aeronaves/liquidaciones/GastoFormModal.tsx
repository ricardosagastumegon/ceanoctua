import { useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { TextInput } from '@/components/ui/TextInput';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { DocumentAttachment } from '@/components/ui/DocumentAttachment';
import { describeError } from '@/modules/admin/hooks';
import { parseNumero } from '@/lib/money';
import { formatDate } from '@/lib/dates';
import {
  CATEGORIAS, CATEGORIA_LABEL, MEDIOS, MEDIO_LABEL,
  type Gasto, type GastoInsert, type Liquidacion,
} from './api';
import { useGuardarGasto, useValesDe } from './hooks';

/**
 * Un gasto del viaje.
 *
 * Las dos decisiones que arreglan el papel viejo viven aquí: QUIÉN pagó y
 * CÓMO se pagó son dos preguntas distintas --en el papel eran una columna
 * que hacía las dos cosas-- y el monto se captura en la moneda en que lo
 * cobraron, con el equivalente calculado a la vista para que nadie lo teclee.
 */
export function GastoFormModal({
  liquidacion,
  editando,
  onClose,
}: {
  liquidacion: Liquidacion;
  editando: Gasto | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const guardar = useGuardarGasto(liquidacion.id);
  const vales = useValesDe(liquidacion.aeronave_id);

  const [fecha, setFecha] = useState('');
  const [categoria, setCategoria] = useState<string>('Combustible');
  const [proveedor, setProveedor] = useState('');
  const [detalle, setDetalle] = useState('');
  const [documento, setDocumento] = useState('');
  const [sinDocumento, setSinDocumento] = useState(false);
  const [pagadoPor, setPagadoPor] = useState<'empresa' | 'piloto'>('piloto');
  const [medio, setMedio] = useState('Tarjeta');
  const [moneda, setMoneda] = useState<'GTQ' | 'USD'>('GTQ');
  const [monto, setMonto] = useState('');
  const [tc, setTc] = useState('');
  const [galones, setGalones] = useState('');
  const [precio, setPrecio] = useState('');
  const [valeId, setValeId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [nuevoId, setNuevoId] = useState<string | null>(null);

  useEffect(() => {
    setFecha(editando?.fecha ?? liquidacion.fecha_inicio);
    setCategoria(editando?.categoria ?? 'Combustible');
    setProveedor(editando?.proveedor ?? '');
    setDetalle(editando?.detalle ?? '');
    setDocumento(editando?.documento ?? '');
    setSinDocumento(editando?.sin_documento ?? false);
    setPagadoPor((editando?.pagado_por as 'empresa' | 'piloto') ?? 'piloto');
    setMedio(editando?.medio ?? 'Tarjeta');
    setMoneda((editando?.moneda as 'GTQ' | 'USD') ?? 'GTQ');
    setMonto(editando ? String(editando.monto) : '');
    setGalones(editando?.galones != null ? String(editando.galones) : '');
    setPrecio(editando?.precio_unitario != null ? String(editando.precio_unitario) : '');
    setValeId(editando?.registro_combustible_id ?? '');
    setNuevoId(editando?.id ?? null);
    setError(null);
  }, [editando, liquidacion.fecha_inicio]);

  // El tipo de cambio por omisión es el que declaró la liquidación para esa
  // dirección. Se puede pisar línea por línea, porque una compra de hace tres
  // días pudo tener otro.
  const tcSugerido = moneda === 'USD' ? liquidacion.tc_usd_gtq : liquidacion.tc_gtq_usd;
  useEffect(() => {
    if (!editando) setTc(tcSugerido != null ? String(tcSugerido) : '');
  }, [moneda, tcSugerido, editando]);
  useEffect(() => {
    if (editando) setTc(String(editando.tipo_cambio));
  }, [editando]);

  // Galones x precio llena el total, como en el despacho de vehículos: el
  // ingreso manual del total con los factores delante es doble error.
  useEffect(() => {
    const g = parseNumero(galones);
    const p = parseNumero(precio);
    if (g != null && p != null && g > 0 && p > 0) {
      setMonto((g * p).toFixed(2));
    }
  }, [galones, precio]);

  const equivalente = useMemo(() => {
    const m = parseNumero(monto);
    const t = parseNumero(tc);
    if (m == null || t == null || t <= 0) return null;
    return moneda === 'USD'
      ? { etiqueta: 'Equivale a', valor: `Q ${(m * t).toFixed(2)}` }
      : { etiqueta: 'Equivale a', valor: `$ ${(m / t).toFixed(2)}` };
  }, [monto, tc, moneda]);

  const esCombustible = categoria === 'Combustible';

  async function submit() {
    const m = parseNumero(monto);
    const t = parseNumero(tc);
    if (!fecha) return setError('Falta la fecha del gasto.');
    if (!proveedor.trim()) return setError('Falta el proveedor.');
    if (m == null || m <= 0) return setError('El monto tiene que ser mayor que cero.');
    if (t == null || t <= 0) return setError('Falta el tipo de cambio, o es cero.');
    if (!documento.trim() && !sinDocumento) {
      return setError('Poné el número de documento, o marcá que no hay ninguno.');
    }
    setError(null);
    setGuardando(true);
    try {
      const datos: GastoInsert = {
        liquidacion_id: liquidacion.id,
        fecha,
        categoria,
        proveedor: proveedor.trim(),
        detalle: detalle.trim() || null,
        documento: documento.trim() || null,
        sin_documento: sinDocumento,
        pagado_por: pagadoPor,
        medio,
        moneda,
        monto: m,
        tipo_cambio: t,
        galones: esCombustible ? parseNumero(galones) : null,
        precio_unitario: esCombustible ? parseNumero(precio) : null,
        registro_combustible_id: esCombustible && valeId ? valeId : null,
      };
      const fila = await guardar.mutateAsync({ id: editando?.id, datos });
      setNuevoId(fila.id);
      toast.success(editando ? 'Gasto actualizado.' : 'Gasto agregado. Ya podés subirle la factura.');
      if (editando) onClose();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={editando ? 'Editar gasto' : 'Nuevo gasto'} size="lg">
      <div className="space-y-4">

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <TextInput label="Fecha del gasto" type="date" value={fecha}
            onChange={(e) => setFecha(e.target.value)} />
          <Select label="Categoría" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            {CATEGORIAS.map((c) => (
              <option key={c} value={c}>{CATEGORIA_LABEL[c]}</option>
            ))}
          </Select>
          <TextInput label="Proveedor" value={proveedor} onChange={(e) => setProveedor(e.target.value)}
            placeholder="Signature Aviation" />
        </div>

        <TextInput label="Detalle" value={detalle} onChange={(e) => setDetalle(e.target.value)}
          placeholder="FBO Key West, Florida · infrastructure y handling fee"
          hint="Lo que se compró y dónde. Esto es lo que en el papel viejo iba suelto al final." />

        {/* Quién pagó · cómo pagó. Dos preguntas, dos campos. */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <span className="mb-1 block text-xs font-semibold text-dark-2">¿Quién lo pagó?</span>
            <div className="flex gap-2">
              {([
                { k: 'empresa', t: 'La empresa' },
                { k: 'piloto', t: 'El piloto' },
              ] as const).map((o) => (
                <button key={o.k} type="button" onClick={() => setPagadoPor(o.k)}
                  className={`flex-1 rounded-md border px-3 py-2 text-xs font-extrabold transition ${
                    pagadoPor === o.k
                      ? o.k === 'piloto'
                        ? 'border-rust bg-rust-l text-rust'
                        : 'border-teal bg-teal-l text-teal-d'
                      : 'border-sand bg-white text-dark-3 hover:bg-sand-l'
                  }`}>
                  {o.t}
                </button>
              ))}
            </div>
            {pagadoPor === 'piloto' && (
              <p className="mt-1 text-[11px] text-rust">Entra al reembolso del piloto.</p>
            )}
          </div>
          <Select label="¿Cómo se pagó?" value={medio} onChange={(e) => setMedio(e.target.value)}>
            {MEDIOS.map((m) => <option key={m} value={m}>{MEDIO_LABEL[m]}</option>)}
          </Select>
        </div>

        {esCombustible && (
          <div className="rounded-md border border-sand bg-sand-l p-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <TextInput label="Galones" value={galones} onChange={(e) => setGalones(e.target.value)}
                inputMode="decimal" placeholder="53.4" />
              <TextInput label="Precio por galón" value={precio} onChange={(e) => setPrecio(e.target.value)}
                inputMode="decimal" placeholder="68.00" hint="llena el monto solo" />
              <Select label="Vale de combustible" value={valeId} onChange={(e) => setValeId(e.target.value)}
                hint="opcional · solo si el proveedor es el de contrato">
                <option value="">Sin vale</option>
                {(vales.data ?? []).map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.serial ?? v.vale ?? '—'} · {formatDate(v.fecha)} · {v.proveedor ?? ''}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Select label="Moneda" value={moneda} onChange={(e) => setMoneda(e.target.value as 'GTQ' | 'USD')}
            hint="en la que cobraron">
            <option value="GTQ">Quetzales</option>
            <option value="USD">Dólares</option>
          </Select>
          <TextInput label={`Monto en ${moneda === 'USD' ? 'dólares' : 'quetzales'}`}
            value={monto} onChange={(e) => setMonto(e.target.value)} inputMode="decimal" />
          <TextInput label="Tipo de cambio" value={tc} onChange={(e) => setTc(e.target.value)}
            inputMode="decimal" hint="el del viaje; se puede pisar" />
          <div>
            <span className="mb-1 block text-xs font-semibold text-dark-2">
              {equivalente?.etiqueta ?? 'Equivalente'}
            </span>
            <div className="rounded-md border border-sand bg-sand-l px-3 py-2 text-sm font-extrabold text-dark">
              {equivalente?.valor ?? '—'}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextInput label="Número de documento" value={documento}
            onChange={(e) => setDocumento(e.target.value)} disabled={sinDocumento}
            placeholder="534726322" />
          <label className="flex items-end gap-2 pb-2 text-sm text-dark-2">
            <input type="checkbox" checked={sinDocumento}
              onChange={(e) => { setSinDocumento(e.target.checked); if (e.target.checked) setDocumento(''); }}
              className="h-3.5 w-3.5 accent-teal" />
            No hay documento por este gasto
          </label>
        </div>

        {/* La foto NO estorba para seguir capturando; estorba para cerrar. */}
        {nuevoId ? (
          <div className="rounded-md border border-sand p-3">
            <DocumentAttachment
              entidadTipo="avn_liq_gasto"
              entidadId={nuevoId}
              label="Foto de la factura"
              accept="image/*,application/pdf"
            />
            {!sinDocumento && (
              <p className="mt-2 text-[11px] text-dark-3">
                No hace falta ahora para seguir agregando gastos, pero sí para poder cerrar la liquidación.
              </p>
            )}
          </div>
        ) : (
          <p className="rounded-md border border-dashed border-sand bg-sand-l px-3 py-2 text-[11px] text-dark-3">
            Guardá el gasto y aquí mismo podrás subirle la foto de la factura.
          </p>
        )}

        {error && (
          <p className="rounded-md border border-rust/30 bg-rust-l px-3 py-2 text-sm text-rust">{error}</p>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose}
            className="rounded-md border border-sand px-4 py-2 text-sm font-semibold text-dark-2 hover:bg-sand-l">
            {nuevoId && !editando ? 'Listo' : 'Cancelar'}
          </button>
          <button type="button" onClick={() => void submit()} disabled={guardando}
            className="rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-d disabled:opacity-60">
            {guardando ? 'Guardando…' : editando ? 'Guardar' : nuevoId ? 'Guardar cambios' : 'Agregar gasto'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

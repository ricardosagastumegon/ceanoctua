import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { TextInput } from '@/components/ui/TextInput';
import { useToast } from '@/components/ui/Toast';
import { describeError, useEntidades, useProveedores } from '@/modules/admin/hooks';
import { subirArchivo, type Aeronave } from '../api';
import { useActualizarRegistro, useCrearRegistro } from './hooks';
import type { LineaInput, RegistroCompleto } from './api';

/**
 * Los productos que se pueden cargar.
 *
 * Son los tres que maneja el OBI. Van como lista aquí y no como catálogo en
 * la base porque son tres y casi nunca cambian; la columna es texto libre,
 * así que sumar el Jet A1 del King Air será agregar un renglón a esta lista,
 * sin migración.
 */
const PRODUCTOS = ['Gasolina', 'Aceite', 'Diesel'];

type Props = {
  open: boolean;
  aeronave: Aeronave;
  editando: RegistroCompleto | null;
  onClose: () => void;
};

type LineaForm = { producto: string; galones: string; precio: string };

const num = (s: string): number => {
  const n = Number(String(s).replace(',', '.').trim());
  return Number.isFinite(n) ? n : 0;
};

const money = (n: number) => n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function RegistroFormModal({ open, aeronave, editando, onClose }: Props) {
  const entidades = useEntidades();
  const proveedores = useProveedores();
  const crear = useCrearRegistro(aeronave.id);
  const actualizar = useActualizarRegistro(aeronave.id);
  const toast = useToast();

  const [fecha, setFecha] = useState('');
  const [vale, setVale] = useState('');
  const [factura, setFactura] = useState('');
  const [ferAp, setFerAp] = useState('');
  const [entidadId, setEntidadId] = useState('');
  const [proveedorId, setProveedorId] = useState('');
  const [moneda, setMoneda] = useState('GTQ');
  const [lineas, setLineas] = useState<LineaForm[]>([]);
  const [notas, setNotas] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFecha(editando?.fecha ?? new Date().toISOString().slice(0, 10));
    setVale(editando?.vale ?? '');
    setFactura(editando?.factura ?? '');
    setFerAp(editando?.fer_ap ?? '');
    setEntidadId(editando?.entidad_id ?? '');
    setProveedorId(editando?.proveedor_id ?? '');
    setMoneda(editando?.moneda ?? 'GTQ');
    setNotas(editando?.notas ?? '');
    setArchivo(null);
    setError(null);
    setLineas(
      editando
        ? editando.lineas.map((l) => ({
            producto: l.producto,
            galones: String(l.galones),
            precio: String(l.precio_unitario),
          }))
        : [{ producto: PRODUCTOS[0], galones: '', precio: '' }],
    );
  }, [open, editando]);

  const total = useMemo(
    () => lineas.reduce((s, l) => s + num(l.galones) * num(l.precio), 0),
    [lineas],
  );

  /** Un producto ya puesto no se ofrece otra vez: no tiene sentido repetirlo. */
  const disponibles = (actual: string) =>
    PRODUCTOS.filter((p) => p === actual || !lineas.some((l) => l.producto === p));

  function agregarProducto() {
    const libre = PRODUCTOS.find((p) => !lineas.some((l) => l.producto === p));
    if (!libre) {
      toast.error('Ya están agregados los tres productos.');
      return;
    }
    setLineas((p) => [...p, { producto: libre, galones: '', precio: '' }]);
  }

  function cambiar(i: number, campo: keyof LineaForm, valor: string) {
    setLineas((p) => p.map((l, k) => (k === i ? { ...l, [campo]: valor } : l)));
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!fecha) {
      setError('La fecha es obligatoria.');
      return;
    }
    const conValor: LineaInput[] = lineas
      .filter((l) => l.producto && (num(l.galones) > 0 || num(l.precio) > 0))
      .map((l) => ({
        producto: l.producto,
        galones: num(l.galones),
        precio_unitario: num(l.precio),
      }));
    if (conValor.length === 0) {
      setError('Agrega al menos un producto con galones y precio.');
      return;
    }

    setError(null);
    setGuardando(true);
    try {
      const ent = (entidades.data ?? []).find((x) => x.id === entidadId);
      const prov = (proveedores.data ?? []).find((x) => x.id === proveedorId);

      let archivo_path = editando?.archivo_path ?? null;
      let archivo_nombre = editando?.archivo_nombre ?? null;
      if (archivo) {
        const subido = await subirArchivo(
          `${aeronave.matricula}/combustible`,
          Number(fecha.slice(0, 4)),
          archivo,
        );
        archivo_path = subido.path;
        archivo_nombre = subido.nombre;
      }

      // Se guarda el nombre y el NIT además del id: si mañana cambian en el
      // catálogo, este registro tiene que seguir diciendo lo que decía.
      const campos = {
        fecha,
        vale: vale.trim() || null,
        factura: factura.trim() || null,
        fer_ap: ferAp.trim() || null,
        entidad_id: entidadId || null,
        entidad: ent?.nombre ?? null,
        entidad_nit: ent?.nit ?? null,
        proveedor_id: proveedorId || null,
        proveedor: prov?.nombre ?? null,
        proveedor_nit: prov?.nit ?? null,
        moneda,
        notas: notas.trim() || null,
        archivo_path,
        archivo_nombre,
      };

      if (editando) {
        await actualizar.mutateAsync({ id: editando.id, patch: campos, lineas: conValor });
        toast.success('Registro actualizado.');
      } else {
        await crear.mutateAsync({ input: { aeronave_id: aeronave.id, ...campos }, lineas: conValor });
        toast.success('Registro creado.');
      }
      onClose();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editando ? `Registro ${editando.serial ?? ''}` : 'Nuevo registro de vale'}
      size="lg"
    >
      <form onSubmit={guardar} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-dark-2">Entidad</span>
            <select
              value={entidadId}
              onChange={(e) => setEntidadId(e.target.value)}
              className="block w-full rounded-md border border-sand bg-white px-3 py-2 text-sm text-dark focus:border-teal focus:outline-none"
            >
              <option value="">—</option>
              {(entidades.data ?? []).map((x) => (
                <option key={x.id} value={x.id}>{x.nombre}</option>
              ))}
            </select>
            <span className="mt-1 block text-[11px] text-dark-3">
              NIT: {(entidades.data ?? []).find((x) => x.id === entidadId)?.nit ?? '—'}
            </span>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-dark-2">Proveedor</span>
            <select
              value={proveedorId}
              onChange={(e) => setProveedorId(e.target.value)}
              className="block w-full rounded-md border border-sand bg-white px-3 py-2 text-sm text-dark focus:border-teal focus:outline-none"
            >
              <option value="">—</option>
              {(proveedores.data ?? []).map((x) => (
                <option key={x.id} value={x.id}>{x.nombre}</option>
              ))}
            </select>
            <span className="mt-1 block text-[11px] text-dark-3">
              NIT: {(proveedores.data ?? []).find((x) => x.id === proveedorId)?.nit ?? '—'}
            </span>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <TextInput name="fecha" label="Fecha *" type="date" value={fecha}
            onChange={(e) => setFecha(e.target.value)} required />
          <TextInput name="vale" label="Vale" value={vale}
            onChange={(e) => setVale(e.target.value)} />
          <TextInput name="factura" label="Factura" value={factura}
            onChange={(e) => setFactura(e.target.value)} />
          <TextInput name="fer_ap" label="FER/AP" value={ferAp}
            onChange={(e) => setFerAp(e.target.value)} />
        </div>

        {/* Los productos */}
        <div className="rounded-md border border-sand p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-teal-d">
              Productos
            </span>
            <button
              type="button"
              onClick={agregarProducto}
              className="rounded-md border border-teal/40 px-2.5 py-1 text-[11px] font-extrabold text-teal-d hover:bg-teal-l"
            >
              ＋ Producto
            </button>
          </div>

          <div className="space-y-2">
            {lineas.map((l, i) => (
              <div key={i} className="grid grid-cols-[1.4fr_1fr_1fr_1fr_auto] items-end gap-2">
                <label className="block">
                  {i === 0 && (
                    <span className="mb-1 block text-[10px] font-semibold text-dark-3">Producto</span>
                  )}
                  <select
                    value={l.producto}
                    onChange={(e) => cambiar(i, 'producto', e.target.value)}
                    className="block w-full rounded-md border border-sand bg-white px-2 py-1.5 text-sm text-dark focus:border-teal focus:outline-none"
                  >
                    {disponibles(l.producto).map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  {i === 0 && (
                    <span className="mb-1 block text-[10px] font-semibold text-dark-3">Galones</span>
                  )}
                  <input
                    type="number" step="0.001" min="0" value={l.galones}
                    onChange={(e) => cambiar(i, 'galones', e.target.value)}
                    className="block w-full rounded-md border border-sand px-2 py-1.5 text-sm focus:border-teal focus:outline-none"
                  />
                </label>
                <label className="block">
                  {i === 0 && (
                    <span className="mb-1 block text-[10px] font-semibold text-dark-3">Precio unitario</span>
                  )}
                  <input
                    type="number" step="0.0001" min="0" value={l.precio}
                    onChange={(e) => cambiar(i, 'precio', e.target.value)}
                    className="block w-full rounded-md border border-sand px-2 py-1.5 text-sm focus:border-teal focus:outline-none"
                  />
                </label>
                <div className="pb-1.5 text-right text-sm font-extrabold text-dark">
                  {money(num(l.galones) * num(l.precio))}
                </div>
                <button
                  type="button"
                  onClick={() => setLineas((p) => p.filter((_, k) => k !== i))}
                  className="pb-1.5 text-dark-3 hover:text-rust"
                  aria-label="Quitar producto"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-baseline justify-end gap-3 border-t border-sand pt-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-dark-2">
              Total facturado
            </span>
            <span className="font-heading text-lg font-extrabold text-teal-d">
              {moneda} {money(total)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_2fr]">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-dark-2">Moneda</span>
            <select
              value={moneda}
              onChange={(e) => setMoneda(e.target.value)}
              className="block w-full rounded-md border border-sand bg-white px-3 py-2 text-sm text-dark focus:border-teal focus:outline-none"
            >
              {['GTQ', 'USD'].map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-dark-2">
              Vale o factura escaneada
            </span>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/*"
              onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
              className="block w-full text-xs text-dark-2 file:mr-3 file:rounded-md file:border-0 file:bg-teal-l file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-teal-d"
            />
            {editando?.archivo_nombre && !archivo && (
              <span className="mt-1 block text-[11px] text-dark-3">
                Ya tiene «{editando.archivo_nombre}».
              </span>
            )}
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-dark-2">Notas</span>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={2}
            className="block w-full rounded-md border border-sand bg-white px-3 py-2 text-sm text-dark focus:border-teal focus:outline-none"
          />
        </label>

        {error && (
          <p className="rounded-md border border-rust/30 bg-rust-l px-3 py-2 text-sm text-rust">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose}
            className="rounded-md border border-sand px-4 py-2 text-sm font-semibold text-dark-2 hover:bg-sand-l">
            Cancelar
          </button>
          <button type="submit" disabled={guardando}
            className="rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-d disabled:opacity-60">
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

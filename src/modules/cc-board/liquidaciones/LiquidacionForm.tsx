import { useEffect, useState, type FormEvent } from 'react';
import { TextInput } from '@/components/ui/TextInput';
import { TextArea } from '@/components/ui/TextArea';
import { Select } from '@/components/ui/Select';
import { formatMoney } from '@/lib/money';
import { useVales } from '../vales/hooks';
import { useLinkedVales, useLiqRows } from './hooks';
import {
  LIQ_ESTADOS,
  PAYMENT_METHODS,
  type LiqRowInsert,
  type Liquidacion,
  type LiquidacionInsert,
} from './api';
import type { Database } from '@/types/database';

type Currency = Database['public']['Enums']['currency'];

export type LiquidacionFormValues = {
  patch: LiquidacionInsert;
  rows: Omit<LiqRowInsert, 'liquidacion_id'>[];
  /** Fase 17 · F-2: lista de vales vinculados (M:N) */
  valeIds: string[];
};

type FormState = {
  fecha: string;
  periodo: string;
  moneda: Currency;
  entidad: string;
  payment_method: string;
  motivo: string;
  producto: string;
  solicitado: string;
  reintegrar_a: string;
  vale_serial: string;
  vale_monto: string;
  comentarios: string;
  notas: string;
  responsable: string;
  estado: string;
};

type RowState = {
  fecha: string;
  factura: string;
  proveedor: string;
  concepto: string;
  cantidad: string;
  unitario: string;
};

const today = () => new Date().toISOString().slice(0, 10);

const empty: FormState = {
  fecha: today(),
  periodo: '',
  moneda: 'GTQ',
  entidad: '',
  payment_method: 'Efectivo',
  motivo: '',
  producto: '',
  solicitado: '',
  reintegrar_a: '',
  vale_serial: '',
  vale_monto: '0',
  comentarios: '',
  notas: '',
  responsable: '',
  estado: 'Generada',
};

const emptyRow: RowState = {
  fecha: today(),
  factura: '',
  proveedor: '',
  concepto: '',
  cantidad: '1',
  unitario: '0',
};

function fromRow(r: Liquidacion | null | undefined): FormState {
  if (!r) return empty;
  return {
    fecha: r.fecha ?? today(),
    periodo: r.periodo ?? '',
    moneda: r.moneda,
    entidad: r.entidad ?? '',
    payment_method: r.payment_method ?? 'Efectivo',
    motivo: r.motivo ?? '',
    producto: r.producto ?? '',
    solicitado: r.solicitado ?? '',
    reintegrar_a: r.reintegrar_a ?? '',
    vale_serial: r.vale_serial ?? '',
    vale_monto: String(r.vale_monto ?? 0),
    comentarios: r.comentarios ?? '',
    notas: r.notas ?? '',
    responsable: r.responsable ?? '',
    estado: r.estado ?? 'Generada',
  };
}

function fmt(n: number, currency: string): string {
  if (currency === 'GTQ') return formatMoney(n);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
}

type Props = {
  initial: Liquidacion | null;
  submitting?: boolean;
  onSubmit: (v: LiquidacionFormValues) => void | Promise<void>;
  onCancel: () => void;
};

export function LiquidacionForm({ initial, submitting, onSubmit, onCancel }: Props) {
  const [v, setV] = useState<FormState>(fromRow(initial));
  const [rows, setRows] = useState<RowState[]>([]);
  const [editingRowIdx, setEditingRowIdx] = useState<number | null>(null);
  const [newRow, setNewRow] = useState<RowState>(emptyRow);
  const [error, setError] = useState<string | null>(null);
  // Fase 17 · F-2: vales vinculados M:N. Inicializa con la lista del
  // junction al editar; vacío al crear.
  const [selectedValeIds, setSelectedValeIds] = useState<string[]>([]);

  const valesQ = useVales();
  const existingRowsQ = useLiqRows(initial?.id);
  const linkedValesQ = useLinkedVales(initial?.id);

  useEffect(() => {
    if (linkedValesQ.data) setSelectedValeIds(linkedValesQ.data);
  }, [linkedValesQ.data]);

  useEffect(() => {
    setV(fromRow(initial));
    setError(null);
  }, [initial]);

  useEffect(() => {
    if (existingRowsQ.data && initial?.id) {
      setRows(
        existingRowsQ.data.map((r) => ({
          fecha: r.fecha ?? today(),
          factura: r.factura ?? '',
          proveedor: r.proveedor ?? '',
          concepto: r.concepto ?? '',
          cantidad: String(r.cantidad ?? 1),
          unitario: String(r.unitario ?? 0),
        })),
      );
    } else if (!initial?.id) {
      setRows([]);
    }
  }, [existingRowsQ.data, initial?.id]);

  function upd<K extends keyof FormState>(k: K, val: FormState[K]) {
    setV((p) => ({ ...p, [k]: val }));
  }

  function numCantidad(s: string): number {
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }

  function commitNewRow() {
    if (!newRow.proveedor.trim() && !newRow.concepto.trim()) {
      setError('Captura al menos proveedor o concepto en la nueva compra.');
      return;
    }
    setRows((p) => [...p, newRow]);
    setNewRow({ ...emptyRow, fecha: newRow.fecha });
    setError(null);
  }

  function deleteRow(idx: number) {
    setRows((p) => p.filter((_, i) => i !== idx));
  }

  function saveEditedRow(idx: number, patch: RowState) {
    setRows((p) => p.map((r, i) => (i === idx ? patch : r)));
    setEditingRowIdx(null);
  }

  const total = rows.reduce((s, r) => s + numCantidad(r.cantidad) * numCantidad(r.unitario), 0);
  // Suma de los vales seleccionados (M:N). Reemplaza al vale_monto single.
  const valeMonto = (valesQ.data ?? [])
    .filter((x) => selectedValeIds.includes(x.id))
    .reduce((s, x) => s + Number(x.monto ?? 0), 0);
  const diff = total - valeMonto;

  function toggleVale(id: string) {
    setSelectedValeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (editingRowIdx !== null) {
      return setError('Tienes una compra en edición. Click en "✓ Guardar" en la fila o "Cancelar" antes de finalizar.');
    }
    if (!v.fecha) return setError('La fecha es obligatoria.');
    if (!v.motivo.trim()) return setError('El motivo es obligatorio.');
    if (!v.solicitado.trim()) return setError('Debes indicar quién solicitó.');
    if (rows.length === 0) return setError('Agrega al menos una compra.');
    setError(null);

    const patch: LiquidacionInsert = {
      fecha: v.fecha,
      periodo: v.periodo.trim() || null,
      moneda: v.moneda,
      monto_total: total,
      entidad: v.entidad.trim() || null,
      payment_method: v.payment_method || null,
      motivo: v.motivo.trim(),
      producto: v.producto.trim() || null,
      solicitado: v.solicitado.trim(),
      reintegrar_a: v.reintegrar_a.trim() || null,
      vale_serial: v.vale_serial.trim() || null,
      vale_monto: valeMonto,
      comentarios: v.comentarios.trim() || null,
      notas: v.notas.trim() || null,
      responsable: v.responsable.trim() || null,
      estado: v.estado,
    };
    const rowsInsert: Omit<LiqRowInsert, 'liquidacion_id'>[] = rows.map((r, idx) => ({
      fecha: r.fecha || null,
      factura: r.factura.trim() || null,
      proveedor: r.proveedor.trim() || null,
      concepto: r.concepto.trim() || null,
      cantidad: numCantidad(r.cantidad),
      unitario: numCantidad(r.unitario),
      orden: idx + 1,
    }));

    await onSubmit({ patch, rows: rowsInsert, valeIds: selectedValeIds });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {initial?.serial && (
        <div className="rounded-md border border-teal/40 bg-teal-l/50 px-3 py-2 text-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-dark-3">Serial: </span>
          <span className="font-mono font-semibold text-teal-d">{initial.serial}</span>
        </div>
      )}

      {/* Sección A: Información liquidación */}
      <fieldset className="rounded-md border border-sand p-4">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-dark-2">Información de la liquidación</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <TextInput name="fecha" label="Fecha *" type="date" value={v.fecha} onChange={(e) => upd('fecha', e.target.value)} required autoFocus />
          <TextInput name="periodo" label="Período" value={v.periodo} onChange={(e) => upd('periodo', e.target.value)} hint="ej. 2026-05" />
          <Select name="moneda" label="Moneda" value={v.moneda} onChange={(e) => upd('moneda', e.target.value as Currency)}>
            <option value="GTQ">GTQ</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
          </Select>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextInput name="entidad" label="Entidad o personal que paga" value={v.entidad} onChange={(e) => upd('entidad', e.target.value)} />
          <Select name="payment_method" label="Forma de pago" value={v.payment_method} onChange={(e) => upd('payment_method', e.target.value)}>
            {PAYMENT_METHODS.map((p) => <option key={p} value={p}>{p}</option>)}
          </Select>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3">
          <TextInput name="motivo" label="Motivo *" value={v.motivo} onChange={(e) => upd('motivo', e.target.value)} required />
          <TextInput name="producto" label="Producto o servicio" value={v.producto} onChange={(e) => upd('producto', e.target.value)} />
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextInput name="solicitado" label="Solicitado por *" value={v.solicitado} onChange={(e) => upd('solicitado', e.target.value)} required hint="aparecerá como Autorizado por" />
          <TextInput name="reintegrar_a" label="Reintegrar a" value={v.reintegrar_a} onChange={(e) => upd('reintegrar_a', e.target.value)} hint="si alguien pagó con fondos propios" />
        </div>
      </fieldset>

      {/* Sección B + C: Compras */}
      <fieldset className="rounded-md border border-sand p-4">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-dark-2">Detalle de compras</legend>

        {/* Nueva compra */}
        <div className="rounded-md border border-teal/30 bg-teal-l/30 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-teal-d">＋ Agregar nueva compra</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
            <TextInput name="rfecha" label="Fecha" type="date" value={newRow.fecha} onChange={(e) => setNewRow({ ...newRow, fecha: e.target.value })} />
            <TextInput name="rfactura" label="No. factura" value={newRow.factura} onChange={(e) => setNewRow({ ...newRow, factura: e.target.value })} />
            <TextInput name="rproveedor" label="Proveedor" value={newRow.proveedor} onChange={(e) => setNewRow({ ...newRow, proveedor: e.target.value })} />
            <TextInput name="rconcepto" label="Concepto" value={newRow.concepto} onChange={(e) => setNewRow({ ...newRow, concepto: e.target.value })} />
            <TextInput name="rcant" label="Cant" type="number" min="0" step="1" value={newRow.cantidad} onChange={(e) => setNewRow({ ...newRow, cantidad: e.target.value })} />
            <TextInput name="runit" label="P. unit" type="number" min="0" step="0.01" value={newRow.unitario} onChange={(e) => setNewRow({ ...newRow, unitario: e.target.value })} />
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-dark-3">
              Subtotal: <span className="font-mono font-semibold text-teal-d">{fmt(numCantidad(newRow.cantidad) * numCantidad(newRow.unitario), v.moneda)}</span>
            </span>
            <button type="button" onClick={commitNewRow} className="rounded-md bg-teal px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-d">
              ＋ Agregar
            </button>
          </div>
        </div>

        {/* Lista de compras */}
        {rows.length === 0 ? (
          <p className="mt-3 text-xs text-dark-3">No hay compras agregadas todavía.</p>
        ) : (
          <ul className="mt-3 divide-y divide-sand">
            {rows.map((r, idx) => (
              <li key={idx} className="py-2">
                {editingRowIdx === idx ? (
                  <RowEditor row={r} moneda={v.moneda} onSave={(patch) => saveEditedRow(idx, patch)} onCancel={() => setEditingRowIdx(null)} />
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <div className="flex-1">
                      <span className="font-mono text-xs text-dark-3">#{idx + 1}</span>
                      <span className="ml-2 font-medium text-dark">{r.proveedor || '—'}</span>
                      {r.concepto && <span className="ml-2 text-dark-2">· {r.concepto}</span>}
                      <div className="mt-0.5 text-xs text-dark-3">
                        {r.fecha} {r.factura && `· Fact ${r.factura}`} · {r.cantidad} × {fmt(numCantidad(r.unitario), v.moneda)}
                      </div>
                    </div>
                    <span className="font-mono font-semibold text-dark">
                      {fmt(numCantidad(r.cantidad) * numCantidad(r.unitario), v.moneda)}
                    </span>
                    <span className="flex gap-1">
                      <button type="button" onClick={() => setEditingRowIdx(idx)} className="rounded border border-sand px-2 py-0.5 text-xs text-dark-2 hover:bg-sand-l">✏️</button>
                      <button type="button" onClick={() => deleteRow(idx)} className="rounded border border-rust/40 px-2 py-0.5 text-xs text-rust hover:bg-rust-l">🗑</button>
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </fieldset>

      {/* Sección D: Totales */}
      <fieldset className="rounded-md border border-sand p-4">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-dark-2">Totales</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-sand bg-sand-l/30 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-dark-3">Total compras</p>
            <p className="mt-1 font-mono text-lg font-bold text-dark">{fmt(total, v.moneda)}</p>
          </div>
          <div className="rounded-md border border-sand bg-sand-l/30 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-dark-3">Vales vinculados ({selectedValeIds.length})</p>
            <div className="mt-2 max-h-32 overflow-y-auto rounded-md border border-sand bg-white p-2">
              {(valesQ.data ?? []).length === 0 ? (
                <p className="text-xs text-dark-3">No hay vales registrados.</p>
              ) : (
                <ul className="space-y-1 text-xs">
                  {(valesQ.data ?? []).map((x) => (
                    <li key={x.id}>
                      <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-sand-l">
                        <input
                          type="checkbox"
                          checked={selectedValeIds.includes(x.id)}
                          onChange={() => toggleVale(x.id)}
                          className="h-3 w-3 rounded border-sand text-teal focus:ring-teal"
                        />
                        <span className="font-mono text-teal-d">{x.serial ?? '—'}</span>
                        <span className="text-dark-2">·</span>
                        <span className="font-mono">{fmt(Number(x.monto), x.moneda)}</span>
                        <span className="text-dark-2">·</span>
                        <span className="truncate">{x.vale_a}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className="mt-1 font-mono text-lg font-bold text-dark">{fmt(valeMonto, v.moneda)}</p>
          </div>
          <div className={`rounded-md border p-3 ${diff < 0 ? 'border-rust/40 bg-rust-l' : 'border-teal/40 bg-teal-l/30'}`}>
            <p className="text-xs font-semibold uppercase tracking-wider text-dark-3">Diferencia (Total − Vale)</p>
            <p className={`mt-1 font-mono text-lg font-bold ${diff < 0 ? 'text-rust' : 'text-teal-d'}`}>{fmt(diff, v.moneda)}</p>
          </div>
        </div>
      </fieldset>

      {/* Sección E: Comentarios + estado */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Select name="estado" label="Estado" value={v.estado} onChange={(e) => upd('estado', e.target.value)}>
          {LIQ_ESTADOS.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
        <TextInput name="responsable" label="Responsable interno" value={v.responsable} onChange={(e) => upd('responsable', e.target.value)} />
      </div>
      <TextArea name="comentarios" label="Comentarios" value={v.comentarios} onChange={(e) => upd('comentarios', e.target.value)} />
      <TextArea name="notas" label="Notas internas" value={v.notas} onChange={(e) => upd('notas', e.target.value)} />

      {error && <p className="rounded-md border border-rust/30 bg-rust-l px-3 py-2 text-sm text-rust">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="rounded-md border border-sand px-4 py-2 text-sm font-semibold text-dark-2 hover:bg-sand-l">Cancelar</button>
        <button type="submit" disabled={submitting} className="rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-d disabled:opacity-60">
          {submitting ? 'Guardando…' : initial?.id ? '✓ Guardar cambios' : '✓ Finalizar liquidación'}
        </button>
      </div>
    </form>
  );
}

function RowEditor({ row, moneda, onSave, onCancel }: { row: RowState; moneda: string; onSave: (r: RowState) => void; onCancel: () => void }) {
  const [r, setR] = useState<RowState>(row);
  const tot = (Number(r.cantidad) || 0) * (Number(r.unitario) || 0);
  return (
    <div className="rounded-md border border-teal/40 bg-teal-l/30 p-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
        <TextInput name="ef" label="Fecha" type="date" value={r.fecha} onChange={(e) => setR({ ...r, fecha: e.target.value })} />
        <TextInput name="efact" label="Fact" value={r.factura} onChange={(e) => setR({ ...r, factura: e.target.value })} />
        <TextInput name="ep" label="Proveedor" value={r.proveedor} onChange={(e) => setR({ ...r, proveedor: e.target.value })} />
        <TextInput name="ec" label="Concepto" value={r.concepto} onChange={(e) => setR({ ...r, concepto: e.target.value })} />
        <TextInput name="eq" label="Cant" type="number" min="0" step="1" value={r.cantidad} onChange={(e) => setR({ ...r, cantidad: e.target.value })} />
        <TextInput name="eu" label="P. unit" type="number" min="0" step="0.01" value={r.unitario} onChange={(e) => setR({ ...r, unitario: e.target.value })} />
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-dark-3">Subtotal: <span className="font-mono font-semibold">{fmt(tot, moneda)}</span></span>
        <span className="flex gap-1">
          <button type="button" onClick={() => onSave(r)} className="rounded-md bg-teal px-3 py-1 text-xs font-semibold text-white">✓ Guardar</button>
          <button type="button" onClick={onCancel} className="rounded-md border border-sand px-3 py-1 text-xs">Cancelar</button>
        </span>
      </div>
    </div>
  );
}

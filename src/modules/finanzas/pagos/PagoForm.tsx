import { useEffect, useState, type FormEvent } from 'react';
import { TextInput } from '@/components/ui/TextInput';
import { TextArea } from '@/components/ui/TextArea';
import { Select } from '@/components/ui/Select';
import type { CatalogFormProps } from '@/modules/admin/components/CatalogPage';
import type { Pago, PagoInsert } from './api';
import type { Database } from '@/types/database';
import { useAutorizadores, useEntidades, useProveedores } from '@/modules/admin/hooks';
import { useConsumos } from '../consumos/hooks';

type Currency = Database['public']['Enums']['currency'];
type PagoEstado = Database['public']['Enums']['pago_estado'];
type PagoTipo = Database['public']['Enums']['pago_tipo'];

const estadoOptions: PagoEstado[] = ['Programado', 'Aprobado', 'Pagado', 'Conciliado', 'Anulado', 'Devuelto'];

type FormState = {
  fecha: string;
  entidad: string;
  entidad_id: string;
  proveedor: string;
  proveedor_id: string;
  nit: string;
  concepto: string;
  monto: string;
  moneda: Currency;
  cotizacion: string;
  pct_anticipo: string;
  pct_pendiente: string;
  tipo: PagoTipo;
  referencia: string;
  banco: string;
  autorizo: string;
  autorizador_id: string;
  estado: PagoEstado;
  consumo_id: string;
  notas: string;
};

const today = () => new Date().toISOString().slice(0, 10);
const empty: FormState = {
  fecha: today(),
  entidad: '',
  entidad_id: '',
  proveedor: '',
  proveedor_id: '',
  nit: '',
  concepto: '',
  monto: '',
  moneda: 'GTQ',
  cotizacion: '',
  pct_anticipo: '0',
  pct_pendiente: '100',
  tipo: 'transferencia',
  referencia: '',
  banco: '',
  autorizo: '',
  autorizador_id: '',
  estado: 'Programado',
  consumo_id: '',
  notas: '',
};

function fromRow(r: Pago | null | undefined): FormState {
  if (!r) return empty;
  return {
    fecha: r.fecha ?? today(),
    entidad: r.entidad ?? '',
    entidad_id: r.entidad_id ?? '',
    proveedor: r.proveedor ?? '',
    proveedor_id: r.proveedor_id ?? '',
    nit: r.nit ?? '',
    concepto: r.concepto ?? '',
    monto: String(r.monto),
    moneda: r.moneda,
    cotizacion: r.cotizacion != null ? String(r.cotizacion) : '',
    pct_anticipo: r.pct_anticipo != null ? String(r.pct_anticipo) : '0',
    pct_pendiente: r.pct_pendiente != null ? String(r.pct_pendiente) : '100',
    tipo: r.tipo,
    referencia: r.referencia ?? '',
    banco: r.banco ?? '',
    autorizo: r.autorizo ?? '',
    autorizador_id: r.autorizador_id ?? '',
    estado: r.estado,
    consumo_id: r.consumo_id ?? '',
    notas: r.notas ?? '',
  };
}

function toInput(s: FormState): PagoInsert {
  const n = (v: string) => {
    const x = Number(v);
    return v.trim() === '' || !Number.isFinite(x) ? null : x;
  };
  const monto = Number(s.monto);
  return {
    fecha: s.fecha,
    entidad: s.entidad.trim() || null,
    entidad_id: s.entidad_id || null,
    proveedor: s.proveedor.trim() || null,
    proveedor_id: s.proveedor_id || null,
    nit: s.nit.trim() || null,
    concepto: s.concepto.trim() || null,
    monto: Number.isFinite(monto) ? monto : 0,
    moneda: s.moneda,
    cotizacion: n(s.cotizacion),
    pct_anticipo: n(s.pct_anticipo),
    pct_pendiente: n(s.pct_pendiente),
    tipo: s.tipo,
    referencia: s.referencia.trim() || null,
    banco: s.banco.trim() || null,
    autorizo: s.autorizo.trim() || null,
    autorizador_id: s.autorizador_id || null,
    estado: s.estado,
    consumo_id: s.consumo_id || null,
    notas: s.notas.trim() || null,
  };
}

export function PagoForm({ initial, submitting, onSubmit, onCancel }: CatalogFormProps<Pago, PagoInsert>) {
  const [v, setV] = useState<FormState>(fromRow(initial));
  const [error, setError] = useState<string | null>(null);
  const entidades = useEntidades();
  const proveedores = useProveedores();
  const autorizadores = useAutorizadores();
  const consumos = useConsumos();

  useEffect(() => {
    setV(fromRow(initial));
    setError(null);
  }, [initial]);

  function upd<K extends keyof FormState>(k: K, val: FormState[K]) {
    setV((p) => {
      const next = { ...p, [k]: val };
      if (k === 'entidad_id' && val) {
        const e = (entidades.data ?? []).find((x) => x.id === val);
        if (e) next.entidad = e.nombre;
      }
      if (k === 'proveedor_id' && val) {
        const pr = (proveedores.data ?? []).find((x) => x.id === val);
        if (pr) {
          next.proveedor = pr.nombre;
          if (pr.nit) next.nit = pr.nit;
        }
      }
      if (k === 'autorizador_id' && val) {
        const a = (autorizadores.data ?? []).find((x) => x.id === val);
        if (a) next.autorizo = a.nombre;
      }
      if (k === 'consumo_id' && val) {
        // Linking to a consumo → mark this as TC-Reintegro context (label only; tipo stays valid enum)
        const c = (consumos.data ?? []).find((x) => x.id === val);
        if (c) {
          next.monto = String(c.monto);
          next.moneda = c.moneda;
          next.referencia = c.voucher_num ?? next.referencia;
        }
      }
      if (k === 'pct_anticipo') {
        const a = Number(val);
        if (Number.isFinite(a)) next.pct_pendiente = String(Math.max(0, 100 - a));
      }
      return next;
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!v.monto || Number(v.monto) <= 0) {
      setError('Monto inválido.');
      return;
    }
    setError(null);
    await onSubmit(toInput(v));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <TextInput name="fecha" label="Fecha *" type="date" value={v.fecha} onChange={(e) => upd('fecha', e.target.value)} required />
        <Select name="estado" label="Estado" value={v.estado} onChange={(e) => upd('estado', e.target.value as PagoEstado)}>
          {estadoOptions.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </Select>
        <Select name="tipo" label="Tipo" value={v.tipo} onChange={(e) => upd('tipo', e.target.value as PagoTipo)}>
          <option value="transferencia">Transferencia</option>
          <option value="cheque">Cheque</option>
          <option value="efectivo">Efectivo</option>
          <option value="tarjeta">Tarjeta</option>
          <option value="otro">Otro</option>
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select name="entidad_id" label="Entidad" value={v.entidad_id} onChange={(e) => upd('entidad_id', e.target.value)}>
          <option value="">—</option>
          {(entidades.data ?? []).map((x) => (<option key={x.id} value={x.id}>{x.nombre}</option>))}
        </Select>
        <TextInput name="entidad" label="Entidad (texto)" value={v.entidad} onChange={(e) => upd('entidad', e.target.value)} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select name="proveedor_id" label="Proveedor" value={v.proveedor_id} onChange={(e) => upd('proveedor_id', e.target.value)}>
          <option value="">—</option>
          {(proveedores.data ?? []).map((x) => (<option key={x.id} value={x.id}>{x.nombre}</option>))}
        </Select>
        <TextInput name="proveedor" label="Proveedor (texto)" value={v.proveedor} onChange={(e) => upd('proveedor', e.target.value)} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextInput name="nit" label="NIT" value={v.nit} onChange={(e) => upd('nit', e.target.value)} />
        <TextArea name="concepto" label="Concepto" value={v.concepto} onChange={(e) => upd('concepto', e.target.value)} rows={2} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <TextInput name="monto" label="Monto *" type="number" min="0" step="0.01" value={v.monto} onChange={(e) => upd('monto', e.target.value)} required />
        <Select name="moneda" label="Moneda" value={v.moneda} onChange={(e) => upd('moneda', e.target.value as Currency)}>
          <option value="GTQ">GTQ</option>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
          <option value="GBP">GBP</option>
        </Select>
        <TextInput name="cotizacion" label="Cotización" type="number" min="0" step="0.000001" value={v.cotizacion} onChange={(e) => upd('cotizacion', e.target.value)} hint="Tipo de cambio" />
        <TextInput name="pct_anticipo" label="% anticipo" type="number" min="0" max="100" step="0.01" value={v.pct_anticipo} onChange={(e) => upd('pct_anticipo', e.target.value)} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <TextInput name="referencia" label="Referencia" value={v.referencia} onChange={(e) => upd('referencia', e.target.value)} hint="N° cheque / transf" />
        <TextInput name="banco" label="Banco" value={v.banco} onChange={(e) => upd('banco', e.target.value)} />
        <Select name="autorizador_id" label="Autorizador" value={v.autorizador_id} onChange={(e) => upd('autorizador_id', e.target.value)}>
          <option value="">—</option>
          {(autorizadores.data ?? []).map((a) => (<option key={a.id} value={a.id}>{a.nombre}</option>))}
        </Select>
      </div>

      <fieldset className="rounded-md border border-sand p-4">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-dark-2">Enlace opcional a consumo de TC</legend>
        <Select name="consumo_id" label="Consumo" value={v.consumo_id} onChange={(e) => upd('consumo_id', e.target.value)}>
          <option value="">— ninguno —</option>
          {(consumos.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>{c.voucher_num ?? '—'} · {c.proveedor} · {c.monto} {c.moneda}</option>
          ))}
        </Select>
        {v.consumo_id && <p className="mt-2 text-xs text-teal-d">Este pago se considera TC-Reintegro (referencia auto al voucher).</p>}
      </fieldset>

      <TextInput name="autorizo" label="Autorizó" value={v.autorizo} onChange={(e) => upd('autorizo', e.target.value)} />
      <TextArea name="notas" label="Notas" value={v.notas} onChange={(e) => upd('notas', e.target.value)} />

      {error && <p className="rounded-md border border-rust/30 bg-rust-l px-3 py-2 text-sm text-rust">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="rounded-md border border-sand px-4 py-2 text-sm font-semibold text-dark-2 hover:bg-sand-l">Cancelar</button>
        <button type="submit" disabled={submitting} className="rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-d disabled:opacity-60">
          {submitting ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  );
}

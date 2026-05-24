import { useEffect, useState, type FormEvent } from 'react';
import { TextInput } from '@/components/ui/TextInput';
import { TextArea } from '@/components/ui/TextArea';
import { Select } from '@/components/ui/Select';
import type { CatalogFormProps } from '@/modules/admin/components/CatalogPage';
import type { Vale, ValeInsert } from './api';
import type { Database } from '@/types/database';
import { useLiquidaciones } from '../liquidaciones/hooks';

type Currency = Database['public']['Enums']['currency'];
type ValeStatus = Database['public']['Enums']['vale_status'];

const valeStatusOptions: { value: ValeStatus; label: string }[] = [
  { value: 'Creado', label: 'Creado' },
  { value: 'Aprobado', label: 'Aprobado' },
  { value: 'EnLiquidacion', label: 'Asignado a Liquidación' },
  { value: 'Liquidado', label: 'Liquidado' },
  { value: 'Pagado', label: 'Pagado' },
  { value: 'Reintegrado', label: 'Reintegrado' },
  { value: 'Cancelado', label: 'Cancelado' },
  { value: 'Anulado', label: 'Anulado' },
];

type FormState = {
  fecha: string;
  moneda: Currency;
  monto: string;
  vale_a: string;
  entidad: string;
  concepto: string;
  lugar: string;
  estado: ValeStatus;
  liquidacion_id: string;
  notas: string;
};

const today = () => new Date().toISOString().slice(0, 10);
const empty: FormState = {
  fecha: today(),
  moneda: 'GTQ',
  monto: '',
  vale_a: '',
  entidad: '',
  concepto: '',
  lugar: '',
  estado: 'Creado',
  liquidacion_id: '',
  notas: '',
};

function fromRow(r: Vale | null | undefined): FormState {
  if (!r) return empty;
  return {
    fecha: r.fecha ?? today(),
    moneda: r.moneda,
    monto: String(r.monto),
    vale_a: r.vale_a ?? '',
    entidad: r.entidad ?? '',
    concepto: r.concepto ?? '',
    lugar: r.lugar ?? '',
    estado: r.estado,
    liquidacion_id: r.liquidacion_id ?? '',
    notas: r.notas ?? '',
  };
}

function toInput(s: FormState): ValeInsert {
  const n = Number(s.monto);
  return {
    fecha: s.fecha || null,
    moneda: s.moneda,
    monto: Number.isFinite(n) ? n : 0,
    vale_a: s.vale_a.trim(),
    entidad: s.entidad.trim() || null,
    concepto: s.concepto.trim() || null,
    lugar: s.lugar.trim() || null,
    estado: s.estado,
    liquidacion_id: s.liquidacion_id || null,
    notas: s.notas.trim() || null,
  };
}

export function ValeForm({ initial, submitting, onSubmit, onCancel }: CatalogFormProps<Vale, ValeInsert>) {
  const [v, setV] = useState<FormState>(fromRow(initial));
  const [error, setError] = useState<string | null>(null);
  const liqs = useLiquidaciones();

  useEffect(() => {
    setV(fromRow(initial));
    setError(null);
  }, [initial]);

  function upd<K extends keyof FormState>(k: K, val: FormState[K]) {
    setV((p) => ({ ...p, [k]: val }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!v.vale_a.trim()) {
      setError('"Vale a" es obligatorio.');
      return;
    }
    if (!v.monto || Number(v.monto) <= 0) {
      setError('Monto inválido.');
      return;
    }
    setError(null);
    await onSubmit(toInput(v));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {initial?.serial && (
        <div className="rounded-md border border-sand bg-sand-l/60 px-3 py-2 text-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-dark-3">Serial: </span>
          <span className="font-mono text-dark">{initial.serial}</span>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <TextInput name="fecha" label="Fecha" type="date" value={v.fecha} onChange={(e) => upd('fecha', e.target.value)} />
        <TextInput name="monto" label="Monto *" type="number" min="0" step="0.01" value={v.monto} onChange={(e) => upd('monto', e.target.value)} required />
        <Select name="moneda" label="Moneda" value={v.moneda} onChange={(e) => upd('moneda', e.target.value as Currency)}>
          <option value="GTQ">GTQ</option>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
          <option value="GBP">GBP</option>
        </Select>
      </div>
      <TextInput name="vale_a" label="Vale a *" value={v.vale_a} onChange={(e) => upd('vale_a', e.target.value)} required autoFocus />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextInput name="entidad" label="Entidad" value={v.entidad} onChange={(e) => upd('entidad', e.target.value)} />
        <TextInput name="lugar" label="Lugar" value={v.lugar} onChange={(e) => upd('lugar', e.target.value)} />
      </div>
      <TextArea name="concepto" label="Concepto" value={v.concepto} onChange={(e) => upd('concepto', e.target.value)} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select name="estado" label="Estado" value={v.estado} onChange={(e) => upd('estado', e.target.value as ValeStatus)}>
          {valeStatusOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>
        <Select name="liquidacion_id" label="Asignar a liquidación" value={v.liquidacion_id} onChange={(e) => upd('liquidacion_id', e.target.value)}>
          <option value="">— sin liquidación —</option>
          {(liqs.data ?? []).map((l) => (
            <option key={l.id} value={l.id}>{l.periodo ?? l.fecha} · {l.estado}</option>
          ))}
        </Select>
      </div>

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

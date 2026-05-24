import { useEffect, useState, type FormEvent } from 'react';
import { TextInput } from '@/components/ui/TextInput';
import { TextArea } from '@/components/ui/TextArea';
import { Select } from '@/components/ui/Select';
import type { CatalogFormProps } from '@/modules/admin/components/CatalogPage';
import type { Vale, ValeInsert } from './api';
import type { Database } from '@/types/database';
import { useLiquidaciones } from '../liquidaciones/hooks';
import { useEmpleados, useEntidades } from '@/modules/admin/hooks';

type Currency = Database['public']['Enums']['currency'];
type ValeStatus = Database['public']['Enums']['vale_status'];

// Aligned with reference HTML (8 user-facing labels).
export const VALE_STATUS_OPTIONS: { value: ValeStatus; label: string }[] = [
  { value: 'Creado', label: 'Creado' },
  { value: 'Solicitado', label: 'Solicitado' },
  { value: 'Acreditado', label: 'Acreditado' },
  { value: 'Asignado a Liquidación', label: 'Asignado a Liquidación' },
  { value: 'Pendiente de Liquidar', label: 'Pendiente de Liquidar' },
  { value: 'Pendiente de Reintegro', label: 'Pendiente de Reintegro' },
  { value: 'Liquidado', label: 'Liquidado' },
  { value: 'Reintegrado', label: 'Reintegrado' },
];

type FormState = {
  fecha: string;
  moneda: Currency;
  monto: string;
  vale_a: string;
  empleado_id: string;
  entidad: string;
  entidad_id: string;
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
  empleado_id: '',
  entidad: '',
  entidad_id: '',
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
    empleado_id: r.empleado_id ?? '',
    entidad: r.entidad ?? '',
    entidad_id: r.entidad_id ?? '',
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
    empleado_id: s.empleado_id || null,
    entidad: s.entidad.trim() || null,
    entidad_id: s.entidad_id || null,
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
  const empleados = useEmpleados();
  const entidades = useEntidades();

  useEffect(() => {
    setV(fromRow(initial));
    setError(null);
  }, [initial]);

  function upd<K extends keyof FormState>(k: K, val: FormState[K]) {
    setV((p) => {
      const next = { ...p, [k]: val };
      if (k === 'empleado_id' && val) {
        const emp = (empleados.data ?? []).find((x) => x.id === val);
        if (emp) next.vale_a = emp.nombre;
      }
      if (k === 'entidad_id' && val) {
        const e = (entidades.data ?? []).find((x) => x.id === val);
        if (e) next.entidad = e.nombre;
      }
      return next;
    });
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
        <div className="rounded-md border border-teal/40 bg-teal-l/50 px-3 py-2 text-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-dark-3">Serial: </span>
          <span className="font-mono font-semibold text-teal-d">{initial.serial}</span>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Select name="moneda" label="Moneda" value={v.moneda} onChange={(e) => upd('moneda', e.target.value as Currency)}>
          <option value="GTQ">GTQ (Q)</option>
          <option value="USD">USD ($)</option>
          <option value="EUR">EUR (€)</option>
          <option value="GBP">GBP (£)</option>
        </Select>
        <TextInput name="monto" label="Monto *" type="number" min="0" step="0.01" value={v.monto} onChange={(e) => upd('monto', e.target.value)} required hint="visible en el PDF" />
        <TextInput name="fecha" label="Fecha" type="date" value={v.fecha} onChange={(e) => upd('fecha', e.target.value)} />
      </div>
      <Select name="empleado_id" label="Vale a (empleado del catálogo)" value={v.empleado_id} onChange={(e) => upd('empleado_id', e.target.value)}>
        <option value="">— elegir o escribir abajo —</option>
        {(empleados.data ?? []).map((e) => (
          <option key={e.id} value={e.id}>{e.nombre}{e.puesto ? ` · ${e.puesto}` : ''}</option>
        ))}
      </Select>
      <TextInput name="vale_a" label="Vale a (firma solicitante) *" value={v.vale_a} onChange={(e) => upd('vale_a', e.target.value)} required autoFocus hint="Auto desde dropdown o manual" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select name="entidad_id" label="Entidad (catálogo)" value={v.entidad_id} onChange={(e) => upd('entidad_id', e.target.value)}>
          <option value="">— elegir o escribir abajo —</option>
          {(entidades.data ?? []).map((e) => (
            <option key={e.id} value={e.id}>{e.nombre}</option>
          ))}
        </Select>
        <TextInput name="lugar" label="Lugar" value={v.lugar} onChange={(e) => upd('lugar', e.target.value)} />
      </div>
      <TextInput name="entidad" label="Entidad a liquidar (texto)" value={v.entidad} onChange={(e) => upd('entidad', e.target.value)} hint="Auto desde dropdown o manual" />
      <TextArea name="concepto" label="Concepto" value={v.concepto} onChange={(e) => upd('concepto', e.target.value)} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select name="estado" label="Estado" value={v.estado} onChange={(e) => upd('estado', e.target.value as ValeStatus)}>
          {VALE_STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>
        <Select name="liquidacion_id" label="Asignar a liquidación" value={v.liquidacion_id} onChange={(e) => upd('liquidacion_id', e.target.value)}>
          <option value="">— sin liquidación —</option>
          {(liqs.data ?? []).map((l) => (
            <option key={l.id} value={l.id}>{l.serial ?? l.periodo ?? l.fecha} · {l.estado}</option>
          ))}
        </Select>
      </div>

      <TextArea name="notas" label="Notas" value={v.notas} onChange={(e) => upd('notas', e.target.value)} />

      {error && <p className="rounded-md border border-rust/30 bg-rust-l px-3 py-2 text-sm text-rust">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="rounded-md border border-sand px-4 py-2 text-sm font-semibold text-dark-2 hover:bg-sand-l">Cancelar</button>
        <button type="submit" disabled={submitting} className="rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-d disabled:opacity-60">
          {submitting ? 'Guardando…' : '✓ Guardar'}
        </button>
      </div>
    </form>
  );
}

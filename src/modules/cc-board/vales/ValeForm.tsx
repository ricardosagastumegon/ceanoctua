import { useEffect, useState, type FormEvent } from 'react';
import { TextInput } from '@/components/ui/TextInput';
import { TextArea } from '@/components/ui/TextArea';
import { Select } from '@/components/ui/Select';
import type { CatalogFormProps } from '@/modules/admin/components/CatalogPage';
import type { Vale, ValeInsert } from './api';
import type { Database } from '@/types/database';
import { useEmpleados, useEntidades } from '@/modules/admin/hooks';

type Currency = Database['public']['Enums']['currency'];
type ValeStatus = Database['public']['Enums']['vale_status'];
type ValeTipo = Database['public']['Enums']['vale_tipo'];

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
  tipo: ValeTipo;
  fecha: string;
  moneda: Currency;
  monto: string;
  vale_a: string;
  // tipo='desembolso': vale_a_empleado_id + liquidar_a_entidad_id
  // tipo='entidad': vale_a_entidad_id + liquidar_a_empleado_id
  vale_a_empleado_id: string;
  vale_a_entidad_id: string;
  liquidar_a_empleado_id: string;
  liquidar_a_entidad_id: string;
  concepto: string;
  lugar: string;
  estado: ValeStatus;
  notas: string;
};

const today = () => new Date().toISOString().slice(0, 10);

function emptyOf(tipo: ValeTipo): FormState {
  return {
    tipo,
    fecha: today(),
    moneda: 'GTQ',
    monto: '',
    vale_a: '',
    vale_a_empleado_id: '',
    vale_a_entidad_id: '',
    liquidar_a_empleado_id: '',
    liquidar_a_entidad_id: '',
    concepto: '',
    lugar: '',
    estado: 'Creado',
    notas: '',
  };
}

function fromRow(r: Vale | null | undefined, defaultTipo: ValeTipo): FormState {
  if (!r) return emptyOf(defaultTipo);
  return {
    tipo: r.tipo ?? 'desembolso',
    fecha: r.fecha ?? today(),
    moneda: r.moneda,
    monto: String(r.monto),
    vale_a: r.vale_a ?? '',
    vale_a_empleado_id: r.vale_a_empleado_id ?? '',
    vale_a_entidad_id: r.vale_a_entidad_id ?? '',
    liquidar_a_empleado_id: r.liquidar_a_empleado_id ?? '',
    liquidar_a_entidad_id: r.liquidar_a_entidad_id ?? '',
    concepto: r.concepto ?? '',
    lugar: r.lugar ?? '',
    estado: r.estado,
    notas: r.notas ?? '',
  };
}

function toInput(s: FormState): ValeInsert {
  const n = Number(s.monto);
  // Solo mandar los FKs del tipo correspondiente (el CHECK constraint del SQL
  // exige coherencia).
  const isDesembolso = s.tipo === 'desembolso';
  return {
    tipo: s.tipo,
    fecha: s.fecha || null,
    moneda: s.moneda,
    monto: Number.isFinite(n) ? n : 0,
    vale_a: s.vale_a.trim(),
    vale_a_empleado_id: isDesembolso ? (s.vale_a_empleado_id || null) : null,
    vale_a_entidad_id: !isDesembolso ? (s.vale_a_entidad_id || null) : null,
    liquidar_a_empleado_id: !isDesembolso ? (s.liquidar_a_empleado_id || null) : null,
    liquidar_a_entidad_id: isDesembolso ? (s.liquidar_a_entidad_id || null) : null,
    // Backfill columnas viejas para no romper UIs/reports legacy.
    empleado_id: isDesembolso ? (s.vale_a_empleado_id || null) : (s.liquidar_a_empleado_id || null),
    entidad_id: isDesembolso ? (s.liquidar_a_entidad_id || null) : (s.vale_a_entidad_id || null),
    concepto: s.concepto.trim() || null,
    lugar: s.lugar.trim() || null,
    estado: s.estado,
    notas: s.notas.trim() || null,
  };
}

type Props = CatalogFormProps<Vale, ValeInsert> & { defaultTipo?: ValeTipo };

export function ValeForm({ initial, submitting, onSubmit, onCancel, defaultTipo = 'desembolso' }: Props) {
  const [v, setV] = useState<FormState>(fromRow(initial, defaultTipo));
  const [error, setError] = useState<string | null>(null);
  const empleados = useEmpleados();
  const entidades = useEntidades();

  useEffect(() => {
    setV(fromRow(initial, defaultTipo));
    setError(null);
  }, [initial, defaultTipo]);

  function upd<K extends keyof FormState>(k: K, val: FormState[K]) {
    setV((p) => {
      const next = { ...p, [k]: val };
      if (k === 'vale_a_empleado_id' && val) {
        const emp = (empleados.data ?? []).find((x) => x.id === val);
        if (emp) next.vale_a = emp.nombre;
      }
      if (k === 'vale_a_entidad_id' && val) {
        const e = (entidades.data ?? []).find((x) => x.id === val);
        if (e) next.vale_a = e.nombre;
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

  const isDesembolso = v.tipo === 'desembolso';
  const tipoLabel = isDesembolso ? 'Vale por Desembolso' : 'Vale a Entidad';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {initial?.serial && (
        <div className="rounded-md border border-teal/40 bg-teal-l/50 px-3 py-2 text-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-dark-3">Serial: </span>
          <span className="font-mono font-semibold text-teal-d">{initial.serial}</span>
        </div>
      )}

      <div className="rounded-md border border-teal/40 bg-teal-l/30 px-3 py-2 text-sm">
        <span className="text-xs font-semibold uppercase tracking-wider text-dark-3">Tipo: </span>
        <span className="font-semibold text-teal-d">{tipoLabel}</span>
        {isDesembolso ? (
          <span className="ml-2 text-xs text-dark-3">(empleado recibe el dinero, se liquida a una entidad)</span>
        ) : (
          <span className="ml-2 text-xs text-dark-3">(la entidad recibe; un empleado financia y reclama reintegro)</span>
        )}
      </div>

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

      {/* Vale a: dropdown invertido según tipo */}
      {isDesembolso ? (
        <Select name="vale_a_empleado_id" label="Vale a · Empleado *" value={v.vale_a_empleado_id} onChange={(e) => upd('vale_a_empleado_id', e.target.value)}>
          <option value="">— elegir empleado —</option>
          {(empleados.data ?? []).map((e) => (
            <option key={e.id} value={e.id}>{e.nombre}{e.puesto ? ` · ${e.puesto}` : ''}</option>
          ))}
        </Select>
      ) : (
        <Select name="vale_a_entidad_id" label="Vale a · Entidad *" value={v.vale_a_entidad_id} onChange={(e) => upd('vale_a_entidad_id', e.target.value)}>
          <option value="">— elegir entidad —</option>
          {(entidades.data ?? []).map((e) => (
            <option key={e.id} value={e.id}>{e.nombre}</option>
          ))}
        </Select>
      )}
      <TextInput name="vale_a" label="Nombre en el vale *" value={v.vale_a} onChange={(e) => upd('vale_a', e.target.value)} required autoFocus hint="Auto-llenado por el dropdown — visible en el PDF" />

      {/* Liquidar a: opuesto al "vale a" */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {isDesembolso ? (
          <Select name="liquidar_a_entidad_id" label="Liquidar a · Entidad" value={v.liquidar_a_entidad_id} onChange={(e) => upd('liquidar_a_entidad_id', e.target.value)}>
            <option value="">— sin seleccionar —</option>
            {(entidades.data ?? []).map((e) => (
              <option key={e.id} value={e.id}>{e.nombre}</option>
            ))}
          </Select>
        ) : (
          <Select name="liquidar_a_empleado_id" label="Liquidar a · Empleado" value={v.liquidar_a_empleado_id} onChange={(e) => upd('liquidar_a_empleado_id', e.target.value)}>
            <option value="">— sin seleccionar —</option>
            {(empleados.data ?? []).map((e) => (
              <option key={e.id} value={e.id}>{e.nombre}</option>
            ))}
          </Select>
        )}
        <TextInput name="lugar" label="Lugar" value={v.lugar} onChange={(e) => upd('lugar', e.target.value)} />
      </div>

      <TextArea name="concepto" label="Concepto" value={v.concepto} onChange={(e) => upd('concepto', e.target.value)} />

      <Select name="estado" label="Status" value={v.estado} onChange={(e) => upd('estado', e.target.value as ValeStatus)}>
        {VALE_STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </Select>

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

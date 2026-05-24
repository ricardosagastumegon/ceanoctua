import { useEffect, useState, type FormEvent } from 'react';
import { TextInput } from '@/components/ui/TextInput';
import { TextArea } from '@/components/ui/TextArea';
import { Select } from '@/components/ui/Select';
import type { CatalogFormProps } from '@/modules/admin/components/CatalogPage';
import type { Reintegro, ReintegroInsert } from './api';
import type { Database } from '@/types/database';
import { useAutorizadores } from '@/modules/admin/hooks';
import { useConsumos } from '../consumos/hooks';

type Currency = Database['public']['Enums']['currency'];
type ReintegroStatus = Database['public']['Enums']['reintegro_status'];

const statusOptions: { value: ReintegroStatus; label: string }[] = [
  { value: 'generada', label: 'Generada' },
  { value: 'firmada', label: 'Firmada' },
  { value: 'presentada', label: 'Presentada' },
  { value: 'procesada', label: 'Procesada' },
  { value: 'reintegrada', label: 'Reintegrada' },
];

type FormState = {
  fecha: string;
  empresa: string;
  tc_empresa: string;
  card_id: string;
  consumo_id: string;
  monto: string;
  moneda: Currency;
  autorizo: string;
  autorizador_id: string;
  estado: ReintegroStatus;
  notas: string;
};

const today = () => new Date().toISOString().slice(0, 10);
const empty: FormState = {
  fecha: today(),
  empresa: '',
  tc_empresa: '',
  card_id: '',
  consumo_id: '',
  monto: '',
  moneda: 'GTQ',
  autorizo: '',
  autorizador_id: '',
  estado: 'generada',
  notas: '',
};

function fromRow(r: Reintegro | null | undefined): FormState {
  if (!r) return empty;
  return {
    fecha: r.fecha ?? today(),
    empresa: r.empresa ?? '',
    tc_empresa: r.tc_empresa ?? '',
    card_id: r.card_id ?? '',
    consumo_id: r.consumo_id ?? '',
    monto: String(r.monto),
    moneda: r.moneda,
    autorizo: r.autorizo ?? '',
    autorizador_id: r.autorizador_id ?? '',
    estado: r.estado,
    notas: r.notas ?? '',
  };
}

function toInput(s: FormState): ReintegroInsert {
  const n = Number(s.monto);
  return {
    fecha: s.fecha,
    empresa: s.empresa.trim(),
    tc_empresa: s.tc_empresa.trim() || null,
    card_id: s.card_id.trim(),
    consumo_id: s.consumo_id || null,
    monto: Number.isFinite(n) ? n : 0,
    moneda: s.moneda,
    autorizo: s.autorizo.trim() || null,
    autorizador_id: s.autorizador_id || null,
    estado: s.estado,
    notas: s.notas.trim() || null,
  };
}

export function ReintegroForm({ initial, submitting, onSubmit, onCancel }: CatalogFormProps<Reintegro, ReintegroInsert>) {
  const [v, setV] = useState<FormState>(fromRow(initial));
  const [error, setError] = useState<string | null>(null);
  const consumos = useConsumos();
  const autorizadores = useAutorizadores();

  useEffect(() => {
    setV(fromRow(initial));
    setError(null);
  }, [initial]);

  function upd<K extends keyof FormState>(k: K, val: FormState[K]) {
    setV((p) => {
      const next = { ...p, [k]: val };
      if (k === 'consumo_id' && val) {
        const c = (consumos.data ?? []).find((x) => x.id === val);
        if (c) {
          next.empresa = c.empresa ?? next.empresa;
          next.card_id = c.card_id;
          next.monto = String(c.monto);
          next.moneda = c.moneda;
        }
      }
      if (k === 'autorizador_id' && val) {
        const a = (autorizadores.data ?? []).find((x) => x.id === val);
        if (a) next.autorizo = a.nombre;
      }
      return next;
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!v.empresa.trim() || !v.card_id.trim()) {
      setError('Empresa y tarjeta son obligatorios.');
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextInput name="fecha" label="Fecha *" type="date" value={v.fecha} onChange={(e) => upd('fecha', e.target.value)} required />
        <Select name="estado" label="Estado" value={v.estado} onChange={(e) => upd('estado', e.target.value as ReintegroStatus)}>
          {statusOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>
      </div>

      <Select name="consumo_id" label="Consumo que reembolsa *" value={v.consumo_id} onChange={(e) => upd('consumo_id', e.target.value)}>
        <option value="">— elegir consumo —</option>
        {(consumos.data ?? []).map((c) => (
          <option key={c.id} value={c.id}>
            {c.voucher_num ?? '—'} · {c.fecha} · {c.proveedor} · {c.monto} {c.moneda}
          </option>
        ))}
      </Select>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <TextInput name="empresa" label="Empresa *" value={v.empresa} onChange={(e) => upd('empresa', e.target.value)} required />
        <TextInput name="tc_empresa" label="TC empresa" value={v.tc_empresa} onChange={(e) => upd('tc_empresa', e.target.value)} />
        <TextInput name="card_id" label="Tarjeta *" value={v.card_id} onChange={(e) => upd('card_id', e.target.value)} required />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <TextInput name="monto" label="Monto *" type="number" min="0" step="0.01" value={v.monto} onChange={(e) => upd('monto', e.target.value)} required />
        <Select name="moneda" label="Moneda" value={v.moneda} onChange={(e) => upd('moneda', e.target.value as Currency)}>
          <option value="GTQ">GTQ</option>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
          <option value="GBP">GBP</option>
        </Select>
        <Select name="autorizador_id" label="Autorizador" value={v.autorizador_id} onChange={(e) => upd('autorizador_id', e.target.value)}>
          <option value="">—</option>
          {(autorizadores.data ?? []).map((a) => (
            <option key={a.id} value={a.id}>{a.nombre}</option>
          ))}
        </Select>
      </div>

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

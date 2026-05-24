import { useEffect, useState, type FormEvent } from 'react';
import { TextInput } from '@/components/ui/TextInput';
import { TextArea } from '@/components/ui/TextArea';
import { Select } from '@/components/ui/Select';
import { DocumentAttachment } from '@/components/ui/DocumentAttachment';
import type { CatalogFormProps } from '@/modules/admin/components/CatalogPage';
import type { Voucher, VoucherInsert } from './api';
import type { Database } from '@/types/database';
import { useConsumos } from '../consumos/hooks';

type Currency = Database['public']['Enums']['currency'];

type FormState = {
  fecha: string;
  consumo_id: string;
  monto: string;
  moneda: Currency;
  pagado_por: string;
  concepto: string;
  notas: string;
};

const today = () => new Date().toISOString().slice(0, 10);
const empty: FormState = {
  fecha: today(),
  consumo_id: '',
  monto: '',
  moneda: 'GTQ',
  pagado_por: '',
  concepto: '',
  notas: '',
};

function fromRow(r: Voucher | null | undefined): FormState {
  if (!r) return empty;
  return {
    fecha: r.fecha ?? today(),
    consumo_id: r.consumo_id ?? '',
    monto: r.monto != null ? String(r.monto) : '',
    moneda: (r.moneda ?? 'GTQ') as Currency,
    pagado_por: r.pagado_por ?? '',
    concepto: r.concepto ?? '',
    notas: r.notas ?? '',
  };
}

function toInput(s: FormState): VoucherInsert {
  const n = Number(s.monto);
  return {
    fecha: s.fecha,
    consumo_id: s.consumo_id || null,
    monto: Number.isFinite(n) && s.monto.trim() !== '' ? n : null,
    moneda: s.moneda,
    pagado_por: s.pagado_por.trim() || null,
    concepto: s.concepto.trim() || null,
    notas: s.notas.trim() || null,
  };
}

export function VoucherForm({ initial, submitting, onSubmit, onCancel }: CatalogFormProps<Voucher, VoucherInsert>) {
  const [v, setV] = useState<FormState>(fromRow(initial));
  const [error, setError] = useState<string | null>(null);
  const consumos = useConsumos();

  useEffect(() => {
    setV(fromRow(initial));
    setError(null);
  }, [initial]);

  function upd<K extends keyof FormState>(k: K, val: FormState[K]) {
    setV((p) => ({ ...p, [k]: val }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!v.consumo_id) {
      setError('Debe enlazarse a un consumo.');
      return;
    }
    setError(null);
    await onSubmit(toInput(v));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Select name="consumo_id" label="Consumo *" value={v.consumo_id} onChange={(e) => upd('consumo_id', e.target.value)}>
        <option value="">— elegir consumo —</option>
        {(consumos.data ?? []).map((c) => (
          <option key={c.id} value={c.id}>{c.voucher_num ?? '—'} · {c.fecha} · {c.proveedor} · {c.monto} {c.moneda}</option>
        ))}
      </Select>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <TextInput name="fecha" label="Fecha *" type="date" value={v.fecha} onChange={(e) => upd('fecha', e.target.value)} required />
        <TextInput name="monto" label="Monto" type="number" min="0" step="0.01" value={v.monto} onChange={(e) => upd('monto', e.target.value)} />
        <Select name="moneda" label="Moneda" value={v.moneda} onChange={(e) => upd('moneda', e.target.value as Currency)}>
          <option value="GTQ">GTQ</option>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
          <option value="GBP">GBP</option>
        </Select>
      </div>

      <TextInput name="pagado_por" label="Pagado por" value={v.pagado_por} onChange={(e) => upd('pagado_por', e.target.value)} />
      <TextInput name="concepto" label="Concepto" value={v.concepto} onChange={(e) => upd('concepto', e.target.value)} />
      <TextArea name="notas" label="Notas" value={v.notas} onChange={(e) => upd('notas', e.target.value)} />

      {/* Comprobante adjunto */}
      {initial?.id && (
        <div className="rounded-md border border-sand bg-sand-l/30 p-4">
          <DocumentAttachment entidadTipo="vouchers" entidadId={initial.id} canEdit={true} label="Comprobante" />
        </div>
      )}

      {error && <p className="rounded-md border border-rust/30 bg-rust-l px-3 py-2 text-sm text-rust">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="rounded-md border border-sand px-4 py-2 text-sm font-semibold text-dark-2 hover:bg-sand-l">Cancelar</button>
        <button type="submit" disabled={submitting} className="rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-d disabled:opacity-60">
          {submitting ? 'Guardando…' : initial?.id ? 'Guardar cambios' : 'Crear voucher'}
        </button>
      </div>
    </form>
  );
}

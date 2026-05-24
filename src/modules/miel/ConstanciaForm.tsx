import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { TextInput } from '@/components/ui/TextInput';
import { TextArea } from '@/components/ui/TextArea';
import { Select } from '@/components/ui/Select';
import { formatMoney } from '@/lib/money';
import type { CatalogFormProps } from '@/modules/admin/components/CatalogPage';
import type { Constancia, ConstanciaInsert } from './api';
import type { Database } from '@/types/database';

type Currency = Database['public']['Enums']['currency'];

type FormState = {
  fecha: string;
  nombre: string;
  direccion: string;
  cant475: string;
  precio475: string;
  cant1000: string;
  precio1000: string;
  envio: boolean;
  envio_dir: string;
  envio_costo: string;
  moneda: Currency;
  entregado: string;
  recibido: string;
  notas: string;
};

const today = () => new Date().toISOString().slice(0, 10);

const empty: FormState = {
  fecha: today(),
  nombre: '',
  direccion: '',
  cant475: '0',
  precio475: '0',
  cant1000: '0',
  precio1000: '0',
  envio: false,
  envio_dir: '',
  envio_costo: '0',
  moneda: 'GTQ',
  entregado: '',
  recibido: '',
  notas: '',
};

function fromRow(r: Constancia | null | undefined): FormState {
  if (!r) return empty;
  return {
    fecha: r.fecha ?? today(),
    nombre: r.nombre ?? '',
    direccion: r.direccion ?? '',
    cant475: String(r.cant475 ?? 0),
    precio475: String(r.precio475 ?? 0),
    cant1000: String(r.cant1000 ?? 0),
    precio1000: String(r.precio1000 ?? 0),
    envio: r.envio ?? false,
    envio_dir: r.envio_dir ?? '',
    envio_costo: String(r.envio_costo ?? 0),
    moneda: r.moneda ?? 'GTQ',
    entregado: r.entregado ?? '',
    recibido: r.recibido ?? '',
    notas: r.notas ?? '',
  };
}

function n(s: string): number {
  const v = Number(s);
  return Number.isFinite(v) ? v : 0;
}

function toInput(s: FormState, total: number): ConstanciaInsert {
  return {
    fecha: s.fecha,
    nombre: s.nombre.trim(),
    direccion: s.direccion.trim() || null,
    cant475: n(s.cant475),
    precio475: n(s.precio475),
    cant1000: n(s.cant1000),
    precio1000: n(s.precio1000),
    envio: s.envio,
    envio_dir: s.envio_dir.trim() || null,
    envio_costo: s.envio ? n(s.envio_costo) : 0,
    moneda: s.moneda,
    total,
    entregado: s.entregado.trim() || null,
    recibido: s.recibido.trim() || null,
    notas: s.notas.trim() || null,
  };
}

export function ConstanciaForm({
  initial,
  submitting,
  onSubmit,
  onCancel,
}: CatalogFormProps<Constancia, ConstanciaInsert>) {
  const [v, setV] = useState<FormState>(fromRow(initial));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setV(fromRow(initial));
    setError(null);
  }, [initial]);

  function upd<K extends keyof FormState>(k: K, val: FormState[K]) {
    setV((p) => ({ ...p, [k]: val }));
  }

  const subtotal475 = n(v.cant475) * n(v.precio475);
  const subtotal1000 = n(v.cant1000) * n(v.precio1000);
  const envioCost = v.envio ? n(v.envio_costo) : 0;
  const total = useMemo(() => subtotal475 + subtotal1000 + envioCost, [subtotal475, subtotal1000, envioCost]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!v.nombre.trim()) {
      setError('El nombre del destinatario es obligatorio.');
      return;
    }
    setError(null);
    await onSubmit(toInput(v, total));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {initial?.correlativo && (
        <div className="rounded-md border border-sand bg-sand-l/60 px-3 py-2 text-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-dark-3">Correlativo: </span>
          <span className="font-mono text-dark">{initial.correlativo}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextInput name="fecha" label="Fecha *" type="date" value={v.fecha} onChange={(e) => upd('fecha', e.target.value)} required />
        <TextInput name="nombre" label="Destinatario *" value={v.nombre} onChange={(e) => upd('nombre', e.target.value)} required autoFocus />
      </div>
      <TextInput name="direccion" label="Dirección" value={v.direccion} onChange={(e) => upd('direccion', e.target.value)} />

      <fieldset className="space-y-3 rounded-md border border-sand bg-sand-l/30 p-4">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-dark-2">Producto</legend>
        <div className="grid grid-cols-12 gap-2 text-xs font-semibold uppercase tracking-wider text-dark-3">
          <span className="col-span-4">Presentación</span>
          <span className="col-span-2 text-right">Cantidad</span>
          <span className="col-span-3 text-right">Precio unit.</span>
          <span className="col-span-3 text-right">Subtotal</span>
        </div>
        <div className="grid grid-cols-12 items-center gap-2 text-sm">
          <span className="col-span-4 text-dark">Miel 475g</span>
          <input type="number" min="0" step="0.5" value={v.cant475} onChange={(e) => upd('cant475', e.target.value)} className="col-span-2 rounded-md border border-sand bg-white px-2 py-1.5 text-right text-sm" />
          <input type="number" min="0" step="0.01" value={v.precio475} onChange={(e) => upd('precio475', e.target.value)} className="col-span-3 rounded-md border border-sand bg-white px-2 py-1.5 text-right text-sm" />
          <span className="col-span-3 text-right font-mono text-dark">{formatMoneyVal(subtotal475, v.moneda)}</span>
        </div>
        <div className="grid grid-cols-12 items-center gap-2 text-sm">
          <span className="col-span-4 text-dark">Miel 1000g</span>
          <input type="number" min="0" step="0.5" value={v.cant1000} onChange={(e) => upd('cant1000', e.target.value)} className="col-span-2 rounded-md border border-sand bg-white px-2 py-1.5 text-right text-sm" />
          <input type="number" min="0" step="0.01" value={v.precio1000} onChange={(e) => upd('precio1000', e.target.value)} className="col-span-3 rounded-md border border-sand bg-white px-2 py-1.5 text-right text-sm" />
          <span className="col-span-3 text-right font-mono text-dark">{formatMoneyVal(subtotal1000, v.moneda)}</span>
        </div>
      </fieldset>

      <fieldset className="space-y-3 rounded-md border border-sand p-4">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-dark-2">Envío</legend>
        <label className="flex items-center gap-2 text-sm text-dark-2">
          <input type="checkbox" checked={v.envio} onChange={(e) => upd('envio', e.target.checked)} className="h-4 w-4 rounded border-sand text-teal focus:ring-teal" />
          Requiere envío
        </label>
        {v.envio && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <TextInput name="envio_dir" label="Dirección de envío" value={v.envio_dir} onChange={(e) => upd('envio_dir', e.target.value)} className="sm:col-span-2" />
            <TextInput name="envio_costo" label="Costo de envío" type="number" min="0" step="0.01" value={v.envio_costo} onChange={(e) => upd('envio_costo', e.target.value)} />
          </div>
        )}
      </fieldset>

      <div className="rounded-md border border-teal/40 bg-teal-l/50 px-4 py-3 text-right">
        <span className="text-xs font-semibold uppercase tracking-wider text-teal-d">Total: </span>
        <span className="ml-2 font-mono text-lg font-bold text-teal-d">{formatMoneyVal(total, v.moneda)}</span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Select name="moneda" label="Moneda" value={v.moneda} onChange={(e) => upd('moneda', e.target.value as Currency)}>
          <option value="GTQ">GTQ</option>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
          <option value="GBP">GBP</option>
        </Select>
        <TextInput name="entregado" label="Entregado por" value={v.entregado} onChange={(e) => upd('entregado', e.target.value)} />
        <TextInput name="recibido" label="Recibido por" value={v.recibido} onChange={(e) => upd('recibido', e.target.value)} />
      </div>

      <TextArea name="notas" label="Notas" value={v.notas} onChange={(e) => upd('notas', e.target.value)} />

      {error && <p className="rounded-md border border-rust/30 bg-rust-l px-3 py-2 text-sm text-rust">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="rounded-md border border-sand px-4 py-2 text-sm font-semibold text-dark-2 hover:bg-sand-l">Cancelar</button>
        <button type="submit" disabled={submitting} className="rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-d disabled:opacity-60">
          {submitting ? 'Guardando…' : initial?.id ? 'Guardar cambios' : 'Crear constancia'}
        </button>
      </div>
    </form>
  );
}

function formatMoneyVal(n: number, currency: Currency): string {
  if (currency === 'GTQ') return formatMoney(n);
  // For non-GTQ, fall back to a generic en-US formatting with the currency symbol
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
}

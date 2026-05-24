import { useEffect, useState, type FormEvent } from 'react';
import { TextInput } from '@/components/ui/TextInput';
import { TextArea } from '@/components/ui/TextArea';
import { Select } from '@/components/ui/Select';
import { formatMoney } from '@/lib/money';
import type { CatalogFormProps } from '@/modules/admin/components/CatalogPage';
import type { Liquidacion, LiquidacionInsert } from './api';
import type { Database } from '@/types/database';
import { useValesByLiquidacion } from './hooks';

type Currency = Database['public']['Enums']['currency'];

type FormState = {
  fecha: string;
  periodo: string;
  moneda: Currency;
  responsable: string;
  estado: string;
  notas: string;
};

const today = () => new Date().toISOString().slice(0, 10);
const empty: FormState = { fecha: today(), periodo: '', moneda: 'GTQ', responsable: '', estado: 'Creada', notas: '' };

function fromRow(r: Liquidacion | null | undefined): FormState {
  if (!r) return empty;
  return {
    fecha: r.fecha ?? today(),
    periodo: r.periodo ?? '',
    moneda: r.moneda,
    responsable: r.responsable ?? '',
    estado: r.estado ?? 'Creada',
    notas: r.notas ?? '',
  };
}

function toInput(s: FormState, monto_total: number): LiquidacionInsert {
  return {
    fecha: s.fecha,
    periodo: s.periodo.trim() || null,
    moneda: s.moneda,
    monto_total,
    responsable: s.responsable.trim() || null,
    estado: s.estado,
    notas: s.notas.trim() || null,
  };
}

function fmt(n: number, currency: string): string {
  if (currency === 'GTQ') return formatMoney(Number(n));
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(n));
}

export function LiquidacionForm({ initial, submitting, onSubmit, onCancel }: CatalogFormProps<Liquidacion, LiquidacionInsert>) {
  const [v, setV] = useState<FormState>(fromRow(initial));
  const [error, setError] = useState<string | null>(null);
  const valesQuery = useValesByLiquidacion(initial?.id);

  useEffect(() => {
    setV(fromRow(initial));
    setError(null);
  }, [initial]);

  function upd<K extends keyof FormState>(k: K, val: FormState[K]) {
    setV((p) => ({ ...p, [k]: val }));
  }

  const vales = valesQuery.data ?? [];
  const computedTotal = vales.reduce((acc, x) => acc + Number(x.monto), 0);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!v.fecha) {
      setError('La fecha es obligatoria.');
      return;
    }
    setError(null);
    await onSubmit(toInput(v, computedTotal || (initial?.monto_total ?? 0)));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <TextInput name="fecha" label="Fecha *" type="date" value={v.fecha} onChange={(e) => upd('fecha', e.target.value)} required autoFocus />
        <TextInput name="periodo" label="Período" value={v.periodo} onChange={(e) => upd('periodo', e.target.value)} hint="ej. 2026-05" />
        <Select name="moneda" label="Moneda" value={v.moneda} onChange={(e) => upd('moneda', e.target.value as Currency)}>
          <option value="GTQ">GTQ</option>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
          <option value="GBP">GBP</option>
        </Select>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextInput name="responsable" label="Responsable" value={v.responsable} onChange={(e) => upd('responsable', e.target.value)} />
        <Select name="estado" label="Estado" value={v.estado} onChange={(e) => upd('estado', e.target.value)}>
          <option value="Creada">Creada</option>
          <option value="EnRevision">En revisión</option>
          <option value="Aprobada">Aprobada</option>
          <option value="Liquidada">Liquidada</option>
          <option value="Anulada">Anulada</option>
        </Select>
      </div>
      <TextArea name="notas" label="Notas" value={v.notas} onChange={(e) => upd('notas', e.target.value)} />

      {/* Vales asignados (read-only) */}
      {initial?.id && (
        <fieldset className="rounded-md border border-sand bg-sand-l/30 p-4">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-dark-2">Vales asignados</legend>
          {valesQuery.isLoading ? (
            <p className="text-xs text-dark-3">Cargando…</p>
          ) : vales.length === 0 ? (
            <p className="text-xs text-dark-3">Sin vales asignados. Asígnalos desde el formulario del vale (campo "Asignar a liquidación").</p>
          ) : (
            <>
              <ul className="divide-y divide-sand">
                {vales.map((x) => (
                  <li key={x.id} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <span className="font-mono text-xs text-dark-3">{x.serial ?? '—'}</span>
                      <span className="ml-2 font-medium text-dark">{x.vale_a}</span>
                      {x.concepto && <span className="ml-2 text-xs text-dark-3">· {x.concepto}</span>}
                    </div>
                    <span className="font-mono text-dark">{fmt(Number(x.monto), x.moneda)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex items-center justify-between border-t border-sand pt-3 text-sm font-semibold">
                <span className="text-dark-2">Total ({vales.length} vales)</span>
                <span className="font-mono text-teal-d">{fmt(computedTotal, v.moneda)}</span>
              </div>
            </>
          )}
        </fieldset>
      )}

      {error && <p className="rounded-md border border-rust/30 bg-rust-l px-3 py-2 text-sm text-rust">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="rounded-md border border-sand px-4 py-2 text-sm font-semibold text-dark-2 hover:bg-sand-l">Cancelar</button>
        <button type="submit" disabled={submitting} className="rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-d disabled:opacity-60">
          {submitting ? 'Guardando…' : initial?.id ? 'Guardar cambios' : 'Crear liquidación'}
        </button>
      </div>
    </form>
  );
}

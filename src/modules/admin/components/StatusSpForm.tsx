import { useEffect, useState, type FormEvent } from 'react';
import { TextInput } from '@/components/ui/TextInput';
import type { StatusSp, StatusSpInsert } from '../api';
import type { CatalogFormProps } from './CatalogPage';

type FormState = { nombre: string; orden: string; activo: boolean };

const empty: FormState = { nombre: '', orden: '99', activo: true };

function fromRow(r: StatusSp | null | undefined): FormState {
  if (!r) return empty;
  return { nombre: r.nombre, orden: String(r.orden), activo: r.activo };
}

function toInput(s: FormState): StatusSpInsert {
  return {
    nombre: s.nombre.trim(),
    orden: Number(s.orden) || 99,
    activo: s.activo,
  };
}

export function StatusSpForm({
  initial,
  submitting,
  onSubmit,
  onCancel,
}: CatalogFormProps<StatusSp, StatusSpInsert>) {
  const [v, setV] = useState<FormState>(fromRow(initial));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setV(fromRow(initial));
    setError(null);
  }, [initial]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!v.nombre.trim()) {
      setError('El nombre es obligatorio.');
      return;
    }
    setError(null);
    await onSubmit(toInput(v));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[2fr_1fr]">
        <TextInput
          name="nombre"
          label="Nombre *"
          value={v.nombre}
          onChange={(e) => setV((p) => ({ ...p, nombre: e.target.value }))}
          required
          autoFocus
          hint="ej. Generado, Firmado, Pagado…"
        />
        <TextInput
          name="orden"
          label="Orden *"
          type="number"
          min="1"
          step="1"
          value={v.orden}
          onChange={(e) => setV((p) => ({ ...p, orden: e.target.value }))}
          required
          hint="posición en el flujo (1..N)"
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-dark">
        <input
          type="checkbox"
          checked={v.activo}
          onChange={(e) => setV((p) => ({ ...p, activo: e.target.checked }))}
          className="h-4 w-4 rounded border-sand text-teal focus:ring-teal"
        />
        <span>Activo (visible en selects)</span>
      </label>

      {error && (
        <p className="rounded-md border border-rust/30 bg-rust-l px-3 py-2 text-sm text-rust">{error}</p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-sand px-4 py-2 text-sm font-semibold text-dark-2 hover:bg-sand-l"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-d disabled:opacity-60"
        >
          {submitting ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  );
}

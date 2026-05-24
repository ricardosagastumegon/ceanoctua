import { useEffect, useState, type FormEvent } from 'react';
import { TextInput } from '@/components/ui/TextInput';
import type { Empleado, EmpleadoInsert } from '../api';
import type { CatalogFormProps } from './CatalogPage';

type FormState = { nombre: string; puesto: string; depto: string };

const empty: FormState = { nombre: '', puesto: '', depto: '' };

function fromRow(r: Empleado | null | undefined): FormState {
  if (!r) return empty;
  return { nombre: r.nombre ?? '', puesto: r.puesto ?? '', depto: r.depto ?? '' };
}

function toInput(s: FormState): EmpleadoInsert {
  return {
    nombre: s.nombre.trim(),
    puesto: s.puesto.trim() || null,
    depto: s.depto.trim() || null,
  };
}

export function EmpleadoForm({
  initial,
  submitting,
  onSubmit,
  onCancel,
}: CatalogFormProps<Empleado, EmpleadoInsert>) {
  const [values, setValues] = useState<FormState>(fromRow(initial));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValues(fromRow(initial));
    setError(null);
  }, [initial]);

  function upd<K extends keyof FormState>(k: K, v: string) {
    setValues((p) => ({ ...p, [k]: v }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!values.nombre.trim() || !values.puesto.trim() || !values.depto.trim()) {
      setError('Nombre, puesto y departamento son obligatorios.');
      return;
    }
    setError(null);
    await onSubmit(toInput(values));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <TextInput
        name="nombre"
        label="Nombre *"
        value={values.nombre}
        onChange={(e) => upd('nombre', e.target.value)}
        required
        autoFocus
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextInput
          name="puesto"
          label="Puesto *"
          value={values.puesto}
          onChange={(e) => upd('puesto', e.target.value)}
          required
        />
        <TextInput
          name="depto"
          label="Depto *"
          value={values.depto}
          onChange={(e) => upd('depto', e.target.value)}
          required
        />
      </div>

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

import { useEffect, useState, type FormEvent } from 'react';
import { TextInput } from '@/components/ui/TextInput';
import type { Autorizador, AutorizadorInsert } from '../api';
import type { CatalogFormProps } from './CatalogPage';

type FormState = { nombre: string; nit: string; dir: string };

const empty: FormState = { nombre: '', nit: '', dir: '' };

function fromRow(r: Autorizador | null | undefined): FormState {
  if (!r) return empty;
  return { nombre: r.nombre ?? '', nit: r.nit ?? '', dir: r.dir ?? '' };
}

function toInput(s: FormState): AutorizadorInsert {
  return {
    nombre: s.nombre.trim(),
    nit: s.nit.trim() || null,
    dir: s.dir.trim() || null,
  };
}

export function AutorizadorForm({
  initial,
  submitting,
  onSubmit,
  onCancel,
}: CatalogFormProps<Autorizador, AutorizadorInsert>) {
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
    if (!values.nombre.trim()) {
      setError('El nombre es obligatorio.');
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
        <TextInput name="nit" label="NIT" value={values.nit} onChange={(e) => upd('nit', e.target.value)} />
        <TextInput name="dir" label="Dirección" value={values.dir} onChange={(e) => upd('dir', e.target.value)} />
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

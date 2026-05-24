import { useEffect, useState, type FormEvent } from 'react';
import { TextInput } from '@/components/ui/TextInput';
import { TextArea } from '@/components/ui/TextArea';
import type { Entidad, EntidadInsert } from '../api';

type EntidadFormProps = {
  initial?: Entidad | null;
  submitting?: boolean;
  onSubmit: (values: EntidadInsert) => void | Promise<void>;
  onCancel: () => void;
};

type FormState = {
  nombre: string;
  nit: string;
  direccion: string;
  contacto: string;
  telefono: string;
  email: string;
  notas: string;
};

const empty: FormState = {
  nombre: '',
  nit: '',
  direccion: '',
  contacto: '',
  telefono: '',
  email: '',
  notas: '',
};

function fromEntidad(e: Entidad | null | undefined): FormState {
  if (!e) return empty;
  return {
    nombre: e.nombre ?? '',
    nit: e.nit ?? '',
    direccion: e.direccion ?? '',
    contacto: e.contacto ?? '',
    telefono: e.telefono ?? '',
    email: e.email ?? '',
    notas: e.notas ?? '',
  };
}

function toInsert(s: FormState): EntidadInsert {
  return {
    nombre: s.nombre.trim(),
    nit: s.nit.trim() || null,
    direccion: s.direccion.trim() || null,
    contacto: s.contacto.trim() || null,
    telefono: s.telefono.trim() || null,
    email: s.email.trim() || null,
    notas: s.notas.trim() || null,
  };
}

export function EntidadForm({ initial, submitting, onSubmit, onCancel }: EntidadFormProps) {
  const [values, setValues] = useState<FormState>(fromEntidad(initial));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValues(fromEntidad(initial));
    setError(null);
  }, [initial]);

  function update<K extends keyof FormState>(key: K, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!values.nombre.trim()) {
      setError('El nombre es obligatorio.');
      return;
    }
    setError(null);
    await onSubmit(toInsert(values));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <TextInput
        name="nombre"
        label="Nombre *"
        value={values.nombre}
        onChange={(e) => update('nombre', e.target.value)}
        required
        autoFocus
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextInput
          name="nit"
          label="NIT"
          value={values.nit}
          onChange={(e) => update('nit', e.target.value)}
        />
        <TextInput
          name="telefono"
          label="Teléfono"
          value={values.telefono}
          onChange={(e) => update('telefono', e.target.value)}
        />
      </div>
      <TextInput
        name="direccion"
        label="Dirección"
        value={values.direccion}
        onChange={(e) => update('direccion', e.target.value)}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextInput
          name="contacto"
          label="Contacto"
          value={values.contacto}
          onChange={(e) => update('contacto', e.target.value)}
        />
        <TextInput
          name="email"
          label="Email"
          type="email"
          value={values.email}
          onChange={(e) => update('email', e.target.value)}
        />
      </div>
      <TextArea
        name="notas"
        label="Notas"
        value={values.notas}
        onChange={(e) => update('notas', e.target.value)}
      />

      {error && (
        <p className="rounded-md border border-rust/30 bg-rust-l px-3 py-2 text-sm text-rust">
          {error}
        </p>
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

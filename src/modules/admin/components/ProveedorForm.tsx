import { useEffect, useState, type FormEvent } from 'react';
import { TextInput } from '@/components/ui/TextInput';
import type { Proveedor, ProveedorInsert } from '../api';
import type { CatalogFormProps } from './CatalogPage';

type FormState = {
  nombre: string;
  razon: string;
  nit: string;
  giro: string;
  tel: string;
  email: string;
  contacto: string;
  celcontacto: string;
  direccion: string;
};

const empty: FormState = {
  nombre: '',
  razon: '',
  nit: '',
  giro: '',
  tel: '',
  email: '',
  contacto: '',
  celcontacto: '',
  direccion: '',
};

function fromRow(r: Proveedor | null | undefined): FormState {
  if (!r) return empty;
  return {
    nombre: r.nombre ?? '',
    razon: r.razon ?? '',
    nit: r.nit ?? '',
    giro: r.giro ?? '',
    tel: r.tel ?? '',
    email: r.email ?? '',
    contacto: r.contacto ?? '',
    celcontacto: r.celcontacto ?? '',
    direccion: r.direccion ?? '',
  };
}

function toInput(s: FormState): ProveedorInsert {
  const trim = (v: string) => v.trim() || null;
  return {
    nombre: s.nombre.trim(),
    razon: trim(s.razon),
    nit: trim(s.nit),
    giro: trim(s.giro),
    tel: trim(s.tel),
    email: trim(s.email),
    contacto: trim(s.contacto),
    celcontacto: trim(s.celcontacto),
    direccion: trim(s.direccion),
  };
}

export function ProveedorForm({
  initial,
  submitting,
  onSubmit,
  onCancel,
}: CatalogFormProps<Proveedor, ProveedorInsert>) {
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextInput
          name="nombre"
          label="Nombre *"
          value={values.nombre}
          onChange={(e) => upd('nombre', e.target.value)}
          required
          autoFocus
        />
        <TextInput
          name="razon"
          label="Razón social"
          value={values.razon}
          onChange={(e) => upd('razon', e.target.value)}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextInput name="nit" label="NIT" value={values.nit} onChange={(e) => upd('nit', e.target.value)} />
        <TextInput name="giro" label="Giro" value={values.giro} onChange={(e) => upd('giro', e.target.value)} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextInput name="tel" label="Teléfono" value={values.tel} onChange={(e) => upd('tel', e.target.value)} />
        <TextInput
          name="email"
          label="Email"
          type="email"
          value={values.email}
          onChange={(e) => upd('email', e.target.value)}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextInput
          name="contacto"
          label="Contacto"
          value={values.contacto}
          onChange={(e) => upd('contacto', e.target.value)}
        />
        <TextInput
          name="celcontacto"
          label="Cel. contacto"
          value={values.celcontacto}
          onChange={(e) => upd('celcontacto', e.target.value)}
        />
      </div>
      <TextInput
        name="direccion"
        label="Dirección"
        value={values.direccion}
        onChange={(e) => upd('direccion', e.target.value)}
      />

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

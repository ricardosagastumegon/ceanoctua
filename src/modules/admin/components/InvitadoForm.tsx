import { useEffect, useState, type FormEvent } from 'react';
import { TextInput } from '@/components/ui/TextInput';
import { TextArea } from '@/components/ui/TextArea';
import type { Invitado, InvitadoInsert } from '../api';
import type { CatalogFormProps } from './CatalogPage';

type FormState = {
  nombre: string;
  relacion: string;
  empresa: string;
  telefono: string;
  email: string;
  notas: string;
  activo: boolean;
};

const empty: FormState = {
  nombre: '',
  relacion: '',
  empresa: '',
  telefono: '',
  email: '',
  notas: '',
  activo: true,
};

function fromRow(r: Invitado | null | undefined): FormState {
  if (!r) return empty;
  return {
    nombre: r.nombre ?? '',
    relacion: r.relacion ?? '',
    empresa: r.empresa ?? '',
    telefono: r.telefono ?? '',
    email: r.email ?? '',
    notas: r.notas ?? '',
    activo: r.activo ?? true,
  };
}

function toInput(s: FormState): InvitadoInsert {
  return {
    nombre: s.nombre.trim(),
    relacion: s.relacion.trim() || null,
    empresa: s.empresa.trim() || null,
    telefono: s.telefono.trim() || null,
    email: s.email.trim() || null,
    notas: s.notas.trim() || null,
    activo: s.activo,
  };
}

/**
 * Lo único obligatorio es el nombre.
 *
 * Un invitado se da de alta a media captura de un viaje, cuando alguien
 * aparece en la lista de pasajeros y no está en ningún catálogo. Pedir
 * teléfono y empresa en ese momento hace que nadie lo use y volvamos al texto
 * libre, que es justo lo que estamos quitando.
 */
export function InvitadoForm({
  initial,
  submitting,
  onSubmit,
  onCancel,
}: CatalogFormProps<Invitado, InvitadoInsert>) {
  const [values, setValues] = useState<FormState>(fromRow(initial));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValues(fromRow(initial));
    setError(null);
  }, [initial]);

  function upd<K extends keyof FormState>(k: K, v: FormState[K]) {
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
        <TextInput
          name="relacion"
          label="Relación"
          value={values.relacion}
          onChange={(e) => upd('relacion', e.target.value)}
          placeholder="Familia, Socio, Piloto…"
        />
        <TextInput
          name="empresa"
          label="Empresa"
          value={values.empresa}
          onChange={(e) => upd('empresa', e.target.value)}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextInput
          name="telefono"
          label="Teléfono"
          value={values.telefono}
          onChange={(e) => upd('telefono', e.target.value)}
        />
        <TextInput
          name="email"
          label="Correo"
          type="email"
          value={values.email}
          onChange={(e) => upd('email', e.target.value)}
        />
      </div>
      <TextArea
        name="notas"
        label="Notas"
        rows={2}
        value={values.notas}
        onChange={(e) => upd('notas', e.target.value)}
      />

      <label className="flex items-center gap-2 text-sm text-dark-2">
        <input
          type="checkbox"
          checked={values.activo}
          onChange={(e) => upd('activo', e.target.checked)}
          className="h-4 w-4 rounded border-sand text-teal focus:ring-teal"
        />
        Activo — aparece en la lista al armar un viaje. Desmarcarlo lo retira sin
        borrar los viajes donde ya va.
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

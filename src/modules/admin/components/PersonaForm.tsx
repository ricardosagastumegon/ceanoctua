import { useEffect, useState, type FormEvent } from 'react';
import { TextInput } from '@/components/ui/TextInput';
import { TextArea } from '@/components/ui/TextArea';
import type { Persona, PersonaInsert } from '../api';
import type { CatalogFormProps } from './CatalogPage';

type FormState = {
  nombre: string;
  iniciales: string;
  nit: string;
  dir: string;
  es_jd: boolean;
  es_autorizador: boolean;
  es_firmante: boolean;
  notas: string;
};

const empty: FormState = {
  nombre: '',
  iniciales: '',
  nit: '',
  dir: '',
  es_jd: false,
  es_autorizador: true,
  es_firmante: false,
  notas: '',
};

function fromRow(r: Persona | null | undefined): FormState {
  if (!r) return empty;
  return {
    nombre: r.nombre ?? '',
    iniciales: r.iniciales ?? '',
    nit: r.nit ?? '',
    dir: r.dir ?? '',
    es_jd: r.es_jd,
    es_autorizador: r.es_autorizador,
    es_firmante: r.es_firmante,
    notas: r.notas ?? '',
  };
}

function toInput(s: FormState): PersonaInsert {
  return {
    nombre: s.nombre.trim(),
    iniciales: s.iniciales.trim().toUpperCase() || null,
    nit: s.nit.trim() || null,
    dir: s.dir.trim() || null,
    es_jd: s.es_jd,
    es_autorizador: s.es_autorizador,
    es_firmante: s.es_firmante,
    notas: s.notas.trim() || null,
  };
}

export function PersonaForm({
  initial,
  submitting,
  onSubmit,
  onCancel,
}: CatalogFormProps<Persona, PersonaInsert>) {
  const [v, setV] = useState<FormState>(fromRow(initial));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setV(fromRow(initial));
    setError(null);
  }, [initial]);

  function upd<K extends keyof FormState>(k: K, val: FormState[K]) {
    setV((p) => ({ ...p, [k]: val }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!v.nombre.trim()) {
      setError('El nombre es obligatorio.');
      return;
    }
    if (!v.es_jd && !v.es_autorizador && !v.es_firmante) {
      setError('Selecciona al menos un rol (JD, autorizador o firmante).');
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
          label="Nombre completo *"
          value={v.nombre}
          onChange={(e) => upd('nombre', e.target.value)}
          required
          autoFocus
        />
        <TextInput
          name="iniciales"
          label="Iniciales / Código"
          value={v.iniciales}
          onChange={(e) => upd('iniciales', e.target.value)}
          hint="MAA, JA, LA… solo si es miembro JD"
          maxLength={6}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextInput name="nit" label="NIT" value={v.nit} onChange={(e) => upd('nit', e.target.value)} />
        <TextInput name="dir" label="Dirección" value={v.dir} onChange={(e) => upd('dir', e.target.value)} />
      </div>

      <fieldset className="rounded-md border border-sand bg-sand-l/30 p-3">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-dark-2">
          Roles
        </legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <label className="flex items-center gap-2 text-sm text-dark">
            <input
              type="checkbox"
              checked={v.es_jd}
              onChange={(e) => upd('es_jd', e.target.checked)}
              className="h-4 w-4 rounded border-sand text-teal focus:ring-teal"
            />
            <span>Miembro Junta Directiva</span>
          </label>
          <label className="flex items-center gap-2 text-sm text-dark">
            <input
              type="checkbox"
              checked={v.es_autorizador}
              onChange={(e) => upd('es_autorizador', e.target.checked)}
              className="h-4 w-4 rounded border-sand text-teal focus:ring-teal"
            />
            <span>Autorizador (consumos / pagos)</span>
          </label>
          <label className="flex items-center gap-2 text-sm text-dark">
            <input
              type="checkbox"
              checked={v.es_firmante}
              onChange={(e) => upd('es_firmante', e.target.checked)}
              className="h-4 w-4 rounded border-sand text-teal focus:ring-teal"
            />
            <span>Firmante (CEA · Firmas)</span>
          </label>
        </div>
      </fieldset>

      <TextArea name="notas" label="Notas" value={v.notas} onChange={(e) => upd('notas', e.target.value)} />

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

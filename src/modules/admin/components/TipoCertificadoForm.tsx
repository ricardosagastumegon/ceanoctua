import { useEffect, useState, type FormEvent } from 'react';
import { TextInput } from '@/components/ui/TextInput';
import type { TipoCertificado, TipoCertificadoInsert } from '../api';
import type { CatalogFormProps } from './CatalogPage';

type FormState = { nombre: string; orden: string; activo: boolean; notas: string };

const empty: FormState = { nombre: '', orden: '99', activo: true, notas: '' };

function fromRow(r: TipoCertificado | null | undefined): FormState {
  if (!r) return empty;
  return {
    nombre: r.nombre,
    orden: String(r.orden),
    activo: r.activo,
    notas: r.notas ?? '',
  };
}

function toInput(s: FormState): TipoCertificadoInsert {
  return {
    nombre: s.nombre.trim(),
    orden: Number(s.orden) || 99,
    activo: s.activo,
    notas: s.notas.trim() || null,
  };
}

/**
 * Un certificado del catálogo aéreo.
 *
 * Solo el nombre, porque de eso se trata: que al cargar el escaneo de una
 * aeronave se escoja de una lista y no se escriba a mano.
 */
export function TipoCertificadoForm({
  initial,
  submitting,
  onSubmit,
  onCancel,
}: CatalogFormProps<TipoCertificado, TipoCertificadoInsert>) {
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
          hint="ej. Certificado de Aeronavegabilidad"
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
          hint="posición en la lista"
        />
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-dark-2">Notas</span>
        <textarea
          value={v.notas}
          onChange={(e) => setV((p) => ({ ...p, notas: e.target.value }))}
          rows={2}
          className="block w-full rounded-md border border-sand bg-white px-3 py-2 text-sm text-dark focus:border-teal focus:outline-none"
        />
      </label>

      <label className="flex items-center gap-2 text-sm text-dark">
        <input
          type="checkbox"
          checked={v.activo}
          onChange={(e) => setV((p) => ({ ...p, activo: e.target.checked }))}
          className="h-4 w-4 rounded border-sand text-teal focus:ring-teal"
        />
        <span>Activo (aparece al agregar un documento)</span>
      </label>

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

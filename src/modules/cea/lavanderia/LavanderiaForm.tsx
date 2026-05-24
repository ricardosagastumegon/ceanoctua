import { useEffect, useState, type FormEvent } from 'react';
import { TextInput } from '@/components/ui/TextInput';
import { TextArea } from '@/components/ui/TextArea';
import type { CatalogFormProps } from '@/modules/admin/components/CatalogPage';
import type { Lavanderia, LavanderiaInsert } from './api';

type FormState = { asunto: string; solicitado: string; descripcion: string };
const empty: FormState = { asunto: '', solicitado: '', descripcion: '' };

function fromRow(r: Lavanderia | null | undefined): FormState {
  if (!r) return empty;
  return { asunto: r.asunto ?? '', solicitado: r.solicitado ?? '', descripcion: r.descripcion ?? '' };
}
function toInput(s: FormState): LavanderiaInsert {
  return {
    asunto: s.asunto.trim() || null,
    solicitado: s.solicitado.trim() || null,
    descripcion: s.descripcion.trim() || null,
  };
}

export function LavanderiaForm({ initial, submitting, onSubmit, onCancel }: CatalogFormProps<Lavanderia, LavanderiaInsert>) {
  const [v, setV] = useState<FormState>(fromRow(initial));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setV(fromRow(initial));
    setError(null);
  }, [initial]);

  function upd<K extends keyof FormState>(k: K, val: string) {
    setV((p) => ({ ...p, [k]: val }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!v.asunto.trim()) {
      setError('El asunto es obligatorio.');
      return;
    }
    setError(null);
    await onSubmit(toInput(v));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <TextInput name="asunto" label="Asunto *" value={v.asunto} onChange={(e) => upd('asunto', e.target.value)} required autoFocus />
      <TextInput name="solicitado" label="Solicitado por" value={v.solicitado} onChange={(e) => upd('solicitado', e.target.value)} />
      <TextArea name="descripcion" label="Descripción" value={v.descripcion} onChange={(e) => upd('descripcion', e.target.value)} />

      {error && <p className="rounded-md border border-rust/30 bg-rust-l px-3 py-2 text-sm text-rust">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="rounded-md border border-sand px-4 py-2 text-sm font-semibold text-dark-2 hover:bg-sand-l">Cancelar</button>
        <button type="submit" disabled={submitting} className="rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-d disabled:opacity-60">
          {submitting ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  );
}

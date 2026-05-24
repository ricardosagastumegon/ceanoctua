import { useEffect, useState, type FormEvent } from 'react';
import { TextInput } from '@/components/ui/TextInput';
import { TextArea } from '@/components/ui/TextArea';
import type { Nota, NotaInsert } from './api';

type Props = {
  initial?: Nota | null;
  submitting?: boolean;
  onSubmit: (values: NotaInsert) => void | Promise<void>;
  onCancel: () => void;
};

export function NotaForm({ initial, submitting, onSubmit, onCancel }: Props) {
  const [titulo, setTitulo] = useState(initial?.titulo ?? '');
  const [contenido, setContenido] = useState(initial?.contenido ?? '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTitulo(initial?.titulo ?? '');
    setContenido(initial?.contenido ?? '');
    setError(null);
  }, [initial]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!contenido.trim()) {
      setError('La nota no puede estar vacía.');
      return;
    }
    setError(null);
    await onSubmit({
      titulo: titulo.trim() || null,
      contenido: contenido.trim(),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <TextInput name="titulo" label="Título (opcional)" value={titulo} onChange={(e) => setTitulo(e.target.value)} autoFocus />
      <TextArea name="contenido" label="Contenido *" value={contenido} onChange={(e) => setContenido(e.target.value)} rows={6} required />

      {error && (
        <p className="rounded-md border border-rust/30 bg-rust-l px-3 py-2 text-sm text-rust">{error}</p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="rounded-md border border-sand px-4 py-2 text-sm font-semibold text-dark-2 hover:bg-sand-l">
          Cancelar
        </button>
        <button type="submit" disabled={submitting} className="rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-d disabled:opacity-60">
          {submitting ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  );
}

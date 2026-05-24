import { useEffect, useState, type FormEvent } from 'react';
import { TextInput } from '@/components/ui/TextInput';
import type { TipoPago, TipoPagoInsert } from '../api';
import type { CatalogFormProps } from './CatalogPage';

export function TipoPagoForm({
  initial,
  submitting,
  onSubmit,
  onCancel,
}: CatalogFormProps<TipoPago, TipoPagoInsert>) {
  const [tipo, setTipo] = useState(initial?.tipo ?? '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTipo(initial?.tipo ?? '');
    setError(null);
  }, [initial]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!tipo.trim()) {
      setError('El tipo es obligatorio.');
      return;
    }
    setError(null);
    await onSubmit({ tipo: tipo.trim() });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <TextInput
        name="tipo"
        label="Tipo *"
        value={tipo}
        onChange={(e) => setTipo(e.target.value)}
        required
        autoFocus
        hint="Ej.: Transferencia, Cheque, Efectivo…"
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

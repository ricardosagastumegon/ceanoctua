import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { TextInput } from '@/components/ui/TextInput';
import { useToast } from '@/components/ui/Toast';
import { describeError } from '@/modules/admin/hooks';
import { formatMoney } from '@/lib/money';
import type { Database } from '@/types/database';

// F-4: editor de renglones (líneas) del consumo TC.
// El monto del consumo se recalcula automáticamente vía trigger SQL
// `recalc_consumo_total` cuando hay al menos 1 renglón.

type Row = Database['public']['Tables']['consumo_renglones']['Row'];

function fmt(n: number, currency: string): string {
  if (currency === 'GTQ') return formatMoney(n);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
}

type Props = { consumoId: string; moneda: string; canEdit: boolean };

export function ConsumoRenglonesPanel({ consumoId, moneda, canEdit }: Props) {
  const qc = useQueryClient();
  const toast = useToast();
  const queryKey = ['consumo_renglones', consumoId] as const;

  const query = useQuery<Row[], Error>({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consumo_renglones')
        .select('*')
        .eq('consumo_id', consumoId)
        .order('orden');
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!consumoId,
  });

  const create = useMutation({
    mutationFn: async (input: { descripcion: string; cantidad: number; precio_unit: number }) => {
      const nextOrden = (query.data?.length ?? 0) + 1;
      const { error } = await supabase.from('consumo_renglones').insert({
        consumo_id: consumoId,
        orden: nextOrden,
        ...input,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey });
      void qc.invalidateQueries({ queryKey: ['tc_consumos'] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('consumo_renglones').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey });
      void qc.invalidateQueries({ queryKey: ['tc_consumos'] });
    },
  });

  const [descripcion, setDescripcion] = useState('');
  const [cantidad, setCantidad] = useState('1');
  const [precio, setPrecio] = useState('');

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!descripcion.trim()) {
      toast.error('Descripción obligatoria.');
      return;
    }
    const cant = Number(cantidad);
    const p = Number(precio);
    try {
      await create.mutateAsync({
        descripcion: descripcion.trim(),
        cantidad: Number.isFinite(cant) ? cant : 1,
        precio_unit: Number.isFinite(p) ? p : 0,
      });
      setDescripcion('');
      setCantidad('1');
      setPrecio('');
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  const items = query.data ?? [];
  const total = items.reduce((s, r) => s + Number(r.subtotal ?? 0), 0);

  return (
    <fieldset className="rounded-md border border-sand bg-sand-l/30 p-3">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-dark-2">
        Renglones del consumo ({items.length})
      </legend>
      {canEdit && (
        <form onSubmit={add} className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-[3fr_1fr_1fr_auto]">
          <TextInput
            name="cr_desc"
            label="Descripción"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
          />
          <TextInput
            name="cr_cant"
            label="Cantidad"
            type="number"
            min="0"
            step="0.01"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
          />
          <TextInput
            name="cr_precio"
            label="Precio unit"
            type="number"
            min="0"
            step="0.01"
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
          />
          <button
            type="submit"
            disabled={create.isPending}
            className="self-end rounded-md bg-teal px-3 py-2 text-xs font-semibold text-white hover:bg-teal-d disabled:opacity-60"
          >
            ＋
          </button>
        </form>
      )}

      {query.isLoading ? (
        <p className="text-xs text-dark-3">Cargando…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-dark-3">
          Sin renglones. Mientras estén vacíos, el monto manual del consumo prevalece. Al agregar al menos uno, el trigger SQL recalcula el total automáticamente.
        </p>
      ) : (
        <ul className="divide-y divide-sand">
          {items.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <div className="flex-1">
                <span className="mr-2 font-mono text-xs text-dark-3">#{r.orden}</span>
                <span className="font-medium text-dark">{r.descripcion}</span>
                <span className="ml-2 text-xs text-dark-3">
                  {Number(r.cantidad)} × {fmt(Number(r.precio_unit), moneda)}
                </span>
              </div>
              <span className="font-mono text-dark">{fmt(Number(r.subtotal ?? 0), moneda)}</span>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => void remove.mutateAsync(r.id)}
                  className="rounded-md border border-rust/40 px-2 py-0.5 text-xs text-rust hover:bg-rust-l"
                >
                  ×
                </button>
              )}
            </li>
          ))}
          <li className="flex items-center justify-between border-t-2 border-dark/20 py-2 pt-3 text-sm font-semibold">
            <span className="text-dark-2">Total renglones</span>
            <span className="font-mono text-teal-d">{fmt(total, moneda)}</span>
          </li>
        </ul>
      )}
    </fieldset>
  );
}

import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { TextInput } from '@/components/ui/TextInput';
import { useToast } from '@/components/ui/Toast';
import { describeError } from '@/modules/admin/hooks';
import { formatMoney } from '@/lib/money';
import type { Database } from '@/types/database';

type Service = Database['public']['Tables']['att_restaurant_services']['Row'];

function fmt(n: number, currency: string): string {
  if (currency === 'GTQ') return formatMoney(n);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
}

export function RestaurantServicesPanel({
  restauranteId,
  moneda = 'GTQ',
  canEdit,
}: {
  restauranteId: string;
  moneda?: string;
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const queryKey = ['att_restaurant_services', restauranteId] as const;

  const query = useQuery<Service[], Error>({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('att_restaurant_services')
        .select('*')
        .eq('restaurante_id', restauranteId)
        .order('orden', { ascending: true, nullsFirst: false })
        .order('created_at');
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!restauranteId,
  });

  const create = useMutation({
    mutationFn: async (input: { nombre: string; monto: number }) => {
      const { error } = await supabase.from('att_restaurant_services').insert({
        restaurante_id: restauranteId,
        ...input,
      });
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey }),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('att_restaurant_services').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey }),
  });

  const [nombre, setNombre] = useState('');
  const [monto, setMonto] = useState('');

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) {
      toast.error('Nombre del servicio obligatorio.');
      return;
    }
    const m = Number(monto);
    try {
      await create.mutateAsync({ nombre: nombre.trim(), monto: Number.isFinite(m) ? m : 0 });
      setNombre('');
      setMonto('');
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  const items = query.data ?? [];
  const total = items.reduce((s, x) => s + Number(x.monto ?? 0), 0);

  return (
    <fieldset className="rounded-md border border-sand bg-sand-l/30 p-3">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-dark-2">
        Servicios extra (vinos, propina, etc.)
      </legend>
      {canEdit && (
        <form onSubmit={add} className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-[2fr_1fr_auto]">
          <TextInput name="rs_nombre" label="Servicio" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Vinos, propina, descorche…" />
          <TextInput name="rs_monto" label="Monto" type="number" min="0" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} />
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
        <p className="text-xs text-dark-3">Sin servicios extra.</p>
      ) : (
        <ul className="divide-y divide-sand">
          {items.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <span className="flex-1 font-medium text-dark">{s.nombre}</span>
              <span className="font-mono text-dark">{fmt(Number(s.monto ?? 0), moneda)}</span>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => void remove.mutateAsync(s.id)}
                  className="rounded-md border border-rust/40 px-2 py-0.5 text-xs text-rust hover:bg-rust-l"
                >
                  ×
                </button>
              )}
            </li>
          ))}
          {total > 0 && (
            <li className="flex items-center justify-between border-t-2 border-dark/20 py-2 pt-3 text-sm font-semibold">
              <span className="text-dark-2">Total servicios</span>
              <span className="font-mono text-teal-d">{fmt(total, moneda)}</span>
            </li>
          )}
        </ul>
      )}
    </fieldset>
  );
}

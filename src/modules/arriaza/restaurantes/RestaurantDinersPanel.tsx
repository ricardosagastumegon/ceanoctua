import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { TextInput } from '@/components/ui/TextInput';
import { useToast } from '@/components/ui/Toast';
import { describeError } from '@/modules/admin/hooks';
import type { Database } from '@/types/database';

type Diner = Database['public']['Tables']['att_restaurant_diners']['Row'];

export function RestaurantDinersPanel({ restauranteId, canEdit }: { restauranteId: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const queryKey = ['att_restaurant_diners', restauranteId] as const;

  const query = useQuery<Diner[], Error>({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('att_restaurant_diners')
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
    mutationFn: async (input: { nombre: string; notas: string | null }) => {
      const { error } = await supabase.from('att_restaurant_diners').insert({
        restaurante_id: restauranteId,
        ...input,
      });
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey }),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('att_restaurant_diners').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey }),
  });

  const [nombre, setNombre] = useState('');
  const [notas, setNotas] = useState('');

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) {
      toast.error('El nombre del comensal es obligatorio.');
      return;
    }
    try {
      await create.mutateAsync({ nombre: nombre.trim(), notas: notas.trim() || null });
      setNombre('');
      setNotas('');
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  const items = query.data ?? [];

  return (
    <fieldset className="rounded-md border border-sand bg-sand-l/30 p-3">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-dark-2">
        Comensales ({items.length})
      </legend>
      {canEdit && (
        <form onSubmit={add} className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-[2fr_2fr_auto]">
          <TextInput name="dn_nombre" label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <TextInput name="dn_notas" label="Notas" value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Alergias, restricciones…" />
          <button
            type="submit"
            disabled={create.isPending}
            className="self-end rounded-md bg-teal px-3 py-2 text-xs font-semibold text-white hover:bg-teal-d disabled:opacity-60"
          >
            ＋ Agregar
          </button>
        </form>
      )}
      {query.isLoading ? (
        <p className="text-xs text-dark-3">Cargando…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-dark-3">Sin comensales registrados.</p>
      ) : (
        <ul className="divide-y divide-sand">
          {items.map((d, idx) => (
            <li key={d.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <div className="flex-1">
                <span className="mr-2 font-mono text-xs text-dark-3">#{idx + 1}</span>
                <span className="font-medium text-dark">{d.nombre}</span>
                {d.notas && <span className="ml-2 text-xs text-dark-3">· {d.notas}</span>}
              </div>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => void remove.mutateAsync(d.id)}
                  className="rounded-md border border-rust/40 px-2 py-0.5 text-xs text-rust hover:bg-rust-l"
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}

import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { TextInput } from '@/components/ui/TextInput';
import { useToast } from '@/components/ui/Toast';
import { describeError } from '@/modules/admin/hooks';
import { formatMoney } from '@/lib/money';

type PayRow = {
  id: string;
  tc_id: string | null;
  titular: string | null;
  autorizado_por: string | null;
  monto: number | null;
};

type PayInput = {
  tc_id: string | null;
  titular: string | null;
  autorizado_por: string | null;
  monto: number | null;
};

function fmt(n: number, currency: string): string {
  if (currency === 'GTQ') return formatMoney(n);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
}

/**
 * Reusable payment-records editor for the 3 Arriaza child tables:
 *   att_ticket_pay_records  (parentColumn = 'ticket_id')
 *   att_hotel_pay_records   (parentColumn = 'hotel_id')
 *   att_restaurant_pay_records (parentColumn = 'restaurante_id')
 */
type Props = {
  tableName: 'att_ticket_pay_records' | 'att_hotel_pay_records' | 'att_restaurant_pay_records';
  parentColumn: 'ticket_id' | 'hotel_id' | 'restaurante_id';
  parentId: string;
  moneda?: string;
  canEdit: boolean;
};

export function PayRecordsPanel({ tableName, parentColumn, parentId, moneda = 'GTQ', canEdit }: Props) {
  const qc = useQueryClient();
  const toast = useToast();
  const queryKey = [tableName, parentId] as const;

  // Supabase types are per-table; with a dynamic tableName union we step out
  // of the type-checked builder via `from(string as never)`. Acceptable: the
  // 3 target tables share the exact same column shape captured in PayRow.
  // Nota: se añadió `.is('deleted_at', null)` en select y el remove pasó a
  // soft-delete (UPDATE deleted_at) por Regla 0 · invariante 6 · CLAUDE.md §4.
  const client = supabase as unknown as {
    from: (n: string) => {
      select: (s: string) => { eq: (c: string, v: unknown) => { is: (c: string, v: unknown) => { order: (c: string) => Promise<{ data: PayRow[] | null; error: Error | null }> } } };
      insert: (v: unknown) => Promise<{ error: Error | null }>;
      update: (v: unknown) => { eq: (c: string, v: unknown) => Promise<{ error: Error | null }> };
    };
  };

  const query = useQuery<PayRow[], Error>({
    queryKey,
    queryFn: async () => {
      const { data, error } = await client
        .from(tableName)
        .select('id, tc_id, titular, autorizado_por, monto')
        .eq(parentColumn, parentId)
        .is('deleted_at', null)
        .order('created_at');
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!parentId,
  });

  const create = useMutation({
    mutationFn: async (input: PayInput) => {
      const payload = { ...input, [parentColumn]: parentId };
      const { error } = await client.from(tableName).insert(payload);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      // Soft delete · invariante 6 · CLAUDE.md §4.
      const { error } = await client
        .from(tableName)
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey }),
  });

  const [tcId, setTcId] = useState('');
  const [titular, setTitular] = useState('');
  const [autorizado, setAutorizado] = useState('');
  const [monto, setMonto] = useState('');

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!tcId.trim() && !titular.trim()) {
      toast.error('Captura al menos TC ID o titular.');
      return;
    }
    const m = Number(monto);
    try {
      await create.mutateAsync({
        tc_id: tcId.trim() || null,
        titular: titular.trim() || null,
        autorizado_por: autorizado.trim() || null,
        monto: Number.isFinite(m) && m > 0 ? m : null,
      });
      setTcId('');
      setTitular('');
      setAutorizado('');
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
        Forma de pago · registros
      </legend>
      {canEdit && (
        <form onSubmit={add} className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1.5fr_1.5fr_1fr_auto]">
          <TextInput name="pr_tc" label="TC ID" value={tcId} onChange={(e) => setTcId(e.target.value)} placeholder="**** 1234" />
          <TextInput name="pr_tit" label="Titular" value={titular} onChange={(e) => setTitular(e.target.value)} />
          <TextInput name="pr_auth" label="Autorizado por" value={autorizado} onChange={(e) => setAutorizado(e.target.value)} />
          <TextInput name="pr_monto" label="Monto" type="number" min="0" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} />
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
        <p className="text-xs text-dark-3">Sin registros de pago.</p>
      ) : (
        <ul className="divide-y divide-sand">
          {items.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <div className="flex-1">
                {p.tc_id && <span className="font-mono text-xs text-teal-d">{p.tc_id}</span>}
                {p.titular && <span className="ml-2 font-medium text-dark">{p.titular}</span>}
                {p.autorizado_por && <span className="ml-2 text-xs text-dark-3">· auth: {p.autorizado_por}</span>}
              </div>
              {p.monto != null && (
                <span className="font-mono text-dark">{fmt(Number(p.monto), moneda)}</span>
              )}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => void remove.mutateAsync(p.id)}
                  className="rounded-md border border-rust/40 px-2 py-0.5 text-xs text-rust hover:bg-rust-l"
                >
                  ×
                </button>
              )}
            </li>
          ))}
          {total > 0 && (
            <li className="flex items-center justify-between border-t-2 border-dark/20 py-2 pt-3 text-sm font-semibold">
              <span className="text-dark-2">Total ({items.length})</span>
              <span className="font-mono text-teal-d">{fmt(total, moneda)}</span>
            </li>
          )}
        </ul>
      )}
    </fieldset>
  );
}

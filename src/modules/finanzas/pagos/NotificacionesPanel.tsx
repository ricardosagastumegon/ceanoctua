import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { describeError } from '@/modules/admin/hooks';
import { formatDateTime } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import type { Database } from '@/types/database';

type Notif = Database['public']['Tables']['pagos_notificaciones']['Row'];

function fmt(n: number, currency: string | null): string {
  if (currency === 'GTQ' || !currency) return formatMoney(n);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
}

type Props = {
  /** Callback que abre el form de nueva SP con los datos del origen. */
  onCreateFromNotif: (notif: Notif) => void;
};

export function NotificacionesPanel({ onCreateFromNotif }: Props) {
  const qc = useQueryClient();
  const toast = useToast();

  const query = useQuery<Notif[], Error>({
    queryKey: ['pagos_notificaciones'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pagos_notificaciones')
        .select('*')
        .eq('procesado', false)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const dismiss = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('pagos_notificaciones')
        .update({ procesado: true, procesado_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['pagos_notificaciones'] }),
  });

  async function handleDismiss(id: string) {
    try {
      await dismiss.mutateAsync(id);
    } catch (e) {
      toast.error(describeError(e));
    }
  }

  const items = query.data ?? [];

  return (
    <aside className="rounded-card border border-purple/30 bg-purple/5 p-4">
      <header className="mb-3 flex items-center justify-between">
        <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-purple">
          📥 Notificaciones de Pagos
        </h3>
        <span className="rounded-full bg-purple/15 px-2 py-0.5 text-[10px] font-semibold text-purple">
          {items.length} pendiente{items.length === 1 ? '' : 's'}
        </span>
      </header>

      {query.isLoading ? (
        <p className="text-xs text-dark-3">Cargando…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-dark-3">Sin notificaciones pendientes. Las liquidaciones marcadas como "Solicitud de Pago" y los consumos enviados desde Consumos TC aparecerán aquí.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li
              key={n.id}
              className="rounded-md border border-purple/30 bg-white p-2 text-sm shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase ${
                      n.origen_tipo === 'liquidacion'
                        ? 'bg-teal-l text-teal-d'
                        : 'bg-blue-light text-blue'
                    }`}
                  >
                    {n.origen_tipo === 'liquidacion' ? 'Liquidación' : 'Consumo TC'}
                  </span>
                  <p className="mt-1 line-clamp-2 font-medium text-dark">
                    {n.resumen ?? '(sin resumen)'}
                  </p>
                  {n.monto != null && (
                    <p className="mt-0.5 font-mono text-xs font-semibold text-dark-2">
                      {fmt(Number(n.monto), n.moneda)}
                    </p>
                  )}
                  <p className="mt-0.5 text-[10px] text-dark-3">{formatDateTime(n.created_at)}</p>
                </div>
              </div>
              <div className="mt-2 flex gap-1">
                <button
                  type="button"
                  onClick={() => onCreateFromNotif(n)}
                  className="flex-1 rounded-md bg-teal px-2 py-1 text-[10px] font-semibold text-white hover:bg-teal-d"
                >
                  ＋ Nueva solicitud
                </button>
                <button
                  type="button"
                  onClick={() => void handleDismiss(n.id)}
                  className="rounded-md border border-sand px-2 py-1 text-[10px] font-semibold text-dark-3 hover:bg-sand-l"
                  title="Marcar como procesada"
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

// Helper que insertan F-2/F-4 al despachar al panel.
export async function pushPagoNotificacion(input: {
  origen_tipo: 'liquidacion' | 'consumo_tc';
  origen_id: string;
  monto: number | null;
  moneda: string | null;
  resumen: string;
}): Promise<void> {
  const { error } = await supabase.from('pagos_notificaciones').insert({
    origen_tipo: input.origen_tipo,
    origen_id: input.origen_id,
    monto: input.monto,
    moneda: input.moneda,
    resumen: input.resumen,
  });
  if (error) throw error;
}

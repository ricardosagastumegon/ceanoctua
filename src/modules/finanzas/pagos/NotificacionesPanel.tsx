import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { queryClient } from '@/lib/query-client';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { describeError, useEntidades } from '@/modules/admin/hooks';
import { formatDateTime } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import type { Database } from '@/types/database';

type Notif = Database['public']['Tables']['pagos_notificaciones']['Row'];

/** Key única del panel — que todos invaliden la misma y no se desincronicen. */
export const PAGOS_NOTIF_KEY = ['pagos_notificaciones'] as const;

/**
 * De donde viene cada aviso.
 *
 * Estaba escrito como «liquidacion, y si no, Consumo TC». Con dos origenes
 * colaba; ahora hay cuatro, y una quincena de combustible de vehiculos
 * llegaba etiquetada como consumo de tarjeta. Un mapa no se queda atras al
 * añadir el quinto: lo que falte sale con su propio nombre, no con el del
 * vecino.
 */
const ORIGEN_LABEL: Record<string, string> = {
  liquidacion: 'Liquidación',
  consumo_tc: 'Consumo TC',
  combustible: 'Combustible aeronaves',
  combustible_vehiculos: 'Combustible vehículos',
};

const ORIGEN_TONO: Record<string, string> = {
  liquidacion: 'bg-teal-l text-teal-d',
  consumo_tc: 'bg-blue-light text-blue',
  combustible: 'bg-gold/25 text-dark',
  combustible_vehiculos: 'bg-gold/25 text-dark',
};

function fmt(n: number, currency: string | null): string {
  if (currency === 'GTQ' || !currency) return formatMoney(n);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
}

type Props = {
  /**
   * Abre el form de nueva SP con los datos de los orígenes.
   *
   * Recibe una lista y no una sola: cuatro liquidaciones de la misma entidad
   * se pagan con una sola solicitud, que es como se tramitan de verdad.
   */
  onCreateFromNotifs: (notifs: Notif[]) => void;
};

export function NotificacionesPanel({ onCreateFromNotifs }: Props) {
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const entidadesQ = useEntidades();
  const [sel, setSel] = useState<ReadonlySet<string>>(new Set());

  const query = useQuery<Notif[], Error>({
    queryKey: PAGOS_NOTIF_KEY,
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

  /**
   * Revertir el envio a Pagos. El aviso se marca --no se borra: es una
   * bandeja de trabajo, y el audit_log tiene que poder contar que paso--
   * y con eso desaparece de aqui. El documento de origen no se toca:
   * mandar a Pagos no dispara ningun trigger, asi que quitar el aviso lo
   * deja tal cual estaba antes de enviarse.
   */
  const revertir = useMutation({
    mutationFn: async (id: string) => {
      // Por RPC y no por update: deshacer el envio no es solo sacar el aviso.
      // Dos origenes --la liquidacion del piloto y el control de vales de
      // combustible-- mueven el estado de su documento al enviarlo, y hay que
      // devolverlo. Esa regla vive en la base, donde no se puede saltar.
      const { error } = await supabase.rpc('pago_notificacion_revertir', { p_aviso: id });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: PAGOS_NOTIF_KEY });
      // Para que el boton de PAGOS vuelva a estar disponible alla sin
      // tener que recargar. Por prefijo: alcanza a «en-pagos».
      void qc.invalidateQueries({ queryKey: ['caja_chica_liquidaciones'] });
      void qc.invalidateQueries({ queryKey: ['avn_liquidaciones'] });
      void qc.invalidateQueries({ queryKey: ['comb_reportes'] });
      void qc.invalidateQueries({ queryKey: ['tc_consumos'] });
    },
  });

  async function handleRevertir(n: Notif) {
    const ok = await confirm({
      title: 'Revertir el envio a Pagos',
      message: (
        <>
          <strong>{n.resumen ?? 'Este aviso'}</strong> desaparece de la bandeja y el
          documento vuelve a su pantalla tal como estaba antes de enviarse, listo para
          mandarse otra vez. No se crea ninguna solicitud de pago.
        </>
      ),
      danger: true,
      confirmLabel: 'Revertir',
    });
    if (!ok) return;
    try {
      await revertir.mutateAsync(n.id);
      toast.success('Envio revertido. El documento volvio a quedar disponible.');
    } catch (e) {
      toast.error(describeError(e));
    }
  }

  const items = query.data ?? [];

  const nombreEntidad = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of entidadesQ.data ?? []) m.set(e.id, e.nombre);
    return m;
  }, [entidadesQ.data]);

  /**
   * La primera seleccionada fija la entidad y la moneda; las demás solo
   * pueden acompañarla si coinciden en las dos. Una solicitud de pago es de
   * una entidad, y sumar quetzales con dólares no es sumar.
   */
  const ancla = items.find((n) => sel.has(n.id)) ?? null;
  const seleccionables = (n: Notif) =>
    !!n.entidad_id &&
    (!ancla || (n.entidad_id === ancla.entidad_id && (n.moneda ?? '') === (ancla.moneda ?? '')));

  const elegidas = items.filter((n) => sel.has(n.id));
  const total = elegidas.reduce((a, n) => a + (Number(n.monto) || 0), 0);

  function alternar(id: string) {
    setSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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

      {elegidas.length > 0 && (
        <div className="mb-3 rounded-md border border-teal bg-teal-l/40 p-2">
          <p className="text-[11px] font-semibold text-teal-d">
            {elegidas.length} seleccionada{elegidas.length === 1 ? '' : 's'} ·{' '}
            {ancla?.entidad_id ? nombreEntidad.get(ancla.entidad_id) ?? 'Entidad' : ''}
          </p>
          <p className="font-mono text-sm font-bold text-dark">{fmt(total, ancla?.moneda ?? null)}</p>
          <div className="mt-1.5 flex gap-1">
            <button
              type="button"
              onClick={() => {
                onCreateFromNotifs(elegidas);
                setSel(new Set());
              }}
              className="flex-1 rounded-md bg-teal px-2 py-1 text-[10px] font-semibold text-white hover:bg-teal-d"
            >
              ＋ Una solicitud con {elegidas.length}
            </button>
            <button
              type="button"
              onClick={() => setSel(new Set())}
              className="rounded-md border border-sand bg-white px-2 py-1 text-[10px] font-semibold text-dark-3"
            >
              Limpiar
            </button>
          </div>
        </div>
      )}

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
                {n.entidad_id && (
                  <input
                    type="checkbox"
                    checked={sel.has(n.id)}
                    disabled={!seleccionables(n)}
                    onChange={() => alternar(n.id)}
                    className="mt-1 h-3.5 w-3.5 shrink-0 accent-teal disabled:opacity-30"
                    title={
                      seleccionables(n)
                        ? 'Juntar en una sola solicitud'
                        : 'La paga otra entidad o va en otra moneda'
                    }
                  />
                )}
                <div className="flex-1">
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase ${
                      ORIGEN_TONO[n.origen_tipo] ?? 'bg-blue-light text-blue'
                    }`}
                  >
                    {ORIGEN_LABEL[n.origen_tipo] ?? n.origen_tipo}
                  </span>
                  <p className="mt-1 line-clamp-2 font-medium text-dark">
                    {n.resumen ?? '(sin resumen)'}
                  </p>
                  {n.monto != null && (
                    <p className="mt-0.5 font-mono text-xs font-semibold text-dark-2">
                      {fmt(Number(n.monto), n.moneda)}
                    </p>
                  )}
                  {n.entidad_id && (
                    <p className="mt-0.5 truncate text-[10px] font-semibold text-teal-d">
                      {nombreEntidad.get(n.entidad_id) ?? 'Entidad'}
                    </p>
                  )}
                  <p className="mt-0.5 text-[10px] text-dark-3">{formatDateTime(n.created_at)}</p>
                </div>
              </div>
              <div className="mt-2 flex gap-1">
                <button
                  type="button"
                  onClick={() => onCreateFromNotifs([n])}
                  className="flex-1 rounded-md bg-teal px-2 py-1 text-[10px] font-semibold text-white hover:bg-teal-d"
                >
                  ＋ Nueva solicitud
                </button>
                {/* Revertir vive aqui y en ningun otro lado: deshacer el
                    envio es asunto de quien recibe, no de quien mando. */}
                <button
                  type="button"
                  onClick={() => void handleRevertir(n)}
                  className="rounded-md border border-rust/40 px-2 py-1 text-[10px] font-semibold text-rust hover:bg-rust-l"
                  title="Revertir el envio: el aviso desaparece y el documento vuelve a quedar disponible"
                >
                  ↩ Revertir
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
  origen_tipo: 'liquidacion' | 'consumo_tc' | 'combustible';
  origen_id: string;
  monto: number | null;
  moneda: string | null;
  resumen: string;
  /**
   * La entidad que paga. Viaja con la notificación para que el panel pueda
   * juntar varias en una sola solicitud sin ir a buscarla a otra tabla, y
   * porque una solicitud de pago es un trámite de una entidad.
   */
  entidad_id?: string | null;
}): Promise<void> {
  const { error } = await supabase.from('pagos_notificaciones').insert({
    origen_tipo: input.origen_tipo,
    origen_id: input.origen_id,
    monto: input.monto,
    moneda: input.moneda,
    resumen: input.resumen,
    entidad_id: input.entidad_id ?? null,
  });
  if (error) throw error;
  // La invalidación va AQUÍ y no en cada caller: con `staleTime: 30s` el panel
  // sigue sirviendo su lista cacheada al cambiar de pestaña, y la notificación
  // recién creada no aparece hasta refrescar. Dejarlo a cada caller significa
  // que el próximo que se agregue lo olvide y el bug vuelva.
  await queryClient.invalidateQueries({ queryKey: PAGOS_NOTIF_KEY });
}

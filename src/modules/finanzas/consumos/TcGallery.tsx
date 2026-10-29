import { useMemo, useState } from 'react';
import { useCreateTarjeta, useTarjetas } from '@/modules/admin/hooks';
import { useConsumos } from './hooks';
import { useAuth } from '@/lib/auth';
import { Modal } from '@/components/ui/Modal';
import { PrintableModal } from '@/components/ui/PrintableModal';
import { TarjetaForm } from '@/modules/admin/components/TarjetaForm';
import { useToast } from '@/components/ui/Toast';
import { describeError } from '@/modules/admin/hooks';
import { formatMoney } from '@/lib/money';
import { EstadoCuentaPrintable } from './EstadoCuentaPrintable';
import { hacerResolver } from './resolver';
import type { Database } from '@/types/database';

type Tarjeta = Database['public']['Tables']['tarjetas_credito']['Row'];

// F-4 · Gallery de TC. Una card por cada `tarjetas_credito` del tipo que se
// le pida. El click filtra la lista de consumos por ese tc_id. El botón
// "Estado de cuenta" abre el PDF imprimible.
//
// Acá SÍ se muestran las dadas de baja, marcadas: cuando una tarjeta se
// extravía deja de ofrecerse en T&T, y Finanzas es donde se siguen
// consultando sus consumos hasta que terminen de pagarse.

type Props = {
  tipo: 'corporativa' | 'presidencia';
  /** El id de la tarjeta filtrada, no su texto. */
  filterCard: string;
  onSelectCard: (tarjetaId: string) => void;
};

function fmt(n: number, currency: string): string {
  if (currency === 'GTQ') return formatMoney(n);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
}

function tintFromColor(hex: string | null | undefined): string {
  if (!hex) return '#0d2b2e';
  return hex;
}

export function TcGallery({ tipo, filterCard, onSelectCard }: Props) {
  const tarjetasQ = useTarjetas();
  const consumosQ = useConsumos();
  const createTarjeta = useCreateTarjeta();
  const { profile } = useAuth();
  const toast = useToast();
  const isAdmin = profile?.rol === 'admin';
  const [tcCorpOpen, setTcCorpOpen] = useState(false);
  const [estadoCuentaTarjeta, setEstadoCuentaTarjeta] = useState<Tarjeta | null>(null);

  const esCorp = tipo === 'corporativa';
  const rotulo = esCorp ? 'Tarjetas corporativas' : 'Tarjetas de presidencia';

  // Las activas primero; las dadas de baja al final, que es donde estorban
  // menos sin dejar de estar.
  const corp = (tarjetasQ.data ?? [])
    .filter((t) => t.tipo === tipo)
    .sort((a, b) => Number(b.activo) - Number(a.activo) || a.tc_id.localeCompare(b.tc_id));

  const resolver = useMemo(() => hacerResolver(tarjetasQ.data ?? []), [tarjetasQ.data]);

  // Stats por tarjeta (count + total por moneda).
  //
  // Se agrupa por el id de la tarjeta y no por el texto de `card_id`: ese
  // texto no siempre dice lo mismo que el catálogo, y emparejarlo a ciegas
  // dejaba consumos fuera de la ficha --con dinero real adentro--.
  const statsByCardId = useMemo(() => {
    const m = new Map<string, { count: number; totalsByMoneda: Map<string, number> }>();
    for (const c of consumosQ.data ?? []) {
      const cardId = resolver(c);
      if (!cardId) continue;
      const entry = m.get(cardId) ?? { count: 0, totalsByMoneda: new Map() };
      entry.count += 1;
      entry.totalsByMoneda.set(
        c.moneda,
        (entry.totalsByMoneda.get(c.moneda) ?? 0) + Number(c.monto),
      );
      m.set(cardId, entry);
    }
    return m;
  }, [consumosQ.data, resolver]);

  // Lista de consumos para la TC seleccionada (para el PrintableModal).
  const consumosForCard = useMemo(() => {
    if (!estadoCuentaTarjeta) return [];
    return (consumosQ.data ?? []).filter((c) => resolver(c) === estadoCuentaTarjeta.id);
  }, [estadoCuentaTarjeta, consumosQ.data, resolver]);

  if (corp.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-sand bg-sand-l/30 p-4 text-center text-sm text-dark-3">
        No hay {esCorp ? 'tarjetas corporativas' : 'tarjetas de presidencia'} en el catálogo. Ve a{' '}
        <strong>Admin → Tarjetas</strong> para crear una.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-dark-2">
          {rotulo}
        </h3>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setTcCorpOpen(true)}
            className="rounded-md border border-purple/40 bg-purple/10 px-3 py-1 text-xs font-semibold text-purple hover:bg-purple/20"
            title={esCorp ? 'Crear nueva tarjeta corporativa' : 'Crear nueva tarjeta de presidencia'}
          >
            {esCorp ? '+ TC CORP' : '+ TC PRES'}
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-3">
        {corp.map((t) => {
          const stats = statsByCardId.get(t.id);
          const isActive = filterCard === t.id;
          const tint = tintFromColor(t.color);
          return (
            <article
              key={t.id}
              className={`group flex w-56 flex-col overflow-hidden rounded-card border shadow-sm transition-transform hover:scale-[1.02] ${
                isActive ? 'border-teal' : 'border-sand'
              } ${t.activo ? '' : 'opacity-80'}`}
            >
              <button
                type="button"
                onClick={() => onSelectCard(isActive ? '' : t.id)}
                className="p-4 text-left text-white"
                style={{ background: `linear-gradient(135deg, ${tint}cc, ${tint})` }}
                title={isActive ? 'Click para quitar el filtro' : 'Click para filtrar a esta TC'}
              >
                <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] opacity-95">
                  {t.empresa ?? t.titular ?? (esCorp ? 'Corporativa' : 'Presidencia')}
                </p>
                <p className="mt-2 font-mono text-sm font-semibold leading-tight">{t.tc_id}</p>
                {t.banco && <p className="mt-1 text-[10px] opacity-80">{t.banco}</p>}
                {!t.activo && (
                  <p className="mt-1.5 inline-block rounded bg-white/25 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider">
                    Dada de baja
                  </p>
                )}
              </button>
              <div className="bg-white px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-dark-3">
                  {stats?.count ?? 0} consumo{stats?.count === 1 ? '' : 's'}
                </p>
                {stats && stats.totalsByMoneda.size > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {Array.from(stats.totalsByMoneda.entries()).map(([m, sum]) => (
                      <li key={m} className="font-mono text-xs font-semibold text-dark">
                        {fmt(sum, m)}
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  type="button"
                  onClick={() => setEstadoCuentaTarjeta(t)}
                  disabled={!stats || stats.count === 0}
                  className="mt-2 w-full rounded-md border border-teal/40 px-2 py-1 text-[10px] font-semibold text-teal-d hover:bg-teal-l disabled:opacity-40"
                >
                  ⬇ Estado de cuenta
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <Modal
        open={tcCorpOpen}
        onClose={() => setTcCorpOpen(false)}
        title={esCorp ? 'Nueva tarjeta corporativa' : 'Nueva tarjeta de presidencia'}
        size="lg"
      >
        <TarjetaForm
          initial={null}
          submitting={createTarjeta.isPending}
          onSubmit={async (values) => {
            try {
              // Se fuerza el tipo de la galería donde se creó, aunque el
              // formulario permita cambiarlo.
              await createTarjeta.mutateAsync({ ...values, tipo });
              toast.success(esCorp ? 'Tarjeta corporativa creada.' : 'Tarjeta de presidencia creada.');
              setTcCorpOpen(false);
            } catch (e) {
              toast.error(describeError(e));
            }
          }}
          onCancel={() => setTcCorpOpen(false)}
        />
      </Modal>

      <PrintableModal
        open={estadoCuentaTarjeta !== null}
        onClose={() => setEstadoCuentaTarjeta(null)}
        title={`Estado de Cuenta · ${estadoCuentaTarjeta?.empresa ?? estadoCuentaTarjeta?.tc_id ?? ''}`}
      >
        {estadoCuentaTarjeta && (
          <EstadoCuentaPrintable tarjeta={estadoCuentaTarjeta} consumos={consumosForCard} />
        )}
      </PrintableModal>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { useCreateTarjeta, useTarjetas } from '@/modules/admin/hooks';
import { useConsumos } from './hooks';
import { useAuth } from '@/lib/auth';
import { Modal } from '@/components/ui/Modal';
import { TarjetaForm } from '@/modules/admin/components/TarjetaForm';
import { useToast } from '@/components/ui/Toast';
import { describeError } from '@/modules/admin/hooks';
import { formatMoney } from '@/lib/money';

// F-4 · Gallery de TC corporativas. Una card por cada `tarjetas_credito`
// con `tipo='corporativa'`. El click filtra la lista de consumos por
// ese tc_id (selecciona el filtro existente). Botón "Estado de cuenta"
// descarga CSV de los consumos de esa TC.

type Props = {
  filterCard: string;
  onSelectCard: (tcId: string) => void;
};

function fmt(n: number, currency: string): string {
  if (currency === 'GTQ') return formatMoney(n);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
}

function tintFromColor(hex: string | null | undefined): string {
  if (!hex) return '#0d2b2e';
  return hex;
}

export function TcGallery({ filterCard, onSelectCard }: Props) {
  const tarjetasQ = useTarjetas();
  const consumosQ = useConsumos();
  const createTarjeta = useCreateTarjeta();
  const { profile } = useAuth();
  const toast = useToast();
  const isAdmin = profile?.rol === 'admin';
  const [tcCorpOpen, setTcCorpOpen] = useState(false);

  const corp = (tarjetasQ.data ?? []).filter(
    (t) => t.tipo === 'corporativa' && t.activo,
  );

  // Stats por tarjeta (count + total por moneda)
  const statsByCardId = useMemo(() => {
    const m = new Map<string, { count: number; totalsByMoneda: Map<string, number> }>();
    for (const c of consumosQ.data ?? []) {
      const cardId = c.card_id;
      const entry = m.get(cardId) ?? { count: 0, totalsByMoneda: new Map() };
      entry.count += 1;
      entry.totalsByMoneda.set(
        c.moneda,
        (entry.totalsByMoneda.get(c.moneda) ?? 0) + Number(c.monto),
      );
      m.set(cardId, entry);
    }
    return m;
  }, [consumosQ.data]);

  function exportEstadoCuenta(tcId: string, label: string) {
    const items = (consumosQ.data ?? []).filter((c) => c.card_id === tcId);
    if (items.length === 0) return;
    const csvCell = (s: unknown) => {
      if (s == null) return '';
      return `"${String(s).replace(/"/g, '""')}"`;
    };
    const header = ['Fecha', 'Proveedor', 'Concepto', 'Moneda', 'Monto', 'Voucher', 'Autorizó']
      .map(csvCell)
      .join(',');
    const lines = items.map((c) =>
      [
        c.fecha,
        c.proveedor,
        c.concepto,
        c.moneda,
        Number(c.monto).toFixed(2),
        c.voucher_num,
        c.autorizador_id ?? '',
      ]
        .map(csvCell)
        .join(','),
    );
    const csv = [header, ...lines].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const safe = label.replace(/[^a-z0-9]/gi, '_').slice(0, 40);
    a.download = `estado_${safe}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  if (corp.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-sand bg-sand-l/30 p-4 text-center text-sm text-dark-3">
        No hay tarjetas corporativas en el catálogo. Ve a <strong>Admin → Tarjetas</strong> para
        crear una.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-dark-2">
          Tarjetas corporativas
        </h3>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setTcCorpOpen(true)}
            className="rounded-md border border-purple/40 bg-purple/10 px-3 py-1 text-xs font-semibold text-purple hover:bg-purple/20"
            title="Crear nueva tarjeta corporativa"
          >
            + TC CORP
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-3">
        {corp.map((t) => {
          const stats = statsByCardId.get(t.tc_id);
          const isActive = filterCard === t.tc_id;
          const tint = tintFromColor(t.color);
          return (
            <article
              key={t.id}
              className={`group flex w-56 flex-col overflow-hidden rounded-card border shadow-sm transition-transform hover:scale-[1.02] ${
                isActive ? 'border-teal' : 'border-sand'
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectCard(isActive ? '' : t.tc_id)}
                className="p-4 text-left text-white"
                style={{ background: `linear-gradient(135deg, ${tint}cc, ${tint})` }}
                title={isActive ? 'Click para quitar el filtro' : 'Click para filtrar a esta TC'}
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] opacity-80">
                  {t.empresa ?? 'Corporativa'}
                </p>
                <p className="mt-2 font-mono text-sm font-semibold leading-tight">{t.tc_id}</p>
                {t.banco && <p className="mt-1 text-[10px] opacity-80">{t.banco}</p>}
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
                  onClick={() => exportEstadoCuenta(t.tc_id, t.empresa ?? t.tc_id)}
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
        title="Nueva tarjeta corporativa"
        size="lg"
      >
        <TarjetaForm
          initial={null}
          submitting={createTarjeta.isPending}
          onSubmit={async (values) => {
            try {
              // Forzar tipo='corporativa' aunque el form permita cambiar.
              await createTarjeta.mutateAsync({ ...values, tipo: 'corporativa' });
              toast.success('Tarjeta corporativa creada.');
              setTcCorpOpen(false);
            } catch (e) {
              toast.error(describeError(e));
            }
          }}
          onCancel={() => setTcCorpOpen(false)}
        />
      </Modal>
    </div>
  );
}

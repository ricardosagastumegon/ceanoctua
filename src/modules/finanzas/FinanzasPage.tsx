import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { ConsumosSection } from './consumos/ConsumosSection';
import { ReintegrosSection } from './reintegros/ReintegrosSection';
import { PagosSection } from './pagos/PagosSection';
import { VouchersSection } from './vouchers/VouchersSection';

type SectionKey = 'consumos' | 'reintegros' | 'pagos' | 'vouchers';

const sections: { key: SectionKey; label: string }[] = [
  { key: 'consumos', label: 'Consumos TC' },
  { key: 'reintegros', label: 'Reintegros' },
  { key: 'pagos', label: 'Pagos' },
  { key: 'vouchers', label: 'Vouchers' },
];

export function FinanzasPage() {
  const { profile } = useAuth();
  const canEdit = profile?.rol === 'admin' || profile?.rol === 'asistente';
  const [tab, setTab] = useState<SectionKey>('consumos');

  if (profile?.rol !== 'admin' && profile?.rol !== 'asistente') {
    return (
      <section className="rounded-card border border-sand bg-white p-8 shadow-sm">
        <h1 className="font-heading text-2xl font-semibold text-dark">Sin acceso</h1>
        <p className="mt-2 text-sm text-dark-2">El módulo Finanzas es exclusivo de admin y asistente.</p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="font-heading text-2xl font-semibold text-dark">Finanzas</h1>
        <p className="mt-1 text-sm text-dark-2">
          Consumos de TC, reintegros, pagos y vouchers. Cada operación queda registrada en{' '}
          <code>audit_log</code>.
        </p>
      </header>

      <div className="overflow-hidden rounded-card border border-sand bg-white p-1 shadow-sm">
        <nav className="flex flex-wrap gap-1" aria-label="Secciones de Finanzas">
          {sections.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setTab(s.key)}
              className={[
                'rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors',
                tab === s.key ? 'bg-teal text-white shadow-sm' : 'text-dark-2 hover:bg-sand-l hover:text-teal-d',
              ].join(' ')}
              aria-current={tab === s.key ? 'page' : undefined}
            >
              {s.label}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'consumos' && <ConsumosSection canEdit={canEdit} />}
      {tab === 'reintegros' && <ReintegrosSection canEdit={canEdit} />}
      {tab === 'pagos' && <PagosSection canEdit={canEdit} />}
      {tab === 'vouchers' && <VouchersSection canEdit={canEdit} />}
    </section>
  );
}

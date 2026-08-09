import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { ValesSection } from './vales/ValesSection';
import { LiquidacionesSection } from './liquidaciones/LiquidacionesSection';

type SectionKey = 'vales' | 'liquidaciones';

const sections: { key: SectionKey; label: string }[] = [
  { key: 'vales', label: 'Vales' },
  { key: 'liquidaciones', label: 'Liquidaciones' },
];

export function CajaChicaPage() {
  const { profile } = useAuth();
  const canEdit = profile?.rol === 'admin' || profile?.rol === 'asistente';
  const [tab, setTab] = useState<SectionKey>('vales');

  return (
    <section className="space-y-6">
      <header>
        <h1 className="font-heading text-2xl font-semibold text-dark">Control Vales</h1>
        <p className="mt-1 text-sm text-dark-2">
          Vales individuales y liquidaciones que los agrupan. {canEdit ? '' : 'Solo lectura.'}
        </p>
      </header>

      <div className="overflow-hidden rounded-card border border-sand bg-white p-1 shadow-sm">
        <nav className="flex gap-1" aria-label="Secciones de Control Vales">
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

      {tab === 'vales' && <ValesSection canEdit={canEdit} />}
      {tab === 'liquidaciones' && <LiquidacionesSection canEdit={canEdit} />}
    </section>
  );
}

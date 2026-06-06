import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth';

// Las 5 secciones del módulo Finanzas (Fase 16 · F-0):
//   1. Vales              ← venía de CC Board
//   2. Liquidaciones      ← venía de CC Board
//   3. Reintegros
//   4. Consumos TC Corp
//   5. Pagos
//
// La sub-sección Vouchers fue eliminada del UI; la tabla `vouchers`
// queda en la base (deprecada) hasta que F-5 la reemplace por la
// nueva SP que la absorbe.
import { ValesSection } from '@/modules/cc-board/vales/ValesSection';
import { LiquidacionesSection } from '@/modules/cc-board/liquidaciones/LiquidacionesSection';
import { ReintegrosSection } from './reintegros/ReintegrosSection';
import { ConsumosSection } from './consumos/ConsumosSection';
import { PagosSection } from './pagos/PagosSection';

type SectionKey = 'vales' | 'liquidaciones' | 'reintegros' | 'consumos' | 'pagos';

const sections: { key: SectionKey; label: string }[] = [
  { key: 'vales', label: 'Vales' },
  { key: 'liquidaciones', label: 'Liquidaciones' },
  { key: 'reintegros', label: 'Reintegros' },
  { key: 'consumos', label: 'Consumos TC Corp' },
  { key: 'pagos', label: 'Pagos' },
];

export function FinanzasPage() {
  const { profile } = useAuth();
  const canEdit = profile?.rol === 'admin' || profile?.rol === 'asistente';
  const location = useLocation();

  // Sub-sección inicial: lee el hash de la URL (ej. /finanzas#vales) si existe.
  const initialFromHash = (): SectionKey => {
    const h = location.hash.replace('#', '') as SectionKey;
    return (sections.find((s) => s.key === h)?.key ?? 'vales') as SectionKey;
  };
  const [tab, setTab] = useState<SectionKey>(initialFromHash);

  // Si el hash cambia (ej. navegación desde otra sección), actualiza tab.
  useEffect(() => {
    const h = location.hash.replace('#', '') as SectionKey;
    if (sections.find((s) => s.key === h)) setTab(h);
  }, [location.hash]);

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
          Vales · Liquidaciones · Reintegros · Consumos TC Corp · Pagos. Cada operación queda registrada en{' '}
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

      {tab === 'vales' && <ValesSection canEdit={canEdit} />}
      {tab === 'liquidaciones' && <LiquidacionesSection canEdit={canEdit} />}
      {tab === 'reintegros' && <ReintegrosSection canEdit={canEdit} />}
      {tab === 'consumos' && <ConsumosSection canEdit={canEdit} />}
      {tab === 'pagos' && <PagosSection canEdit={canEdit} />}
    </section>
  );
}

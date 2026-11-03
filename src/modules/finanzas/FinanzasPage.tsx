import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { puede, useAuth } from '@/lib/auth';

// Las 5 secciones del módulo Finanzas (Fase 16 · F-0):
//   1. Vales              ← venía de CC Board
//   2. Liquidaciones      ← venía de CC Board
//   3. Reintegros
//   4. Consumos TC Corp
//   5. Consumos TC Pres  ← las de presidencia, que antes no tenian galeria
//   6. Pagos
//
// La sub-sección Vouchers fue eliminada del UI; la tabla `vouchers`
// queda en la base (deprecada) hasta que F-5 la reemplace por la
// nueva SP que la absorbe.
import { ValesSection } from '@/modules/cc-board/vales/ValesSection';
import { LiquidacionesSection } from '@/modules/cc-board/liquidaciones/LiquidacionesSection';
import { ReintegrosSection } from './reintegros/ReintegrosSection';
import { ConsumosSection } from './consumos/ConsumosSection';
import { PagosSection } from './pagos/PagosSection';

type SectionKey =
  | 'vales'
  | 'liquidaciones'
  | 'reintegros'
  | 'consumos'
  | 'consumos_pres'
  | 'pagos';

/**
 * `interna` marca lo que es la operación de la asistente: los vales y sus
 * liquidaciones, los reintegros, y los consumos de las tarjetas de
 * Presidencia, que solo conciernen a Presidencia.
 *
 * Quien entra de afuera viene a revisar lo que tiene que autorizar --las
 * solicitudes de pago-- y el gasto de las corporativas. Las otras cuatro
 * pestañas le estorban.
 *
 * A una liquidación sí puede llegar, pero por la puerta de su tablero: si se
 * la mandaron a firmar, «Ver detalles» la trae con `?liq=`.
 */
const sections: { key: SectionKey; label: string; interna?: boolean }[] = [
  { key: 'vales', label: 'Vales', interna: true },
  { key: 'liquidaciones', label: 'Liquidaciones', interna: true },
  { key: 'reintegros', label: 'Reintegros', interna: true },
  { key: 'consumos', label: 'Consumos TC Corp' },
  { key: 'consumos_pres', label: 'Consumos TC Pres', interna: true },
  { key: 'pagos', label: 'Pagos' },
];

export function FinanzasPage() {
  const { profile } = useAuth();
  // Quien entra y quien puede escribir salen del permiso por módulo. Antes
  // se miraba el rol base, y por eso la gerente --`solo_lectura` con
  // `finanzas:observador`-- veía la pestaña en la barra y al entrar se topaba
  // con «Sin acceso».
  const canEdit = puede(profile, 'finanzas', 'editor');
  const location = useLocation();

  const esAsistente = profile?.rol === 'admin' || profile?.rol === 'asistente';

  // `?sp=SP-2026-0011` o `?liq=CC-2026-0019` llegan desde «Ver detalles» en el
  // tablero de quien firma: no basta con dejarla en la lista, hay que decirle
  // cuál es la suya.
  const params = new URLSearchParams(location.search);
  const resaltarPago = params.get('sp');
  const resaltarLiq = params.get('liq');

  // La liquidación que viene marcada en la URL abre su pestaña aunque no esté
  // en la barra: se llega a ese documento concreto, no a la sección.
  const visibles = sections.filter(
    (s) => esAsistente || !s.interna || (s.key === 'liquidaciones' && !!resaltarLiq),
  );

  // Sub-sección inicial: lee el hash de la URL (ej. /finanzas#vales) si existe.
  const initialFromHash = (): SectionKey => {
    const h = location.hash.replace('#', '') as SectionKey;
    return (visibles.find((s) => s.key === h)?.key ?? visibles[0]?.key ?? 'pagos') as SectionKey;
  };
  const [tab, setTab] = useState<SectionKey>(initialFromHash);

  // Si el hash cambia (ej. navegación desde otra sección), actualiza tab.
  useEffect(() => {
    const h = location.hash.replace('#', '') as SectionKey;
    if (visibles.find((s) => s.key === h)) setTab(h);
    // `visibles` se recalcula en cada render; lo que importa es el hash y si
    // la URL trae una liquidación marcada, que es lo que la hace visible.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.hash, resaltarLiq, esAsistente]);

  if (!puede(profile, 'finanzas')) {
    return (
      <section className="rounded-card border border-sand bg-white p-8 shadow-sm">
        <h1 className="font-heading text-2xl font-semibold text-dark">Sin acceso</h1>
        <p className="mt-2 text-sm text-dark-2">
          No tienes Finanzas asignado. Se habilita en Admin → Usuarios y accesos.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="font-heading text-2xl font-semibold text-dark">Finanzas</h1>
        <p className="mt-1 text-sm text-dark-2">
          Vales · Liquidaciones · Reintegros · Consumos TC · Pagos. Cada operación queda registrada en{' '}
          <code>audit_log</code>.
        </p>
      </header>

      <div className="overflow-hidden rounded-card border border-sand bg-white p-1 shadow-sm">
        <nav className="flex flex-wrap gap-1" aria-label="Secciones de Finanzas">
          {visibles.map((s) => (
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

      {esAsistente && tab === 'vales' && <ValesSection canEdit={canEdit} />}
      {tab === 'liquidaciones' && (
        <LiquidacionesSection canEdit={canEdit} resaltar={resaltarLiq} />
      )}
      {esAsistente && tab === 'reintegros' && <ReintegrosSection canEdit={canEdit} />}
      {tab === 'consumos' && <ConsumosSection canEdit={canEdit} tipo="corporativa" />}
      {esAsistente && tab === 'consumos_pres' && <ConsumosSection canEdit={canEdit} tipo="presidencia" />}
      {tab === 'pagos' && <PagosSection canEdit={canEdit} resaltar={resaltarPago} />}
    </section>
  );
}

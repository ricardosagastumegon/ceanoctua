import { useState } from 'react';
import { puede, useAuth } from '@/lib/auth';
import { CeaTodosSection } from './todos/CeaTodosSection';
import { LavanderiaSection } from './lavanderia/LavanderiaSection';
import { DirectorioSection } from './directorio/DirectorioSection';
import { FirmasSection } from './firmas/FirmasSection';
import { NotasEntregaSection } from './notas-entrega/NotasEntregaSection';

type SectionKey = 'todos' | 'firmas' | 'notas-entrega' | 'lavanderia' | 'directorio';

/**
 * `escritorio` marca lo que es trabajo de la asistente: el libro de firmas,
 * las notas de entrega, la lavandería y el directorio. Quien entra a CEA sin
 * ser admin ni asistente --la gerente, por ejemplo-- viene por sus pendientes
 * y nada más; las otras cuatro secciones solo le estorban.
 */
const sections: { key: SectionKey; label: string; escritorio?: boolean }[] = [
  { key: 'todos', label: 'TO DO' },
  { key: 'firmas', label: 'Firmas', escritorio: true },
  { key: 'notas-entrega', label: 'Notas de entrega', escritorio: true },
  { key: 'lavanderia', label: 'Lavandería', escritorio: true },
  { key: 'directorio', label: 'Directorio', escritorio: true },
];

export function CEAPage() {
  const { profile } = useAuth();
  // Quién puede escribir sale del permiso por módulo, no del rol base: la
  // gerente es `solo_lectura` pero tiene `cea:editor`, y la base ya se lo
  // permitía mientras la pantalla se lo negaba.
  const canEdit = puede(profile, 'cea', 'editor');
  const esAsistente = profile?.rol === 'admin' || profile?.rol === 'asistente';
  const visibles = sections.filter((s) => esAsistente || !s.escritorio);
  const [tab, setTab] = useState<SectionKey>('todos');

  return (
    <section className="space-y-6">
      <header>
        <h1 className="font-heading text-2xl font-semibold text-dark">CEA</h1>
        <p className="mt-1 text-sm text-dark-2">
          {esAsistente ? 'Operación del asistente ejecutivo. ' : 'Tus pendientes. '}
          {canEdit ? 'Puedes crear, editar y borrar.' : 'Solo lectura.'}
        </p>
      </header>

      {visibles.length > 1 && (
      <div className="overflow-hidden rounded-card border border-sand bg-white p-1 shadow-sm">
        <nav className="flex flex-wrap gap-1" aria-label="Secciones de CEA">
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
      )}

      {tab === 'todos' && <CeaTodosSection canEdit={canEdit} />}
      {esAsistente && tab === 'firmas' && <FirmasSection canEdit={canEdit} />}
      {esAsistente && tab === 'notas-entrega' && <NotasEntregaSection canEdit={canEdit} />}
      {esAsistente && tab === 'lavanderia' && <LavanderiaSection canEdit={canEdit} />}
      {esAsistente && tab === 'directorio' && <DirectorioSection canEdit={canEdit} />}
    </section>
  );
}

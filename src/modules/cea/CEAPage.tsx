import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { CeaTodosSection } from './todos/CeaTodosSection';
import { LavanderiaSection } from './lavanderia/LavanderiaSection';
import { DirectorioSection } from './directorio/DirectorioSection';
import { FirmasSection } from './firmas/FirmasSection';

type SectionKey = 'todos' | 'firmas' | 'lavanderia' | 'directorio';

const sections: { key: SectionKey; label: string }[] = [
  { key: 'todos', label: 'To-dos' },
  { key: 'firmas', label: 'Firmas' },
  { key: 'lavanderia', label: 'Lavandería' },
  { key: 'directorio', label: 'Directorio' },
];

export function CEAPage() {
  const { profile } = useAuth();
  const canEdit = profile?.rol === 'admin' || profile?.rol === 'asistente';
  const [tab, setTab] = useState<SectionKey>('todos');

  return (
    <section className="space-y-6">
      <header>
        <h1 className="font-heading text-2xl font-semibold text-dark">CEA</h1>
        <p className="mt-1 text-sm text-dark-2">
          Operación del asistente ejecutivo. {canEdit ? 'Puedes crear, editar y borrar.' : 'Solo lectura.'}
        </p>
      </header>

      <div className="overflow-hidden rounded-card border border-sand bg-white p-1 shadow-sm">
        <nav className="flex flex-wrap gap-1" aria-label="Secciones de CEA">
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

      {tab === 'todos' && <CeaTodosSection canEdit={canEdit} />}
      {tab === 'firmas' && <FirmasSection canEdit={canEdit} />}
      {tab === 'lavanderia' && <LavanderiaSection canEdit={canEdit} />}
      {tab === 'directorio' && <DirectorioSection canEdit={canEdit} />}
    </section>
  );
}

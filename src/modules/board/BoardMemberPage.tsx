import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { TareasSection } from './tareas/TareasSection';
import { ViajesSection } from './viajes/ViajesSection';
import { PerfilSection } from './perfil/PerfilSection';
import { EventosSection } from './eventos/EventosSection';
import { NotasSection } from './notas/NotasSection';

type SectionKey = 'tareas' | 'viajes' | 'perfil' | 'eventos' | 'notas';

const sections: { key: SectionKey; label: string }[] = [
  { key: 'tareas', label: 'Tareas' },
  { key: 'viajes', label: 'Viajes' },
  { key: 'perfil', label: 'Perfil' },
  { key: 'eventos', label: 'Eventos' },
  { key: 'notas', label: 'Notas' },
];

export function BoardMemberPage({ codigo }: { codigo: string }) {
  const { profile } = useAuth();
  const [tab, setTab] = useState<SectionKey>('tareas');

  const miembroQuery = useQuery({
    queryKey: ['miembros_board', 'by-codigo', codigo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('miembros_board')
        .select('id, codigo, nombre, rol, color')
        .eq('codigo', codigo)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // canEdit:
  //  - admin / asistente: always
  //  - board_member: only their own member page
  //  - solo_lectura: never
  const canEdit =
    profile?.rol === 'admin' ||
    profile?.rol === 'asistente' ||
    (profile?.rol === 'board_member' && profile.miembro_codigo === codigo);

  if (miembroQuery.isLoading) {
    return <p className="text-sm text-dark-3">Cargando miembro…</p>;
  }

  if (miembroQuery.isError) {
    return (
      <p className="text-sm text-rust">
        Error al cargar el miembro: {String((miembroQuery.error as Error)?.message)}
      </p>
    );
  }

  const miembro = miembroQuery.data;
  if (!miembro) {
    return (
      <section className="rounded-card border border-sand bg-white p-8 shadow-sm">
        <h1 className="font-heading text-2xl font-semibold text-dark">Miembro no encontrado</h1>
        <p className="mt-2 text-sm text-dark-2">
          No existe un miembro con código <code>{codigo}</code> en la tabla{' '}
          <code>miembros_board</code>. Edita los nombres reales desde Supabase
          Studio → Table Editor.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <header className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-dark">
            {miembro.nombre}
            <span className="ml-2 text-base font-medium text-dark-3">({miembro.codigo})</span>
          </h1>
          {miembro.rol && <p className="mt-1 text-sm text-dark-2">{miembro.rol}</p>}
        </div>
        {!canEdit && profile?.rol !== 'admin' && profile?.rol !== 'asistente' && (
          <span className="rounded-full bg-sand-l px-3 py-1 text-xs font-semibold uppercase tracking-wider text-dark-3">
            Solo lectura
          </span>
        )}
      </header>

      <div className="overflow-hidden rounded-card border border-sand bg-white p-1 shadow-sm">
        <nav className="flex flex-wrap gap-1" aria-label="Secciones del miembro">
          {sections.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setTab(s.key)}
              className={[
                'rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors',
                tab === s.key
                  ? 'bg-teal text-white shadow-sm'
                  : 'text-dark-2 hover:bg-sand-l hover:text-teal-d',
              ].join(' ')}
              aria-current={tab === s.key ? 'page' : undefined}
            >
              {s.label}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'tareas' && <TareasSection miembroId={miembro.id} canEdit={canEdit} />}
      {tab === 'viajes' && <ViajesSection miembroId={miembro.id} canEdit={canEdit} />}
      {tab === 'perfil' && <PerfilSection miembroId={miembro.id} canEdit={canEdit} />}
      {tab === 'eventos' && <EventosSection miembroId={miembro.id} canEdit={canEdit} />}
      {tab === 'notas' && <NotasSection miembroId={miembro.id} canEdit={canEdit} />}
    </section>
  );
}

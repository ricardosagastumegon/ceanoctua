import { useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { isOverdue } from '@/lib/dates';
import type { AppRol, UserProfile } from '@/types';

type Tab = {
  to: string;
  label: string;
  end?: boolean;
  roles: AppRol[];
  memberCode?: string;
};

const tabs: Tab[] = [
  { to: '/', label: 'Dashboard', end: true, roles: ['admin', 'asistente', 'board_member', 'solo_lectura'] },
  { to: '/maa', label: 'MAA', roles: ['admin', 'asistente', 'board_member'], memberCode: 'MAA' },
  { to: '/ja',  label: 'JA',  roles: ['admin', 'asistente', 'board_member'], memberCode: 'JA' },
  { to: '/la',  label: 'LA',  roles: ['admin', 'asistente', 'board_member'], memberCode: 'LA' },
  { to: '/jm',  label: 'JM',  roles: ['admin', 'asistente', 'board_member'], memberCode: 'JM' },
  { to: '/aa',  label: 'AA',  roles: ['admin', 'asistente', 'board_member'], memberCode: 'AA' },
  { to: '/eg',  label: 'EG',  roles: ['admin', 'asistente', 'board_member'], memberCode: 'EG' },
  { to: '/pe',  label: 'PE',  roles: ['admin', 'asistente', 'board_member'], memberCode: 'PE' },
  { to: '/cc-board', label: 'CC Board',    roles: ['admin', 'asistente'] },
  { to: '/arriaza',  label: 'Arriaza T&T', roles: ['admin', 'asistente'] },
  { to: '/cea',      label: 'CEA',         roles: ['admin', 'asistente'] },
  { to: '/finanzas', label: '💰 Finanzas', roles: ['admin', 'asistente'] },
  { to: '/admin',    label: '⚙ Admin',     roles: ['admin'] },
  { to: '/miel-sj',  label: '🍯 Miel SJ',  roles: ['admin', 'asistente'] },
];

function canSeeTab(tab: Tab, profile: UserProfile | null): boolean {
  if (!profile) return false;
  if (!tab.roles.includes(profile.rol)) return false;
  if (tab.memberCode && profile.rol === 'board_member') {
    return profile.miembro_codigo === tab.memberCode;
  }
  return true;
}

/**
 * Fetches counts of urgent tasks per miembro (alta priority or overdue,
 * still pending). Used to render badges next to each member tab.
 */
function useUrgenciasPorMiembro() {
  return useQuery({
    queryKey: ['tabs-nav', 'urgencias-por-miembro'],
    queryFn: async () => {
      const [tareasRes, miembrosRes] = await Promise.all([
        supabase
          .from('tareas')
          .select('miembro_id, prioridad, fecha, done')
          .eq('done', false),
        supabase.from('miembros_board').select('id, codigo'),
      ]);
      if (tareasRes.error) throw tareasRes.error;
      if (miembrosRes.error) throw miembrosRes.error;

      const codigoById = new Map<string, string>();
      for (const m of miembrosRes.data ?? []) codigoById.set(m.id, m.codigo);

      const counts = new Map<string, number>();
      for (const t of tareasRes.data ?? []) {
        if (!t.miembro_id) continue;
        const isUrgent = t.prioridad === 'alta' || (t.fecha && isOverdue(t.fecha));
        if (!isUrgent) continue;
        const codigo = codigoById.get(t.miembro_id);
        if (!codigo) continue;
        counts.set(codigo, (counts.get(codigo) ?? 0) + 1);
      }
      return counts;
    },
    staleTime: 60_000,
  });
}

export function TabsNav() {
  const { profile } = useAuth();
  const urgencias = useUrgenciasPorMiembro();
  const visible = useMemo(() => tabs.filter((t) => canSeeTab(t, profile)), [profile]);

  return (
    <nav className="sticky top-14 z-30 border-b border-sand bg-white">
      <div className="mx-auto max-w-shell px-6">
        <ul className="flex flex-wrap gap-x-6 gap-y-1">
          {visible.map((tab) => {
            const count = tab.memberCode ? urgencias.data?.get(tab.memberCode) ?? 0 : 0;
            return (
              <li key={tab.to}>
                <NavLink
                  to={tab.to}
                  end={tab.end}
                  className={({ isActive }) =>
                    [
                      'inline-flex h-11 items-center gap-1.5 border-b-2 px-1 text-xs font-semibold uppercase tracking-wider transition-colors',
                      isActive
                        ? 'border-teal text-teal'
                        : 'border-transparent text-dark-2 hover:text-teal-d',
                    ].join(' ')
                  }
                >
                  {tab.label}
                  {count > 0 && (
                    <span
                      className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-rust px-1.5 text-[10px] font-bold leading-[16px] text-white"
                      title={`${count} tarea${count === 1 ? '' : 's'} urgente${count === 1 ? '' : 's'}`}
                    >
                      {count}
                    </span>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}

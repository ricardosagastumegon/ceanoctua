import { NavLink } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
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

export function TabsNav() {
  const { profile } = useAuth();
  const visible = tabs.filter((t) => canSeeTab(t, profile));

  return (
    <nav className="sticky top-14 z-30 border-b border-sand bg-white">
      <div className="mx-auto max-w-shell px-6">
        <ul className="flex flex-wrap gap-x-6 gap-y-1">
          {visible.map((tab) => (
            <li key={tab.to}>
              <NavLink
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  [
                    'inline-flex h-11 items-center border-b-2 px-1 text-xs font-semibold uppercase tracking-wider transition-colors',
                    isActive
                      ? 'border-teal text-teal'
                      : 'border-transparent text-dark-2 hover:text-teal-d',
                  ].join(' ')
                }
              >
                {tab.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

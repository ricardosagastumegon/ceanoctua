import { useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { puede, useAuth } from '@/lib/auth';
import type { AppRol, Modulo, UserProfile } from '@/types';

type Tab = {
  to: string;
  label: string;
  end?: boolean;
  roles: AppRol[];
  /**
   * El módulo al que pertenece. Es lo que se consulta contra los permisos del
   * usuario; `roles` se queda para los casos que aún no migran a módulos.
   */
  modulo?: Modulo;
  /**
   * No dibujar esta pestaña si el usuario ya tiene ese otro módulo, porque
   * entonces llega por dentro y la pestaña sería un duplicado. Es el caso del
   * piloto: él entra directo a su liquidación; quien tiene Aeronaves entero
   * la alcanza desde la flota.
   */
  salvoSi?: Modulo;
};

const tabs: Tab[] = [
  { to: '/', label: 'Dashboard', end: true, roles: ['admin', 'asistente', 'board_member', 'solo_lectura', 'tesoreria'] },
  // CC Board pestaña eliminada en Fase 16 · F-0. Vales y Liquidaciones viven ahora dentro de Finanzas.
  { to: '/arriaza',  label: 'Arriaza T&T', roles: ['admin', 'asistente'], modulo: 'tt' },
  { to: '/aeronaves', label: '✈ Aeronaves', roles: ['admin', 'asistente'], modulo: 'aeronaves' },
  // La puerta del piloto. Solo aparece para quien NO tiene Aeronaves entero.
  {
    to: '/aeronaves/liquidaciones', label: '✈ Mis liquidaciones', roles: [],
    modulo: 'avn_liquidacion', salvoSi: 'aeronaves',
  },
  { to: '/cea',      label: 'CEA',         roles: ['admin', 'asistente'], modulo: 'cea' },
  { to: '/finanzas', label: '💰 Finanzas', roles: ['admin', 'asistente'], modulo: 'finanzas' },
  { to: '/caja-chica', label: '💵 Caja Chica', roles: ['admin', 'asistente'], modulo: 'caja_chica' },
  { to: '/combustible', label: '⛽ Combustible', roles: ['admin', 'asistente'], modulo: 'combustible' },
  // La bandeja del Tesorero. Solo la ve quien recibe algo.
  { to: '/tesoreria', label: '🧾 Tesorería', roles: ['admin', 'tesoreria'], modulo: 'tesoreria' },
  { to: '/admin',    label: '⚙ Admin',     roles: ['admin'] },
  { to: '/miel-sj',  label: '🍯 Miel SJ',  roles: ['admin', 'asistente'], modulo: 'miel_sj' },
];

function canSeeTab(tab: Tab, profile: UserProfile | null): boolean {
  if (!profile) return false;

  if (tab.salvoSi && puede(profile, tab.salvoSi)) return false;

  // Un permiso de módulo asignado a mano abre la pestaña aunque el rol no la
  // contemple: así se le puede dar T&T a un miembro del board sin volverlo
  // asistente. La base decide igual qué datos ve; esto solo dibuja el menú.
  if (tab.modulo && puede(profile, tab.modulo)) return true;

  return tab.roles.includes(profile.rol);
}

export function TabsNav() {
  const { profile } = useAuth();
  const visible = useMemo(() => tabs.filter((t) => canSeeTab(t, profile)), [profile]);
  const { pathname } = useLocation();
  const [abierto, setAbierto] = useState(false);

  const actual = useMemo(() => {
    // La pestaña más específica que coincide con la ruta: `/arriaza/viaje/x`
    // tiene que marcar «Arriaza T&T» y no «Dashboard».
    const candidatos = visible.filter(
      (t) => (t.end ? pathname === t.to : pathname.startsWith(t.to)),
    );
    return candidatos.sort((a, b) => b.to.length - a.to.length)[0] ?? null;
  }, [visible, pathname]);

  return (
    <nav className="sticky top-14 z-30 border-b border-sand bg-white">
      {/* En el teléfono la barra de 14 pestañas no cabe en una fila, así que
          se presenta como el módulo actual y un desplegable. */}
      <div className="mx-auto max-w-shell px-4 md:hidden">
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          className="flex h-12 w-full items-center justify-between text-sm font-extrabold uppercase tracking-wider text-teal-d"
          aria-expanded={abierto}
        >
          <span>{actual?.label ?? 'Menú'}</span>
          <span className={`transition-transform ${abierto ? 'rotate-180' : ''}`}>▾</span>
        </button>
        {abierto && (
          <ul className="pb-2">
            {visible.map((tab) => (
              <li key={tab.to}>
                <NavLink
                  to={tab.to}
                  end={tab.end}
                  onClick={() => setAbierto(false)}
                  className={({ isActive }) =>
                    [
                      'block rounded-md px-3 py-2.5 text-sm font-semibold',
                      isActive ? 'bg-teal-l text-teal-d' : 'text-dark-2 hover:bg-sand-l',
                    ].join(' ')
                  }
                >
                  {tab.label}
                </NavLink>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mx-auto hidden max-w-shell px-6 md:block">
        <ul className="flex flex-wrap gap-x-6 gap-y-1">
          {visible.map((tab) => {
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
                </NavLink>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}

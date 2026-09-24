import { useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { puede, useAuth } from '@/lib/auth';
import { isOverdue } from '@/lib/dates';
import type { AppRol, Modulo, UserProfile } from '@/types';

type Tab = {
  to: string;
  label: string;
  end?: boolean;
  roles: AppRol[];
  memberCode?: string;
  /**
   * Cargo del miembro, para quien no conoce las siglas. Va como tooltip y no
   * como etiqueta: con los cargos completos la barra se parte en dos filas
   * (1471px contra 1352px útiles). El cargo sí se muestra completo en el
   * título de la página, que lo lee de `miembros_board.nombre`.
   */
  hint?: string;
  /**
   * El módulo al que pertenece. Es lo que se consulta contra los permisos del
   * usuario; `roles` se queda para los casos que aún no migran a módulos.
   */
  modulo?: Modulo;
};

const tabs: Tab[] = [
  { to: '/', label: 'Dashboard', end: true, roles: ['admin', 'asistente', 'board_member', 'solo_lectura'] },
  { to: '/maa', label: 'MAA', hint: 'Presidencia', roles: ['admin', 'asistente', 'board_member'], memberCode: 'MAA', modulo: 'maa' },
  { to: '/ja',  label: 'JA',  hint: 'Gerencia Agrícola',  roles: ['admin', 'asistente', 'board_member'], memberCode: 'JA', modulo: 'ja' },
  { to: '/la',  label: 'LA',  hint: 'Gerencia Administrativa',  roles: ['admin', 'asistente', 'board_member'], memberCode: 'LA', modulo: 'la' },
  { to: '/jm',  label: 'JM',  hint: 'Gerencia LUM',  roles: ['admin', 'asistente', 'board_member'], memberCode: 'JM', modulo: 'jm' },
  { to: '/aa',  label: 'AA',  hint: 'Board',  roles: ['admin', 'asistente', 'board_member'], memberCode: 'AA', modulo: 'aa' },
  { to: '/eg',  label: 'EG',  hint: 'Gerente General',  roles: ['admin', 'asistente', 'board_member'], memberCode: 'EG', modulo: 'eg' },
  { to: '/pe',  label: 'PE',  hint: 'Board',  roles: ['admin', 'asistente', 'board_member'], memberCode: 'PE', modulo: 'pe' },
  // CC Board pestaña eliminada en Fase 16 · F-0. Vales y Liquidaciones viven ahora dentro de Finanzas.
  { to: '/arriaza',  label: 'Arriaza T&T', roles: ['admin', 'asistente'], modulo: 'tt' },
  { to: '/aeronaves', label: '✈ Aeronaves', roles: ['admin', 'asistente'], modulo: 'aeronaves' },
  { to: '/cea',      label: 'CEA',         roles: ['admin', 'asistente'], modulo: 'cea' },
  { to: '/finanzas', label: '💰 Finanzas', roles: ['admin', 'asistente'], modulo: 'finanzas' },
  { to: '/caja-chica', label: '💵 Caja Chica', roles: ['admin', 'asistente'], modulo: 'caja_chica' },
  { to: '/admin',    label: '⚙ Admin',     roles: ['admin'] },
  { to: '/miel-sj',  label: '🍯 Miel SJ',  roles: ['admin', 'asistente'], modulo: 'miel_sj' },
];

function canSeeTab(tab: Tab, profile: UserProfile | null): boolean {
  if (!profile) return false;

  // Un permiso de módulo asignado a mano abre la pestaña aunque el rol no la
  // contemple: así se le puede dar T&T a un miembro del board sin volverlo
  // asistente. La base decide igual qué datos ve; esto solo dibuja el menú.
  if (tab.modulo && puede(profile, tab.modulo)) return true;

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
                  {tab.hint && (
                    <span className="ml-2 text-[11px] font-normal text-dark-3">{tab.hint}</span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mx-auto hidden max-w-shell px-6 md:block">
        <ul className="flex flex-wrap gap-x-6 gap-y-1">
          {visible.map((tab) => {
            const count = tab.memberCode ? urgencias.data?.get(tab.memberCode) ?? 0 : 0;
            return (
              <li key={tab.to}>
                <NavLink
                  to={tab.to}
                  end={tab.end}
                  title={tab.hint}
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

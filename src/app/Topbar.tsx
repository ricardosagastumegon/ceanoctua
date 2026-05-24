import { useAuth } from '@/lib/auth';
import { Clock } from './Clock';

const rolLabel: Record<string, string> = {
  admin: 'Admin',
  asistente: 'Asistente',
  board_member: 'Board',
  solo_lectura: 'Solo lectura',
};

export function Topbar() {
  const { profile, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-40 h-14 border-b-2 border-teal bg-dark">
      <div className="mx-auto flex h-full max-w-shell items-center justify-between px-6">
        <a href="/" className="font-heading text-lg font-bold tracking-wide text-sand-l">
          Board <span className="text-teal">Assistant</span>
        </a>

        <div className="flex items-center gap-6">
          {profile && (
            <div className="text-right leading-tight">
              <div className="text-sm font-medium text-sand-l">
                {profile.nombre ?? 'Usuario'}
              </div>
              <div className="text-xs text-sand">
                {rolLabel[profile.rol] ?? profile.rol}
                {profile.miembro_codigo ? ` · ${profile.miembro_codigo}` : ''}
              </div>
            </div>
          )}
          <Clock />
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-md border border-sand/30 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-sand-l transition-colors hover:border-teal hover:text-teal"
          >
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}

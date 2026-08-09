import { useAuth } from '@/lib/auth';
import { PersonalView } from './PersonalView';
import { FullView } from './FullView';

export function DashboardPage() {
  const { profile, loading, signOut } = useAuth();

  if (loading) {
    return <p className="text-sm text-dark-3">Cargando…</p>;
  }

  if (!profile) {
    // C-1 v2 · si llegamos acá es que el bootstrap terminó (o timeout) sin cargar
    // el profile. Le damos al user 2 escapes: reintentar (recarga la app y hace
    // otro getUser+refreshSession) o cerrar sesión (limpia storage → /login).
    return (
      <section className="rounded-card border border-rust/40 bg-white p-8 shadow-sm">
        <h1 className="font-heading text-lg font-semibold text-dark">
          Sesión no disponible
        </h1>
        <p className="mt-2 text-sm text-dark-2">
          No pudimos cargar tu perfil. Puede ser que tu sesión haya caducado o que
          la conexión con Supabase se interrumpiera.
        </p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-d"
          >
            ↻ Reintentar
          </button>
          <button
            type="button"
            onClick={async () => {
              // Nuclear cleanup: signOut() puede fallar (network, token corrupto)
              // pero necesitamos garantizar que la app arranca limpia. Limpiamos
              // TODOS los keys de Supabase en localStorage + sessionStorage
              // antes de redirect. Esto rompe cualquier estado inconsistente.
              try {
                await signOut();
              } catch {
                /* ignore */
              }
              try {
                const keys = Object.keys(localStorage);
                for (const k of keys) {
                  if (k.startsWith('sb-') || k.includes('supabase')) {
                    localStorage.removeItem(k);
                  }
                }
                const skeys = Object.keys(sessionStorage);
                for (const k of skeys) {
                  if (k.startsWith('sb-') || k.includes('supabase')) {
                    sessionStorage.removeItem(k);
                  }
                }
              } catch {
                /* ignore */
              }
              window.location.href = '/login';
            }}
            className="rounded-md border border-sand px-4 py-2 text-sm font-semibold text-dark-2 hover:bg-sand-l"
          >
            Cerrar sesión y volver a entrar
          </button>
        </div>
      </section>
    );
  }

  // board_member sees only personal view; admin/asistente/solo_lectura see full view.
  if (profile.rol === 'board_member') {
    if (!profile.miembro_codigo) {
      return (
        <section className="rounded-card border border-rust/40 bg-white p-8 shadow-sm">
          <h1 className="font-heading text-2xl font-semibold text-dark">Sin miembro asignado</h1>
          <p className="mt-2 text-sm text-dark-2">
            Tu cuenta tiene rol <code>board_member</code> pero no está enlazada a un miembro del
            board. Un administrador debe asignarte <code>miembro_id</code> en la tabla{' '}
            <code>usuarios</code>.
          </p>
        </section>
      );
    }
    return <PersonalView memberCode={profile.miembro_codigo} />;
  }

  return <FullView rol={profile.rol} />;
}

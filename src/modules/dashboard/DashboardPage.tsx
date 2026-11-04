import { useAuth } from '@/lib/auth';
import { FullView } from './FullView';
import { GerenteView } from './GerenteView';

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

  // Quien opera el sistema --admin y asistente-- ve el tablero completo. Quien
  // entra a supervisar y firmar ve el suyo: el tablero de operacion no es "lo
  // mismo con menos columnas", le estorba.
  //
  // Un `board_member` cae en el segundo grupo. Antes tenia su propia pantalla
  // --PersonalView-- que resumia las tablas del modulo board; se fue con ellas
  // en la fase 42. GerenteView hace lo mismo con los datos que si existen.
  if (profile.rol === 'admin' || profile.rol === 'asistente') {
    return <FullView rol={profile.rol} />;
  }

  return <GerenteView />;
}

import { useAuth } from '@/lib/auth';
import { PersonalView } from './PersonalView';
import { FullView } from './FullView';

export function DashboardPage() {
  const { profile, loading } = useAuth();

  if (loading) {
    return <p className="text-sm text-dark-3">Cargando…</p>;
  }

  if (!profile) {
    return (
      <section className="rounded-card border border-sand bg-white p-8 shadow-sm">
        <p className="text-sm text-dark-2">No hay perfil cargado.</p>
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

import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Topbar } from './Topbar';
import { TabsNav } from './TabsNav';

export function Layout() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sand-l">
        <span className="text-sm text-dark-2">Cargando…</span>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-sand-l">
      <Topbar />
      <TabsNav />
      <main className="mx-auto max-w-shell px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}

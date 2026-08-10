import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Layout } from './Layout';
import Login from './Login';

// Lazy-load every page so each lives in its own chunk.
// Reduces initial bundle from ~880 KB to ~250 KB.
const DashboardPage = lazy(() => import('@/modules/dashboard/page'));
const MaaPage = lazy(() => import('@/modules/maa/page'));
const JaPage = lazy(() => import('@/modules/ja/page'));
const LaPage = lazy(() => import('@/modules/la/page'));
const JmPage = lazy(() => import('@/modules/jm/page'));
const AaPage = lazy(() => import('@/modules/aa/page'));
const EgPage = lazy(() => import('@/modules/eg/page'));
const PePage = lazy(() => import('@/modules/pe/page'));
// CcBoardPage eliminada en Fase 16 · F-0 (mergeada con Finanzas).
const ArriazaPage = lazy(() => import('@/modules/arriaza/page'));
const CeaPage = lazy(() => import('@/modules/cea/page'));
const AdminPage = lazy(() => import('@/modules/admin/page'));
const MielSjPage = lazy(() => import('@/modules/miel-sj/page'));
const FinanzasPage = lazy(() => import('@/modules/finanzas/page'));
const CajaChicaPage = lazy(() => import('@/modules/caja-chica/page'));

function withSuspense(node: ReactNode) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <span className="text-sm text-dark-3">Cargando módulo…</span>
        </div>
      }
    >
      {node}
    </Suspense>
  );
}

export const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: withSuspense(<DashboardPage />) },
      { path: 'maa', element: withSuspense(<MaaPage />) },
      { path: 'ja', element: withSuspense(<JaPage />) },
      { path: 'la', element: withSuspense(<LaPage />) },
      { path: 'jm', element: withSuspense(<JmPage />) },
      { path: 'aa', element: withSuspense(<AaPage />) },
      { path: 'eg', element: withSuspense(<EgPage />) },
      { path: 'pe', element: withSuspense(<PePage />) },
      // /cc-board redirige a /finanzas con hash a la sub-sección de vales,
      // ya que CC Board fue absorbida por Finanzas en Fase 16 · F-0.
      { path: 'cc-board', element: <Navigate to="/finanzas#vales" replace /> },
      { path: 'cc-board/*', element: <Navigate to="/finanzas#vales" replace /> },
      { path: 'arriaza', element: withSuspense(<ArriazaPage />) },
      { path: 'cea', element: withSuspense(<CeaPage />) },
      { path: 'admin', element: withSuspense(<AdminPage />) },
      { path: 'miel-sj', element: withSuspense(<MielSjPage />) },
      { path: 'finanzas', element: withSuspense(<FinanzasPage />) },
      { path: 'caja-chica', element: withSuspense(<CajaChicaPage />) },
    ],
  },
]);

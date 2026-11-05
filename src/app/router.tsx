import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { cargar } from './cargar';
import { Layout } from './Layout';
import Login from './Login';
import { Inicio } from './Inicio';
import NuevaClave from './NuevaClave';

// Lazy-load every page so each lives in its own chunk.
// Reduces initial bundle from ~880 KB to ~250 KB.
// Los siete tableros por miembro --MAA, JA, LA, JM, AA, EG, PE-- se
// eliminaron en la fase 42: resumian cinco tablas que nunca se usaron y
// mostraban ceros. `miembros_board` se queda, que de ahi cuelgan las firmas.
// CcBoardPage eliminada en Fase 16 · F-0 (mergeada con Finanzas).
const ArriazaPage = lazy(() => cargar(() => import('@/modules/arriaza/page')));
const ArriazaTripPage = lazy(() => cargar(() => import('@/modules/arriaza/detail-page')));
const AeronavesPage = lazy(() => cargar(() => import('@/modules/aeronaves/page')));
const AeronaveDetailPage = lazy(() => cargar(() => import('@/modules/aeronaves/detail-page')));
const CeaPage = lazy(() => cargar(() => import('@/modules/cea/page')));
const AdminPage = lazy(() => cargar(() => import('@/modules/admin/page')));
const MielSjPage = lazy(() => cargar(() => import('@/modules/miel-sj/page')));
const FinanzasPage = lazy(() => cargar(() => import('@/modules/finanzas/page')));
const CajaChicaPage = lazy(() => cargar(() => import('@/modules/caja-chica/page')));
const CombustiblePage = lazy(() => cargar(() => import('@/modules/combustible/page')));
// La bandeja de quien recibe. Vive aparte del combustible a proposito: hoy le
// llegan solicitudes de vale y solicitudes de pago, y cuando se enchufe caja
// chica le llegaran vales de dinero y liquidaciones sin tocar esta pantalla.
const TesoreriaPage = lazy(() => cargar(() => import('@/modules/tesoreria/page')));

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
  // Fuera del Layout: se llega aqui desde el correo de recuperacion, con una
  // sesion temporal y sin haber pasado por el menu.
  { path: '/nueva-clave', element: <NuevaClave /> },
  {
    path: '/',
    element: <Layout />,
    children: [
      // `Inicio` decide: quien administra ve el Dashboard; a quien solo se le
      // abrio un modulo lo manda directo a lo suyo.
      { index: true, element: <Inicio /> },
      // /cc-board redirige a /finanzas con hash a la sub-sección de vales,
      // ya que CC Board fue absorbida por Finanzas en Fase 16 · F-0.
      { path: 'cc-board', element: <Navigate to="/finanzas#vales" replace /> },
      { path: 'cc-board/*', element: <Navigate to="/finanzas#vales" replace /> },
      { path: 'arriaza', element: withSuspense(<ArriazaPage />) },
      // El viaje se construye en su propia pantalla (fase 21-3). Lleva el uuid
      // y no el correlativo, que puede venir nulo en viajes viejos.
      { path: 'arriaza/viaje/:id', element: withSuspense(<ArriazaTripPage />) },
      // El modulo de aeronaves entra por la flota; la matricula va en la
      // direccion porque es unica, no cambia y se lee.
      { path: 'aeronaves', element: withSuspense(<AeronavesPage />) },
      { path: 'aeronaves/:matricula', element: withSuspense(<AeronaveDetailPage />) },
      { path: 'cea', element: withSuspense(<CeaPage />) },
      { path: 'admin', element: withSuspense(<AdminPage />) },
      { path: 'miel-sj', element: withSuspense(<MielSjPage />) },
      { path: 'finanzas', element: withSuspense(<FinanzasPage />) },
      { path: 'caja-chica', element: withSuspense(<CajaChicaPage />) },
      { path: 'combustible', element: withSuspense(<CombustiblePage />) },
      { path: 'tesoreria', element: withSuspense(<TesoreriaPage />) },
    ],
  },
]);

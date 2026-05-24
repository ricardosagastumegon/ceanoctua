import { createBrowserRouter } from 'react-router-dom';
import { Layout } from './Layout';
import Login from './Login';

import DashboardPage from '@/modules/dashboard/page';
import MaaPage from '@/modules/maa/page';
import JaPage from '@/modules/ja/page';
import LaPage from '@/modules/la/page';
import JmPage from '@/modules/jm/page';
import AaPage from '@/modules/aa/page';
import EgPage from '@/modules/eg/page';
import PePage from '@/modules/pe/page';
import CcBoardPage from '@/modules/cc-board/page';
import ArriazaPage from '@/modules/arriaza/page';
import CeaPage from '@/modules/cea/page';
import AdminPage from '@/modules/admin/page';
import MielSjPage from '@/modules/miel-sj/page';
import FinanzasPage from '@/modules/finanzas/page';

export const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'maa', element: <MaaPage /> },
      { path: 'ja', element: <JaPage /> },
      { path: 'la', element: <LaPage /> },
      { path: 'jm', element: <JmPage /> },
      { path: 'aa', element: <AaPage /> },
      { path: 'eg', element: <EgPage /> },
      { path: 'pe', element: <PePage /> },
      { path: 'cc-board', element: <CcBoardPage /> },
      { path: 'arriaza', element: <ArriazaPage /> },
      { path: 'cea', element: <CeaPage /> },
      { path: 'admin', element: <AdminPage /> },
      { path: 'miel-sj', element: <MielSjPage /> },
      { path: 'finanzas', element: <FinanzasPage /> },
    ],
  },
]);

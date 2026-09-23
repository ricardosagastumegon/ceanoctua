import { Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { puede, useAuth } from '@/lib/auth';
import type { Modulo } from '@/types';

const DashboardPage = lazy(() => import('@/modules/dashboard/page'));

/**
 * A dónde cae alguien que abre la aplicación.
 *
 * Quien administra la junta entra al Dashboard, que es el resumen de todo.
 * Pero a quien solo se le abrió un módulo —el caso del presidente con T&T—
 * el Dashboard le mostraría tarjetas vacías y errores de permiso, porque
 * consulta tablas que no puede leer. A esa persona se la manda directo a lo
 * suyo: abre el ícono del teléfono y ya está donde tiene que estar.
 */
const DESTINO: { modulo: Modulo; ruta: string }[] = [
  { modulo: 'tt', ruta: '/arriaza' },
  { modulo: 'maa', ruta: '/maa' },
  { modulo: 'ja', ruta: '/ja' },
  { modulo: 'la', ruta: '/la' },
  { modulo: 'jm', ruta: '/jm' },
  { modulo: 'aa', ruta: '/aa' },
  { modulo: 'eg', ruta: '/eg' },
  { modulo: 'pe', ruta: '/pe' },
  { modulo: 'cea', ruta: '/cea' },
  { modulo: 'finanzas', ruta: '/finanzas' },
  { modulo: 'caja_chica', ruta: '/caja-chica' },
  { modulo: 'miel_sj', ruta: '/miel-sj' },
];

export function Inicio() {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <span className="text-sm text-dark-3">Cargando…</span>
      </div>
    );
  }

  const administra =
    !!profile && (profile.rol === 'admin' || profile.rol === 'asistente');
  const veDashboard = administra || puede(profile, 'dashboard');

  if (!veDashboard) {
    const suyo = DESTINO.find((d) => puede(profile, d.modulo));
    if (suyo) return <Navigate to={suyo.ruta} replace />;

    // Tiene cuenta pero nadie le ha dado un módulo todavía.
    return (
      <section className="mx-auto max-w-md py-16 text-center">
        <h1 className="font-heading text-xl font-extrabold text-dark">
          Tu acceso todavía no está configurado
        </h1>
        <p className="mt-2 text-sm text-dark-2">
          Tu cuenta existe, pero aún no se te ha asignado ningún módulo. Pídele a
          quien administra CEA que te dé acceso y vuelve a abrir la aplicación.
        </p>
      </section>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <span className="text-sm text-dark-3">Cargando módulo…</span>
        </div>
      }
    >
      <DashboardPage />
    </Suspense>
  );
}

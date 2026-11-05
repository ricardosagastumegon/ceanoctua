import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { SolicitudesSection } from './SolicitudesSection';
import { ReportesSection } from './ReportesSection';

/**
 * Control de combustible de vehiculos.
 *
 * Dos pestañas y no una porque son dos ritmos distintos: las solicitudes se
 * crean todos los dias, segun llegan los choferes; el control se arma cada 15.
 */
export default function CombustiblePage() {
  const { profile } = useAuth();
  const canEdit = profile?.rol === 'admin' || profile?.rol === 'asistente';
  const [tab, setTab] = useState<'solicitudes' | 'control'>('solicitudes');

  const btn = (activo: boolean) =>
    `rounded-md px-3 py-1.5 text-sm font-medium ${
      activo ? 'bg-teal text-white' : 'text-dark-2 hover:bg-sand-l'
    }`;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold text-dark">Combustible</h1>
        <p className="text-sm text-dark-3">
          Solicitudes de vale, control quincenal y el puente a Pagos.
        </p>
      </header>

      <nav className="flex gap-1 border-b border-sand pb-2">
        <button className={btn(tab === 'solicitudes')} onClick={() => setTab('solicitudes')}>
          Solicitudes de vale
        </button>
        <button className={btn(tab === 'control')} onClick={() => setTab('control')}>
          Control de vales
        </button>
      </nav>

      {tab === 'solicitudes' ? (
        <SolicitudesSection canEdit={canEdit} />
      ) : (
        <ReportesSection canEdit={canEdit} />
      )}
    </div>
  );
}

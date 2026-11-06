import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { SolicitudesSection } from './SolicitudesSection';
import { FacturasSection } from './FacturasSection';
import { ReportesSection } from './ReportesSection';

/**
 * Control de combustible de vehiculos.
 *
 * Tres pestañas, que son tres ritmos distintos: las solicitudes se crean
 * todos los dias, segun llegan los choferes; las facturas llegan por
 * despacho, o por dos del mismo dia; y el control se arma cada 15.
 */
export default function CombustiblePage() {
  const { profile } = useAuth();
  const canEdit = profile?.rol === 'admin' || profile?.rol === 'asistente';
  // Borrar una solicitud de vale es del administrador. La base lo vuelve a
  // comprobar en `comb_borrar_solicitud`: esto solo esconde el boton.
  const canDelete = profile?.rol === 'admin';
  const [tab, setTab] = useState<'solicitudes' | 'facturas' | 'control'>('solicitudes');

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
        <button className={btn(tab === 'facturas')} onClick={() => setTab('facturas')}>
          Facturas
        </button>
        <button className={btn(tab === 'control')} onClick={() => setTab('control')}>
          Control de vales
        </button>
      </nav>

      {tab === 'solicitudes' && <SolicitudesSection canEdit={canEdit} canDelete={canDelete} />}
      {tab === 'facturas' && <FacturasSection canEdit={canEdit} canDelete={canDelete} />}
      {tab === 'control' && <ReportesSection canEdit={canEdit} canDelete={canDelete} />}
    </div>
  );
}

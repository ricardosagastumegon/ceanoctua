import { useMemo } from 'react';
import { useCargosViaje } from './hooks';
import type { ServiceKey } from '../constants/serviceMeta';

/**
 * Cuánto se le cargó aparte a cada servicio de un tipo, indexado por su id.
 *
 * Una sola consulta por viaje para toda la sección: `att_cargos` lleva el
 * viaje denormalizado justo para esto, y la caché de React Query la comparte
 * entre las secciones del viaje.
 */
export function useCargosPorServicio(viajeId: string | undefined, tipo: ServiceKey) {
  const query = useCargosViaje(viajeId);
  return useMemo(() => {
    const porId = new Map<string, number>();
    for (const c of query.data ?? []) {
      if (c.servicio_tipo !== tipo) continue;
      porId.set(c.servicio_id, (porId.get(c.servicio_id) ?? 0) + (Number(c.monto) || 0));
    }
    return porId;
  }, [query.data, tipo]);
}

/**
 * El total de una fila de servicio: su base más lo que se le cargó aparte.
 *
 * La fila mostraba solo `monto`, que desde que los cargos adicionales se
 * separaron ya no incluye asientos, maletas ni cambios. Un boleto de 881.98
 * con 85.98 en cargos se leía 881.98 en la lista y 967.96 al abrirlo —y lo que
 * se liquida es el segundo número—. El desglose va debajo para que se vea de
 * dónde sale y no parezca que el monto del servicio cambió solo.
 */
export function MontoConCargos({
  base,
  cargos,
  moneda,
  color,
}: {
  base: number;
  cargos: number;
  moneda: string;
  color: string;
}) {
  return (
    <div className="shrink-0 text-right">
      <div className="font-heading text-sm font-extrabold" style={{ color }}>
        {moneda} {(base + cargos).toFixed(2)}
      </div>
      {cargos > 0 && (
        <div className="text-[10px] text-dark-3">
          {base.toFixed(2)} + {cargos.toFixed(2)} en cargos
        </div>
      )}
    </div>
  );
}

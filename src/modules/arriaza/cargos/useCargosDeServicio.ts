import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTarjetas } from '@/modules/admin/hooks';
import { cargoAInput, guardarCargos, sumaCargos, type CargoInput } from './api';
import { useCargosServicio } from './hooks';
import type { ServiceKey } from '../constants/serviceMeta';

/**
 * Todo el cableado de los cargos adicionales de un servicio, en un solo lugar.
 *
 * Cada formulario de servicio necesita lo mismo: cargar los cargos guardados,
 * mantenerlos mientras se edita, sumarlos para el total, y guardarlos después
 * del servicio —después, porque un servicio nuevo no tiene id hasta que la
 * base se lo da—. Repetir eso en los once formularios era once oportunidades
 * de equivocarse; aquí se escribe una vez.
 *
 * En el formulario quedan tres líneas: este hook, el `<CargosEditor>`, y una
 * llamada a `guardar` después de salvar el servicio.
 */
export function useCargosDeServicio(
  tipo: ServiceKey,
  servicioId: string | undefined,
  viajeId: string,
  abierto: boolean,
) {
  const guardados = useCargosServicio(tipo, servicioId, abierto);
  const tarjetas = useTarjetas();
  const [cargos, setCargos] = useState<CargoInput[]>([]);

  useEffect(() => {
    if (!abierto) return;
    setCargos((guardados.data ?? []).map(cargoAInput));
  }, [abierto, guardados.data]);

  const total = useMemo(() => sumaCargos(cargos), [cargos]);

  const guardar = useCallback(
    async (id: string, moneda: string) => {
      await guardarCargos(
        viajeId,
        tipo,
        id,
        moneda,
        cargos,
        (tarjetas.data ?? []).map((t) => ({
          id: t.id,
          // El texto que se guarda con el cargo: renombrar la tarjeta en Admin
          // no puede reescribir un reporte de hace meses.
          etiqueta: [t.tc_id, t.red, t.banco, t.titular].filter(Boolean).join(' · '),
        })),
      );
    },
    [cargos, tarjetas.data, tipo, viajeId],
  );

  return { cargos, setCargos, guardar, total };
}

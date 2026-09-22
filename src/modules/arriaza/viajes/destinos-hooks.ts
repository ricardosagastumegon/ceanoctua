import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  attViajeDestinosApi,
  type CiudadInput,
  type PaisInput,
  type ParadaInput,
} from './destinos-api';

const keys = {
  byViaje: (viajeId: string) => ['att_viaje_destinos', viajeId] as const,
};

export function useViajeDestinos(viajeId: string | undefined) {
  return useQuery({
    queryKey: viajeId ? keys.byViaje(viajeId) : ['att_viaje_destinos', 'none'],
    queryFn: () => attViajeDestinosApi.listByViaje(viajeId as string),
    enabled: !!viajeId,
  });
}

export function useSyncViajeDestinos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      viajeId: string;
      paises: PaisInput[];
      ciudades: CiudadInput[];
      paradas: ParadaInput[];
    }) => attViajeDestinosApi.sync(vars.viajeId, vars),
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: keys.byViaje(vars.viajeId) });
      // La tarjeta del dashboard muestra país y ciudades, así que también.
      void qc.invalidateQueries({ queryKey: ['att_viajes'] });
    },
  });
}

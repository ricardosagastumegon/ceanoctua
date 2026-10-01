import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { vuelosApi, type PilotoInsert } from './api';

export const vuelosKey = (aeronaveId: string) => ['avn_vuelos', aeronaveId] as const;
export const pilotosKey = ['avn_pilotos'] as const;

export function useVuelos(aeronaveId: string | undefined) {
  return useQuery({
    queryKey: vuelosKey(aeronaveId ?? ''),
    enabled: !!aeronaveId,
    queryFn: () => vuelosApi.list(aeronaveId as string),
  });
}

export function usePilotos() {
  return useQuery({ queryKey: pilotosKey, queryFn: () => vuelosApi.pilotos() });
}

function useInvalidar(aeronaveId: string) {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: vuelosKey(aeronaveId) });
}

export function useGuardarVuelo(aeronaveId: string) {
  const invalidar = useInvalidar(aeronaveId);
  return useMutation({
    mutationFn: (v: Parameters<typeof vuelosApi.save>[0]) => vuelosApi.save(v),
    onSuccess: () => invalidar(),
  });
}

export function useBorrarVuelo(aeronaveId: string) {
  const invalidar = useInvalidar(aeronaveId);
  return useMutation({
    mutationFn: (id: string) => vuelosApi.remove(id),
    onSuccess: () => invalidar(),
  });
}

/** Al tocar un piloto hay que refrescar también los vuelos: llevan su nombre. */
function useInvalidarPilotos(aeronaveId: string) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: pilotosKey });
    void qc.invalidateQueries({ queryKey: vuelosKey(aeronaveId) });
  };
}

export function useGuardarPiloto(aeronaveId: string) {
  const invalidar = useInvalidarPilotos(aeronaveId);
  return useMutation({
    mutationFn: (v: { id?: string; datos: PilotoInsert }) => vuelosApi.guardarPiloto(v.id, v.datos),
    onSuccess: () => invalidar(),
  });
}

export function useBorrarPiloto(aeronaveId: string) {
  const invalidar = useInvalidarPilotos(aeronaveId);
  return useMutation({
    mutationFn: (id: string) => vuelosApi.borrarPiloto(id),
    onSuccess: () => invalidar(),
  });
}

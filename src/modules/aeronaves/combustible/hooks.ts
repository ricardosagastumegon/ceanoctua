import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { combustibleApi, type LineaInput, type RegistroCompleto, type RegistroInsert, type RegistroUpdate } from './api';

export const combustibleKey = (aeronaveId: string) => ['avn_combustible', aeronaveId] as const;

export function useCombustible(aeronaveId: string | undefined) {
  return useQuery({
    queryKey: combustibleKey(aeronaveId ?? ''),
    enabled: !!aeronaveId,
    queryFn: () => combustibleApi.list(aeronaveId as string),
  });
}

function useInvalidar(aeronaveId: string) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: combustibleKey(aeronaveId) });
}

export function useCrearRegistro(aeronaveId: string) {
  const invalidar = useInvalidar(aeronaveId);
  return useMutation({
    mutationFn: (v: { input: RegistroInsert; lineas: LineaInput[] }) =>
      combustibleApi.create(v.input, v.lineas),
    onSuccess: () => void invalidar(),
  });
}

export function useActualizarRegistro(aeronaveId: string) {
  const invalidar = useInvalidar(aeronaveId);
  return useMutation({
    mutationFn: (v: { id: string; patch: RegistroUpdate; lineas: LineaInput[] }) =>
      combustibleApi.update(v.id, v.patch, v.lineas),
    onSuccess: () => void invalidar(),
  });
}

export function useBorrarRegistro(aeronaveId: string) {
  const invalidar = useInvalidar(aeronaveId);
  return useMutation({
    mutationFn: (v: { id: string; notificacionId?: string | null }) =>
      combustibleApi.remove(v.id, v.notificacionId),
    onSuccess: () => void invalidar(),
  });
}

export function useAnularRegistro(aeronaveId: string) {
  const invalidar = useInvalidar(aeronaveId);
  return useMutation({
    mutationFn: (v: { id: string; nota: string }) => combustibleApi.cancelar(v.id, v.nota),
    onSuccess: () => void invalidar(),
  });
}

export function useReactivarRegistro(aeronaveId: string) {
  const invalidar = useInvalidar(aeronaveId);
  return useMutation({
    mutationFn: (id: string) => combustibleApi.reactivar(id),
    onSuccess: () => void invalidar(),
  });
}

export function useCancelarEnvio(aeronaveId: string) {
  const qc = useQueryClient();
  const invalidar = useInvalidar(aeronaveId);
  return useMutation({
    mutationFn: (notificacionId: string) => combustibleApi.cancelarEnvio(notificacionId),
    onSuccess: () => {
      void invalidar();
      // La bandeja de Finanzas tiene que dejar de mostrarlo de inmediato.
      void qc.invalidateQueries({ queryKey: ['pagos_notificaciones'] });
    },
  });
}

export function useEnviarAPagos(aeronaveId: string) {
  const invalidar = useInvalidar(aeronaveId);
  return useMutation({
    mutationFn: (r: RegistroCompleto) => combustibleApi.enviarAPagos(r),
    onSuccess: () => void invalidar(),
  });
}

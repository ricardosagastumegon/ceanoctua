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
    mutationFn: (id: string) => combustibleApi.remove(id),
    onSuccess: () => void invalidar(),
  });
}

export function useEnviarAPagos(aeronaveId: string) {
  const invalidar = useInvalidar(aeronaveId);
  return useMutation({
    mutationFn: (r: RegistroCompleto) => combustibleApi.enviarAPagos(r),
    onSuccess: () => void invalidar(),
  });
}

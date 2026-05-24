import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { perfilApi, type PerfilInsert } from './api';

const keys = {
  byMiembro: (miembroId: string | undefined) => ['perfil', miembroId] as const,
};

export function usePerfil(miembroId: string | undefined) {
  return useQuery({
    queryKey: keys.byMiembro(miembroId),
    queryFn: () => perfilApi.getByMiembro(miembroId as string),
    enabled: !!miembroId,
  });
}

export function useSavePerfil(miembroId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Omit<PerfilInsert, 'miembro_id' | 'id'>) =>
      perfilApi.upsertPerfil(miembroId as string, patch),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.byMiembro(miembroId) }),
  });
}

export function useAddVehiculo(miembroId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { perfilId: string; modelo: string | null; placa: string | null }) =>
      perfilApi.addVehiculo(args.perfilId, { modelo: args.modelo, placa: args.placa }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.byMiembro(miembroId) }),
  });
}
export function useRemoveVehiculo(miembroId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => perfilApi.removeVehiculo(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.byMiembro(miembroId) }),
  });
}

export function useAddFamiliar(miembroId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { perfilId: string; nombre: string; relacion: string | null; fecha_nac: string | null }) =>
      perfilApi.addFamiliar(args.perfilId, { nombre: args.nombre, relacion: args.relacion, fecha_nac: args.fecha_nac }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.byMiembro(miembroId) }),
  });
}
export function useRemoveFamiliar(miembroId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => perfilApi.removeFamiliar(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.byMiembro(miembroId) }),
  });
}

export function useAddFecha(miembroId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { perfilId: string; titulo: string; fecha: string }) =>
      perfilApi.addFecha(args.perfilId, { titulo: args.titulo, fecha: args.fecha }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.byMiembro(miembroId) }),
  });
}
export function useRemoveFecha(miembroId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => perfilApi.removeFecha(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.byMiembro(miembroId) }),
  });
}

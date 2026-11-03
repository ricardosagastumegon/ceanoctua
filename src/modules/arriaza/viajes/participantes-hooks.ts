import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { participantesApi, type ParticipanteInput } from './participantes-api';

const keys = {
  todos: ['att_viaje_participantes'] as const,
  byViaje: (viajeId: string) => ['att_viaje_participantes', viajeId] as const,
};

export function useParticipantesDelViaje(viajeId: string | undefined) {
  return useQuery({
    queryKey: viajeId ? keys.byViaje(viajeId) : ['att_viaje_participantes', 'none'],
    queryFn: () => participantesApi.listByViaje(viajeId as string),
    enabled: !!viajeId,
  });
}

/**
 * Todos los participantes de todos los viajes.
 *
 * La lista de T&T lo usa para mostrarle a cada quien solo los viajes donde va.
 * Son pocas filas --un puñado por viaje-- así que traerlas de una vez sale más
 * barato que preguntar viaje por viaje.
 */
export function useTodosLosParticipantes() {
  return useQuery({
    queryKey: keys.todos,
    queryFn: () => participantesApi.listAll(),
  });
}

export function useSyncParticipantes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { viajeId: string; participantes: ParticipanteInput[] }) =>
      participantesApi.sync(vars.viajeId, vars.participantes),
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: keys.byViaje(vars.viajeId) });
      void qc.invalidateQueries({ queryKey: keys.todos });
      // `acompanantes` lo recalcula un trigger, así que el viaje cambió en la
      // base aunque nadie lo haya editado desde aquí.
      void qc.invalidateQueries({ queryKey: ['att_viajes'] });
    },
  });
}

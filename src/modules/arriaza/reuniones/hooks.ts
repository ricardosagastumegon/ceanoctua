import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import {
  attReunionesApi,
  syncReunionToDayPlan,
  type AttReunion,
  type AttReunionInsert,
  type AttReunionUpdate,
} from './api';

// No usamos createCrudHooks aquí porque create/update tienen efecto lateral
// (sync a att_day_plan_rows) y necesitan invalidar 2 queries.

export const attReunionesKey: QueryKey = ['att_reuniones'];
export function attReunionesByViajeKey(viajeId: string): QueryKey {
  return ['att_reuniones', 'by_viaje', viajeId];
}
const dayPlansKey: QueryKey = ['att_day_plans'];
const dayPlanRowsKey: QueryKey = ['att_day_plan_rows'];

export function useAttReuniones() {
  return useQuery<AttReunion[], Error>({ queryKey: attReunionesKey, queryFn: () => attReunionesApi.list() });
}

export function useAttReunionesByViaje(viajeId: string | null | undefined) {
  return useQuery<AttReunion[], Error>({
    queryKey: attReunionesByViajeKey(viajeId ?? ''),
    queryFn: () => attReunionesApi.listByViaje(viajeId ?? ''),
    enabled: !!viajeId,
  });
}

export function useCreateAttReunion() {
  const qc = useQueryClient();
  return useMutation<AttReunion, Error, AttReunionInsert>({
    mutationFn: async (input) => {
      const row = await attReunionesApi.create(input);
      await syncReunionToDayPlan(row);
      return row;
    },
    onSuccess: (row) => {
      void qc.invalidateQueries({ queryKey: attReunionesKey });
      void qc.invalidateQueries({ queryKey: attReunionesByViajeKey(row.viaje_id) });
      void qc.invalidateQueries({ queryKey: dayPlansKey });
      void qc.invalidateQueries({ queryKey: dayPlanRowsKey });
    },
  });
}

export function useUpdateAttReunion() {
  const qc = useQueryClient();
  return useMutation<AttReunion, Error, { id: string; patch: AttReunionUpdate }>({
    mutationFn: async ({ id, patch }) => {
      const row = await attReunionesApi.update(id, patch);
      await syncReunionToDayPlan(row);
      return row;
    },
    onSuccess: (row) => {
      void qc.invalidateQueries({ queryKey: attReunionesKey });
      void qc.invalidateQueries({ queryKey: attReunionesByViajeKey(row.viaje_id) });
      void qc.invalidateQueries({ queryKey: dayPlansKey });
      void qc.invalidateQueries({ queryKey: dayPlanRowsKey });
    },
  });
}

export function useDeleteAttReunion() {
  const qc = useQueryClient();
  return useMutation<void, Error, { id: string; viajeId: string }>({
    mutationFn: ({ id }) => attReunionesApi.remove(id),
    onSuccess: (_v, { viajeId }) => {
      void qc.invalidateQueries({ queryKey: attReunionesKey });
      void qc.invalidateQueries({ queryKey: attReunionesByViajeKey(viajeId) });
      void qc.invalidateQueries({ queryKey: dayPlanRowsKey });
    },
  });
}

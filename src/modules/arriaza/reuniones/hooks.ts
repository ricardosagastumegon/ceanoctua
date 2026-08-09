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
const dayPlansKey: QueryKey = ['att_day_plans'];
const dayPlanRowsKey: QueryKey = ['att_day_plan_rows'];

export function useAttReuniones() {
  return useQuery<AttReunion[], Error>({ queryKey: attReunionesKey, queryFn: () => attReunionesApi.list() });
}

export function useCreateAttReunion() {
  const qc = useQueryClient();
  return useMutation<AttReunion, Error, AttReunionInsert>({
    mutationFn: async (input) => {
      const row = await attReunionesApi.create(input);
      await syncReunionToDayPlan(row);
      return row;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: attReunionesKey });
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
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: attReunionesKey });
      void qc.invalidateQueries({ queryKey: dayPlansKey });
      void qc.invalidateQueries({ queryKey: dayPlanRowsKey });
    },
  });
}

export function useDeleteAttReunion() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => attReunionesApi.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: attReunionesKey });
      void qc.invalidateQueries({ queryKey: dayPlanRowsKey });
    },
  });
}

import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { createCrudHooks } from '@/lib/createCrudHooks';
import {
  attDayPlansApi,
  attDayPlanRowsApi,
  type AttDayPlan,
  type AttDayPlanInsert,
  type AttDayPlanUpdate,
  type AttDayPlanRow,
  type AttDayPlanRowInsert,
  type AttDayPlanRowUpdate,
} from './api';

// Padre: att_day_plans (uno por [viaje_id, fecha]).
export const {
  queryKey: attDayPlansKey,
  useList: useAttDayPlans,
  useCreate: useCreateAttDayPlan,
  useUpdate: useUpdateAttDayPlan,
  useDelete: useDeleteAttDayPlan,
} = createCrudHooks<AttDayPlan, AttDayPlanInsert, AttDayPlanUpdate>('att_day_plans', attDayPlansApi);

// Hijos: att_day_plan_rows (filas Horario|Itinerario).
export function attDayPlanRowsKey(dayPlanId: string): QueryKey {
  return ['att_day_plan_rows', dayPlanId];
}

export function useAttDayPlanRows(dayPlanId: string | null | undefined) {
  return useQuery<AttDayPlanRow[], Error>({
    queryKey: attDayPlanRowsKey(dayPlanId ?? ''),
    queryFn: () => attDayPlanRowsApi.listByDayPlan(dayPlanId ?? ''),
    enabled: !!dayPlanId,
  });
}

// Todas las rows del viaje (usado por el itinerario final para eficiencia).
export function useAttDayPlanRowsByViaje(viajeId: string | null | undefined) {
  return useQuery<AttDayPlanRow[], Error>({
    queryKey: ['att_day_plan_rows', 'by_viaje', viajeId ?? ''],
    queryFn: () => attDayPlanRowsApi.listByViaje(viajeId ?? ''),
    enabled: !!viajeId,
  });
}

export function useCreateAttDayPlanRow() {
  const qc = useQueryClient();
  return useMutation<AttDayPlanRow, Error, AttDayPlanRowInsert>({
    mutationFn: (input) => attDayPlanRowsApi.create(input),
    onSuccess: (row) => {
      void qc.invalidateQueries({ queryKey: attDayPlanRowsKey(row.day_plan_id) });
      void qc.invalidateQueries({ queryKey: ['att_day_plan_rows', 'by_viaje'] });
    },
  });
}

export function useUpdateAttDayPlanRow() {
  const qc = useQueryClient();
  return useMutation<AttDayPlanRow, Error, { id: string; patch: AttDayPlanRowUpdate }>({
    mutationFn: ({ id, patch }) => attDayPlanRowsApi.update(id, patch),
    onSuccess: (row) => {
      void qc.invalidateQueries({ queryKey: attDayPlanRowsKey(row.day_plan_id) });
      void qc.invalidateQueries({ queryKey: ['att_day_plan_rows', 'by_viaje'] });
    },
  });
}

export function useDeleteAttDayPlanRow() {
  const qc = useQueryClient();
  return useMutation<void, Error, { id: string; dayPlanId: string }>({
    mutationFn: ({ id }) => attDayPlanRowsApi.remove(id),
    onSuccess: (_v, { dayPlanId }) => {
      void qc.invalidateQueries({ queryKey: attDayPlanRowsKey(dayPlanId) });
      void qc.invalidateQueries({ queryKey: ['att_day_plan_rows', 'by_viaje'] });
    },
  });
}

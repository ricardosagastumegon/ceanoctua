import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  liquidacionesApi,
  type LiqRowInsert,
  type LiquidacionInsert,
  type LiquidacionUpdate,
} from './api';

const keys = {
  all: ['caja_chica_liquidaciones'] as const,
  one: (id: string) => ['caja_chica_liquidaciones', id] as const,
  rows: (id: string) => ['caja_chica_liquidaciones', id, 'rows'] as const,
};

export function useLiquidaciones() {
  return useQuery({ queryKey: keys.all, queryFn: () => liquidacionesApi.list() });
}

export function useLiquidacion(id: string | undefined) {
  return useQuery({
    queryKey: id ? keys.one(id) : ['noop-liq'],
    queryFn: () => liquidacionesApi.get(id as string),
    enabled: !!id,
  });
}

export function useLiqRows(liqId: string | undefined) {
  return useQuery({
    queryKey: liqId ? keys.rows(liqId) : ['noop-rows'],
    queryFn: () => liquidacionesApi.listRows(liqId as string),
    enabled: !!liqId,
  });
}

export function useCreateLiquidacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ input, rows }: { input: LiquidacionInsert; rows: Omit<LiqRowInsert, 'liquidacion_id'>[] }) => {
      return liquidacionesApi.create(input).then(async (liq) => {
        if (rows.length > 0) await liquidacionesApi.replaceRows(liq.id, rows);
        return liq;
      });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useUpdateLiquidacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
      rows,
    }: {
      id: string;
      patch: LiquidacionUpdate;
      rows?: Omit<LiqRowInsert, 'liquidacion_id'>[];
    }) => {
      const updated = await liquidacionesApi.update(id, patch);
      if (rows) await liquidacionesApi.replaceRows(id, rows);
      return updated;
    },
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: keys.all });
      void qc.invalidateQueries({ queryKey: keys.one(vars.id) });
      void qc.invalidateQueries({ queryKey: keys.rows(vars.id) });
    },
  });
}

export function useDeleteLiquidacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => liquidacionesApi.remove(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useLinkedVales(liqId: string | undefined) {
  return useQuery({
    queryKey: liqId ? ['liq-vales', liqId] : ['noop-lv'],
    queryFn: () => liquidacionesApi.listLinkedVales(liqId as string),
    enabled: !!liqId,
  });
}

export function useReplaceLinkedVales() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ liqId, valeIds }: { liqId: string; valeIds: string[] }) =>
      liquidacionesApi.replaceLinkedVales(liqId, valeIds),
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: ['liq-vales', vars.liqId] });
      void qc.invalidateQueries({ queryKey: keys.all });
      void qc.invalidateQueries({ queryKey: ['caja_chica_vales'] });
    },
  });
}

export function useUploadLiqComprobante() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => liquidacionesApi.uploadComprobante(id, file),
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: keys.all });
      void qc.invalidateQueries({ queryKey: keys.one(vars.id) });
    },
  });
}

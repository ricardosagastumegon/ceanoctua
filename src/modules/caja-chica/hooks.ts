import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { periodosApi, lineasApi, valeFacturasApi } from './api';
import type {
  Periodo,
  PeriodoInsert,
  PeriodoUpdate,
  Linea,
  LineaInsert,
  LineaUpdate,
  ValeFactura,
  ValeFacturaInsert,
  ValeFacturaUpdate,
} from './types';

const KEYS = {
  periodos: ['cco-periodos'] as const,
  periodo: (id: string) => ['cco-periodo', id] as const,
  lineas: (periodoId: string) => ['cco-lineas', periodoId] as const,
  valeFacturas: (lineaId: string) => ['cco-vale-facturas', lineaId] as const,
  valeFacturasPeriodo: (periodoId: string) => ['cco-vale-facturas-periodo', periodoId] as const,
};

// ---------- Períodos ----------
export function usePeriodos() {
  return useQuery<Periodo[], Error>({ queryKey: KEYS.periodos, queryFn: () => periodosApi.list() });
}

export function usePeriodo(id: string | null | undefined) {
  return useQuery<Periodo, Error>({
    queryKey: KEYS.periodo(id ?? ''),
    queryFn: () => periodosApi.get(id!),
    enabled: !!id,
  });
}

export function useCreatePeriodo() {
  const qc = useQueryClient();
  return useMutation<Periodo, Error, PeriodoInsert>({
    mutationFn: (input) => periodosApi.create(input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEYS.periodos }),
  });
}

export function useUpdatePeriodo() {
  const qc = useQueryClient();
  return useMutation<Periodo, Error, { id: string; patch: PeriodoUpdate }>({
    mutationFn: ({ id, patch }) => periodosApi.update(id, patch),
    onSuccess: (row) => {
      void qc.invalidateQueries({ queryKey: KEYS.periodos });
      void qc.invalidateQueries({ queryKey: KEYS.periodo(row.id) });
    },
  });
}

export function useDeletePeriodo() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => periodosApi.remove(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEYS.periodos }),
  });
}

// ---------- Líneas ----------
export function useLineas(periodoId: string | null | undefined) {
  return useQuery<Linea[], Error>({
    queryKey: KEYS.lineas(periodoId ?? ''),
    queryFn: () => lineasApi.listByPeriodo(periodoId!),
    enabled: !!periodoId,
  });
}

export function useCreateLinea() {
  const qc = useQueryClient();
  return useMutation<Linea, Error, LineaInsert>({
    mutationFn: (input) => lineasApi.create(input),
    onSuccess: (row) => void qc.invalidateQueries({ queryKey: KEYS.lineas(row.periodo_id) }),
  });
}

export function useUpdateLinea(periodoId: string) {
  const qc = useQueryClient();
  return useMutation<Linea, Error, { id: string; patch: LineaUpdate }>({
    mutationFn: ({ id, patch }) => lineasApi.update(id, patch),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEYS.lineas(periodoId) }),
  });
}

export function useDeleteLinea(periodoId: string) {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => lineasApi.remove(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEYS.lineas(periodoId) }),
  });
}

// ---------- Sub-facturas de vale ----------
export function useValeFacturas(lineaId: string | null | undefined) {
  return useQuery<ValeFactura[], Error>({
    queryKey: KEYS.valeFacturas(lineaId ?? ''),
    queryFn: () => valeFacturasApi.listByLinea(lineaId!),
    enabled: !!lineaId,
  });
}

export function useValeFacturasByPeriodo(periodoId: string | null | undefined) {
  return useQuery<ValeFactura[], Error>({
    queryKey: KEYS.valeFacturasPeriodo(periodoId ?? ''),
    queryFn: () => valeFacturasApi.listByPeriodo(periodoId!),
    enabled: !!periodoId,
  });
}

export function useCreateValeFactura(lineaId: string, periodoId: string) {
  const qc = useQueryClient();
  return useMutation<ValeFactura, Error, ValeFacturaInsert>({
    mutationFn: (input) => valeFacturasApi.create(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEYS.valeFacturas(lineaId) });
      void qc.invalidateQueries({ queryKey: KEYS.valeFacturasPeriodo(periodoId) });
    },
  });
}

export function useUpdateValeFactura(lineaId: string, periodoId: string) {
  const qc = useQueryClient();
  return useMutation<ValeFactura, Error, { id: string; patch: ValeFacturaUpdate }>({
    mutationFn: ({ id, patch }) => valeFacturasApi.update(id, patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEYS.valeFacturas(lineaId) });
      void qc.invalidateQueries({ queryKey: KEYS.valeFacturasPeriodo(periodoId) });
    },
  });
}

export function useDeleteValeFactura(lineaId: string, periodoId: string) {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => valeFacturasApi.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEYS.valeFacturas(lineaId) });
      void qc.invalidateQueries({ queryKey: KEYS.valeFacturasPeriodo(periodoId) });
    },
  });
}

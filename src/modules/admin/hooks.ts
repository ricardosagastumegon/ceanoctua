import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  autorizadoresApi,
  empleadosApi,
  entidadesApi,
  proveedoresApi,
  tarjetasApi,
  tiposPagoApi,
  type AutorizadorInsert,
  type AutorizadorUpdate,
  type EmpleadoInsert,
  type EmpleadoUpdate,
  type EntidadInsert,
  type EntidadUpdate,
  type ProveedorInsert,
  type ProveedorUpdate,
  type TarjetaInsert,
  type TarjetaUpdate,
  type TipoPagoInsert,
  type TipoPagoUpdate,
} from './api';

// Query key factories — jerárquicas para invalidación precisa.
export const adminKeys = {
  entidades: ['entidades'] as const,
  autorizadores: ['autorizadores'] as const,
  empleados: ['empleados'] as const,
  tiposPago: ['tipos_pago'] as const,
  proveedores: ['proveedores'] as const,
  tarjetas: ['tarjetas_credito'] as const,
};

// Error helpers ----------------------------------------------------------
// Postgres SQLSTATE 23503 = foreign_key_violation (registro en uso por FK).
export function isForeignKeyError(error: unknown): boolean {
  if (!error) return false;
  const code = (error as { code?: string }).code;
  return code === '23503';
}

export function describeError(error: unknown, action?: 'delete'): string {
  if (isForeignKeyError(error) && action === 'delete') {
    return 'No se puede eliminar: este registro está siendo usado por otros datos.';
  }
  if (!error) return 'Error desconocido.';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  const m = (error as { message?: string }).message;
  return m ?? 'Error desconocido.';
}

// Entidades --------------------------------------------------------------
export function useEntidades() {
  return useQuery({ queryKey: adminKeys.entidades, queryFn: () => entidadesApi.list() });
}
export function useCreateEntidad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: EntidadInsert) => entidadesApi.create(input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: adminKeys.entidades }),
  });
}
export function useUpdateEntidad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: EntidadUpdate }) =>
      entidadesApi.update(id, patch),
    onSuccess: () => void qc.invalidateQueries({ queryKey: adminKeys.entidades }),
  });
}
export function useDeleteEntidad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => entidadesApi.remove(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: adminKeys.entidades }),
  });
}

export function useEntidadesRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel('public:entidades')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'entidades' }, () => {
        void qc.invalidateQueries({ queryKey: adminKeys.entidades });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc]);
}

// Autorizadores ----------------------------------------------------------
export function useAutorizadores() {
  return useQuery({ queryKey: adminKeys.autorizadores, queryFn: () => autorizadoresApi.list() });
}
export function useCreateAutorizador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AutorizadorInsert) => autorizadoresApi.create(input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: adminKeys.autorizadores }),
  });
}
export function useUpdateAutorizador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: AutorizadorUpdate }) =>
      autorizadoresApi.update(id, patch),
    onSuccess: () => void qc.invalidateQueries({ queryKey: adminKeys.autorizadores }),
  });
}
export function useDeleteAutorizador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => autorizadoresApi.remove(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: adminKeys.autorizadores }),
  });
}

// Empleados --------------------------------------------------------------
export function useEmpleados() {
  return useQuery({ queryKey: adminKeys.empleados, queryFn: () => empleadosApi.list() });
}
export function useCreateEmpleado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: EmpleadoInsert) => empleadosApi.create(input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: adminKeys.empleados }),
  });
}
export function useUpdateEmpleado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: EmpleadoUpdate }) =>
      empleadosApi.update(id, patch),
    onSuccess: () => void qc.invalidateQueries({ queryKey: adminKeys.empleados }),
  });
}
export function useDeleteEmpleado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => empleadosApi.remove(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: adminKeys.empleados }),
  });
}

// Tipos de pago ----------------------------------------------------------
export function useTiposPago() {
  return useQuery({ queryKey: adminKeys.tiposPago, queryFn: () => tiposPagoApi.list() });
}
export function useCreateTipoPago() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TipoPagoInsert) => tiposPagoApi.create(input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: adminKeys.tiposPago }),
  });
}
export function useUpdateTipoPago() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: TipoPagoUpdate }) =>
      tiposPagoApi.update(id, patch),
    onSuccess: () => void qc.invalidateQueries({ queryKey: adminKeys.tiposPago }),
  });
}
export function useDeleteTipoPago() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tiposPagoApi.remove(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: adminKeys.tiposPago }),
  });
}

// Proveedores ------------------------------------------------------------
export function useProveedores() {
  return useQuery({ queryKey: adminKeys.proveedores, queryFn: () => proveedoresApi.list() });
}
export function useCreateProveedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ProveedorInsert) => proveedoresApi.create(input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: adminKeys.proveedores }),
  });
}
export function useUpdateProveedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ProveedorUpdate }) =>
      proveedoresApi.update(id, patch),
    onSuccess: () => void qc.invalidateQueries({ queryKey: adminKeys.proveedores }),
  });
}
export function useDeleteProveedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => proveedoresApi.remove(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: adminKeys.proveedores }),
  });
}

// Tarjetas de crédito ----------------------------------------------------
export function useTarjetas() {
  return useQuery({ queryKey: adminKeys.tarjetas, queryFn: () => tarjetasApi.list() });
}
export function useCreateTarjeta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TarjetaInsert) => tarjetasApi.create(input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: adminKeys.tarjetas }),
  });
}
export function useUpdateTarjeta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: TarjetaUpdate }) =>
      tarjetasApi.update(id, patch),
    onSuccess: () => void qc.invalidateQueries({ queryKey: adminKeys.tarjetas }),
  });
}
export function useDeleteTarjeta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tarjetasApi.remove(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: adminKeys.tarjetas }),
  });
}

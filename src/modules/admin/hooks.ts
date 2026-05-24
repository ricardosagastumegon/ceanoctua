import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { createCrudHooks } from '@/lib/createCrudHooks';
import {
  autorizadoresApi,
  empleadosApi,
  entidadesApi,
  proveedoresApi,
  tarjetasApi,
  tiposPagoApi,
} from './api';

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

// --------------------------------------------------------------------
// CRUD hooks via factory — same signatures as before, ~150 lines less.
// --------------------------------------------------------------------
const entidades = createCrudHooks('entidades', entidadesApi);
const autorizadores = createCrudHooks('autorizadores', autorizadoresApi);
const empleados = createCrudHooks('empleados', empleadosApi);
const tiposPago = createCrudHooks('tipos_pago', tiposPagoApi);
const proveedores = createCrudHooks('proveedores', proveedoresApi);
const tarjetas = createCrudHooks('tarjetas_credito', tarjetasApi);

export const adminKeys = {
  entidades: entidades.queryKey,
  autorizadores: autorizadores.queryKey,
  empleados: empleados.queryKey,
  tiposPago: tiposPago.queryKey,
  proveedores: proveedores.queryKey,
  tarjetas: tarjetas.queryKey,
};

// Entidades
export const useEntidades = entidades.useList;
export const useCreateEntidad = entidades.useCreate;
export const useUpdateEntidad = entidades.useUpdate;
export const useDeleteEntidad = entidades.useDelete;

// Autorizadores
export const useAutorizadores = autorizadores.useList;
export const useCreateAutorizador = autorizadores.useCreate;
export const useUpdateAutorizador = autorizadores.useUpdate;
export const useDeleteAutorizador = autorizadores.useDelete;

// Empleados
export const useEmpleados = empleados.useList;
export const useCreateEmpleado = empleados.useCreate;
export const useUpdateEmpleado = empleados.useUpdate;
export const useDeleteEmpleado = empleados.useDelete;

// Tipos de pago
export const useTiposPago = tiposPago.useList;
export const useCreateTipoPago = tiposPago.useCreate;
export const useUpdateTipoPago = tiposPago.useUpdate;
export const useDeleteTipoPago = tiposPago.useDelete;

// Proveedores
export const useProveedores = proveedores.useList;
export const useCreateProveedor = proveedores.useCreate;
export const useUpdateProveedor = proveedores.useUpdate;
export const useDeleteProveedor = proveedores.useDelete;

// Tarjetas de crédito
export const useTarjetas = tarjetas.useList;
export const useCreateTarjeta = tarjetas.useCreate;
export const useUpdateTarjeta = tarjetas.useUpdate;
export const useDeleteTarjeta = tarjetas.useDelete;

// --------------------------------------------------------------------
// Optional realtime subscription for entidades (kept explicit).
// --------------------------------------------------------------------
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

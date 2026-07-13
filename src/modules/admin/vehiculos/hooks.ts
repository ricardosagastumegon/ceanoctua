import { createCrudHooks } from '@/lib/createCrudHooks';
import { vehiculosApi, type Vehiculo, type VehiculoInsert, type VehiculoUpdate } from './api';

// Fase 18 · Hooks del catálogo Vehículos.
// Se genera vía createCrudHooks (factory de src/lib/createCrudHooks.ts)
// para mantener el pattern de status_solicitud_pago / personas / etc.

const vehiculos = createCrudHooks<Vehiculo, VehiculoInsert, VehiculoUpdate>(
  'vehiculos',
  vehiculosApi,
);

export const useVehiculos = vehiculos.useList;
export const useCreateVehiculo = vehiculos.useCreate;
export const useUpdateVehiculo = vehiculos.useUpdate;
export const useDeleteVehiculo = vehiculos.useDelete;

import { createCrudHooks } from '@/lib/createCrudHooks';
import { consumosApi } from './api';

const h = createCrudHooks('tc_consumos', consumosApi);

export const useConsumos = h.useList;
export const useCreateConsumo = h.useCreate;
export const useUpdateConsumo = h.useUpdate;
export const useDeleteConsumo = h.useDelete;

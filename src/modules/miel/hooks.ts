import { createCrudHooks } from '@/lib/createCrudHooks';
import { mielApi } from './api';

const h = createCrudHooks('miel_constancias', mielApi);

export const useConstancias = h.useList;
export const useCreateConstancia = h.useCreate;
export const useUpdateConstancia = h.useUpdate;
export const useDeleteConstancia = h.useDelete;

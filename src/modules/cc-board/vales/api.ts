import { supabase } from '@/lib/supabase';
import { stripServerGenerated } from '@/lib/createCrudHooks';
import type { Database } from '@/types/database';

export type Vale = Database['public']['Tables']['caja_chica_vales']['Row'];
export type ValeInsert = Database['public']['Tables']['caja_chica_vales']['Insert'];
export type ValeUpdate = Database['public']['Tables']['caja_chica_vales']['Update'];

export const valesApi = {
  async list(): Promise<Vale[]> {
    const { data, error } = await supabase
      .from('caja_chica_vales')
      .select('*')
      .is('deleted_at', null)
      .order('fecha', { ascending: false, nullsFirst: false })
      .order('serial', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
  async create(input: ValeInsert): Promise<Vale> {
    const payload = stripServerGenerated(input, ['serial']);
    const { data, error } = await supabase.from('caja_chica_vales').insert(payload).select('*').single();
    if (error) throw error;
    return data;
  },
  async update(id: string, patch: ValeUpdate): Promise<Vale> {
    const { data, error } = await supabase.from('caja_chica_vales').update(patch).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  },
  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from('caja_chica_vales')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },
  // assignToLiquidacion fue deprecada en Fase 17 · F-2 — el vínculo
  // ahora vive en `liquidacion_vales` (M:N). El estado del vale lo
  // actualiza el trigger SQL `mark_vale_as_assigned`.
};

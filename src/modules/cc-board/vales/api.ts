import { supabase } from '@/lib/supabase';
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
    const { serial: _ignored, ...rest } = input;
    void _ignored;
    const { data, error } = await supabase.from('caja_chica_vales').insert(rest).select('*').single();
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
  async assignToLiquidacion(valeId: string, liquidacionId: string | null): Promise<void> {
    const patch: ValeUpdate = {
      liquidacion_id: liquidacionId,
      estado: liquidacionId ? 'EnLiquidacion' : 'Aprobado',
    };
    const { error } = await supabase.from('caja_chica_vales').update(patch).eq('id', valeId);
    if (error) throw error;
  },
};

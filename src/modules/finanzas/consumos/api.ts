import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type Consumo = Database['public']['Tables']['tc_consumos']['Row'];
export type ConsumoInsert = Database['public']['Tables']['tc_consumos']['Insert'];
export type ConsumoUpdate = Database['public']['Tables']['tc_consumos']['Update'];

export const consumosApi = {
  async list(): Promise<Consumo[]> {
    const { data, error } = await supabase
      .from('tc_consumos')
      .select('*')
      .is('deleted_at', null)
      .order('fecha', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
  async create(input: ConsumoInsert): Promise<Consumo> {
    const { voucher_num: _ignored, ...rest } = input;
    void _ignored;
    const { data, error } = await supabase.from('tc_consumos').insert(rest).select('*').single();
    if (error) throw error;
    return data;
  },
  async update(id: string, patch: ConsumoUpdate): Promise<Consumo> {
    const { data, error } = await supabase.from('tc_consumos').update(patch).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  },
  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('tc_consumos').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
  },
};

import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type Liquidacion = Database['public']['Tables']['caja_chica_liquidaciones']['Row'];
export type LiquidacionInsert = Database['public']['Tables']['caja_chica_liquidaciones']['Insert'];
export type LiquidacionUpdate = Database['public']['Tables']['caja_chica_liquidaciones']['Update'];

export const liquidacionesApi = {
  async list(): Promise<Liquidacion[]> {
    const { data, error } = await supabase
      .from('caja_chica_liquidaciones')
      .select('*')
      .is('deleted_at', null)
      .order('fecha', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
  async create(input: LiquidacionInsert): Promise<Liquidacion> {
    const { data, error } = await supabase.from('caja_chica_liquidaciones').insert(input).select('*').single();
    if (error) throw error;
    return data;
  },
  async update(id: string, patch: LiquidacionUpdate): Promise<Liquidacion> {
    const { data, error } = await supabase
      .from('caja_chica_liquidaciones')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },
  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from('caja_chica_liquidaciones')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },
  async listValesByLiquidacion(liqId: string) {
    const { data, error } = await supabase
      .from('caja_chica_vales')
      .select('id, serial, fecha, vale_a, concepto, monto, moneda, estado')
      .eq('liquidacion_id', liqId)
      .is('deleted_at', null)
      .order('fecha');
    if (error) throw error;
    return data ?? [];
  },
};

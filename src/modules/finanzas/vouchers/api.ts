import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type Voucher = Database['public']['Tables']['vouchers']['Row'];
export type VoucherInsert = Database['public']['Tables']['vouchers']['Insert'];
export type VoucherUpdate = Database['public']['Tables']['vouchers']['Update'];

export const vouchersApi = {
  async list(): Promise<Voucher[]> {
    const { data, error } = await supabase
      .from('vouchers')
      .select('*')
      .is('deleted_at', null)
      .order('fecha', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
  async create(input: VoucherInsert): Promise<Voucher> {
    const { data, error } = await supabase.from('vouchers').insert(input).select('*').single();
    if (error) throw error;
    return data;
  },
  async update(id: string, patch: VoucherUpdate): Promise<Voucher> {
    const { data, error } = await supabase.from('vouchers').update(patch).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  },
  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('vouchers').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
  },
};

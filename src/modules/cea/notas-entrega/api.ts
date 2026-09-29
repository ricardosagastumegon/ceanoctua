// CEA · Notas de entrega de documentos.
//
// La constancia de que unos documentos se entregaron. El correlativo lo pone
// la base --`NED-AAAA-####`-- así que nunca se manda desde acá.

import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type NotaEntrega = Database['public']['Tables']['cea_notas_entrega']['Row'];
export type NotaEntregaInsert = Database['public']['Tables']['cea_notas_entrega']['Insert'];
export type NotaEntregaUpdate = Database['public']['Tables']['cea_notas_entrega']['Update'];

export const notasEntregaApi = {
  async list(): Promise<NotaEntrega[]> {
    const { data, error } = await supabase
      .from('cea_notas_entrega')
      .select('*')
      .is('deleted_at', null)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async create(input: NotaEntregaInsert): Promise<NotaEntrega> {
    const { data, error } = await supabase
      .from('cea_notas_entrega').insert(input).select('*').single();
    if (error) throw error;
    return data;
  },

  async update(id: string, patch: NotaEntregaUpdate): Promise<void> {
    const { error } = await supabase.from('cea_notas_entrega').update(patch).eq('id', id);
    if (error) throw error;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from('cea_notas_entrega')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },
};

import { supabase } from '@/lib/supabase';
import { stripServerGenerated } from '@/lib/createCrudHooks';
import type { Database } from '@/types/database';

export type Liquidacion = Database['public']['Tables']['caja_chica_liquidaciones']['Row'];
export type LiquidacionInsert = Database['public']['Tables']['caja_chica_liquidaciones']['Insert'];
export type LiquidacionUpdate = Database['public']['Tables']['caja_chica_liquidaciones']['Update'];

export type LiqRow = Database['public']['Tables']['caja_chica_liq_rows']['Row'];
export type LiqRowInsert = Database['public']['Tables']['caja_chica_liq_rows']['Insert'];

export type LiquidacionFull = Liquidacion & { rows: LiqRow[] };

export const LIQ_ESTADOS = ['Generada', 'Autorizada', 'Presentada', 'Procesada', 'Pagada'] as const;
export const PAYMENT_METHODS = [
  'Efectivo',
  'Transferencia',
  'TC',
  'Crédito',
  'Solicitud de Pago',
  'Caja Chica',
] as const;

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

  async listRows(liqId: string): Promise<LiqRow[]> {
    const { data, error } = await supabase
      .from('caja_chica_liq_rows')
      .select('*')
      .eq('liquidacion_id', liqId)
      .order('orden', { ascending: true, nullsFirst: false })
      .order('created_at');
    if (error) throw error;
    return data ?? [];
  },

  async get(id: string): Promise<LiquidacionFull | null> {
    const [liq, rows] = await Promise.all([
      supabase.from('caja_chica_liquidaciones').select('*').eq('id', id).maybeSingle(),
      this.listRows(id),
    ]);
    if (liq.error) throw liq.error;
    if (!liq.data) return null;
    return { ...liq.data, rows };
  },

  async create(input: LiquidacionInsert): Promise<Liquidacion> {
    const payload = stripServerGenerated(input, ['serial']);
    const { data, error } = await supabase
      .from('caja_chica_liquidaciones')
      .insert(payload)
      .select('*')
      .single();
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

  // Replace all rows for a liquidacion atomically-ish (delete + insert).
  async replaceRows(liqId: string, rows: Omit<LiqRowInsert, 'liquidacion_id'>[]): Promise<LiqRow[]> {
    const del = await supabase.from('caja_chica_liq_rows').delete().eq('liquidacion_id', liqId);
    if (del.error) throw del.error;
    if (rows.length === 0) return [];
    const payload = rows.map((r, idx) => ({ ...r, liquidacion_id: liqId, orden: idx + 1 }));
    const { data, error } = await supabase.from('caja_chica_liq_rows').insert(payload).select('*');
    if (error) throw error;
    return data ?? [];
  },

  // Fase 17 · F-2: multi-vale via junction `liquidacion_vales`
  async listLinkedVales(liqId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('liquidacion_vales')
      .select('vale_id')
      .eq('liquidacion_id', liqId);
    if (error) throw error;
    return (data ?? []).map((r) => r.vale_id as string);
  },
  async replaceLinkedVales(liqId: string, valeIds: string[]): Promise<void> {
    const current = await this.listLinkedVales(liqId);
    const desired = new Set(valeIds);
    const currentSet = new Set(current);
    const toAdd = valeIds.filter((id) => !currentSet.has(id));
    const toRemove = current.filter((id) => !desired.has(id));
    if (toRemove.length > 0) {
      const { error } = await supabase
        .from('liquidacion_vales')
        .delete()
        .eq('liquidacion_id', liqId)
        .in('vale_id', toRemove);
      if (error) throw error;
    }
    if (toAdd.length > 0) {
      const payload = toAdd.map((vale_id) => ({ liquidacion_id: liqId, vale_id }));
      const { error } = await supabase.from('liquidacion_vales').insert(payload);
      if (error) throw error;
    }
  },

  async uploadComprobante(liqId: string, file: File): Promise<string> {
    const ext = file.name.split('.').pop() ?? 'bin';
    const path = `cc-board/liquidaciones/${liqId}.${Date.now()}.${ext}`;
    const up = await supabase.storage.from('documentos').upload(path, file, { upsert: true });
    if (up.error) throw up.error;
    await this.update(liqId, { comprobante_storage_path: path });
    return path;
  },
};

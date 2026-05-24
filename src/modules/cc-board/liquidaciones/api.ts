import { supabase } from '@/lib/supabase';
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
    const { serial: _ignored, ...rest } = input as { serial?: string | null } & LiquidacionInsert;
    void _ignored;
    const { data, error } = await supabase
      .from('caja_chica_liquidaciones')
      .insert(rest)
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

  async uploadComprobante(liqId: string, file: File): Promise<string> {
    const ext = file.name.split('.').pop() ?? 'bin';
    const path = `cc-board/liquidaciones/${liqId}.${Date.now()}.${ext}`;
    const up = await supabase.storage.from('documentos').upload(path, file, { upsert: true });
    if (up.error) throw up.error;
    await this.update(liqId, { comprobante_storage_path: path });
    return path;
  },
};

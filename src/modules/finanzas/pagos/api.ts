import { supabase } from '@/lib/supabase';
import { stripServerGenerated } from '@/lib/createCrudHooks';
import type { Database } from '@/types/database';

export type Pago = Database['public']['Tables']['pagos']['Row'];
export type PagoInsert = Database['public']['Tables']['pagos']['Insert'];
export type PagoUpdate = Database['public']['Tables']['pagos']['Update'];

export const PAGO_STEPS = [
  'Generado',
  'En Solicitud de Firma',
  'Firmado',
  'Presentado',
  'Procesado',
  'Pagado',
] as const;

export const PAGO_TIPO_LABELS = [
  'Anticipo Sin Factura',
  'Anticipo Con Factura',
  'Pago de Contado',
  'TC-Reintegro',
  'Transferencia Internacional',
  'Impuestos',
  'Crédito 8 días',
  'Crédito 15 días',
  'Crédito 30 días',
  'Otros',
] as const;

export const PAGO_TIPO_COLORS: Record<string, { fg: string; bg: string }> = {
  'Anticipo Sin Factura': { fg: '#9333ea', bg: '#f3e8ff' },
  'Anticipo Con Factura': { fg: '#7c3aed', bg: '#ede9fe' },
  'Pago de Contado': { fg: '#0284c7', bg: '#e0f2fe' },
  'TC-Reintegro': { fg: '#0891b2', bg: '#cffafe' },
  'Transferencia Internacional': { fg: '#0d9488', bg: '#ccfbf1' },
  Impuestos: { fg: '#dc2626', bg: '#fee2e2' },
  'Crédito 8 días': { fg: '#d97706', bg: '#fef3c7' },
  'Crédito 15 días': { fg: '#ea580c', bg: '#ffedd5' },
  'Crédito 30 días': { fg: '#b45309', bg: '#fef9c3' },
  Otros: { fg: '#6b7280', bg: '#f3f4f6' },
};

export const pagosApi = {
  async list(): Promise<Pago[]> {
    const { data, error } = await supabase
      .from('pagos')
      .select('*')
      .is('deleted_at', null)
      .order('fecha', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
  async create(input: PagoInsert): Promise<Pago> {
    const payload = stripServerGenerated(input, ['serial']);
    const { data, error } = await supabase.from('pagos').insert(payload).select('*').single();
    if (error) throw error;
    return data;
  },
  async update(id: string, patch: PagoUpdate): Promise<Pago> {
    const { data, error } = await supabase.from('pagos').update(patch).eq('id', id).select('*').single();
    if (error) throw error;
    return data;
  },
  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('pagos').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
  },
  async advanceStep(id: string, current: Pago): Promise<Pago> {
    if (current.step_idx >= PAGO_STEPS.length - 1) return current;
    const next = current.step_idx + 1;
    const dates = [...(current.step_dates ?? [])];
    dates[next] = new Date().toISOString().slice(0, 10);
    const patch: PagoUpdate = { step_idx: next, step_dates: dates };
    if (next === PAGO_STEPS.length - 1) patch.estado = 'Pagado';
    return this.update(id, patch);
  },
  async uploadComprobante(id: string, file: File): Promise<string> {
    const ext = file.name.split('.').pop() ?? 'bin';
    const path = `finanzas/pagos/${id}.${Date.now()}.${ext}`;
    const up = await supabase.storage.from('documentos').upload(path, file, { upsert: true });
    if (up.error) throw up.error;
    await this.update(id, { comprobante_storage_path: path });
    return path;
  },
};

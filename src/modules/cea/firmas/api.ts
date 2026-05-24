import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type Firma = Database['public']['Tables']['firmas']['Row'];
export type FirmaInsert = Database['public']['Tables']['firmas']['Insert'];
export type FirmaUpdate = Database['public']['Tables']['firmas']['Update'];

export type FirmaWithSigners = Firma & { miembro_ids: string[] };

async function loadSigners(firmaIds: string[]): Promise<Record<string, string[]>> {
  if (firmaIds.length === 0) return {};
  const { data, error } = await supabase
    .from('firma_miembros')
    .select('firma_id, miembro_id')
    .in('firma_id', firmaIds);
  if (error) throw error;
  const map: Record<string, string[]> = {};
  for (const row of data ?? []) {
    const fid = row.firma_id as string;
    const mid = row.miembro_id as string;
    if (!map[fid]) map[fid] = [];
    map[fid].push(mid);
  }
  return map;
}

async function syncSigners(firmaId: string, desired: string[]): Promise<void> {
  const { data: current, error } = await supabase
    .from('firma_miembros')
    .select('miembro_id')
    .eq('firma_id', firmaId);
  if (error) throw error;
  const currentSet = new Set((current ?? []).map((r) => r.miembro_id as string));
  const desiredSet = new Set(desired);

  const toAdd = [...desiredSet].filter((id) => !currentSet.has(id));
  const toRemove = [...currentSet].filter((id) => !desiredSet.has(id));

  if (toAdd.length > 0) {
    const { error: addErr } = await supabase
      .from('firma_miembros')
      .insert(toAdd.map((mid) => ({ firma_id: firmaId, miembro_id: mid })));
    if (addErr) throw addErr;
  }
  if (toRemove.length > 0) {
    const { error: delErr } = await supabase
      .from('firma_miembros')
      .delete()
      .eq('firma_id', firmaId)
      .in('miembro_id', toRemove);
    if (delErr) throw delErr;
  }
}

export const firmasApi = {
  async list(): Promise<FirmaWithSigners[]> {
    const { data, error } = await supabase
      .from('firmas')
      .select('*')
      .is('deleted_at', null)
      .order('recepcion', { ascending: false, nullsFirst: false });
    if (error) throw error;
    const rows = data ?? [];
    const signers = await loadSigners(rows.map((r) => r.id));
    return rows.map((r) => ({ ...r, miembro_ids: signers[r.id] ?? [] }));
  },

  async create(input: FirmaInsert, miembroIds: string[]): Promise<Firma> {
    const { data, error } = await supabase.from('firmas').insert(input).select('*').single();
    if (error) throw error;
    if (miembroIds.length > 0) {
      await syncSigners(data.id, miembroIds);
    }
    return data;
  },

  async update(id: string, patch: FirmaUpdate, miembroIds: string[]): Promise<Firma> {
    const { data, error } = await supabase.from('firmas').update(patch).eq('id', id).select('*').single();
    if (error) throw error;
    await syncSigners(id, miembroIds);
    return data;
  },

  async remove(id: string): Promise<void> {
    // Soft delete to keep audit trail consistent
    const { error } = await supabase.from('firmas').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
  },
};

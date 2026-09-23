// Fase 22 · renta de vehículo.
//
// A diferencia de ticket, hotel y restaurante, aquí los extras no viven en una
// tabla hija sino en la columna JSONB `extras` — decisión de la Fase 19 para
// los servicios cuyos extras son solo etiqueta y monto. Por eso no hace falta
// reconciliar hijos: se guarda todo con el propio registro.

import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type AttRenta = Database['public']['Tables']['att_rentas']['Row'];
export type AttRentaInsert = Database['public']['Tables']['att_rentas']['Insert'];

export type ExtraInput = { label: string; amount: string };

export const TRANSMISIONES = ['Mecánico', 'Automático'] as const;
export const COMBUSTIBLES = ['Gasolina', 'Eléctrico', 'Híbrido'] as const;

const num = (v: string | number | null | undefined): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Días entre recepción y entrega. 0 si falta alguna o están al revés. */
export function diasEntre(recepcion: string, entrega: string): number {
  if (!recepcion || !entrega) return 0;
  const ms = new Date(entrega).getTime() - new Date(recepcion).getTime();
  const dias = Math.round(ms / 86_400_000);
  return dias > 0 ? dias : 0;
}

/**
 * Total de la reserva: tarifa por día × días, más el depósito de seguridad y
 * todos los extras, tal como lo define el documento.
 */
export function totalRenta(
  tarifa: string,
  dias: string,
  deposito: string,
  extras: ExtraInput[],
): number {
  return (
    num(tarifa) * num(dias) +
    num(deposito) +
    extras.reduce((s, e) => s + num(e.amount), 0)
  );
}

/** `extras` viene de JSONB, así que hay que validarlo antes de confiar en él. */
export function leerExtras(valor: unknown): ExtraInput[] {
  if (!Array.isArray(valor)) return [];
  return valor
    .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
    .map((x) => ({
      label: typeof x.label === 'string' ? x.label : '',
      amount: x.amount != null ? String(x.amount) : '',
    }));
}

export async function subirConfirmacionRenta(id: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'pdf';
  const path = `rentas/${id}/confirmacion.${Date.now()}.${ext}`;
  const up = await supabase.storage.from('tt-documentos').upload(path, file, { upsert: true });
  if (up.error) throw up.error;
  const { error } = await supabase
    .from('att_rentas')
    .update({ confirmacion_path: path })
    .eq('id', id);
  if (error) throw error;
  return path;
}

export const rentaFullApi = {
  async load(id: string): Promise<AttRenta | null> {
    const { data, error } = await supabase
      .from('att_rentas').select('*').eq('id', id).is('deleted_at', null).maybeSingle();
    if (error) throw error;
    return data;
  },

  async save(input: { id?: string; cabecera: AttRentaInsert }): Promise<string> {
    if (input.id) {
      const patch = { ...input.cabecera } as Record<string, unknown>;
      for (const k of ['id', 'viaje_id', 'created_at', 'created_by']) delete patch[k];
      const { error } = await supabase
        .from('att_rentas')
        .update(patch as Database['public']['Tables']['att_rentas']['Update'])
        .eq('id', input.id);
      if (error) throw error;
      return input.id;
    }
    const { data, error } = await supabase
      .from('att_rentas').insert(input.cabecera).select('id').single();
    if (error) throw error;
    return data.id;
  },
};

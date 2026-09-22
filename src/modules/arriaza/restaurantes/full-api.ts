// Fase 22 · el restaurante completo: comensales, servicios adicionales y pagos.
//
// Mismo patrón que ticket y hotel: `load` trae el árbol y `save` lo reconcilia.
// Las tres sub-tablas ya existían desde la Fase 13 y son justo las que pide el
// documento, así que aquí solo se les puso encima la captura de una pasada.

import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type AttRestaurante = Database['public']['Tables']['att_restaurantes']['Row'];
export type AttRestauranteInsert = Database['public']['Tables']['att_restaurantes']['Insert'];

export type ComensalInput = { id?: string; nombre: string; notas: string };
export type ServicioInput = { id?: string; nombre: string; monto: string };
/** Un registro de pago. Hay varios cuando la reserva se modifica y se recobra. */
export type PagoInput = {
  id?: string;
  tc_id: string;
  titular: string;
  autorizado_por: string;
  monto: string;
};

export type RestauranteCompleto = {
  restaurante: AttRestaurante | null;
  comensales: ComensalInput[];
  servicios: ServicioInput[];
  pagos: PagoInput[];
};

const ORDEN = { ascending: true, nullsFirst: true } as const;

const num = (v: string): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Precio total de la reserva: tarifa por persona × número de comensales. */
export function totalReserva(tarifaPax: string, comensales: string): number {
  return num(tarifaPax) * num(comensales);
}

/** Total de la reserva más todos los servicios adicionales. */
export function totalConServicios(
  tarifaPax: string,
  comensales: string,
  servicios: ServicioInput[],
): number {
  return totalReserva(tarifaPax, comensales) + servicios.reduce((s, x) => s + num(x.monto), 0);
}

/**
 * Días que faltan para la fecha límite de cancelación gratuita.
 * Negativo si ya pasó, null si no aplica. La UI avisa cuando se acerca.
 */
export function diasParaCancelar(fechaLimite: string | null | undefined): number | null {
  if (!fechaLimite) return null;
  const [y, m, d] = fechaLimite.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  const limite = new Date(y, m - 1, d);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.round((limite.getTime() - hoy.getTime()) / 86_400_000);
}

export async function subirConfirmacionRestaurante(id: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'pdf';
  const path = `restaurantes/${id}/confirmacion.${Date.now()}.${ext}`;
  const up = await supabase.storage.from('tt-documentos').upload(path, file, { upsert: true });
  if (up.error) throw up.error;
  const { error } = await supabase
    .from('att_restaurantes')
    .update({ confirmacion_path: path })
    .eq('id', id);
  if (error) throw error;
  return path;
}

export const restauranteFullApi = {
  async load(id: string): Promise<RestauranteCompleto> {
    const [rQ, comQ, svcQ, payQ] = await Promise.all([
      supabase.from('att_restaurantes').select('*').eq('id', id).is('deleted_at', null).maybeSingle(),
      supabase.from('att_restaurant_diners').select('*').eq('restaurante_id', id).is('deleted_at', null).order('orden', ORDEN),
      supabase.from('att_restaurant_services').select('*').eq('restaurante_id', id).is('deleted_at', null).order('orden', ORDEN),
      supabase.from('att_restaurant_pay_records').select('*').eq('restaurante_id', id).is('deleted_at', null).order('created_at', ORDEN),
    ]);
    if (rQ.error) throw rQ.error;
    if (comQ.error) throw comQ.error;
    if (svcQ.error) throw svcQ.error;
    if (payQ.error) throw payQ.error;

    return {
      restaurante: rQ.data,
      comensales: (comQ.data ?? []).map((c) => ({
        id: c.id,
        nombre: c.nombre ?? '',
        notas: c.notas ?? '',
      })),
      servicios: (svcQ.data ?? []).map((x) => ({
        id: x.id,
        nombre: x.nombre ?? '',
        monto: x.monto != null ? String(x.monto) : '',
      })),
      pagos: (payQ.data ?? []).map((p) => ({
        id: p.id,
        tc_id: p.tc_id ?? '',
        titular: p.titular ?? '',
        autorizado_por: p.autorizado_por ?? '',
        monto: p.monto != null ? String(p.monto) : '',
      })),
    };
  },

  async save(input: {
    id?: string;
    cabecera: AttRestauranteInsert;
    comensales: ComensalInput[];
    servicios: ServicioInput[];
    pagos: PagoInput[];
  }): Promise<string> {
    let id = input.id;
    if (id) {
      const patch = { ...input.cabecera } as Record<string, unknown>;
      for (const k of ['id', 'viaje_id', 'legacy_id', 'created_at', 'created_by']) delete patch[k];
      const { error } = await supabase
        .from('att_restaurantes')
        .update(patch as Database['public']['Tables']['att_restaurantes']['Update'])
        .eq('id', id);
      if (error) throw error;
    } else {
      const { data, error } = await supabase
        .from('att_restaurantes').insert(input.cabecera).select('id').single();
      if (error) throw error;
      id = data.id;
    }

    await sincronizar('att_restaurant_diners', id, input.comensales, (c, orden) => ({
      nombre: c.nombre.trim(),
      notas: c.notas.trim() || null,
      orden,
    }));
    await sincronizar('att_restaurant_services', id, input.servicios, (x, orden) => ({
      nombre: x.nombre.trim() || null,
      monto: x.monto.trim() === '' ? null : Number(x.monto),
      orden,
    }));
    await sincronizar('att_restaurant_pay_records', id, input.pagos, (p) => ({
      tc_id: p.tc_id.trim() || null,
      titular: p.titular.trim() || null,
      autorizado_por: p.autorizado_por.trim() || null,
      monto: p.monto.trim() === '' ? null : Number(p.monto),
    }));

    return id;
  },
};

type SubTabla =
  | 'att_restaurant_diners'
  | 'att_restaurant_services'
  | 'att_restaurant_pay_records';

async function sincronizar<T extends { id?: string }>(
  tabla: SubTabla,
  padreId: string,
  items: T[],
  campos: (item: T, orden: number) => Record<string, unknown>,
) {
  const vivos = items.map((i) => i.id).filter(Boolean) as string[];
  const q = supabase
    .from(tabla)
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq('restaurante_id', padreId)
    .is('deleted_at', null);
  const { error: delErr } = vivos.length ? await q.not('id', 'in', `(${vivos.join(',')})`) : await q;
  if (delErr) throw delErr;

  for (let i = 0; i < items.length; i++) {
    const valores = campos(items[i], i);
    if (items[i].id) {
      const { error } = await supabase.from(tabla).update(valores as never).eq('id', items[i].id as string);
      if (error) throw error;
    } else {
      const { error } = await supabase.from(tabla).insert({ restaurante_id: padreId, ...valores } as never);
      if (error) throw error;
    }
  }
}

import { supabase } from '@/lib/supabase';
import type {
  Periodo,
  PeriodoInsert,
  PeriodoUpdate,
  Linea,
  LineaInsert,
  LineaUpdate,
  ValeFactura,
  ValeFacturaInsert,
  ValeFacturaUpdate,
} from './types';

// Las tablas caja_chica_op_* aún no están en el Database type generado
// (se agregarán al regenerar types tras aplicar la migración Fase 20).
// Hasta entonces, casteamos supabase a un tipo permisivo solo dentro de
// este módulo — las funciones exportadas siguen tipadas por los types
// locales, garantizando seguridad en la UI.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as { from: (name: string) => any };

const PERIODOS = 'caja_chica_op_periodos';
const LINEAS = 'caja_chica_op_lineas';
const VALE_FACTURAS = 'caja_chica_op_vale_facturas';

export const periodosApi = {
  async list(): Promise<Periodo[]> {
    const { data, error } = await db
      .from(PERIODOS)
      .select('*')
      .is('deleted_at', null)
      .order('fecha', { ascending: false })
      .order('serial', { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as Periodo[];
  },
  async get(id: string): Promise<Periodo> {
    const { data, error } = await db.from(PERIODOS).select('*').eq('id', id).single();
    if (error) throw error;
    return data as unknown as Periodo;
  },
  async create(input: PeriodoInsert): Promise<Periodo> {
    const { data, error } = await db.from(PERIODOS).insert(input).select('*').single();
    if (error) throw error;
    return data as unknown as Periodo;
  },
  async update(id: string, patch: PeriodoUpdate): Promise<Periodo> {
    const { data, error } = await db.from(PERIODOS).update(patch).eq('id', id).select('*').single();
    if (error) throw error;
    return data as unknown as Periodo;
  },
  async remove(id: string): Promise<void> {
    const { error } = await db.from(PERIODOS).update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
  },
};

export const lineasApi = {
  async listByPeriodo(periodoId: string): Promise<Linea[]> {
    const { data, error } = await db
      .from(LINEAS)
      .select('*')
      .eq('periodo_id', periodoId)
      .is('deleted_at', null)
      .order('orden', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []) as unknown as Linea[];
  },
  async create(input: LineaInsert): Promise<Linea> {
    const { data, error } = await db.from(LINEAS).insert(input).select('*').single();
    if (error) throw error;
    return data as unknown as Linea;
  },
  async update(id: string, patch: LineaUpdate): Promise<Linea> {
    const { data, error } = await db.from(LINEAS).update(patch).eq('id', id).select('*').single();
    if (error) throw error;
    return data as unknown as Linea;
  },
  async remove(id: string): Promise<void> {
    const { error } = await db.from(LINEAS).update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
  },
};

export const valeFacturasApi = {
  async listByLinea(lineaId: string): Promise<ValeFactura[]> {
    const { data, error } = await db
      .from(VALE_FACTURAS)
      .select('*')
      .eq('linea_id', lineaId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []) as unknown as ValeFactura[];
  },
  async listByPeriodo(periodoId: string): Promise<ValeFactura[]> {
    // Facturas de todos los vales del período — un solo request para el saldo.
    const { data, error } = await db
      .from(VALE_FACTURAS)
      .select('*, caja_chica_op_lineas!inner(periodo_id)')
      .eq('caja_chica_op_lineas.periodo_id', periodoId)
      .is('deleted_at', null);
    if (error) throw error;
    return (data ?? []) as unknown as ValeFactura[];
  },
  async create(input: ValeFacturaInsert): Promise<ValeFactura> {
    const { data, error } = await db.from(VALE_FACTURAS).insert(input).select('*').single();
    if (error) throw error;
    return data as unknown as ValeFactura;
  },
  async update(id: string, patch: ValeFacturaUpdate): Promise<ValeFactura> {
    const { data, error } = await db.from(VALE_FACTURAS).update(patch).eq('id', id).select('*').single();
    if (error) throw error;
    return data as unknown as ValeFactura;
  },
  async remove(id: string): Promise<void> {
    const { error } = await db.from(VALE_FACTURAS).update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
  },
};

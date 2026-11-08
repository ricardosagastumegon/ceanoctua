import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type Liquidacion = Database['public']['Tables']['avn_liquidaciones']['Row'];
export type LiquidacionInsert = Database['public']['Tables']['avn_liquidaciones']['Insert'];
export type LiquidacionUpdate = Database['public']['Tables']['avn_liquidaciones']['Update'];
export type Gasto = Database['public']['Tables']['avn_liquidacion_gastos']['Row'];
export type GastoInsert = Database['public']['Tables']['avn_liquidacion_gastos']['Insert'];
export type GastoUpdate = Database['public']['Tables']['avn_liquidacion_gastos']['Update'];

/** Lo que se ve en la lista: la liquidación con el nombre de los suyos. */
export type LiquidacionFila = Liquidacion & {
  piloto: string | null;
  matricula: string | null;
  gastos: number;
};

export const CATEGORIAS = [
  'Combustible',
  'Servicios aeroportuarios',
  'Hotel y transporte',
  'Alimentacion',
  'Tramites',
  'Otros',
] as const;
export type Categoria = (typeof CATEGORIAS)[number];

/** Lo que se guarda va sin tildes; lo que se lee, con ellas. */
export const CATEGORIA_LABEL: Record<string, string> = {
  Combustible: 'Combustible',
  'Servicios aeroportuarios': 'Servicios aeroportuarios y trámites de vuelo',
  'Hotel y transporte': 'Hotel y transporte terrestre',
  Alimentacion: 'Alimentación y viáticos',
  Tramites: 'Trámites',
  Otros: 'Otros',
};

export const MEDIOS = ['Tarjeta', 'Efectivo', 'Credito', 'Transferencia'] as const;
export const MEDIO_LABEL: Record<string, string> = {
  Tarjeta: 'Tarjeta',
  Efectivo: 'Efectivo',
  Credito: 'Crédito',
  Transferencia: 'Transferencia',
};

export const ESTADOS = [
  'Borrador', 'Cerrada', 'En revision', 'Revisada', 'Enviada a SP', 'Reembolsada',
] as const;

/** En la base van sin tilde; en pantalla, con ella. */
export const ESTADO_LABEL: Record<string, string> = {
  Borrador: 'Borrador',
  Cerrada: 'Cerrada',
  'En revision': 'En revisión',
  Revisada: 'Revisada',
  'Enviada a SP': 'Enviada a SP',
  Reembolsada: 'Reembolsada',
};

export const ESTADO_COLOR: Record<string, string> = {
  Borrador: 'bg-sand text-dark-2',
  Cerrada: 'bg-gold-light text-gold',
  'En revision': 'bg-rust-l text-rust',
  Revisada: 'bg-teal-l text-teal-d',
  'Enviada a SP': 'bg-purple-l text-purple',
  Reembolsada: 'bg-teal text-white',
};

export const liquidacionesApi = {
  /** Las liquidaciones que alcanza quien pregunta. La RLS ya filtra. */
  async lista(): Promise<LiquidacionFila[]> {
    const { data, error } = await supabase
      .from('avn_liquidaciones')
      .select('*')
      .is('deleted_at', null)
      .order('fecha_inicio', { ascending: false });
    if (error) throw error;
    const filas = data ?? [];
    if (filas.length === 0) return [];

    // Los nombres se resuelven aparte en vez de con un join anidado: el
    // piloto que entra con su usuario NO alcanza la flota entera, y un
    // `select` con embed falla completo si una de las dos tablas se le
    // niega. Así, si no puede leer la matrícula, pierde la matrícula y no
    // la liquidación.
    const [pil, aer, cnt] = await Promise.all([
      supabase.from('avn_pilotos').select('id, nombre').is('deleted_at', null),
      supabase.from('avn_aeronaves').select('id, matricula'),
      supabase.from('avn_liquidacion_gastos').select('liquidacion_id'),
    ]);

    const nombre = new Map((pil.data ?? []).map((p) => [p.id, p.nombre]));
    const matricula = new Map((aer.data ?? []).map((a) => [a.id, a.matricula]));
    const cuenta = new Map<string, number>();
    for (const g of cnt.data ?? []) {
      cuenta.set(g.liquidacion_id, (cuenta.get(g.liquidacion_id) ?? 0) + 1);
    }

    return filas.map((l) => ({
      ...l,
      piloto: nombre.get(l.piloto_id) ?? null,
      matricula: matricula.get(l.aeronave_id) ?? null,
      gastos: cuenta.get(l.id) ?? 0,
    }));
  },

  async una(id: string): Promise<Liquidacion | null> {
    const { data, error } = await supabase
      .from('avn_liquidaciones').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  },

  async gastos(liquidacionId: string): Promise<Gasto[]> {
    const { data, error } = await supabase
      .from('avn_liquidacion_gastos')
      .select('*')
      .eq('liquidacion_id', liquidacionId)
      .order('orden')
      .order('fecha');
    if (error) throw error;
    return data ?? [];
  },

  /** Cuántos adjuntos tiene cada gasto. Un mapa gasto → cuántos. */
  async adjuntos(gastoIds: string[]): Promise<Map<string, number>> {
    const m = new Map<string, number>();
    if (gastoIds.length === 0) return m;
    const { data, error } = await supabase
      .from('documentos')
      .select('entidad_id')
      .eq('entidad_tipo', 'avn_liq_gasto')
      .in('entidad_id', gastoIds);
    if (error) throw error;
    for (const d of data ?? []) {
      if (d.entidad_id) m.set(d.entidad_id, (m.get(d.entidad_id) ?? 0) + 1);
    }
    return m;
  },

  async crear(datos: LiquidacionInsert): Promise<Liquidacion> {
    const { data, error } = await supabase
      .from('avn_liquidaciones').insert(datos).select('*').single();
    if (error) throw error;
    return data;
  },

  async actualizar(id: string, datos: LiquidacionUpdate): Promise<void> {
    const { error } = await supabase.from('avn_liquidaciones').update(datos).eq('id', id);
    if (error) throw error;
  },

  async borrar(id: string): Promise<void> {
    const { error } = await supabase
      .from('avn_liquidaciones')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async guardarGasto(id: string | undefined, datos: GastoInsert): Promise<Gasto> {
    if (id) {
      // Al editar no viajan ni el id ni la liquidación: un gasto no se muda
      // de liquidación, y dejar que el `update` los lleve es la puerta por la
      // que un renglón acabaría en otra hoja.
      const { liquidacion_id: _liq, id: _id, ...patch } = datos;
      const { data, error } = await supabase
        .from('avn_liquidacion_gastos')
        .update(patch satisfies GastoUpdate)
        .eq('id', id).select('*').single();
      if (error) throw error;
      return data;
    }
    const { data, error } = await supabase
      .from('avn_liquidacion_gastos').insert(datos).select('*').single();
    if (error) throw error;
    return data;
  },

  /** Los gastos se borran de verdad: no son documento, son renglones. */
  async borrarGasto(id: string): Promise<void> {
    const { error } = await supabase.from('avn_liquidacion_gastos').delete().eq('id', id);
    if (error) throw error;
  },

  async cerrar(id: string): Promise<void> {
    const { error } = await supabase.rpc('avn_liquidacion_cerrar', { p_liq: id });
    if (error) throw error;
  },

  async reabrir(id: string): Promise<void> {
    const { error } = await supabase.rpc('avn_liquidacion_reabrir', { p_liq: id });
    if (error) throw error;
  },

  async enviarAPagos(id: string): Promise<void> {
    const { error } = await supabase.rpc('avn_liquidacion_enviar_a_pagos', { p_liq: id });
    if (error) throw error;
  },

  /** A quién le puede mandar un piloto su liquidación. */
  async revisores() {
    const { data, error } = await supabase.rpc('avn_liq_revisores');
    if (error) throw error;
    return data ?? [];
  },

  /**
   * Mandarla a revisar es crear un envío: el mismo camino que ya usa el
   * control de vales para llegar a Victor. El estado de la liquidación lo
   * mueve la base al ver el envío, así que no pueden quedar en desacuerdo.
   */
  async enviarARevision(input: {
    liquidacion: LiquidacionFila;
    destinatarioId: string;
    nota: string | null;
  }): Promise<void> {
    const l = input.liquidacion;
    const { error } = await supabase.from('envios').insert({
      destinatario_id: input.destinatarioId,
      doc_tipo: 'avn_liquidacion',
      doc_id: l.id,
      nota: input.nota,
      // Copia congelada: quien recibe decide con esto, sin tener que leer la
      // tabla de origen.
      snapshot: {
        titulo: `Liquidación ${l.serial ?? ''}`,
        resumen: `${l.matricula ?? ''} · ${l.ruta ?? ''}`,
        piloto: l.piloto,
        fechas: `${l.fecha_inicio} — ${l.fecha_fin}`,
        total: l.total_gtq,
        reembolso: l.piloto_gtq,
        moneda: 'GTQ',
        gastos: l.gastos,
      },
    });
    if (error) throw error;
  },

  /** Los envíos de una liquidación, para saber con quién está. */
  async enviosDe(liquidacionId: string) {
    const { data, error } = await supabase
      .from('envios')
      .select('*')
      .eq('doc_tipo', 'avn_liquidacion')
      .eq('doc_id', liquidacionId)
      .is('deleted_at', null)
      .order('enviado_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  /** Lo que me mandaron a mí y todavía no resuelvo. */
  async porRevisar() {
    const { data, error } = await supabase
      .from('envios')
      .select('*')
      .eq('doc_tipo', 'avn_liquidacion')
      .eq('estado', 'enviado')
      .is('deleted_at', null)
      .order('enviado_at');
    if (error) throw error;
    return data ?? [];
  },

  async aceptar(envioId: string, nota: string | null): Promise<void> {
    const { error } = await supabase.rpc('envio_aceptar', {
      p_envio: envioId, p_datos: {}, p_nota: nota,
    });
    if (error) throw error;
  },

  async devolver(envioId: string, nota: string): Promise<void> {
    const { error } = await supabase.rpc('envio_rechazar', {
      p_envio: envioId, p_nota: nota,
    });
    if (error) throw error;
  },

  /** Los vales de combustible de una aeronave, para poder amarrarlos. */
  async valesDe(aeronaveId: string) {
    const { data, error } = await supabase
      .from('avn_combustible_registros')
      .select('id, serial, fecha, proveedor, total, vale')
      .eq('aeronave_id', aeronaveId)
      .is('deleted_at', null)
      .is('cancelado_en', null)
      .order('fecha', { ascending: false })
      .limit(60);
    if (error) throw error;
    return data ?? [];
  },
};

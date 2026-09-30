// Estado de cuenta del proveedor de combustible.
//
// No es crédito: es un DEPÓSITO del que se consume y que se va reponiendo. El
// límite de crédito del proveedor es 0.00, así que agotarlo es quedarse sin
// fuel.
//
// ── El signo ──────────────────────────────────────────────────────────────
// El Excel del proveedor lleva el saldo en negativo cuando hay dinero a favor
// —para él somos un pasivo— y cierra con «Saldo disponible −24,736.20». Acá
// se invierte: **disponible en positivo**.
//
// ── El estado de cuenta se calcula, no se guarda ──────────────────────────
// Sale de tres fuentes y ninguna duplica a la otra:
//
//   1. `avn_fuel_movimientos` — los dos años importados del Excel.
//   2. `avn_combustible_registros` — las facturas que captura CEA.
//   3. `avn_fuel_abonos` — las reposiciones hechas desde CEA.
//
// Por eso editar una factura corrige el saldo solo, y por eso no hay forma de
// que el saldo quede peleado con sus movimientos.

import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

export type Cuenta = Database['public']['Tables']['avn_fuel_cuentas']['Row'];
export type Abono = Database['public']['Tables']['avn_fuel_abonos']['Row'];

/** Una línea del estado de cuenta, ya con su saldo corriendo. */
export type MovimientoCuenta = {
  clave: string;
  origen: 'historico' | 'registro' | 'reposicion';
  tipo: 'saldo_inicial' | 'cargo' | 'abono';
  fecha: string | null;
  documento: string | null;
  comentario: string | null;
  cargo: number;
  abono: number;
  saldo: number;
  /** Para poder abrir el registro de combustible desde la línea. */
  registroId?: string;
  /** La reposición entera, para editarla o ver su comprobante sin otra consulta. */
  abonoRow?: Abono;
};

/** Una factura que todavía no entró en ninguna reposición. */
export type FacturaPendiente = {
  id: string;
  serial: string | null;
  fecha: string;
  vale: string | null;
  factura: string | null;
  fer_ap: string | null;
  total: number;
};

export type EstadoCuenta = {
  cuenta: Cuenta | null;
  movimientos: MovimientoCuenta[];
  /** Lo que queda del depósito. En positivo. */
  disponible: number;
  consumido: number;
  repuesto: number;
  /** Cuánto falta para volver a dejar el depósito en su nivel. */
  faltaReponer: number;
  /** Por debajo del mínimo hay que iniciar la reposición ya. */
  bajo: boolean;
  /** Facturas de CEA que ninguna reposición cubre todavía. */
  pendientes: FacturaPendiente[];
};

const n = (v: unknown): number => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

export const cuentaApi = {
  async cargar(aeronaveId: string): Promise<EstadoCuenta> {
    const cta = await supabase
      .from('avn_fuel_cuentas')
      .select('*')
      .eq('aeronave_id', aeronaveId)
      .is('deleted_at', null)
      .maybeSingle();
    if (cta.error) throw cta.error;

    const cuenta = cta.data ?? null;
    if (!cuenta) {
      return {
        cuenta: null, movimientos: [], disponible: 0, consumido: 0, repuesto: 0,
        faltaReponer: 0, bajo: false, pendientes: [],
      };
    }

    const [hist, regs, abonos, enlaces] = await Promise.all([
      supabase.from('avn_fuel_movimientos').select('*')
        .eq('cuenta_id', cuenta.id).is('deleted_at', null).order('orden'),
      supabase.from('avn_combustible_registros')
        .select('id, serial, fecha, vale, factura, fer_ap, total, cancelado_en')
        .eq('aeronave_id', aeronaveId).is('deleted_at', null).order('fecha'),
      supabase.from('avn_fuel_abonos').select('*')
        .eq('cuenta_id', cuenta.id).is('deleted_at', null).order('fecha'),
      supabase.from('avn_fuel_abono_registros').select('abono_id, registro_id'),
    ]);
    if (hist.error) throw hist.error;
    if (regs.error) throw regs.error;
    if (abonos.error) throw abonos.error;
    if (enlaces.error) throw enlaces.error;

    const movimientos: MovimientoCuenta[] = [];

    // 1 · La historia, en el orden del estado de cuenta. Ese orden NO es
    //     cronológico —el Excel trae el 21/03/26 antes del 22/02/26— y es el
    //     orden, no la fecha, el que sigue la cadena de saldos del proveedor.
    for (const m of hist.data ?? []) {
      const tipo = m.tipo as MovimientoCuenta['tipo'];
      movimientos.push({
        clave: `h:${m.id}`,
        origen: 'historico',
        tipo,
        fecha: m.fecha,
        documento: m.documento,
        comentario: m.comentario,
        cargo: tipo === 'cargo' ? n(m.monto) : 0,
        abono: tipo === 'cargo' ? 0 : n(m.monto),
        saldo: 0,
      });
    }

    // 2 · Lo que sigue después del corte de la historia.
    //
    //     El corte vale para TODO lo que capture CEA, no solo para las
    //     facturas: cuando llega un estado de cuenta más reciente, el
    //     proveedor ya trae dentro los anticipos que se hicieron, y una
    //     reposición registrada acá antes de esa fecha se contaría dos veces
    //     --una como historia y otra como reposición propia--.
    //
    //     Le pasa exactamente a una reposición que se registra hoy y que
    //     aparece en el estado de cuenta del mes siguiente.
    const corte = cuenta.historico_hasta;
    const despuesDelCorte = (fecha: string | null) => !corte || (!!fecha && fecha > corte);

    const propias = (regs.data ?? []).filter(
      (r) => !r.cancelado_en && despuesDelCorte(r.fecha),
    );
    const reposiciones = (abonos.data ?? []).filter((a) => despuesDelCorte(a.fecha));

    const posteriores: MovimientoCuenta[] = [
      ...propias.map((r) => ({
        clave: `r:${r.id}`,
        origen: 'registro' as const,
        tipo: 'cargo' as const,
        fecha: r.fecha,
        documento: r.fer_ap ?? r.factura,
        comentario: [r.serial, r.vale ? `vale ${r.vale}` : null].filter(Boolean).join(' · '),
        cargo: n(r.total),
        abono: 0,
        saldo: 0,
        registroId: r.id,
      })),
      ...reposiciones.map((a) => ({
        clave: `a:${a.id}`,
        origen: 'reposicion' as const,
        tipo: 'abono' as const,
        fecha: a.fecha,
        documento: a.documento,
        comentario: a.notas,
        cargo: 0,
        abono: n(a.monto),
        saldo: 0,
        abonoRow: a,
      })),
    ].sort((x, y) => (x.fecha ?? '').localeCompare(y.fecha ?? ''));

    movimientos.push(...posteriores);

    // El saldo corriendo, en el orden en que quedaron.
    let saldo = 0;
    for (const m of movimientos) {
      saldo += m.abono - m.cargo;
      m.saldo = saldo;
    }

    const consumido = movimientos.reduce((s, m) => s + m.cargo, 0);
    const repuesto = movimientos.reduce((s, m) => s + m.abono, 0);
    const objetivo = cuenta.deposito_objetivo != null ? n(cuenta.deposito_objetivo) : 0;

    // Las facturas que ninguna reposición cubre: es lo que hay que pagar.
    const cubiertas = new Set((enlaces.data ?? []).map((e) => e.registro_id));
    const pendientes: FacturaPendiente[] = propias
      .filter((r) => !cubiertas.has(r.id))
      .map((r) => ({
        id: r.id, serial: r.serial, fecha: r.fecha, vale: r.vale,
        factura: r.factura, fer_ap: r.fer_ap, total: n(r.total),
      }));

    return {
      cuenta,
      movimientos,
      disponible: saldo,
      consumido,
      repuesto,
      faltaReponer: Math.max(0, objetivo - saldo),
      bajo: saldo < n(cuenta.alerta_minimo),
      pendientes,
    };
  },

  /** Guarda la reposición y las facturas que cubre. */
  async guardarAbono(vars: {
    id?: string;
    cuentaId: string;
    datos: Database['public']['Tables']['avn_fuel_abonos']['Insert'];
    registroIds: string[];
  }): Promise<string> {
    const { id, datos, registroIds } = vars;

    let abonoId = id;
    if (abonoId) {
      const { cuenta_id: _c, id: _i, ...patch } = datos;
      const { error } = await supabase.from('avn_fuel_abonos').update(patch).eq('id', abonoId);
      if (error) throw error;
    } else {
      const { data, error } = await supabase
        .from('avn_fuel_abonos').insert(datos).select('id').single();
      if (error) throw error;
      abonoId = data.id;
    }

    // Los enlaces se rehacen: no son dinero, solo dicen qué cubre qué, y
    // reconciliarlos uno por uno no aporta nada.
    const del = await supabase.from('avn_fuel_abono_registros').delete().eq('abono_id', abonoId);
    if (del.error) throw del.error;
    if (registroIds.length) {
      const { error } = await supabase.from('avn_fuel_abono_registros').insert(
        registroIds.map((registro_id) => ({ abono_id: abonoId as string, registro_id })),
      );
      if (error) throw error;
    }
    return abonoId as string;
  },

  async borrarAbono(id: string): Promise<void> {
    const { error } = await supabase
      .from('avn_fuel_abonos')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  /** Las facturas que cubre una reposición, para poder editarla. */
  async registrosDe(abonoId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('avn_fuel_abono_registros').select('registro_id').eq('abono_id', abonoId);
    if (error) throw error;
    return (data ?? []).map((x) => x.registro_id);
  },

  async guardarCuenta(id: string, patch: Database['public']['Tables']['avn_fuel_cuentas']['Update']): Promise<void> {
    const { error } = await supabase.from('avn_fuel_cuentas').update(patch).eq('id', id);
    if (error) throw error;
  },
};

// Types locales del módulo caja-chica.
// No dependen de `Database` para no bloquear el build cuando la migración
// aún no se ha aplicado y regenerado. Cuando se regenere `types/database.ts`,
// estos tipos pueden mapearse a Database['public']['Tables']['caja_chica_op_...'].

export type FormaPago =
  | 'Efectivo'
  | 'Caja chica'
  | 'Transferencia'
  | 'Cheque'
  | 'Tarjeta'
  | 'Vale'
  | 'Otro';

export type PeriodoEstado = 'Abierto' | 'Cerrado';
export type ValeEstado = 'Abierto' | 'Liquidado';

export interface Periodo {
  id: string;
  serial: string | null;
  titulo: string | null;
  fecha: string; // YYYY-MM-DD
  monto_inicial: number;
  estado: PeriodoEstado;
  notas: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type PeriodoInsert = {
  titulo?: string | null;
  fecha?: string;
  monto_inicial: number;
  estado?: PeriodoEstado;
  notas?: string | null;
};

export type PeriodoUpdate = Partial<PeriodoInsert>;

export interface Linea {
  id: string;
  periodo_id: string;
  fecha: string | null;
  factura: string | null;
  nombre: string | null;
  cantidad: number | null;
  p_unitario: number | null;
  solicitante: string | null;
  lugar: string | null;
  forma_pago: FormaPago;
  observaciones: string | null;
  foto_url: string | null;
  vale_estado: ValeEstado;
  orden: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type LineaInsert = {
  periodo_id: string;
  fecha?: string | null;
  factura?: string | null;
  nombre?: string | null;
  cantidad?: number | null;
  p_unitario?: number | null;
  solicitante?: string | null;
  lugar?: string | null;
  forma_pago?: FormaPago;
  observaciones?: string | null;
  foto_url?: string | null;
  vale_estado?: ValeEstado;
  orden?: number | null;
};

export type LineaUpdate = Partial<Omit<LineaInsert, 'periodo_id'>>;

export interface ValeFactura {
  id: string;
  linea_id: string;
  fecha: string | null;
  factura: string | null;
  nombre: string | null;
  cantidad: number | null;
  p_unitario: number | null;
  foto_url: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type ValeFacturaInsert = {
  linea_id: string;
  fecha?: string | null;
  factura?: string | null;
  nombre?: string | null;
  cantidad?: number | null;
  p_unitario?: number | null;
  foto_url?: string | null;
};

export type ValeFacturaUpdate = Partial<Omit<ValeFacturaInsert, 'linea_id'>>;

// Helpers puros — el consumo real, el vuelto y el saldo se calculan aquí
// para que la UI y cualquier printable futuro los usen consistentemente.

export function totalLinea(l: Pick<Linea, 'cantidad' | 'p_unitario'>): number {
  const c = Number(l.cantidad ?? 0);
  const p = Number(l.p_unitario ?? 0);
  return c * p;
}

export function totalValeFactura(f: Pick<ValeFactura, 'cantidad' | 'p_unitario'>): number {
  const c = Number(f.cantidad ?? 0);
  const p = Number(f.p_unitario ?? 0);
  return c * p;
}

// Consumo real de una línea contra el saldo del período.
// - No-vale: siempre el total de la línea.
// - Vale abierto: bloquea el total original (anticipo pendiente).
// - Vale liquidado: solo el gasto real (suma de sub-facturas).
export function consumoLinea(l: Linea, subFacturas: ValeFactura[]): number {
  if (l.forma_pago === 'Vale' && l.vale_estado === 'Liquidado') {
    return subFacturas.reduce((s, f) => s + totalValeFactura(f), 0);
  }
  return totalLinea(l);
}

export function vueltoVale(l: Linea, subFacturas: ValeFactura[]): number {
  const gastado = subFacturas.reduce((s, f) => s + totalValeFactura(f), 0);
  return totalLinea(l) - gastado;
}

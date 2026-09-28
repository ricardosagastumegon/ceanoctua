// El crucero dentro de las liquidaciones.
//
// Los otros diez servicios caben en `MAPEO`: una fila, un monto, una tarjeta.
// El crucero no, y por eso vive aparte.
//
// La reserva de cada camarote se paga EN ABONOS, cada uno con su propia
// tarjeta y su propia fecha, y encima puede llevar servicios extra que también
// traen la suya. O sea que un solo crucero reparte dinero entre varias
// tarjetas y en varios meses. Leerlo como los demás --`monto` contra
// `pagado_con_id`-- pondría todo el crucero en una sola tarjeta, que es
// exactamente el error que se corrigió con los cargos adicionales.
//
// Cómo se descompone, entonces:
//
//   1. Un renglón por abono, con su tarjeta y su fecha.
//   2. Un renglón por servicio extra, con su tarjeta y su fecha.
//   3. Un renglón del crucero por el SALDO que falta abonar, con la tarjeta
//      del encabezado si se capturó.
//
// Los tres suman exactamente `att_cruceros.monto` --reserva + extras--, que es
// el mismo total que muestra la tarjeta del viaje. El saldo va como renglón
// normal y los abonos y extras como cargos, así que en la hoja el crucero
// aparece como servicio con sus movimientos sangrados debajo.

import { supabase } from '@/lib/supabase';

/**
 * Un movimiento de dinero del crucero, con la forma mínima que las dos
 * liquidaciones necesitan. Cada hook lo termina de armar con sus propios
 * campos (el viaje, el nombre corto de la tarjeta).
 */
export type MovimientoCrucero = {
  viajeId: string;
  nombre: string;
  /** Abonos y extras van sangrados bajo el crucero; el saldo es el servicio. */
  esCargo: boolean;
  /** Cuándo ocurre el crucero. */
  fecha: string | null;
  /** Cuándo se cobró la tarjeta. */
  fechaCargo: string | null;
  cargo: number;
  reintegro: number;
  moneda: string;
  estadoPago: string | null;
  canceladoEn: string | null;
  pagadoCon: string | null;
  pagadoConId: string | null;
};

/** `Camarote 9204`, o el nombre de la reserva si no se anotó el número. */
const etiquetaCamarote = (c: { camarote: string | null; reserva_nombre: string | null }): string =>
  c.camarote ? `camarote ${c.camarote}` : c.reserva_nombre || 'camarote';

/**
 * Los movimientos de los cruceros: de un viaje si se pasa `viajeId`, de todos
 * si no.
 */
export async function movimientosCruceros(viajeId?: string): Promise<MovimientoCrucero[]> {
  let q = supabase
    .from('att_cruceros')
    .select('id, viaje_id, titulo, ship, salida_fecha, moneda, estado_pago, cancelado_en, reintegro, pagado_con, pagado_con_id, fecha_cargo')
    .is('deleted_at', null);
  if (viajeId) q = q.eq('viaje_id', viajeId);
  const cruceros = await q;
  if (cruceros.error) throw cruceros.error;
  if (!cruceros.data?.length) return [];

  const camarotes = await supabase
    .from('att_crucero_camarotes')
    .select('id, crucero_id, camarote, reserva_nombre, total')
    .in('crucero_id', cruceros.data.map((c) => c.id))
    .is('deleted_at', null)
    .order('orden');
  if (camarotes.error) throw camarotes.error;

  let pagos: {
    camarote_id: string; clase: string; descripcion: string | null; monto: number;
    pagado_con: string | null; pagado_con_id: string | null; fecha_pago: string | null;
  }[] = [];
  if (camarotes.data?.length) {
    const res = await supabase
      .from('att_crucero_pagos')
      .select('camarote_id, clase, descripcion, monto, pagado_con, pagado_con_id, fecha_pago')
      .in('camarote_id', camarotes.data.map((c) => c.id))
      .is('deleted_at', null)
      .order('orden');
    if (res.error) throw res.error;
    pagos = res.data ?? [];
  }

  const out: MovimientoCrucero[] = [];
  for (const cru of cruceros.data) {
    const mios = (camarotes.data ?? []).filter((c) => c.crucero_id === cru.id);
    const moneda = cru.moneda ?? 'USD';
    const barco = cru.titulo || cru.ship || 'Crucero';
    const comun = {
      viajeId: cru.viaje_id,
      moneda,
      estadoPago: cru.estado_pago,
      canceladoEn: cru.cancelado_en,
    };

    let reserva = 0;
    let abonado = 0;
    for (const cam of mios) {
      reserva += Number(cam.total) || 0;
      // La numeración es por camarote: "el segundo abono del 9204" es lo que
      // dice la naviera, no "el quinto abono del crucero".
      let nAbono = 0;
      for (const p of pagos.filter((x) => x.camarote_id === cam.id)) {
        const monto = Number(p.monto) || 0;
        const extra = p.clase === 'extra';
        if (!extra) {
          abonado += monto;
          nAbono += 1;
        }
        out.push({
          ...comun,
          nombre: extra
            ? `${p.descripcion || 'Servicio extra'} · ${etiquetaCamarote(cam)}`
            : `${p.descripcion || `Abono ${nAbono}`} · ${etiquetaCamarote(cam)}`,
          esCargo: true,
          // Las dos fechas del abono son la misma: el día que se cobró. Poner
          // acá la salida del crucero fecharía en diciembre un abono de julio,
          // que es justo lo contrario de lo que sirve en un estado de cuenta.
          fecha: p.fecha_pago,
          fechaCargo: p.fecha_pago,
          cargo: monto,
          reintegro: 0,
          pagadoCon: p.pagado_con,
          pagadoConId: p.pagado_con_id,
        });
      }
    }

    // El saldo: lo que la naviera todavía va a cobrar. El reintegro de una
    // cancelación va aquí, no en los abonos: se devuelve el crucero entero, no
    // un abono en particular.
    const saldo = reserva - abonado;
    out.push({
      ...comun,
      nombre: saldo > 0.005 ? `${barco} · saldo por abonar` : barco,
      esCargo: false,
      // El saldo sí se fecha con el crucero: es el servicio, no un cobro.
      fecha: cru.salida_fecha,
      fechaCargo: cru.fecha_cargo,
      cargo: saldo,
      reintegro: Number(cru.reintegro) || 0,
      pagadoCon: cru.pagado_con,
      pagadoConId: cru.pagado_con_id,
    });
  }

  return out;
}

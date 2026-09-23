// Cancelar un servicio, con o sin reintegro.
//
// Lo que hay que tener claro del modelo: `monto` no se toca nunca. Es lo que
// se le cargó a la tarjeta y así tiene que quedar. Lo que volvió se guarda
// aparte, en `reintegro`, y el que suma al viaje es el neto.
//
// Guardar las dos cifras y no solo la resta es lo que permite cuadrar contra
// el estado de cuenta: la tarjeta muestra un cargo y, por separado, un abono.

import { supabase } from '@/lib/supabase';

/** Las tablas de servicio que llevan costo. Reunión no entra: no tiene. */
export type TablaServicio =
  | 'att_tickets' | 'att_hoteles' | 'att_restaurantes' | 'att_rentas'
  | 'att_tours' | 'att_aeronaves' | 'att_acuaticos' | 'att_ferries'
  | 'att_terrestres' | 'att_actividades';

/** Lo que de verdad costó el servicio. */
export function netoServicio(
  monto: number | null | undefined,
  reintegro: number | null | undefined,
): number {
  return (Number(monto) || 0) - (Number(reintegro) || 0);
}

export async function cancelarServicio(
  tabla: TablaServicio,
  id: string,
  datos: { reintegro: number | null; nota: string | null },
): Promise<void> {
  const { error } = await supabase
    .from(tabla as 'att_tickets')
    .update({
      estado_pago: 'CANCELADO',
      cancelado_en: new Date().toISOString().slice(0, 10),
      reintegro: datos.reintegro,
      reintegro_nota: datos.nota,
    })
    .eq('id', id);
  if (error) throw error;
}

/**
 * Deshacer la cancelación. Se limpia también el reintegro: si el servicio
 * vuelve a estar vivo, ese dinero ya no volvió.
 */
export async function reactivarServicio(tabla: TablaServicio, id: string): Promise<void> {
  const { error } = await supabase
    .from(tabla as 'att_tickets')
    .update({
      estado_pago: 'HOLD',
      cancelado_en: null,
      reintegro: null,
      reintegro_nota: null,
    })
    .eq('id', id);
  if (error) throw error;
}

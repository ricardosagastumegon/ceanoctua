import type { Database } from '@/types/database';

type Tarjeta = Database['public']['Tables']['tarjetas_credito']['Row'];

/** Lo que se necesita de un consumo para saber de qué tarjeta es. */
export type ConsumoRef = { tarjeta_id: string | null; card_id: string | null };

const normalizar = (s: string | null | undefined): string =>
  (s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * A qué tarjeta del catálogo pertenece un consumo.
 *
 * `card_id` es texto libre y no siempre dice lo mismo que el identificador del
 * catálogo. En los datos reales hay filas que dicen «TC Visa Term. 8694»
 * contra un catálogo que dice «Visa Term. 8694», y una que todavía trae la
 * terminación vieja de una tarjeta que se repuso —«TC Corp Agro Term. 7274»
 * por «…4771»—.
 *
 * Por eso manda `tarjeta_id`, que es el amarre de verdad, y el texto solo
 * sirve de rescate para filas viejas que nunca lo tuvieron. Emparejar por
 * texto era lo que hacía la galería, y por eso una tarjeta con dos consumos
 * mostraba uno solo.
 */
export function hacerResolver(
  tarjetas: Tarjeta[],
): (c: ConsumoRef) => string | null {
  const ids = new Set(tarjetas.map((t) => t.id));
  const porTexto = new Map<string, string>();
  for (const t of tarjetas) {
    if (t.tc_id) porTexto.set(normalizar(t.tc_id), t.id);
  }
  return (c) => {
    if (c.tarjeta_id && ids.has(c.tarjeta_id)) return c.tarjeta_id;
    return porTexto.get(normalizar(c.card_id)) ?? null;
  };
}

/**
 * La clave con la que se agrupa y se filtra un consumo.
 *
 * Es el id de la tarjeta cuando se pudo amarrar; cuando no, el texto tal cual
 * para que la fila no desaparezca de los filtros.
 */
export function claveConsumo(
  c: ConsumoRef,
  resolver: (c: ConsumoRef) => string | null,
): string {
  return resolver(c) ?? `texto:${c.card_id ?? ''}`;
}

import type { CeaTodo } from './api';

/**
 * El orden del TO DO, en un solo lugar.
 *
 * Antes cada pantalla ordenaba a su manera: la tabla de CEA por fecha de
 * vencimiento, el tablero de la gerente por el enum de prioridad. La misma
 * lista se veia distinta en cada sitio y no habia forma de adivinar la regla.
 *
 * La regla, ahora unica: **bloques por prioridad, y dentro de cada bloque lo
 * ultimo agregado arriba**. Lo marcado como hecho se va al final.
 *
 * La fecha de vencimiento deja de mandar en el orden, pero no se pierde: en
 * la tabla sigue siendo una columna ordenable, y en los tableros el renglon
 * avisa en rojo cuando algo vencio.
 */

/**
 * El orden de los bloques, el mismo que la pantalla de CEA declara en su
 * encabezado. «Hold» y «TKIM» van arriba a proposito: no son urgencias, pero
 * son cosas que ella quiere tener a la vista y no enterradas bajo las medias.
 */
export const PRIORIDADES = ['Alta', 'Hold', 'TKIM', 'Media', 'Baja'] as const;

const PESO = new Map(PRIORIDADES.map((p, i) => [p.toLowerCase(), i]));
const PESO_MEDIA = PESO.get('media')!;

type Ordenable = Pick<CeaTodo, 'done' | 'prioridad' | 'prioridad_label' | 'created_at'>;

/**
 * Que tan arriba va un pendiente.
 *
 * Se mira `prioridad_label`, que es lo que ella escoge, y no `prioridad`, que
 * es el enum de tres valores al que se reduce para los informes: ahi «Hold» y
 * «TKIM» caen ambos en 'alta' y quedarian revueltos con las urgentes de
 * verdad.
 */
export function pesoPrioridad(t: Pick<Ordenable, 'prioridad' | 'prioridad_label'>): number {
  const etiqueta = (t.prioridad_label ?? t.prioridad ?? 'media').toLowerCase();
  return PESO.get(etiqueta) ?? PESO_MEDIA;
}

/**
 * El titulo del bloque al que pertenece un pendiente. Es lo que hace visible
 * la regla del orden: sin la cabecera hay que adivinarla por el color de las
 * etiquetas, que era justo la queja.
 */
export function bloqueDe(t: Ordenable): string {
  if (t.done) return 'Hechos';
  const i = pesoPrioridad(t);
  return `Prioridad ${PRIORIDADES[i] ?? 'Media'}`;
}

export function ordenarTodos<T extends Ordenable>(todos: T[]): T[] {
  return [...todos].sort(
    (a, b) =>
      Number(a.done) - Number(b.done) ||
      pesoPrioridad(a) - pesoPrioridad(b) ||
      (b.created_at ?? '').localeCompare(a.created_at ?? ''),
  );
}

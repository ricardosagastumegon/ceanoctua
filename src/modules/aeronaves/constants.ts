/**
 * El color con que se distingue cada aeronave en pantalla.
 *
 * No es el color de la aeronave --ese es el campo `color` de la ficha, que
 * dice "Azul, Gris y Amarillo"-- sino el de su botón y su encabezado, para
 * reconocerla de un vistazo sin leer la matrícula. Misma idea que los colores
 * por servicio de T&T.
 */
export type Acento = 'teal' | 'navy' | 'gold' | 'rust' | 'purple' | 'verde';

export const ACENTOS: Record<Acento, { grad: string; solid: string; dark: string; light: string }> = {
  teal: { grad: 'linear-gradient(135deg,#0d2b2e,#077e84,#00b4c5)', solid: '#077e84', dark: '#055a5f', light: '#d0eced' },
  navy: { grad: 'linear-gradient(135deg,#0d1526,#1e2a4a,#33456e)', solid: '#1e2a4a', dark: '#131c31', light: '#e3e7ef' },
  gold: { grad: 'linear-gradient(135deg,#3d2f0a,#9e7a1a,#c9a227)', solid: '#9e7a1a', dark: '#7a5e14', light: '#f5f0d8' },
  rust: { grad: 'linear-gradient(135deg,#3d1503,#bf4609,#e0733f)', solid: '#bf4609', dark: '#8f3406', light: '#f7e6de' },
  purple: { grad: 'linear-gradient(135deg,#241030,#5a3472,#8a5aa8)', solid: '#5a3472', dark: '#432658', light: '#ece3f2' },
  verde: { grad: 'linear-gradient(135deg,#12280f,#2a6e24,#4f9c47)', solid: '#2a6e24', dark: '#1e5019', light: '#e1f0df' },
};

export const ACENTOS_LISTA: { key: Acento; label: string }[] = [
  { key: 'teal', label: 'Turquesa' },
  { key: 'navy', label: 'Azul marino' },
  { key: 'gold', label: 'Dorado' },
  { key: 'rust', label: 'Terracota' },
  { key: 'purple', label: 'Morado' },
  { key: 'verde', label: 'Verde' },
];

export function acento(key: string | null | undefined) {
  return ACENTOS[(key as Acento) ?? 'teal'] ?? ACENTOS.teal;
}

export const ESTADOS = ['operativa', 'en mantenimiento', 'fuera de servicio'] as const;
export type Estado = (typeof ESTADOS)[number];

export const ESTADO_COLOR: Record<string, string> = {
  operativa: 'bg-teal-l text-teal-d',
  'en mantenimiento': 'bg-gold-light text-gold',
  'fuera de servicio': 'bg-rust-l text-rust',
};

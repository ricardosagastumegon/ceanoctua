const formatter = new Intl.NumberFormat('es-GT', {
  style: 'currency',
  currency: 'GTQ',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMoney(value: number): string {
  return formatter.format(value);
}

export function parseMoney(input: string): number {
  const cleaned = input.replace(/[^0-9.-]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Lo que alguien teclea en una casilla numérica, convertido a número.
 *
 * `parseMoney` devuelve 0 cuando no entiende, lo cual sirve para sumar pero
 * no para guardar: deja «no lo sé» y «cero» como el mismo dato. Ésta los
 * distingue, y además aguanta el separador de miles — escribir `1,500.00`
 * hacía que `Number()` diera NaN y el monto se perdiera sin avisar.
 *
 * En Guatemala la coma son miles y el punto decimales, así que una coma
 * suelta se quita; no se toma por separador decimal.
 */
export function parseNumero(input: string): number | null {
  const limpio = input.replace(/[^0-9.-]/g, '');
  if (limpio === '' || limpio === '-' || limpio === '.') return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

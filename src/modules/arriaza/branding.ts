// Logos Arriaza — 2 versiones (blanca para fondos oscuros, color para fondos claros).
//
// Los strings base64 están en el archivo standalone TT_modulo.html como constantes
// TT_LOGO_WHITE y TT_LOGO_COLOR. Para no bloatear el bundle de la ruta /arriaza,
// se lazy-cargan desde este módulo cuando se abre un printable o el hero.
//
// TODO F19-3: extraer los base64 del HTML original y pegarlos aquí. Mientras tanto,
// los printables usan `logoHTML(variant)` que devuelve un placeholder de texto si
// el logo aún no está disponible.

// Placeholders — se reemplazan con base64 real en F19-3 cuando se tengan los assets.
export const TT_LOGO_WHITE = '';
export const TT_LOGO_COLOR = '';

/**
 * Devuelve el HTML del logo posicionado en la esquina superior derecha (paridad
 * con ttLogoCorner del HTML). Si no hay base64 disponible, muestra un placeholder
 * de texto para no romper el layout de los printables.
 */
export function logoCornerHTML(variant: 'white' | 'color' = 'white'): string {
  const src = variant === 'color' ? TT_LOGO_COLOR : TT_LOGO_WHITE;
  if (!src) {
    const color = variant === 'color' ? '#9e7a1a' : '#ffffff';
    return `<div style="position:absolute;top:1.4rem;right:1.75rem;z-index:2;font-family:Montserrat,sans-serif;font-weight:900;font-size:.75rem;letter-spacing:.15em;color:${color};opacity:.85;">ARRIAZA · T&amp;T</div>`;
  }
  return `<img src="${src}" alt="Arriaza Tour & Travel" style="position:absolute;top:1.4rem;right:1.75rem;height:26px;width:auto;z-index:2;opacity:.95;">`;
}

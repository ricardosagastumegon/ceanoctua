import { textoDelPdf } from '@/lib/pdf-texto';

/**
 * Leer una factura FEL y sacar de ella lo que una solicitud de pago necesita.
 *
 * POR QUÉ SE PUEDE. Toda factura guatemalteca es un Documento Tributario
 * Electrónico: el PDF trae el texto adentro, no es la foto de un papel. Esto
 * no adivina ni usa inteligencia artificial — lee datos que el régimen FEL
 * obliga a que estén— así que o sale o no sale, y no sale distinto dos veces.
 *
 * LO QUE EL RÉGIMEN NO FIJA ES EL DISEÑO. Cada certificador acomoda la hoja a
 * su gusto, y se midió contra TRES plantillas reales que ella pasó:
 *
 *   A · Aeronaves, S. A.                «SERIE 75ED0611»  «No. 4244261453»
 *   B · Carlos Manuel Ovalle Leranoz    «Serie: E1C87A9C» «No.: 2647409584»
 *   C · Ceily Yuviksa Morales           «Serie: 6320149F» «Número de DTE: …»
 *
 * Cambia el rótulo, cambia el orden, cambia hasta si el mes va en número o en
 * letra. Lo que NO cambia es el dato, porque es el que el SAT exige.
 *
 * EL ANCLA. El número de autorización es un UUID y está en las tres, y sus
 * primeros ocho caracteres SON la serie --75ED0611, E1C87A9C, 6320149F--. Así
 * que aunque el rótulo de la serie no se reconozca, la serie sale igual.
 *
 * LO QUE VALE DE VERDAD SON LOS NIT, no los nombres. En la factura B el emisor
 * se llama «CARLOS MANUEL OVALLE LERANOZ» y en el catálogo está como «CORDON
 * OVALLLE & ASOCIADOS»: por nombre no se encuentra nunca, por NIT es exacto.
 * Los nombres se leen igual, pero solo sirven de respaldo y para proponer un
 * proveedor nuevo cuando el NIT no está.
 */

export type FacturaSP = {
  /** El UUID del régimen FEL. Es el ancla: está en todas. */
  autorizacion: string | null;
  serie: string | null;
  numero: string | null;
  /** En ISO, lista para guardar. */
  fecha: string | null;
  total: number | null;
  moneda: string;
  /** Quien cobra. Es el proveedor de la solicitud de pago. */
  nitEmisor: string | null;
  nombreEmisor: string | null;
  /** Quien paga. Es la entidad de la solicitud de pago. */
  nitReceptor: string | null;
  nombreReceptor: string | null;
  /** El renglón del servicio o producto. Sirve de concepto. */
  descripcion: string | null;
  /** El texto entero, por si hay que mirar qué pasó. */
  crudo: string;
};

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
const MESES_CORTO = MESES.map((m) => m.slice(0, 3));

/** Un NIT sin guiones ni espacios: `1689663-7` y `16896637` son el mismo. */
export function nitLimpio(s: string | null | undefined): string {
  return (s ?? '').replace(/[^0-9kK]/g, '').toUpperCase();
}

function aNumero(s: string): number | null {
  const n = Number(s.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

/** Las cifras con dos decimales, con o sin la Q delante. */
const MONTO = /(?:Q\s*)?(\d{1,3}(?:,\d{3})*\.\d{2}|\d+\.\d{2})/g;

export async function leerFacturaSP(datos: ArrayBuffer): Promise<FacturaSP> {
  return parsearFacturaSP(await textoDelPdf(datos));
}

/**
 * El parseo, separado de la lectura del PDF.
 *
 * Aparte para poder probarlo con el texto de una factura guardado como texto:
 * las tres plantillas que existen se verificaron así, y una cuarta se puede
 * agregar sin tener que volver a abrir un PDF.
 */
export function parsearFacturaSP(texto: string): FacturaSP {
  const t = texto.replace(/\r/g, '');
  const renglones = t.split('\n').map((x) => x.trim()).filter(Boolean);
  const uno = (re: RegExp): string | null => t.match(re)?.[1]?.trim() ?? null;

  const autorizacion = uno(
    /\b([0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12})\b/i,
  );
  const serie = uno(/\bSerie:?\s*([0-9A-Z]{6,})\b/i) ?? autorizacion?.slice(0, 8) ?? null;
  const numero = uno(/N[uú]mero de DTE:\s*(\d+)/i) ?? uno(/\bNo\.?:?\s*(\d{6,})\b/i);

  // ── La fecha, por los tres caminos que usan las plantillas ──────────
  let fecha = uno(
    /Fecha (?:y hora )?de (?:certificaci[oó]n|emisi[oó]n)[:\s]*(\d{4}-\d{2}-\d{2})/i,
  );
  if (!fecha) {
    const dmy = uno(
      /Fecha (?:y hora )?de (?:certificaci[oó]n|emisi[oó]n)[:\s]*(\d{1,2}-[a-zA-ZáéíóúÁÉÍÓÚ]{3,}-\d{4})/i,
    );
    if (dmy) {
      const [d, m, a] = dmy.split('-');
      const i = MESES_CORTO.indexOf(m.toLowerCase().slice(0, 3));
      if (i >= 0) fecha = `${a}-${String(i + 1).padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
  }
  if (!fecha) {
    // «DIA MES AÑO» en un renglón y sus tres valores en el siguiente. El mes
    // viene en número en una plantilla y escrito en otra.
    const iDia = renglones.findIndex((r) => /^DIA\s+MES\s+A[NÑ]O$/i.test(r.replace(/\s+/g, ' ')));
    const abajo = iDia >= 0 ? renglones[iDia + 1] : undefined;
    if (abajo) {
      const p = abajo.split(/\s+/).filter(Boolean);
      if (p.length >= 3) {
        const mes = /^\d+$/.test(p[1]) ? Number(p[1]) : MESES.indexOf(p[1].toLowerCase()) + 1;
        if (mes >= 1 && mes <= 12) {
          fecha = `${p[2]}-${String(mes).padStart(2, '0')}-${p[0].padStart(2, '0')}`;
        }
      }
    }
  }

  // ── Los NIT, que son la llave ───────────────────────────────────────
  const nitEmisor =
    nitLimpio(uno(/Nit\s*Emisor:?\s*([0-9A-Za-z-]+)/i)) ||
    nitLimpio(
      renglones
        .find((r) => /^NIT:?\s*[0-9A-Za-z-]+$/i.test(r))
        ?.replace(/^NIT:?\s*/i, ''),
    ) ||
    null;
  const nitReceptor =
    nitLimpio(uno(/NIT\s*Receptor:?\s*([0-9A-Za-z-]+)/i)) ||
    nitLimpio(uno(/Nombre:\s*.+?\s{2,}NIT:\s*([0-9A-Za-z-]+)/i)) ||
    nitLimpio(uno(/DATOS DEL CLIENTE[\s\S]{0,200}?NIT:\s*([0-9A-Za-z-]+)/i)) ||
    null;

  // Un valor termina donde empieza otra etiqueta: dos columnas distintas caen
  // en el mismo renglón visual, y sin cortar ahí el nombre del cliente se
  // llevaba pegada la fecha de certificación.
  const hastaLaSiguienteEtiqueta = (v: string | null): string | null =>
    v == null ? null : v.split(/\s{2,}(?=[A-Za-zÁÉÍÓÚÑ][^:]{2,40}:)/)[0].trim() || null;

  const nombreReceptor = hastaLaSiguienteEtiqueta(
    uno(/Nombre\s*Receptor:?\s*(.+)/i) ?? uno(/Nombre:\s*(.+?)(?:\s{2,}NIT:|$)/im),
  );

  // ── El emisor encabeza la hoja, pero no siempre en el primer renglón ─
  // En una plantilla el primero es el tipo de documento. Se descartan los
  // rótulos y las direcciones --que son MÁS LARGAS que el nombre, y por eso
  // ganaban cuando se elegía «la más larga»-- y de lo que queda se toma el
  // primero, salvo que el siguiente lo amplíe: el logo pone «Aeronaves» y la
  // razón social «Aeronaves, S. A.».
  const esRotulo = (r: string) =>
    /^(DOCUMENTO|N[UÚ]MERO|NIT|Nit|Serie|No\.|Factura |TOTAL|DATOS|Tel[eé]fono|Email)/i.test(r) ||
    /Factura .*(Electr[oó]nica|Contribuyente|Cambiaria)/i.test(r);
  const esDireccion = (r: string) =>
    /^\d/.test(r) ||
    /\b(zona|calle|avenida|ave\.?|apto|lote|manzana|residencial|edificio|torre|oficina|km|kil[oó]metro|colonia|col\.)\b/i.test(r);
  const pelado = (r: string) => r.replace(/[^A-Za-zÁÉÍÓÚÑ0-9]/g, '').toUpperCase();

  const candidatos = renglones
    .slice(0, 8)
    .map((r) => r.split(/\s{2,}/)[0].trim())
    .filter((r) => r.length > 4 && !esRotulo(r) && !esDireccion(r) && /[A-Za-zÁÉÍÓÚÑ]/.test(r));
  let nombreEmisor: string | null = candidatos[0] ?? null;
  if (
    nombreEmisor &&
    candidatos[1] &&
    candidatos[1].length > nombreEmisor.length &&
    pelado(candidatos[1]).startsWith(pelado(nombreEmisor))
  ) {
    nombreEmisor = candidatos[1];
  }

  // ── El total ────────────────────────────────────────────────────────
  // Manda el renglón que dice TOTAL --ni SUBTOTAL ni EN LETRAS--. Si ese
  // renglón no trae cifra, se mira el pegado: en una plantilla el rótulo
  // «TOTALES:» va DEBAJO de sus números.
  let total: number | null = null;
  for (let i = 0; i < renglones.length && total == null; i++) {
    const r = renglones[i];
    if (!/\bTOTAL(ES)?\b/i.test(r) || /SUBTOTAL|EN LETRAS/i.test(r)) continue;
    for (const fuente of [r, renglones[i - 1] ?? '', renglones[i + 1] ?? '']) {
      const cifras = [...fuente.matchAll(MONTO)]
        .map((x) => aNumero(x[1]))
        .filter((n): n is number => n != null && n > 0);
      if (cifras.length) {
        total = cifras[cifras.length - 1];
        break;
      }
    }
  }
  if (total == null) {
    const todas = [...t.matchAll(MONTO)]
      .map((x) => aNumero(x[1]))
      .filter((n): n is number => n != null);
    total = todas.length ? Math.max(...todas) : null;
  }

  // ── El concepto ─────────────────────────────────────────────────────
  const iCabecera = renglones.findIndex((r) => /DESCRIPCI[OÓ]N/i.test(r));
  let descripcion: string | null = null;
  if (iCabecera >= 0) {
    for (let i = iCabecera + 1; i < Math.min(iCabecera + 5, renglones.length); i++) {
      const partes = renglones[i].split(/\s{2,}/).map((x) => x.trim()).filter(Boolean);
      const soloTexto = partes.filter(
        (x) => !/^[\d.,]+$/.test(x) && !/^Q\s/.test(x) && x.length > 4,
      );
      if (soloTexto.length) {
        descripcion = [...soloTexto].sort((a, b) => b.length - a.length)[0];
        break;
      }
    }
  }

  return {
    autorizacion,
    serie,
    numero,
    fecha,
    total,
    moneda: uno(/Moneda:\s*([A-Z]{3})/i) ?? 'GTQ',
    nitEmisor,
    nombreEmisor,
    nitReceptor,
    nombreReceptor,
    descripcion,
    crudo: t,
  };
}

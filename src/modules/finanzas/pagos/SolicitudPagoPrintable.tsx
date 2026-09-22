import type { CSSProperties, ReactNode } from 'react';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import type { Pago } from './api';
import logoFz from './logo-fz.png';

/**
 * Réplica del formato oficial FZ-RG-0185 v04 · Tesorería (archivo Excel
 * "FORMATO DE SOLICITUD DE PAGO"). Es el documento autorizado para firma
 * física, así que este componente debe seguir siendo un espejo exacto de la
 * hoja: mismas 6 columnas, mismas 43 filas, mismos textos fijos.
 *
 * No agregar campos, sellos ni branding de la app. Si el Excel cambia, se
 * ajusta aquí y se deja constancia de la versión en la bitácora.
 *
 * Geometría: los anchos de columna son el % que cada una ocupa en el Excel y
 * las alturas de fila son los puntos originales, todo multiplicado por K. Ese
 * factor hace el mismo papel que el `scale: 71` del Excel — encoger la hoja
 * para que entre completa en una carta con los márgenes de `@media print`.
 *
 * SHEET_W se fija aquí porque `@media print` estira `.printable` al 100% de
 * la página, y sin ese tope la hoja saldría más ancha y más alta que una
 * carta. El escalado puro de K daría 160mm; usamos 170mm porque el Excel está
 * hecho en Gisha, que no está instalada, y la caída a Segoe UI es más ancha:
 * con 160mm se partían en dos "Fecha Aprobación:" y las descripciones de la
 * tabla de anticipos. Si algún día se instala Gisha, 160mm vuelve a ser lo
 * correcto.
 */
const K = 0.75;
const SHEET_W = '170mm';
const pt = (v: number) => `${+(v * K).toFixed(2)}pt`;

const THIN = '1px solid #000000';
const MEDIUM = '2px solid #000000';
const DOUBLE = '3px double #000000';

const COL_W = ['20.53%', '12.80%', '16.67%', '16.67%', '16.67%', '16.66%'];

const MONEDA_LABEL: Record<string, string> = {
  GTQ: 'QUETZALES',
  USD: 'DÓLARES',
  EUR: 'EUROS',
  GBP: 'LIBRAS',
};

function money(n: number, currency: string): string {
  if (currency === 'GTQ') return formatMoney(n);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/**
 * Reparte el texto en `max` renglones sin cortar palabras, imitando lo que
 * pasa al escribir en las celdas combinadas del Excel. El último renglón se
 * queda con el sobrante para no perder texto de un documento oficial.
 */
function wrapLines(text: string, perLine: number, max: number): string[] {
  const out: string[] = [];
  let rest = text.trim().replace(/\s+/g, ' ');
  while (rest && out.length < max - 1) {
    if (rest.length <= perLine) {
      out.push(rest);
      rest = '';
      break;
    }
    let cut = rest.lastIndexOf(' ', perLine);
    if (cut <= 0) cut = perLine;
    out.push(rest.slice(0, cut));
    rest = rest.slice(cut).trim();
  }
  if (rest) out.push(rest);
  while (out.length < max) out.push('');
  return out;
}

export function SolicitudPagoPrintable({ pago }: { pago: Pago }) {
  const moneda = pago.moneda;
  const monto = Number(pago.monto);
  const esAnticipo = (pago.tipo_label ?? '').includes('Anticipo');
  const total = pago.cotizacion != null ? Number(pago.cotizacion) : null;
  const previos = 0;
  // El tope de caracteres deja aire a los lados: el texto va centrado y la
  // etiqueta de la izquierda se desborda sobre la celda, igual que en Excel.
  const concepto = wrapLines(pago.concepto ?? '', 78, 3);
  const observaciones = wrapLines(pago.notas ?? '', 78, 2);

  // % del Excel: monto / monto total del proyecto. Si no hay cotización se
  // cae al pct_anticipo capturado en el form; si tampoco hay, queda en blanco.
  const pctSolicitado =
    total && total > 0
      ? monto / total
      : pago.pct_anticipo != null
        ? Number(pago.pct_anticipo) / 100
        : null;

  const base: CSSProperties = {
    fontFamily: "Gisha, 'Segoe UI', Tahoma, sans-serif",
    fontSize: pt(12),
    color: '#000000',
    background: '#ffffff',
    width: SHEET_W,
    margin: '0 auto',
  };

  return (
    <div className="fz-sheet" style={base}>
      {/* Las celdas del Excel no tienen padding: sin esto cada fila crece ~2pt
          y las 43 filas ya no caben en una página. */}
      <style>{'.fz-sheet td { padding: 0; line-height: 1.05; }'}</style>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          tableLayout: 'fixed',
        }}
      >
        <colgroup>
          {COL_W.map((w, i) => (
            <col key={i} style={{ width: w }} />
          ))}
        </colgroup>
        <tbody>
          {/* ── Encabezado oficial · filas 1-4 ────────────────────────── */}
          <tr style={{ height: pt(16.9) }}>
            <td
              rowSpan={4}
              style={{
                borderLeft: DOUBLE,
                borderTop: DOUBLE,
                borderRight: THIN,
                borderBottom: THIN,
                textAlign: 'center',
                verticalAlign: 'middle',
              }}
            >
              <img src={logoFz} alt="" style={{ width: pt(48), height: pt(49) }} />
            </td>
            <td
              colSpan={3}
              rowSpan={4}
              style={{
                borderLeft: THIN,
                borderTop: DOUBLE,
                borderRight: THIN,
                borderBottom: THIN,
                textAlign: 'center',
                verticalAlign: 'middle',
                fontSize: pt(20),
                fontWeight: 700,
                lineHeight: 1.15,
              }}
            >
              SOLICITUD DE
              <br />
              TRAMITE DE PAGO
            </td>
            <HeadLabel label="Código:" top={DOUBLE} />
            <HeadValue value="FZ-RG-0185" top={DOUBLE} />
          </tr>
          <tr style={{ height: pt(16.15) }}>
            <HeadLabel label="Fecha Aprobación:" />
            <HeadValue value="Enero 2024" />
          </tr>
          <tr style={{ height: pt(16.15) }}>
            <HeadLabel label="Sub-Proceso:" />
            <HeadValue value="TESORERIA" />
          </tr>
          <tr style={{ height: pt(16.5) }}>
            <HeadLabel label="Versión:" bottom={DOUBLE} />
            <HeadValue value="04" bottom={DOUBLE} />
          </tr>

          <Spacer h={16.5} />

          {/* ── Datos de la solicitud ─────────────────────────────────── */}
          <tr style={{ height: pt(18.75) }}>
            <Label text="ENTIDAD QUE PAGA:" />
            <Value colSpan={5} size={14} bold>
              {pago.entidad ?? ''}
            </Value>
          </tr>

          <Spacer h={15.75} />

          <tr style={{ height: pt(15.75) }}>
            <Label text="TIPO DE PAGO:" />
            <Value colSpan={2}>{pago.tipo_label ?? ''}</Value>
            <Label text="OTRO:" center />
            <Value colSpan={2}>{''}</Value>
          </tr>

          <Spacer h={15.75} />

          <tr style={{ height: pt(15.75) }}>
            <Label text="MONEDA:" />
            <Value colSpan={2}>{MONEDA_LABEL[moneda] ?? moneda}</Value>
            <Label text="OTRO:" center />
            <Value colSpan={2}>{''}</Value>
          </tr>

          <Spacer h={15.75} />

          <tr style={{ height: pt(18.75) }}>
            <Label text="A FAVOR DE:" />
            <Value colSpan={5} size={14} bold>
              {pago.proveedor ?? ''}
            </Value>
          </tr>

          <Spacer h={15.75} />

          <tr style={{ height: pt(15.75) }}>
            <Label text="NIT:" />
            <Value colSpan={5}>{pago.nit ?? ''}</Value>
          </tr>

          <Spacer h={15.75} />

          <tr style={{ height: pt(20.25) }}>
            <Label text="MONTO:" />
            <Value colSpan={2} size={16} bold>
              {money(monto, moneda)}
            </Value>
            <td colSpan={3} />
          </tr>

          <Spacer h={15.75} />

          {/* Concepto · 3 renglones subrayados como en el Excel */}
          <tr style={{ height: pt(24) }}>
            <Label text="CONCEPTO DE COMPRA:" />
            <Value colSpan={5}>{concepto[0]}</Value>
          </tr>
          <tr style={{ height: pt(24) }}>
            <td />
            <Value colSpan={5}>{concepto[1]}</Value>
          </tr>
          <tr style={{ height: pt(24) }}>
            <td />
            <Value colSpan={5}>{concepto[2]}</Value>
          </tr>

          <Spacer h={15.75} />

          {/* Centro Productivo se deja SIEMPRE en blanco: se llena a mano. */}
          <tr style={{ height: pt(15.75) }}>
            <Label text="CENTRO PRODUCTIVO:" />
            <Value colSpan={2}>{''}</Value>
            <td colSpan={3} />
          </tr>

          <Spacer h={15.75} />

          <tr style={{ height: pt(15.75) }}>
            <td colSpan={6} style={{ fontWeight: 700, paddingLeft: '18%' }}>
              *** Llenar para trámites de anticipo y liquidación
            </td>
          </tr>

          <Spacer h={16.5} />

          {/* ── Bloque de anticipo ────────────────────────────────────── */}
          <tr style={{ height: pt(19.5) }}>
            <td />
            <td
              colSpan={3}
              style={{
                borderRight: MEDIUM,
                fontWeight: 700,
                textAlign: 'center',
                verticalAlign: 'middle',
              }}
            >
              Monto total de compra o proyecto
            </td>
            <td
              style={{
                border: MEDIUM,
                textAlign: 'center',
                verticalAlign: 'middle',
                fontSize: pt(14),
                fontWeight: 700,
              }}
            >
              {esAnticipo && total != null ? money(total, moneda) : ''}
            </td>
            <td />
          </tr>

          <Spacer h={15.75} />

          <tr style={{ height: pt(16.5) }}>
            <td />
            <GridCell colSpan={2} bold>
              Descripción
            </GridCell>
            <GridCell bold>Monto</GridCell>
            <GridCell bold>%</GridCell>
            <td />
          </tr>
          <tr style={{ height: pt(19.5) }}>
            <td />
            <GridCell colSpan={2}>Anticipos previos</GridCell>
            <GridCell strong>{esAnticipo ? money(previos, moneda) : ''}</GridCell>
            <GridCell>{esAnticipo ? '0%' : ''}</GridCell>
            <td />
          </tr>
          <tr style={{ height: pt(19.5) }}>
            <td />
            <GridCell colSpan={2}>Anticipo solicitado en este trámite</GridCell>
            <GridCell strong>{esAnticipo ? money(monto, moneda) : ''}</GridCell>
            <GridCell>{esAnticipo && pctSolicitado != null ? pct(pctSolicitado) : ''}</GridCell>
            <td />
          </tr>
          <tr style={{ height: pt(19.5) }}>
            <td />
            <GridCell colSpan={2} bold>
              Total de Pagos
            </GridCell>
            <GridCell strong>{esAnticipo ? money(previos + monto, moneda) : ''}</GridCell>
            <GridCell bold>{esAnticipo && pctSolicitado != null ? pct(pctSolicitado) : ''}</GridCell>
            <td />
          </tr>

          <Spacer h={27} />

          {/* ── Observaciones · 2 renglones ───────────────────────────── */}
          <tr style={{ height: pt(22.5) }}>
            <Label text="OBSERVACIONES:" />
            <Value colSpan={5}>{observaciones[0]}</Value>
          </tr>
          <tr style={{ height: pt(22.5) }}>
            <Value colSpan={6}>{observaciones[1]}</Value>
          </tr>

          <Spacer h={22.5} />
          <Spacer h={22.5} />

          <tr style={{ height: pt(15.75) }}>
            <td style={{ fontWeight: 700, textAlign: 'center', verticalAlign: 'middle' }}>FECHA:</td>
            <Value colSpan={2}>{formatDate(pago.fecha)}</Value>
            <td colSpan={3} />
          </tr>

          <Spacer h={40.15} />

          {/* ── Bloque de firmas ──────────────────────────────────────── */}
          <tr style={{ height: pt(70.9) }}>
            <td colSpan={2} style={{ border: THIN }} />
            <td colSpan={2} style={{ border: THIN }} />
            <td colSpan={2} style={{ border: THIN }} />
          </tr>
          <tr style={{ height: pt(15.75) }}>
            <SigCell bold underline>
              Solicitado Por:
            </SigCell>
            <SigCell bold underline>
              Autorizado Por:
            </SigCell>
            <SigCell bold underline>
              Vo.Bo Por:
            </SigCell>
          </tr>
          <tr style={{ height: pt(19.9) }}>
            <SigCell noBottom>Asistente de Gerencias</SigCell>
            <SigCell noBottom>{''}</SigCell>
            <SigCell noBottom>Alta Dirección</SigCell>
          </tr>
          <tr style={{ height: pt(19.9) }}>
            <SigCell noTop>Angeles Quezada</SigCell>
            <SigCell noTop>{''}</SigCell>
            <SigCell noTop>Lissa Arriaza / Javier Arriaza</SigCell>
          </tr>
          <tr style={{ height: pt(15.75) }}>
            <td colSpan={4} />
            <td colSpan={2} style={{ fontWeight: 700, textAlign: 'center', verticalAlign: 'middle' }}>
              *Solamente Anticipo sin factura*
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/* ── Celdas del encabezado (columnas E y F) ─────────────────────────── */

function HeadLabel({ label, top, bottom }: { label: string; top?: string; bottom?: string }) {
  return (
    <td
      style={{
        borderRight: THIN,
        borderTop: top ?? THIN,
        borderBottom: bottom ?? THIN,
        textAlign: 'center',
        verticalAlign: 'middle',
        fontWeight: 700,
      }}
    >
      {label}
    </td>
  );
}

function HeadValue({ value, top, bottom }: { value: string; top?: string; bottom?: string }) {
  return (
    <td
      style={{
        borderRight: DOUBLE,
        borderTop: top ?? THIN,
        borderBottom: bottom ?? THIN,
        textAlign: 'center',
        verticalAlign: 'middle',
      }}
    >
      {value}
    </td>
  );
}

/* ── Celdas del cuerpo ──────────────────────────────────────────────── */

function Label({ text, center }: { text: string; center?: boolean }) {
  return (
    <td
      style={{
        fontWeight: 700,
        verticalAlign: 'middle',
        textAlign: center ? 'center' : 'left',
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </td>
  );
}

/** Campo con la línea inferior sobre la que va el dato (o la firma a mano). */
function Value({
  children,
  colSpan,
  size,
  bold,
}: {
  children: ReactNode;
  colSpan?: number;
  size?: number;
  bold?: boolean;
}) {
  return (
    <td
      colSpan={colSpan}
      style={{
        borderBottom: THIN,
        textAlign: 'center',
        verticalAlign: 'middle',
        fontSize: size ? pt(size) : undefined,
        fontWeight: bold ? 700 : undefined,
        // Separa el dato de la etiqueta cuando esta se desborda sobre la celda.
        padding: `0 ${pt(4)}`,
        overflow: 'hidden',
      }}
    >
      {children}
    </td>
  );
}

/** Celda de la tablita de anticipos (recuadro completo). */
function GridCell({
  children,
  colSpan,
  bold,
  strong,
}: {
  children: ReactNode;
  colSpan?: number;
  bold?: boolean;
  /** Recuadro grueso: las celdas de monto del Excel llevan borde medium. */
  strong?: boolean;
}) {
  return (
    <td
      colSpan={colSpan}
      style={{
        border: strong ? MEDIUM : THIN,
        textAlign: 'center',
        verticalAlign: 'middle',
        fontSize: strong ? pt(14) : undefined,
        fontWeight: bold || strong ? 700 : undefined,
      }}
    >
      {children}
    </td>
  );
}

/** Celda del recuadro de firmas (siempre ocupa 2 columnas del Excel). */
function SigCell({
  children,
  bold,
  underline,
  noTop,
  noBottom,
}: {
  children: ReactNode;
  bold?: boolean;
  underline?: boolean;
  noTop?: boolean;
  noBottom?: boolean;
}) {
  return (
    <td
      colSpan={2}
      style={{
        borderLeft: THIN,
        borderRight: THIN,
        borderTop: noTop ? undefined : THIN,
        borderBottom: noBottom ? undefined : THIN,
        textAlign: 'center',
        verticalAlign: 'middle',
        fontWeight: bold ? 700 : undefined,
        textDecoration: underline ? 'underline' : undefined,
      }}
    >
      {children}
    </td>
  );
}

/** Fila vacía de separación — replica las filas en blanco del Excel. */
function Spacer({ h }: { h: number }) {
  return (
    <tr style={{ height: pt(h) }}>
      <td colSpan={6} />
    </tr>
  );
}

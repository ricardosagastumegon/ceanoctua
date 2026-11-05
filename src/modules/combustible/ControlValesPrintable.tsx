import { Fragment, type CSSProperties, type ReactNode } from 'react';
import { formatDateShort } from '@/lib/dates';
import type { Reporte, Responsable, Solicitud } from './api';
import logoOl from './logo-ol.png';

/**
 * Replica del formato oficial OL-RG-0270 v02 · Operaciones (hoja «Control de
 * Vales»). Es el documento que sustenta la solicitud de pago de la quincena.
 *
 * LA NOTA AL PIE DE LA HOJA manda: «una hoja debe de llevar 6 cuadros para
 * registrar los vales». Los cuadros no se guardan en la base: se derivan
 * agrupando las solicitudes del periodo por responsable, en el orden del
 * catalogo. Asi el total siempre cuadra con sus renglones.
 *
 * DOS DISPOSICIONES DE COLUMNAS, y la diferencia es de fondo:
 *
 *   · vehiculo_asignado -- el gerente tiene SU carro, asi que el cuadro
 *     persigue el kilometraje: Km x Gl anterior/actual, Kms recorridos.
 *   · varios -- el carro cambia en cada renglon, asi que en lugar del
 *     kilometraje se anotan vehiculo, propietario, observaciones y placa.
 *
 * GEOMETRIA. Nueve columnas, B..J, con el ancho que tienen en el Excel
 * (9.55 9.55 20.0 9.55 9.55 20.0 12.66 14.0 9.55 = 114.41). Horizontal, que
 * es como esta configurada la hoja.
 */

const K = 1;
const SHEET_W = '255mm';
const pt = (v: number) => `${+(v * K).toFixed(2)}pt`;

const LINEA = '1px solid #000000';
const GRUESA = '1.5px solid #000000';

const COL_W = [
  '8.35%', // B · Fecha
  '8.35%', // C · Vale #
  '17.48%', // D · Solicitado por / Responsable
  '8.35%', // E · Galones
  '8.35%', // F · Monto
  '17.48%', // G · Km x Gl anterior | Vehiculo
  '11.07%', // H · Km x Gl actual   | Propietario
  '12.24%', // I · Kms recorridos   | Observaciones
  '8.35%', // J · Km x Gl           | Placa
];
const NCOL = COL_W.length;

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/** Cuantos renglones en blanco deja cada cuadro para escribir a mano. */
const RENGLONES_MINIMOS = 4;

function num(n: number | null | undefined, dec = 2): string {
  if (n == null) return '';
  return n.toLocaleString('es-GT', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function Td({
  children,
  colSpan,
  rowSpan,
  style,
  alto,
  al = 'left',
  sinBorde,
}: {
  children?: ReactNode;
  colSpan?: number;
  rowSpan?: number;
  style?: CSSProperties;
  alto?: number;
  al?: 'left' | 'center' | 'right';
  sinBorde?: boolean;
}) {
  return (
    <td
      colSpan={colSpan}
      rowSpan={rowSpan}
      style={{
        border: sinBorde ? 'none' : LINEA,
        padding: '0.5pt 3pt',
        height: alto ? pt(alto) : undefined,
        textAlign: al,
        verticalAlign: 'middle',
        ...style,
      }}
    >
      {children}
    </td>
  );
}

export type Bloque = {
  responsable: Responsable;
  /** Nombre y puesto ya resueltos: el catalogo los puede traer de `empleados`. */
  nombre: string;
  puesto: string;
  vehiculo: { marca: string; placa: string; tipo: string | null } | null;
  filas: Solicitud[];
};

type Props = {
  reporte: Reporte;
  bloques: Bloque[];
  /** «Realizado Por» del pie. */
  realizadoPor?: { nombre: string; puesto: string } | null;
};

function Cuadro({ bloque }: { bloque: Bloque }) {
  const { responsable, nombre, puesto, vehiculo, filas } = bloque;
  const asignado = responsable.tipo_bloque === 'vehiculo_asignado';

  const totalGalones = filas.reduce((a, f) => a + (f.galones ?? 0), 0);
  const totalMonto = filas.reduce((a, f) => a + (f.monto ?? 0), 0);
  // Los kilometros recorridos de un renglon son la resta, no la lectura del
  // odometro. Sumar `kilometraje_actual` daria cientos de miles.
  const recorridos = (f: Solicitud) =>
    f.kilometraje_actual != null && f.km_ultima_llenada != null
      ? f.kilometraje_actual - f.km_ultima_llenada
      : 0;
  const totalKms = filas.reduce((a, f) => a + recorridos(f), 0);

  const vacias = Math.max(0, RENGLONES_MINIMOS - filas.length);

  return (
    <>
      {/* separador entre cuadros */}
      <tr>
        <Td colSpan={NCOL} alto={8} sinBorde />
      </tr>

      {/* ── Encabezado del cuadro · lo que va en rojo en la hoja ─── */}
      <tr>
        <Td colSpan={3} alto={16.9} style={{ fontWeight: 600 }}>
          Marca del Vehículo
        </Td>
        <Td colSpan={3} al="center" style={{ fontWeight: 700 }}>
          {vehiculo?.marca ?? 'varios'}
        </Td>
        <Td style={{ fontWeight: 600 }}>Tipo de Vehículo</Td>
        <Td colSpan={2} al="center" style={{ fontWeight: 700 }}>
          {vehiculo?.tipo ?? 'VEHÍCULOS VARIOS'}
        </Td>
      </tr>
      <tr>
        <Td colSpan={2} alto={16.9} style={{ fontWeight: 600 }}>
          Responsable:
        </Td>
        <Td al="center" style={{ fontWeight: 700 }}>
          {puesto}
        </Td>
        <Td colSpan={3} al="center" style={{ fontWeight: 700 }}>
          {nombre}
        </Td>
        <Td style={{ fontWeight: 600 }}>{asignado ? 'PLACA' : ''}</Td>
        <Td colSpan={2} al="center" style={{ fontWeight: 700 }}>
          {vehiculo?.placa ?? ''}
        </Td>
      </tr>

      {/* ── Cabecera de columnas ──────────────────────────────────── */}
      <tr style={{ fontWeight: 600 }}>
        <Td alto={24} al="center">Fecha</Td>
        <Td al="center">Vale #</Td>
        <Td al="center">{asignado ? 'Solicitado por' : 'Responsable'}</Td>
        <Td al="center">Galones</Td>
        <Td al="center">{asignado ? 'Monto fact.' : 'Monto'}</Td>
        {asignado ? (
          <>
            <Td colSpan={2} al="center" style={{ lineHeight: 1.1 }}>
              Km X Gl
              <br />
              <span style={{ fontSize: pt(7) }}>ANTERIOR&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;ACTUAL</span>
            </Td>
            <Td al="center" style={{ lineHeight: 1.1 }}>
              Kms
              <br />
              Recorridos
            </Td>
            <Td al="center">Km X Gl</Td>
          </>
        ) : (
          <>
            <Td al="center">Vehículo</Td>
            <Td al="center">Propietario</Td>
            <Td al="center">Observaciones</Td>
            <Td al="center">Placa</Td>
          </>
        )}
      </tr>

      {/* ── Los renglones ─────────────────────────────────────────── */}
      {filas.map((f) => (
        <tr key={f.id}>
          <Td alto={16.15} al="center">{f.fecha ? formatDateShort(f.fecha) : ''}</Td>
          <Td al="center">{f.vale_num ?? ''}</Td>
          <Td>{f.vale_a ?? ''}</Td>
          <Td al="right">{num(f.galones, 3)}</Td>
          <Td al="right">{num(f.monto)}</Td>
          {asignado ? (
            <>
              <Td al="right">{num(f.km_ultima_llenada, 0)}</Td>
              <Td al="right">{num(f.kilometraje_actual, 0)}</Td>
              <Td al="right">
                {recorridos(f) ? num(recorridos(f), 0) : ''}
              </Td>
              <Td al="right">
                {recorridos(f) && f.galones ? num(recorridos(f) / f.galones, 2) : ''}
              </Td>
            </>
          ) : (
            <>
              <Td>{f.vehiculo_desc ?? ''}</Td>
              <Td>{f.propietario ?? ''}</Td>
              <Td>{f.observaciones ?? ''}</Td>
              <Td al="center">{f.placa_libre ?? ''}</Td>
            </>
          )}
        </tr>
      ))}

      {/* Renglones en blanco: la hoja se usa tambien a mano. */}
      {Array.from({ length: vacias }, (_, i) => (
        <tr key={`vacia-${i}`}>
          {Array.from({ length: NCOL }, (__, j) => (
            <Td key={j} alto={16.15} />
          ))}
        </tr>
      ))}

      {/* ── Totalizado ────────────────────────────────────────────── */}
      <tr style={{ fontWeight: 700 }}>
        <Td colSpan={2} alto={18} sinBorde />
        <Td al="right" style={{ borderTop: GRUESA }}>
          Totalizado:
        </Td>
        <Td al="right">{num(totalGalones, 3)}</Td>
        <Td al="right">{num(totalMonto)}</Td>
        {asignado ? (
          <>
            <Td colSpan={2} sinBorde />
            <Td al="right">{num(totalKms, 0)}</Td>
            <Td sinBorde />
          </>
        ) : (
          <>
            <Td colSpan={4} sinBorde />
          </>
        )}
      </tr>

      {asignado && (
        <tr>
          <Td colSpan={5} alto={18} sinBorde />
          <Td colSpan={3} al="right" style={{ fontWeight: 600 }}>
            Kilometros Recorridos por Galon
          </Td>
          <Td al="right" style={{ fontWeight: 700 }}>
            {totalGalones > 0 ? num(totalKms / totalGalones, 2) : num(0, 2)}
          </Td>
        </tr>
      )}
    </>
  );
}

export function ControlValesPrintable({ reporte, bloques, realizadoPor }: Props) {
  const ini = reporte.periodo_ini ? new Date(`${reporte.periodo_ini}T12:00:00`) : null;
  const fin = reporte.periodo_fin ? new Date(`${reporte.periodo_fin}T12:00:00`) : null;

  const totalGeneral = bloques.reduce(
    (a, b) => a + b.filas.reduce((x, f) => x + (f.monto ?? 0), 0),
    0,
  );

  return (
    <div
      className="printable"
      style={{
        width: SHEET_W,
        margin: '0 auto',
        fontFamily: '"Segoe UI", Calibri, Arial, sans-serif',
        fontSize: pt(9),
        color: '#000000',
        background: '#ffffff',
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <colgroup>
          {COL_W.map((w, i) => (
            <col key={i} style={{ width: w }} />
          ))}
        </colgroup>
        <tbody>
          {/* ── Encabezado de registro ─────────────────────────────── */}
          <tr>
            <Td colSpan={2} rowSpan={4} al="center" alto={18} style={{ padding: '2pt' }}>
              <img src={logoOl} alt="" style={{ height: pt(46), display: 'inline-block' }} />
            </Td>
            <Td colSpan={3} rowSpan={4} al="center" style={{ fontSize: pt(14), lineHeight: 1.15 }}>
              Registro
              <br />
              Control de Vales de Combustible
            </Td>
            <Td colSpan={2} style={{ fontWeight: 600 }}>Código:</Td>
            <Td colSpan={2} al="center">OL-RG-0270</Td>
          </tr>
          <tr>
            <Td colSpan={2} alto={18} style={{ fontWeight: 600 }}>Fecha:</Td>
            <Td colSpan={2} al="center">Septiembre 2024</Td>
          </tr>
          <tr>
            <Td colSpan={2} alto={18} style={{ fontWeight: 600 }}>Sub-Proceso:</Td>
            <Td colSpan={2} al="center">Operaciones</Td>
          </tr>
          <tr>
            <Td colSpan={2} alto={18} style={{ fontWeight: 600 }}>Versión:</Td>
            <Td colSpan={2} al="center">02</Td>
          </tr>

          <tr>
            <Td colSpan={NCOL} alto={10} sinBorde />
          </tr>

          {/* ── El periodo ─────────────────────────────────────────── */}
          <tr>
            <Td colSpan={NCOL} alto={18.75} sinBorde style={{ fontWeight: 700, fontSize: pt(11) }}>
              Vales de combustible del {ini ? ini.getDate() : '___'} al{' '}
              {fin ? fin.getDate() : '___'} de {fin ? MESES[fin.getMonth()] : '________'}{' '}
              {fin ? fin.getFullYear() : '____'}
            </Td>
          </tr>

          {bloques.map((b) => (
            <Fragment key={b.responsable.id}>
              <Cuadro bloque={b} />
            </Fragment>
          ))}

          {/* ── Pie: quien lo hizo y el total por vehiculo ─────────── */}
          <tr>
            <Td colSpan={NCOL} alto={24} sinBorde />
          </tr>
          <tr>
            <Td colSpan={3} alto={15} style={{ fontWeight: 600 }}>
              Realizado Por
            </Td>
            <Td colSpan={2} sinBorde />
            <Td colSpan={4} al="center" style={{ fontWeight: 700 }}>
              Total por vehículo
            </Td>
          </tr>
          {bloques.map((b, i) => {
            const subtotal = b.filas.reduce((x, f) => x + (f.monto ?? 0), 0);
            return (
              <tr key={`tot-${b.responsable.id}`}>
                <Td colSpan={3} alto={15} sinBorde style={{ fontWeight: i === 0 ? 700 : 400 }}>
                  {i === 0 ? (realizadoPor?.nombre ?? '') : i === 1 ? (realizadoPor?.puesto ?? '') : ''}
                </Td>
                <Td colSpan={2} sinBorde />
                <Td colSpan={3}>
                  {b.responsable.tipo_bloque === 'vehiculo_asignado' ? b.puesto : b.nombre}
                </Td>
                <Td al="right">{num(subtotal)}</Td>
              </tr>
            );
          })}
          <tr style={{ fontWeight: 700 }}>
            <Td colSpan={5} alto={15} sinBorde />
            <Td colSpan={3} al="right">TOTAL</Td>
            <Td al="right">{num(totalGeneral)}</Td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

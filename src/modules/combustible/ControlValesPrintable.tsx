import { Fragment, useEffect, type CSSProperties, type ReactNode } from 'react';
import { formatDateShort } from '@/lib/dates';
import type { Reporte, Responsable, Solicitud } from './api';
import logoOl from './logo-ol.png';

/**
 * Replica del formato oficial OL-RG-0270 v02 · Operaciones (hoja «Control de
 * Vales» del libro que entrego la usuaria). Es el documento que sustenta la
 * solicitud de pago de la quincena.
 *
 * SE RECONSTRUYO CELDA POR CELDA desde el .xlsx, no de memoria: anchos de
 * columna, altos de fila, combinaciones y que lado de cada celda lleva linea.
 * Las tres cosas que estaban mal y se notaban al imprimir:
 *
 *   1. LA ORIENTACION. El page setup del .xlsx viene en «landscape» y asi se
 *      reconstruyo. Pero el papel que ella usa es VERTICAL --fase 59, al
 *      imprimirlo de verdad: «me sale en HORIZONTAL, tiene que ser en
 *      vertical»--. Manda el papel, no el archivo: el .xlsx es la fuente de
 *      la geometria del cuadro, no de como se imprime. El `@page` global del
 *      proyecto ya es vertical, asi que este documento solo ajusta su margen.
 *
 *   2. LA HOJA NO EMPIEZA EN LA COLUMNA B. El area de impresion es A1:K107:
 *      A (2.1 de ancho) y K (3.3) son margenes interiores, no columnas con
 *      datos. Sin ellas el cuadro se pega a los bordes del papel.
 *
 *   3. EL «Totalizado» ES UNA BANDA CERRADA de lado a lado, no tres celdas
 *      sueltas con una raya encima.
 *
 * GEOMETRIA. Once columnas. El ancho de Excel se pasa a pixeles con la
 * formula de Calibri 11 (px = ancho*7 + 5) y de ahi a porcentaje, que es lo
 * que aguanta el cambio de tamano de papel:
 *
 *   A 2.11  B 9.55  C 9.55  D 20.0  E 9.55  F 9.55
 *   G 20.0  H 12.66 I 14.0  J 9.55  K 3.33   = 894 px
 *
 * DOS DISPOSICIONES DE COLUMNAS, y la diferencia es de fondo:
 *
 *   · vehiculo_asignado -- el gerente tiene SU carro, asi que el cuadro
 *     persigue el kilometraje: Km x Gl anterior/actual, Kms recorridos.
 *   · varios -- el carro cambia en cada renglon, asi que en lugar del
 *     kilometraje se anotan vehiculo, propietario, observaciones y placa.
 *
 * Los dos son independientes de que el cuadro tenga vehiculo: en la hoja
 * original, el del mensajero lleva columnas de «varios» y aun asi su moto
 * sale en la cabecera.
 */

const pt = (v: number) => `${+v.toFixed(2)}pt`;

const LINEA = '0.75pt solid #000000';

/** Porcentaje de cada columna sobre los 894 px del area de impresion. */
const COL_W = [
  '2.211%', //  A · margen interior
  '8.039%', //  B · Fecha
  '8.039%', //  C · Vale #
  '16.217%', // D · Solicitado por / Responsable
  '8.039%', //  E · Galones
  '8.039%', //  F · Monto
  '16.217%', // G · Km x Gl ANTERIOR | Vehiculo
  '10.473%', // H · Km x Gl ACTUAL   | Propietario
  '11.519%', // I · Kms recorridos   | Observaciones
  '8.039%', //  J · Km x Gl          | Placa
  '3.167%', //  K · margen interior
];
const NCOL = COL_W.length;

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/** Cuantos renglones deja cada cuadro como minimo, para escribir a mano. */
const RENGLONES_MINIMOS = 4;

function num(n: number | null | undefined, dec = 2): string {
  if (n == null) return '';
  return n.toLocaleString('es-GT', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

/** Que lados llevan linea. Por omision los cuatro. */
type Lados = { l?: boolean; t?: boolean; r?: boolean; b?: boolean };

function Td({
  children,
  colSpan,
  rowSpan,
  style,
  alto,
  al = 'center',
  lados,
  sinBorde,
  tam,
  negrita,
}: {
  children?: ReactNode;
  colSpan?: number;
  rowSpan?: number;
  style?: CSSProperties;
  alto?: number;
  al?: 'left' | 'center' | 'right';
  lados?: Lados;
  sinBorde?: boolean;
  tam?: number;
  negrita?: boolean;
}) {
  const s: Lados = sinBorde
    ? { l: false, t: false, r: false, b: false }
    : { l: true, t: true, r: true, b: true, ...lados };
  return (
    <td
      colSpan={colSpan}
      rowSpan={rowSpan}
      style={{
        borderLeft: s.l ? LINEA : 'none',
        borderTop: s.t ? LINEA : 'none',
        borderRight: s.r ? LINEA : 'none',
        borderBottom: s.b ? LINEA : 'none',
        padding: '0.5pt 2pt',
        height: alto ? pt(alto) : undefined,
        textAlign: al,
        verticalAlign: 'middle',
        fontSize: tam ? pt(tam) : undefined,
        fontWeight: negrita ? 700 : undefined,
        ...style,
      }}
    >
      {children}
    </td>
  );
}

/** Las columnas A y K son margen: van siempre, vacias y sin linea. */
const Margen = () => <Td sinBorde />;

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

/** Los kilometros de un renglon son la RESTA, no la lectura del odometro. */
const recorridos = (f: Solicitud) =>
  f.kilometraje_actual != null && f.km_ultima_llenada != null
    ? f.kilometraje_actual - f.km_ultima_llenada
    : 0;

function Cuadro({ bloque }: { bloque: Bloque }) {
  const { responsable, nombre, puesto, vehiculo, filas } = bloque;
  const asignado = responsable.tipo_bloque === 'vehiculo_asignado';

  const totalGalones = filas.reduce((a, f) => a + (f.galones ?? 0), 0);
  const totalMonto = filas.reduce((a, f) => a + (f.monto ?? 0), 0);
  const totalKms = filas.reduce((a, f) => a + recorridos(f), 0);

  const vacias = Math.max(0, RENGLONES_MINIMOS - filas.length);

  return (
    <>
      {/* separador entre cuadros */}
      <tr>
        <Td colSpan={NCOL} alto={10} sinBorde />
      </tr>

      {/* ── Marca y tipo de vehiculo (fila 9 del original) ────────── */}
      <tr>
        <Margen />
        <Td colSpan={3} alto={16.9} al="left" negrita>
          Marca del Vehículo
        </Td>
        <Td colSpan={3} tam={11} negrita>
          {vehiculo?.marca ?? 'varios'}
        </Td>
        <Td lados={{ r: false }} al="left" negrita>
          Tipo de Vehículo
        </Td>
        <Td colSpan={2} lados={{ l: false }} tam={10} negrita>
          {vehiculo?.tipo ?? 'VEHÍCULOS VARIOS'}
        </Td>
        <Margen />
      </tr>

      {/* ── Responsable (fila 10) ─────────────────────────────────── */}
      {/*
        El reparto de columnas cambia entre los dos tipos de cuadro, tal como
        en la hoja: con vehiculo asignado la etiqueta ocupa B:C y el cargo va
        en D; en los de varios la etiqueta es solo B y el cargo ocupa C:D,
        que es mas largo --ahi caben «DEPARTAMENTO DE COMPRAS».
      */}
      <tr>
        <Margen />
        <Td colSpan={asignado ? 2 : 1} alto={16.9} lados={{ r: false }} al="left" negrita>
          Responsable:
        </Td>
        {/* Un respiro a la izquierda: la etiqueta de al lado no lleva linea
            que las separe, y en vertical --columnas mas estrechas-- el valor
            quedaba pegado al «Responsable:». */}
        <Td
          colSpan={asignado ? 1 : 2}
          tam={11}
          negrita
          al={asignado ? 'left' : 'center'}
          style={{ paddingLeft: pt(6) }}
        >
          {puesto}
        </Td>
        <Td colSpan={3} lados={{ l: false }} tam={11} negrita>
          {nombre}
        </Td>
        {/* La placa solo sale aqui en los cuadros de vehiculo asignado; en
            los de varios va por renglon, en su propia columna. */}
        <Td lados={{ r: false }} tam={10} negrita>
          {asignado ? 'PLACA' : ''}
        </Td>
        <Td colSpan={2} lados={{ l: false }} tam={11} negrita>
          {asignado ? (vehiculo?.placa ?? '') : ''}
        </Td>
        <Margen />
      </tr>

      {/* ── Cabecera de columnas (fila 11, alto 24) ───────────────── */}
      <tr>
        <Margen />
        <Td alto={24} negrita>Fecha</Td>
        <Td negrita>Vale #</Td>
        <Td negrita>{asignado ? 'Solicitado por' : 'Responsable'}</Td>
        <Td negrita>Galones</Td>
        <Td negrita style={{ lineHeight: 1.05 }}>
          {asignado ? (
            <>
              Monto
              <br />
              fact.
            </>
          ) : (
            'Monto'
          )}
        </Td>
        {asignado ? (
          <>
            <Td colSpan={2} negrita style={{ lineHeight: 1.05 }}>
              Km X Gl
              <br />
              <span style={{ fontSize: pt(8) }}>ANTERIOR&nbsp;&nbsp;&nbsp;&nbsp;ACTUAL</span>
            </Td>
            <Td negrita style={{ lineHeight: 1.05 }}>
              Kms
              <br />
              Recorridos
            </Td>
            <Td negrita>Km X Gl</Td>
          </>
        ) : (
          <>
            <Td negrita>Vehiculo</Td>
            <Td negrita>Propietario</Td>
            <Td negrita>Observaciones</Td>
            <Td negrita>Placa</Td>
          </>
        )}
        <Margen />
      </tr>

      {/* ── Los renglones ─────────────────────────────────────────── */}
      {filas.map((f) => (
        <tr key={f.id}>
          <Margen />
          <Td alto={16.15}>{f.fecha ? formatDateShort(f.fecha) : ''}</Td>
          <Td>{f.vale_num ?? ''}</Td>
          <Td>{f.vale_a ?? ''}</Td>
          <Td>{num(f.galones, 3)}</Td>
          <Td>{num(f.monto)}</Td>
          {asignado ? (
            <>
              <Td>{num(f.km_ultima_llenada, 0)}</Td>
              <Td>{num(f.kilometraje_actual, 0)}</Td>
              <Td>{recorridos(f) ? num(recorridos(f), 0) : ''}</Td>
              <Td>{recorridos(f) && f.galones ? num(recorridos(f) / f.galones, 2) : ''}</Td>
            </>
          ) : (
            <>
              <Td>{f.vehiculo_desc ?? ''}</Td>
              <Td>{f.propietario ?? ''}</Td>
              <Td>{f.observaciones ?? ''}</Td>
              <Td>{f.placa_libre ?? ''}</Td>
            </>
          )}
          <Margen />
        </tr>
      ))}

      {/* Renglones en blanco: la hoja tambien se llena a mano. */}
      {Array.from({ length: vacias }, (_, i) => (
        <tr key={`vacia-${i}`}>
          <Margen />
          {Array.from({ length: 9 }, (__, j) => (
            <Td key={j} alto={16.15} />
          ))}
          <Margen />
        </tr>
      ))}

      {/* ── Totalizado · banda cerrada de lado a lado (fila 16) ───── */}
      <tr>
        <Margen />
        <Td colSpan={2} alto={18} lados={{ r: false }} negrita />
        <Td lados={{ l: false }} al="right" negrita>
          Totalizado:
        </Td>
        <Td negrita>{num(totalGalones, 3)}</Td>
        <Td negrita>{num(totalMonto)}</Td>
        {asignado ? (
          <>
            <Td colSpan={2} lados={{ r: false }} negrita />
            <Td lados={{ l: false }} negrita>
              {num(totalKms, 0)}
            </Td>
            <Td negrita />
          </>
        ) : (
          <Td colSpan={4} negrita />
        )}
        <Margen />
      </tr>

      {/* ── Kilometros por galon (fila 17) ────────────────────────── */}
      {asignado && (
        <tr>
          <Margen />
          <Td colSpan={5} alto={18} lados={{ l: false, t: false, r: false }} />
          <Td colSpan={3} negrita>
            Kilometros Recorridos por Galon
          </Td>
          <Td negrita>{totalGalones > 0 ? num(totalKms / totalGalones, 2) : num(0, 2)}</Td>
          <Margen />
        </tr>
      )}
    </>
  );
}

export function ControlValesPrintable({ reporte, bloques, realizadoPor }: Props) {
  /**
   * Vertical, como el papel. El `@page` global ya lo es; esto solo aprieta el
   * margen a 10mm --el de la hoja original-- porque con los 12mm del proyecto
   * las once columnas quedan mas estrechas de lo que deben. Se retira al
   * cerrarse, y solo hay un imprimible abierto a la vez, asi que no se pisan.
   */
  useEffect(() => {
    const el = document.createElement('style');
    el.textContent = '@media print { @page { size: letter portrait; margin: 10mm; } }';
    document.head.appendChild(el);
    return () => {
      el.remove();
    };
  }, []);

  const ini = reporte.periodo_ini ? new Date(`${reporte.periodo_ini}T12:00:00`) : null;
  const fin = reporte.periodo_fin ? new Date(`${reporte.periodo_fin}T12:00:00`) : null;

  const subtotal = (b: Bloque) => b.filas.reduce((x, f) => x + (f.monto ?? 0), 0);
  const totalGeneral = bloques.reduce((a, b) => a + subtotal(b), 0);

  /**
   * En el «Total por vehiculo» del pie, la fila se llama por el CARGO o el
   * departamento --«Gerente Administrativo», «Departamento de Compras»--,
   * nunca por el nombre de la persona. Asi esta en la hoja original, y tiene
   * sentido: lo que se reparte es el gasto de un puesto, no el de alguien.
   */
  const etiquetaDe = (b: Bloque) => b.responsable.etiqueta ?? b.puesto;

  // El pie lleva dos columnas a la vez: la firma a la izquierda --cuatro
  // renglones-- y la lista de totales a la derecha, que es tan larga como
  // cuadros haya. Se recorren juntas.
  const firma = ['', 'Realizado Por', realizadoPor?.nombre ?? '', realizadoPor?.puesto ?? ''];
  // +2: la cabecera «Total por vehiculo» arriba y el TOTAL al final.
  const filasPie = Math.max(firma.length, bloques.length + 2);

  return (
    <div
      className="printable"
      style={{
        width: '100%',
        margin: '0 auto',
        fontFamily: 'Calibri, "Segoe UI", Arial, sans-serif',
        fontSize: pt(9),
        lineHeight: 1.15,
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
          {/* ── Encabezado de registro (filas 1-4) ─────────────────── */}
          <tr>
            <Margen />
            <Td colSpan={2} rowSpan={4} alto={18} style={{ padding: '2pt' }}>
              <img src={logoOl} alt="" style={{ height: pt(48), display: 'inline-block' }} />
            </Td>
            <Td colSpan={3} rowSpan={4} tam={14} negrita style={{ lineHeight: 1.2 }}>
              Registro
              <br />
              Control de Vales de Combustible
            </Td>
            <Td colSpan={2} negrita>Código:</Td>
            <Td colSpan={2} negrita>OL-RG-0270</Td>
            <Margen />
          </tr>
          <tr>
            <Margen />
            <Td colSpan={2} alto={18} negrita>Fecha:</Td>
            <Td colSpan={2} negrita>Septiembre 2024</Td>
            <Margen />
          </tr>
          <tr>
            <Margen />
            <Td colSpan={2} alto={18} negrita>Sub-Proceso:</Td>
            <Td colSpan={2} negrita>Operaciones</Td>
            <Margen />
          </tr>
          <tr>
            <Margen />
            <Td colSpan={2} alto={18} negrita>Versión:</Td>
            <Td colSpan={2} negrita>02</Td>
            <Margen />
          </tr>

          <tr>
            <Td colSpan={NCOL} alto={14} sinBorde />
          </tr>

          {/* ── El periodo (fila 7): banda sin lineas interiores ───── */}
          <tr>
            <Margen />
            <Td colSpan={9} alto={18.75} tam={13} negrita>
              Vales de combustible del {ini ? ini.getDate() : '___'} al{' '}
              {fin ? fin.getDate() : '___'} de {fin ? MESES[fin.getMonth()] : '________'}{' '}
              {fin ? fin.getFullYear() : '____'}
            </Td>
            <Margen />
          </tr>

          {bloques.map((b) => (
            <Fragment key={b.responsable.id}>
              <Cuadro bloque={b} />
            </Fragment>
          ))}

          {/* ── Pie: la firma y el total por vehiculo (filas 87-96) ── */}
          <tr>
            <Td colSpan={NCOL} alto={26} sinBorde />
          </tr>
          {Array.from({ length: filasPie }, (_, i) => {
            const b = bloques[i - 1];
            const esTotal = i === bloques.length + 1;
            return (
              <tr key={`pie-${i}`}>
                <Margen />
                {i < firma.length ? (
                  <Td
                    colSpan={3}
                    alto={15.75}
                    lados={{ t: i === 0, b: i === firma.length - 1 }}
                    negrita={i !== 1}
                  >
                    {firma[i]}
                  </Td>
                ) : (
                  <Td colSpan={3} alto={15.75} sinBorde />
                )}
                <Td colSpan={2} sinBorde />
                {i === 0 ? (
                  <Td colSpan={2} negrita>
                    Total por vehículo
                  </Td>
                ) : b ? (
                  <>
                    <Td al="left" negrita>
                      {etiquetaDe(b)}
                    </Td>
                    <Td al="right" negrita>
                      {num(subtotal(b))}
                    </Td>
                  </>
                ) : esTotal ? (
                  <>
                    <Td al="left" sinBorde negrita>
                      TOTAL
                    </Td>
                    <Td al="right" sinBorde negrita>
                      {num(totalGeneral)}
                    </Td>
                  </>
                ) : (
                  <Td colSpan={2} sinBorde />
                )}
                <Td colSpan={2} sinBorde />
                <Margen />
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

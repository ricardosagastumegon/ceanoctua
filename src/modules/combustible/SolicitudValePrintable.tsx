import type { CSSProperties, ReactNode } from 'react';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import type { DatosVale } from './documento';
import logoOl from './logo-ol.png';

/**
 * Replica del formato oficial OL-RG-0175 v02 · Operaciones (hoja «Solicitud de
 * Vale» del libro que entrego la asistente el 5 nov 2026). Es el documento que
 * el chofer baja al Tesorero, asi que este componente debe seguir siendo un
 * espejo exacto de la hoja: mismos textos fijos, mismas filas, mismo orden.
 *
 * No agregar campos ni branding de la app. Si el Excel cambia, se ajusta aqui
 * y se deja constancia de la version en la bitacora.
 *
 * GEOMETRIA. Los anchos son el porcentaje que cada columna ocupa en el Excel
 * (B=14.33 C=36.33 D=14.0 E=13.55 F=11.55, sobre un total de 89.76) y las
 * alturas son los puntos originales. Las columnas E y F van juntas: el Excel
 * no las combina, pero ninguna fila escribe en F, asi que visualmente son una
 * sola celda de valor --y asi se ve en la hoja impresa.
 *
 * COLORES. Se comprobo en el XML: todo el texto es `theme=1`, que en el tema
 * del libro es dk1 = negro. La captura que circulo mostraba las etiquetas en
 * naranja y los valores en verde --los accent2 y accent3 del tema-- pero eso
 * es de la herramienta que hizo la captura, no del archivo.
 */

const K = 1;
const SHEET_W = '175mm';
const pt = (v: number) => `${+(v * K).toFixed(2)}pt`;

const LINEA = '1px solid #000000';

// B · C · D · E. La columna F del Excel existe pero NINGUNA fila escribe en
// ella y queda fuera del area impresa, asi que no entra en el reparto: sobre
// B..E (14.33 + 36.33 + 14.0 + 13.55 = 78.21) los porcentajes son estos, y
// cuadran con la hoja --la etiqueta "Monto del Vale:" termina en 64.77%, que
// es donde la parte el formato original.
const COL_W = ['18.32%', '46.45%', '17.90%', '17.33%'];

/**
 * Recibe el documento ya aplanado (`DatosVale`) y no la fila de la base, para
 * que el Tesorero pueda abrir el MISMO papel desde su bandeja: el no lee
 * `comb_solicitudes`, le llega una copia dentro del envio. Ver `documento.ts`.
 */
type Props = {
  datos: DatosVale;
};

function Celda({
  children,
  colSpan,
  rowSpan,
  style,
  alto,
  centrado,
  sinBorde,
}: {
  children?: ReactNode;
  colSpan?: number;
  rowSpan?: number;
  style?: CSSProperties;
  alto?: number;
  centrado?: boolean;
  sinBorde?: boolean;
}) {
  return (
    <td
      colSpan={colSpan}
      rowSpan={rowSpan}
      style={{
        border: sinBorde ? 'none' : LINEA,
        padding: '1pt 4pt',
        height: alto ? pt(alto) : undefined,
        textAlign: centrado ? 'center' : 'left',
        verticalAlign: 'middle',
        ...style,
      }}
    >
      {children}
    </td>
  );
}

/** Una fila de «etiqueta | dato | etiqueta | dato». */
function FilaDoble({
  etiqueta1,
  valor1,
  etiqueta2,
  valor2,
}: {
  etiqueta1: string;
  valor1?: ReactNode;
  etiqueta2: string;
  valor2?: ReactNode;
}) {
  return (
    <tr>
      <Celda alto={15} style={{ fontWeight: 600 }}>
        {etiqueta1}
      </Celda>
      <Celda>{valor1}</Celda>
      <Celda style={{ fontWeight: 600 }}>{etiqueta2}</Celda>
      <Celda>{valor2}</Celda>
    </tr>
  );
}

export function SolicitudValePrintable({ datos: s }: Props) {
  const marca = s.marca ?? '';
  const placa = s.placa ?? '';
  const tipo = s.tipo ?? '';

  return (
    <div
      className="printable"
      style={{
        width: SHEET_W,
        margin: '0 auto',
        fontFamily: '"Segoe UI", Calibri, Arial, sans-serif',
        fontSize: pt(11),
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
          {/* ── Encabezado de registro · filas 4-7 ─────────────────── */}
          <tr>
            <Celda
              alto={13.9}
              centrado
              // El logo y el titulo ocupan las cuatro filas del encabezado.
              rowSpan={4}
              style={{ verticalAlign: 'middle', padding: '2pt' }}
            >
              <img src={logoOl} alt="" style={{ height: pt(42), display: 'inline-block' }} />
            </Celda>
            <Celda
              centrado
              rowSpan={4}
              style={{ fontSize: pt(14), lineHeight: 1.15, padding: '2pt 4pt' }}
            >
              Registro
              <br />
              Autorización de vales para combustibles
            </Celda>
            <Celda alto={13.9} style={{ fontSize: pt(9), fontWeight: 600 }}>
              Código:
            </Celda>
            <Celda centrado style={{ fontSize: pt(9) }}>
              OL-RG-0175
            </Celda>
          </tr>
          <tr>
            <Celda alto={13.9} style={{ fontSize: pt(9), fontWeight: 600 }}>
              Fecha:
            </Celda>
            <Celda centrado style={{ fontSize: pt(9) }}>
              Septiembre 2024
            </Celda>
          </tr>
          <tr>
            <Celda alto={13.9} style={{ fontSize: pt(9), fontWeight: 600 }}>
              Sub-Proceso:
            </Celda>
            <Celda centrado style={{ fontSize: pt(9) }}>
              Operaciones
            </Celda>
          </tr>
          <tr>
            <Celda alto={14.45} style={{ fontSize: pt(9), fontWeight: 600 }}>
              Versión:
            </Celda>
            <Celda centrado style={{ fontSize: pt(9) }}>
              02
            </Celda>
          </tr>

          {/* separador · fila 8 */}
          <tr>
            <Celda colSpan={4} alto={8.25} sinBorde />
          </tr>

          {/* ── Los datos · filas 9-12 ─────────────────────────────── */}
          <FilaDoble
            etiqueta1="Fecha:"
            valor1={s.fecha ? formatDate(s.fecha) : ''}
            etiqueta2="No. Vale"
            valor2={s.vale_num ?? ''}
          />
          <FilaDoble
            etiqueta1="Vale a:"
            valor1={s.vale_a ?? ''}
            etiqueta2="No. Placa"
            valor2={placa}
          />
          <FilaDoble
            etiqueta1="Marca:"
            valor1={marca}
            etiqueta2="Tipo vehículo:"
            valor2={tipo}
          />
          <tr>
            <Celda alto={15} style={{ fontWeight: 600 }}>
              Departamento:
            </Celda>
            {/* C12:E12 combinadas en el Excel */}
            <Celda colSpan={3}>{s.departamento ?? ''}</Celda>
          </tr>

          {/* separador · fila 13 */}
          <tr>
            <Celda colSpan={4} alto={5.45} sinBorde />
          </tr>

          {/* ── Justificación · banda negra + caja · filas 14-15 ───── */}
          <tr>
            <Celda
              colSpan={4}
              alto={15}
              centrado
              style={{ background: '#000000', color: '#ffffff', fontWeight: 600 }}
            >
              Justificación
            </Celda>
          </tr>
          <tr>
            <Celda colSpan={4} alto={49.5} style={{ verticalAlign: 'top', padding: '3pt 4pt' }}>
              {s.justificacion ?? ''}
            </Celda>
          </tr>

          {/* ── Firmas · filas 16-18 ───────────────────────────────── */}
          <tr>
            <Celda colSpan={2} alto={15} centrado style={{ fontWeight: 600 }}>
              Autorizado por:
            </Celda>
            <Celda colSpan={2} centrado style={{ fontWeight: 600 }}>
              Solicitado por:
            </Celda>
          </tr>
          <tr>
            <Celda colSpan={2} alto={15} centrado>
              Firma
            </Celda>
            <Celda colSpan={2} centrado>
              Firma
            </Celda>
          </tr>
          <tr>
            <Celda colSpan={2} alto={15} centrado>
              {s.autorizado_por ?? 'Lissa Arriaza'}
            </Celda>
            <Celda colSpan={2} centrado>
              {s.solicitado_por ?? ''}
            </Celda>
          </tr>

          {/* separador · fila 19 */}
          <tr>
            <Celda colSpan={4} alto={15} sinBorde />
          </tr>

          {/* ── Cierre · filas 20-22 ───────────────────────────────── */}
          <tr>
            <Celda colSpan={2} alto={15} style={{ fontWeight: 600 }}>
              Monto del Vale:
            </Celda>
            <Celda colSpan={2}>
              {s.monto_autorizado != null ? formatMoney(s.monto_autorizado) : ''}
            </Celda>
          </tr>
          <tr>
            <Celda colSpan={2} alto={15} style={{ fontWeight: 600 }}>
              Kilometraje actual:
            </Celda>
            <Celda colSpan={2}>{s.kilometraje_actual ?? ''}</Celda>
          </tr>
          <tr>
            <Celda colSpan={2} alto={15} style={{ fontWeight: 600 }}>
              Km. Ultima Llenada:
            </Celda>
            <Celda colSpan={2}>{s.km_ultima_llenada ?? ''}</Celda>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

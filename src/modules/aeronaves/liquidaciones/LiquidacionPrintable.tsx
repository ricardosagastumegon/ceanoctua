import { Fragment } from 'react';
import { formatDate } from '@/lib/dates';
import { CATEGORIA_LABEL, CATEGORIAS, MEDIO_LABEL, type Gasto, type Liquidacion } from './api';

/**
 * El formato que sustituye al PDF viejo.
 *
 * Los colores van en hex inline y no en clases de Tailwind: al imprimir,
 * Tailwind puede purgar lo que no vio en el HTML y la hoja sale en blanco y
 * negro. Es la misma razón por la que lo hacen los demás imprimibles.
 */

/**
 * Las categorías que se dibujan aunque vengan vacías: son las que el viaje
 * siempre podría tener, y verlas en cero es información.
 */
const SIEMPRE: readonly string[] = [
  'Combustible', 'Servicios aeroportuarios', 'Hotel y transporte', 'Alimentacion',
];

const TEAL = '#0f5e58';
const RUST = '#9a4a16';
const RUST_BG = '#fdf0e3';
const RUST_BORDE = '#e8c9a8';
const GRIS = '#78716c';
const GRIS_2 = '#57534e';
const TINTA = '#1c1917';
const LINEA = '#efeeec';
const SAND = '#e2e0dc';

function q(n: number | null | undefined): string {
  return `Q ${(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function d(n: number | null | undefined): string {
  return `$ ${(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function Dato({ k, v, ancho }: { k: string; v: string; ancho?: boolean }) {
  return (
    <div style={{
      padding: '7px 10px', borderRight: `1px solid ${SAND}`, borderBottom: `1px solid ${SAND}`,
      gridColumn: ancho ? 'span 2' : undefined,
    }}>
      <div style={{ fontSize: 8.5, letterSpacing: '.09em', color: GRIS, fontWeight: 700, textTransform: 'uppercase' }}>{k}</div>
      <div style={{ fontSize: 11.5, color: TINTA, marginTop: 2, fontWeight: 600 }}>{v || '—'}</div>
    </div>
  );
}

function Kpi({ k, valor, pie, destacado }: { k: string; valor: string; pie: string; destacado?: boolean }) {
  return (
    <div style={{
      border: destacado ? `1.5px solid #c2691f` : `1px solid ${SAND}`,
      borderRadius: 5, padding: '10px 13px',
      background: destacado ? RUST_BG : '#fafaf9',
    }}>
      <div style={{ fontSize: 8.5, letterSpacing: '.09em', fontWeight: 700, textTransform: 'uppercase', color: destacado ? RUST : GRIS }}>{k}</div>
      <div style={{ fontSize: destacado ? 23 : 20, fontWeight: 700, marginTop: 4, color: destacado ? RUST : TINTA }}>{valor}</div>
      <div style={{ fontSize: 10, marginTop: 1, color: destacado ? RUST : GRIS }}>{pie}</div>
    </div>
  );
}

const TH: React.CSSProperties = {
  background: '#f5f5f4', color: GRIS_2, fontSize: 8.5, letterSpacing: '.07em', fontWeight: 700,
  textTransform: 'uppercase', padding: '6px 7px', borderBottom: `1.5px solid #d6d3d1`,
  textAlign: 'left', whiteSpace: 'nowrap',
};
const TD: React.CSSProperties = { padding: 7, borderBottom: `1px solid ${LINEA}`, verticalAlign: 'top' };
const TD_R: React.CSSProperties = { ...TD, textAlign: 'right', whiteSpace: 'nowrap' };

export function LiquidacionPrintable({
  liquidacion: l,
  gastos,
  piloto,
  matricula,
}: {
  liquidacion: Liquidacion;
  gastos: Gasto[];
  piloto: string | null;
  matricula: string | null;
}) {
  const galones = gastos
    .filter((g) => g.categoria === 'Combustible')
    .reduce((t, g) => t + Number(g.galones ?? 0), 0);

  const dePiloto = gastos.filter((g) => g.pagado_por === 'piloto');

  return (
    <div style={{ fontFamily: '"Segoe UI",system-ui,sans-serif', color: TINTA, background: '#fff', padding: '4px 2px' }}>

      {/* Encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: `2.5px solid ${TEAL}`, paddingBottom: 12 }}>
        <div>
          <h1 style={{ fontSize: 17, letterSpacing: '.055em', color: TEAL, fontWeight: 700, margin: 0 }}>
            LIQUIDACIÓN DE VIAJE · PILOTO
          </h1>
          <div style={{ fontSize: 10.5, color: GRIS_2, marginTop: 3, letterSpacing: '.03em' }}>
            Transportes Lis, S.A. · Aeronaves
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: 'Consolas,monospace', fontSize: 15, fontWeight: 700, letterSpacing: '.04em' }}>
            {l.serial ?? '—'}
          </div>
          <div style={{
            display: 'inline-block', marginTop: 5, fontSize: 9, fontWeight: 700, letterSpacing: '.08em',
            background: RUST_BG, color: RUST, border: `1px solid ${RUST_BORDE}`, borderRadius: 3, padding: '2px 7px',
            textTransform: 'uppercase',
          }}>
            {l.estado === 'Reembolsada' ? 'Reembolsada' : l.estado === 'Borrador' ? 'Borrador' : 'Pendiente de reembolso'}
          </div>
        </div>
      </div>

      {/* Ficha del viaje */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', marginTop: 14,
        border: `1px solid ${SAND}`, borderRadius: 4, overflow: 'hidden',
      }}>
        <Dato k="Aeronave" v={matricula ?? '—'} />
        <Dato k="Ruta" v={l.ruta ?? ''} ancho />
        <Dato k="Fechas del viaje" v={`${formatDate(l.fecha_inicio)} — ${formatDate(l.fecha_fin)}`} />
        <Dato k="Piloto" v={piloto ?? '—'} />
        <Dato k="Motivo" v={l.motivo ?? ''} ancho />
        <Dato k="Pasajeros" v={l.pasajeros ?? ''} />
      </div>

      {/* Los tres números */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.25fr', gap: 10, marginTop: 16 }}>
        <Kpi k="Costo total del viaje" valor={q(l.total_gtq)} pie={d(l.total_usd)} />
        <Kpi k="Lo pagó la empresa" valor={q(l.empresa_gtq)}
          pie={`${gastos.filter((g) => g.pagado_por === 'empresa').length} gastos`} />
        <Kpi destacado k="A reembolsar al piloto" valor={q(l.piloto_gtq)}
          pie={`${d(l.piloto_usd)} · ${dePiloto.length} gastos`} />
      </div>

      {/* Los gastos */}
      <h2 style={{
        fontSize: 10, letterSpacing: '.1em', color: TEAL, fontWeight: 700, textTransform: 'uppercase',
        margin: '20px 0 7px', paddingBottom: 4, borderBottom: '1px solid #d6d3d1',
      }}>
        Gastos del viaje
      </h2>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10.5 }}>
        <thead>
          <tr>
            <th style={{ ...TH, width: 58 }}>Fecha</th>
            <th style={TH}>Proveedor y detalle</th>
            <th style={{ ...TH, width: 82 }}>Documento</th>
            <th style={{ ...TH, width: 66, textAlign: 'center' }}>Pagó</th>
            <th style={{ ...TH, width: 62 }}>Medio</th>
            <th style={{ ...TH, width: 92, textAlign: 'right' }}>Monto original</th>
            <th style={{ ...TH, width: 48, textAlign: 'right' }}>T.C.</th>
            <th style={{ ...TH, width: 88, textAlign: 'right' }}>Equivalente</th>
          </tr>
        </thead>
        <tbody>
          {CATEGORIAS.map((cat) => {
            const filas = gastos.filter((g) => g.categoria === cat);
            // Una categoría vacía SE DICE, pero solo si era de esperar: así
            // se distingue «no hubo hotel» de «se olvidó el hotel». «Otros» y
            // «Trámites» vacíos no dicen nada, así que no se dibujan.
            if (filas.length === 0 && !SIEMPRE.includes(cat)) return null;
            return (
              <Fragment key={cat}>
                    <tr>
                      <td colSpan={8} style={{
                        background: '#f0f8f7', fontSize: 8.5, letterSpacing: '.09em', fontWeight: 700,
                        color: TEAL, textTransform: 'uppercase', padding: '5px 7px', borderBottom: '1px solid #cfe4e1',
                      }}>
                        {CATEGORIA_LABEL[cat]}
                        {cat === 'Combustible' && galones > 0 && ` · ${galones.toLocaleString('en-US')} galones`}
                      </td>
                    </tr>
                    {filas.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ ...TD, color: '#a8a29e', fontStyle: 'italic', fontSize: 10 }}>
                          Sin gastos en esta categoría.
                        </td>
                      </tr>
                    ) : (
                      <>
                        {filas.map((g) => (
                          <tr key={g.id}>
                            <td style={TD}>{formatDate(g.fecha)}</td>
                            <td style={TD}>
                              <div style={{ fontWeight: 600 }}>{g.proveedor}</div>
                              {g.detalle && (
                                <div style={{ fontSize: 9.5, color: GRIS, marginTop: 2, lineHeight: 1.35 }}>
                                  {g.detalle}
                                  {g.galones != null && g.precio_unitario != null &&
                                    ` · ${Number(g.galones)} gal × ${g.moneda === 'USD' ? '$' : 'Q'}${Number(g.precio_unitario)}`}
                                </div>
                              )}
                              {g.categoria === 'Combustible' && (
                                g.registro_combustible_id ? (
                                  <div style={{
                                    display: 'inline-block', marginTop: 4, fontFamily: 'Consolas,monospace',
                                    fontSize: 8.5, fontWeight: 700, background: '#f3f0fa', color: '#5b3fa6',
                                    border: '1px solid #d8cff0', borderRadius: 3, padding: '1.5px 6px',
                                  }}>
                                    CON VALE
                                  </div>
                                ) : (
                                  <div style={{
                                    display: 'inline-block', marginTop: 4, fontSize: 8.5, color: '#a8a29e',
                                    border: '1px dashed #d6d3d1', borderRadius: 3, padding: '1.5px 6px',
                                  }}>
                                    sin vale · proveedor fuera de contrato
                                  </div>
                                )
                              )}
                            </td>
                            <td style={TD}>
                              {g.documento ? (
                                <span style={{ fontFamily: 'Consolas,monospace', fontSize: 9.5, color: '#44403c' }}>{g.documento}</span>
                              ) : (
                                <span style={{ fontSize: 9, color: '#a8a29e', fontStyle: 'italic' }}>
                                  {g.sin_documento ? 'sin documento' : 'pendiente'}
                                </span>
                              )}
                            </td>
                            <td style={{ ...TD, textAlign: 'center' }}>
                              <span style={{
                                display: 'inline-block', fontSize: 8.5, fontWeight: 700, letterSpacing: '.05em',
                                padding: '1.5px 6px', borderRadius: 3, whiteSpace: 'nowrap',
                                background: g.pagado_por === 'piloto' ? RUST_BG : '#eef4f3',
                                color: g.pagado_por === 'piloto' ? RUST : TEAL,
                                border: `1px solid ${g.pagado_por === 'piloto' ? RUST_BORDE : '#c5dcd9'}`,
                              }}>
                                {g.pagado_por === 'piloto' ? 'PILOTO' : 'EMPRESA'}
                              </span>
                            </td>
                            <td style={{ ...TD, fontSize: 9.5, color: GRIS_2 }}>{MEDIO_LABEL[g.medio] ?? g.medio}</td>
                            <td style={TD_R}>{g.moneda === 'USD' ? d(g.monto) : q(g.monto)}</td>
                            <td style={TD_R}>{Number(g.tipo_cambio).toFixed(4)}</td>
                            <td style={TD_R}>{g.moneda === 'USD' ? q(g.monto_gtq) : d(g.monto_usd)}</td>
                          </tr>
                        ))}
                        <tr>
                          <td colSpan={7} style={{ ...TD_R, background: '#fcfcfb', fontWeight: 700, fontSize: 10, borderBottom: '1px solid #d6d3d1', color: '#44403c' }}>
                            Subtotal {CATEGORIA_LABEL[cat].toLowerCase()}
                          </td>
                          <td style={{ ...TD_R, background: '#fcfcfb', fontWeight: 700, fontSize: 10, borderBottom: '1px solid #d6d3d1', color: '#44403c' }}>
                            {q(filas.reduce((t, g) => t + Number(g.monto_gtq), 0))}
                          </td>
                        </tr>
                      </>
                    )}
              </Fragment>
            );
          })}
        </tbody>
      </table>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 26, marginTop: 12, padding: '10px 7px', borderTop: `2.5px solid ${TEAL}` }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 8.5, letterSpacing: '.08em', color: GRIS, fontWeight: 700, textTransform: 'uppercase' }}>Total del viaje</div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{q(l.total_gtq)}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 8.5, letterSpacing: '.08em', color: GRIS, fontWeight: 700, textTransform: 'uppercase' }}>Equivalente</div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{d(l.total_usd)}</div>
        </div>
      </div>

      {/* El reembolso, línea por línea. Deja de ser una nota al pie. */}
      {dePiloto.length > 0 && (
        <div style={{ marginTop: 18, border: '1.5px solid #c2691f', borderRadius: 5, overflow: 'hidden' }}>
          <div style={{
            background: RUST_BG, padding: '8px 13px', display: 'flex',
            justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${RUST_BORDE}`,
          }}>
            <div style={{ fontSize: 10, letterSpacing: '.09em', fontWeight: 700, color: RUST, textTransform: 'uppercase' }}>
              A reembolsar al piloto {piloto ?? ''}
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: RUST }}>
              {q(l.piloto_gtq)} · {d(l.piloto_usd)}
            </div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
            <tbody>
              {dePiloto.map((g) => (
                <tr key={g.id}>
                  <td style={{ padding: '5.5px 13px', borderBottom: '1px solid #f5f0e9' }}>
                    {g.proveedor}
                    {g.detalle ? ` · ${g.detalle}` : ''}
                  </td>
                  <td style={{ padding: '5.5px 13px', borderBottom: '1px solid #f5f0e9', width: 100, fontFamily: 'Consolas,monospace', fontSize: 9.5 }}>
                    {g.documento ?? (g.sin_documento ? 'sin documento' : '—')}
                  </td>
                  <td style={{ padding: '5.5px 13px', borderBottom: '1px solid #f5f0e9', width: 100, textAlign: 'right' }}>
                    {q(g.monto_gtq)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Los dos tipos de cambio, declarados. */}
      <div style={{ marginTop: 16, display: 'flex', gap: 9, fontSize: 9.5, color: GRIS_2 }}>
        <div style={{ border: `1px solid ${SAND}`, borderRadius: 4, padding: '7px 11px', background: '#fafaf9' }}>
          Gastos originados en quetzales → dólar: <b>{Number(l.tc_gtq_usd ?? 0).toFixed(4)}</b>
        </div>
        <div style={{ border: `1px solid ${SAND}`, borderRadius: 4, padding: '7px 11px', background: '#fafaf9' }}>
          Gastos originados en dólares → quetzal: <b>{Number(l.tc_usd_gtq ?? 0).toFixed(4)}</b>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 28, marginTop: 40 }}>
        {[
          { n: piloto ?? '', r: 'Piloto · liquida' },
          { n: '', r: 'Asistente · revisa' },
          { n: '', r: 'Gerencia · autoriza' },
        ].map((f, i) => (
          <div key={i} style={{ borderTop: `1px solid ${GRIS_2}`, paddingTop: 6, textAlign: 'center' }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, minHeight: 14 }}>{f.n}</div>
            <div style={{ fontSize: 8.5, letterSpacing: '.07em', color: GRIS, textTransform: 'uppercase', marginTop: 1 }}>{f.r}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 22, fontSize: 8.5, color: '#a8a29e', display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${LINEA}`, paddingTop: 7 }}>
        <span>{l.serial ?? ''} · generado el {formatDate(new Date())}</span>
        <span>CEA NOCTUA · Aeronaves · Liquidación Piloto</span>
      </div>
    </div>
  );
}

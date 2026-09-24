import { type ReactNode } from 'react';
import { PrintableModal } from '@/components/ui/PrintableModal';
import { SERVICE_META, type ServiceKey } from './constants/serviceMeta';
import { fmtMoney } from './utils';
import logoBlanco from './arriaza-logo-blanco.png';

type Props = {
  open: boolean;
  onClose: () => void;
  serviceKey: ServiceKey;
  title: string;
  subtitle?: string | null;
  /** Correlativo del viaje, para que la hoja se pueda rastrear. */
  tripNo?: string | null;
  total?: number | null;
  moneda?: string | null;
  estadoPago?: string | null;
  pagadoCon?: string | null;
  /**
   * El número que dio la OTA, el GDS o el prestador. Va arriba, junto a
   * «Reservado a través de», y no en el pie: es lo primero que se busca
   * cuando hay un problema con la reserva.
   */
  confirmacion?: string | null;
  cancelacion?: string | null;
  /** Filas del cuerpo, cada una label + valor. */
  rows: Array<{ label: string; value: ReactNode; destacado?: boolean }>;
  /** Bloques extra al final (pasajeros, habitaciones, tickets de actividad…). */
  extras?: ReactNode;
  /**
   * Franja sobre el encabezado. El hotel la usa para el rango de fechas, que
   * es lo primero que se busca en la hoja de una reserva.
   */
  band?: ReactNode;
  /**
   * Dato corto bajo el logo, alineado a la derecha. El ticket lo usa para la
   * fecha de salida y el PNR: es lo que se busca con la hoja en la mano.
   */
  headerRight?: ReactNode;
  /** Título a mayor tamaño cuando es el dato principal de la hoja. */
  titleSize?: 'normal' | 'grande';
  /**
   * 'compacto' aprieta los datos del encabezado en cuatro columnas. Sirve
   * cuando lo importante de la hoja está más abajo y estos son de referencia.
   */
  rowsLayout?: 'normal' | 'compacto';
  /**
   * Texto del pie. Casi todas las hojas son de uso interno, pero la de la
   * reunión se comparte con los participantes y decirles "uso interno" seria
   * contradecirse.
   */
  pie?: string;
};

/** Sin acentos ni mayúsculas, para comparar etiquetas sin depender de cómo se escribieron. */
const normalizar = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/**
 * Vista previa imprimible, compartida por los 11 servicios.
 *
 * Cada servicio entra con su propio color — el de `SERVICE_META` — así que la
 * hoja de un hotel y la de un vuelo se distinguen de un vistazo sin cambiar de
 * plantilla.
 *
 * El logo va como imagen importada: antes esto se armaba con `innerHTML` y un
 * helper que devolvía un placeholder de texto porque el logo real nunca se
 * había incorporado.
 */
export function ServicePrintable({
  open, onClose, serviceKey, title, subtitle, tripNo, total, moneda,
  estadoPago, pagadoCon, confirmacion, cancelacion, rows, extras, band,
  headerRight, titleSize = 'normal', rowsLayout = 'normal',
  pie = 'Arriaza Tour & Travel · Documento de uso interno',
}: Props) {
  const meta = SERVICE_META[serviceKey];

  // El número de confirmación va pegado a «Reservado a través de», que es su
  // contexto: quién hizo la reserva y con qué número.
  //
  // No basta con insertarlo después: como el bloque es una rejilla que se
  // llena por filas, «después» puede caer al inicio de la fila siguiente y
  // quedar en diagonal. Se saca la fila de su lugar y se vuelve a meter el
  // par junto, corriendo el arranque una casilla cuando caería partido entre
  // dos filas.
  const columnas = rowsLayout === 'compacto' ? 4 : 2;
  const filas = [...rows];
  if (confirmacion) {
    const conf = { label: 'N.º de confirmación', value: confirmacion, destacado: true };
    const i = filas.findIndex((f) => normalizar(f.label).startsWith('reservado a traves'));
    if (i < 0) {
      filas.unshift(conf);
    } else {
      const [reservado] = filas.splice(i, 1);
      const inicio = i % columnas === columnas - 1 ? i - 1 : i;
      filas.splice(Math.max(0, inicio), 0, reservado, conf);
    }
  }

  return (
    <PrintableModal open={open} onClose={onClose} title={`${meta.icon} ${meta.label} — ${title}`}>
      <article style={{ fontFamily: 'Nunito, sans-serif', color: '#321201' }}>
        {band && (
          <div
            className="px-8 py-2 font-heading text-lg font-extrabold text-white"
            style={{ background: meta.dark }}
          >
            {band}
          </div>
        )}
        {/* Encabezado con el color del servicio */}
        <header
          className="relative px-8 py-6 text-white"
          style={{ background: meta.grad ?? meta.dark }}
        >
          <div style={{ position: 'absolute', top: '1.1rem', right: '1.9rem', textAlign: 'right' }}>
            <img src={logoBlanco} alt="Arriaza Tour &amp; Travel" style={{ height: '38px' }} />
            {headerRight && (
              <div
                style={{
                  marginTop: '.5rem', fontSize: '.8rem', fontWeight: 800,
                  letterSpacing: '.04em', color: '#ffffff',
                }}
              >
                {headerRight}
              </div>
            )}
          </div>
          {/* El bloque del texto reserva el ancho del logo y del dato de la
              derecha. Sin esto, un titulo largo -- el nombre de un evento, por
              ejemplo -- se metia debajo del logo. */}
          <div style={{ paddingRight: '215px' }}>
          <div
            style={{
              fontSize: '.6rem', fontWeight: 800, letterSpacing: '.2em',
              textTransform: 'uppercase', color: 'rgba(255,255,255,.55)',
            }}
          >
            Servicio · {meta.label}
          </div>
          <div
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontSize: titleSize === 'grande' ? '2.4rem' : '1.6rem',
              fontWeight: 800, lineHeight: 1.1, marginTop: '.3rem',
            }}
          >
            {title}
          </div>
          {subtitle && (
            <div style={{ marginTop: '.4rem', fontSize: '.85rem', fontWeight: 600, color: 'rgba(255,255,255,.75)' }}>
              {subtitle}
            </div>
          )}
          {tripNo && (
            <div
              style={{
                marginTop: '.6rem', display: 'inline-block', borderRadius: '999px',
                background: 'rgba(255,255,255,.18)', padding: '.15rem .6rem',
                fontFamily: 'monospace', fontSize: '.7rem', fontWeight: 800,
              }}
            >
              {tripNo}
            </div>
          )}
          </div>
        </header>

        <section
          className={
            rowsLayout === 'compacto'
              ? 'grid grid-cols-4 gap-x-5 gap-y-3 px-8 pb-4 pt-5'
              : 'grid grid-cols-2 gap-x-8 gap-y-3 px-8 py-5'
          }
        >
          {filas.map(({ label, value, destacado }, i) => (
            <div
              key={i}
              style={
                destacado
                  ? {
                      borderLeft: `3px solid ${meta.solid}`,
                      backgroundColor: meta.light,
                      borderRadius: '4px',
                      padding: '.3rem .6rem',
                      marginTop: '-.3rem',
                    }
                  : undefined
              }
            >
              <span
                className="inline-block rounded px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider"
                style={
                  destacado
                    ? { backgroundColor: meta.solid, color: '#ffffff' }
                    : { backgroundColor: meta.light, color: meta.dark }
                }
              >
                {label}
              </span>
              {destacado ? (
                <div
                  className="mt-1 font-mono text-[15px] font-extrabold leading-snug"
                  style={{ color: meta.dark, letterSpacing: '.02em' }}
                >
                  {value ?? '—'}
                </div>
              ) : (
                <div className="mt-1 text-[13px] leading-snug text-dark">{value ?? '—'}</div>
              )}
            </div>
          ))}
        </section>

        {extras && <section className="px-8 pb-6 pt-2">{extras}</section>}

        {(total != null || estadoPago) && (
          <footer
            className="flex items-center justify-between px-8 py-4 text-white"
            style={{ background: meta.grad ?? meta.dark }}
          >
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-white/70">
                {meta.icon} Total del servicio
              </div>
              {pagadoCon && <div className="mt-0.5 text-[10px] text-white/60">Pagado con: {pagadoCon}</div>}
              {estadoPago && (
                <div className="mt-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white/70">
                  Estado: {estadoPago}
                </div>
              )}
            </div>
            {total != null && (
              <div className="font-heading text-2xl font-extrabold text-white">
                {moneda ? `${moneda} ${total.toFixed(2)}` : fmtMoney(total)}
              </div>
            )}
          </footer>
        )}

        {cancelacion && (
          <section className="border-t border-sand px-8 py-4 text-xs text-dark-3">
            <b>Cancelación:</b> {cancelacion}
          </section>
        )}

        <div
          className="px-8 py-2 text-center text-[10px] font-extrabold uppercase tracking-widest text-white/40"
          style={{ backgroundColor: meta.dark }}
        >
          {pie}
        </div>
      </article>
    </PrintableModal>
  );
}

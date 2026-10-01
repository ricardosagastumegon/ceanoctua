import { PrintableModal } from '@/components/ui/PrintableModal';
import { formatDate } from '@/lib/dates';
import { acento } from '../constants';
import type { Aeronave } from '../api';
import { rotuloMando, type VueloCompleto } from './api';

const h1 = (n: number) => Number(n).toFixed(1);
const hhmm = (v: string | null | undefined) => (v ? v.slice(0, 5) : '—');

type Props = {
  aeronave: Aeronave;
  vuelo: VueloCompleto;
  onClose: () => void;
};

function Dato({ label, value, color }: {
  label: string;
  value: string | number | null | undefined;
  color: { dark: string; light: string };
}) {
  return (
    <div>
      <span
        className="inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider"
        style={{ backgroundColor: color.light, color: color.dark }}
      >
        {label}
      </span>
      <div className="mt-1 text-[13px] leading-snug text-dark">{value || '—'}</div>
    </div>
  );
}

/**
 * La hoja del vuelo, tal como se imprime.
 *
 * Es la bitácora firmable: lo que reportó el piloto, tramo por tramo, con el
 * horómetro a la vista. Las horas van calculadas pero el horómetro se imprime
 * igual, porque es contra él que se revisa si un número está mal.
 */
export function VueloPrintable({ aeronave, vuelo: v, onClose }: Props) {
  const col = acento(aeronave.acento);
  const espera = v.tramos.reduce((s, t) => s + Number(t.espera ?? 0), 0);
  const ruta = v.tramos.length
    ? [v.tramos[0].origen, ...v.tramos.map((t) => t.destino)].map((x) => x || '?').join(' → ')
    : '—';

  return (
    <PrintableModal open onClose={onClose} title={`Vuelo ${v.serial ?? ''} · ${aeronave.matricula}`}>
      <article className="bg-white">
        <header className="px-8 py-6 text-white" style={{ background: col.grad }}>
          <div className="flex items-start justify-between gap-6">
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-[.2em] text-white/70">
                Bitácora de vuelo
              </div>
              <div className="mt-1 font-heading text-3xl font-extrabold">{v.serial ?? 'Vuelo'}</div>
              <div className="mt-1 text-[13px] font-semibold text-white/80">
                {formatDate(v.fecha)}
                {v.numero ? ` · ${v.numero}` : ''}
              </div>
            </div>
            <div className="text-right">
              <div className="font-heading text-2xl font-extrabold">{aeronave.matricula}</div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-white/70">
                {aeronave.nombre ?? ''}
              </div>
              <div className="mt-2 font-heading text-xl font-extrabold">{h1(v.horas)} h</div>
            </div>
          </div>
          <div className="mt-3 font-mono text-[13px] font-extrabold tracking-wide text-white/90">
            {ruta}
          </div>
        </header>

        <section className="grid grid-cols-4 gap-x-5 gap-y-4 px-8 py-5">
          <Dato label="Al mando" value={rotuloMando(v.mando)} color={col} />
          <Dato
            label={v.mando === 'instruccion' ? 'Instructor' : 'Piloto'}
            value={v.piloto ?? v.instructor ?? (v.mando === 'dueno' ? 'El dueño' : null)}
            color={col}
          />
          <Dato label="Propósito" value={v.proposito} color={col} />
          <Dato
            label="Combustible"
            value={
              v.combustible_cantidad != null
                ? `${Number(v.combustible_cantidad).toFixed(1)} ${v.combustible_unidad}`
                : null
            }
            color={col}
          />
        </section>

        <section className="px-8 pb-5">
          <div className="overflow-hidden rounded-lg border" style={{ borderColor: col.solid }}>
            <div
              className="px-4 py-2 text-[11px] font-extrabold uppercase tracking-wider text-white"
              style={{ backgroundColor: col.dark }}
            >
              Tramos · {v.tramos.length}
            </div>
            <table className="w-full text-[12px]">
              <thead>
                <tr style={{ backgroundColor: col.light, color: col.dark }} className="text-left">
                  <th className="px-3 py-1.5 font-extrabold">Origen</th>
                  <th className="px-2 py-1.5 font-extrabold">Destino</th>
                  <th className="px-2 py-1.5 font-extrabold">Salida</th>
                  <th className="px-2 py-1.5 font-extrabold">Llegada</th>
                  {/* El horómetro se imprime: es contra él que se revisa si un
                      número está mal. */}
                  <th className="px-2 py-1.5 text-right font-extrabold">Horóm. salida</th>
                  <th className="px-2 py-1.5 text-right font-extrabold">Horóm. llegada</th>
                  <th className="px-2 py-1.5 text-right font-extrabold">Espera</th>
                  <th className="px-3 py-1.5 text-right font-extrabold">Horas</th>
                </tr>
              </thead>
              <tbody>
                {v.tramos.map((t, i) => (
                  <tr key={t.id} style={{ backgroundColor: i % 2 ? '#ffffff' : 'rgba(0,0,0,.02)' }}>
                    <td className="px-3 py-1.5 font-mono font-semibold text-dark">{t.origen || '—'}</td>
                    <td className="px-2 py-1.5 font-mono font-semibold text-dark">{t.destino || '—'}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-dark-2">{hhmm(t.hora_salida)}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-dark-2">{hhmm(t.hora_llegada)}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-right font-mono text-dark-2">
                      {t.horometro_salida != null ? Number(t.horometro_salida).toFixed(1) : '—'}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-right font-mono text-dark-2">
                      {t.horometro_llegada != null ? Number(t.horometro_llegada).toFixed(1) : '—'}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-right text-dark-2">
                      {Number(t.espera) ? h1(Number(t.espera)) : ''}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-right font-extrabold"
                      style={{ color: col.dark }}>
                      {h1(Number(t.horas))}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ backgroundColor: col.light }}>
                  <td colSpan={6} className="px-3 py-1.5 text-right text-[10px] font-extrabold uppercase tracking-wider"
                    style={{ color: col.dark }}>
                    Total
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-right font-extrabold"
                    style={{ color: col.dark }}>
                    {espera ? h1(espera) : ''}
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-right font-heading font-extrabold"
                    style={{ color: col.dark }}>
                    {h1(v.horas)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Las notas de los tramos, debajo, para no ensanchar la tabla. */}
          {v.tramos.some((t) => t.notas) && (
            <div className="mt-2 space-y-0.5">
              {v.tramos.map((t, i) =>
                t.notas ? (
                  <div key={t.id} className="text-[11px] text-dark-3">
                    <b style={{ color: col.dark }}>Tramo {i + 1}:</b> {t.notas}
                  </div>
                ) : null,
              )}
            </div>
          )}
        </section>

        {v.pasajeros.length > 0 && (
          <section className="px-8 pb-5">
            <span
              className="inline-block rounded px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider"
              style={{ backgroundColor: col.light, color: col.dark }}
            >
              Pasajeros · {v.pasajeros.length}
            </span>
            <div className="mt-1 text-[13px] leading-relaxed text-dark">
              {v.pasajeros.join(' · ')}
            </div>
          </section>
        )}

        {v.notas && (
          <section className="px-8 pb-5">
            <div className="rounded-md border-l-4 px-3 py-2 text-[12px] text-dark"
              style={{ borderLeftColor: col.solid, backgroundColor: col.light }}>
              <b style={{ color: col.dark }}>Notas:</b> {v.notas}
            </div>
          </section>
        )}

        {/* La firma de quien reportó. La bitácora se firma. */}
        <section className="px-8 pb-8 pt-8">
          <div className="w-1/2">
            <div className="border-t border-dark-3" />
            <div className="mt-1 text-[11px] font-extrabold uppercase tracking-wider" style={{ color: col.dark }}>
              Reportado por
            </div>
            <div className="text-[13px] text-dark">
              {v.piloto ?? v.instructor ?? (v.mando === 'dueno' ? 'El dueño' : '')}
            </div>
          </div>
        </section>

        <div
          className="px-8 py-2 text-center text-[10px] font-extrabold uppercase tracking-widest text-white/40"
          style={{ backgroundColor: col.dark }}
        >
          CEA · Bitácora de vuelo · {v.serial ?? ''}
        </div>
      </article>
    </PrintableModal>
  );
}

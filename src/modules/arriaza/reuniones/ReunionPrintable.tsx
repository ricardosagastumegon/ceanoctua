import { ServicePrintable } from '../ServicePrintable';
import { SERVICE_META } from '../constants/serviceMeta';
import { fmtDateLong } from '../utils';
import type { AttParticipante, AttReunion } from './full-api';

const META = SERVICE_META.reunion;

type Props = {
  open: boolean;
  onClose: () => void;
  reunion: AttReunion;
  participantes: AttParticipante[];
  tripNo?: string | null;
};

const hhmm = (v: string | null | undefined) => (v ? v.slice(0, 5) : null);

/**
 * Hoja de la reunión.
 *
 * A diferencia del resto de los servicios, esta se comparte con los
 * participantes, así que va en azul marino y gris muy claro -- pedido del
 * documento -- y sin nada de dinero: la reunión no tiene costo.
 */
export function ReunionPrintable({ open, onClose, reunion: r, participantes, tripNo }: Props) {
  const inicio = hhmm(r.hora);
  const fin = hhmm(r.hora_fin);

  return (
    <ServicePrintable
      open={open}
      onClose={onClose}
      serviceKey="reunion"
      band={r.fecha ? <span>{fmtDateLong(r.fecha)}</span> : null}
      title={r.titulo || r.cita || 'Reunión'}
      subtitle={[r.tipo, r.lugar].filter(Boolean).join(' · ')}
      tripNo={tripNo}
      pie="Arriaza Tour & Travel · Convocatoria de reunión"
      headerRight={
        inicio ? (
          <span>
            {inicio}
            {fin ? ` — ${fin}` : ''}
          </span>
        ) : null
      }
      rows={[
        { label: 'Tipo de reunión', value: r.tipo ?? '—' },
        { label: 'Lugar', value: r.lugar ?? '—' },
        { label: 'Inicio', value: inicio ?? '—' },
        { label: 'Fin', value: fin ?? '—' },
      ]}
      extras={
        <div className="space-y-5">
          {r.descripcion && (
            <div className="overflow-hidden rounded-lg border" style={{ borderColor: META.solid }}>
              <div
                className="px-4 py-2 text-[11px] font-extrabold uppercase tracking-wider text-white"
                style={{ backgroundColor: META.dark }}
              >
                Descripción
              </div>
              <div className="whitespace-pre-wrap px-4 py-3 text-[12px] text-dark-2">
                {r.descripcion}
              </div>
            </div>
          )}

          {participantes.length > 0 && (
            <div className="overflow-hidden rounded-lg border" style={{ borderColor: META.solid }}>
              <div
                className="px-4 py-2 text-[11px] font-extrabold uppercase tracking-wider text-white"
                style={{ backgroundColor: META.dark }}
              >
                Participantes · {participantes.length}
              </div>
              <table className="w-full text-[12px]">
                <thead>
                  <tr style={{ backgroundColor: META.light, color: META.dark }} className="text-left">
                    <th className="w-[40%] px-4 py-1.5 font-extrabold">Nombre</th>
                    <th className="px-2 py-1.5 font-extrabold">Referencia</th>
                    <th className="whitespace-nowrap px-4 py-1.5 font-extrabold">Teléfono</th>
                  </tr>
                </thead>
                <tbody>
                  {participantes.map((p) => (
                    <tr key={p.id} className="border-t" style={{ borderColor: META.light }}>
                      <td className="px-4 py-1.5 font-semibold text-dark">{p.nombre || '—'}</td>
                      <td className="px-2 py-1.5 text-dark-2">{p.referencia || '—'}</td>
                      <td className="whitespace-nowrap px-4 py-1.5 text-dark-2">{p.telefono || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      }
    />
  );
}

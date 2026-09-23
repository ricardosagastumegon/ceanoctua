import { ServicePrintable } from '../ServicePrintable';
import { SERVICE_META } from '../constants/serviceMeta';
import { fmtDate } from '../utils';
import { leerExtras, type AttRenta } from './full-api';

const META = SERVICE_META.renta;

type Props = {
  open: boolean;
  onClose: () => void;
  renta: AttRenta;
  tripNo?: string | null;
};

/** Hoja imprimible de la renta: el vehículo y los dos momentos que importan. */
export function RentaPrintable({ open, onClose, renta: r, tripNo }: Props) {
  const moneda = r.moneda ?? 'USD';
  const extras = leerExtras(r.extras);
  const vehiculo = [r.marca, r.modelo, r.tipo_veh].filter(Boolean).join(' ');

  return (
    <ServicePrintable
      open={open}
      onClose={onClose}
      serviceKey="renta"
      band={
        r.recepcion_fecha ? (
          <span>
            {fmtDate(r.recepcion_fecha)} <span className="opacity-60">→</span>{' '}
            {r.entrega_fecha ? fmtDate(r.entrega_fecha) : '—'}
          </span>
        ) : null
      }
      title={r.nombre}
      subtitle={[vehiculo || null, r.ciudad, r.dias ? `${r.dias} día${r.dias === 1 ? '' : 's'}` : null]
        .filter(Boolean).join(' · ')}
      tripNo={tripNo}
      total={
        (Number(r.tarifa) || 0) * (Number(r.dias) || 0) +
        (Number(r.deposito) || 0) +
        extras.reduce((s, e) => s + (Number(e.amount) || 0), 0)
      }
      moneda={moneda}
      estadoPago={r.estado_pago}
      pagadoCon={r.pagado_con}
      confirmacion={r.confirmacion}
      cancelacion={r.cancelacion}
      rows={[
        { label: 'Rentadora', value: r.nombre },
        { label: 'Teléfono', value: r.telefono ?? '—' },
        { label: 'Dirección', value: r.direccion ?? '—' },
        { label: 'Reservado a través de', value: r.reservado ?? '—' },
        { label: 'Reserva a nombre de', value: r.reserva_nombre ?? '—' },
        { label: 'Estatus del pago', value: r.estatus_pago ?? '—' },
      ]}
      extras={
        <div className="space-y-5">
          {/* El vehículo · lo que se recibe en el mostrador. */}
          <div className="overflow-hidden rounded-lg border" style={{ borderColor: META.solid }}>
            <div
              className="px-4 py-2 text-[11px] font-extrabold uppercase tracking-wider text-white"
              style={{ backgroundColor: META.dark }}
            >
              🚗 Vehículo
            </div>
            <div className="grid grid-cols-4 gap-x-4 gap-y-2 px-4 py-3 text-[12px]">
              {[
                ['Tipo', r.tipo_veh],
                ['Marca', r.marca],
                ['Modelo', r.modelo],
                ['Tamaño', r.tamano],
                ['Capacidad', r.capacidad],
                ['Puertas', r.puertas],
                ['Transmisión', r.transmision],
                ['Combustible', r.combustible],
              ].map(([label, valor]) => (
                <div key={String(label)}>
                  <div className="text-[9px] font-extrabold uppercase tracking-wider" style={{ color: META.dark }}>
                    {label}
                  </div>
                  <div className="text-dark">{valor ? String(valor) : '—'}</div>
                </div>
              ))}
            </div>
            {r.desc_veh && (
              <div className="border-t px-4 py-2 text-[12px] text-dark-2" style={{ borderColor: META.light }}>
                {r.desc_veh}
              </div>
            )}
          </div>

          {/* Recepción y entrega, lado a lado: son los dos momentos del servicio. */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { titulo: '📍 Recepción', fecha: r.recepcion_fecha, hora: r.recepcion_hora, dir: r.recepcion_dir },
              { titulo: '🏁 Entrega', fecha: r.entrega_fecha, hora: r.entrega_hora, dir: r.entrega_dir },
            ].map((m) => (
              <div
                key={m.titulo}
                className="rounded-lg border-l-4 px-4 py-3"
                style={{ borderLeftColor: META.solid, backgroundColor: META.light }}
              >
                <div className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: META.dark }}>
                  {m.titulo}
                </div>
                <div className="mt-1 font-heading text-base font-extrabold" style={{ color: META.dark }}>
                  {m.fecha ? fmtDate(m.fecha) : '—'}
                  {m.hora ? <span className="ml-2 text-sm">{m.hora.slice(0, 5)}</span> : null}
                </div>
                <div className="mt-0.5 text-[12px] text-dark-2">{m.dir || '—'}</div>
              </div>
            ))}
          </div>

          <div>
            <div className="mb-2 text-[11px] font-extrabold uppercase tracking-wider" style={{ color: META.dark }}>
              Montos
            </div>
            {[
              [`Tarifa por día × ${r.dias ?? 0}`, (Number(r.tarifa) || 0) * (Number(r.dias) || 0)],
              ['Depósito de seguridad', Number(r.deposito) || 0],
              ...extras.map((e) => [e.label || 'Extra', Number(e.amount) || 0] as [string, number]),
            ].map(([label, monto], i) => (
              <div key={i} className="flex justify-between border-b border-sand py-1 text-[12px]">
                <span className="text-dark">{label}</span>
                <span className="font-extrabold" style={{ color: META.dark }}>
                  {moneda} {Number(monto).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      }
    />
  );
}

import { useQuery } from '@tanstack/react-query';
import { ServicePrintable } from '../ServicePrintable';
import { SERVICE_META } from '../constants/serviceMeta';
import { fmtDate } from '../utils';
import { restauranteFullApi, type AttRestaurante } from './full-api';

const META = SERVICE_META.restaurantes;

type Props = {
  open: boolean;
  onClose: () => void;
  restaurante: AttRestaurante;
  tripNo?: string | null;
};

/** Hoja imprimible del restaurante: la reserva arriba, comensales y montos abajo. */
export function RestaurantePrintable({ open, onClose, restaurante: r, tripNo }: Props) {
  const full = useQuery({
    queryKey: ['att_restaurante_full', r.id],
    queryFn: () => restauranteFullApi.load(r.id),
    enabled: open,
  });
  const comensales = full.data?.comensales ?? [];
  const servicios = full.data?.servicios ?? [];
  const pagos = full.data?.pagos ?? [];
  const moneda = r.moneda ?? 'USD';

  return (
    <ServicePrintable
      open={open}
      onClose={onClose}
      serviceKey="restaurantes"
      band={
        r.fecha ? (
          <span>
            {fmtDate(r.fecha)}
            {r.hora ? <span className="opacity-70"> · {r.hora.slice(0, 5)}</span> : null}
          </span>
        ) : null
      }
      title={r.nombre}
      titleSize="grande"
      rowsLayout="compacto"
      subtitle={[
        r.specialty,
        r.michelin ? `Michelin ${'★'.repeat(r.stars ?? 0) || '—'}` : null,
        r.ciudad,
      ].filter(Boolean).join(' · ')}
      tripNo={tripNo}
      total={r.monto != null ? Number(r.monto) : null}
      moneda={moneda}
      estadoPago={r.estado_pago}
      pagadoCon={r.pagado_con}
      confirmacion={r.conf}
      rows={[
        { label: 'Teléfono', value: r.phone ?? '—' },
        { label: 'Correo', value: r.email ?? '—' },
        { label: 'Ubicación', value: r.direccion ?? '—' },
        { label: 'Tipo de servicio', value: r.tipo_servicio ?? '—' },
        { label: 'Reservado a través de', value: r.reservado_por ?? '—' },
        { label: 'Tiempo de espera', value: r.tiempo_espera ?? '—' },
        { label: 'Comensales', value: comensales.length || r.covers || '—' },
        {
          label: 'Cancelación',
          value: r.cancelacion_gratuita
            ? `Gratuita${r.cancelacion_fecha ? ` hasta ${fmtDate(r.cancelacion_fecha)}` : ''}`
            : r.cancel_policy ?? 'Con penalidad',
        },
      ]}
      extras={
        <div className="space-y-5">
          {comensales.length > 0 && (
            <div>
              <div className="mb-2 text-[11px] font-extrabold uppercase tracking-wider" style={{ color: META.dark }}>
                Comensales
              </div>
              <ol className="grid grid-cols-2 gap-x-6 gap-y-1 text-[11px]">
                {comensales.map((c, i) => (
                  <li key={i} className="flex gap-2 border-b border-sand py-0.5">
                    <span className="w-4 shrink-0 font-extrabold" style={{ color: META.dark }}>{i + 1}</span>
                    <span className="text-dark-2">{c.nombre}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div>
            <div className="mb-2 text-[11px] font-extrabold uppercase tracking-wider" style={{ color: META.dark }}>
              Montos
            </div>
            <div className="flex justify-between border-b border-sand py-1 text-[11px]">
              <span className="text-dark-2">
                Tarifa por persona × {comensales.length || r.covers || 0}
              </span>
              <span className="font-extrabold" style={{ color: META.dark }}>
                {moneda} {((Number(r.tarifa_pax) || 0) * (comensales.length || r.covers || 0)).toFixed(2)}
              </span>
            </div>
            {servicios.map((x, i) => (
              <div key={i} className="flex justify-between border-b border-sand py-1 text-[11px]">
                <span className="text-dark-2">{x.nombre || 'Servicio adicional'}</span>
                <span className="font-extrabold" style={{ color: META.dark }}>
                  {moneda} {(Number(x.monto) || 0).toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          {pagos.length > 0 && (
            <div>
              <div className="mb-2 text-[11px] font-extrabold uppercase tracking-wider" style={{ color: META.dark }}>
                Registros de pago
              </div>
              <table className="w-full text-[11px]">
                <thead>
                  <tr style={{ color: META.dark }} className="text-left">
                    <th className="border-b border-sand py-1">ID de TC</th>
                    <th className="border-b border-sand py-1">Nombre</th>
                    <th className="border-b border-sand py-1">Autorizado por</th>
                    <th className="border-b border-sand py-1 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {pagos.map((p, i) => (
                    <tr key={i}>
                      <td className="border-b border-sand py-1 text-dark-2">{p.tc_id || '—'}</td>
                      <td className="border-b border-sand py-1 text-dark-3">{p.titular || '—'}</td>
                      <td className="border-b border-sand py-1 text-dark-3">{p.autorizado_por || '—'}</td>
                      <td className="border-b border-sand py-1 text-right font-extrabold" style={{ color: META.dark }}>
                        {moneda} {(Number(p.monto) || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {r.detalles && (
            <div className="rounded-md border border-sand px-3 py-2 text-[11px] text-dark-3">
              <b>Detalles:</b> {r.detalles}
            </div>
          )}
        </div>
      }
    />
  );
}

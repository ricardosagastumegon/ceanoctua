import { ServicePrintable } from '../ServicePrintable';
import { SERVICE_META } from '../constants/serviceMeta';
import { fmtDate } from '../utils';
// El ferry y el traslado acuático son el mismo servicio con otro casco: misma
// ruta OW/RT, mismo desglose de montos. Los bloques viven en el acuático.
import { Montos, PanelEmbarcacion, TrayectosOwRt } from '../acuaticos/AcuaticoPrintable';
import { totalTarifaExtras, type AttFerry } from './full-api';

const META = SERVICE_META.ferry;

type Props = {
  open: boolean;
  onClose: () => void;
  ferry: AttFerry;
  tripNo?: string | null;
};

/** Hoja imprimible del servicio ferry. */
export function FerryPrintable({ open, onClose, ferry: f, tripNo }: Props) {
  const moneda = f.moneda ?? 'USD';
  const total = totalTarifaExtras(f.tarifa, f.monto_extras);
  const esRT = f.tipo === 'RT';
  const tipoServicio = f.tipo_servicio === 'Otro' ? f.tipo_servicio_otro || 'Otro' : f.tipo_servicio;

  return (
    <ServicePrintable
      open={open}
      onClose={onClose}
      serviceKey="ferry"
      band={f.fecha ? <span>{fmtDate(f.fecha)}</span> : null}
      title={f.prestador}
      subtitle={[f.tipo_embarcacion, f.ciudad, tipoServicio].filter(Boolean).join(' · ')}
      tripNo={tripNo}
      headerRight={
        <span>
          {esRT ? 'Ida y vuelta' : 'Solo ida'}
          {f.servicio_para ? ` · ${f.servicio_para}` : ''}
        </span>
      }
      total={total}
      moneda={moneda}
      estadoPago={f.estado_pago}
      pagadoCon={f.pagado_con}
      confirmacion={f.confirmacion}
      cancelacion={f.cancelacion}
      rows={[
        { label: 'Prestador de servicios', value: f.prestador },
        { label: 'Teléfono', value: f.telefono ?? '—' },
        { label: 'Dirección', value: f.direccion ?? '—' },
        { label: 'Reservado a través de', value: f.reservado ?? '—' },
        { label: 'Reserva a nombre de', value: f.reserva_nombre ?? '—' },
        { label: 'Estatus del pago', value: f.estatus_pago ?? '—' },
      ]}
      extras={
        <div className="space-y-5">
          <PanelEmbarcacion
            serviceKey="ferry"
            titulo="Embarcación"
            campos={[
              ['Tipo de embarcación', f.tipo_embarcacion],
              ['Servicio para', f.servicio_para],
              ['Tipo de servicio', tipoServicio],
            ]}
            descripcion={f.descripcion}
          />

          <TrayectosOwRt
            serviceKey="ferry"
            esRT={esRT}
            salida={{ fecha: f.fecha, origen: f.origen, destino: f.destino, etd: f.etd, eta: f.eta }}
            retorno={{ fecha: f.ret_fecha, origen: f.ret_origen, destino: f.ret_destino, etd: f.ret_etd, eta: f.ret_eta }}
          />

          {f.inclusiones && (
            <div>
              <div className="mb-1 text-[11px] font-extrabold uppercase tracking-wider" style={{ color: META.dark }}>
                Inclusiones
              </div>
              <div className="text-[12px] text-dark-2">{f.inclusiones}</div>
            </div>
          )}

          <Montos
            serviceKey="ferry"
            moneda={moneda}
            tarifa={Number(f.tarifa) || 0}
            etiquetaExtras={f.extras || 'Extras'}
            montoExtras={Number(f.monto_extras) || 0}
          />
        </div>
      }
    />
  );
}

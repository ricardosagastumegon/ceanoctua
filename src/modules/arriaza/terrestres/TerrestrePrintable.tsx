import { ServicePrintable } from '../ServicePrintable';
import { SERVICE_META } from '../constants/serviceMeta';
import { fmtDate } from '../utils';
// Terrestre comparte la forma de acuático y ferry: ruta OW/RT y el mismo
// panel del vehículo. Los bloques viven en el acuático.
import { Montos, PanelEmbarcacion, TrayectosOwRt } from '../acuaticos/AcuaticoPrintable';
import { totalTerrestre, type AttTerrestre } from './full-api';

const META = SERVICE_META.terrestre;

type Props = {
  open: boolean;
  onClose: () => void;
  terrestre: AttTerrestre;
  tripNo?: string | null;
};

/** Hoja imprimible del traslado terrestre. */
export function TerrestrePrintable({ open, onClose, terrestre: t, tripNo }: Props) {
  const moneda = t.moneda ?? 'USD';
  const total = totalTerrestre(t.tarifa, t.personas, t.monto_extras);
  const esRT = t.tipo === 'RT';
  const tipoServicio = t.tipo_servicio === 'Otro' ? t.tipo_servicio_otro || 'Otro' : t.tipo_servicio;

  return (
    <ServicePrintable
      open={open}
      onClose={onClose}
      serviceKey="terrestre"
      band={t.fecha ? <span>{fmtDate(t.fecha)}</span> : null}
      title={t.prestador}
      subtitle={[t.tipo_veh, t.ciudad, tipoServicio].filter(Boolean).join(' · ')}
      tripNo={tripNo}
      headerRight={
        <span>
          {esRT ? 'Ida y vuelta' : 'Solo ida'}
          {t.personas ? ` · ${t.personas} pax` : ''}
        </span>
      }
      total={total}
      moneda={moneda}
      estadoPago={t.estado_pago}
      pagadoCon={t.pagado_con}
      confirmacion={t.confirmacion}
      cancelacion={t.cancelacion}
      rows={[
        { label: 'Prestador de servicios', value: t.prestador },
        { label: 'Teléfono', value: t.telefono ?? '—' },
        { label: 'Dirección', value: t.direccion ?? '—' },
        { label: 'Reservado a través de', value: t.reservado ?? '—' },
        { label: 'Reserva a nombre de', value: t.reserva_nombre ?? '—' },
        { label: 'Estatus del pago', value: t.estatus_pago ?? '—' },
      ]}
      extras={
        <div className="space-y-5">
          <PanelEmbarcacion
            serviceKey="terrestre"
            titulo="Vehículo"
            campos={[
              ['Tipo de vehículo', t.tipo_veh],
              ['Tipo de servicio', tipoServicio],
              ['Personas', t.personas],
            ]}
            descripcion={t.ruta ? `Ruta: ${t.ruta}` : null}
          />

          <TrayectosOwRt
            serviceKey="terrestre"
            esRT={esRT}
            salida={{ fecha: t.fecha, origen: t.origen, destino: t.destino, etd: t.etd, eta: t.eta }}
            retorno={{ fecha: t.ret_fecha, origen: t.ret_origen, destino: t.ret_destino, etd: t.ret_etd, eta: t.ret_eta }}
          />

          {t.inclusiones && (
            <div>
              <div className="mb-1 text-[11px] font-extrabold uppercase tracking-wider" style={{ color: META.dark }}>
                Inclusiones
              </div>
              <div className="text-[12px] text-dark-2">{t.inclusiones}</div>
            </div>
          )}

          <Montos
            serviceKey="terrestre"
            moneda={moneda}
            tarifa={(Number(t.tarifa) || 0) * (Number(t.personas) || 0)}
            etiquetaTarifa={`Tarifa por persona × ${t.personas ?? 0}`}
            etiquetaExtras={t.extras || 'Extras'}
            montoExtras={Number(t.monto_extras) || 0}
          />
        </div>
      }
    />
  );
}

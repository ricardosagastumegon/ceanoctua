import type { ReactNode } from 'react';
import { ServicePrintable } from '../ServicePrintable';
import { SERVICE_META, type ServiceKey } from '../constants/serviceMeta';
import { fmtDate } from '../utils';
import { totalTarifaExtras, type AttAcuatico } from './full-api';

const META = SERVICE_META.acuatico;

type Props = {
  open: boolean;
  onClose: () => void;
  acuatico: AttAcuatico;
  tripNo?: string | null;
};

const hhmm = (v: string | null | undefined) => (v ? v.slice(0, 5) : null);

/** Hoja imprimible del traslado acuático. */
export function AcuaticoPrintable({ open, onClose, acuatico: a, tripNo }: Props) {
  const moneda = a.moneda ?? 'USD';
  const total = totalTarifaExtras(a.tarifa, a.monto_extras);
  const esRT = a.tipo === 'RT';
  const tipoServicio = a.tipo_servicio === 'Otro' ? a.tipo_servicio_otro || 'Otro' : a.tipo_servicio;

  return (
    <ServicePrintable
      open={open}
      onClose={onClose}
      serviceKey="acuatico"
      band={a.fecha ? <span>{fmtDate(a.fecha)}</span> : null}
      title={a.prestador}
      subtitle={[a.tipo_embarcacion, a.ciudad, tipoServicio].filter(Boolean).join(' · ')}
      tripNo={tripNo}
      headerRight={<span>{esRT ? 'Ida y vuelta' : 'Solo ida'}</span>}
      total={total}
      moneda={moneda}
      estadoPago={a.estado_pago}
      pagadoCon={a.pagado_con}
      confirmacion={a.confirmacion}
      cancelacion={a.cancelacion}
      rows={[
        { label: 'Prestador de servicios', value: a.prestador },
        { label: 'Teléfono', value: a.telefono ?? '—' },
        { label: 'Dirección', value: a.direccion ?? '—' },
        { label: 'Reservado a través de', value: a.reservado ?? '—' },
        { label: 'Reserva a nombre de', value: a.reserva_nombre ?? '—' },
        { label: 'Estatus del pago', value: a.estatus_pago ?? '—' },
      ]}
      extras={
        <div className="space-y-5">
          <PanelEmbarcacion
            serviceKey="acuatico"
            titulo="Embarcación"
            campos={[
              ['Tipo de embarcación', a.tipo_embarcacion],
              ['Capacidad', a.capacidad],
              ['Tipo de servicio', tipoServicio],
            ]}
            descripcion={a.descripcion}
          />

          <TrayectosOwRt
            serviceKey="acuatico"
            esRT={esRT}
            salida={{ fecha: a.fecha, origen: a.origen, destino: a.destino, etd: a.etd, eta: a.eta }}
            retorno={{ fecha: a.ret_fecha, origen: a.ret_origen, destino: a.ret_destino, etd: a.ret_etd, eta: a.ret_eta }}
          />

          {a.inclusiones && (
            <div>
              <div className="mb-1 text-[11px] font-extrabold uppercase tracking-wider" style={{ color: META.dark }}>
                Inclusiones
              </div>
              <div className="text-[12px] text-dark-2">{a.inclusiones}</div>
            </div>
          )}

          <Montos
            serviceKey="acuatico"
            moneda={moneda}
            tarifa={Number(a.tarifa) || 0}
            etiquetaExtras={a.extras || 'Extras'}
            montoExtras={Number(a.monto_extras) || 0}
          />
        </div>
      }
    />
  );
}

type Trayecto = {
  fecha: string | null;
  origen: string | null;
  destino: string | null;
  etd: string | null;
  eta: string | null;
};

/**
 * Panel de la embarcación · mismo bloque para acuático y ferry, que comparten
 * la forma del servicio y solo cambian de color y de campos.
 */
export function PanelEmbarcacion({
  serviceKey, titulo, campos, descripcion,
}: {
  serviceKey: ServiceKey;
  titulo: string;
  campos: Array<[string, ReactNode]>;
  descripcion?: string | null;
}) {
  const meta = SERVICE_META[serviceKey];
  return (
    <div className="overflow-hidden rounded-lg border" style={{ borderColor: meta.solid }}>
      <div
        className="px-4 py-2 text-[11px] font-extrabold uppercase tracking-wider text-white"
        style={{ backgroundColor: meta.dark }}
      >
        {meta.icon} {titulo}
      </div>
      <div className="grid grid-cols-3 gap-x-4 gap-y-2 px-4 py-3 text-[12px]">
        {campos.map(([label, valor]) => (
          <div key={label}>
            <div className="text-[9px] font-extrabold uppercase tracking-wider" style={{ color: meta.dark }}>
              {label}
            </div>
            <div className="text-dark">{valor != null && valor !== '' ? valor : '—'}</div>
          </div>
        ))}
      </div>
      {descripcion && (
        <div className="border-t px-4 py-2 text-[12px] text-dark-2" style={{ borderColor: meta.light }}>
          {descripcion}
        </div>
      )}
    </div>
  );
}

/**
 * Los trayectos. Un ida y vuelta se dibuja como dos tarjetas lado a lado —
 * son dos momentos distintos del viaje, como la recepción y la entrega de la
 * renta de vehículo.
 */
export function TrayectosOwRt({
  serviceKey, esRT, salida, retorno,
}: {
  serviceKey: ServiceKey;
  esRT: boolean;
  salida: Trayecto;
  retorno: Trayecto;
}) {
  const meta = SERVICE_META[serviceKey];
  const tramos = esRT
    ? [{ titulo: '➜ Salida', t: salida }, { titulo: '↩ Retorno', t: retorno }]
    : [{ titulo: '➜ Ruta', t: salida }];

  return (
    <div className={esRT ? 'grid grid-cols-2 gap-4' : ''}>
      {tramos.map(({ titulo, t }) => (
        <div
          key={titulo}
          className="rounded-lg border-l-4 px-4 py-3"
          style={{ borderLeftColor: meta.solid, backgroundColor: meta.light }}
        >
          <div className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: meta.dark }}>
            {titulo}
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-3">
            <span className="font-heading text-base font-extrabold text-dark">{t.origen || '—'}</span>
            <span style={{ color: meta.solid }}>→</span>
            <span className="font-heading text-base font-extrabold text-dark">{t.destino || '—'}</span>
          </div>
          <div className="mt-1 text-[12px] text-dark-2">
            {t.fecha ? fmtDate(t.fecha) : 'Sin fecha'}
          </div>
          <div className="mt-0.5 text-[12px]" style={{ color: meta.dark }}>
            <b>ETD</b> {hhmm(t.etd) ?? '—'} · <b>ETA</b> {hhmm(t.eta) ?? '—'}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Desglose del total: tarifa + extras. */
export function Montos({
  serviceKey, moneda, tarifa, etiquetaExtras, montoExtras,
}: {
  serviceKey: ServiceKey;
  moneda: string;
  tarifa: number;
  etiquetaExtras: string;
  montoExtras: number;
}) {
  const meta = SERVICE_META[serviceKey];
  return (
    <div>
      <div className="mb-2 text-[11px] font-extrabold uppercase tracking-wider" style={{ color: meta.dark }}>
        Montos
      </div>
      {[['Tarifa de servicio', tarifa], [etiquetaExtras, montoExtras]].map(([label, monto], i) => (
        <div key={i} className="flex justify-between border-b border-sand py-1 text-[12px]">
          <span className="text-dark">{String(label)}</span>
          <span className="font-extrabold" style={{ color: meta.dark }}>
            {moneda} {Number(monto).toFixed(2)}
          </span>
        </div>
      ))}
    </div>
  );
}

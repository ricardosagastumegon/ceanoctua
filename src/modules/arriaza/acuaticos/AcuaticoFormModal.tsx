import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { TextInput } from '@/components/ui/TextInput';
import { TextArea } from '@/components/ui/TextArea';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { describeError } from '@/modules/admin/hooks';
import { PaymentMethodSelect } from '../shared/PaymentMethodSelect';
import { OwRtFields, emptyOwRt, type OwRtValues } from '../shared/OwRtFields';
import { SERVICE_META } from '../constants/serviceMeta';
import { ESTATUS_PAGO } from '../tickets/full-api';
import { attAcuaticosByViajeKey, attAcuaticosKey } from './hooks';
import {
  acuaticosFullApi,
  subirConfirmacionAcuatico,
  totalTarifaExtras,
  type AttAcuaticoInsert,
} from './full-api';
import type { Database } from '@/types/database';
import { invalidarViaje } from '../viajes/invalidar';

type Currency = Database['public']['Enums']['currency'];

const META = SERVICE_META.acuatico;

/** Del documento: Privada, Colectiva, Otro — y si es Otro se escribe cuál. */
export const TIPOS_SERVICIO = ['Privada', 'Colectiva', 'Otro'] as const;
export type TipoServicio = (typeof TIPOS_SERVICIO)[number];

type Props = {
  open: boolean;
  viajeId: string;
  acuaticoId?: string;
  onClose: () => void;
};

/** Formulario de traslado acuático. */
export function AcuaticoFormModal({ open, viajeId, acuaticoId, onClose }: Props) {
  const qc = useQueryClient();
  const toast = useToast();
  const cargado = useQuery({
    queryKey: ['att_acuatico_full', acuaticoId],
    queryFn: () => acuaticosFullApi.load(acuaticoId as string),
    enabled: open && !!acuaticoId,
  });
  const save = useMutation({
    mutationFn: (vars: Parameters<typeof acuaticosFullApi.save>[0]) => acuaticosFullApi.save(vars),
    onSuccess: (id) => {
      void qc.invalidateQueries({ queryKey: attAcuaticosKey });
      void qc.invalidateQueries({ queryKey: attAcuaticosByViajeKey(viajeId) });
      void qc.invalidateQueries({ queryKey: ['att_acuatico_full', id] });
      invalidarViaje(qc, viajeId);
    },
  });

  const [prestador, setPrestador] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [direccion, setDireccion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [tipoEmbarcacion, setTipoEmbarcacion] = useState('');
  const [capacidad, setCapacidad] = useState('');
  const [tipoServicio, setTipoServicio] = useState<TipoServicio>('Privada');
  const [tipoServicioOtro, setTipoServicioOtro] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [reservado, setReservado] = useState('');
  const [reservaNombre, setReservaNombre] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [ruta, setRuta] = useState<OwRtValues>(emptyOwRt);
  const [inclusiones, setInclusiones] = useState('');
  const [tarifa, setTarifa] = useState('');
  const [extras, setExtras] = useState('');
  const [montoExtras, setMontoExtras] = useState('');
  const [cancelacion, setCancelacion] = useState('');
  const [estatusNota, setEstatusNota] = useState('');
  const [estadoPago, setEstadoPago] = useState('HOLD');
  const [pagadoCon, setPagadoCon] = useState('');
  const [moneda, setMoneda] = useState<Currency>('USD');
  const [error, setError] = useState<string | null>(null);

  const total = useMemo(() => totalTarifaExtras(tarifa, montoExtras), [tarifa, montoExtras]);

  useEffect(() => {
    if (!open) return;
    const a = cargado.data;
    setPrestador(a?.prestador ?? '');
    setCiudad(a?.ciudad ?? '');
    setDireccion(a?.direccion ?? '');
    setTelefono(a?.telefono ?? '');
    setTipoEmbarcacion(a?.tipo_embarcacion ?? '');
    setCapacidad(a?.capacidad ?? '');
    setTipoServicio((a?.tipo_servicio as TipoServicio | null) ?? 'Privada');
    setTipoServicioOtro(a?.tipo_servicio_otro ?? '');
    setDescripcion(a?.descripcion ?? '');
    setReservado(a?.reservado ?? '');
    setReservaNombre(a?.reserva_nombre ?? '');
    setConfirmacion(a?.confirmacion ?? '');
    setRuta({
      tipo: a?.tipo === 'RT' ? 'RT' : 'OW',
      fecha: a?.fecha ?? '', origen: a?.origen ?? '', destino: a?.destino ?? '',
      etd: a?.etd ?? '', eta: a?.eta ?? '',
      retFecha: a?.ret_fecha ?? '', retOrigen: a?.ret_origen ?? '', retDestino: a?.ret_destino ?? '',
      retEtd: a?.ret_etd ?? '', retEta: a?.ret_eta ?? '',
    });
    setInclusiones(a?.inclusiones ?? '');
    setTarifa(a?.tarifa != null ? String(a.tarifa) : '');
    setExtras(a?.extras ?? '');
    setMontoExtras(a?.monto_extras != null ? String(a.monto_extras) : '');
    setCancelacion(a?.cancelacion ?? '');
    setEstatusNota(a?.estatus_pago ?? '');
    setEstadoPago(a?.estado_pago ?? 'HOLD');
    setPagadoCon(a?.pagado_con ?? '');
    setMoneda((a?.moneda as Currency) ?? 'USD');
    setError(null);
  }, [open, cargado.data]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!prestador.trim()) return setError('El prestador de servicios es obligatorio.');
    if (ruta.tipo === 'RT' && ruta.fecha && ruta.retFecha && ruta.retFecha < ruta.fecha) {
      return setError('El retorno no puede ser anterior a la salida.');
    }
    setError(null);

    const esRT = ruta.tipo === 'RT';
    const cabecera: AttAcuaticoInsert = {
      viaje_id: viajeId,
      prestador: prestador.trim(),
      ciudad: ciudad.trim() || null,
      direccion: direccion.trim() || null,
      telefono: telefono.trim() || null,
      tipo_embarcacion: tipoEmbarcacion.trim() || null,
      capacidad: capacidad.trim() || null,
      tipo_servicio: tipoServicio || null,
      // El detalle solo aplica cuando el tipo es "Otro"; si no, no se guarda huérfano.
      tipo_servicio_otro: tipoServicio === 'Otro' ? tipoServicioOtro.trim() || null : null,
      descripcion: descripcion.trim() || null,
      reservado: reservado.trim() || null,
      reserva_nombre: reservaNombre.trim() || null,
      confirmacion: confirmacion.trim() || null,
      tipo: ruta.tipo,
      fecha: ruta.fecha || null,
      origen: ruta.origen.trim() || null,
      destino: ruta.destino.trim() || null,
      etd: ruta.etd || null,
      eta: ruta.eta || null,
      // Solo un ida y vuelta guarda retorno: si se cambia a OW, se limpia.
      ret_fecha: esRT ? ruta.retFecha || null : null,
      ret_origen: esRT ? ruta.retOrigen.trim() || null : null,
      ret_destino: esRT ? ruta.retDestino.trim() || null : null,
      ret_etd: esRT ? ruta.retEtd || null : null,
      ret_eta: esRT ? ruta.retEta || null : null,
      inclusiones: inclusiones.trim() || null,
      tarifa: tarifa.trim() === '' ? null : Number(tarifa),
      extras: extras.trim() || null,
      monto_extras: montoExtras.trim() === '' ? null : Number(montoExtras),
      monto: total,
      cancelacion: cancelacion.trim() || null,
      estatus_pago: estatusNota.trim() || null,
      estado_pago: estadoPago,
      pagado_con: pagadoCon.trim() || null,
      moneda,
    };

    try {
      await save.mutateAsync({ id: acuaticoId, cabecera });
      toast.success(acuaticoId ? 'Traslado acuático actualizado.' : 'Traslado acuático agregado.');
      onClose();
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${META.icon} ${acuaticoId ? 'Editar' : 'Nuevo'} Traslado Acuático`}
      size="xl"
    >
      {cargado.isLoading ? (
        <p className="text-sm text-dark-3">Cargando traslado…</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Bloque titulo="El prestador">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextInput label="Prestador de servicios *" value={prestador} onChange={(e) => setPrestador(e.target.value)} placeholder="Ej: Ocean Transfers" autoFocus />
              <TextInput label="Ciudad" value={ciudad} onChange={(e) => setCiudad(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextInput label="Dirección" value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Dirección / muelle" />
              <TextInput label="Teléfono" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
            </div>
          </Bloque>

          <Bloque titulo="La embarcación">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextInput label="Tipo de embarcación" value={tipoEmbarcacion} onChange={(e) => setTipoEmbarcacion(e.target.value)} placeholder="Ej: Lancha rápida" />
              <TextInput label="Capacidad" value={capacidad} onChange={(e) => setCapacidad(e.target.value)} placeholder="Ej: 10 personas" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select label="Tipo de servicio" value={tipoServicio} onChange={(e) => setTipoServicio(e.target.value as TipoServicio)}>
                {TIPOS_SERVICIO.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
              {tipoServicio === 'Otro' && (
                <TextInput label="¿Cuál?" value={tipoServicioOtro} onChange={(e) => setTipoServicioOtro(e.target.value)} placeholder="Describe el tipo de servicio" />
              )}
            </div>
            <TextArea label="Descripción del servicio" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <TextInput label="Reservado a través de" value={reservado} onChange={(e) => setReservado(e.target.value)} placeholder="Agencia / plataforma" />
              <TextInput label="Reserva a nombre de" value={reservaNombre} onChange={(e) => setReservaNombre(e.target.value)} placeholder="Nombre completo" />
              <TextInput label="Confirmación No." value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} placeholder="Código de confirmación" />
            </div>
          </Bloque>

          <Bloque titulo="Servicio contratado">
            <OwRtFields
              {...ruta}
              onChange={(patch) => setRuta((r) => ({ ...r, ...patch }))}
              color={{ solid: META.solid, dark: META.dark, light: META.light }}
            />
          </Bloque>

          <Bloque titulo="Información de precio">
            <TextArea label="Inclusiones" value={inclusiones} onChange={(e) => setInclusiones(e.target.value)} rows={2} placeholder="Ej: Chaleco salvavidas, snacks…" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Select label="Moneda" value={moneda} onChange={(e) => setMoneda(e.target.value as Currency)}>
                {(['USD', 'GTQ', 'EUR', 'GBP'] as const).map((m) => <option key={m} value={m}>{m}</option>)}
              </Select>
              <TextInput label={`Tarifa de servicio (${moneda})`} type="number" min="0" step="0.01" value={tarifa} onChange={(e) => setTarifa(e.target.value)} />
              <TextInput label={`Monto extras (${moneda})`} type="number" min="0" step="0.01" value={montoExtras} onChange={(e) => setMontoExtras(e.target.value)} />
            </div>
            <TextInput label="Extras" value={extras} onChange={(e) => setExtras(e.target.value)} placeholder="Descripción de extras" />
            <TextArea label="Cancelación" value={cancelacion} onChange={(e) => setCancelacion(e.target.value)} rows={2} placeholder="Política de cancelación" />
          </Bloque>

          <div
            className="flex items-center justify-between rounded-lg px-5 py-4 text-white"
            style={{ background: META.grad ?? META.dark }}
          >
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-[.18em] text-white/70">
                {META.icon} Total de la reserva
              </div>
              <div className="text-[11px] text-white/60">Tarifa de servicio + monto de extras</div>
            </div>
            <div className="font-heading text-2xl font-extrabold">
              {moneda} {total.toFixed(2)}
            </div>
          </div>

          <Bloque titulo="Pago">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextInput label="Estatus del pago" value={estatusNota} onChange={(e) => setEstatusNota(e.target.value)} placeholder="Ej: Depósito 50% pagado" />
              <Select label="Estado" value={estadoPago} onChange={(e) => setEstadoPago(e.target.value)}>
                {ESTATUS_PAGO.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>
            <PaymentMethodSelect label="Pagado con" value={pagadoCon} onChange={setPagadoCon} />
          </Bloque>

          <Bloque titulo="Confirmación">
            {acuaticoId ? (
              <ConfirmacionBoton id={acuaticoId} actual={cargado.data?.confirmacion_path} />
            ) : (
              <p className="text-xs italic text-dark-3">
                Guarda el traslado primero — el archivo se guarda bajo su número.
              </p>
            )}
          </Bloque>

          {error && (
            <div className="rounded-md bg-rust-l px-3 py-2 text-xs font-semibold text-rust">{error}</div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-md border border-sand px-4 py-2 text-sm font-semibold text-dark-2 hover:bg-sand-l">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={save.isPending}
              style={{ backgroundColor: META.solid }}
              className="rounded-md px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {save.isPending ? 'Guardando…' : '💾 Guardar Traslado Acuático'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function Bloque({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-3 rounded-md border border-sand p-3">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wider" style={{ color: META.dark }}>
        {titulo}
      </legend>
      {children}
    </fieldset>
  );
}

function ConfirmacionBoton({ id, actual }: { id: string; actual?: string | null }) {
  const qc = useQueryClient();
  const toast = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);

  async function handleFile(file: File | null) {
    if (!file) return;
    setSubiendo(true);
    try {
      await subirConfirmacionAcuatico(id, file);
      await qc.invalidateQueries({ queryKey: ['att_acuatico_full', id] });
      toast.success('Confirmación cargada.');
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <div>
      <input ref={ref} type="file" accept="application/pdf,image/*" className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0] ?? null)} />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={subiendo}
        className="w-full rounded-md border border-dashed px-3 py-3 text-xs font-semibold disabled:opacity-60"
        style={{ borderColor: META.solid, color: META.dark, backgroundColor: META.light }}
      >
        {subiendo ? 'Subiendo…' : '📎 Subir confirmación (PDF/imagen)'}
        <span className="mt-0.5 block text-[10px] font-normal text-dark-3">
          {actual ? 'Cargada — subir otra la reemplaza' : 'Sin archivo'}
        </span>
      </button>
    </div>
  );
}

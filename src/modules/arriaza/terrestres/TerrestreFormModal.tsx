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
import { attTerrestresByViajeKey, attTerrestresKey } from './hooks';
import {
  subirConfirmacionTerrestre,
  terrestresFullApi,
  totalTerrestre,
  type AttTerrestreInsert,
} from './full-api';
import type { Database } from '@/types/database';
import { invalidarViaje } from '../viajes/invalidar';

type Currency = Database['public']['Enums']['currency'];

const META = SERVICE_META.terrestre;

/** Del documento: Privada, Colectiva, Otro — y si es Otro se escribe cuál. */
export const TIPOS_SERVICIO = ['Privada', 'Colectiva', 'Otro'] as const;
export type TipoServicio = (typeof TIPOS_SERVICIO)[number];

type Props = {
  open: boolean;
  viajeId: string;
  terrestreId?: string;
  onClose: () => void;
};

/** Formulario de traslado terrestre. */
export function TerrestreFormModal({ open, viajeId, terrestreId, onClose }: Props) {
  const qc = useQueryClient();
  const toast = useToast();
  const cargado = useQuery({
    queryKey: ['att_terrestre_full', terrestreId],
    queryFn: () => terrestresFullApi.load(terrestreId as string),
    enabled: open && !!terrestreId,
  });
  const save = useMutation({
    mutationFn: (vars: Parameters<typeof terrestresFullApi.save>[0]) => terrestresFullApi.save(vars),
    onSuccess: (id) => {
      void qc.invalidateQueries({ queryKey: attTerrestresKey });
      void qc.invalidateQueries({ queryKey: attTerrestresByViajeKey(viajeId) });
      void qc.invalidateQueries({ queryKey: ['att_terrestre_full', id] });
      invalidarViaje(qc, viajeId);
    },
  });

  const [prestador, setPrestador] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [direccion, setDireccion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [tipoVeh, setTipoVeh] = useState('');
  const [tipoServicio, setTipoServicio] = useState<TipoServicio>('Privada');
  const [tipoServicioOtro, setTipoServicioOtro] = useState('');
  const [reservado, setReservado] = useState('');
  const [reservaNombre, setReservaNombre] = useState('');
  const [personas, setPersonas] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [ruta, setRuta] = useState('');
  const [trayecto, setTrayecto] = useState<OwRtValues>(emptyOwRt);
  const [inclusiones, setInclusiones] = useState('');
  const [tarifa, setTarifa] = useState('');
  const [extras, setExtras] = useState('');
  const [montoExtras, setMontoExtras] = useState('');
  const [cancelacion, setCancelacion] = useState('');
  const [estatusNota, setEstatusNota] = useState('');
  const [estadoPago, setEstadoPago] = useState('HOLD');
  const [pagadoCon, setPagadoCon] = useState('');
  const [pagadoConId, setPagadoConId] = useState<string | null>(null);
  const [fechaCargo, setFechaCargo] = useState('');
  const [moneda, setMoneda] = useState<Currency>('USD');
  const [error, setError] = useState<string | null>(null);

  const total = useMemo(
    () => totalTerrestre(tarifa, personas, montoExtras),
    [tarifa, personas, montoExtras],
  );

  useEffect(() => {
    if (!open) return;
    const t = cargado.data;
    setPrestador(t?.prestador ?? '');
    setCiudad(t?.ciudad ?? '');
    setDireccion(t?.direccion ?? '');
    setTelefono(t?.telefono ?? '');
    setTipoVeh(t?.tipo_veh ?? '');
    setTipoServicio((t?.tipo_servicio as TipoServicio | null) ?? 'Privada');
    setTipoServicioOtro(t?.tipo_servicio_otro ?? '');
    setReservado(t?.reservado ?? '');
    setReservaNombre(t?.reserva_nombre ?? '');
    setPersonas(t?.personas != null ? String(t.personas) : '');
    setConfirmacion(t?.confirmacion ?? '');
    setRuta(t?.ruta ?? '');
    setTrayecto({
      tipo: t?.tipo === 'RT' ? 'RT' : 'OW',
      fecha: t?.fecha ?? '', origen: t?.origen ?? '', destino: t?.destino ?? '',
      etd: t?.etd ?? '', eta: t?.eta ?? '',
      retFecha: t?.ret_fecha ?? '', retOrigen: t?.ret_origen ?? '', retDestino: t?.ret_destino ?? '',
      retEtd: t?.ret_etd ?? '', retEta: t?.ret_eta ?? '',
    });
    setInclusiones(t?.inclusiones ?? '');
    setTarifa(t?.tarifa != null ? String(t.tarifa) : '');
    setExtras(t?.extras ?? '');
    setMontoExtras(t?.monto_extras != null ? String(t.monto_extras) : '');
    setCancelacion(t?.cancelacion ?? '');
    setEstatusNota(t?.estatus_pago ?? '');
    setEstadoPago(t?.estado_pago ?? 'HOLD');
    setPagadoCon(t?.pagado_con ?? '');
    setPagadoConId(t?.pagado_con_id ?? null);
    setFechaCargo(t?.fecha_cargo ?? '');
    setMoneda((t?.moneda as Currency) ?? 'USD');
    setError(null);
  }, [open, cargado.data]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!prestador.trim()) return setError('El prestador de servicios es obligatorio.');
    if (trayecto.tipo === 'RT' && trayecto.fecha && trayecto.retFecha && trayecto.retFecha < trayecto.fecha) {
      return setError('El retorno no puede ser anterior a la salida.');
    }
    setError(null);

    const esRT = trayecto.tipo === 'RT';
    const cabecera: AttTerrestreInsert = {
      viaje_id: viajeId,
      prestador: prestador.trim(),
      ciudad: ciudad.trim() || null,
      direccion: direccion.trim() || null,
      telefono: telefono.trim() || null,
      tipo_veh: tipoVeh.trim() || null,
      tipo_servicio: tipoServicio || null,
      tipo_servicio_otro: tipoServicio === 'Otro' ? tipoServicioOtro.trim() || null : null,
      reservado: reservado.trim() || null,
      reserva_nombre: reservaNombre.trim() || null,
      personas: personas.trim() === '' ? null : Number(personas),
      confirmacion: confirmacion.trim() || null,
      // La ruta descrita a mano es del modo OW; en ida y vuelta los dos
      // trayectos ya la cuentan.
      ruta: esRT ? null : ruta.trim() || null,
      tipo: trayecto.tipo,
      fecha: trayecto.fecha || null,
      origen: trayecto.origen.trim() || null,
      destino: trayecto.destino.trim() || null,
      etd: trayecto.etd || null,
      eta: trayecto.eta || null,
      ret_fecha: esRT ? trayecto.retFecha || null : null,
      ret_origen: esRT ? trayecto.retOrigen.trim() || null : null,
      ret_destino: esRT ? trayecto.retDestino.trim() || null : null,
      ret_etd: esRT ? trayecto.retEtd || null : null,
      ret_eta: esRT ? trayecto.retEta || null : null,
      inclusiones: inclusiones.trim() || null,
      tarifa: tarifa.trim() === '' ? null : Number(tarifa),
      extras: extras.trim() || null,
      monto_extras: montoExtras.trim() === '' ? null : Number(montoExtras),
      monto: total,
      cancelacion: cancelacion.trim() || null,
      estatus_pago: estatusNota.trim() || null,
      estado_pago: estadoPago,
      pagado_con: pagadoCon.trim() || null,
      pagado_con_id: pagadoConId,
      fecha_cargo: fechaCargo || null,
      moneda,
    };

    try {
      await save.mutateAsync({ id: terrestreId, cabecera });
      toast.success(terrestreId ? 'Traslado terrestre actualizado.' : 'Traslado terrestre agregado.');
      onClose();
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${META.icon} ${terrestreId ? 'Editar' : 'Nuevo'} Traslado Terrestre`}
      size="xl"
    >
      {cargado.isLoading ? (
        <p className="text-sm text-dark-3">Cargando traslado…</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Bloque titulo="El prestador">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextInput label="Prestador de servicios *" value={prestador} onChange={(e) => setPrestador(e.target.value)} placeholder="Ej: Blacklane" autoFocus />
              <TextInput label="Ciudad" value={ciudad} onChange={(e) => setCiudad(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextInput label="Dirección" value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Dirección completa" />
              <TextInput label="Teléfono" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
            </div>
          </Bloque>

          <Bloque titulo="El vehículo">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextInput label="Tipo de vehículo" value={tipoVeh} onChange={(e) => setTipoVeh(e.target.value)} placeholder="Ej: Van Mercedes Sprinter" />
              <Select label="Tipo de servicio" value={tipoServicio} onChange={(e) => setTipoServicio(e.target.value as TipoServicio)}>
                {TIPOS_SERVICIO.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </div>
            {tipoServicio === 'Otro' && (
              <TextInput label="¿Cuál?" value={tipoServicioOtro} onChange={(e) => setTipoServicioOtro(e.target.value)} placeholder="Describe el tipo de servicio" />
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextInput label="Reservado a través de" value={reservado} onChange={(e) => setReservado(e.target.value)} placeholder="Agencia / plataforma" />
              <TextInput label="Reserva a nombre de" value={reservaNombre} onChange={(e) => setReservaNombre(e.target.value)} placeholder="Nombre completo" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextInput label="Cantidad de personas" type="number" min="0" step="1" value={personas} onChange={(e) => setPersonas(e.target.value)} />
              <TextInput label="Confirmación No." value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} placeholder="Código de confirmación" />
            </div>
          </Bloque>

          <Bloque titulo="Servicio contratado">
            <OwRtFields
              {...trayecto}
              onChange={(patch) => setTrayecto((r) => ({ ...r, ...patch }))}
              color={{ solid: META.solid, dark: META.dark, light: META.light }}
            />
            {/* El documento pide la ruta escrita solo en el modo OW. */}
            {trayecto.tipo === 'OW' && (
              <TextInput label="Ruta" value={ruta} onChange={(e) => setRuta(e.target.value)} placeholder="Ej: Aeropuerto JFK — Hotel The Plaza" />
            )}
          </Bloque>

          <Bloque titulo="Información de precio">
            <TextArea label="Inclusiones" value={inclusiones} onChange={(e) => setInclusiones(e.target.value)} rows={2} placeholder="Ej: Chofer, peajes, agua embotellada…" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Select label="Moneda" value={moneda} onChange={(e) => setMoneda(e.target.value as Currency)}>
                {(['USD', 'GTQ', 'EUR', 'GBP'] as const).map((m) => <option key={m} value={m}>{m}</option>)}
              </Select>
              <TextInput label={`Tarifa por persona (${moneda})`} type="number" min="0" step="0.01" value={tarifa} onChange={(e) => setTarifa(e.target.value)} />
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
              <div className="text-[11px] text-white/60">
                {moneda} {Number(tarifa || 0).toFixed(2)} × {personas || 0} persona{personas === '1' ? '' : 's'}
                {Number(montoExtras) > 0 ? ' + extras' : ''}
              </div>
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
            <PaymentMethodSelect
              label="Pagado con"
              value={pagadoCon}
              valueId={pagadoConId}
              onChange={(texto, tarjetaId) => {
                setPagadoCon(texto);
                setPagadoConId(tarjetaId);
              }}
            />
            <TextInput
              label="Fecha de cargo a la tarjeta"
              type="date"
              value={fechaCargo}
              onChange={(e) => setFechaCargo(e.target.value)}
              hint="Cuándo se cobró la tarjeta. Puede ser meses antes del viaje; sirve para cuadrar contra el estado de cuenta."
            />
          </Bloque>

          <Bloque titulo="Confirmación">
            {terrestreId ? (
              <ConfirmacionBoton id={terrestreId} actual={cargado.data?.confirmacion_path} />
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
              {save.isPending ? 'Guardando…' : '💾 Guardar Traslado Terrestre'}
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
      await subirConfirmacionTerrestre(id, file);
      await qc.invalidateQueries({ queryKey: ['att_terrestre_full', id] });
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

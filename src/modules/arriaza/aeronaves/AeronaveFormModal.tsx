import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { TextInput } from '@/components/ui/TextInput';
import { TextArea } from '@/components/ui/TextArea';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { describeError } from '@/modules/admin/hooks';
import { PaymentMethodSelect } from '../shared/PaymentMethodSelect';
import { SERVICE_META } from '../constants/serviceMeta';
import { ESTATUS_PAGO } from '../tickets/full-api';
import { attAeronavesByViajeKey, attAeronavesKey } from './hooks';
import {
  aeronavesFullApi,
  subirConfirmacionAeronave,
  totalTarifaExtras,
  type AttAeronaveInsert,
} from './full-api';
import type { Database } from '@/types/database';
import { invalidarViaje } from '../viajes/invalidar';

type Currency = Database['public']['Enums']['currency'];

const META = SERVICE_META.aeronave;

type Props = {
  open: boolean;
  viajeId: string;
  aeronaveId?: string;
  onClose: () => void;
};

/** Formulario de renta de aeronave privada. */
export function AeronaveFormModal({ open, viajeId, aeronaveId, onClose }: Props) {
  const qc = useQueryClient();
  const toast = useToast();
  const cargado = useQuery({
    queryKey: ['att_aeronave_full', aeronaveId],
    queryFn: () => aeronavesFullApi.load(aeronaveId as string),
    enabled: open && !!aeronaveId,
  });
  const save = useMutation({
    mutationFn: (vars: Parameters<typeof aeronavesFullApi.save>[0]) => aeronavesFullApi.save(vars),
    onSuccess: (id) => {
      void qc.invalidateQueries({ queryKey: attAeronavesKey });
      void qc.invalidateQueries({ queryKey: attAeronavesByViajeKey(viajeId) });
      void qc.invalidateQueries({ queryKey: ['att_aeronave_full', id] });
      invalidarViaje(qc, viajeId);
    },
  });

  const [prestador, setPrestador] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [direccion, setDireccion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [tipoAeronave, setTipoAeronave] = useState('');
  const [capacidad, setCapacidad] = useState('');
  const [tipoServicio, setTipoServicio] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [reservado, setReservado] = useState('');
  const [reservaNombre, setReservaNombre] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [origen, setOrigen] = useState('');
  const [destino, setDestino] = useState('');
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');
  const [inclusiones, setInclusiones] = useState('');
  const [tarifa, setTarifa] = useState('');
  const [extras, setExtras] = useState('');
  const [montoExtras, setMontoExtras] = useState('');
  const [cancelacion, setCancelacion] = useState('');
  const [estatusNota, setEstatusNota] = useState('');
  const [estadoPago, setEstadoPago] = useState('HOLD');
  const [pagadoCon, setPagadoCon] = useState('');
  const [pagadoConId, setPagadoConId] = useState<string | null>(null);
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
    setTipoAeronave(a?.tipo_aeronave ?? '');
    setCapacidad(a?.capacidad ?? '');
    setTipoServicio(a?.tipo_servicio ?? '');
    setDescripcion(a?.descripcion ?? '');
    setReservado(a?.reservado ?? '');
    setReservaNombre(a?.reserva_nombre ?? '');
    setConfirmacion(a?.confirmacion ?? '');
    setOrigen(a?.origen ?? '');
    setDestino(a?.destino ?? '');
    setFecha(a?.fecha ?? '');
    setHora(a?.hora ?? '');
    setInclusiones(a?.inclusiones ?? '');
    setTarifa(a?.tarifa != null ? String(a.tarifa) : '');
    setExtras(a?.extras ?? '');
    setMontoExtras(a?.monto_extras != null ? String(a.monto_extras) : '');
    setCancelacion(a?.cancelacion ?? '');
    setEstatusNota(a?.estatus_pago ?? '');
    setEstadoPago(a?.estado_pago ?? 'HOLD');
    setPagadoCon(a?.pagado_con ?? '');
    setPagadoConId(a?.pagado_con_id ?? null);
    setMoneda((a?.moneda as Currency) ?? 'USD');
    setError(null);
  }, [open, cargado.data]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!prestador.trim()) return setError('El prestador de servicios es obligatorio.');
    setError(null);

    const cabecera: AttAeronaveInsert = {
      viaje_id: viajeId,
      prestador: prestador.trim(),
      ciudad: ciudad.trim() || null,
      direccion: direccion.trim() || null,
      telefono: telefono.trim() || null,
      tipo_aeronave: tipoAeronave.trim() || null,
      capacidad: capacidad.trim() || null,
      tipo_servicio: tipoServicio.trim() || null,
      descripcion: descripcion.trim() || null,
      reservado: reservado.trim() || null,
      reserva_nombre: reservaNombre.trim() || null,
      confirmacion: confirmacion.trim() || null,
      origen: origen.trim() || null,
      destino: destino.trim() || null,
      fecha: fecha || null,
      hora: hora || null,
      inclusiones: inclusiones.trim() || null,
      tarifa: tarifa.trim() === '' ? null : Number(tarifa),
      extras: extras.trim() || null,
      monto_extras: montoExtras.trim() === '' ? null : Number(montoExtras),
      // El total se guarda para que el viaje pueda sumar sus servicios sin
      // recalcular la fórmula de cada uno.
      monto: total,
      cancelacion: cancelacion.trim() || null,
      estatus_pago: estatusNota.trim() || null,
      estado_pago: estadoPago,
      pagado_con: pagadoCon.trim() || null,
      pagado_con_id: pagadoConId,
      moneda,
    };

    try {
      await save.mutateAsync({ id: aeronaveId, cabecera });
      toast.success(aeronaveId ? 'Renta de aeronave actualizada.' : 'Renta de aeronave agregada.');
      onClose();
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${META.icon} ${aeronaveId ? 'Editar' : 'Nueva'} Renta de Aeronave`}
      size="xl"
    >
      {cargado.isLoading ? (
        <p className="text-sm text-dark-3">Cargando renta de aeronave…</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Bloque titulo="El prestador">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextInput label="Prestador de servicios *" value={prestador} onChange={(e) => setPrestador(e.target.value)} placeholder="Ej: JetLux" autoFocus />
              <TextInput label="Ciudad" value={ciudad} onChange={(e) => setCiudad(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextInput label="Dirección" value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Dirección / FBO" />
              <TextInput label="Teléfono" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
            </div>
          </Bloque>

          <Bloque titulo="La aeronave">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextInput label="Tipo de aeronave" value={tipoAeronave} onChange={(e) => setTipoAeronave(e.target.value)} placeholder="Ej: Jet Citation XLS" />
              <TextInput label="Capacidad" value={capacidad} onChange={(e) => setCapacidad(e.target.value)} placeholder="Ej: 8 pasajeros" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextInput label="Tipo de servicio" value={tipoServicio} onChange={(e) => setTipoServicio(e.target.value)} placeholder="Ej: Charter privado" />
              <TextInput label="Reservado a través de" value={reservado} onChange={(e) => setReservado(e.target.value)} placeholder="Agencia / plataforma" />
            </div>
            <TextArea label="Descripción del servicio" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextInput label="Reserva a nombre de" value={reservaNombre} onChange={(e) => setReservaNombre(e.target.value)} placeholder="Nombre completo" />
              <TextInput label="Confirmación No." value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} placeholder="Código de confirmación" />
            </div>
          </Bloque>

          <Bloque titulo="Ruta">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextInput label="Origen" value={origen} onChange={(e) => setOrigen(e.target.value)} placeholder="Ciudad / aeropuerto de origen" />
              <TextInput label="Destino" value={destino} onChange={(e) => setDestino(e.target.value)} placeholder="Ciudad / aeropuerto de destino" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextInput label="Fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
              <TextInput label="Hora (24h)" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
            </div>
          </Bloque>

          <Bloque titulo="Precio">
            <TextArea label="Inclusiones" value={inclusiones} onChange={(e) => setInclusiones(e.target.value)} rows={2} placeholder="Ej: Catering, tripulación, traslados…" />
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
            <PaymentMethodSelect
              label="Pagado con"
              value={pagadoCon}
              valueId={pagadoConId}
              onChange={(texto, tarjetaId) => {
                setPagadoCon(texto);
                setPagadoConId(tarjetaId);
              }}
            />
          </Bloque>

          <Bloque titulo="Confirmación">
            {aeronaveId ? (
              <ConfirmacionBoton id={aeronaveId} actual={cargado.data?.confirmacion_path} />
            ) : (
              <p className="text-xs italic text-dark-3">
                Guarda la renta primero — el archivo se guarda bajo su número.
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
              {save.isPending ? 'Guardando…' : '💾 Guardar Renta de Aeronave'}
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
      await subirConfirmacionAeronave(id, file);
      await qc.invalidateQueries({ queryKey: ['att_aeronave_full', id] });
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

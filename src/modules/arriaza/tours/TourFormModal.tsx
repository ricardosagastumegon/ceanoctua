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
import { attToursByViajeKey, attToursKey } from './hooks';
import {
  subirConfirmacionTour,
  totalTour,
  tourFullApi,
  type AttTourInsert,
} from './full-api';
import type { Database } from '@/types/database';
import { invalidarViaje } from '../viajes/invalidar';

type Currency = Database['public']['Enums']['currency'];

const META = SERVICE_META.tours;

type Props = {
  open: boolean;
  viajeId: string;
  tourId?: string;
  onClose: () => void;
};

/**
 * Formulario del tour.
 *
 * El nombre del tour y el prestador son dos cosas distintas: "City Tour
 * Manhattan" lo opera "Vegas Tours Co.". El documento pide los dos.
 */
export function TourFormModal({ open, viajeId, tourId, onClose }: Props) {
  const qc = useQueryClient();
  const toast = useToast();
  const cargado = useQuery({
    queryKey: ['att_tour_full', tourId],
    queryFn: () => tourFullApi.load(tourId as string),
    enabled: open && !!tourId,
  });
  const save = useMutation({
    mutationFn: (vars: Parameters<typeof tourFullApi.save>[0]) => tourFullApi.save(vars),
    onSuccess: (id) => {
      void qc.invalidateQueries({ queryKey: attToursKey });
      void qc.invalidateQueries({ queryKey: attToursByViajeKey(viajeId) });
      void qc.invalidateQueries({ queryKey: ['att_tour_full', id] });
      invalidarViaje(qc, viajeId);
    },
  });

  const [nombre, setNombre] = useState('');
  const [prestador, setPrestador] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [direccion, setDireccion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [tipoServicio, setTipoServicio] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [reservado, setReservado] = useState('');
  const [reservaNombre, setReservaNombre] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');
  const [horaFin, setHoraFin] = useState('');
  const [duracion, setDuracion] = useState('');
  const [inclusiones, setInclusiones] = useState('');
  const [incluyeAlimentacion, setIncluyeAlimentacion] = useState(false);
  const [alimentacionDetalle, setAlimentacionDetalle] = useState('');
  const [personas, setPersonas] = useState('');
  const [dias, setDias] = useState('');
  const [tarifa, setTarifa] = useState('');
  const [cancelacion, setCancelacion] = useState('');
  const [estatusNota, setEstatusNota] = useState('');
  const [estadoPago, setEstadoPago] = useState('HOLD');
  const [pagadoCon, setPagadoCon] = useState('');
  const [pagadoConId, setPagadoConId] = useState<string | null>(null);
  const [fechaCargo, setFechaCargo] = useState('');
  const [moneda, setMoneda] = useState<Currency>('USD');
  const [error, setError] = useState<string | null>(null);

  const total = useMemo(() => totalTour(tarifa, personas), [tarifa, personas]);

  useEffect(() => {
    if (!open) return;
    const t = cargado.data;
    setNombre(t?.nombre ?? '');
    setPrestador(t?.prestador ?? '');
    setCiudad(t?.ciudad ?? '');
    setDireccion(t?.direccion ?? '');
    setTelefono(t?.telefono ?? '');
    setTipoServicio(t?.tipo_servicio ?? '');
    setDescripcion(t?.descripcion ?? '');
    setReservado(t?.reservado ?? '');
    setReservaNombre(t?.reserva_nombre ?? '');
    setConfirmacion(t?.confirmacion ?? '');
    setFecha(t?.fecha ?? '');
    setHora(t?.hora ?? '');
    setHoraFin(t?.hora_fin ?? '');
    setDuracion(t?.duracion ?? '');
    setInclusiones(t?.inclusiones ?? '');
    setIncluyeAlimentacion(t?.incluye_alimentacion ?? false);
    setAlimentacionDetalle(t?.alimentacion_detalle ?? '');
    setPersonas(t?.personas != null ? String(t.personas) : '');
    setDias(t?.dias != null ? String(t.dias) : '');
    setTarifa(t?.tarifa != null ? String(t.tarifa) : '');
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
    if (hora && horaFin && horaFin < hora) {
      return setError('La hora de fin no puede ser anterior a la de inicio.');
    }
    setError(null);

    const cabecera: AttTourInsert = {
      viaje_id: viajeId,
      nombre: nombre.trim() || null,
      prestador: prestador.trim(),
      ciudad: ciudad.trim() || null,
      direccion: direccion.trim() || null,
      telefono: telefono.trim() || null,
      tipo_servicio: tipoServicio.trim() || null,
      descripcion: descripcion.trim() || null,
      reservado: reservado.trim() || null,
      reserva_nombre: reservaNombre.trim() || null,
      confirmacion: confirmacion.trim() || null,
      fecha: fecha || null,
      hora: hora || null,
      hora_fin: horaFin || null,
      duracion: duracion.trim() || null,
      inclusiones: inclusiones.trim() || null,
      incluye_alimentacion: incluyeAlimentacion,
      // Si no incluye alimentación el detalle no aplica, no se guarda huérfano.
      alimentacion_detalle: incluyeAlimentacion ? alimentacionDetalle.trim() || null : null,
      personas: personas.trim() === '' ? null : Number(personas),
      dias: dias.trim() === '' ? null : Number(dias),
      tarifa: tarifa.trim() === '' ? null : Number(tarifa),
      // El total se guarda para que el viaje pueda sumar sus servicios sin
      // recalcular la fórmula de cada uno.
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
      await save.mutateAsync({ id: tourId, cabecera });
      toast.success(tourId ? 'Tour actualizado.' : 'Tour agregado.');
      onClose();
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${META.icon} ${tourId ? 'Editar' : 'Nuevo'} Tour`}
      size="xl"
    >
      {cargado.isLoading ? (
        <p className="text-sm text-dark-3">Cargando tour…</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Bloque titulo="El tour">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextInput label="Nombre del tour" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: City Tour Manhattan" autoFocus />
              <TextInput label="Prestador de servicios *" value={prestador} onChange={(e) => setPrestador(e.target.value)} placeholder="Ej: Vegas Tours Co." />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextInput label="Ciudad" value={ciudad} onChange={(e) => setCiudad(e.target.value)} />
              <TextInput label="Teléfono" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
            </div>
            <TextInput label="Dirección" value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Dirección completa" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextInput label="Tipo de servicio" value={tipoServicio} onChange={(e) => setTipoServicio(e.target.value)} placeholder="City tour, aventura, gastronómico…" />
              <TextInput label="Reservado a través de" value={reservado} onChange={(e) => setReservado(e.target.value)} placeholder="Agencia / plataforma" />
            </div>
            <TextArea label="Descripción del servicio" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={3} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextInput label="Reserva a nombre de" value={reservaNombre} onChange={(e) => setReservaNombre(e.target.value)} placeholder="Nombre completo" />
              <TextInput label="Confirmación No." value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} placeholder="Código de confirmación" />
            </div>
          </Bloque>

          <Bloque titulo="Horario">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <TextInput label="Fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
              <TextInput label="Hora de inicio" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
              <TextInput label="Hora de fin" type="time" value={horaFin} onChange={(e) => setHoraFin(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextInput label="Duración del tour" value={duracion} onChange={(e) => setDuracion(e.target.value)} placeholder="Ej: 4 horas" />
              <TextInput label="Cantidad de días" type="number" min="0" step="1" value={dias} onChange={(e) => setDias(e.target.value)} />
            </div>
          </Bloque>

          <Bloque titulo="Qué incluye">
            <TextArea label="Inclusiones" value={inclusiones} onChange={(e) => setInclusiones(e.target.value)} rows={2} placeholder="Ej: Transporte, guía, entradas…" />
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-dark-2">
                <input
                  type="checkbox"
                  checked={incluyeAlimentacion}
                  onChange={(e) => setIncluyeAlimentacion(e.target.checked)}
                  className="h-4 w-4 rounded border-sand"
                />
                Incluye alimentación
              </label>
              {/* El detalle solo aparece si la respuesta es sí, como pide el documento. */}
              {incluyeAlimentacion && (
                <div className="mt-2">
                  <TextInput
                    label="¿Qué alimentación incluye?"
                    value={alimentacionDetalle}
                    onChange={(e) => setAlimentacionDetalle(e.target.value)}
                    placeholder="Ej: Almuerzo buffet y dos bebidas"
                  />
                </div>
              )}
            </div>
          </Bloque>

          <Bloque titulo="Precio">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Select label="Moneda" value={moneda} onChange={(e) => setMoneda(e.target.value as Currency)}>
                {(['USD', 'GTQ', 'EUR', 'GBP'] as const).map((m) => <option key={m} value={m}>{m}</option>)}
              </Select>
              <TextInput label="Cantidad de personas" type="number" min="0" step="1" value={personas} onChange={(e) => setPersonas(e.target.value)} />
              <TextInput label={`Tarifa por persona (${moneda})`} type="number" min="0" step="0.01" value={tarifa} onChange={(e) => setTarifa(e.target.value)} />
            </div>
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
            {tourId ? (
              <ConfirmacionBoton id={tourId} actual={cargado.data?.confirmacion_path} />
            ) : (
              <p className="text-xs italic text-dark-3">
                Guarda el tour primero — el archivo se guarda bajo su número.
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
              {save.isPending ? 'Guardando…' : '💾 Guardar Tour'}
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
      await subirConfirmacionTour(id, file);
      await qc.invalidateQueries({ queryKey: ['att_tour_full', id] });
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

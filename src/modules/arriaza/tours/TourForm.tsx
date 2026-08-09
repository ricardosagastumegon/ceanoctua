import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { TextInput } from '@/components/ui/TextInput';
import { SERVICE_META, type EstadoPago } from '../constants/serviceMeta';
import { PaymentFields } from '../shared/PaymentFields';
import { fmtMoney } from '../utils';
import { tourTotal } from './api';
import type { AttTour, AttTourInsert } from './api';

type Props = {
  open: boolean;
  viajeId: string;
  editing: AttTour | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (values: AttTourInsert) => void | Promise<void>;
};

export function TourForm({ open, viajeId, editing, submitting, onClose, onSubmit }: Props) {
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
  const [inclusiones, setInclusiones] = useState('');
  const [personas, setPersonas] = useState<string>('');
  const [dias, setDias] = useState<string>('');
  const [duracion, setDuracion] = useState('');
  const [tarifa, setTarifa] = useState<string>('');
  const [cancelacion, setCancelacion] = useState('');
  const [estatusPago, setEstatusPago] = useState('');
  const [estadoPago, setEstadoPago] = useState<EstadoPago>('Reservado');
  const [pagadoCon, setPagadoCon] = useState('');
  const [confirmFile, setConfirmFile] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setPrestador(editing.prestador ?? '');
      setCiudad(editing.ciudad ?? '');
      setDireccion(editing.direccion ?? '');
      setTelefono(editing.telefono ?? '');
      setTipoServicio(editing.tipo_servicio ?? '');
      setDescripcion(editing.descripcion ?? '');
      setReservado(editing.reservado ?? '');
      setReservaNombre(editing.reserva_nombre ?? '');
      setConfirmacion(editing.confirmacion ?? '');
      setFecha(editing.fecha ?? '');
      setHora(editing.hora ?? '');
      setInclusiones(editing.inclusiones ?? '');
      setPersonas(editing.personas != null ? String(editing.personas) : '');
      setDias(editing.dias != null ? String(editing.dias) : '');
      setDuracion(editing.duracion ?? '');
      setTarifa(editing.tarifa != null ? String(editing.tarifa) : '');
      setCancelacion(editing.cancelacion ?? '');
      setEstatusPago(editing.estatus_pago ?? '');
      setEstadoPago(editing.estado_pago ?? 'Reservado');
      setPagadoCon(editing.pagado_con ?? '');
      setConfirmFile(editing.confirm_file_name ?? '');
    } else {
      setPrestador(''); setCiudad(''); setDireccion(''); setTelefono('');
      setTipoServicio(''); setDescripcion(''); setReservado(''); setReservaNombre('');
      setConfirmacion(''); setFecha(''); setHora(''); setInclusiones('');
      setPersonas(''); setDias(''); setDuracion(''); setTarifa(''); setCancelacion('');
      setEstatusPago(''); setEstadoPago('Reservado'); setPagadoCon(''); setConfirmFile('');
    }
    setError(null);
  }, [open, editing]);

  const totalPreview = useMemo(() => tourTotal({ tarifa: Number(tarifa || 0), personas: Number(personas || 0) } as AttTour), [tarifa, personas]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!prestador.trim()) return setError('El prestador es obligatorio.');
    setError(null);
    void onSubmit({
      viaje_id: viajeId,
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
      inclusiones: inclusiones.trim() || null,
      personas: personas ? Number(personas) : null,
      dias: dias ? Number(dias) : null,
      duracion: duracion.trim() || null,
      tarifa: tarifa ? Number(tarifa) : null,
      cancelacion: cancelacion.trim() || null,
      estatus_pago: estatusPago.trim() || null,
      estado_pago: estadoPago,
      pagado_con: pagadoCon || null,
      confirm_file_name: confirmFile.trim() || null,
    });
  }

  const meta = SERVICE_META.tours;
  return (
    <Modal open={open} onClose={onClose} title={`${meta.icon} ${editing ? 'Editar' : 'Nuevo'} Tour`} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <TextInput label="Prestador *" value={prestador} onChange={(e) => setPrestador(e.target.value)} placeholder="Ej: Vegas Tours Co." autoFocus />
          <TextInput label="Ciudad" value={ciudad} onChange={(e) => setCiudad(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextInput label="Dirección" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
          <TextInput label="Teléfono" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextInput label="Tipo de servicio" value={tipoServicio} onChange={(e) => setTipoServicio(e.target.value)} placeholder="City tour, aventura…" />
          <TextInput label="Descripción" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <TextInput label="Reservado a través de" value={reservado} onChange={(e) => setReservado(e.target.value)} />
          <TextInput label="Reserva a nombre de" value={reservaNombre} onChange={(e) => setReservaNombre(e.target.value)} />
          <TextInput label="Confirmación No." value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextInput label="Fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          <TextInput label="Hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
        </div>
        <TextInput label="Inclusiones" value={inclusiones} onChange={(e) => setInclusiones(e.target.value)} placeholder="Transporte, guía, entradas…" />
        <div className="grid grid-cols-4 gap-3">
          <TextInput label="Personas" type="number" min="1" value={personas} onChange={(e) => setPersonas(e.target.value)} />
          <TextInput label="Días" type="number" min="1" value={dias} onChange={(e) => setDias(e.target.value)} />
          <TextInput label="Duración" value={duracion} onChange={(e) => setDuracion(e.target.value)} placeholder="4 horas" />
          <TextInput label="Tarifa/persona (US$)" type="number" step="0.01" value={tarifa} onChange={(e) => setTarifa(e.target.value)} />
        </div>
        <TextInput label="Cancelación" value={cancelacion} onChange={(e) => setCancelacion(e.target.value)} />

        <div style={{ background: meta.grad }} className="flex items-center justify-between rounded-lg px-4 py-3 text-white">
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-white/70">🗺️ Total del Tour</div>
            <div className="text-[10px] text-white/50">Tarifa × Personas</div>
          </div>
          <div className="font-heading text-xl font-extrabold">{fmtMoney(totalPreview)}</div>
        </div>

        <PaymentFields
          estatusPago={estatusPago} onEstatusPago={setEstatusPago}
          estadoPago={estadoPago} onEstadoPago={setEstadoPago}
          pagadoCon={pagadoCon} onPagadoCon={setPagadoCon}
          confirmFileName={confirmFile} onConfirmFileName={setConfirmFile}
        />
        {error && <div className="rounded-md bg-rust-l px-3 py-2 text-xs font-semibold text-rust">{error}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-md border border-sand px-4 py-2 text-sm font-semibold text-dark-2 hover:bg-sand-l">Cancelar</button>
          <button type="submit" disabled={submitting} style={{ backgroundColor: meta.solid }} className="rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {submitting ? 'Guardando…' : '💾 Guardar Tour'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

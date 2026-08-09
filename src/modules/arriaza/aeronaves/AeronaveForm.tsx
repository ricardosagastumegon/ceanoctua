import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { TextInput } from '@/components/ui/TextInput';
import { SERVICE_META, type EstadoPago } from '../constants/serviceMeta';
import { PaymentFields } from '../shared/PaymentFields';
import { fmtMoney } from '../utils';
import { aeronaveTotal } from './api';
import type { AttAeronave, AttAeronaveInsert } from './api';

type Props = {
  open: boolean; viajeId: string; editing: AttAeronave | null;
  submitting: boolean; onClose: () => void;
  onSubmit: (values: AttAeronaveInsert) => void | Promise<void>;
};

export function AeronaveForm({ open, viajeId, editing, submitting, onClose, onSubmit }: Props) {
  const [prestador, setPrestador] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [tipoAeronave, setTipoAeronave] = useState('');
  const [capacidad, setCapacidad] = useState('');
  const [origen, setOrigen] = useState('');
  const [destino, setDestino] = useState('');
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');
  const [tarifa, setTarifa] = useState('');
  const [montoExtras, setMontoExtras] = useState('');
  const [extras, setExtras] = useState('');
  const [reservaNombre, setReservaNombre] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [inclusiones, setInclusiones] = useState('');
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
      setTipoAeronave(editing.tipo_aeronave ?? '');
      setCapacidad(editing.capacidad ?? '');
      setOrigen(editing.origen ?? '');
      setDestino(editing.destino ?? '');
      setFecha(editing.fecha ?? '');
      setHora(editing.hora ?? '');
      setTarifa(editing.tarifa != null ? String(editing.tarifa) : '');
      setMontoExtras(editing.monto_extras != null ? String(editing.monto_extras) : '');
      setExtras(editing.extras ?? '');
      setReservaNombre(editing.reserva_nombre ?? '');
      setConfirmacion(editing.confirmacion ?? '');
      setInclusiones(editing.inclusiones ?? '');
      setCancelacion(editing.cancelacion ?? '');
      setEstatusPago(editing.estatus_pago ?? '');
      setEstadoPago(editing.estado_pago ?? 'Reservado');
      setPagadoCon(editing.pagado_con ?? '');
      setConfirmFile(editing.confirm_file_name ?? '');
    } else {
      setPrestador(''); setCiudad(''); setTipoAeronave(''); setCapacidad('');
      setOrigen(''); setDestino(''); setFecha(''); setHora('');
      setTarifa(''); setMontoExtras(''); setExtras('');
      setReservaNombre(''); setConfirmacion(''); setInclusiones(''); setCancelacion('');
      setEstatusPago(''); setEstadoPago('Reservado'); setPagadoCon(''); setConfirmFile('');
    }
    setError(null);
  }, [open, editing]);

  const totalPreview = useMemo(
    () => aeronaveTotal({ tarifa: Number(tarifa || 0), monto_extras: Number(montoExtras || 0) } as AttAeronave),
    [tarifa, montoExtras],
  );

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!prestador.trim()) return setError('El prestador es obligatorio.');
    setError(null);
    void onSubmit({
      viaje_id: viajeId,
      prestador: prestador.trim(),
      ciudad: ciudad.trim() || null,
      tipo_aeronave: tipoAeronave.trim() || null,
      capacidad: capacidad.trim() || null,
      origen: origen.trim() || null,
      destino: destino.trim() || null,
      fecha: fecha || null,
      hora: hora || null,
      tarifa: tarifa ? Number(tarifa) : null,
      monto_extras: montoExtras ? Number(montoExtras) : null,
      extras: extras.trim() || null,
      reserva_nombre: reservaNombre.trim() || null,
      confirmacion: confirmacion.trim() || null,
      inclusiones: inclusiones.trim() || null,
      cancelacion: cancelacion.trim() || null,
      estatus_pago: estatusPago.trim() || null,
      estado_pago: estadoPago,
      pagado_con: pagadoCon || null,
      confirm_file_name: confirmFile.trim() || null,
    });
  }

  const meta = SERVICE_META.aeronave;
  return (
    <Modal open={open} onClose={onClose} title={`${meta.icon} ${editing ? 'Editar' : 'Nueva'} Renta de Aeronave`} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <TextInput label="Prestador *" value={prestador} onChange={(e) => setPrestador(e.target.value)} placeholder="Ej: JetLux" autoFocus />
          <TextInput label="Ciudad" value={ciudad} onChange={(e) => setCiudad(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextInput label="Tipo de aeronave" value={tipoAeronave} onChange={(e) => setTipoAeronave(e.target.value)} placeholder="Jet Citation XLS" />
          <TextInput label="Capacidad" value={capacidad} onChange={(e) => setCapacidad(e.target.value)} placeholder="8 pasajeros" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextInput label="Origen" value={origen} onChange={(e) => setOrigen(e.target.value)} />
          <TextInput label="Destino" value={destino} onChange={(e) => setDestino(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextInput label="Fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          <TextInput label="Hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextInput label="Reserva a nombre de" value={reservaNombre} onChange={(e) => setReservaNombre(e.target.value)} />
          <TextInput label="Confirmación No." value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} />
        </div>
        <TextInput label="Inclusiones" value={inclusiones} onChange={(e) => setInclusiones(e.target.value)} placeholder="Catering, tripulación, traslados…" />
        <div className="grid grid-cols-3 gap-3">
          <TextInput label="Tarifa (US$)" type="number" step="0.01" value={tarifa} onChange={(e) => setTarifa(e.target.value)} />
          <TextInput label="Monto extras (US$)" type="number" step="0.01" value={montoExtras} onChange={(e) => setMontoExtras(e.target.value)} />
          <TextInput label="Descripción extras" value={extras} onChange={(e) => setExtras(e.target.value)} />
        </div>
        <TextInput label="Cancelación" value={cancelacion} onChange={(e) => setCancelacion(e.target.value)} />

        <div style={{ background: meta.grad }} className="flex items-center justify-between rounded-lg px-4 py-3 text-white">
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-white/70">🛩️ Total</div>
            <div className="text-[10px] text-white/50">Tarifa + monto de extras</div>
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
            {submitting ? 'Guardando…' : '💾 Guardar Aeronave'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

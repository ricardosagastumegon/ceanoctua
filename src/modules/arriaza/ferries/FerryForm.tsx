import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { TextInput } from '@/components/ui/TextInput';
import { SERVICE_META, type EstadoPago } from '../constants/serviceMeta';
import { PaymentFields } from '../shared/PaymentFields';
import { OwRtFields, emptyOwRt, type OwRtValues } from '../shared/OwRtFields';
import { fmtMoney } from '../utils';
import { ferryTotal } from './api';
import type { AttFerry, AttFerryInsert } from './api';

type TipoServicio = 'Privada' | 'Colectiva' | 'Otro' | '';
type ServicioPara = 'Personas' | 'Vehículos';

export function FerryForm({ open, viajeId, editing, submitting, onClose, onSubmit }: {
  open: boolean; viajeId: string; editing: AttFerry | null;
  submitting: boolean; onClose: () => void;
  onSubmit: (values: AttFerryInsert) => void | Promise<void>;
}) {
  const [prestador, setPrestador] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [tipoEmb, setTipoEmb] = useState('');
  const [servicioPara, setServicioPara] = useState<ServicioPara>('Personas');
  const [tipoServicio, setTipoServicio] = useState<TipoServicio>('Privada');
  const [tipoServicioOtro, setTipoServicioOtro] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [reservaNombre, setReservaNombre] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [route, setRoute] = useState<OwRtValues>(emptyOwRt);
  const [inclusiones, setInclusiones] = useState('');
  const [tarifa, setTarifa] = useState('');
  const [montoExtras, setMontoExtras] = useState('');
  const [extras, setExtras] = useState('');
  const [cancelacion, setCancelacion] = useState('');
  const [estatusPago, setEstatusPago] = useState('');
  const [estadoPago, setEstadoPago] = useState<EstadoPago>('Reservado');
  const [pagadoCon, setPagadoCon] = useState('');
  const [confirmFile, setConfirmFile] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setPrestador(editing.prestador ?? ''); setCiudad(editing.ciudad ?? '');
      setTipoEmb(editing.tipo_embarcacion ?? '');
      setServicioPara(editing.servicio_para ?? 'Personas');
      setTipoServicio((editing.tipo_servicio ?? 'Privada') as TipoServicio);
      setTipoServicioOtro(editing.tipo_servicio_otro ?? '');
      setDescripcion(editing.descripcion ?? '');
      setReservaNombre(editing.reserva_nombre ?? '');
      setConfirmacion(editing.confirmacion ?? '');
      setRoute({
        tipo: editing.tipo, fecha: editing.fecha ?? '', origen: editing.origen ?? '', destino: editing.destino ?? '',
        etd: editing.etd ?? '', eta: editing.eta ?? '',
        retFecha: editing.ret_fecha ?? '', retOrigen: editing.ret_origen ?? '', retDestino: editing.ret_destino ?? '',
        retEtd: editing.ret_etd ?? '', retEta: editing.ret_eta ?? '',
      });
      setInclusiones(editing.inclusiones ?? '');
      setTarifa(editing.tarifa != null ? String(editing.tarifa) : '');
      setMontoExtras(editing.monto_extras != null ? String(editing.monto_extras) : '');
      setExtras(editing.extras ?? '');
      setCancelacion(editing.cancelacion ?? '');
      setEstatusPago(editing.estatus_pago ?? '');
      setEstadoPago(editing.estado_pago ?? 'Reservado');
      setPagadoCon(editing.pagado_con ?? '');
      setConfirmFile(editing.confirm_file_name ?? '');
    } else {
      setPrestador(''); setCiudad(''); setTipoEmb('');
      setServicioPara('Personas'); setTipoServicio('Privada'); setTipoServicioOtro('');
      setDescripcion(''); setReservaNombre(''); setConfirmacion('');
      setRoute(emptyOwRt); setInclusiones(''); setTarifa(''); setMontoExtras(''); setExtras('');
      setCancelacion(''); setEstatusPago(''); setEstadoPago('Reservado');
      setPagadoCon(''); setConfirmFile('');
    }
    setError(null);
  }, [open, editing]);

  const totalPreview = useMemo(() => ferryTotal({ tarifa: Number(tarifa || 0), monto_extras: Number(montoExtras || 0) } as AttFerry), [tarifa, montoExtras]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!prestador.trim()) return setError('El prestador es obligatorio.');
    setError(null);
    void onSubmit({
      viaje_id: viajeId,
      prestador: prestador.trim(),
      ciudad: ciudad.trim() || null,
      tipo_embarcacion: tipoEmb.trim() || null,
      servicio_para: servicioPara,
      tipo_servicio: (tipoServicio || null) as 'Privada' | 'Colectiva' | 'Otro' | null,
      tipo_servicio_otro: tipoServicioOtro.trim() || null,
      descripcion: descripcion.trim() || null,
      reserva_nombre: reservaNombre.trim() || null,
      confirmacion: confirmacion.trim() || null,
      tipo: route.tipo,
      fecha: route.fecha || null, origen: route.origen.trim() || null, destino: route.destino.trim() || null,
      etd: route.etd || null, eta: route.eta || null,
      ret_fecha: route.retFecha || null, ret_origen: route.retOrigen.trim() || null, ret_destino: route.retDestino.trim() || null,
      ret_etd: route.retEtd || null, ret_eta: route.retEta || null,
      inclusiones: inclusiones.trim() || null,
      tarifa: tarifa ? Number(tarifa) : null,
      monto_extras: montoExtras ? Number(montoExtras) : null,
      extras: extras.trim() || null,
      cancelacion: cancelacion.trim() || null,
      estatus_pago: estatusPago.trim() || null,
      estado_pago: estadoPago,
      pagado_con: pagadoCon || null,
      confirm_file_name: confirmFile.trim() || null,
    });
  }

  const meta = SERVICE_META.ferry;
  return (
    <Modal open={open} onClose={onClose} title={`${meta.icon} ${editing ? 'Editar' : 'Nuevo'} Ferry`} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <TextInput label="Prestador *" value={prestador} onChange={(e) => setPrestador(e.target.value)} placeholder="Isla Ferries" autoFocus />
          <TextInput label="Ciudad" value={ciudad} onChange={(e) => setCiudad(e.target.value)} />
        </div>
        <TextInput label="Tipo de embarcación" value={tipoEmb} onChange={(e) => setTipoEmb(e.target.value)} placeholder="Ferry de pasajeros" />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-dark-2">Servicio para</label>
            <select value={servicioPara} onChange={(e) => setServicioPara(e.target.value as ServicioPara)} className="mt-1 block w-full rounded-md border border-sand bg-white px-3 py-2 text-sm">
              <option value="Personas">Personas</option>
              <option value="Vehículos">Vehículos</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-dark-2">Modo</label>
            <select value={tipoServicio} onChange={(e) => setTipoServicio(e.target.value as TipoServicio)} className="mt-1 block w-full rounded-md border border-sand bg-white px-3 py-2 text-sm">
              <option value="Privada">Privada</option>
              <option value="Colectiva">Colectiva</option>
              <option value="Otro">Otro</option>
            </select>
          </div>
        </div>
        {tipoServicio === 'Otro' && <TextInput label="Descripción (Otro)" value={tipoServicioOtro} onChange={(e) => setTipoServicioOtro(e.target.value)} />}
        <TextInput label="Descripción de servicio" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <TextInput label="Reserva a nombre de" value={reservaNombre} onChange={(e) => setReservaNombre(e.target.value)} />
          <TextInput label="Confirmación No." value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} />
        </div>

        <OwRtFields {...route} onChange={(p) => setRoute((r) => ({ ...r, ...p }))} />

        <TextInput label="Inclusiones" value={inclusiones} onChange={(e) => setInclusiones(e.target.value)} placeholder="Asientos preferentes…" />
        <div className="grid grid-cols-3 gap-3">
          <TextInput label="Tarifa (US$)" type="number" step="0.01" value={tarifa} onChange={(e) => setTarifa(e.target.value)} />
          <TextInput label="Monto extras (US$)" type="number" step="0.01" value={montoExtras} onChange={(e) => setMontoExtras(e.target.value)} />
          <TextInput label="Descripción extras" value={extras} onChange={(e) => setExtras(e.target.value)} />
        </div>
        <TextInput label="Cancelación" value={cancelacion} onChange={(e) => setCancelacion(e.target.value)} />

        <div style={{ background: meta.grad }} className="flex items-center justify-between rounded-lg px-4 py-3 text-white">
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-white/70">⛴️ Total</div>
            <div className="text-[10px] text-white/50">Tarifa + monto de extras</div>
          </div>
          <div className="font-heading text-xl font-extrabold">{fmtMoney(totalPreview)}</div>
        </div>

        <PaymentFields estatusPago={estatusPago} onEstatusPago={setEstatusPago} estadoPago={estadoPago} onEstadoPago={setEstadoPago} pagadoCon={pagadoCon} onPagadoCon={setPagadoCon} confirmFileName={confirmFile} onConfirmFileName={setConfirmFile} />

        {error && <div className="rounded-md bg-rust-l px-3 py-2 text-xs font-semibold text-rust">{error}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-md border border-sand px-4 py-2 text-sm font-semibold text-dark-2 hover:bg-sand-l">Cancelar</button>
          <button type="submit" disabled={submitting} style={{ backgroundColor: meta.solid }} className="rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {submitting ? 'Guardando…' : '💾 Guardar Ferry'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

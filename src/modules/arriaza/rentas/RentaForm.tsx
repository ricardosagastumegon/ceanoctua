import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { TextInput } from '@/components/ui/TextInput';
import { SERVICE_META, type EstadoPago } from '../constants/serviceMeta';
import { PaymentFields } from '../shared/PaymentFields';
import { fmtMoney } from '../utils';
import { rentaTotal } from './api';
import type { AttRenta, AttRentaInsert } from './api';
import type { Json } from '@/types/database';

type Extra = { label: string; amount: number | string };

export function RentaForm({ open, viajeId, editing, submitting, onClose, onSubmit }: {
  open: boolean; viajeId: string; editing: AttRenta | null;
  submitting: boolean; onClose: () => void;
  onSubmit: (values: AttRentaInsert) => void | Promise<void>;
}) {
  const [nombre, setNombre] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [tipoVeh, setTipoVeh] = useState('');
  const [descVeh, setDescVeh] = useState('');
  const [reservaNombre, setReservaNombre] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [recFecha, setRecFecha] = useState('');
  const [recHora, setRecHora] = useState('');
  const [recDir, setRecDir] = useState('');
  const [entFecha, setEntFecha] = useState('');
  const [entHora, setEntHora] = useState('');
  const [entDir, setEntDir] = useState('');
  const [dias, setDias] = useState('');
  const [tarifa, setTarifa] = useState('');
  const [deposito, setDeposito] = useState('');
  const [extras, setExtras] = useState<Extra[]>([]);
  const [cancelacion, setCancelacion] = useState('');
  const [estatusPago, setEstatusPago] = useState('');
  const [estadoPago, setEstadoPago] = useState<EstadoPago>('Reservado');
  const [pagadoCon, setPagadoCon] = useState('');
  const [confirmFile, setConfirmFile] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setNombre(editing.nombre ?? '');
      setCiudad(editing.ciudad ?? '');
      setTipoVeh(editing.tipo_veh ?? '');
      setDescVeh(editing.desc_veh ?? '');
      setReservaNombre(editing.reserva_nombre ?? '');
      setConfirmacion(editing.confirmacion ?? '');
      setRecFecha(editing.recepcion_fecha ?? '');
      setRecHora(editing.recepcion_hora ?? '');
      setRecDir(editing.recepcion_dir ?? '');
      setEntFecha(editing.entrega_fecha ?? '');
      setEntHora(editing.entrega_hora ?? '');
      setEntDir(editing.entrega_dir ?? '');
      setDias(editing.dias != null ? String(editing.dias) : '');
      setTarifa(editing.tarifa != null ? String(editing.tarifa) : '');
      setDeposito(editing.deposito != null ? String(editing.deposito) : '');
      setExtras(Array.isArray(editing.extras) ? (editing.extras as Extra[]) : []);
      setCancelacion(editing.cancelacion ?? '');
      setEstatusPago(editing.estatus_pago ?? '');
      setEstadoPago(editing.estado_pago ?? 'Reservado');
      setPagadoCon(editing.pagado_con ?? '');
      setConfirmFile(editing.confirm_file_name ?? '');
    } else {
      setNombre(''); setCiudad(''); setTipoVeh(''); setDescVeh('');
      setReservaNombre(''); setConfirmacion('');
      setRecFecha(''); setRecHora(''); setRecDir('');
      setEntFecha(''); setEntHora(''); setEntDir('');
      setDias(''); setTarifa(''); setDeposito(''); setExtras([]);
      setCancelacion('');
      setEstatusPago(''); setEstadoPago('Reservado'); setPagadoCon(''); setConfirmFile('');
    }
    setError(null);
  }, [open, editing]);

  const totalPreview = useMemo(() => rentaTotal({
    dias: Number(dias || 0), tarifa: Number(tarifa || 0), deposito: Number(deposito || 0),
    extras: extras as unknown as Json,
  } as AttRenta), [dias, tarifa, deposito, extras]);

  function addExtra() { setExtras((xs) => [...xs, { label: '', amount: '' }]); }
  function removeExtra(i: number) { setExtras((xs) => xs.filter((_, idx) => idx !== i)); }
  function updExtra(i: number, field: keyof Extra, val: string) {
    setExtras((xs) => xs.map((row, idx) => (idx === i ? { ...row, [field]: val } : row)));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return setError('El nombre de la rentadora es obligatorio.');
    setError(null);
    const cleanExtras = extras
      .filter((x) => x.label?.toString().trim())
      .map((x) => ({ label: x.label.toString().trim(), amount: Number(x.amount || 0) }));
    void onSubmit({
      viaje_id: viajeId,
      nombre: nombre.trim(),
      ciudad: ciudad.trim() || null,
      tipo_veh: tipoVeh.trim() || null,
      desc_veh: descVeh.trim() || null,
      reserva_nombre: reservaNombre.trim() || null,
      confirmacion: confirmacion.trim() || null,
      recepcion_fecha: recFecha || null,
      recepcion_hora: recHora || null,
      recepcion_dir: recDir.trim() || null,
      entrega_fecha: entFecha || null,
      entrega_hora: entHora || null,
      entrega_dir: entDir.trim() || null,
      dias: dias ? Number(dias) : null,
      tarifa: tarifa ? Number(tarifa) : null,
      deposito: deposito ? Number(deposito) : null,
      extras: cleanExtras as unknown as Json,
      cancelacion: cancelacion.trim() || null,
      estatus_pago: estatusPago.trim() || null,
      estado_pago: estadoPago,
      pagado_con: pagadoCon || null,
      confirm_file_name: confirmFile.trim() || null,
    });
  }

  const meta = SERVICE_META.renta;
  return (
    <Modal open={open} onClose={onClose} title={`${meta.icon} ${editing ? 'Editar' : 'Nueva'} Renta de Vehículo`} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <TextInput label="Rentadora *" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Hertz" autoFocus />
          <TextInput label="Ciudad" value={ciudad} onChange={(e) => setCiudad(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextInput label="Tipo de vehículo" value={tipoVeh} onChange={(e) => setTipoVeh(e.target.value)} placeholder="SUV, Sedán" />
          <TextInput label="Descripción" value={descVeh} onChange={(e) => setDescVeh(e.target.value)} placeholder="Marca / modelo" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextInput label="Reserva a nombre de" value={reservaNombre} onChange={(e) => setReservaNombre(e.target.value)} />
          <TextInput label="Confirmación No." value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} />
        </div>

        <div className="rounded-md border border-purple/25 p-2">
          <div className="text-xs font-extrabold uppercase tracking-wider text-purple">🚗 Recepción</div>
          <div className="mt-1 grid grid-cols-3 gap-2">
            <TextInput label="Fecha" type="date" value={recFecha} onChange={(e) => setRecFecha(e.target.value)} />
            <TextInput label="Hora" type="time" value={recHora} onChange={(e) => setRecHora(e.target.value)} />
            <TextInput label="Dirección" value={recDir} onChange={(e) => setRecDir(e.target.value)} />
          </div>
        </div>
        <div className="rounded-md border border-purple/25 p-2">
          <div className="text-xs font-extrabold uppercase tracking-wider text-purple">🏁 Entrega</div>
          <div className="mt-1 grid grid-cols-3 gap-2">
            <TextInput label="Fecha" type="date" value={entFecha} onChange={(e) => setEntFecha(e.target.value)} />
            <TextInput label="Hora" type="time" value={entHora} onChange={(e) => setEntHora(e.target.value)} />
            <TextInput label="Dirección" value={entDir} onChange={(e) => setEntDir(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <TextInput label="Días" type="number" min="1" value={dias} onChange={(e) => setDias(e.target.value)} />
          <TextInput label="Tarifa/día (US$)" type="number" step="0.01" value={tarifa} onChange={(e) => setTarifa(e.target.value)} />
          <TextInput label="Depósito (US$)" type="number" step="0.01" value={deposito} onChange={(e) => setDeposito(e.target.value)} />
        </div>

        <div>
          <div className="mb-1 text-xs font-extrabold uppercase tracking-wider text-dark-2">Extras</div>
          {extras.map((x, i) => (
            <div key={i} className="mb-2 grid grid-cols-[1fr_140px_32px] gap-2">
              <TextInput value={x.label} onChange={(e) => updExtra(i, 'label', e.target.value)} placeholder="Ej: GPS" />
              <TextInput type="number" step="0.01" value={String(x.amount)} onChange={(e) => updExtra(i, 'amount', e.target.value)} placeholder="US$ 0.00" />
              <button type="button" onClick={() => removeExtra(i)} className="rounded-md border border-sand px-2 text-xs hover:border-rust">🗑</button>
            </div>
          ))}
          <button type="button" onClick={addExtra} className="text-xs font-semibold text-teal-d hover:underline">+ Agregar extra</button>
        </div>

        <TextInput label="Cancelación" value={cancelacion} onChange={(e) => setCancelacion(e.target.value)} />

        <div style={{ background: meta.grad }} className="flex items-center justify-between rounded-lg px-4 py-3 text-white">
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-white/70">🚗 Total</div>
            <div className="text-[10px] text-white/50">Tarifa × días + depósito + extras</div>
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
            {submitting ? 'Guardando…' : '💾 Guardar Renta'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

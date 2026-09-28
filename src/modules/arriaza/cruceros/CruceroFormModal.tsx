import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { TextInput } from '@/components/ui/TextInput';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { describeError, useTarjetas } from '@/modules/admin/hooks';
import { SERVICE_META } from '../constants/serviceMeta';
import { ChipsInput } from '../shared/ChipsInput';
import { invalidarViaje } from '../viajes/invalidar';
import {
  camaroteVacio,
  cruceroFullApi,
  cruceroKeys,
  estadoDeReserva,
  pendienteCamarote,
  sumaMovimientos,
  totalCamarote,
  totalEstadia,
  type AttCruceroInsert,
  type CamaroteInput,
  type MovimientoInput,
} from './full-api';

const META = SERVICE_META.crucero;
const MONEDAS = ['USD', 'GTQ', 'EUR'] as const;

/**
 * Un color por tipo de bloque, para que el formulario se lea de un vistazo.
 *
 * El usuario reportó que «cuesta mucho identificar visualmente cada segmento»
 * cuando todo tenía el mismo borde beige. Ahora cada cosa lleva su número y su
 * color: el crucero y los camarotes en el índigo del servicio, el dinero que
 * abona a la reserva en verde y el que se suma encima en ámbar.
 */
const AZUL = META.dark;
const TEAL = '#0f766e';
const AMBAR = '#b4460f';

const money = (v: number) =>
  v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Props = {
  open: boolean;
  viajeId: string;
  cruceroId?: string;
  onClose: () => void;
};

/** Una sección del formulario, con su número y su color. */
function Bloque({ paso, titulo, ayuda, color, children }: {
  paso: number;
  titulo: string;
  ayuda?: string;
  color: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border" style={{ borderColor: `${color}40` }}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-3 py-2"
        style={{ backgroundColor: `${color}12` }}>
        <span className="flex h-[18px] w-[18px] shrink-0 translate-y-[3px] items-center justify-center rounded-full text-[10px] font-extrabold text-white"
          style={{ backgroundColor: color }}>{paso}</span>
        <span className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color }}>
          {titulo}
        </span>
        {ayuda && <span className="text-[11px] text-dark-3">{ayuda}</span>}
      </div>
      <div className="space-y-3 p-3">{children}</div>
    </section>
  );
}

/** Un bloque interno del camarote, con su barra de color a la izquierda. */
function SubBloque({ titulo, ayuda, color, accion, children }: {
  titulo: string;
  ayuda?: string;
  color: string;
  accion?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-md border-l-[3px] bg-white px-3 py-2.5"
      style={{ borderLeftColor: color, boxShadow: `inset 0 0 0 1px ${color}22` }}>
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color }}>
            {titulo}
          </span>
          {ayuda && <p className="text-[11px] text-dark-3">{ayuda}</p>}
        </div>
        {accion}
      </div>
      {children}
    </div>
  );
}

/**
 * Alta y edición de un crucero.
 *
 * Tiene tres niveles —crucero, camarotes, y los pasajeros y movimientos de
 * cada camarote— y dos reglas que no comparte con ningún otro servicio:
 *
 *  - El total del camarote es **tarifa × pax**. La tarifa del crucero se
 *    cotiza por persona y por el viaje completo; las noches son
 *    informativas. En el hotel es al revés y por eso la fórmula no coincide.
 *  - La reserva se paga **en abonos**, cada uno con su tarjeta. El camarote
 *    muestra cuánto falta para llegar al 100 %.
 */
export function CruceroFormModal({ open, viajeId, cruceroId, onClose }: Props) {
  const qc = useQueryClient();
  const toast = useToast();
  const tarjetas = useTarjetas();

  const cargado = useQuery({
    queryKey: cruceroKeys.full(cruceroId),
    queryFn: () => cruceroFullApi.load(cruceroId as string),
    enabled: open && !!cruceroId,
  });

  const save = useMutation({
    mutationFn: (vars: Parameters<typeof cruceroFullApi.save>[0]) => cruceroFullApi.save(vars),
    onSuccess: (id) => {
      void qc.invalidateQueries({ queryKey: cruceroKeys.byViaje(viajeId) });
      void qc.invalidateQueries({ queryKey: cruceroKeys.full(id) });
      invalidarViaje(qc, viajeId);
    },
  });

  const [titulo, setTitulo] = useState('');
  const [ship, setShip] = useState('');
  const [packageType, setPackageType] = useState('');
  const [fechaReserva, setFechaReserva] = useState('');
  const [salidaFecha, setSalidaFecha] = useState('');
  const [salidaHora, setSalidaHora] = useState('');
  const [retornoFecha, setRetornoFecha] = useState('');
  const [retornoHora, setRetornoHora] = useState('');
  const [noches, setNoches] = useState('');
  const [itinerario, setItinerario] = useState('');
  const [cancelacion, setCancelacion] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [moneda, setMoneda] = useState('USD');
  const [notas, setNotas] = useState('');
  const [camarotes, setCamarotes] = useState<CamaroteInput[]>([]);
  /** Lo que se está escribiendo en el campo de pasajeros de cada camarote. */
  const [draftPax, setDraftPax] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const d = cargado.data;
    const c = d?.crucero ?? null;
    setTitulo(c?.titulo ?? '');
    setShip(c?.ship ?? '');
    setPackageType(c?.package_type ?? '');
    setFechaReserva(c?.fecha_reserva ?? '');
    setSalidaFecha(c?.salida_fecha ?? '');
    setSalidaHora(c?.salida_hora?.slice(0, 5) ?? '');
    setRetornoFecha(c?.retorno_fecha ?? '');
    setRetornoHora(c?.retorno_hora?.slice(0, 5) ?? '');
    setNoches(c?.noches != null ? String(c.noches) : '');
    setItinerario(c?.itinerario ?? '');
    setCancelacion(c?.cancelacion ?? '');
    setConfirmacion(c?.confirmacion ?? '');
    setMoneda(c?.moneda ?? 'USD');
    setNotas(c?.notas ?? '');
    setCamarotes(d?.camarotes.length ? d.camarotes : [camaroteVacio()]);
    setDraftPax({});
    setError(null);
  }, [open, cargado.data]);

  const previo = cargado.data?.crucero ?? null;
  const cancelado = !!previo?.cancelado_en;

  const total = useMemo(() => totalEstadia(camarotes), [camarotes]);
  const abonado = useMemo(
    () => camarotes.reduce((s, c) => s + sumaMovimientos(c.movimientos, 'pago'), 0),
    [camarotes],
  );

  const opcionesTarjeta = useMemo(() => {
    const lista = (tarjetas.data ?? []).filter((t) => t.activo !== false);
    const peso = (t: { tipo?: string | null }) =>
      (t.tipo ?? '').toUpperCase().includes('PRESIDENCIA') ? 0 : 1;
    return [...lista].sort(
      (a, b) => peso(a) - peso(b) || (a.tc_id ?? '').localeCompare(b.tc_id ?? ''),
    );
  }, [tarjetas.data]);

  function updCamarote(i: number, patch: Partial<CamaroteInput>) {
    setCamarotes((l) => l.map((c, k) => (k === i ? { ...c, ...patch } : c)));
  }
  function updMov(ci: number, mi: number, patch: Partial<MovimientoInput>) {
    setCamarotes((l) =>
      l.map((c, k) =>
        k === ci
          ? { ...c, movimientos: c.movimientos.map((m, j) => (j === mi ? { ...m, ...patch } : m)) }
          : c,
      ),
    );
  }
  function addMov(ci: number, clase: 'pago' | 'extra') {
    setCamarotes((l) =>
      l.map((c, k) =>
        k === ci
          ? {
              ...c,
              movimientos: [
                ...c.movimientos,
                { clase, descripcion: '', monto: '', pagado_con_id: '', fecha_pago: '', comentario: '' },
              ],
            }
          : c,
      ),
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!ship.trim() && !titulo.trim()) {
      return setError('Escribe al menos el encabezado o el nombre del barco.');
    }
    setError(null);

    const cabecera: AttCruceroInsert = {
      viaje_id: viajeId,
      titulo: titulo.trim() || null,
      ship: ship.trim() || null,
      package_type: packageType.trim() || null,
      fecha_reserva: fechaReserva || null,
      salida_fecha: salidaFecha || null,
      salida_hora: salidaHora || null,
      retorno_fecha: retornoFecha || null,
      retorno_hora: retornoHora || null,
      noches: noches.trim() === '' ? null : Number(noches),
      itinerario: itinerario.trim() || null,
      cancelacion: cancelacion.trim() || null,
      confirmacion: confirmacion.trim() || null,
      notas: notas.trim() || null,
      moneda,
      // Un crucero cancelado conserva su estado: lo puso `BotonCancelar` y
      // volver a guardar el form no puede resucitarlo a "Pagado".
      estado_pago: cancelado ? previo?.estado_pago ?? null : estadoDeReserva(camarotes),
    };

    try {
      await save.mutateAsync({
        id: cruceroId,
        cabecera,
        camarotes,
        tarjetas: opcionesTarjeta.map((t) => ({
          id: t.id,
          etiqueta: [t.tc_id, t.red, t.banco, t.titular].filter(Boolean).join(' · '),
        })),
      });
      toast.success(cruceroId ? 'Crucero actualizado.' : 'Crucero agregado.');
      onClose();
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${META.icon} ${cruceroId ? 'Editar' : 'Nuevo'} Crucero`}
      size="xl"
    >
      {cargado.isLoading ? (
        <p className="text-sm text-dark-3">Cargando crucero…</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Bloque paso={1} titulo="El crucero" ayuda="barco, paquete y fechas" color={AZUL}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextInput label="Encabezado del servicio" value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ej: Crucero familiar por el Caribe" />
              <TextInput label="Ship" value={ship} onChange={(e) => setShip(e.target.value)}
                placeholder="Ej: Legend of the Seas" />
              <TextInput label="Package type" value={packageType}
                onChange={(e) => setPackageType(e.target.value)} placeholder="Ej: Balcony · All inclusive" />
              <TextInput label="Fecha de reserva" type="date" value={fechaReserva}
                onChange={(e) => setFechaReserva(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <TextInput label="Salida" type="date" value={salidaFecha}
                onChange={(e) => setSalidaFecha(e.target.value)} />
              <TextInput label="Hora" type="time" value={salidaHora}
                onChange={(e) => setSalidaHora(e.target.value)} />
              <TextInput label="Retorno" type="date" value={retornoFecha}
                onChange={(e) => setRetornoFecha(e.target.value)} />
              <TextInput label="Hora" type="time" value={retornoHora}
                onChange={(e) => setRetornoHora(e.target.value)} />
              <TextInput label="No. de noches" type="number" min="0" value={noches}
                onChange={(e) => setNoches(e.target.value)} />
            </div>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-dark-2">Itinerario</span>
              <textarea value={itinerario} onChange={(e) => setItinerario(e.target.value)} rows={2}
                placeholder="Puertos y días del recorrido"
                className="block w-full rounded-md border border-sand bg-white px-3 py-2 text-sm text-dark focus:border-teal focus:outline-none" />
            </label>
          </Bloque>

          <Bloque paso={2} titulo="Camarotes" ayuda="cada uno con sus pasajeros y sus pagos" color={AZUL}>
            {camarotes.map((c, i) => {
              const base = totalCamarote(c);
              const extras = sumaMovimientos(c.movimientos, 'extra');
              const pagos = sumaMovimientos(c.movimientos, 'pago');
              const pendiente = pendienteCamarote(c);
              // El avance es sobre la reserva; los extras ya vienen pagados.
              const pct = base > 0 ? Math.round((pagos / base) * 100) : 0;
              const descuadre = c.pasajeros.length > 0 && c.pasajeros.length !== Number(c.pax);

              return (
                <div key={c.id ?? `nuevo-${i}`}
                  className="overflow-hidden rounded-lg border" style={{ borderColor: `${AZUL}33` }}>
                  <div className="flex flex-wrap items-center gap-2 px-3 py-2"
                    style={{ backgroundColor: META.light }}>
                    <span className="text-[11px] font-extrabold uppercase tracking-wider"
                      style={{ color: AZUL }}>
                      Camarote {i + 1}
                      {c.camarote ? ` · ${c.camarote}` : ''}
                    </span>
                    <span className="ml-auto text-[11px] font-extrabold" style={{ color: AZUL }}>
                      {moneda} {money(base + extras)}
                    </span>
                    <button type="button" onClick={() => setCamarotes((l) => l.filter((_, k) => k !== i))}
                      className="text-dark-3 hover:text-rust" aria-label="Quitar camarote">✕</button>
                  </div>

                  <div className="space-y-2.5 bg-sand-l/40 p-3">
                    <SubBloque titulo="Datos del camarote" color={AZUL}>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <TextInput label="Reserva a nombre de" value={c.reserva_nombre}
                          onChange={(e) => updCamarote(i, { reserva_nombre: e.target.value })} />
                        <TextInput label="No. de reserva" value={c.reserva_numero}
                          onChange={(e) => updCamarote(i, { reserva_numero: e.target.value })}
                          placeholder="El que da la naviera" />
                        <TextInput label="Camarote" value={c.camarote}
                          onChange={(e) => updCamarote(i, { camarote: e.target.value })} />
                        <TextInput label="Cubierta" value={c.cubierta}
                          onChange={(e) => updCamarote(i, { cubierta: e.target.value })} />
                        <TextInput label="Tipo de habitación" value={c.tipo_hab}
                          onChange={(e) => updCamarote(i, { tipo_hab: e.target.value })} />
                        <TextInput label="Alimentación" value={c.alimentacion}
                          onChange={(e) => updCamarote(i, { alimentacion: e.target.value })} />
                      </div>
                    </SubBloque>

                    <SubBloque titulo="Pasajeros" color={AZUL}
                      ayuda="Quiénes viajan en este camarote. Uno por uno, para poder filtrarlos después.">
                      <ChipsInput
                        label=""
                        placeholder="Nombre del pasajero y Enter"
                        draft={draftPax[i] ?? ''}
                        onDraft={(v) => setDraftPax((d) => ({ ...d, [i]: v }))}
                        items={c.pasajeros}
                        onAdd={(v) => updCamarote(i, { pasajeros: [...c.pasajeros, v] })}
                        onRemove={(k) => updCamarote(i, { pasajeros: c.pasajeros.filter((_, j) => j !== k) })}
                        color={{ solid: META.solid, dark: META.dark, light: META.light }}
                      />
                      {descuadre && (
                        <p className="mt-1.5 text-[11px]" style={{ color: AMBAR }}>
                          Se cobran {c.pax} pax y hay {c.pasajeros.length} pasajero
                          {c.pasajeros.length === 1 ? '' : 's'} anotado
                          {c.pasajeros.length === 1 ? '' : 's'}. Si está bien, déjalo así.
                        </p>
                      )}
                    </SubBloque>

                    <SubBloque titulo="Tarifa" color={AZUL}
                      ayuda="Por pasajero y por el crucero completo. Las noches no entran.">
                      <div className="flex flex-wrap items-end gap-3">
                        <TextInput label={`Tarifa por pasajero (${moneda})`} type="number" min="0" step="0.01"
                          value={c.tarifa} onChange={(e) => updCamarote(i, { tarifa: e.target.value })} />
                        <span className="pb-2 text-dark-3">×</span>
                        <TextInput label="Cantidad de pax" type="number" min="0" value={c.pax}
                          onChange={(e) => updCamarote(i, { pax: e.target.value })} />
                        <TextInput label="Número de noches" type="number" min="0" value={c.noches}
                          onChange={(e) => updCamarote(i, { noches: e.target.value })}
                          hint="informativo" />
                        <div className="ml-auto text-right">
                          <div className="text-[10px] font-extrabold uppercase tracking-wider text-dark-3">
                            Total por camarote
                          </div>
                          <div className="font-heading text-lg font-extrabold" style={{ color: AZUL }}>
                            {moneda} {money(base)}
                          </div>
                        </div>
                      </div>
                    </SubBloque>

                    <MovimientosCamarote
                      clase="pago"
                      titulo="Abonos a la reserva"
                      ayuda="La reserva se puede pagar en varios abonos, cada uno con su tarjeta."
                      color={TEAL}
                      movimientos={c.movimientos}
                      moneda={moneda}
                      tarjetas={opcionesTarjeta}
                      onAdd={() => addMov(i, 'pago')}
                      onUpd={(mi, patch) => updMov(i, mi, patch)}
                      onDel={(mi) => updCamarote(i, { movimientos: c.movimientos.filter((_, k) => k !== mi) })}
                    />

                    <MovimientosCamarote
                      clase="extra"
                      titulo="Servicios extra"
                      ayuda="Bebidas, excursiones, propinas… suman al total del camarote."
                      color={AMBAR}
                      movimientos={c.movimientos}
                      moneda={moneda}
                      tarjetas={opcionesTarjeta}
                      onAdd={() => addMov(i, 'extra')}
                      onUpd={(mi, patch) => updMov(i, mi, patch)}
                      onDel={(mi) => updCamarote(i, { movimientos: c.movimientos.filter((_, k) => k !== mi) })}
                    />

                    {/* Cuánto falta para el 100 % */}
                    <div className="flex flex-wrap items-baseline justify-end gap-x-4 gap-y-1 pt-1 text-[11px]">
                      <span className="text-dark-3">
                        Reserva {moneda} {money(base)}
                        {extras > 0 ? ` · extras ${money(extras)} ya pagados` : ''}
                      </span>
                      <span className="font-extrabold" style={{ color: TEAL }}>
                        Abonado {moneda} {money(pagos)} · {pct} %
                      </span>
                      <span className="font-extrabold"
                        style={{ color: pendiente > 0.005 ? AMBAR : '#2a6e24' }}>
                        {pendiente > 0.005
                          ? `Falta ${moneda} ${money(pendiente)}`
                          : pendiente < -0.005
                            ? `Sobrepagado ${moneda} ${money(-pendiente)}`
                            : 'Pagado al 100 %'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

            <button type="button" onClick={() => setCamarotes((l) => [...l, camaroteVacio()])}
              className="rounded-md border px-3 py-1.5 text-xs font-extrabold hover:opacity-80"
              style={{ borderColor: META.solid, color: AZUL }}>
              ＋ Agregar camarote
            </button>
          </Bloque>

          <Bloque paso={3} titulo="Confirmación y políticas" color={TEAL}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <TextInput label="No. de confirmación" value={confirmacion}
                onChange={(e) => setConfirmacion(e.target.value)}
                hint="del crucero completo" />
              <TextInput label="Cancelación" value={cancelacion}
                onChange={(e) => setCancelacion(e.target.value)}
                placeholder="Política de cancelación" />
              <Select label="Moneda" value={moneda} onChange={(e) => setMoneda(e.target.value)}>
                {MONEDAS.map((m) => <option key={m} value={m}>{m}</option>)}
              </Select>
            </div>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-dark-2">Notas</span>
              <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2}
                className="block w-full rounded-md border border-sand bg-white px-3 py-2 text-sm text-dark focus:border-teal focus:outline-none" />
            </label>
          </Bloque>

          <div className="flex items-center justify-between rounded-lg px-5 py-4 text-white"
            style={{ background: META.grad }}>
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-[.18em] text-white/70">
                {META.icon} Total de estadía
              </div>
              <div className="text-[11px] text-white/60">
                {camarotes.length} camarote{camarotes.length === 1 ? '' : 's'} con sus extras ·
                abonado {moneda} {money(abonado)}
              </div>
              {/* El estado no se elige: lo dicen los abonos. Se muestra para
                  que no sorprenda después en la hoja ni en la liquidación. */}
              <div className="mt-1.5 inline-block rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider">
                {cancelado ? 'Cancelado' : estadoDeReserva(camarotes)}
              </div>
            </div>
            <div className="font-heading text-2xl font-extrabold">{moneda} {money(total)}</div>
          </div>

          {error && (
            <p className="rounded-md border border-rust/30 bg-rust-l px-3 py-2 text-sm text-rust">{error}</p>
          )}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose}
              className="rounded-md border border-sand px-4 py-2 text-sm font-semibold text-dark-2 hover:bg-sand-l">
              Cancelar
            </button>
            <button type="submit" disabled={save.isPending}
              className="rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: META.solid }}>
              {save.isPending ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

/**
 * Los abonos o los servicios extra de un camarote.
 *
 * Los dos tienen la misma forma —monto, tarjeta, fecha, comentario— así que
 * es el mismo componente; lo que cambia es el color y los textos, para que no
 * se confundan entre sí al llenarlos.
 */
function MovimientosCamarote({
  clase, titulo, ayuda, color, movimientos, moneda, tarjetas, onAdd, onUpd, onDel,
}: {
  clase: 'pago' | 'extra';
  titulo: string;
  ayuda: string;
  color: string;
  movimientos: MovimientoInput[];
  moneda: string;
  tarjetas: { id: string; tc_id: string | null; red: string | null; banco: string | null }[];
  onAdd: () => void;
  onUpd: (i: number, patch: Partial<MovimientoInput>) => void;
  onDel: (i: number) => void;
}) {
  const propios = movimientos
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => m.clase === clase);

  return (
    <SubBloque
      titulo={titulo}
      ayuda={ayuda}
      color={color}
      accion={
        <button type="button" onClick={onAdd}
          className="rounded-md border px-2 py-1 text-[11px] font-extrabold hover:opacity-80"
          style={{ borderColor: `${color}66`, color }}>
          ＋ {clase === 'pago' ? 'Abono' : 'Extra'}
        </button>
      }
    >
      {propios.length === 0 && (
        <p className="py-1 text-[11px] italic text-dark-3">
          {clase === 'pago' ? 'Sin abonos registrados.' : 'Sin servicios extra.'}
        </p>
      )}

      <div className="space-y-1.5">
        {propios.map(({ m, i }) => (
          <div key={m.id ?? `n-${i}`}
            className="grid grid-cols-1 gap-2 rounded border p-2 sm:grid-cols-[1.5fr_.8fr_1.2fr_1fr_auto]"
            style={{ borderColor: `${color}33`, backgroundColor: `${color}0a` }}>
            <input type="text" value={m.descripcion}
              onChange={(e) => onUpd(i, { descripcion: e.target.value })}
              placeholder={clase === 'pago' ? 'Ej: Abono 1' : 'Ej: Paquete de bebidas'}
              className="rounded border border-sand bg-white px-2 py-1.5 text-sm focus:border-teal focus:outline-none" />
            <input type="number" min="0" step="0.01" value={m.monto}
              onChange={(e) => onUpd(i, { monto: e.target.value })}
              placeholder={`${moneda} 0.00`}
              className="rounded border border-sand bg-white px-2 py-1.5 text-right text-sm focus:border-teal focus:outline-none" />
            <select value={m.pagado_con_id} onChange={(e) => onUpd(i, { pagado_con_id: e.target.value })}
              className="rounded border border-sand bg-white px-2 py-1.5 text-sm focus:border-teal focus:outline-none">
              <option value="">Pagado con…</option>
              {tarjetas.map((t) => (
                <option key={t.id} value={t.id}>
                  {[t.tc_id, t.red, t.banco].filter(Boolean).join(' · ')}
                </option>
              ))}
            </select>
            <input type="date" value={m.fecha_pago}
              onChange={(e) => onUpd(i, { fecha_pago: e.target.value })}
              className="rounded border border-sand bg-white px-2 py-1.5 text-sm focus:border-teal focus:outline-none" />
            <button type="button" onClick={() => onDel(i)}
              className="text-dark-3 hover:text-rust" aria-label="Quitar">✕</button>
            <input type="text" value={m.comentario}
              onChange={(e) => onUpd(i, { comentario: e.target.value })}
              placeholder="Comentarios"
              className="rounded border border-sand bg-white px-2 py-1.5 text-sm focus:border-teal focus:outline-none sm:col-span-5" />
          </div>
        ))}
      </div>
    </SubBloque>
  );
}

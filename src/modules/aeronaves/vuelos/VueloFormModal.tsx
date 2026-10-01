import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Modal } from '@/components/ui/Modal';
import { TextInput } from '@/components/ui/TextInput';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { describeError } from '@/modules/admin/hooks';
import { ChipsInput } from '@/modules/arriaza/shared/ChipsInput';
import { acento } from '../constants';
import type { Aeronave } from '../api';
import {
  MANDOS, horasTramo, horasVuelo, tramoVacio,
  type TramoInput, type VueloCompleto, type VueloInsert,
} from './api';
import { useGuardarVuelo, usePilotos } from './hooks';

const hoy = () => new Date().toISOString().slice(0, 10);
const hhmm = (v: string | null | undefined) => (v ? v.slice(0, 5) : '');

type Props = {
  aeronave: Aeronave;
  editando: VueloCompleto | null;
  onClose: () => void;
};

/** Una sección del formulario, con su número y su color. */
function Bloque({ paso, titulo, ayuda, color, accion, children }: {
  paso: number;
  titulo: string;
  ayuda?: string;
  color: string;
  accion?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border" style={{ borderColor: `${color}40` }}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-3 py-2"
        style={{ backgroundColor: `${color}12` }}>
        <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold text-white"
          style={{ backgroundColor: color }}>{paso}</span>
        <span className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color }}>
          {titulo}
        </span>
        {ayuda && <span className="text-[11px] text-dark-3">{ayuda}</span>}
        {accion && <span className="ml-auto">{accion}</span>}
      </div>
      <div className="space-y-3 p-3">{children}</div>
    </section>
  );
}

/**
 * La bitácora de un vuelo: lo que el piloto reporta.
 *
 * **Las horas salen del horómetro, no del reloj.** La hora de salida y de
 * llegada sirven para el itinerario y para calcular la espera; las horas que
 * cuenta la aeronave son la diferencia del horómetro, y las calcula la base.
 * Acá solo se muestran mientras se escribe, para que el dedazo se vea de
 * inmediato y no tres meses después en un mantenimiento.
 */
export function VueloFormModal({ aeronave, editando, onClose }: Props) {
  const col = acento(aeronave.acento);
  const toast = useToast();
  const guardar = useGuardarVuelo(aeronave.id);
  const pilotos = usePilotos();

  const [fecha, setFecha] = useState(hoy);
  const [numero, setNumero] = useState('');
  const [mando, setMando] = useState<string>('piloto');
  const [pilotoId, setPilotoId] = useState('');
  const [instructorId, setInstructorId] = useState('');
  const [proposito, setProposito] = useState('');
  const [notas, setNotas] = useState('');
  const [tramos, setTramos] = useState<TramoInput[]>([tramoVacio()]);
  const [pasajeros, setPasajeros] = useState<string[]>([]);
  const [draftPax, setDraftPax] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    setFecha(editando?.fecha ?? hoy());
    setNumero(editando?.numero ?? '');
    setMando(editando?.mando ?? 'piloto');
    setPilotoId(editando?.piloto_id ?? '');
    setInstructorId(editando?.instructor_id ?? '');
    setProposito(editando?.proposito ?? '');
    setNotas(editando?.notas ?? '');
    setPasajeros(editando?.pasajeros ?? []);
    setTramos(
      editando?.tramos.length
        ? editando.tramos.map((t) => ({
            id: t.id,
            origen: t.origen ?? '',
            destino: t.destino ?? '',
            hora_salida: hhmm(t.hora_salida),
            hora_llegada: hhmm(t.hora_llegada),
            horometro_salida: t.horometro_salida != null ? String(t.horometro_salida) : '',
            horometro_llegada: t.horometro_llegada != null ? String(t.horometro_llegada) : '',
            espera: t.espera ? String(t.espera) : '',
            notas: t.notas ?? '',
          }))
        : [tramoVacio()],
    );
    setDraftPax('');
    setError(null);
  }, [editando]);

  const lista = useMemo(
    () => (pilotos.data ?? []).filter((p) => p.activo || p.id === pilotoId || p.id === instructorId),
    [pilotos.data, pilotoId, instructorId],
  );

  const horas = horasVuelo(tramos);
  const espera = tramos.reduce((s, t) => s + (Number(t.espera) || 0), 0);
  const alReves = tramos.some(
    (t) => t.horometro_salida.trim() && t.horometro_llegada.trim() && horasTramo(t) < 0,
  );

  function upd(i: number, patch: Partial<TramoInput>) {
    setTramos((l) => l.map((t, k) => (k === i ? { ...t, ...patch } : t)));
  }

  /**
   * Al agregar un tramo, su horómetro de salida arranca donde terminó el
   * anterior: entre dos tramos del mismo vuelo la aeronave no voló sola.
   */
  function agregarTramo() {
    setTramos((l) => {
      const ultimo = l[l.length - 1];
      const nuevo = tramoVacio();
      if (ultimo) {
        nuevo.horometro_salida = ultimo.horometro_llegada;
        nuevo.origen = ultimo.destino;
      }
      return [...l, nuevo];
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!fecha) return setError('Falta la fecha del vuelo.');
    if (mando === 'piloto' && !pilotoId) return setError('Falta el piloto al mando.');
    if (mando === 'instruccion' && !instructorId) return setError('Falta el instructor.');
    if (alReves) return setError('Hay un tramo con el horómetro de llegada menor que el de salida.');
    setError(null);
    setGuardando(true);

    const cabecera: VueloInsert = {
      aeronave_id: aeronave.id,
      fecha,
      numero: numero.trim() || null,
      mando,
      // Cuando vuela el dueño no hay piloto contratado, y en instrucción el
      // que manda es el instructor: guardar el otro sería inventar un dato.
      piloto_id: mando === 'piloto' ? pilotoId || null : null,
      instructor_id: mando === 'instruccion' ? instructorId || null : null,
      proposito: proposito.trim() || null,
      notas: notas.trim() || null,
    };

    try {
      await guardar.mutateAsync({ id: editando?.id, cabecera, tramos, pasajeros });
      toast.success(editando ? 'Vuelo actualizado.' : 'Vuelo registrado.');
      onClose();
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`✈ ${editando ? `Editar ${editando.serial ?? 'vuelo'}` : 'Nuevo vuelo'} · ${aeronave.matricula}`}
      size="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Bloque paso={1} titulo="El vuelo" ayuda="fecha, quién iba al mando y para qué" color={col.dark}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <TextInput label="Fecha" type="date" value={fecha}
              onChange={(e) => setFecha(e.target.value)} />
            <TextInput label="No. de vuelo" value={numero}
              onChange={(e) => setNumero(e.target.value)} hint="el del operador, si lleva" />
            <Select label="Al mando" value={mando} onChange={(e) => setMando(e.target.value)}>
              {MANDOS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
            </Select>
            {mando === 'piloto' && (
              <Select label="Piloto" value={pilotoId} onChange={(e) => setPilotoId(e.target.value)}>
                <option value="">Elegir…</option>
                {lista.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </Select>
            )}
            {mando === 'instruccion' && (
              <Select label="Instructor" value={instructorId}
                onChange={(e) => setInstructorId(e.target.value)}>
                <option value="">Elegir…</option>
                {lista.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </Select>
            )}
            {mando === 'dueno' && (
              <div className="self-end pb-2 text-[11px] text-dark-3">
                Vuela el dueño: no lleva piloto contratado.
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextInput label="Propósito" value={proposito}
              onChange={(e) => setProposito(e.target.value)}
              placeholder="Recorrido de fincas, traslado, instrucción…" />
            <TextInput label="Notas" value={notas} onChange={(e) => setNotas(e.target.value)} />
          </div>
        </Bloque>

        <Bloque
          paso={2}
          titulo="Tramos"
          ayuda="uno por despegue · las horas salen del horómetro"
          color={col.dark}
          accion={
            <button type="button" onClick={agregarTramo}
              className="rounded-md border px-2 py-1 text-[11px] font-extrabold hover:opacity-80"
              style={{ borderColor: `${col.solid}66`, color: col.dark }}>
              ＋ Tramo
            </button>
          }
        >
          {tramos.map((t, i) => {
            const h = horasTramo(t);
            const mal = t.horometro_salida.trim() && t.horometro_llegada.trim() && h < 0;
            return (
              <div key={t.id ?? `n-${i}`} className="rounded-md border p-2.5"
                style={{ borderColor: mal ? '#b4460f' : `${col.solid}33`, backgroundColor: `${col.solid}08` }}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider"
                    style={{ color: col.dark }}>
                    Tramo {i + 1}
                  </span>
                  {tramos.length > 1 && (
                    <button type="button"
                      onClick={() => setTramos((l) => l.filter((_, k) => k !== i))}
                      className="text-dark-3 hover:text-rust" aria-label="Quitar tramo">✕</button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <TextInput label="Origen" value={t.origen}
                    onChange={(e) => upd(i, { origen: e.target.value })} placeholder="MGGT" />
                  <TextInput label="Destino" value={t.destino}
                    onChange={(e) => upd(i, { destino: e.target.value })} placeholder="MGRT" />
                  <TextInput label="Hora salida" type="time" value={t.hora_salida}
                    onChange={(e) => upd(i, { hora_salida: e.target.value })} />
                  <TextInput label="Hora llegada" type="time" value={t.hora_llegada}
                    onChange={(e) => upd(i, { hora_llegada: e.target.value })} />
                </div>

                <div className="mt-2 flex flex-wrap items-end gap-2">
                  <TextInput label="Horómetro salida" type="number" step="0.1" value={t.horometro_salida}
                    onChange={(e) => upd(i, { horometro_salida: e.target.value })} />
                  <span className="pb-2 text-dark-3">→</span>
                  <TextInput label="Horómetro llegada" type="number" step="0.1" value={t.horometro_llegada}
                    onChange={(e) => upd(i, { horometro_llegada: e.target.value })} />
                  <TextInput label="Espera (h)" type="number" step="0.1" min="0" value={t.espera}
                    onChange={(e) => upd(i, { espera: e.target.value })} />
                  <div className="ml-auto text-right">
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-dark-3">
                      Horas del tramo
                    </div>
                    <div className="font-heading text-lg font-extrabold"
                      style={{ color: mal ? '#b4460f' : col.dark }}>
                      {h.toFixed(1)}
                    </div>
                  </div>
                </div>

                {mal && (
                  <p className="mt-1.5 text-[11px] text-rust">
                    El horómetro no camina para atrás. Revisá los dos números.
                  </p>
                )}

                <div className="mt-2">
                  <TextInput label="Notas del tramo" value={t.notas}
                    onChange={(e) => upd(i, { notas: e.target.value })}
                    placeholder="Finca San Rafael, cargó antes de salir…" />
                </div>
              </div>
            );
          })}
        </Bloque>

        <Bloque paso={3} titulo="Pasajeros"
          ayuda="uno por uno, para poder filtrarlos después" color={col.dark}>
          <ChipsInput
            label=""
            placeholder="Nombre del pasajero y Enter"
            draft={draftPax}
            onDraft={setDraftPax}
            items={pasajeros}
            onAdd={(v) => setPasajeros((l) => [...l, v])}
            onRemove={(k) => setPasajeros((l) => l.filter((_, j) => j !== k))}
            color={{ solid: col.solid, dark: col.dark, light: col.light }}
          />
        </Bloque>

        <div className="flex items-center justify-between rounded-lg px-5 py-4 text-white"
          style={{ background: col.grad }}>
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-[.18em] text-white/70">
              ✈ Horas del vuelo
            </div>
            <div className="text-[11px] text-white/60">
              {tramos.length} tramo{tramos.length === 1 ? '' : 's'}
              {espera > 0 && ` · ${espera.toFixed(1)} h de espera`}
              {pasajeros.length > 0 && ` · ${pasajeros.length} pax`}
            </div>
          </div>
          <div className="font-heading text-2xl font-extrabold">{horas.toFixed(1)} h</div>
        </div>

        {error && (
          <p className="rounded-md border border-rust/30 bg-rust-l px-3 py-2 text-sm text-rust">{error}</p>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose}
            className="rounded-md border border-sand px-4 py-2 text-sm font-semibold text-dark-2 hover:bg-sand-l">
            Cancelar
          </button>
          <button type="submit" disabled={guardando}
            className="rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: col.solid }}>
            {guardando ? 'Guardando…' : 'Guardar vuelo'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { TextInput } from '@/components/ui/TextInput';
import { TextArea } from '@/components/ui/TextArea';
import { Select } from '@/components/ui/Select';
import { CountryPicker } from './shared/CountryPicker';
import { isoForCountry } from './constants/countries';
import { useViajeDestinos } from './viajes/destinos-hooks';
import { useParticipantesDelViaje } from './viajes/participantes-hooks';
import { ParticipantesPicker } from './shared/ParticipantesPicker';
import { usePersonas, useInvitados } from '@/modules/admin/hooks';
import type { ParticipanteInput } from './viajes/participantes-api';
import type { CiudadInput, PaisInput, ParadaInput } from './viajes/destinos-api';
import type { AttViaje, AttViajeInsert } from './viajes/api';
import type { Database } from '@/types/database';

export type TripDestinos = {
  paises: PaisInput[];
  ciudades: CiudadInput[];
  paradas: ParadaInput[];
};

type Props = {
  open: boolean;
  editing: AttViaje | null; // null = crear · AttViaje = editar
  submitting: boolean;
  onClose: () => void;
  onSubmit: (
    values: AttViajeInsert,
    destinos: TripDestinos,
    participantes: ParticipanteInput[],
  ) => void | Promise<void>;
};

/** Las tres opciones del documento. "Otros" abre el texto libre. */
const MOTIVOS = ['Placer', 'Trabajo', 'Otros'] as const;
type Motivo = (typeof MOTIVOS)[number];

const vacio: TripDestinos = { paises: [], ciudades: [], paradas: [] };

// Modal Crear/Editar viaje · Fase 21.
// El viaje es el encabezado del "carrito": aquí se define a dónde se va y por
// qué, y los servicios se agregan después desde la pantalla del viaje.
export function TripFormModal({ open, editing, submitting, onClose, onSubmit }: Props) {
  const [titulo, setTitulo] = useState('');
  const [fechaIni, setFechaIni] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  // Los participantes salen de dos catálogos --Personal JD e Invitados-- y se
  // guardan por id en att_viaje_participantes. `acompanantes` sigue existiendo
  // porque ocho pantallas la leen, pero ya no se escribe desde aquí: un
  // trigger la recalcula.
  const [participantes, setParticipantes] = useState<ParticipanteInput[]>([]);
  const [motivo, setMotivo] = useState<Motivo>('Trabajo');
  const [motivoOtro, setMotivoOtro] = useState('');
  const [pagadoPor, setPagadoPor] = useState('');
  const [notas, setNotas] = useState('');
  const [destinos, setDestinos] = useState<TripDestinos>(vacio);
  const [ciudadDraft, setCiudadDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const guardados = useViajeDestinos(open && editing?.id ? editing.id : undefined);
  const participantesQ = useParticipantesDelViaje(
    open && editing?.id ? editing.id : undefined,
  );
  const personasQ = usePersonas();
  const invitadosQ = useInvitados();

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setTitulo(editing.titulo ?? '');
      setFechaIni(editing.fecha_ini ?? '');
      setFechaFin(editing.fecha_fin ?? '');
      setPagadoPor(editing.paidby ?? '');
      setNotas(editing.notas ?? '');
      // Los viajes viejos traen el motivo como texto libre. Si no es una de las
      // tres opciones, se conserva tal cual dentro de "Otros" para no perderlo.
      const p = editing.proposito ?? '';
      if ((MOTIVOS as readonly string[]).includes(p)) {
        setMotivo(p as Motivo);
        setMotivoOtro(editing.other_reason ?? '');
      } else {
        setMotivo(p ? 'Otros' : 'Trabajo');
        setMotivoOtro(editing.other_reason || p);
      }
    } else {
      setTitulo('');
      setFechaIni('');
      setFechaFin('');
      setParticipantes([]);
      setMotivo('Trabajo');
      setMotivoOtro('');
      setPagadoPor('');
      setNotas('');
      setDestinos(vacio);
    }
    setCiudadDraft('');
    setError(null);
  }, [open, editing]);

  // Los participantes llegan por su propia tabla. El nombre no se guarda ahí:
  // se busca en el catálogo al mostrar, para que corregir un nombre en Admin
  // lo corrija en todos los viajes donde aparece.
  //
  // Se llena UNA sola vez por viaje, y de ahí en adelante manda lo que el
  // usuario tenga en pantalla, para que nada que llegue después le pise la
  // selección.
  //
  // Espera además a que los DOS catálogos estén cargados. Si la lista de
  // participantes llega antes que los nombres, cada participante se queda sin
  // nombre y se cae de la lista; guardar en ese momento lo habría borrado del
  // viaje de verdad.
  const hidratado = useRef<string | null>(null);

  useEffect(() => {
    if (!open) {
      hidratado.current = null;
      return;
    }
    if (!editing?.id) return;
    if (hidratado.current === editing.id) return;
    if (!participantesQ.data || !personasQ.data || !invitadosQ.data) return;

    const personas = personasQ.data;
    const invitados = invitadosQ.data;
    hidratado.current = editing.id;
    setParticipantes(
      participantesQ.data
        .map((r): ParticipanteInput | null => {
          if (r.persona_id) {
            const per = personas.find((x) => x.id === r.persona_id);
            return per ? { tipo: 'persona', id: per.id, nombre: per.nombre } : null;
          }
          const inv = invitados.find((x) => x.id === r.invitado_id);
          return inv ? { tipo: 'invitado', id: inv.id, nombre: inv.nombre } : null;
        })
        .filter((x): x is ParticipanteInput => x !== null),
    );
  }, [open, editing?.id, participantesQ.data, personasQ.data, invitadosQ.data]);

  // Los destinos llegan por separado (3 tablas) y después del viaje.
  useEffect(() => {
    if (!open || !editing?.id || !guardados.data) return;
    setDestinos({
      paises: guardados.data.paises.map((p) => ({ id: p.id, codigo: p.codigo, nombre: p.nombre })),
      ciudades: guardados.data.ciudades.map((c) => ({
        id: c.id,
        nombre: c.nombre,
        pais_codigo: c.pais_codigo,
      })),
      paradas: guardados.data.paradas.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        pais_codigo: p.pais_codigo,
        fecha_ini: p.fecha_ini,
        fecha_fin: p.fecha_fin,
      })),
    });
  }, [open, editing?.id, guardados.data]);

  function addPais(nombre: string) {
    if (!nombre) return;
    setDestinos((d) => {
      if (d.paises.some((p) => p.nombre === nombre)) return d;
      return { ...d, paises: [...d.paises, { codigo: isoForCountry(nombre), nombre }] };
    });
  }
  function removePais(i: number) {
    setDestinos((d) => ({ ...d, paises: d.paises.filter((_, k) => k !== i) }));
  }
  function addCiudad() {
    const nombre = ciudadDraft.trim();
    if (!nombre) return;
    setDestinos((d) =>
      d.ciudades.some((c) => c.nombre.toLowerCase() === nombre.toLowerCase())
        ? d
        : { ...d, ciudades: [...d.ciudades, { nombre }] },
    );
    setCiudadDraft('');
  }
  function removeCiudad(i: number) {
    setDestinos((d) => ({ ...d, ciudades: d.ciudades.filter((_, k) => k !== i) }));
  }
  function addParada() {
    setDestinos((d) => ({
      ...d,
      paradas: [...d.paradas, { nombre: '', fecha_ini: '', fecha_fin: '' }],
    }));
  }
  function updParada(i: number, patch: Partial<ParadaInput>) {
    setDestinos((d) => ({
      ...d,
      paradas: d.paradas.map((p, k) => (k === i ? { ...p, ...patch } : p)),
    }));
  }
  function removeParada(i: number) {
    setDestinos((d) => ({ ...d, paradas: d.paradas.filter((_, k) => k !== i) }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) return setError('El título es obligatorio.');
    if (!fechaIni) return setError('La fecha de inicio es obligatoria.');
    if (!fechaFin) return setError('La fecha de fin es obligatoria.');
    if (fechaFin < fechaIni) return setError('La fecha fin no puede ser anterior al inicio.');
    if (destinos.paises.length === 0 && destinos.ciudades.length === 0) {
      return setError('Agrega al menos un país o una ciudad de destino.');
    }
    const paradaIncompleta = destinos.paradas.find((p) => !p.nombre.trim());
    if (paradaIncompleta) return setError('Cada parada necesita un lugar.');
    const paradaAlReves = destinos.paradas.find(
      (p) => p.fecha_ini && p.fecha_fin && p.fecha_fin < p.fecha_ini,
    );
    if (paradaAlReves) {
      return setError(`La parada "${paradaAlReves.nombre}" termina antes de empezar.`);
    }
    setError(null);

    const principal = destinos.paises[0];
    const values: AttViajeInsert = {
      titulo: titulo.trim(),
      fecha_ini: fechaIni,
      fecha_fin: fechaFin,
      proposito: motivo,
      other_reason: motivo === 'Otros' ? motivoOtro.trim() || null : null,
      paidby: pagadoPor.trim() || null,
      notas: notas.trim() || null,
      // pais/destino siguen escribiéndose mientras el resto del módulo los lea.
      // Son columnas deprecadas (fase 21): la verdad vive en las tablas hijas.
      pais: principal?.nombre ?? null,
      destino: destinos.ciudades.map((c) => c.nombre).join(', ') || principal?.nombre || null,
      estado: 'planificado' as Database['public']['Enums']['trip_status'],
    };
    void onSubmit(
      values,
      {
        ...destinos,
        paradas: destinos.paradas.map((p) => ({ ...p, nombre: p.nombre.trim() })),
      },
      participantes,
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? '✏️ Editar Viaje' : '➕ Crear Viaje'}
      size="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <TextInput
          label="Título del viaje *"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Ej: Reunión de Junta Directiva — Miami"
          autoFocus
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-dark-2">
              No. de viaje
            </label>
            <div className="mt-1 rounded-md bg-teal-l px-3 py-2 text-sm font-extrabold text-teal-d">
              {editing?.trip_no ?? 'Se asigna al guardar'}
            </div>
          </div>
          <TextInput
            label="Fecha inicio *"
            type="date"
            value={fechaIni}
            onChange={(e) => setFechaIni(e.target.value)}
          />
          <TextInput
            label="Fecha fin *"
            type="date"
            value={fechaFin}
            min={fechaIni || undefined}
            onChange={(e) => setFechaFin(e.target.value)}
          />
        </div>

        {/* ── Países de destino ─────────────────────────────────────── */}
        <fieldset className="rounded-md border border-sand p-3">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-dark-2">
            Países de destino
          </legend>
          {/* El `key` lo remonta al agregar: así el buscador se vacía y queda
              listo para el siguiente país, en vez de conservar el anterior. */}
          <CountryPicker
            key={destinos.paises.length}
            value=""
            onChange={addPais}
            placeholder="🌍 Busca un país y presiónalo para agregarlo…"
          />
          {destinos.paises.length > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-2">
              {destinos.paises.map((p, i) => (
                <li
                  key={`${p.nombre}-${i}`}
                  className="inline-flex items-center gap-2 rounded-full bg-teal-l px-3 py-1 text-xs font-semibold text-teal-d"
                >
                  {i === 0 && (
                    <span className="rounded-full bg-teal px-1.5 text-[9px] uppercase text-white">
                      principal
                    </span>
                  )}
                  <span className="font-mono">{p.codigo || '—'}</span>
                  {p.nombre}
                  <button
                    type="button"
                    onClick={() => removePais(i)}
                    className="text-teal-d/60 hover:text-rust"
                    aria-label={`Quitar ${p.nombre}`}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-dark-3">
              Sin países. El primero que agregues es el destino principal.
            </p>
          )}
        </fieldset>

        {/* ── Ciudades destino ──────────────────────────────────────── */}
        <fieldset className="rounded-md border border-sand p-3">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-dark-2">
            Ciudades destino
          </legend>
          <div className="flex gap-2">
            <input
              type="text"
              value={ciudadDraft}
              onChange={(e) => setCiudadDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCiudad();
                }
              }}
              placeholder="Ciudad o lugar"
              className="block w-full rounded-md border border-sand bg-white px-3 py-2 text-sm text-dark placeholder:text-dark-3 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
            />
            <button
              type="button"
              onClick={addCiudad}
              className="shrink-0 rounded-md border border-teal/40 px-3 py-2 text-xs font-semibold text-teal-d hover:bg-teal-l"
            >
              ＋ Agregar
            </button>
          </div>
          {destinos.ciudades.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2">
              {destinos.ciudades.map((c, i) => (
                <li
                  key={`${c.nombre}-${i}`}
                  className="inline-flex items-center gap-2 rounded-full bg-sand-l px-3 py-1 text-xs font-semibold text-dark-2"
                >
                  {c.nombre}
                  <button
                    type="button"
                    onClick={() => removeCiudad(i)}
                    className="text-dark-3 hover:text-rust"
                    aria-label={`Quitar ${c.nombre}`}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </fieldset>

        {/* ── Paradas ───────────────────────────────────────────────── */}
        <fieldset className="rounded-md border border-sand p-3">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-dark-2">
            Paradas · sub-destinos
          </legend>
          {destinos.paradas.length === 0 && (
            <p className="text-xs text-dark-3">
              Sin paradas. Agrega una si el viaje se divide en tramos con fechas propias.
            </p>
          )}
          {destinos.paradas.map((p, i) => (
            <div key={i} className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]">
              <input
                type="text"
                value={p.nombre}
                onChange={(e) => updParada(i, { nombre: e.target.value })}
                placeholder="Lugar de la parada"
                className="block w-full rounded-md border border-sand bg-white px-3 py-2 text-sm text-dark placeholder:text-dark-3 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
              />
              <input
                type="date"
                value={p.fecha_ini ?? ''}
                onChange={(e) => updParada(i, { fecha_ini: e.target.value })}
                className="block w-full rounded-md border border-sand bg-white px-3 py-2 text-sm text-dark focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
              />
              <input
                type="date"
                value={p.fecha_fin ?? ''}
                min={p.fecha_ini || undefined}
                onChange={(e) => updParada(i, { fecha_fin: e.target.value })}
                className="block w-full rounded-md border border-sand bg-white px-3 py-2 text-sm text-dark focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
              />
              <button
                type="button"
                onClick={() => removeParada(i)}
                className="shrink-0 rounded-md border border-sand px-3 py-2 text-xs font-semibold text-dark-3 hover:bg-rust-l hover:text-rust"
                aria-label="Quitar parada"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addParada}
            className="mt-2 rounded-md border border-teal/40 px-3 py-1.5 text-xs font-semibold text-teal-d hover:bg-teal-l"
          >
            ＋ Agregar parada
          </button>
        </fieldset>

        <ParticipantesPicker value={participantes} onChange={setParticipantes} />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextInput
            label="Pagado por"
            value={pagadoPor}
            onChange={(e) => setPagadoPor(e.target.value)}
            placeholder="Quién cubre el viaje"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select
            label="Motivo del viaje"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value as Motivo)}
          >
            {MOTIVOS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
          {motivo === 'Otros' && (
            <TextInput
              label="¿Cuál?"
              value={motivoOtro}
              onChange={(e) => setMotivoOtro(e.target.value)}
              placeholder="Ej: Reunión anual de accionistas"
            />
          )}
        </div>

        <TextArea
          label="Notas del viaje"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={4}
          placeholder="Lo que haya que recordar de este viaje"
        />

        {error && (
          <div className="rounded-md bg-rust-l px-3 py-2 text-xs font-semibold text-rust">{error}</div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-sand px-4 py-2 text-sm font-semibold text-dark-2 hover:bg-sand-l"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-d disabled:opacity-50"
          >
            {submitting ? 'Guardando…' : editing ? '💾 Guardar cambios' : '💾 Guardar viaje'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

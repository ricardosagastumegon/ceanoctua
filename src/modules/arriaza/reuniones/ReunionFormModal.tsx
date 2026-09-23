import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { TextInput } from '@/components/ui/TextInput';
import { TextArea } from '@/components/ui/TextArea';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { describeError } from '@/modules/admin/hooks';
import { SERVICE_META } from '../constants/serviceMeta';
import { invalidarViaje } from '../viajes/invalidar';
import { attReunionesByViajeKey, attReunionesKey } from './hooks';
import {
  TIPOS_REUNION,
  reunionesFullApi,
  type AttReunionInsert,
  type ParticipanteInput,
  type TipoReunion,
} from './full-api';

const META = SERVICE_META.reunion;

type Props = {
  open: boolean;
  viajeId: string;
  reunionId?: string;
  onClose: () => void;
};

/**
 * Formulario de la reunión.
 *
 * Es el único servicio sin dinero: no hay tarifa, ni forma de pago, ni estado
 * de pago. Lo que sí lleva es la lista de participantes con su referencia y su
 * teléfono, porque el PDF se comparte con ellos.
 */
export function ReunionFormModal({ open, viajeId, reunionId, onClose }: Props) {
  const qc = useQueryClient();
  const toast = useToast();
  const cargado = useQuery({
    queryKey: ['att_reunion_full', reunionId],
    queryFn: () => reunionesFullApi.load(reunionId as string),
    enabled: open && !!reunionId,
  });
  const save = useMutation({
    mutationFn: (vars: Parameters<typeof reunionesFullApi.save>[0]) => reunionesFullApi.save(vars),
    onSuccess: (id) => {
      void qc.invalidateQueries({ queryKey: attReunionesKey });
      void qc.invalidateQueries({ queryKey: attReunionesByViajeKey(viajeId) });
      void qc.invalidateQueries({ queryKey: ['att_reunion_full', id] });
      invalidarViaje(qc, viajeId);
    },
  });

  const [titulo, setTitulo] = useState('');
  const [fecha, setFecha] = useState('');
  const [tipo, setTipo] = useState<TipoReunion>('Presencial');
  const [hora, setHora] = useState('');
  const [horaFin, setHoraFin] = useState('');
  const [lugar, setLugar] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [participantes, setParticipantes] = useState<ParticipanteInput[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const r = cargado.data?.cabecera;
    setTitulo(r?.titulo ?? '');
    setFecha(r?.fecha ?? '');
    setTipo((r?.tipo as TipoReunion | null) ?? 'Presencial');
    setHora(r?.hora ?? '');
    setHoraFin(r?.hora_fin ?? '');
    setLugar(r?.lugar ?? '');
    setDescripcion(r?.descripcion ?? '');
    setParticipantes(
      (cargado.data?.participantes ?? []).map((p) => ({
        id: p.id,
        nombre: p.nombre ?? '',
        referencia: p.referencia ?? '',
        telefono: p.telefono ?? '',
      })),
    );
    setError(null);
  }, [open, cargado.data]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) return setError('El título de la reunión es obligatorio.');
    // `fecha` y `hora` son obligatorias en la base, y sin ellas la reunión no
    // podría entrar al itinerario ni al calendario.
    if (!fecha) return setError('La fecha es obligatoria.');
    if (!hora) return setError('La hora de inicio es obligatoria.');
    if (horaFin && horaFin < hora) {
      return setError('La hora de fin no puede ser anterior a la de inicio.');
    }
    setError(null);

    const limpios = participantes.filter(
      (p) => p.nombre.trim() || p.referencia.trim() || p.telefono.trim(),
    );

    const cabecera: AttReunionInsert = {
      viaje_id: viajeId,
      titulo: titulo.trim(),
      fecha,
      tipo,
      hora,
      hora_fin: horaFin || null,
      lugar: lugar.trim() || null,
      descripcion: descripcion.trim() || null,
      // La columna de texto se arma con los nombres: es la que lee el
      // itinerario sin tener que pedir la tabla hija.
      participantes: limpios.map((p) => p.nombre.trim()).filter(Boolean).join(', ') || null,
    };

    try {
      await save.mutateAsync({ id: reunionId, cabecera, participantes: limpios });
      toast.success(reunionId ? 'Reunión actualizada.' : 'Reunión agendada.');
      onClose();
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${META.icon} ${reunionId ? 'Editar' : 'Nueva'} Reunión`}
      size="xl"
    >
      {cargado.isLoading ? (
        <p className="text-sm text-dark-3">Cargando reunión…</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Bloque titulo="La reunión">
            <TextInput label="Título *" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej: Junta con el consejo de Bananera" autoFocus />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <TextInput label="Fecha *" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
              <TextInput label="Inicio *" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
              <TextInput label="Fin" type="time" value={horaFin} onChange={(e) => setHoraFin(e.target.value)} />
              <Select label="Tipo de reunión" value={tipo} onChange={(e) => setTipo(e.target.value as TipoReunion)}>
                {TIPOS_REUNION.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </div>
            <TextInput
              label="Lugar"
              value={lugar}
              onChange={(e) => setLugar(e.target.value)}
              placeholder={tipo === 'Virtual' ? 'Enlace de la videollamada' : 'Dirección o sala'}
            />
            <TextArea label="Descripción" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={4} placeholder="Agenda, antecedentes, lo que haga falta" />
          </Bloque>

          <Bloque titulo="Participantes">
            <p className="text-[11px] text-dark-3">
              Nombre, referencia y teléfono de cada uno. Salen en el PDF que se comparte.
            </p>
            {participantes.length > 0 && (
              <div className="hidden gap-2 px-1 text-[10px] font-extrabold uppercase tracking-wider text-dark-3 sm:grid sm:grid-cols-[2fr_2fr_1.4fr_auto]">
                <span>Nombre</span>
                <span>Referencia</span>
                <span>Teléfono</span>
                <span className="w-[34px]" />
              </div>
            )}
            {participantes.map((x, i) => (
              <div key={x.id ?? `nuevo-${i}`} className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_2fr_1.4fr_auto]">
                <input
                  type="text"
                  value={x.nombre}
                  onChange={(e) => setParticipantes((l) => l.map((y, k) => (k === i ? { ...y, nombre: e.target.value } : y)))}
                  placeholder="Nombre completo"
                  className="block w-full rounded-md border border-sand bg-white px-3 py-2 text-sm text-dark placeholder:text-dark-3 focus:border-teal focus:outline-none"
                />
                <input
                  type="text"
                  value={x.referencia}
                  onChange={(e) => setParticipantes((l) => l.map((y, k) => (k === i ? { ...y, referencia: e.target.value } : y)))}
                  placeholder="Cargo, empresa…"
                  className="block w-full rounded-md border border-sand bg-white px-3 py-2 text-sm text-dark placeholder:text-dark-3 focus:border-teal focus:outline-none"
                />
                <input
                  type="text"
                  value={x.telefono}
                  onChange={(e) => setParticipantes((l) => l.map((y, k) => (k === i ? { ...y, telefono: e.target.value } : y)))}
                  placeholder="+502 …"
                  className="block w-full rounded-md border border-sand bg-white px-3 py-2 text-sm text-dark placeholder:text-dark-3 focus:border-teal focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setParticipantes((l) => l.filter((_, k) => k !== i))}
                  className="rounded-md border border-sand px-2 py-2 text-xs text-dark-3 hover:bg-rust-l hover:text-rust"
                  aria-label="Quitar participante"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setParticipantes((l) => [...l, { nombre: '', referencia: '', telefono: '' }])}
              className="rounded-md border px-3 py-1.5 text-xs font-semibold hover:opacity-80"
              style={{ borderColor: META.solid, color: META.dark }}
            >
              ＋ Agregar participante
            </button>
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
              {save.isPending ? 'Guardando…' : '💾 Guardar Reunión'}
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

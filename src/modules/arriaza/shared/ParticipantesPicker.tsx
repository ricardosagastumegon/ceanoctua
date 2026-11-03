import { useMemo, useState } from 'react';
import { useCreateInvitado, useInvitados, usePersonas } from '@/modules/admin/hooks';
import { useToast } from '@/components/ui/Toast';
import { describeError } from '@/modules/admin/hooks';
import type { ParticipanteInput } from '../viajes/participantes-api';

/**
 * Quién va en el viaje.
 *
 * Era un campo de escribir libre y por eso el presidente quedó registrado de
 * cuatro formas distintas en seis viajes --«Miguel Angel Arriaza», «Miguel
 * Arriaza», «Miguel Angel Arriaz» y pegado a otro con un `&`--. Con nombres
 * sueltos no se puede responder en qué viajes va alguien, que es justo de lo
 * que depende que cada quien vea sus viajes.
 *
 * Ahora cada participante sale de un catálogo: Personal JD primero --son
 * quienes viajan casi siempre-- y después los invitados.
 *
 * El alta rápida de invitado está aquí y no solo en Admin a propósito: uno se
 * entera de que falta alguien a media captura de la lista de pasajeros, y si
 * hay que salirse del formulario para agregarlo, nadie lo va a usar.
 */
export function ParticipantesPicker({
  value,
  onChange,
}: {
  value: ParticipanteInput[];
  onChange: (v: ParticipanteInput[]) => void;
}) {
  const toast = useToast();
  const personasQ = usePersonas();
  const invitadosQ = useInvitados();
  const crearInvitado = useCreateInvitado();

  const [abriendoAlta, setAbriendoAlta] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevaRelacion, setNuevaRelacion] = useState('');

  const yaVan = useMemo(
    () => new Set(value.map((p) => `${p.tipo}:${p.id}`)),
    [value],
  );

  const personas = (personasQ.data ?? []).filter((p) => !yaVan.has(`persona:${p.id}`));
  const invitados = (invitadosQ.data ?? [])
    .filter((i) => i.activo !== false)
    .filter((i) => !yaVan.has(`invitado:${i.id}`));

  function agregar(valor: string) {
    if (!valor) return;
    const [tipo, id] = valor.split(':') as ['persona' | 'invitado', string];
    const nombre =
      tipo === 'persona'
        ? (personasQ.data ?? []).find((p) => p.id === id)?.nombre
        : (invitadosQ.data ?? []).find((i) => i.id === id)?.nombre;
    if (!nombre) return;
    onChange([...value, { tipo, id, nombre }]);
  }

  function quitar(i: number) {
    onChange(value.filter((_, k) => k !== i));
  }

  async function guardarInvitado() {
    const nombre = nuevoNombre.trim();
    if (!nombre) return;
    try {
      const creado = await crearInvitado.mutateAsync({
        nombre,
        relacion: nuevaRelacion.trim() || null,
      });
      onChange([...value, { tipo: 'invitado', id: creado.id, nombre: creado.nombre }]);
      setNuevoNombre('');
      setNuevaRelacion('');
      setAbriendoAlta(false);
      toast.success(`${creado.nombre} agregado al catálogo de invitados.`);
    } catch (e) {
      toast.error(describeError(e));
    }
  }

  return (
    <fieldset className="rounded-md border border-sand p-3">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-dark-2">
        Participantes
      </legend>

      <div className="flex flex-wrap gap-2">
        <select
          value=""
          onChange={(e) => agregar(e.target.value)}
          aria-label="Agregar participante"
          className="block w-full min-w-0 flex-1 rounded-md border border-sand bg-white px-3 py-2 text-sm text-dark focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal sm:w-auto"
        >
          <option value="">＋ Agregar participante…</option>
          {personas.length > 0 && (
            <optgroup label="Personal JD">
              {personas.map((p) => (
                <option key={p.id} value={`persona:${p.id}`}>
                  {p.nombre}
                </option>
              ))}
            </optgroup>
          )}
          {invitados.length > 0 && (
            <optgroup label="Invitados">
              {invitados.map((i) => (
                <option key={i.id} value={`invitado:${i.id}`}>
                  {i.nombre}
                  {i.relacion ? ` · ${i.relacion}` : ''}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        <button
          type="button"
          onClick={() => setAbriendoAlta((v) => !v)}
          className="shrink-0 rounded-md border border-teal/40 px-3 py-2 text-xs font-semibold text-teal-d hover:bg-teal-l"
        >
          {abriendoAlta ? 'Cancelar' : '＋ Nuevo invitado'}
        </button>
      </div>

      {abriendoAlta && (
        <div className="mt-2 rounded-md border border-teal/30 bg-teal-l/40 p-3">
          <p className="mb-2 text-[11px] text-dark-2">
            Se guarda en <b>Admin → Invitados</b> y queda disponible para los demás viajes.
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={nuevoNombre}
              onChange={(e) => setNuevoNombre(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void guardarInvitado();
                }
              }}
              placeholder="Nombre completo"
              autoFocus
              className="block w-full min-w-0 flex-1 rounded-md border border-sand bg-white px-3 py-2 text-sm text-dark placeholder:text-dark-3 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
            />
            <input
              type="text"
              value={nuevaRelacion}
              onChange={(e) => setNuevaRelacion(e.target.value)}
              placeholder="Relación (opcional)"
              className="block w-full min-w-0 flex-1 rounded-md border border-sand bg-white px-3 py-2 text-sm text-dark placeholder:text-dark-3 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
            />
            <button
              type="button"
              onClick={() => void guardarInvitado()}
              disabled={!nuevoNombre.trim() || crearInvitado.isPending}
              className="shrink-0 rounded-md bg-teal px-3 py-2 text-xs font-semibold text-white hover:bg-teal-d disabled:opacity-60"
            >
              {crearInvitado.isPending ? 'Guardando…' : 'Guardar y agregar'}
            </button>
          </div>
        </div>
      )}

      {value.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-2">
          {value.map((p, i) => (
            <li
              key={`${p.tipo}:${p.id}`}
              className={[
                'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold',
                p.tipo === 'persona'
                  ? 'bg-teal-l text-teal-d'
                  : 'bg-purple/10 text-purple',
              ].join(' ')}
            >
              {p.tipo === 'persona' ? '👤' : '👥'} {p.nombre}
              <button
                type="button"
                onClick={() => quitar(i)}
                className="opacity-60 hover:text-rust hover:opacity-100"
                aria-label={`Quitar ${p.nombre}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[11px] text-dark-3">
          Nadie agregado todavía. Quien vaya en el viaje lo verá en su propio Arriaza T&amp;T.
        </p>
      )}
    </fieldset>
  );
}

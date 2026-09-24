import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { TextInput } from '@/components/ui/TextInput';
import { useToast } from '@/components/ui/Toast';
import { describeError } from '@/modules/admin/hooks';
import { subirArchivo, type Aeronave, type AeronaveInsert } from './api';
import { useActualizarAeronave, useCrearAeronave } from './hooks';
import { ACENTOS, ACENTOS_LISTA, ESTADOS } from './constants';

type Props = {
  open: boolean;
  editando: Aeronave | null;
  onClose: () => void;
};

type FormState = {
  matricula: string;
  nombre: string;
  serie: string;
  modelo: string;
  tipo_aeronave: string;
  tipo_pista: string;
  uso: string;
  pax: string;
  tripulantes: string;
  autonomia: string;
  color: string;
  base_operaciones: string;
  acento: string;
  estado: string;
  notas: string;
};

const vacio: FormState = {
  matricula: '', nombre: '', serie: '', modelo: '', tipo_aeronave: '', tipo_pista: '',
  uso: '', pax: '', tripulantes: '', autonomia: '', color: '', base_operaciones: '',
  acento: 'teal', estado: 'operativa', notas: '',
};

function fromRow(a: Aeronave | null): FormState {
  if (!a) return vacio;
  return {
    matricula: a.matricula,
    nombre: a.nombre ?? '',
    serie: a.serie ?? '',
    modelo: a.modelo ?? '',
    tipo_aeronave: a.tipo_aeronave ?? '',
    tipo_pista: a.tipo_pista ?? '',
    uso: a.uso ?? '',
    pax: a.pax != null ? String(a.pax) : '',
    tripulantes: a.tripulantes != null ? String(a.tripulantes) : '',
    autonomia: a.autonomia ?? '',
    color: a.color ?? '',
    base_operaciones: a.base_operaciones ?? '',
    acento: a.acento,
    estado: a.estado,
    notas: a.notas ?? '',
  };
}

const num = (s: string): number | null => {
  const n = Number(s.trim());
  return s.trim() && Number.isFinite(n) ? n : null;
};

function toInput(v: FormState): AeronaveInsert {
  return {
    matricula: v.matricula.trim().toUpperCase(),
    nombre: v.nombre.trim() || null,
    serie: v.serie.trim() || null,
    modelo: v.modelo.trim() || null,
    tipo_aeronave: v.tipo_aeronave.trim() || null,
    tipo_pista: v.tipo_pista.trim() || null,
    uso: v.uso.trim() || null,
    pax: num(v.pax),
    tripulantes: num(v.tripulantes),
    autonomia: v.autonomia.trim() || null,
    color: v.color.trim() || null,
    base_operaciones: v.base_operaciones.trim() || null,
    acento: v.acento,
    estado: v.estado,
    notas: v.notas.trim() || null,
  };
}

/**
 * Alta y edición de la aeronave.
 *
 * Los campos son los del perfil que ya usa el usuario, con sus mismos
 * nombres. Dos de ellos engañan y por eso llevan pista: **Modelo** es el año
 * (2018) y **Color** es el de la pintura de la aeronave, no el de pantalla.
 */
export function AeronaveFormModal({ open, editando, onClose }: Props) {
  const [v, setV] = useState<FormState>(fromRow(editando));
  const [foto, setFoto] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const crear = useCrearAeronave();
  const actualizar = useActualizarAeronave();
  const toast = useToast();

  useEffect(() => {
    setV(fromRow(editando));
    setFoto(null);
    setError(null);
  }, [editando, open]);

  const set = <K extends keyof FormState>(k: K, val: FormState[K]) =>
    setV((p) => ({ ...p, [k]: val }));

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!v.matricula.trim()) {
      setError('La matrícula es obligatoria.');
      return;
    }
    setError(null);
    setGuardando(true);
    try {
      const input = toInput(v);
      if (foto) {
        const { path } = await subirArchivo(input.matricula, 0, foto);
        input.foto_path = path;
      }
      if (editando) {
        await actualizar.mutateAsync({ id: editando.id, patch: input });
        toast.success('Aeronave actualizada.');
      } else {
        await crear.mutateAsync(input);
        toast.success('Aeronave registrada.');
      }
      onClose();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editando ? `Editar ${editando.matricula}` : 'Registrar aeronave'}
      size="lg"
    >
      <form onSubmit={guardar} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextInput
            name="matricula"
            label="Matrícula *"
            value={v.matricula}
            onChange={(e) => set('matricula', e.target.value)}
            required
            autoFocus
            hint="ej. TG-OBI"
          />
          <TextInput
            name="nombre"
            label="Nombre"
            value={v.nombre}
            onChange={(e) => set('nombre', e.target.value)}
            hint="ej. CIRRUS SR22T"
          />
          <TextInput
            name="serie"
            label="Serie"
            value={v.serie}
            onChange={(e) => set('serie', e.target.value)}
            hint="número de fabricación"
          />
          <TextInput
            name="modelo"
            label="Modelo"
            value={v.modelo}
            onChange={(e) => set('modelo', e.target.value)}
            hint="el año del modelo, ej. 2018"
          />
          <TextInput
            name="tipo_aeronave"
            label="Tipo de aeronave"
            value={v.tipo_aeronave}
            onChange={(e) => set('tipo_aeronave', e.target.value)}
            hint="ej. Monomotor"
          />
          <TextInput
            name="tipo_pista"
            label="Tipo de pista"
            value={v.tipo_pista}
            onChange={(e) => set('tipo_pista', e.target.value)}
            hint="ej. A,B,C,D,E,F"
          />
          <TextInput
            name="uso"
            label="Uso"
            value={v.uso}
            onChange={(e) => set('uso', e.target.value)}
            hint="ej. Privado - Aviación General"
          />
          <TextInput
            name="autonomia"
            label="Autonomía"
            value={v.autonomia}
            onChange={(e) => set('autonomia', e.target.value)}
            hint="ej. 4-6 hrs"
          />
          <TextInput
            name="pax"
            label="No. de Pax"
            type="number"
            min="0"
            value={v.pax}
            onChange={(e) => set('pax', e.target.value)}
          />
          <TextInput
            name="tripulantes"
            label="Tripulantes"
            type="number"
            min="0"
            value={v.tripulantes}
            onChange={(e) => set('tripulantes', e.target.value)}
          />
          <TextInput
            name="color"
            label="Color"
            value={v.color}
            onChange={(e) => set('color', e.target.value)}
            hint="el de la pintura, ej. Azul, Gris y Amarillo"
          />
          <TextInput
            name="base_operaciones"
            label="Base de operaciones"
            value={v.base_operaciones}
            onChange={(e) => set('base_operaciones', e.target.value)}
            hint="ej. Aeropuerto Internacional La Aurora MGGT"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-dark-2">Estado</span>
            <select
              value={v.estado}
              onChange={(e) => set('estado', e.target.value)}
              className="block w-full rounded-md border border-sand bg-white px-3 py-2 text-sm text-dark focus:border-teal focus:outline-none"
            >
              {ESTADOS.map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </label>

          <div>
            <span className="mb-1 block text-xs font-semibold text-dark-2">
              Color en pantalla
            </span>
            <div className="flex flex-wrap gap-1.5">
              {ACENTOS_LISTA.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  title={a.label}
                  onClick={() => set('acento', a.key)}
                  className={`h-8 w-8 rounded-md border-2 transition-transform ${
                    v.acento === a.key ? 'scale-110 border-dark' : 'border-transparent'
                  }`}
                  style={{ background: ACENTOS[a.key].grad }}
                />
              ))}
            </div>
          </div>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-dark-2">
            Foto de la aeronave
          </span>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
            className="block w-full text-xs text-dark-2 file:mr-3 file:rounded-md file:border-0 file:bg-teal-l file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-teal-d"
          />
          {editando?.foto_path && !foto && (
            <span className="mt-1 block text-[11px] text-dark-3">
              Ya tiene una foto. Escoge otra solo si quieres reemplazarla.
            </span>
          )}
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-dark-2">Notas</span>
          <textarea
            value={v.notas}
            onChange={(e) => set('notas', e.target.value)}
            rows={2}
            className="block w-full rounded-md border border-sand bg-white px-3 py-2 text-sm text-dark focus:border-teal focus:outline-none"
          />
        </label>

        {error && (
          <p className="rounded-md border border-rust/30 bg-rust-l px-3 py-2 text-sm text-rust">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-sand px-4 py-2 text-sm font-semibold text-dark-2 hover:bg-sand-l"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={guardando}
            className="rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-d disabled:opacity-60"
          >
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

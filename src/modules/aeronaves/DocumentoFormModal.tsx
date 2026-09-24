import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { TextInput } from '@/components/ui/TextInput';
import { useToast } from '@/components/ui/Toast';
import { describeError } from '@/modules/admin/hooks';
import { subirArchivo, type Aeronave, type Documento } from './api';
import { useActualizarDocumento, useCrearDocumento, useTiposCertificado } from './hooks';

type Props = {
  open: boolean;
  aeronave: Aeronave;
  editando: Documento | null;
  /** Año que trae preseleccionado cuando se agrega desde un año concreto. */
  anioSugerido?: number;
  onClose: () => void;
};

/**
 * Alta de un certificado.
 *
 * A propósito corto: lo único que se necesita es tenerlo en digital y a un
 * clic. El nombre sale de un desplegable --el catálogo de Certificados
 * Aéreos de Admin-- para que el mismo certificado no quede guardado con tres
 * nombres distintos según quién lo cargó.
 */
export function DocumentoFormModal({ open, aeronave, editando, anioSugerido, onClose }: Props) {
  const tipos = useTiposCertificado();
  const crear = useCrearDocumento(aeronave.id);
  const actualizar = useActualizarDocumento(aeronave.id);
  const toast = useToast();

  const [tipoId, setTipoId] = useState('');
  const [anio, setAnio] = useState(String(anioSugerido ?? new Date().getFullYear()));
  const [numero, setNumero] = useState('');
  const [vence, setVence] = useState('');
  const [notas, setNotas] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTipoId(editando?.tipo_id ?? '');
    setAnio(String(editando?.anio ?? anioSugerido ?? new Date().getFullYear()));
    setNumero(editando?.numero ?? '');
    setVence(editando?.vence ?? '');
    setNotas(editando?.notas ?? '');
    setArchivo(null);
    setError(null);
  }, [open, editando, anioSugerido]);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!tipoId) {
      setError('Escoge qué certificado es.');
      return;
    }
    const a = Number(anio);
    if (!Number.isInteger(a) || a < 1950 || a > 2200) {
      setError('El año no parece válido.');
      return;
    }
    if (!editando && !archivo) {
      setError('Falta el archivo del certificado.');
      return;
    }

    setError(null);
    setGuardando(true);
    try {
      let archivo_path = editando?.archivo_path ?? null;
      let archivo_nombre = editando?.archivo_nombre ?? null;
      if (archivo) {
        const subido = await subirArchivo(aeronave.matricula, a, archivo);
        archivo_path = subido.path;
        archivo_nombre = subido.nombre;
      }

      const campos = {
        tipo_id: tipoId,
        anio: a,
        numero: numero.trim() || null,
        vence: vence || null,
        notas: notas.trim() || null,
        archivo_path,
        archivo_nombre,
      };

      if (editando) {
        await actualizar.mutateAsync({ id: editando.id, patch: campos });
        toast.success('Certificado actualizado.');
      } else {
        await crear.mutateAsync({ aeronave_id: aeronave.id, ...campos });
        toast.success('Certificado agregado.');
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
      title={editando ? 'Editar certificado' : 'Agregar documento'}
    >
      <form onSubmit={guardar} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-dark-2">Nombre *</span>
          <select
            value={tipoId}
            onChange={(e) => setTipoId(e.target.value)}
            required
            className="block w-full rounded-md border border-sand bg-white px-3 py-2 text-sm text-dark focus:border-teal focus:outline-none"
          >
            <option value="">Escoge un certificado…</option>
            {(tipos.data ?? [])
              .filter((t) => t.activo || t.id === editando?.tipo_id)
              .map((t) => (
                <option key={t.id} value={t.id}>{t.nombre}</option>
              ))}
          </select>
          <span className="mt-1 block text-[11px] text-dark-3">
            La lista se administra en Admin → Certificados Aéreos.
          </span>
        </label>

        <TextInput
          name="anio"
          label="Año *"
          type="number"
          min="1950"
          max="2200"
          value={anio}
          onChange={(e) => setAnio(e.target.value)}
          required
          hint="el año al que corresponde el certificado"
        />

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-dark-2">
            Archivo {editando ? '' : '*'}
          </span>
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/*"
            onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
            className="block w-full text-xs text-dark-2 file:mr-3 file:rounded-md file:border-0 file:bg-teal-l file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-teal-d"
          />
          <span className="mt-1 block text-[11px] text-dark-3">
            {editando?.archivo_nombre
              ? `Ya tiene «${editando.archivo_nombre}». Escoge otro solo si quieres reemplazarlo.`
              : 'PDF o imagen.'}
          </span>
        </label>

        <details className="rounded-md border border-sand bg-sand-l/50 px-3 py-2">
          <summary className="cursor-pointer text-xs font-semibold text-dark-2">
            Datos opcionales
          </summary>
          <div className="mt-3 space-y-3">
            <TextInput
              name="numero"
              label="Número"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
            />
            <TextInput
              name="vence"
              label="Vence"
              type="date"
              value={vence}
              onChange={(e) => setVence(e.target.value)}
              hint="solo si quieres que después avise con anticipación"
            />
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-dark-2">Notas</span>
              <textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                rows={2}
                className="block w-full rounded-md border border-sand bg-white px-3 py-2 text-sm text-dark focus:border-teal focus:outline-none"
              />
            </label>
          </div>
        </details>

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

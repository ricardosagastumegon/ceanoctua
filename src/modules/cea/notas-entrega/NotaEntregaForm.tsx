import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { TextInput } from '@/components/ui/TextInput';
import { useToast } from '@/components/ui/Toast';
import { describeError } from '@/modules/admin/hooks';
import { useActualizarNotaEntrega, useCrearNotaEntrega } from './hooks';
import type { NotaEntrega } from './api';

type Props = {
  editando: NotaEntrega | null;
  onClose: () => void;
};

const hoy = () => new Date().toISOString().slice(0, 10);

/** Bloque del formulario, con su rótulo y su barra de color. */
function Bloque({ titulo, ayuda, children }: {
  titulo: string;
  ayuda?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border-l-[3px] border-teal bg-white px-3 py-2.5 shadow-[inset_0_0_0_1px_rgba(7,126,132,.13)]">
      <div className="mb-2">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-teal-d">
          {titulo}
        </span>
        {ayuda && <p className="text-[11px] text-dark-3">{ayuda}</p>}
      </div>
      {children}
    </section>
  );
}

/**
 * Alta y edición de una nota de entrega de documentos.
 *
 * No hay campo «Recibido por»: en la hoja se imprime el mismo nombre de
 * «Para», porque quien recibe es a quien iba dirigida. Pedirlo dos veces
 * sería invitar a que digan cosas distintas.
 */
export function NotaEntregaForm({ editando, onClose }: Props) {
  const toast = useToast();
  const crear = useCrearNotaEntrega();
  const actualizar = useActualizarNotaEntrega();

  const [fecha, setFecha] = useState(hoy);
  const [para, setPara] = useState('');
  const [departamento, setDepartamento] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [notas, setNotas] = useState('');
  const [entregadoPor, setEntregadoPor] = useState('');
  const [entregadoDepto, setEntregadoDepto] = useState('');
  const [fechaEntrega, setFechaEntrega] = useState('');
  const [solicitadoPor, setSolicitadoPor] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    setFecha(editando?.fecha ?? hoy());
    setPara(editando?.para ?? '');
    setDepartamento(editando?.departamento ?? '');
    setDescripcion(editando?.descripcion ?? '');
    setNotas(editando?.notas ?? '');
    setEntregadoPor(editando?.entregado_por ?? '');
    setEntregadoDepto(editando?.entregado_departamento ?? '');
    setFechaEntrega(editando?.fecha_entrega ?? '');
    setSolicitadoPor(editando?.solicitado_por ?? '');
    setError(null);
  }, [editando]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!para.trim()) return setError('Falta a quién va dirigida la nota.');
    setError(null);
    setGuardando(true);

    // El correlativo lo pone la base: nunca se manda desde acá.
    const campos = {
      fecha,
      para: para.trim(),
      departamento: departamento.trim() || null,
      descripcion: descripcion.trim() || null,
      notas: notas.trim() || null,
      entregado_por: entregadoPor.trim() || null,
      entregado_departamento: entregadoDepto.trim() || null,
      fecha_entrega: fechaEntrega || null,
      solicitado_por: solicitadoPor.trim() || null,
    };

    try {
      if (editando) await actualizar.mutateAsync({ id: editando.id, patch: campos });
      else await crear.mutateAsync(campos);
      toast.success(editando ? 'Nota actualizada.' : 'Nota de entrega creada.');
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
      title={`📄 ${editando ? `Editar ${editando.serial ?? 'nota'}` : 'Nueva nota de entrega'}`}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <Bloque titulo="A quién se le entrega" ayuda="Este mismo nombre es el «Recibido por» de la hoja.">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <TextInput label="Fecha" type="date" value={fecha}
              onChange={(e) => setFecha(e.target.value)} />
            <TextInput label="Para" value={para}
              onChange={(e) => setPara(e.target.value)} placeholder="Nombre de quien recibe" />
            <TextInput label="Departamento" value={departamento}
              onChange={(e) => setDepartamento(e.target.value)} />
          </div>
        </Bloque>

        <Bloque titulo="Descripción de documentos" ayuda="El detalle de lo que se entrega.">
          <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={5}
            placeholder="Un renglón por documento…"
            className="block w-full rounded-md border border-sand bg-white px-3 py-2 text-sm text-dark focus:border-teal focus:outline-none" />
        </Bloque>

        <Bloque titulo="Notas">
          <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={3}
            className="block w-full rounded-md border border-sand bg-white px-3 py-2 text-sm text-dark focus:border-teal focus:outline-none" />
        </Bloque>

        <Bloque titulo="Quién entrega">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <TextInput label="Entregado por" value={entregadoPor}
              onChange={(e) => setEntregadoPor(e.target.value)} />
            <TextInput label="Departamento" value={entregadoDepto}
              onChange={(e) => setEntregadoDepto(e.target.value)} />
            <TextInput label="Fecha de entrega" type="date" value={fechaEntrega}
              onChange={(e) => setFechaEntrega(e.target.value)} />
          </div>
          <div className="mt-3 sm:w-1/3">
            <TextInput label="Solicitado por" value={solicitadoPor}
              onChange={(e) => setSolicitadoPor(e.target.value)}
              hint="Opcional: si lo dejás vacío, no sale en la hoja." />
          </div>
        </Bloque>

        {error && (
          <p className="rounded-md border border-rust/30 bg-rust-l px-3 py-2 text-sm text-rust">{error}</p>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose}
            className="rounded-md border border-sand px-4 py-2 text-sm font-semibold text-dark-2 hover:bg-sand-l">
            Cancelar
          </button>
          <button type="submit" disabled={guardando}
            className="rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-d disabled:opacity-60">
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

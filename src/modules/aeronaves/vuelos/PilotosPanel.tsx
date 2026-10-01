import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { TextInput } from '@/components/ui/TextInput';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { describeError } from '@/modules/admin/hooks';
import { formatDate } from '@/lib/dates';
import { acento } from '../constants';
import type { Aeronave } from '../api';
import { useBorrarPiloto, useGuardarPiloto, usePilotos } from './hooks';
import type { Piloto } from './api';

const AMBAR = '#b4460f';

/** Días que faltan para el vencimiento; negativo si ya pasó. */
function diasPara(fecha: string | null): number | null {
  if (!fecha) return null;
  const hoy = new Date().toISOString().slice(0, 10);
  return Math.round(
    (Date.parse(`${fecha}T00:00:00`) - Date.parse(`${hoy}T00:00:00`)) / 86_400_000,
  );
}

/**
 * El catálogo de pilotos.
 *
 * Se capturan una vez y se escogen en cada vuelo. El vencimiento del médico
 * se vigila igual que los certificados de la aeronave: un piloto con el
 * médico vencido no debería volar, y enterarse el día del vuelo es tarde.
 */
export function PilotosPanel({ aeronave, canEdit }: { aeronave: Aeronave; canEdit: boolean }) {
  const col = acento(aeronave.acento);
  const q = usePilotos();
  const guardar = useGuardarPiloto(aeronave.id);
  const borrar = useBorrarPiloto(aeronave.id);
  const toast = useToast();
  const confirmar = useConfirm();
  const [editando, setEditando] = useState<Piloto | null>(null);
  const [abierto, setAbierto] = useState(false);

  const pilotos = q.data ?? [];

  async function quitar(p: Piloto) {
    const ok = await confirmar({
      title: 'Quitar piloto',
      message: <>¿Quitar a <b>{p.nombre}</b> del catálogo? Los vuelos que ya lo mencionan no se tocan.</>,
      confirmLabel: 'Quitar',
      danger: true,
    });
    if (!ok) return;
    try {
      await borrar.mutateAsync(p.id);
      toast.success('Piloto quitado.');
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  return (
    <div className="rounded-card border border-sand bg-white p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: col.dark }}>
            Pilotos · {pilotos.length}
          </h2>
          <p className="mt-0.5 text-[11px] text-dark-3">
            Se capturan una vez y se escogen en cada vuelo.
          </p>
        </div>
        {canEdit && (
          <button type="button" onClick={() => { setEditando(null); setAbierto(true); }}
            className="rounded-md px-3 py-2 text-xs font-extrabold text-white hover:opacity-90"
            style={{ backgroundColor: col.solid }}>
            ＋ Piloto
          </button>
        )}
      </div>

      {q.isLoading && <p className="text-sm text-dark-3">Cargando…</p>}
      {pilotos.length === 0 && !q.isLoading && (
        <p className="py-2 text-sm italic text-dark-3">Todavía no hay pilotos capturados.</p>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {pilotos.map((p) => {
          const dias = diasPara(p.medico_vence);
          // Un mes de aviso: da tiempo a sacar cita y renovarlo.
          const alerta = dias !== null && dias <= 30;
          return (
            <div key={p.id} className="flex items-center gap-3 rounded-md border-l-4 bg-sand-l px-3 py-2"
              style={{ borderLeftColor: alerta ? AMBAR : col.solid, opacity: p.activo ? 1 : 0.55 }}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-extrabold" style={{ color: col.dark }}>
                    {p.nombre}
                  </span>
                  {!p.activo && (
                    <span className="rounded bg-sand px-1 text-[9px] font-extrabold uppercase text-dark-3">
                      inactivo
                    </span>
                  )}
                </div>
                <div className="truncate text-[11px] text-dark-3">
                  {[p.licencia, p.tipo].filter(Boolean).join(' · ') || '—'}
                </div>
                {p.medico_vence && (
                  <div className="text-[11px]" style={{ color: alerta ? AMBAR : undefined }}>
                    Médico vence {formatDate(p.medico_vence)}
                    {dias !== null && dias < 0 && ' · vencido'}
                    {dias !== null && dias >= 0 && dias <= 30 && ` · faltan ${dias} días`}
                  </div>
                )}
              </div>
              {canEdit && (
                <div className="flex shrink-0 gap-1">
                  <button type="button" onClick={() => { setEditando(p); setAbierto(true); }}
                    title="Editar" className="px-1 text-[12px] opacity-50 hover:opacity-100">✏️</button>
                  <button type="button" onClick={() => void quitar(p)}
                    title="Quitar" className="px-1 text-[12px] opacity-50 hover:opacity-100">🗑</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {abierto && (
        <PilotoForm
          editando={editando}
          onClose={() => { setAbierto(false); setEditando(null); }}
          onGuardar={async (datos) => {
            await guardar.mutateAsync({ id: editando?.id, datos });
            toast.success(editando ? 'Piloto actualizado.' : 'Piloto agregado.');
          }}
        />
      )}
    </div>
  );
}

function PilotoForm({ editando, onClose, onGuardar }: {
  editando: Piloto | null;
  onClose: () => void;
  onGuardar: (datos: { nombre: string; licencia: string | null; tipo: string | null; medico_vence: string | null; telefono: string | null; activo: boolean; notas: string | null }) => Promise<void>;
}) {
  const toast = useToast();
  const [nombre, setNombre] = useState('');
  const [licencia, setLicencia] = useState('');
  const [tipo, setTipo] = useState('');
  const [medico, setMedico] = useState('');
  const [telefono, setTelefono] = useState('');
  const [activo, setActivo] = useState(true);
  const [notas, setNotas] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    setNombre(editando?.nombre ?? '');
    setLicencia(editando?.licencia ?? '');
    setTipo(editando?.tipo ?? '');
    setMedico(editando?.medico_vence ?? '');
    setTelefono(editando?.telefono ?? '');
    setActivo(editando?.activo ?? true);
    setNotas(editando?.notas ?? '');
    setError(null);
  }, [editando]);

  async function submit() {
    if (!nombre.trim()) return setError('Falta el nombre.');
    setError(null);
    setGuardando(true);
    try {
      await onGuardar({
        nombre: nombre.trim(),
        licencia: licencia.trim() || null,
        tipo: tipo.trim() || null,
        medico_vence: medico || null,
        telefono: telefono.trim() || null,
        activo,
        notas: notas.trim() || null,
      });
      onClose();
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={editando ? 'Editar piloto' : 'Nuevo piloto'}>
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextInput label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <TextInput label="Licencia" value={licencia} onChange={(e) => setLicencia(e.target.value)}
            placeholder="GT-PPL-2287" />
          <TextInput label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}
            placeholder="PPL · dueño / Instructor" />
          <TextInput label="Vence el médico" type="date" value={medico}
            onChange={(e) => setMedico(e.target.value)} hint="se avisa un mes antes" />
          <TextInput label="Teléfono" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          <label className="flex items-end gap-2 pb-2 text-sm text-dark-2">
            <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)}
              className="h-3.5 w-3.5 accent-teal" />
            Activo
          </label>
        </div>
        <TextInput label="Notas" value={notas} onChange={(e) => setNotas(e.target.value)} />

        {error && (
          <p className="rounded-md border border-rust/30 bg-rust-l px-3 py-2 text-sm text-rust">{error}</p>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose}
            className="rounded-md border border-sand px-4 py-2 text-sm font-semibold text-dark-2 hover:bg-sand-l">
            Cancelar
          </button>
          <button type="button" onClick={() => void submit()} disabled={guardando}
            className="rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-d disabled:opacity-60">
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

import { useEffect, useState, type FormEvent } from 'react';
import { TextInput } from '@/components/ui/TextInput';
import { TextArea } from '@/components/ui/TextArea';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { describeError } from '@/modules/admin/hooks';
import {
  useAddFamiliar,
  useAddFecha,
  useAddVehiculo,
  usePerfil,
  useRemoveFamiliar,
  useRemoveFecha,
  useRemoveVehiculo,
  useSavePerfil,
} from './hooks';
import { formatDate } from '@/lib/dates';

type ProfileFields = {
  bday: string;
  phone: string;
  telco: string;
  email: string;
  address: string;
  nit: string;
  dpi: string;
  pilot_name: string;
  pilot_phone: string;
  notas: string;
};

const emptyProfile: ProfileFields = {
  bday: '',
  phone: '',
  telco: '',
  email: '',
  address: '',
  nit: '',
  dpi: '',
  pilot_name: '',
  pilot_phone: '',
  notas: '',
};

export function PerfilSection({ miembroId, canEdit }: { miembroId: string; canEdit: boolean }) {
  const toast = useToast();
  const confirm = useConfirm();
  const query = usePerfil(miembroId);
  const save = useSavePerfil(miembroId);
  const addVeh = useAddVehiculo(miembroId);
  const remVeh = useRemoveVehiculo(miembroId);
  const addFam = useAddFamiliar(miembroId);
  const remFam = useRemoveFamiliar(miembroId);
  const addFec = useAddFecha(miembroId);
  const remFec = useRemoveFecha(miembroId);

  const [fields, setFields] = useState<ProfileFields>(emptyProfile);
  const [vehDraft, setVehDraft] = useState({ modelo: '', placa: '' });
  const [famDraft, setFamDraft] = useState({ nombre: '', relacion: '', fecha_nac: '' });
  const [fecDraft, setFecDraft] = useState({ titulo: '', fecha: '' });

  useEffect(() => {
    const p = query.data?.perfil;
    if (!p) {
      setFields(emptyProfile);
      return;
    }
    setFields({
      bday: p.bday ?? '',
      phone: p.phone ?? '',
      telco: p.telco ?? '',
      email: p.email ?? '',
      address: p.address ?? '',
      nit: p.nit ?? '',
      dpi: p.dpi ?? '',
      pilot_name: p.pilot_name ?? '',
      pilot_phone: p.pilot_phone ?? '',
      notas: p.notas ?? '',
    });
  }, [query.data?.perfil]);

  function upd<K extends keyof ProfileFields>(k: K, v: string) {
    setFields((p) => ({ ...p, [k]: v }));
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    try {
      await save.mutateAsync({
        bday: fields.bday || null,
        phone: fields.phone.trim() || null,
        telco: fields.telco.trim() || null,
        email: fields.email.trim() || null,
        address: fields.address.trim() || null,
        nit: fields.nit.trim() || null,
        dpi: fields.dpi.trim() || null,
        pilot_name: fields.pilot_name.trim() || null,
        pilot_phone: fields.pilot_phone.trim() || null,
        notas: fields.notas.trim() || null,
      });
      toast.success('Perfil guardado.');
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  async function addVehiculo() {
    if (!query.data?.perfil) {
      toast.error('Guarda primero el perfil para poder agregar vehículos.');
      return;
    }
    if (!vehDraft.modelo.trim() && !vehDraft.placa.trim()) return;
    try {
      await addVeh.mutateAsync({
        perfilId: query.data.perfil.id,
        modelo: vehDraft.modelo.trim() || null,
        placa: vehDraft.placa.trim() || null,
      });
      setVehDraft({ modelo: '', placa: '' });
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  async function addFamiliar() {
    if (!query.data?.perfil) {
      toast.error('Guarda primero el perfil.');
      return;
    }
    if (!famDraft.nombre.trim()) return;
    try {
      await addFam.mutateAsync({
        perfilId: query.data.perfil.id,
        nombre: famDraft.nombre.trim(),
        relacion: famDraft.relacion.trim() || null,
        fecha_nac: famDraft.fecha_nac || null,
      });
      setFamDraft({ nombre: '', relacion: '', fecha_nac: '' });
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  async function addFecha() {
    if (!query.data?.perfil) {
      toast.error('Guarda primero el perfil.');
      return;
    }
    if (!fecDraft.titulo.trim() || !fecDraft.fecha) return;
    try {
      await addFec.mutateAsync({
        perfilId: query.data.perfil.id,
        titulo: fecDraft.titulo.trim(),
        fecha: fecDraft.fecha,
      });
      setFecDraft({ titulo: '', fecha: '' });
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  async function confirmAndRemove(label: string, fn: () => Promise<unknown>) {
    const ok = await confirm({
      title: 'Borrar',
      message: <>¿Borrar <strong>{label}</strong>?</>,
      danger: true,
      confirmLabel: 'Borrar',
    });
    if (!ok) return;
    try {
      await fn();
    } catch (err) {
      toast.error(describeError(err, 'delete'));
    }
  }

  if (query.isLoading) {
    return <p className="text-sm text-dark-3">Cargando perfil…</p>;
  }
  if (query.isError) {
    return <p className="text-sm text-rust">Error: {describeError(query.error)}</p>;
  }

  const hasPerfil = !!query.data?.perfil;

  return (
    <section className="space-y-8">
      <header>
        <h2 className="font-heading text-xl font-semibold text-dark">Perfil personal</h2>
        <p className="mt-1 text-sm text-dark-2">
          Datos del miembro y sub-listas (vehículos, familia, fechas importantes).
        </p>
      </header>

      <form onSubmit={handleSave} className="space-y-4 rounded-card border border-sand bg-white p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextInput name="bday" label="Cumpleaños" type="date" value={fields.bday} onChange={(e) => upd('bday', e.target.value)} disabled={!canEdit} />
          <TextInput name="phone" label="Teléfono" value={fields.phone} onChange={(e) => upd('phone', e.target.value)} disabled={!canEdit} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextInput name="telco" label="Compañía telefónica" value={fields.telco} onChange={(e) => upd('telco', e.target.value)} disabled={!canEdit} />
          <TextInput name="email" label="Email" type="email" value={fields.email} onChange={(e) => upd('email', e.target.value)} disabled={!canEdit} />
        </div>
        <TextInput name="address" label="Dirección" value={fields.address} onChange={(e) => upd('address', e.target.value)} disabled={!canEdit} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextInput name="nit" label="NIT" value={fields.nit} onChange={(e) => upd('nit', e.target.value)} disabled={!canEdit} />
          <TextInput name="dpi" label="DPI" value={fields.dpi} onChange={(e) => upd('dpi', e.target.value)} disabled={!canEdit} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextInput name="pilot_name" label="Nombre del piloto" value={fields.pilot_name} onChange={(e) => upd('pilot_name', e.target.value)} disabled={!canEdit} />
          <TextInput name="pilot_phone" label="Teléfono del piloto" value={fields.pilot_phone} onChange={(e) => upd('pilot_phone', e.target.value)} disabled={!canEdit} />
        </div>
        <TextArea name="notas" label="Notas" value={fields.notas} onChange={(e) => upd('notas', e.target.value)} disabled={!canEdit} />

        {canEdit && (
          <div className="flex justify-end">
            <button type="submit" disabled={save.isPending} className="rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-d disabled:opacity-60">
              {save.isPending ? 'Guardando…' : hasPerfil ? 'Guardar cambios' : 'Crear perfil'}
            </button>
          </div>
        )}
      </form>

      {/* Vehículos */}
      <section className="space-y-3 rounded-card border border-sand bg-white p-6 shadow-sm">
        <h3 className="font-heading text-lg font-semibold text-dark">Vehículos</h3>
        {(query.data?.vehiculos ?? []).length === 0 ? (
          <p className="text-sm text-dark-3">Sin vehículos.</p>
        ) : (
          <ul className="divide-y divide-sand">
            {query.data?.vehiculos.map((v) => (
              <li key={v.id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  <span className="text-dark">{v.modelo ?? '—'}</span>
                  {v.placa && <span className="ml-2 font-mono text-xs text-dark-3">{v.placa}</span>}
                </span>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => void confirmAndRemove(v.modelo ?? v.placa ?? 'vehículo', () => remVeh.mutateAsync(v.id))}
                    className="text-xs text-rust opacity-70 hover:opacity-100"
                  >
                    Borrar
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {canEdit && (
          <div className="flex flex-wrap gap-2 pt-2">
            <input type="text" placeholder="Modelo" value={vehDraft.modelo} onChange={(e) => setVehDraft((d) => ({ ...d, modelo: e.target.value }))} className="flex-1 min-w-32 rounded-md border border-sand px-3 py-1.5 text-sm" />
            <input type="text" placeholder="Placa" value={vehDraft.placa} onChange={(e) => setVehDraft((d) => ({ ...d, placa: e.target.value }))} className="w-32 rounded-md border border-sand px-3 py-1.5 text-sm" />
            <button type="button" onClick={() => void addVehiculo()} disabled={addVeh.isPending || !hasPerfil} className="rounded-md bg-teal px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-d disabled:opacity-50">
              + Agregar
            </button>
          </div>
        )}
      </section>

      {/* Familia */}
      <section className="space-y-3 rounded-card border border-sand bg-white p-6 shadow-sm">
        <h3 className="font-heading text-lg font-semibold text-dark">Familia</h3>
        {(query.data?.familia ?? []).length === 0 ? (
          <p className="text-sm text-dark-3">Sin familiares registrados.</p>
        ) : (
          <ul className="divide-y divide-sand">
            {query.data?.familia.map((f) => (
              <li key={f.id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  <span className="font-medium text-dark">{f.nombre}</span>
                  {f.relacion && <span className="ml-2 text-dark-3">({f.relacion})</span>}
                  {f.fecha_nac && <span className="ml-2 text-xs text-dark-3">· {formatDate(f.fecha_nac)}</span>}
                </span>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => void confirmAndRemove(f.nombre, () => remFam.mutateAsync(f.id))}
                    className="text-xs text-rust opacity-70 hover:opacity-100"
                  >
                    Borrar
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {canEdit && (
          <div className="flex flex-wrap gap-2 pt-2">
            <input type="text" placeholder="Nombre" value={famDraft.nombre} onChange={(e) => setFamDraft((d) => ({ ...d, nombre: e.target.value }))} className="flex-1 min-w-32 rounded-md border border-sand px-3 py-1.5 text-sm" />
            <input type="text" placeholder="Relación" value={famDraft.relacion} onChange={(e) => setFamDraft((d) => ({ ...d, relacion: e.target.value }))} className="w-32 rounded-md border border-sand px-3 py-1.5 text-sm" />
            <input type="date" value={famDraft.fecha_nac} onChange={(e) => setFamDraft((d) => ({ ...d, fecha_nac: e.target.value }))} className="rounded-md border border-sand px-3 py-1.5 text-sm" />
            <button type="button" onClick={() => void addFamiliar()} disabled={addFam.isPending || !hasPerfil} className="rounded-md bg-teal px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-d disabled:opacity-50">
              + Agregar
            </button>
          </div>
        )}
      </section>

      {/* Fechas */}
      <section className="space-y-3 rounded-card border border-sand bg-white p-6 shadow-sm">
        <h3 className="font-heading text-lg font-semibold text-dark">Fechas importantes</h3>
        {(query.data?.fechas ?? []).length === 0 ? (
          <p className="text-sm text-dark-3">Sin fechas.</p>
        ) : (
          <ul className="divide-y divide-sand">
            {query.data?.fechas.map((f) => (
              <li key={f.id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  <span className="font-medium text-dark">{f.titulo}</span>
                  <span className="ml-2 text-dark-3">{formatDate(f.fecha)}</span>
                </span>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => void confirmAndRemove(f.titulo, () => remFec.mutateAsync(f.id))}
                    className="text-xs text-rust opacity-70 hover:opacity-100"
                  >
                    Borrar
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {canEdit && (
          <div className="flex flex-wrap gap-2 pt-2">
            <input type="text" placeholder="Etiqueta" value={fecDraft.titulo} onChange={(e) => setFecDraft((d) => ({ ...d, titulo: e.target.value }))} className="flex-1 min-w-32 rounded-md border border-sand px-3 py-1.5 text-sm" />
            <input type="date" value={fecDraft.fecha} onChange={(e) => setFecDraft((d) => ({ ...d, fecha: e.target.value }))} className="rounded-md border border-sand px-3 py-1.5 text-sm" />
            <button type="button" onClick={() => void addFecha()} disabled={addFec.isPending || !hasPerfil} className="rounded-md bg-teal px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-d disabled:opacity-50">
              + Agregar
            </button>
          </div>
        )}
      </section>
    </section>
  );
}

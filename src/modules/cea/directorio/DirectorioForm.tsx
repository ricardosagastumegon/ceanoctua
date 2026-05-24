import { useEffect, useState, type FormEvent } from 'react';
import { TextInput } from '@/components/ui/TextInput';
import { TextArea } from '@/components/ui/TextArea';
import { Select } from '@/components/ui/Select';
import type { CatalogFormProps } from '@/modules/admin/components/CatalogPage';
import type { Directorio, DirectorioInsert } from './api';

type FormState = {
  nombre: string;
  tipo: string;
  razon: string;
  nit: string;
  giro: string;
  tel: string;
  whatsapp: string;
  email: string;
  web: string;
  direccion: string;
  notas: string;
};

const empty: FormState = {
  nombre: '',
  tipo: '',
  razon: '',
  nit: '',
  giro: '',
  tel: '',
  whatsapp: '',
  email: '',
  web: '',
  direccion: '',
  notas: '',
};

function fromRow(r: Directorio | null | undefined): FormState {
  if (!r) return empty;
  return {
    nombre: r.nombre ?? '',
    tipo: r.tipo ?? '',
    razon: r.razon ?? '',
    nit: r.nit ?? '',
    giro: r.giro ?? '',
    tel: r.tel ?? '',
    whatsapp: r.whatsapp ?? '',
    email: r.email ?? '',
    web: r.web ?? '',
    direccion: r.direccion ?? '',
    notas: r.notas ?? '',
  };
}

function toInput(s: FormState): DirectorioInsert {
  const t = (v: string) => v.trim() || null;
  return {
    nombre: s.nombre.trim(),
    tipo: t(s.tipo),
    razon: t(s.razon),
    nit: t(s.nit),
    giro: t(s.giro),
    tel: t(s.tel),
    whatsapp: t(s.whatsapp),
    email: t(s.email),
    web: t(s.web),
    direccion: t(s.direccion),
    notas: t(s.notas),
  };
}

export function DirectorioForm({ initial, submitting, onSubmit, onCancel }: CatalogFormProps<Directorio, DirectorioInsert>) {
  const [v, setV] = useState<FormState>(fromRow(initial));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setV(fromRow(initial));
    setError(null);
  }, [initial]);

  function upd<K extends keyof FormState>(k: K, val: string) {
    setV((p) => ({ ...p, [k]: val }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!v.nombre.trim()) {
      setError('El nombre es obligatorio.');
      return;
    }
    setError(null);
    await onSubmit(toInput(v));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextInput name="nombre" label="Nombre *" value={v.nombre} onChange={(e) => upd('nombre', e.target.value)} required autoFocus />
        <Select name="tipo" label="Tipo" value={v.tipo} onChange={(e) => upd('tipo', e.target.value)}>
          <option value="">—</option>
          <option value="Persona">Persona</option>
          <option value="Empresa">Empresa</option>
        </Select>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextInput name="razon" label="Razón social" value={v.razon} onChange={(e) => upd('razon', e.target.value)} />
        <TextInput name="nit" label="NIT" value={v.nit} onChange={(e) => upd('nit', e.target.value)} />
      </div>
      <TextInput name="giro" label="Giro" value={v.giro} onChange={(e) => upd('giro', e.target.value)} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextInput name="tel" label="Teléfono" value={v.tel} onChange={(e) => upd('tel', e.target.value)} />
        <TextInput name="whatsapp" label="WhatsApp" value={v.whatsapp} onChange={(e) => upd('whatsapp', e.target.value)} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextInput name="email" label="Email" type="email" value={v.email} onChange={(e) => upd('email', e.target.value)} />
        <TextInput name="web" label="Web" value={v.web} onChange={(e) => upd('web', e.target.value)} hint="ej. www.ejemplo.com" />
      </div>
      <TextInput name="direccion" label="Dirección" value={v.direccion} onChange={(e) => upd('direccion', e.target.value)} />
      <TextArea name="notas" label="Notas" value={v.notas} onChange={(e) => upd('notas', e.target.value)} />

      {error && <p className="rounded-md border border-rust/30 bg-rust-l px-3 py-2 text-sm text-rust">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="rounded-md border border-sand px-4 py-2 text-sm font-semibold text-dark-2 hover:bg-sand-l">Cancelar</button>
        <button type="submit" disabled={submitting} className="rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-d disabled:opacity-60">
          {submitting ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  );
}

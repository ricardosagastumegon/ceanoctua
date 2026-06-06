import { useEffect, useState, type FormEvent } from 'react';
import { TextInput } from '@/components/ui/TextInput';
import { TextArea } from '@/components/ui/TextArea';
import { Select } from '@/components/ui/Select';
import type { CatalogFormProps } from '@/modules/admin/components/CatalogPage';
import type { Consumo, ConsumoInsert } from './api';
import type { Database } from '@/types/database';
import { useAutorizadores, useEmpleados, useProveedores, useTarjetas } from '@/modules/admin/hooks';
import { ConsumoRenglonesPanel } from './ConsumoRenglonesPanel';

type Currency = Database['public']['Enums']['currency'];

type FormState = {
  fecha: string;
  empresa: string;
  card_id: string;
  tarjeta_id: string;
  proveedor: string;
  proveedor_id: string;
  concepto: string;
  monto: string;
  moneda: Currency;
  autorizador_id: string;
  // Campos nuevos de Fase 17 · F-4
  solicitado_por: string;
  solicitado_por_id: string;
  no_autorizacion: string;
  pagado_por: string;
};

const today = () => new Date().toISOString().slice(0, 10);
const empty: FormState = {
  fecha: today(),
  empresa: '',
  card_id: '',
  tarjeta_id: '',
  proveedor: '',
  proveedor_id: '',
  concepto: '',
  monto: '',
  moneda: 'GTQ',
  autorizador_id: '',
  solicitado_por: '',
  solicitado_por_id: '',
  no_autorizacion: '',
  pagado_por: '',
};

function fromRow(r: Consumo | null | undefined): FormState {
  if (!r) return empty;
  return {
    fecha: r.fecha ?? today(),
    empresa: r.empresa ?? '',
    card_id: r.card_id ?? '',
    tarjeta_id: r.tarjeta_id ?? '',
    proveedor: r.proveedor ?? '',
    proveedor_id: r.proveedor_id ?? '',
    concepto: r.concepto ?? '',
    monto: String(r.monto),
    moneda: r.moneda,
    autorizador_id: r.autorizador_id ?? '',
    solicitado_por: r.solicitado_por ?? '',
    solicitado_por_id: r.solicitado_por_id ?? '',
    no_autorizacion: r.no_autorizacion ?? '',
    pagado_por: r.pagado_por ?? '',
  };
}

function toInput(s: FormState): ConsumoInsert {
  const n = Number(s.monto);
  return {
    fecha: s.fecha,
    empresa: s.empresa.trim() || null,
    card_id: s.card_id.trim(),
    tarjeta_id: s.tarjeta_id || null,
    proveedor: s.proveedor.trim(),
    proveedor_id: s.proveedor_id || null,
    concepto: s.concepto.trim(),
    monto: Number.isFinite(n) ? n : 0,
    moneda: s.moneda,
    autorizador_id: s.autorizador_id || null,
    solicitado_por: s.solicitado_por.trim() || null,
    solicitado_por_id: s.solicitado_por_id || null,
    no_autorizacion: s.no_autorizacion.trim() || null,
    pagado_por: s.pagado_por.trim() || null,
  };
}

export function ConsumoForm({ initial, submitting, onSubmit, onCancel }: CatalogFormProps<Consumo, ConsumoInsert>) {
  const [v, setV] = useState<FormState>(fromRow(initial));
  const [error, setError] = useState<string | null>(null);
  const tarjetas = useTarjetas();
  const proveedores = useProveedores();
  const autorizadores = useAutorizadores();
  const empleados = useEmpleados();

  useEffect(() => {
    setV(fromRow(initial));
    setError(null);
  }, [initial]);

  function upd<K extends keyof FormState>(k: K, val: FormState[K]) {
    setV((p) => {
      const next = { ...p, [k]: val };
      // Auto-fill text fields when picking from dropdown
      if (k === 'tarjeta_id' && val) {
        const t = (tarjetas.data ?? []).find((x) => x.id === val);
        if (t) {
          next.card_id = t.tc_id;
          if (t.empresa) next.empresa = t.empresa;
        }
      }
      if (k === 'proveedor_id' && val) {
        const pr = (proveedores.data ?? []).find((x) => x.id === val);
        if (pr) next.proveedor = pr.nombre;
      }
      return next;
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!v.card_id.trim() || !v.proveedor.trim() || !v.concepto.trim()) {
      setError('Tarjeta, proveedor y concepto son obligatorios.');
      return;
    }
    if (!v.monto || Number(v.monto) <= 0) {
      setError('Monto inválido.');
      return;
    }
    setError(null);
    await onSubmit(toInput(v));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {initial?.voucher_num && (
        <div className="rounded-md border border-sand bg-sand-l/60 px-3 py-2 text-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-dark-3">Voucher: </span>
          <span className="font-mono text-dark">{initial.voucher_num}</span>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <TextInput name="fecha" label="Fecha *" type="date" value={v.fecha} onChange={(e) => upd('fecha', e.target.value)} required />
        <TextInput name="monto" label="Monto *" type="number" min="0" step="0.01" value={v.monto} onChange={(e) => upd('monto', e.target.value)} required />
        <Select name="moneda" label="Moneda" value={v.moneda} onChange={(e) => upd('moneda', e.target.value as Currency)}>
          <option value="GTQ">GTQ</option>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
          <option value="GBP">GBP</option>
        </Select>
      </div>
      <Select name="tarjeta_id" label="Tarjeta" value={v.tarjeta_id} onChange={(e) => upd('tarjeta_id', e.target.value)}>
        <option value="">— elegir —</option>
        {(tarjetas.data ?? []).map((t) => (
          <option key={t.id} value={t.id}>{t.tipo} · {t.tc_id} {t.empresa ? `(${t.empresa})` : ''}</option>
        ))}
      </Select>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextInput name="card_id" label="Identificador tarjeta *" value={v.card_id} onChange={(e) => upd('card_id', e.target.value)} required hint="Auto desde dropdown o manual" />
        <TextInput name="empresa" label="Empresa" value={v.empresa} onChange={(e) => upd('empresa', e.target.value)} />
      </div>
      <Select name="proveedor_id" label="Proveedor" value={v.proveedor_id} onChange={(e) => upd('proveedor_id', e.target.value)}>
        <option value="">— elegir o escribir abajo —</option>
        {(proveedores.data ?? []).map((p) => (
          <option key={p.id} value={p.id}>{p.nombre}</option>
        ))}
      </Select>
      <TextInput name="proveedor" label="Proveedor *" value={v.proveedor} onChange={(e) => upd('proveedor', e.target.value)} required />
      <TextArea name="concepto" label="Concepto *" value={v.concepto} onChange={(e) => upd('concepto', e.target.value)} required />
      <Select name="autorizador_id" label="Autorizó (Personal JD)" value={v.autorizador_id} onChange={(e) => upd('autorizador_id', e.target.value)}>
        <option value="">— elegir autorizador —</option>
        {(autorizadores.data ?? []).map((a) => (
          <option key={a.id} value={a.id}>
            {a.iniciales ? `${a.iniciales} · ` : ''}{a.nombre}
          </option>
        ))}
      </Select>

      {/* Campos nuevos · Fase 17 · F-4 */}
      <fieldset className="rounded-md border border-sand p-3">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-dark-2">
          Datos adicionales del consumo
        </legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select name="solicitado_por_id" label="Solicitado por (empleado)" value={v.solicitado_por_id} onChange={(e) => {
            const id = e.target.value;
            setV((p) => {
              const next = { ...p, solicitado_por_id: id };
              if (id) {
                const emp = (empleados.data ?? []).find((x) => x.id === id);
                if (emp) next.solicitado_por = emp.nombre;
              }
              return next;
            });
          }}>
            <option value="">— elegir o escribir abajo —</option>
            {(empleados.data ?? []).map((e) => (
              <option key={e.id} value={e.id}>{e.nombre}</option>
            ))}
          </Select>
          <TextInput name="solicitado_por" label="Solicitado por (texto)" value={v.solicitado_por} onChange={(e) => upd('solicitado_por', e.target.value)} />
          <TextInput name="no_autorizacion" label="No. autorización" value={v.no_autorizacion} onChange={(e) => upd('no_autorizacion', e.target.value)} hint="número del banco" />
          <TextInput name="pagado_por" label="Pagado por" value={v.pagado_por} onChange={(e) => upd('pagado_por', e.target.value)} />
        </div>
      </fieldset>

      {initial?.id && (
        <ConsumoRenglonesPanel consumoId={initial.id} moneda={v.moneda} canEdit />
      )}

      {error && <p className="rounded-md border border-rust/30 bg-rust-l px-3 py-2 text-sm text-rust">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="rounded-md border border-sand px-4 py-2 text-sm font-semibold text-dark-2 hover:bg-sand-l">Cancelar</button>
        <button type="submit" disabled={submitting} className="rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-d disabled:opacity-60">
          {submitting ? 'Guardando…' : initial?.id ? 'Guardar cambios' : 'Crear consumo'}
        </button>
      </div>
    </form>
  );
}

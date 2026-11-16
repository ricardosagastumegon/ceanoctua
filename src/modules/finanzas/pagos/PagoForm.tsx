import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { TextInput } from '@/components/ui/TextInput';
import { TextArea } from '@/components/ui/TextArea';
import { Select } from '@/components/ui/Select';
import type { CatalogFormProps } from '@/modules/admin/components/CatalogPage';
import { PAGO_TIPO_LABELS, type Pago, type PagoInsert } from './api';
import type { Database } from '@/types/database';
import { useAutorizadores, useEntidades, useProveedores, useStatusSp } from '@/modules/admin/hooks';
import { useConsumos } from '../consumos/hooks';
import { sumaDeLaCadena, useCadenaSP, usePagos } from './hooks';

type Currency = Database['public']['Enums']['currency'];
type PagoEstado = Database['public']['Enums']['pago_estado'];
type PagoTipo = Database['public']['Enums']['pago_tipo'];

// estadoOptions removido en F-5 — el status ahora se elige del catálogo
// status_solicitud_pago. El enum PagoEstado se mantiene en DB como
// proyección legacy con mapeo automático en el form.

type FormState = {
  fecha: string;
  entidad: string;
  entidad_id: string;
  proveedor: string;
  proveedor_id: string;
  nit: string;
  concepto: string;
  monto: string;
  moneda: Currency;
  cotizacion: string;
  pct_anticipo: string;
  pct_pendiente: string;
  sp_anterior_id: string;
  tipo: PagoTipo;
  tipo_label: string;
  referencia: string;
  banco: string;
  autorizador_id: string;
  status: PagoEstado;
  status_id: string;
  consumo_id: string;
  notas: string;
};

const today = () => new Date().toISOString().slice(0, 10);
const empty: FormState = {
  fecha: today(),
  entidad: '',
  entidad_id: '',
  proveedor: '',
  proveedor_id: '',
  nit: '',
  concepto: '',
  monto: '',
  moneda: 'GTQ',
  cotizacion: '',
  pct_anticipo: '0',
  pct_pendiente: '100',
  sp_anterior_id: '',
  tipo: 'transferencia',
  tipo_label: 'Pago de Contado',
  referencia: '',
  banco: '',
  autorizador_id: '',
  status: 'Programado',
  status_id: '',
  consumo_id: '',
  notas: '',
};

function fromRow(r: Pago | null | undefined): FormState {
  if (!r) return empty;
  return {
    fecha: r.fecha ?? today(),
    entidad: r.entidad ?? '',
    entidad_id: r.entidad_id ?? '',
    proveedor: r.proveedor ?? '',
    proveedor_id: r.proveedor_id ?? '',
    nit: r.nit ?? '',
    concepto: r.concepto ?? '',
    monto: String(r.monto),
    moneda: r.moneda,
    sp_anterior_id: r.sp_anterior_id ?? '',
    cotizacion: r.cotizacion != null ? String(r.cotizacion) : '',
    pct_anticipo: r.pct_anticipo != null ? String(r.pct_anticipo) : '0',
    pct_pendiente: r.pct_pendiente != null ? String(r.pct_pendiente) : '100',
    tipo: r.tipo,
    tipo_label: r.tipo_label ?? 'Pago de Contado',
    referencia: r.referencia ?? '',
    banco: r.banco ?? '',
    autorizador_id: r.autorizador_id ?? '',
    status: r.status,
    status_id: r.status_id ?? '',
    consumo_id: r.consumo_id ?? '',
    notas: r.notas ?? '',
  };
}

function toInput(s: FormState): PagoInsert {
  const n = (v: string) => {
    const x = Number(v);
    return v.trim() === '' || !Number.isFinite(x) ? null : x;
  };
  const monto = Number(s.monto);
  return {
    fecha: s.fecha,
    entidad: s.entidad.trim() || null,
    entidad_id: s.entidad_id || null,
    proveedor: s.proveedor.trim() || null,
    proveedor_id: s.proveedor_id || null,
    nit: s.nit.trim() || null,
    concepto: s.concepto.trim() || null,
    monto: Number.isFinite(monto) ? monto : 0,
    moneda: s.moneda,
    sp_anterior_id: s.sp_anterior_id || null,
    cotizacion: n(s.cotizacion),
    pct_anticipo: n(s.pct_anticipo),
    pct_pendiente: n(s.pct_pendiente),
    tipo: s.tipo,
    tipo_label: s.tipo_label.trim() || null,
    referencia: s.referencia.trim() || null,
    banco: s.banco.trim() || null,
    autorizador_id: s.autorizador_id || null,
    status: s.status,
    status_id: s.status_id || null,
    consumo_id: s.consumo_id || null,
    notas: s.notas.trim() || null,
  };
}

export function PagoForm({ initial, submitting, onSubmit, onCancel }: CatalogFormProps<Pago, PagoInsert>) {
  const [v, setV] = useState<FormState>(fromRow(initial));
  const [error, setError] = useState<string | null>(null);
  const entidades = useEntidades();
  const proveedores = useProveedores();
  const autorizadores = useAutorizadores();
  const consumos = useConsumos();
  const statusSpList = useStatusSp();
  const todosLosPagos = usePagos();

  /**
   * A que otra solicitud puede continuar esta.
   *
   * Se filtra por proveedor: encadenar dos pagos a personas distintas no es
   * un proyecto en partes, es un error de dedo. La base ademas se niega a
   * cerrar un ciclo, asi que lo peor que puede pasar aqui es elegir mal y
   * volver a elegir.
   */
  const anteriores = useMemo(() => {
    const prov = v.proveedor_id;
    return (todosLosPagos.data ?? [])
      .filter((x) => x.id !== initial?.id)
      .filter((x) => (prov ? x.proveedor_id === prov : false))
      .sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? ''));
  }, [todosLosPagos.data, v.proveedor_id, initial?.id]);

  const cadena = useCadenaSP(initial?.id ?? null);
  // Lo ya solicitado: de la cadena guardada si no se toco el enlace, y del
  // pago elegido mientras se esta eligiendo --para que el numero se vea antes
  // de guardar y no despues.
  const previos = useMemo(() => {
    if (v.sp_anterior_id && v.sp_anterior_id !== (initial?.sp_anterior_id ?? '')) {
      const ant = anteriores.find((x) => x.id === v.sp_anterior_id);
      return Number(ant?.monto ?? 0);
    }
    return sumaDeLaCadena(cadena.data);
  }, [v.sp_anterior_id, initial?.sp_anterior_id, anteriores, cadena.data]);

  useEffect(() => {
    setV(fromRow(initial));
    setError(null);
  }, [initial]);

  function upd<K extends keyof FormState>(k: K, val: FormState[K]) {
    setV((p) => {
      const next = { ...p, [k]: val };
      if (k === 'entidad_id' && val) {
        const e = (entidades.data ?? []).find((x) => x.id === val);
        if (e) next.entidad = e.nombre;
      }
      if (k === 'proveedor_id' && val) {
        const pr = (proveedores.data ?? []).find((x) => x.id === val);
        if (pr) {
          next.proveedor = pr.nombre;
          if (pr.nit) next.nit = pr.nit;
        }
      }
      if (k === 'consumo_id' && val) {
        // Linking to a consumo → mark this as TC-Reintegro context (label only; tipo stays valid enum)
        const c = (consumos.data ?? []).find((x) => x.id === val);
        if (c) {
          next.monto = String(c.monto);
          next.moneda = c.moneda;
          next.referencia = c.voucher_num ?? next.referencia;
        }
      }
      // El porcentaje NO se teclea: es `monto / cotizacion`, que es lo que el
      // papel imprime desde hace fases. Tecleado estaba mal en 2 de 14 --una
      // SP decia 100% guardado mientras la hoja imprimia 50%-- porque era una
      // segunda copia de un numero que el sistema ya sabia.
      if (k === 'monto' || k === 'cotizacion') {
        const cot = Number(k === 'cotizacion' ? val : next.cotizacion);
        const mon = Number(k === 'monto' ? val : next.monto);
        if (Number.isFinite(cot) && cot > 0 && Number.isFinite(mon)) {
          const a = Math.round((mon / cot) * 10000) / 100;
          next.pct_anticipo = String(a);
          next.pct_pendiente = String(Math.max(0, Math.round((100 - a) * 100) / 100));
        }
      }
      // Encadenar propone la cotizacion de la anterior, no la impone: un monto
      // cotizado puede variar a mitad de proyecto, y entonces cada hoja lleva
      // la suya --el formato oficial declara el total en cada papel.
      if (k === 'sp_anterior_id' && val) {
        const ant = anteriores.find((x) => x.id === val);
        if (ant?.cotizacion != null && !next.cotizacion) {
          next.cotizacion = String(ant.cotizacion);
        }
      }
      return next;
    });
  }

  const cot = Number(v.cotizacion) || 0;
  const monto = Number(v.monto) || 0;
  const pctDe = (x: number) => (cot > 0 ? `${Math.round((x / cot) * 1000) / 10}%` : '—');
  // Pasarse de la cotizacion no se bloquea: puede ser que el monto este mal, o
  // que la cotizacion haya cambiado. Solo quien captura sabe cual de las dos.
  const sobrepasa = cot > 0 && previos + monto > cot + 0.005;
  // Y si la anterior cotizaba otra cosa, se dice. No es un error --un monto
  // cotizado puede variar-- pero verlo sin querer es peor que verlo a tiempo.
  const cotAnterior = v.sp_anterior_id
    ? (anteriores.find((x) => x.id === v.sp_anterior_id)?.cotizacion ?? null)
    : null;
  const cambioCotizacion =
    cotAnterior != null && cot > 0 && Math.abs(Number(cotAnterior) - cot) > 0.005
      ? Number(cotAnterior)
      : null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!v.monto || Number(v.monto) <= 0) {
      setError('Monto inválido.');
      return;
    }
    setError(null);
    await onSubmit(toInput(v));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <TextInput name="fecha" label="Fecha *" type="date" value={v.fecha} onChange={(e) => upd('fecha', e.target.value)} required />
        <Select
          name="status_id"
          label="Status (catálogo SP)"
          value={v.status_id}
          onChange={(e) => {
            const id = e.target.value;
            const opt = (statusSpList.data ?? []).find((x) => x.id === id);
            setV((p) => {
              const next = { ...p, status_id: id };
              // Sync enum legacy con un mapeo razonable.
              if (opt) {
                const name = opt.nombre.toLowerCase();
                if (name.includes('pagado')) next.status = 'Pagado';
                else if (name.includes('firmado')) next.status = 'Aprobado';
                else if (name.includes('procesad')) next.status = 'Aprobado';
                else if (name.includes('present')) next.status = 'Aprobado';
                else if (name.includes('generado')) next.status = 'Programado';
                else if (name.includes('firma')) next.status = 'Programado';
              }
              return next;
            });
          }}
        >
          <option value="">— elegir —</option>
          {(statusSpList.data ?? []).filter((s) => s.activo).map((s) => (
            <option key={s.id} value={s.id}>{s.orden}. {s.nombre}</option>
          ))}
        </Select>
        <Select name="tipo" label="Medio" value={v.tipo} onChange={(e) => upd('tipo', e.target.value as PagoTipo)}>
          <option value="transferencia">Transferencia</option>
          <option value="cheque">Cheque</option>
          <option value="efectivo">Efectivo</option>
          <option value="tarjeta">Tarjeta</option>
          <option value="otro">Otro</option>
        </Select>
      </div>

      <Select name="tipo_label" label="Tipo de pago" value={v.tipo_label} onChange={(e) => upd('tipo_label', e.target.value)}>
        {PAGO_TIPO_LABELS.map((t) => <option key={t} value={t}>{t}</option>)}
      </Select>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select name="entidad_id" label="Entidad" value={v.entidad_id} onChange={(e) => upd('entidad_id', e.target.value)}>
          <option value="">—</option>
          {(entidades.data ?? []).map((x) => (<option key={x.id} value={x.id}>{x.nombre}</option>))}
        </Select>
        <TextInput name="entidad" label="Entidad (texto)" value={v.entidad} onChange={(e) => upd('entidad', e.target.value)} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select name="proveedor_id" label="Proveedor" value={v.proveedor_id} onChange={(e) => upd('proveedor_id', e.target.value)}>
          <option value="">—</option>
          {(proveedores.data ?? []).map((x) => (<option key={x.id} value={x.id}>{x.nombre}</option>))}
        </Select>
        <TextInput name="proveedor" label="Proveedor (texto)" value={v.proveedor} onChange={(e) => upd('proveedor', e.target.value)} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextInput name="nit" label="NIT" value={v.nit} onChange={(e) => upd('nit', e.target.value)} />
        <TextArea name="concepto" label="Concepto" value={v.concepto} onChange={(e) => upd('concepto', e.target.value)} rows={2} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextInput name="monto" label="Monto *" type="number" min="0" step="0.01" value={v.monto} onChange={(e) => upd('monto', e.target.value)} required />
        <Select name="moneda" label="Moneda" value={v.moneda} onChange={(e) => upd('moneda', e.target.value as Currency)}>
          <option value="GTQ">GTQ</option>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
          <option value="GBP">GBP</option>
        </Select>
      </div>

      {/* El cuadro es del anticipo Y DE LA LIQUIDACION --asi lo dice el propio
          formato: «Llenar para tramites de anticipo y liquidacion»--. Antes
          solo salia si el tipo decia «Anticipo», y por eso el pago que CIERRA
          un proyecto habia que marcarlo como anticipo para poder llenarlo. */}
      {(v.tipo_label.includes('Anticipo') || v.sp_anterior_id || v.cotizacion) && (
        <fieldset className="rounded-md border border-gold/40 bg-gold-light/30 p-3">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-gold">
            Anticipo · {v.tipo_label}
          </legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <TextInput
              name="cotizacion"
              label="Cotización total"
              type="number"
              min="0"
              step="0.01"
              value={v.cotizacion}
              onChange={(e) => upd('cotizacion', e.target.value)}
              hint="Monto del proyecto completo"
            />
            <Select
              name="sp_anterior_id"
              label="Continúa a"
              value={v.sp_anterior_id}
              onChange={(e) => upd('sp_anterior_id', e.target.value)}
              hint={
                v.proveedor_id
                  ? 'La solicitud anterior de este proyecto'
                  : 'Elige primero el proveedor'
              }
            >
              <option value="">— ninguna, es la primera —</option>
              {anteriores.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.serial ?? '(sin serial)'} · {a.fecha} · {a.moneda}{' '}
                  {Number(a.monto).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </option>
              ))}
            </Select>
            <TextInput
              name="pct_anticipo"
              label="% de este trámite"
              type="text"
              value={cot > 0 ? `${pctDe(monto)} (${v.moneda} ${monto.toFixed(2)})` : '—'}
              onChange={() => undefined}
              readOnly
              hint="monto entre cotización (auto)"
            />
          </div>

          {/* El mismo cuadro que va al papel, antes de guardarlo. Se ve aqui
              para que el descuadre se note al capturarlo y no al imprimirlo. */}
          {cot > 0 && (
            <table className="mt-3 w-full border-separate border-spacing-0 text-xs">
              <tbody>
                <tr className="text-dark-3">
                  <td className="pb-1">Descripción</td>
                  <td className="pb-1 text-right">Monto</td>
                  <td className="w-16 pb-1 text-right">%</td>
                </tr>
                <tr>
                  <td className="border-t border-sand py-1">Anticipos previos</td>
                  <td className="border-t border-sand py-1 text-right tabular-nums">
                    {v.moneda} {previos.toFixed(2)}
                  </td>
                  <td className="border-t border-sand py-1 text-right">{pctDe(previos)}</td>
                </tr>
                <tr>
                  <td className="border-t border-sand py-1">Solicitado en este trámite</td>
                  <td className="border-t border-sand py-1 text-right tabular-nums">
                    {v.moneda} {monto.toFixed(2)}
                  </td>
                  <td className="border-t border-sand py-1 text-right">{pctDe(monto)}</td>
                </tr>
                <tr className="font-bold">
                  <td className="border-t border-dark-3 py-1">Total de pagos</td>
                  <td className="border-t border-dark-3 py-1 text-right tabular-nums">
                    {v.moneda} {(previos + monto).toFixed(2)}
                  </td>
                  <td className="border-t border-dark-3 py-1 text-right">
                    {pctDe(previos + monto)}
                  </td>
                </tr>
              </tbody>
            </table>
          )}

          {sobrepasa && (
            <p className="mt-2 rounded-md border border-rust/40 bg-rust-l px-3 py-2 text-xs text-rust">
              Con esta solicitud el proyecto suma <b>{v.moneda} {(previos + monto).toFixed(2)}</b>,
              más que la cotización de <b>{v.moneda} {cot.toFixed(2)}</b>. Si la cotización
              cambió, actualízala aquí; si no, revisa el monto.
            </p>
          )}

          {cambioCotizacion != null && (
            <p className="mt-2 rounded-md border border-gold/40 bg-gold-light px-3 py-2 text-xs text-dark-2">
              La solicitud anterior cotizaba <b>{v.moneda} {cambioCotizacion.toFixed(2)}</b>.
              Los porcentajes de esta hoja salen contra <b>{v.moneda} {cot.toFixed(2)}</b>, que es
              lo que ella declara.
            </p>
          )}
        </fieldset>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <TextInput name="referencia" label="Referencia" value={v.referencia} onChange={(e) => upd('referencia', e.target.value)} hint="N° cheque / transf" />
        <TextInput name="banco" label="Banco" value={v.banco} onChange={(e) => upd('banco', e.target.value)} />
        <Select name="autorizador_id" label="Autorizó (Personal JD)" value={v.autorizador_id} onChange={(e) => upd('autorizador_id', e.target.value)}>
          <option value="">— elegir —</option>
          {(autorizadores.data ?? []).map((a) => (
            <option key={a.id} value={a.id}>{a.iniciales ? `${a.iniciales} · ` : ''}{a.nombre}</option>
          ))}
        </Select>
      </div>

      <fieldset className="rounded-md border border-sand p-4">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-dark-2">Enlace opcional a consumo de TC</legend>
        <Select name="consumo_id" label="Consumo" value={v.consumo_id} onChange={(e) => upd('consumo_id', e.target.value)}>
          <option value="">— ninguno —</option>
          {(consumos.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>{c.voucher_num ?? '—'} · {c.proveedor} · {c.monto} {c.moneda}</option>
          ))}
        </Select>
        {v.consumo_id && <p className="mt-2 text-xs text-teal-d">Este pago se considera TC-Reintegro (referencia auto al voucher).</p>}
      </fieldset>

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

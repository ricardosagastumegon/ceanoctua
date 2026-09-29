import { formatDate } from '@/lib/dates';
import type { NotaEntrega } from './api';

/** El teal de CEA, en el mismo tono que usa el resto del módulo. */
const GRAD = 'linear-gradient(135deg, #0d2b2e 0%, #077e84 55%, #00b4c5 100%)';
const OSCURO = '#055a5f';
const CLARO = '#d0eced';

type Props = { nota: NotaEntrega };

function Dato({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <span
        className="inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider"
        style={{ backgroundColor: CLARO, color: OSCURO }}
      >
        {label}
      </span>
      <div className="mt-1 text-[13px] leading-snug text-dark">{value || '—'}</div>
    </div>
  );
}

/**
 * La nota de entrega, tal como se imprime y se firma.
 *
 * Dos cosas vienen del documento que mandó la usuaria y no son antojo:
 *
 *  - **«Recibido por» es el mismo nombre de «Para».** No es un campo aparte:
 *    quien recibe es a quien iba dirigida, y tenerlo dos veces sería invitar
 *    a que digan cosas distintas.
 *  - **«Solicitado por» es opcional**: «si se escribe aparece en PDF, si no
 *    NO». Por eso el renglón desaparece en vez de imprimirse con una raya.
 */
export function NotaEntregaPrintable({ nota }: Props) {
  return (
    <article className="text-dark">
      <header className="px-8 py-6 text-white" style={{ background: GRAD }}>
        <p className="text-[10px] font-extrabold uppercase tracking-[.22em] text-white/70">
          Nota de entrega de documentos
        </p>
        <h1 className="mt-2 font-heading text-3xl font-extrabold leading-tight">
          {nota.para}
        </h1>
        {nota.departamento && (
          <p className="mt-1 text-[13px] font-semibold text-white/80">{nota.departamento}</p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {nota.serial && (
            <span className="rounded-full bg-white/20 px-3 py-1 font-mono text-xs font-extrabold">
              {nota.serial}
            </span>
          )}
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
            {formatDate(nota.fecha)}
          </span>
        </div>
      </header>

      <section className="grid grid-cols-3 gap-x-6 gap-y-4 px-8 py-5">
        <Dato label="Fecha" value={formatDate(nota.fecha)} />
        <Dato label="Para" value={nota.para} />
        <Dato label="Departamento" value={nota.departamento} />
      </section>

      <section className="px-8 pb-5">
        <div className="overflow-hidden rounded-lg border" style={{ borderColor: OSCURO }}>
          <div
            className="px-4 py-2 text-[11px] font-extrabold uppercase tracking-wider text-white"
            style={{ backgroundColor: OSCURO }}
          >
            Descripción de documentos
          </div>
          {/* Alto mínimo para que la hoja se vea igual aunque el detalle sea
              corto: es un documento que se firma, no una pantalla. */}
          <div className="min-h-[7rem] whitespace-pre-line px-4 py-3 text-[13px] leading-relaxed">
            {nota.descripcion || ''}
          </div>
        </div>
      </section>

      {nota.notas && (
        <section className="px-8 pb-5">
          <p className="mb-1 text-[11px] font-extrabold uppercase tracking-wider" style={{ color: OSCURO }}>
            Notas
          </p>
          <p className="whitespace-pre-line text-[13px] leading-relaxed">{nota.notas}</p>
        </section>
      )}

      <section className="grid grid-cols-3 gap-x-6 gap-y-4 border-t border-sand px-8 py-5">
        <Dato label="Entregado por" value={nota.entregado_por} />
        <Dato label="Departamento" value={nota.entregado_departamento} />
        <Dato label="Fecha de entrega" value={nota.fecha_entrega ? formatDate(nota.fecha_entrega) : null} />
        {/* Opcional a propósito: sin valor, el renglón no existe. */}
        {nota.solicitado_por && <Dato label="Solicitado por" value={nota.solicitado_por} />}
      </section>

      {/* Las firmas. Quien recibe es el mismo «Para» del encabezado. */}
      <section className="grid grid-cols-2 gap-10 px-8 pb-8 pt-10">
        {[
          { rotulo: 'Entregado por', nombre: nota.entregado_por },
          { rotulo: 'Recibido por', nombre: nota.para },
        ].map((f) => (
          <div key={f.rotulo}>
            <div className="border-t border-dark-3" />
            <div className="mt-1 text-[11px] font-extrabold uppercase tracking-wider" style={{ color: OSCURO }}>
              {f.rotulo}
            </div>
            <div className="text-[13px] text-dark">{f.nombre || ''}</div>
          </div>
        ))}
      </section>

      <div
        className="px-8 py-2 text-center text-[10px] font-extrabold uppercase tracking-widest text-white/40"
        style={{ backgroundColor: OSCURO }}
      >
        CEA · Nota de entrega de documentos · {nota.serial ?? ''}
      </div>
    </article>
  );
}

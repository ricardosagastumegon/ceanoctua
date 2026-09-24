import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth, puede } from '@/lib/auth';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { describeError } from '@/modules/admin/hooks';
import { useAeronave, useBorrarDocumento, useDocumentos } from './hooks';
import { AeronaveFormModal } from './AeronaveFormModal';
import { DocumentoFormModal } from './DocumentoFormModal';
import { FotoAeronave } from './FotoAeronave';
import { acento, ESTADO_COLOR } from './constants';
import { urlArchivo, type Aeronave, type Documento } from './api';

/**
 * Una aeronave · capa 3 del módulo.
 *
 * Todo lo que se ve aquí pertenece solo a esta aeronave. Por ahora lleva la
 * ficha y los certificados; las horas de vuelo, los mantenimientos y los
 * pagos entran en las fases siguientes.
 */
export function AeronavePage() {
  const { matricula = '' } = useParams();
  const { profile } = useAuth();
  const canEdit = puede(profile, 'aeronaves', 'editor');
  const q = useAeronave(matricula);
  const [editando, setEditando] = useState(false);

  if (q.isLoading) return <p className="text-sm text-dark-3">Cargando…</p>;

  if (q.isError) {
    return (
      <div className="rounded-md border border-rust bg-rust-l px-3 py-2 text-sm text-rust">
        {describeError(q.error)}
      </div>
    );
  }

  const a = q.data;
  if (!a) {
    return (
      <div className="rounded-card border border-sand bg-white px-6 py-10 text-center">
        <p className="text-sm text-dark-2">No existe una aeronave con matrícula {matricula}.</p>
        <Link
          to="/aeronaves"
          className="mt-4 inline-block rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white"
        >
          Volver a la flota
        </Link>
      </div>
    );
  }

  const col = acento(a.acento);

  return (
    <section className="space-y-5">
      <Link
        to="/aeronaves"
        className="inline-flex items-center gap-1 text-xs font-semibold text-dark-3 hover:text-teal"
      >
        ← Flota
      </Link>

      {/* Encabezado */}
      <header
        className="relative overflow-hidden rounded-card px-7 py-6 text-white"
        style={{ background: col.grad }}
      >
        <FotoAeronave
          path={a.foto_path}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-25"
        />
        <div
          aria-hidden
          style={{
            position: 'absolute', right: '-60px', top: '-80px', width: '220px', height: '220px',
            borderRadius: '50%', background: 'rgba(255,255,255,.08)',
          }}
        />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="font-heading text-4xl font-extrabold leading-none tracking-tight">
              {a.matricula}
            </div>
            <div className="mt-2 text-sm font-semibold text-white/85">{a.nombre ?? '—'}</div>
            <div className="mt-0.5 text-[12px] text-white/65">{a.base_operaciones ?? ''}</div>
            <span
              className={`mt-3 inline-block rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider ${
                ESTADO_COLOR[a.estado] ?? 'bg-white/20 text-white'
              }`}
            >
              {a.estado}
            </span>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={() => setEditando(true)}
              className="rounded-md border border-white/30 bg-white/10 px-3 py-1.5 text-xs font-extrabold text-white hover:bg-white/20"
            >
              ✏️ Editar ficha
            </button>
          )}
        </div>
      </header>

      <Ficha aeronave={a} />

      <Certificados aeronave={a} canEdit={canEdit} />

      <AeronaveFormModal
        open={editando}
        editando={a}
        onClose={() => setEditando(false)}
      />
    </section>
  );
}

function Ficha({ aeronave: a }: { aeronave: Aeronave }) {
  const datos: { rotulo: string; valor: string | null }[] = [
    { rotulo: 'Nombre', valor: a.nombre },
    { rotulo: 'Serie', valor: a.serie },
    { rotulo: 'Modelo', valor: a.modelo },
    { rotulo: 'Tipo de aeronave', valor: a.tipo_aeronave },
    { rotulo: 'Tipo de pista', valor: a.tipo_pista },
    { rotulo: 'Uso', valor: a.uso },
    { rotulo: 'No. de Pax', valor: a.pax != null ? String(a.pax) : null },
    { rotulo: 'Tripulantes', valor: a.tripulantes != null ? String(a.tripulantes) : null },
    { rotulo: 'Autonomía', valor: a.autonomia },
    { rotulo: 'Color', valor: a.color },
    { rotulo: 'Base de operaciones', valor: a.base_operaciones },
  ];

  return (
    <div className="rounded-card border border-sand bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-[11px] font-extrabold uppercase tracking-wider text-teal-d">
        Ficha de la aeronave
      </h2>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
        {datos.map((d) => (
          <div key={d.rotulo}>
            <dt className="text-[9px] font-extrabold uppercase tracking-[.14em] text-dark-3">
              {d.rotulo}
            </dt>
            <dd className="mt-0.5 text-[13px] font-semibold text-dark">{d.valor || '—'}</dd>
          </div>
        ))}
      </dl>
      {a.notas && (
        <p className="mt-4 whitespace-pre-wrap border-t border-sand pt-3 text-[12px] text-dark-2">
          {a.notas}
        </p>
      )}
    </div>
  );
}

/**
 * Los certificados, agrupados por año.
 *
 * Así es como el usuario los tiene organizados en su propio documento: un
 * bloque por año con lo que se sacó ese año. Se respeta ese orden mental en
 * vez de imponer una tabla plana.
 */
function Certificados({ aeronave, canEdit }: { aeronave: Aeronave; canEdit: boolean }) {
  const col = acento(aeronave.acento);
  const q = useDocumentos(aeronave.id);
  const borrar = useBorrarDocumento(aeronave.id);
  const toast = useToast();
  const confirmar = useConfirm();
  const [abierto, setAbierto] = useState(false);
  const [editando, setEditando] = useState<Documento | null>(null);
  const [anioSugerido, setAnioSugerido] = useState<number | undefined>();

  const porAnio = useMemo(() => {
    const mapa = new Map<number, Documento[]>();
    for (const d of q.data ?? []) {
      const lista = mapa.get(d.anio) ?? [];
      lista.push(d);
      mapa.set(d.anio, lista);
    }
    return [...mapa.entries()].sort((a, b) => b[0] - a[0]);
  }, [q.data]);

  async function abrir(d: Documento) {
    if (!d.archivo_path) {
      toast.error('Este certificado no tiene archivo cargado.');
      return;
    }
    try {
      window.open(await urlArchivo(d.archivo_path), '_blank', 'noopener');
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  async function quitar(d: Documento) {
    const ok = await confirmar({
      title: 'Quitar certificado',
      message: `¿Quitar «${d.tipo_nombre}» de ${d.anio}?`,
      confirmLabel: 'Quitar',
      danger: true,
    });
    if (!ok) return;
    try {
      await borrar.mutateAsync(d.id);
      toast.success('Certificado quitado.');
    } catch (err) {
      toast.error(describeError(err));
    }
  }

  return (
    <div className="rounded-card border border-sand bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-teal-d">
            Documentación DGAC
          </h2>
          <p className="mt-0.5 text-[11px] text-dark-3">
            Los certificados escaneados, por año. Un clic los abre.
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => {
              setEditando(null);
              setAnioSugerido(undefined);
              setAbierto(true);
            }}
            className="rounded-md bg-teal px-3 py-2 text-xs font-extrabold text-white hover:bg-teal-d"
          >
            ＋ Agregar documento
          </button>
        )}
      </div>

      {q.isLoading && <p className="text-sm text-dark-3">Cargando certificados…</p>}

      {q.isError && (
        <div className="rounded-md border border-rust bg-rust-l px-3 py-2 text-sm text-rust">
          {describeError(q.error)}
        </div>
      )}

      {q.data && q.data.length === 0 && (
        <p className="py-4 text-sm italic text-dark-3">
          Todavía no hay certificados cargados.
        </p>
      )}

      {/* Un cuadro por año con su lista debajo, como en el documento del
          usuario. Sin tarjetas ni bordes por renglón: la lista se lee de
          corrido y el nombre del certificado es el que se toca para abrirlo. */}
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {porAnio.map(([anio, docs]) => (
          <div key={anio}>
            <div
              className="rounded-xl py-2 text-center font-heading text-lg font-extrabold text-white"
              style={{ backgroundColor: col.solid }}
            >
              {anio}
            </div>

            <ul className="mt-3 space-y-1.5">
              {docs.map((d) => (
                <li key={d.id} className="group flex items-start justify-center gap-1">
                  <button
                    type="button"
                    onClick={() => void abrir(d)}
                    title={d.archivo_nombre ?? 'Abrir'}
                    className="text-center text-[12px] font-semibold leading-snug text-dark hover:text-teal-d hover:underline"
                  >
                    {d.tipo_nombre}
                    {d.numero && (
                      <span className="ml-1 font-normal text-dark-3">{d.numero}</span>
                    )}
                    {!d.archivo_path && (
                      <span className="ml-1 text-[9px] font-extrabold uppercase text-gold">
                        sin archivo
                      </span>
                    )}
                  </button>

                  {canEdit && (
                    <span className="mt-0.5 flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => {
                          setEditando(d);
                          setAbierto(true);
                        }}
                        className="text-[10px] leading-none"
                        title="Editar"
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        onClick={() => void quitar(d)}
                        className="text-[10px] leading-none"
                        title="Quitar"
                      >
                        🗑
                      </button>
                    </span>
                  )}
                </li>
              ))}
            </ul>

            {canEdit && (
              <button
                type="button"
                onClick={() => {
                  setEditando(null);
                  setAnioSugerido(anio);
                  setAbierto(true);
                }}
                className="mt-2 w-full text-center text-[11px] font-semibold text-dark-3 hover:text-teal-d"
              >
                ＋ agregar a {anio}
              </button>
            )}
          </div>
        ))}
      </div>

      <DocumentoFormModal
        open={abierto}
        aeronave={aeronave}
        editando={editando}
        anioSugerido={anioSugerido}
        onClose={() => setAbierto(false)}
      />
    </div>
  );
}

import { useMemo, useRef, useState } from 'react';
import { TextInput } from '@/components/ui/TextInput';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { formatDate, daysUntil } from '@/lib/dates';
import { abrirAdjunto } from '@/lib/adjuntos';
import { describeError, useInvitados, usePersonas } from '@/modules/admin/hooks';
import {
  useAfiliaciones,
  useBorrarAfiliacion,
  useBorrarLicencia,
  useBorrarPasaporte,
  useBorrarVisa,
  useGuardarAfiliacion,
  useGuardarLicencia,
  useGuardarPasaporte,
  useGuardarVisa,
  useLicencias,
  usePasaportes,
  useSubirImagen,
  useVisas,
} from './hooks';
import type { Afiliacion, Duenio, Licencia, Pasaporte, Visa } from './api';

/**
 * Los documentos de viaje de quien viaja.
 *
 * Hoy el pasaporte y la visa de cada quien viven en un Excel y se retecleaan
 * en cada boleto, y por eso la misma persona quedó capturada con grafías
 * distintas y hasta con dos números de pasaporte.
 *
 * La lista de gente NO es propia: son las mismas personas de Personal JD e
 * Invitados, que es de donde salen los participantes de un viaje. Una tercera
 * lista sería volver al problema que se acaba de quitar.
 */

const BUCKET = 'tt-documentos';

/** Un mes de aviso, como en los certificados de la aeronave. */
const DIAS_AVISO = 30;

type Estado = { texto: string; clase: string } | null;

function estadoVencimiento(fecha: string | null): Estado {
  if (!fecha) return null;
  const faltan = daysUntil(fecha);
  if (faltan < 0) return { texto: 'Vencido', clase: 'bg-rust text-white' };
  if (faltan <= DIAS_AVISO) {
    return { texto: `Vence en ${faltan} d`, clase: 'bg-gold-light text-gold' };
  }
  return null;
}

type Fila = { duenio: Duenio; nombre: string; grupo: 'Personal JD' | 'Invitados' };

export function ViajerosCatalog({ canEdit }: { canEdit: boolean }) {
  const personasQ = usePersonas();
  const invitadosQ = useInvitados();
  const pasaportesQ = usePasaportes();
  const visasQ = useVisas();
  const afiliacionesQ = useAfiliaciones();
  const licenciasQ = useLicencias();

  const [elegido, setElegido] = useState<string | null>(null);

  const gente = useMemo<Fila[]>(() => {
    const p: Fila[] = (personasQ.data ?? []).map((x) => ({
      duenio: { tipo: 'persona', id: x.id },
      nombre: x.nombre,
      grupo: 'Personal JD',
    }));
    const i: Fila[] = (invitadosQ.data ?? [])
      .filter((x) => x.activo !== false)
      .map((x) => ({ duenio: { tipo: 'invitado', id: x.id }, nombre: x.nombre, grupo: 'Invitados' }));
    return [...p, ...i];
  }, [personasQ.data, invitadosQ.data]);

  const clave = (d: Duenio) => `${d.tipo}:${d.id}`;

  const porDuenio = useMemo(() => {
    const m = new Map<
      string,
      {
        pasaportes: Pasaporte[];
        visas: Visa[];
        licencias: Licencia[];
        afiliaciones: Afiliacion[];
      }
    >();
    const pon = (k: string) => {
      if (!m.has(k)) m.set(k, { pasaportes: [], visas: [], licencias: [], afiliaciones: [] });
      return m.get(k)!;
    };
    const llave = (x: { persona_id: string | null; invitado_id: string | null }) =>
      x.persona_id ? `persona:${x.persona_id}` : `invitado:${x.invitado_id}`;
    for (const d of pasaportesQ.data ?? []) pon(llave(d)).pasaportes.push(d);
    for (const v of visasQ.data ?? []) pon(llave(v)).visas.push(v);
    for (const l of licenciasQ.data ?? []) pon(llave(l)).licencias.push(l);
    for (const a of afiliacionesQ.data ?? []) pon(llave(a)).afiliaciones.push(a);
    return m;
  }, [pasaportesQ.data, visasQ.data, licenciasQ.data, afiliacionesQ.data]);

  // Los programas ya escritos, para sugerirlos al capturar el siguiente y que
  // no nazcan cuatro grafias de «American Airlines».
  const programas = useMemo(
    () => [...new Set((afiliacionesQ.data ?? []).map((a) => a.programa))].sort(),
    [afiliacionesQ.data],
  );

  const actual = gente.find((g) => clave(g.duenio) === elegido) ?? null;
  const docs = elegido ? porDuenio.get(elegido) : undefined;

  const grupos: Fila['grupo'][] = ['Personal JD', 'Invitados'];

  return (
    <section className="space-y-4">
      <div className="rounded-card border border-sand bg-white p-4 shadow-sm">
        <h2 className="font-heading text-base font-extrabold text-dark">
          Documentos de viaje
        </h2>
        <p className="mt-1 text-xs text-dark-2">
          El pasaporte y la visa de quien viaja, capturados una sola vez. La lista es la misma de{' '}
          <b>Personal JD</b> e <b>Invitados</b>, que es de donde salen los participantes de un
          viaje. Una persona puede tener <b>más de un pasaporte</b>: uno por nacionalidad.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-card border border-sand bg-white p-2 shadow-sm">
          {grupos.map((g) => {
            const filas = gente.filter((x) => x.grupo === g);
            if (filas.length === 0) return null;
            return (
              <div key={g} className="mb-2">
                <div className="px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-dark-3">
                  {g}
                </div>
                <ul className="space-y-1">
                  {filas.map((f) => {
                    const k = clave(f.duenio);
                    const d = porDuenio.get(k);
                    const n =
                      (d?.pasaportes.length ?? 0) +
                      (d?.visas.length ?? 0) +
                      (d?.licencias.length ?? 0) +
                      (d?.afiliaciones.length ?? 0);
                    const alerta = [
                      ...(d?.pasaportes ?? []),
                      ...(d?.visas ?? []),
                      ...(d?.licencias ?? []),
                    ].some(
                      (x) => estadoVencimiento(x.vencimiento) !== null,
                    );
                    return (
                      <li key={k}>
                        <button
                          type="button"
                          onClick={() => setElegido(k)}
                          className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm ${
                            elegido === k ? 'bg-teal-l font-extrabold text-teal-d' : 'hover:bg-sand-l'
                          }`}
                        >
                          <span className="truncate">{f.nombre}</span>
                          <span className="flex shrink-0 items-center gap-1">
                            {alerta && <span className="text-rust" title="Algo por vencer">●</span>}
                            <span className="text-[10px] font-semibold text-dark-3">{n}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </aside>

        <div className="rounded-card border border-sand bg-white p-4 shadow-sm">
          {!actual ? (
            <p className="text-sm italic text-dark-3">
              Escoge a alguien de la lista para ver y capturar sus documentos.
            </p>
          ) : (
            <PanelPersona
              nombre={actual.nombre}
              duenio={actual.duenio}
              pasaportes={docs?.pasaportes ?? []}
              visas={docs?.visas ?? []}
              licencias={docs?.licencias ?? []}
              afiliaciones={docs?.afiliaciones ?? []}
              programas={programas}
              canEdit={canEdit}
            />
          )}
        </div>
      </div>
    </section>
  );
}

function PanelPersona({
  nombre,
  duenio,
  pasaportes,
  visas,
  licencias,
  afiliaciones,
  programas,
  canEdit,
}: {
  nombre: string;
  duenio: Duenio;
  pasaportes: Pasaporte[];
  visas: Visa[];
  licencias: Licencia[];
  afiliaciones: Afiliacion[];
  programas: string[];
  canEdit: boolean;
}) {
  const [nuevoPasaporte, setNuevoPasaporte] = useState(false);
  const [nuevaVisa, setNuevaVisa] = useState(false);
  const [nuevaAfiliacion, setNuevaAfiliacion] = useState(false);
  const [nuevaLicencia, setNuevaLicencia] = useState(false);

  return (
    <div className="space-y-5">
      <div className="font-heading text-lg font-extrabold text-dark">{nombre}</div>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-dark-3">
            Pasaportes · {pasaportes.length}
          </h3>
          {canEdit && (
            <button
              type="button"
              onClick={() => setNuevoPasaporte((v) => !v)}
              className="rounded-md border border-teal/40 px-3 py-1.5 text-xs font-semibold text-teal-d hover:bg-teal-l"
            >
              {nuevoPasaporte ? 'Cancelar' : '＋ Agregar pasaporte'}
            </button>
          )}
        </div>
        {nuevoPasaporte && (
          <FormPasaporte
            duenio={duenio}
            nombreSugerido={nombre}
            onListo={() => setNuevoPasaporte(false)}
          />
        )}
        {pasaportes.length === 0 && !nuevoPasaporte ? (
          <p className="text-xs italic text-dark-3">
            Sin pasaportes. Agrega uno por cada nacionalidad.
          </p>
        ) : (
          <ul className="space-y-2">
            {pasaportes.map((p) => (
              <FichaPasaporte key={p.id} doc={p} canEdit={canEdit} />
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-sand pt-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-dark-3">
            Visas · {visas.length}
          </h3>
          {canEdit && (
            <button
              type="button"
              onClick={() => setNuevaVisa((v) => !v)}
              className="rounded-md border border-purple/40 px-3 py-1.5 text-xs font-semibold text-purple hover:bg-purple/10"
            >
              {nuevaVisa ? 'Cancelar' : '＋ Agregar visa'}
            </button>
          )}
        </div>
        {nuevaVisa && <FormVisa duenio={duenio} onListo={() => setNuevaVisa(false)} />}
        {visas.length === 0 && !nuevaVisa ? (
          <p className="text-xs italic text-dark-3">Sin visas registradas.</p>
        ) : (
          <ul className="space-y-2">
            {visas.map((v) => (
              <FichaVisa key={v.id} doc={v} canEdit={canEdit} />
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-sand pt-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-dark-3">
            Licencias de conducir · {licencias.length}
          </h3>
          {canEdit && (
            <button
              type="button"
              onClick={() => setNuevaLicencia((v) => !v)}
              className="rounded-md border border-rust/40 px-3 py-1.5 text-xs font-semibold text-rust hover:bg-rust-l"
            >
              {nuevaLicencia ? 'Cancelar' : '＋ Agregar licencia'}
            </button>
          )}
        </div>
        {nuevaLicencia && (
          <FormLicencia
            duenio={duenio}
            nombreSugerido={nombre}
            onListo={() => setNuevaLicencia(false)}
          />
        )}
        {licencias.length === 0 && !nuevaLicencia ? (
          <p className="text-xs italic text-dark-3">
            Sin licencias. Las pide la agencia al rentar un carro.
          </p>
        ) : (
          <ul className="space-y-2">
            {licencias.map((l) => (
              <FichaLicencia key={l.id} doc={l} canEdit={canEdit} />
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-sand pt-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-dark-3">
            Afiliaciones · {afiliaciones.length}
          </h3>
          {canEdit && (
            <button
              type="button"
              onClick={() => setNuevaAfiliacion((v) => !v)}
              className="rounded-md border border-gold/50 px-3 py-1.5 text-xs font-semibold text-gold hover:bg-gold-light"
            >
              {nuevaAfiliacion ? 'Cancelar' : '＋ Agregar afiliación'}
            </button>
          )}
        </div>
        {nuevaAfiliacion && (
          <FormAfiliacion
            duenio={duenio}
            programas={programas}
            onListo={() => setNuevaAfiliacion(false)}
          />
        )}
        {afiliaciones.length === 0 && !nuevaAfiliacion ? (
          <p className="text-xs italic text-dark-3">
            Sin afiliaciones. Aquí van los números de viajero frecuente y demás programas.
          </p>
        ) : (
          <ul className="space-y-2">
            {afiliaciones.map((a) => (
              <FichaAfiliacion key={a.id} doc={a} canEdit={canEdit} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function FichaAfiliacion({ doc, canEdit }: { doc: Afiliacion; canEdit: boolean }) {
  const borrar = useBorrarAfiliacion();
  const toast = useToast();
  const confirmar = useConfirm();

  async function quitar() {
    const ok = await confirmar({
      title: 'Quitar la afiliación',
      message: (
        <>
          ¿Quitar <strong>{doc.programa}</strong> · {doc.numero}?
        </>
      ),
      danger: true,
      confirmLabel: 'Quitar',
    });
    if (!ok) return;
    try {
      await borrar.mutateAsync(doc.id);
      toast.success('Afiliación retirada.');
    } catch (e) {
      toast.error(describeError(e));
    }
  }

  return (
    <li className="flex flex-wrap items-center gap-2 rounded-md border border-sand px-3 py-2">
      <span className="rounded-full bg-gold-light px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-gold">
        {doc.programa}
      </span>
      <span className="font-mono text-sm font-extrabold text-dark">{doc.numero}</span>
      {doc.categoria && <span className="text-xs text-dark-2">{doc.categoria}</span>}
      {doc.email_cuenta && (
        <span className="text-[11px] text-dark-3">{doc.email_cuenta}</span>
      )}
      {canEdit && (
        <button
          type="button"
          onClick={() => void quitar()}
          className="ml-auto rounded-md border border-rust/40 px-2 py-1 text-[11px] font-semibold text-rust hover:bg-rust-l"
        >
          Quitar
        </button>
      )}
    </li>
  );
}

function FormAfiliacion({
  duenio,
  programas,
  onListo,
}: {
  duenio: Duenio;
  programas: string[];
  onListo: () => void;
}) {
  const guardar = useGuardarAfiliacion();
  const toast = useToast();
  const [v, setV] = useState({ programa: '', numero: '', categoria: '', email_cuenta: '' });
  const upd = (k: keyof typeof v, x: string) => setV((p) => ({ ...p, [k]: x }));

  async function enviar() {
    if (!v.programa.trim() || !v.numero.trim()) {
      toast.error('El programa y el número son obligatorios.');
      return;
    }
    try {
      await guardar.mutateAsync({
        duenio,
        valores: {
          programa: v.programa.trim(),
          numero: v.numero.trim(),
          categoria: v.categoria.trim() || null,
          email_cuenta: v.email_cuenta.trim() || null,
        },
      });
      toast.success('Afiliación agregada.');
      onListo();
    } catch (e) {
      toast.error(describeError(e));
    }
  }

  return (
    <div className="mb-3 rounded-md border border-gold/40 bg-gold-light/40 p-3">
      <datalist id="programas-viajero">
        {programas.map((x) => (
          <option key={x} value={x} />
        ))}
      </datalist>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextInput
          name="programa"
          label="Programa *"
          list="programas-viajero"
          value={v.programa}
          onChange={(e) => upd('programa', e.target.value)}
          placeholder="American Airlines"
          hint="Si ya lo escribiste antes, sale sugerido"
          autoFocus
        />
        <TextInput
          name="numero_afiliacion"
          label="Número *"
          value={v.numero}
          onChange={(e) => upd('numero', e.target.value)}
          placeholder="08HSDK6"
        />
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextInput
          name="categoria"
          label="Categoría"
          value={v.categoria}
          onChange={(e) => upd('categoria', e.target.value)}
          placeholder="Gold, Platinum…"
        />
        <TextInput
          name="email_cuenta"
          label="Correo de la cuenta"
          type="email"
          value={v.email_cuenta}
          onChange={(e) => upd('email_cuenta', e.target.value)}
        />
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={onListo}
          className="rounded-md border border-sand bg-white px-3 py-1.5 text-xs font-semibold text-dark-2"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => void enviar()}
          disabled={guardar.isPending}
          className="rounded-md bg-gold px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          {guardar.isPending ? 'Guardando…' : 'Guardar afiliación'}
        </button>
      </div>
      <p className="mt-2 text-[11px] text-dark-3">
        La contraseña de la cuenta <b>no</b> se guarda aquí, a propósito.
      </p>
    </div>
  );
}

function Dato({ rotulo, valor }: { rotulo: string; valor: string | null | undefined }) {
  return (
    <div>
      <div className="text-[9px] font-extrabold uppercase tracking-wider text-dark-3">{rotulo}</div>
      <div className="text-sm text-dark">{valor || '—'}</div>
    </div>
  );
}

function FichaPasaporte({ doc, canEdit }: { doc: Pasaporte; canEdit: boolean }) {
  const estado = estadoVencimiento(doc.vencimiento);
  const borrar = useBorrarPasaporte();
  const toast = useToast();
  const confirmar = useConfirm();

  async function quitar() {
    const ok = await confirmar({
      title: 'Quitar el pasaporte',
      message: (
        <>
          ¿Quitar el pasaporte <strong>{doc.numero}</strong> de {doc.pais_emisor}? Se deja de
          mostrar, pero no se borra: los viajes viejos se emitieron con él.
        </>
      ),
      danger: true,
      confirmLabel: 'Quitar',
    });
    if (!ok) return;
    try {
      await borrar.mutateAsync(doc.id);
      toast.success('Pasaporte retirado.');
    } catch (e) {
      toast.error(describeError(e));
    }
  }

  return (
    <li className="rounded-md border border-sand p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-teal-l px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-teal-d">
          {doc.pais_emisor}
        </span>
        <span className="font-mono text-sm font-extrabold text-dark">{doc.numero}</span>
        {estado && (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${estado.clase}`}>
            {estado.texto}
          </span>
        )}
        <span className="ml-auto flex gap-1">
          <ImagenDoc carpeta="pasaportes" id={doc.id} path={doc.imagen_path} canEdit={canEdit} />
          {canEdit && (
            <button
              type="button"
              onClick={() => void quitar()}
              className="rounded-md border border-rust/40 px-2 py-1 text-[11px] font-semibold text-rust hover:bg-rust-l"
            >
              Quitar
            </button>
          )}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Dato rotulo="Nombre en el pasaporte" valor={doc.nombre} />
        <Dato rotulo="Libreta" valor={doc.libreta_num} />
        <Dato rotulo="Emisión" valor={doc.emision ? formatDate(doc.emision) : null} />
        <Dato rotulo="Vencimiento" valor={doc.vencimiento ? formatDate(doc.vencimiento) : null} />
      </div>
    </li>
  );
}

function FichaVisa({ doc, canEdit }: { doc: Visa; canEdit: boolean }) {
  const estado = estadoVencimiento(doc.vencimiento);
  const borrar = useBorrarVisa();
  const toast = useToast();
  const confirmar = useConfirm();

  async function quitar() {
    const ok = await confirmar({
      title: 'Quitar la visa',
      message: <>¿Quitar la visa de <strong>{doc.pais_emisor}</strong>?</>,
      danger: true,
      confirmLabel: 'Quitar',
    });
    if (!ok) return;
    try {
      await borrar.mutateAsync(doc.id);
      toast.success('Visa retirada.');
    } catch (e) {
      toast.error(describeError(e));
    }
  }

  return (
    <li className="rounded-md border border-sand p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-purple/10 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-purple">
          {doc.pais_emisor}
        </span>
        <span className="font-mono text-sm font-extrabold text-dark">{doc.numero_visa || '—'}</span>
        {estado && (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${estado.clase}`}>
            {estado.texto}
          </span>
        )}
        <span className="ml-auto flex gap-1">
          <ImagenDoc carpeta="visas" id={doc.id} path={doc.imagen_path} canEdit={canEdit} />
          {canEdit && (
            <button
              type="button"
              onClick={() => void quitar()}
              className="rounded-md border border-rust/40 px-2 py-1 text-[11px] font-semibold text-rust hover:bg-rust-l"
            >
              Quitar
            </button>
          )}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Dato rotulo="Número de control" valor={doc.numero_control} />
        <Dato rotulo="Emisión" valor={doc.emision ? formatDate(doc.emision) : null} />
        <Dato rotulo="Vencimiento" valor={doc.vencimiento ? formatDate(doc.vencimiento) : null} />
      </div>
    </li>
  );
}

/** Subir y ver el escaneo del documento. */
function ImagenDoc({
  carpeta,
  id,
  path,
  canEdit,
}: {
  carpeta: 'pasaportes' | 'visas' | 'licencias';
  id: string;
  path: string | null;
  canEdit: boolean;
}) {
  const subir = useSubirImagen();
  const toast = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const [abriendo, setAbriendo] = useState(false);

  async function elegir(file: File | null) {
    if (!file) return;
    try {
      await subir.mutateAsync({ carpeta, id, file });
      toast.success('Imagen cargada.');
    } catch (e) {
      toast.error(describeError(e));
    }
  }

  async function ver() {
    if (!path) return;
    setAbriendo(true);
    try {
      await abrirAdjunto(BUCKET, path);
    } catch (e) {
      toast.error(describeError(e));
    } finally {
      setAbriendo(false);
    }
  }

  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="application/pdf,image/*"
        className="hidden"
        onChange={(e) => void elegir(e.target.files?.[0] ?? null)}
      />
      {path && (
        <button
          type="button"
          onClick={() => void ver()}
          disabled={abriendo}
          className="rounded-md border border-teal/40 px-2 py-1 text-[11px] font-semibold text-teal-d hover:bg-teal-l disabled:opacity-60"
        >
          {abriendo ? 'Abriendo…' : '👁 Ver'}
        </button>
      )}
      {canEdit && (
        <button
          type="button"
          onClick={() => ref.current?.click()}
          disabled={subir.isPending}
          className="rounded-md border border-sand px-2 py-1 text-[11px] font-semibold text-dark-2 hover:bg-sand-l disabled:opacity-60"
        >
          {subir.isPending ? 'Subiendo…' : path ? '📎 Reemplazar' : '📎 Imagen'}
        </button>
      )}
    </>
  );
}

function FormPasaporte({
  duenio,
  nombreSugerido,
  onListo,
}: {
  duenio: Duenio;
  nombreSugerido: string;
  onListo: () => void;
}) {
  const guardar = useGuardarPasaporte();
  const toast = useToast();
  const [v, setV] = useState({
    nombre: nombreSugerido,
    pais_emisor: '',
    libreta_num: '',
    numero: '',
    emision: '',
    vencimiento: '',
  });
  const upd = (k: keyof typeof v, x: string) => setV((p) => ({ ...p, [k]: x }));

  async function enviar() {
    if (!v.nombre.trim() || !v.pais_emisor.trim() || !v.numero.trim()) {
      toast.error('Nombre, país emisor y número son obligatorios.');
      return;
    }
    try {
      await guardar.mutateAsync({
        duenio,
        valores: {
          nombre: v.nombre.trim(),
          pais_emisor: v.pais_emisor.trim(),
          libreta_num: v.libreta_num.trim() || null,
          numero: v.numero.trim(),
          emision: v.emision || null,
          vencimiento: v.vencimiento || null,
        },
      });
      toast.success('Pasaporte agregado.');
      onListo();
    } catch (e) {
      toast.error(describeError(e));
    }
  }

  return (
    <div className="mb-3 rounded-md border border-teal/30 bg-teal-l/40 p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <TextInput
          name="pais_emisor"
          label="País emisor *"
          value={v.pais_emisor}
          onChange={(e) => upd('pais_emisor', e.target.value)}
          placeholder="Guatemala"
          autoFocus
        />
        <TextInput
          name="numero"
          label="Número de pasaporte *"
          value={v.numero}
          onChange={(e) => upd('numero', e.target.value)}
        />
        <TextInput
          name="libreta_num"
          label="Libreta No."
          value={v.libreta_num}
          onChange={(e) => upd('libreta_num', e.target.value)}
        />
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <TextInput
          name="nombre"
          label="Nombre en el pasaporte *"
          value={v.nombre}
          onChange={(e) => upd('nombre', e.target.value)}
          hint="Como está impreso: con él se emite el boleto"
        />
        <TextInput
          name="emision"
          label="Emisión"
          type="date"
          value={v.emision}
          onChange={(e) => upd('emision', e.target.value)}
        />
        <TextInput
          name="vencimiento"
          label="Vencimiento"
          type="date"
          value={v.vencimiento}
          onChange={(e) => upd('vencimiento', e.target.value)}
        />
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={onListo}
          className="rounded-md border border-sand bg-white px-3 py-1.5 text-xs font-semibold text-dark-2"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => void enviar()}
          disabled={guardar.isPending}
          className="rounded-md bg-teal px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-d disabled:opacity-60"
        >
          {guardar.isPending ? 'Guardando…' : 'Guardar pasaporte'}
        </button>
      </div>
      <p className="mt-2 text-[11px] text-dark-3">
        La imagen se sube después, con el botón 📎 de la ficha.
      </p>
    </div>
  );
}

function FormVisa({ duenio, onListo }: { duenio: Duenio; onListo: () => void }) {
  const guardar = useGuardarVisa();
  const toast = useToast();
  const [v, setV] = useState({
    pais_emisor: '',
    numero_visa: '',
    numero_control: '',
    emision: '',
    vencimiento: '',
  });
  const upd = (k: keyof typeof v, x: string) => setV((p) => ({ ...p, [k]: x }));

  async function enviar() {
    if (!v.pais_emisor.trim()) {
      toast.error('El país emisor es obligatorio.');
      return;
    }
    try {
      await guardar.mutateAsync({
        duenio,
        valores: {
          pais_emisor: v.pais_emisor.trim(),
          numero_visa: v.numero_visa.trim() || null,
          numero_control: v.numero_control.trim() || null,
          emision: v.emision || null,
          vencimiento: v.vencimiento || null,
        },
      });
      toast.success('Visa agregada.');
      onListo();
    } catch (e) {
      toast.error(describeError(e));
    }
  }

  return (
    <div className="mb-3 rounded-md border border-purple/30 bg-purple/5 p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <TextInput
          name="pais_emisor_visa"
          label="País emisor *"
          value={v.pais_emisor}
          onChange={(e) => upd('pais_emisor', e.target.value)}
          placeholder="EE. UU."
          autoFocus
        />
        <TextInput
          name="numero_visa"
          label="No. Visa"
          value={v.numero_visa}
          onChange={(e) => upd('numero_visa', e.target.value)}
        />
        <TextInput
          name="numero_control"
          label="Número de control"
          value={v.numero_control}
          onChange={(e) => upd('numero_control', e.target.value)}
        />
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <TextInput
          name="emision_visa"
          label="Emisión"
          type="date"
          value={v.emision}
          onChange={(e) => upd('emision', e.target.value)}
        />
        <TextInput
          name="vencimiento_visa"
          label="Vencimiento"
          type="date"
          value={v.vencimiento}
          onChange={(e) => upd('vencimiento', e.target.value)}
        />
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={onListo}
          className="rounded-md border border-sand bg-white px-3 py-1.5 text-xs font-semibold text-dark-2"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => void enviar()}
          disabled={guardar.isPending}
          className="rounded-md bg-purple px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          {guardar.isPending ? 'Guardando…' : 'Guardar visa'}
        </button>
      </div>
    </div>
  );
}

function FichaLicencia({ doc, canEdit }: { doc: Licencia; canEdit: boolean }) {
  const estado = estadoVencimiento(doc.vencimiento);
  const borrar = useBorrarLicencia();
  const toast = useToast();
  const confirmar = useConfirm();

  async function quitar() {
    const ok = await confirmar({
      title: 'Quitar la licencia',
      message: (
        <>
          ¿Quitar la licencia <strong>{doc.numero_licencia}</strong> de {doc.pais_emisor}?
        </>
      ),
      danger: true,
      confirmLabel: 'Quitar',
    });
    if (!ok) return;
    try {
      await borrar.mutateAsync(doc.id);
      toast.success('Licencia retirada.');
    } catch (e) {
      toast.error(describeError(e));
    }
  }

  return (
    <li className="rounded-md border border-sand p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-rust-l px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-rust">
          {doc.pais_emisor}
        </span>
        <span className="font-mono text-sm font-extrabold text-dark">{doc.numero_licencia}</span>
        {doc.tipo && (
          <span className="rounded-md border border-sand px-1.5 py-0.5 text-[10px] font-extrabold text-dark-2">
            Tipo {doc.tipo}
          </span>
        )}
        {estado && (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${estado.clase}`}>
            {estado.texto}
          </span>
        )}
        <span className="ml-auto flex gap-1">
          <ImagenDoc carpeta="licencias" id={doc.id} path={doc.imagen_path} canEdit={canEdit} />
          {canEdit && (
            <button
              type="button"
              onClick={() => void quitar()}
              className="rounded-md border border-rust/40 px-2 py-1 text-[11px] font-semibold text-rust hover:bg-rust-l"
            >
              Quitar
            </button>
          )}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Dato rotulo="Nombre en la licencia" valor={doc.nombre} />
        <Dato rotulo="No. de documento" valor={doc.numero_documento} />
        <Dato rotulo="Vencimiento" valor={doc.vencimiento ? formatDate(doc.vencimiento) : null} />
      </div>
    </li>
  );
}

function FormLicencia({
  duenio,
  nombreSugerido,
  onListo,
}: {
  duenio: Duenio;
  nombreSugerido: string;
  onListo: () => void;
}) {
  const guardar = useGuardarLicencia();
  const toast = useToast();
  const [v, setV] = useState({
    nombre: nombreSugerido,
    pais_emisor: '',
    tipo: '',
    numero_licencia: '',
    numero_documento: '',
    vencimiento: '',
  });
  const upd = (k: keyof typeof v, x: string) => setV((p) => ({ ...p, [k]: x }));

  async function enviar() {
    if (!v.nombre.trim() || !v.pais_emisor.trim() || !v.numero_licencia.trim()) {
      toast.error('Nombre, país emisor y número de licencia son obligatorios.');
      return;
    }
    try {
      await guardar.mutateAsync({
        duenio,
        valores: {
          nombre: v.nombre.trim(),
          pais_emisor: v.pais_emisor.trim(),
          tipo: v.tipo.trim() || null,
          numero_licencia: v.numero_licencia.trim(),
          numero_documento: v.numero_documento.trim() || null,
          vencimiento: v.vencimiento || null,
        },
      });
      toast.success('Licencia agregada.');
      onListo();
    } catch (e) {
      toast.error(describeError(e));
    }
  }

  return (
    <div className="mb-3 rounded-md border border-rust/30 bg-rust-l/40 p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <TextInput
          name="pais_lic"
          label="País emisor *"
          value={v.pais_emisor}
          onChange={(e) => upd('pais_emisor', e.target.value)}
          placeholder="Guatemala"
          autoFocus
        />
        <TextInput
          name="tipo_lic"
          label="Tipo"
          value={v.tipo}
          onChange={(e) => upd('tipo', e.target.value)}
          placeholder="C, B, M1…"
        />
        <TextInput
          name="numero_licencia"
          label="No. de licencia *"
          value={v.numero_licencia}
          onChange={(e) => upd('numero_licencia', e.target.value)}
        />
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <TextInput
          name="nombre_lic"
          label="Nombre en la licencia *"
          value={v.nombre}
          onChange={(e) => upd('nombre', e.target.value)}
        />
        <TextInput
          name="numero_documento"
          label="No. de documento"
          value={v.numero_documento}
          onChange={(e) => upd('numero_documento', e.target.value)}
          hint="El DPI con que se emitió"
        />
        <TextInput
          name="venc_lic"
          label="Vencimiento"
          type="date"
          value={v.vencimiento}
          onChange={(e) => upd('vencimiento', e.target.value)}
        />
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={onListo}
          className="rounded-md border border-sand bg-white px-3 py-1.5 text-xs font-semibold text-dark-2"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => void enviar()}
          disabled={guardar.isPending}
          className="rounded-md bg-rust px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          {guardar.isPending ? 'Guardando…' : 'Guardar licencia'}
        </button>
      </div>
    </div>
  );
}

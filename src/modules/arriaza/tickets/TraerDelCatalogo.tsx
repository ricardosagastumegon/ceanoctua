import { useMemo, useState } from 'react';
import { useInvitados, usePersonas } from '@/modules/admin/hooks';
import { useAfiliaciones, usePasaportes, useVisas } from '@/modules/admin/viajeros/hooks';
import { isoForCountry } from '../constants/countries';
import type { Afiliacion, Pasaporte, Visa } from '@/modules/admin/viajeros/api';

/**
 * Traer los datos de un pasajero desde el catálogo.
 *
 * Es la razón de ser de «Admin → Documentos de viaje». Sin esto, el
 * pasaporte y el viajero frecuente se vuelven a teclear en cada boleto, y por
 * eso la misma persona quedó capturada con cuatro grafías y con dos números
 * de pasaporte distintos.
 *
 * ── Se escoge la persona Y el pasaporte ──────────────────────────────────
 *
 * Casi todos tienen doble nacionalidad, y **cuál se usa depende de la ruta y
 * el destino**: con un destino se entra mejor con el pasaporte europeo y con
 * otro con el guatemalteco. Por eso la lista no ofrece personas sino
 * pasaportes --«Miguel Angel Arriaza · España»--: elegir por la persona y
 * dejar que el sistema escoja el documento seria decidir por quien emite el
 * boleto, que es justo quien sabe.
 *
 * Lo traído se puede corregir: a partir de ese momento el dato es del boleto.
 * Un boleto emitido es un documento, no una vista del catálogo, y si mañana
 * cambia el pasaporte el boleto viejo tiene que seguir diciendo con cuál se
 * voló.
 */

export type DatosTraidos = {
  nombre: string;
  nacionalidades: string[];
  pasaporte_num: string;
  libreta_num: string;
  visa_num: string;
  ffn: string;
  programa: string;
};

function estaVigente(d: { vencimiento: string | null }): boolean {
  if (!d.vencimiento) return true;
  return d.vencimiento >= new Date().toISOString().slice(0, 10);
}

/** Vencido no sirve para volar: entre varios se prefiere el que esté vigente. */
function vigentePrimero<T extends { vencimiento: string | null }>(docs: T[]): T | undefined {
  return docs.find(estaVigente) ?? docs[0];
}

/**
 * Qué afiliación corresponde a la aerolínea del boleto.
 *
 * `att_tickets.aerolinea` es texto libre y dice «DELTA- KLM», «American
 * Airlines» o «CONDOR AIRLINES», así que no se puede comparar entero. Se
 * busca que una palabra significativa del programa aparezca en la aerolínea:
 * «Delta SkyMiles» contra «DELTA- KLM» coincide por «delta».
 */
function afiliacionParaAerolinea(
  afiliaciones: Afiliacion[],
  aerolinea: string,
): Afiliacion | undefined {
  const a = aerolinea.toLowerCase();
  if (!a.trim()) return undefined;
  return afiliaciones.find((af) =>
    af.programa
      .toLowerCase()
      .split(/[^a-záéíóúñ]+/i)
      .filter((w) => w.length >= 4)
      .some((w) => a.includes(w)),
  );
}

type Opcion = {
  valor: string;
  etiqueta: string;
  grupo: string;
  clavePersona: string;
  pasaporte: Pasaporte | null;
  nombrePersona: string;
};

export function TraerDelCatalogo({
  aerolinea,
  onTraer,
}: {
  aerolinea: string;
  onTraer: (d: DatosTraidos) => void;
}) {
  const personasQ = usePersonas();
  const invitadosQ = useInvitados();
  const pasaportesQ = usePasaportes();
  const visasQ = useVisas();
  const afiliacionesQ = useAfiliaciones();
  const [aviso, setAviso] = useState<string | null>(null);

  const opciones = useMemo<Opcion[]>(() => {
    const gente = [
      ...(personasQ.data ?? []).map((x) => ({
        clave: `persona:${x.id}`,
        nombre: x.nombre,
        grupo: 'Personal JD',
      })),
      ...(invitadosQ.data ?? [])
        .filter((x) => x.activo !== false)
        .map((x) => ({ clave: `invitado:${x.id}`, nombre: x.nombre, grupo: 'Invitados' })),
    ];

    const out: Opcion[] = [];
    for (const g of gente) {
      const [tipo, id] = g.clave.split(':');
      const suyos = (pasaportesQ.data ?? []).filter((d) =>
        tipo === 'persona' ? d.persona_id === id : d.invitado_id === id,
      );
      if (suyos.length === 0) {
        out.push({
          valor: g.clave,
          etiqueta: `${g.nombre} — sin pasaporte`,
          grupo: g.grupo,
          clavePersona: g.clave,
          pasaporte: null,
          nombrePersona: g.nombre,
        });
        continue;
      }
      for (const ps of suyos) {
        out.push({
          valor: `${g.clave}|${ps.id}`,
          etiqueta: `${g.nombre} · ${ps.pais_emisor}${estaVigente(ps) ? '' : ' (vencido)'}`,
          grupo: g.grupo,
          clavePersona: g.clave,
          pasaporte: ps,
          nombrePersona: g.nombre,
        });
      }
    }
    return out;
  }, [personasQ.data, invitadosQ.data, pasaportesQ.data]);

  function suyos<T extends { persona_id: string | null; invitado_id: string | null }>(
    docs: T[],
    clave: string,
  ): T[] {
    const [tipo, id] = clave.split(':');
    return docs.filter((d) => (tipo === 'persona' ? d.persona_id === id : d.invitado_id === id));
  }

  function traer(valor: string) {
    if (!valor) return;
    const op = opciones.find((o) => o.valor === valor);
    if (!op) return;

    const pasaporte = op.pasaporte;
    const misVisas = suyos(visasQ.data ?? [], op.clavePersona);
    const visa: Visa | undefined = vigentePrimero(misVisas);
    const misAfiliaciones = suyos(afiliacionesQ.data ?? [], op.clavePersona);
    const afiliacion = afiliacionParaAerolinea(misAfiliaciones, aerolinea);

    const iso = pasaporte?.pais_emisor ? isoForCountry(pasaporte.pais_emisor) : null;

    onTraer({
      // El nombre del pasaporte manda: con ese se emite el boleto, y cada
      // pasaporte puede traer uno distinto.
      nombre: pasaporte?.nombre || op.nombrePersona,
      nacionalidades: iso ? [iso] : [],
      pasaporte_num: pasaporte?.numero ?? '',
      libreta_num: pasaporte?.libreta_num ?? '',
      visa_num: visa?.numero_visa ?? '',
      ffn: afiliacion?.numero ?? '',
      programa: afiliacion?.programa ?? '',
    });

    const notas: string[] = [];
    if (!pasaporte) notas.push('sin pasaporte en el catálogo');
    else if (!estaVigente(pasaporte)) notas.push('ese pasaporte está vencido');
    if (!visa) notas.push('sin visa');
    else if (misVisas.length > 1) notas.push(`se trajo la visa de ${visa.pais_emisor}`);
    if (!afiliacion) {
      notas.push(
        misAfiliaciones.length > 0
          ? `ninguna afiliación corresponde a «${aerolinea || 'la aerolínea'}»`
          : 'sin afiliaciones',
      );
    }
    setAviso(notas.length > 0 ? notas.join(' · ') : null);
  }

  const grupos = [...new Set(opciones.map((o) => o.grupo))];

  return (
    <div>
      <select
        value=""
        onChange={(e) => traer(e.target.value)}
        aria-label="Traer los datos de una persona del catálogo"
        className="w-full rounded-md border border-teal/50 bg-teal-l/50 px-2 py-1.5 text-xs font-semibold text-teal-d focus:border-teal focus:outline-none"
      >
        <option value="">👤 Traer del catálogo…</option>
        {grupos.map((g) => (
          <optgroup key={g} label={g}>
            {opciones
              .filter((o) => o.grupo === g)
              .map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.etiqueta}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
      {aviso && <p className="mt-1 text-[10px] text-rust">Ojo: {aviso}.</p>}
    </div>
  );
}

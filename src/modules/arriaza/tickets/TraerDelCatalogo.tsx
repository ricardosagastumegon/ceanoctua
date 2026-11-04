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

/** Vencido no sirve para volar: se prefiere el que esté vigente. */
function vigentePrimero<T extends { vencimiento: string | null }>(docs: T[]): T | undefined {
  const hoy = new Date().toISOString().slice(0, 10);
  const vigentes = docs.filter((d) => !d.vencimiento || d.vencimiento >= hoy);
  return vigentes[0] ?? docs[0];
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

  const gente = useMemo(() => {
    const p = (personasQ.data ?? []).map((x) => ({
      clave: `persona:${x.id}`,
      nombre: x.nombre,
      grupo: 'Personal JD',
    }));
    const i = (invitadosQ.data ?? [])
      .filter((x) => x.activo !== false)
      .map((x) => ({ clave: `invitado:${x.id}`, nombre: x.nombre, grupo: 'Invitados' }));
    return [...p, ...i];
  }, [personasQ.data, invitadosQ.data]);

  function suyos<T extends { persona_id: string | null; invitado_id: string | null }>(
    docs: T[],
    clave: string,
  ): T[] {
    const [tipo, id] = clave.split(':');
    return docs.filter((d) => (tipo === 'persona' ? d.persona_id === id : d.invitado_id === id));
  }

  function traer(clave: string) {
    if (!clave) return;
    const persona = gente.find((g) => g.clave === clave);
    if (!persona) return;

    const pasaporte: Pasaporte | undefined = vigentePrimero(suyos(pasaportesQ.data ?? [], clave));
    const visa: Visa | undefined = vigentePrimero(suyos(visasQ.data ?? [], clave));
    const misAfiliaciones = suyos(afiliacionesQ.data ?? [], clave);
    const afiliacion = afiliacionParaAerolinea(misAfiliaciones, aerolinea);

    const iso = pasaporte?.pais_emisor ? isoForCountry(pasaporte.pais_emisor) : null;

    onTraer({
      // El nombre del pasaporte manda: con ese se emite el boleto.
      nombre: pasaporte?.nombre || persona.nombre,
      nacionalidades: iso ? [iso] : [],
      pasaporte_num: pasaporte?.numero ?? '',
      libreta_num: pasaporte?.libreta_num ?? '',
      visa_num: visa?.numero_visa ?? '',
      ffn: afiliacion?.numero ?? '',
      programa: afiliacion?.programa ?? '',
    });

    const faltas: string[] = [];
    if (!pasaporte) faltas.push('sin pasaporte en el catálogo');
    if (!visa) faltas.push('sin visa');
    if (!afiliacion) {
      faltas.push(
        misAfiliaciones.length > 0
          ? `ninguna afiliación corresponde a «${aerolinea || 'la aerolínea'}»`
          : 'sin afiliaciones',
      );
    }
    setAviso(faltas.length > 0 ? faltas.join(' · ') : null);
  }

  const grupos = [...new Set(gente.map((g) => g.grupo))];

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
            {gente
              .filter((x) => x.grupo === g)
              .map((x) => (
                <option key={x.clave} value={x.clave}>
                  {x.nombre}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
      {aviso && <p className="mt-1 text-[10px] text-rust">Se trajo lo que había: {aviso}.</p>}
    </div>
  );
}

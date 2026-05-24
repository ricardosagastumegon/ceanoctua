import { formatDateTime } from '@/lib/dates';
import type { Database } from '@/types/database';

type Directorio = Database['public']['Tables']['directorio']['Row'];

const tipoColor: Record<string, string> = {
  Persona: '#0369a1',
  Empresa: '#166534',
  'Entidad Pública': '#7c2d12',
};

export function DirectorioPrintable({ contacto }: { contacto: Directorio }) {
  const initial = (contacto.nombre || '?').trim().charAt(0).toUpperCase();
  const color = tipoColor[contacto.tipo ?? ''] ?? '#0d2b2e';
  return (
    <article className="text-dark">
      <header className="rounded-t-md p-6 text-white" style={{ background: color }}>
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 font-heading text-2xl font-bold">
            {initial}
          </div>
          <div>
            <h1 className="font-heading text-2xl font-bold">{contacto.nombre}</h1>
            {contacto.tipo && (
              <span className="mt-1 inline-block rounded-full bg-white/15 px-3 py-0.5 text-xs font-semibold uppercase tracking-wider">
                {contacto.tipo}
              </span>
            )}
            {contacto.giro && (
              <p className="mt-1 text-sm text-white/80">{contacto.giro}</p>
            )}
          </div>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 px-6 py-5 text-sm">
        {contacto.tel && <Field icon="📞" label="Teléfono" value={contacto.tel} />}
        {contacto.whatsapp && <Field icon="💬" label="WhatsApp" value={contacto.whatsapp} />}
        {contacto.email && <Field icon="✉" label="Email" value={contacto.email} />}
        {contacto.web && <Field icon="🌐" label="Web" value={contacto.web} />}
        {contacto.nit && <Field icon="#" label="NIT" value={contacto.nit} />}
        {contacto.razon && <Field icon="🏢" label="Razón social" value={contacto.razon} />}
        {contacto.direccion && (
          <div className="col-span-2">
            <Field icon="📍" label="Dirección" value={contacto.direccion} />
          </div>
        )}
      </section>

      {contacto.notas && (
        <section className="border-t border-sand px-6 py-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-dark-3">Notas</p>
          <p className="whitespace-pre-line text-sm">{contacto.notas}</p>
        </section>
      )}

      <footer className="border-t border-sand bg-sand-l px-6 py-3 text-center text-[10px] text-dark-3">
        Board Assistant · CEA · Directorio · {formatDateTime(new Date())}
      </footer>
    </article>
  );
}

function Field({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="rounded-md border border-sand bg-sand-l/40 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-dark-3">
        {icon} {label}
      </p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
    </div>
  );
}

-- Admin · Licencias de conducir de quien viaja
--
-- Al rentar un carro --y en algunos tours-- la agencia pide la licencia: el
-- numero, el tipo y el vencimiento. Hoy eso vive en la misma hoja que los
-- pasaportes y hay que ir a buscarla con la agencia en el telefono.
--
-- Mismo patron que los pasaportes: cuelga de la persona que ya existe
-- --Personal JD o Invitados-- y son varias por persona, porque quien tiene
-- doble nacionalidad suele tener licencia de los dos paises y la agencia de
-- cada pais pide la suya.
--
-- `nombre` va en la licencia y no en la persona, por lo mismo que en el
-- pasaporte: el nombre impreso manda cuando hay que mostrar el documento.

create table if not exists public.viajero_licencias (
  id uuid primary key default gen_random_uuid(),

  persona_id uuid references public.personas(id) on delete cascade,
  invitado_id uuid references public.invitados(id) on delete cascade,

  nombre text not null,
  pais_emisor text not null,

  -- El tipo que da el pais emisor: «C», «B», «M1». Texto porque cada pais
  -- usa su propia nomenclatura y no hay una lista comun que valga la pena.
  tipo text,

  numero_licencia text not null,

  -- El documento de identidad con el que se emitio --el DPI en Guatemala--,
  -- que algunas agencias piden junto con la licencia.
  numero_documento text,

  vencimiento date,
  imagen_path text,
  notas text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);

alter table public.viajero_licencias
  drop constraint if exists viajero_licencias_uno_chk;
alter table public.viajero_licencias
  add constraint viajero_licencias_uno_chk
  check (num_nonnulls(persona_id, invitado_id) = 1);

create index if not exists viajero_licencias_persona_idx
  on public.viajero_licencias (persona_id) where deleted_at is null;
create index if not exists viajero_licencias_invitado_idx
  on public.viajero_licencias (invitado_id) where deleted_at is null;

comment on table public.viajero_licencias is
  'Licencias de conducir de quien viaja. Las pide la agencia al rentar un carro.';
comment on column public.viajero_licencias.numero_documento is
  'El documento de identidad con que se emitio la licencia. En Guatemala, el DPI.';

drop trigger if exists set_updated_at_viajero_licencias on public.viajero_licencias;
create trigger set_updated_at_viajero_licencias
  before update on public.viajero_licencias
  for each row execute function public.set_updated_at();

drop trigger if exists audit_viajero_licencias on public.viajero_licencias;
create trigger audit_viajero_licencias
  after insert or update or delete on public.viajero_licencias
  for each row execute function public.audit_trigger();

-- Mismo criterio que los pasaportes: no es un catalogo cualquiera.
alter table public.viajero_licencias enable row level security;

drop policy if exists viajero_licencias_read on public.viajero_licencias;
create policy viajero_licencias_read on public.viajero_licencias for select
  using (public.puede('tt', 'observador'));

drop policy if exists viajero_licencias_write on public.viajero_licencias;
create policy viajero_licencias_write on public.viajero_licencias for all
  using (public.puede('tt', 'editor'))
  with check (public.puede('tt', 'editor'));

NOTIFY pgrst, 'reload schema';

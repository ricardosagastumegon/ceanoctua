-- Admin · Documentos de viaje de los participantes
--
-- EL PROBLEMA
--
-- El pasaporte y la visa de cada quien viven en un Excel, y en la aplicacion
-- se retecleaan en CADA boleto: `att_ticket_pax` guarda nombre, pasaporte,
-- vencimiento y visa por ticket. Son 19 pasajeros capturados y la misma
-- persona aparece con grafias distintas y hasta con dos numeros de pasaporte.
--
-- Igual que con los participantes del viaje, la cura es un catalogo: el dato
-- se captura una vez y de ahi se toma.
--
-- DE QUIEN CUELGAN
--
-- De la persona que YA existe --Personal JD o Invitados--, no de una lista
-- nueva. Una tercera lista de gente seria volver al problema que se acaba de
-- quitar: la misma persona en tres tablas, escrita de tres formas.
--
-- VARIOS PASAPORTES POR PERSONA
--
-- Lo pidio la asistente y es correcto: en esta familia hay doble
-- nacionalidad, y cada nacionalidad tiene su pasaporte, con su propio numero
-- y vencimiento. Por eso es una tabla hija y no columnas en la persona.
--
-- `nombre` va en el pasaporte y no en la persona a proposito: el nombre
-- impreso en el documento no siempre es el de uso --«Miguel Angel Arriaza
-- Migoya» contra «Miguel Angel Arriaza»-- y el boleto tiene que emitirse con
-- el del pasaporte o no se vuela.
--
-- LAS VISAS
--
-- Cuelgan de la persona y no del pasaporte, como en la hoja de la que salen.
-- Una visa se estampa en un pasaporte concreto, asi que algun dia puede
-- hacer falta amarrarlas; hoy nadie lleva esa cuenta y pedirlo obligaria a
-- capturar el pasaporte antes que la visa.

-- ── 1 · Pasaportes ────────────────────────────────────────────────────────
create table if not exists public.viajero_pasaportes (
  id uuid primary key default gen_random_uuid(),

  -- Uno de los dos, nunca ambos ni ninguno. Mismo patron que los
  -- participantes del viaje.
  persona_id uuid references public.personas(id) on delete cascade,
  invitado_id uuid references public.invitados(id) on delete cascade,

  -- El nombre tal como esta impreso en ESTE pasaporte.
  nombre text not null,

  pais_emisor text not null,
  libreta_num text,
  numero text not null,
  emision date,
  vencimiento date,

  -- El escaneo, en el bucket tt-documentos que ya usa el modulo de viajes.
  imagen_path text,

  notas text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);

alter table public.viajero_pasaportes
  drop constraint if exists viajero_pasaportes_uno_chk;
alter table public.viajero_pasaportes
  add constraint viajero_pasaportes_uno_chk
  check (num_nonnulls(persona_id, invitado_id) = 1);

alter table public.viajero_pasaportes
  drop constraint if exists viajero_pasaportes_fechas_chk;
alter table public.viajero_pasaportes
  add constraint viajero_pasaportes_fechas_chk
  check (emision is null or vencimiento is null or vencimiento >= emision);

create index if not exists viajero_pasaportes_persona_idx
  on public.viajero_pasaportes (persona_id) where deleted_at is null;
create index if not exists viajero_pasaportes_invitado_idx
  on public.viajero_pasaportes (invitado_id) where deleted_at is null;

comment on table public.viajero_pasaportes is
  'Pasaportes de quien viaja. Varios por persona: una nacionalidad, un pasaporte.';
comment on column public.viajero_pasaportes.nombre is
  'El nombre impreso en este pasaporte, que no siempre es el de uso. El boleto se emite con este.';

-- ── 2 · Visas ─────────────────────────────────────────────────────────────
create table if not exists public.viajero_visas (
  id uuid primary key default gen_random_uuid(),

  persona_id uuid references public.personas(id) on delete cascade,
  invitado_id uuid references public.invitados(id) on delete cascade,

  -- Quien la emite: EEUU, Schengen, Canada.
  pais_emisor text not null,
  numero_visa text,
  numero_control text,
  emision date,
  vencimiento date,
  imagen_path text,
  notas text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);

alter table public.viajero_visas
  drop constraint if exists viajero_visas_uno_chk;
alter table public.viajero_visas
  add constraint viajero_visas_uno_chk
  check (num_nonnulls(persona_id, invitado_id) = 1);

alter table public.viajero_visas
  drop constraint if exists viajero_visas_fechas_chk;
alter table public.viajero_visas
  add constraint viajero_visas_fechas_chk
  check (emision is null or vencimiento is null or vencimiento >= emision);

create index if not exists viajero_visas_persona_idx
  on public.viajero_visas (persona_id) where deleted_at is null;
create index if not exists viajero_visas_invitado_idx
  on public.viajero_visas (invitado_id) where deleted_at is null;

comment on table public.viajero_visas is
  'Visas de quien viaja. Cuelgan de la persona, como en la hoja de la que salen.';

-- ── 3 · Triggers ──────────────────────────────────────────────────────────
drop trigger if exists set_updated_at_viajero_pasaportes on public.viajero_pasaportes;
create trigger set_updated_at_viajero_pasaportes
  before update on public.viajero_pasaportes
  for each row execute function public.set_updated_at();

drop trigger if exists audit_viajero_pasaportes on public.viajero_pasaportes;
create trigger audit_viajero_pasaportes
  after insert or update or delete on public.viajero_pasaportes
  for each row execute function public.audit_trigger();

drop trigger if exists set_updated_at_viajero_visas on public.viajero_visas;
create trigger set_updated_at_viajero_visas
  before update on public.viajero_visas
  for each row execute function public.set_updated_at();

drop trigger if exists audit_viajero_visas on public.viajero_visas;
create trigger audit_viajero_visas
  after insert or update or delete on public.viajero_visas
  for each row execute function public.audit_trigger();

-- ── 4 · RLS ───────────────────────────────────────────────────────────────
-- Un numero de pasaporte no es un catalogo cualquiera, asi que NO lleva el
-- patron de «lee cualquiera autenticado». Lo lee quien tenga el modulo de
-- viajes, que es quien emite los boletos, y lo escribe quien pueda editar
-- ahi. El nivel se reparte desde Admin → Usuarios y accesos.
alter table public.viajero_pasaportes enable row level security;

drop policy if exists viajero_pasaportes_read on public.viajero_pasaportes;
create policy viajero_pasaportes_read on public.viajero_pasaportes for select
  using (public.puede('tt', 'observador'));

drop policy if exists viajero_pasaportes_write on public.viajero_pasaportes;
create policy viajero_pasaportes_write on public.viajero_pasaportes for all
  using (public.puede('tt', 'editor'))
  with check (public.puede('tt', 'editor'));

alter table public.viajero_visas enable row level security;

drop policy if exists viajero_visas_read on public.viajero_visas;
create policy viajero_visas_read on public.viajero_visas for select
  using (public.puede('tt', 'observador'));

drop policy if exists viajero_visas_write on public.viajero_visas;
create policy viajero_visas_write on public.viajero_visas for all
  using (public.puede('tt', 'editor'))
  with check (public.puede('tt', 'editor'));

NOTIFY pgrst, 'reload schema';

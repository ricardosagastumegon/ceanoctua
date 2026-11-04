-- Admin · Afiliaciones de quien viaja
--
-- «American Airlines : 08HSDK6». El numero de viajero frecuente, el Porsche
-- ID, el numero de huesped: lo que hoy vive en una hoja aparte y hay que ir a
-- buscar cada vez que se emite un boleto.
--
-- `att_ticket_pax.programa` esta vacio en TODAS las filas capturadas, y en
-- dos casos el programa quedo metido dentro del numero --«9008112501
-- DELTA»--. Ese es el sintoma de no tener donde ponerlo.
--
-- POR QUE `programa` ES TEXTO Y NO UN CATALOGO
--
-- Hoy la afiliacion solo se consulta: alguien la lee y la copia al boleto. Un
-- catalogo de programas se gana su lugar cuando el boleto tenga que ENCONTRAR
-- solo el numero que corresponde a su aerolinea, porque `att_tickets.aerolinea`
-- es texto libre y dice «DELTA- KLM» o «CONDOR AIRLINES»: ahi haran falta
-- alias. Mientras tanto, la pantalla sugiere los programas ya escritos para
-- que no nazcan cuatro grafias del mismo.

create table if not exists public.viajero_afiliaciones (
  id uuid primary key default gen_random_uuid(),

  persona_id uuid references public.personas(id) on delete cascade,
  invitado_id uuid references public.invitados(id) on delete cascade,

  -- «American Airlines», «Porsche MX», «Marriott Bonvoy».
  programa text not null,

  -- El numero de la afiliacion. Es lo que se copia al boleto.
  numero text not null,

  -- El nivel, cuando lo hay: Gold, Platinum, Executive Platinum.
  categoria text,

  -- Con que correo esta abierta la cuenta, que no siempre es el de la
  -- persona: varias cuentas de la familia cuelgan del mismo.
  email_cuenta text,

  notas text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);

alter table public.viajero_afiliaciones
  drop constraint if exists viajero_afiliaciones_uno_chk;
alter table public.viajero_afiliaciones
  add constraint viajero_afiliaciones_uno_chk
  check (num_nonnulls(persona_id, invitado_id) = 1);

create index if not exists viajero_afiliaciones_persona_idx
  on public.viajero_afiliaciones (persona_id) where deleted_at is null;
create index if not exists viajero_afiliaciones_invitado_idx
  on public.viajero_afiliaciones (invitado_id) where deleted_at is null;

comment on table public.viajero_afiliaciones is
  'Viajero frecuente y demas programas de quien viaja. Una fila por persona y programa.';
comment on column public.viajero_afiliaciones.numero is
  'El numero de la afiliacion, limpio: el programa va en su propia columna y no dentro del numero.';

-- Las contrasenas NO se guardan. Decision de la asistente el 2026-10-29:
-- guardarlas en claro las deja legibles para cualquiera que entre, y ademas
-- el trigger de auditoria las copiaria a audit_log en cada edicion. El
-- secreto terminaria en mas lugares que en el Excel.

drop trigger if exists set_updated_at_viajero_afiliaciones on public.viajero_afiliaciones;
create trigger set_updated_at_viajero_afiliaciones
  before update on public.viajero_afiliaciones
  for each row execute function public.set_updated_at();

drop trigger if exists audit_viajero_afiliaciones on public.viajero_afiliaciones;
create trigger audit_viajero_afiliaciones
  after insert or update or delete on public.viajero_afiliaciones
  for each row execute function public.audit_trigger();

-- Mismo criterio que los pasaportes: lo lee quien tenga el modulo de viajes.
alter table public.viajero_afiliaciones enable row level security;

drop policy if exists viajero_afiliaciones_read on public.viajero_afiliaciones;
create policy viajero_afiliaciones_read on public.viajero_afiliaciones for select
  using (public.puede('tt', 'observador'));

drop policy if exists viajero_afiliaciones_write on public.viajero_afiliaciones;
create policy viajero_afiliaciones_write on public.viajero_afiliaciones for all
  using (public.puede('tt', 'editor'))
  with check (public.puede('tt', 'editor'));

NOTIFY pgrst, 'reload schema';

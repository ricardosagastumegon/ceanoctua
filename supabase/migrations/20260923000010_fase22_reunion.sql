-- Fase 22 · Reuniones, según el documento del 2026-09-23. Cierra los 11
-- servicios de T&T.
--
-- La tabla viene del port de la Fase 19 con un modelo distinto al que pide el
-- documento, y esta vacia, asi que se le agrega lo que falta:
--
--   titulo        · "Titulo: Espacio para escribir". Las columnas `cita` y
--                   `asunto` del port viejo quedan sin uso.
--   tipo          · "Presencial, Virtual, Presencial & Virtual"
--   hora_fin      · "Inicio: horario / fin: horario". `hora` es el inicio.
--   lugar         · "Lugar: Espacio para escribir"
--   descripcion   · "Espacio para poder alguna descripcion larga"
--
-- Los participantes van en tabla aparte porque el documento pide nombre,
-- referencia y telefono de cada uno, con boton para agregar varios.
--
-- Este servicio NO lleva costo: no aporta al total del viaje.

alter table public.att_reuniones
  add column if not exists titulo text,
  add column if not exists tipo text,
  add column if not exists hora_fin time,
  add column if not exists lugar text,
  add column if not exists descripcion text;

comment on column public.att_reuniones.hora is
  'Hora de inicio de la reunion. La de fin es hora_fin.';
-- `cita` era NOT NULL y el documento no la pide, asi que una reunion nueva no
-- se habria podido guardar. Se libera: queda del port viejo, sin uso.
alter table public.att_reuniones alter column cita drop not null;

comment on column public.att_reuniones.cita is
  'DEPRECADA (fase 22). Del port viejo; el documento pide `titulo`.';
comment on column public.att_reuniones.asunto is
  'DEPRECADA (fase 22). Del port viejo; el documento pide `titulo` y `descripcion`.';

alter table public.att_reuniones drop constraint if exists att_reuniones_tipo_chk;
alter table public.att_reuniones add constraint att_reuniones_tipo_chk
  check (tipo is null or tipo in ('Presencial', 'Virtual', 'Presencial & Virtual'));

-- ============================================================
-- Participantes de la reunion
--
-- Del documento: "Espacio para agregar participantes con nombre, referencia y
-- tel / + Boton de agregar: para agregar a mas de 1 participante".
-- ============================================================
create table if not exists public.att_reunion_participantes (
  id uuid primary key default gen_random_uuid(),
  reunion_id uuid not null references public.att_reuniones(id) on delete cascade,
  nombre text,
  referencia text,
  telefono text,
  orden int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);

comment on table public.att_reunion_participantes is
  'Quienes asisten a la reunion: nombre, referencia y telefono.';

create index if not exists att_reunion_participantes_reunion_id_idx
  on public.att_reunion_participantes(reunion_id) where deleted_at is null;

-- RLS Pattern A + triggers de auditoria.
do $$
declare
  t text := 'att_reunion_participantes';
begin
  if not exists (select 1 from pg_proc where proname = 'audit_trigger') then
    raise exception 'audit_trigger() no existe — falta correr la migración fase 3';
  end if;
  if not exists (select 1 from pg_proc where proname = 'set_updated_at_with_by') then
    raise exception 'set_updated_at_with_by() no existe — falta correr la migración fase 4';
  end if;
  if not exists (select 1 from pg_proc where proname = 'auth_rol') then
    raise exception 'public.auth_rol() no existe — falta correr la migración fase 3';
  end if;

  execute format('alter table public.%I enable row level security', t);

  execute format('drop policy if exists %I on public.%I', t || '_read', t);
  execute format(
    'create policy %I on public.%I for select using (public.auth_rol() in (''admin'',''asistente''))',
    t || '_read', t
  );

  execute format('drop policy if exists %I on public.%I', t || '_write', t);
  execute format(
    'create policy %I on public.%I for all
       using (public.auth_rol() in (''admin'',''asistente''))
       with check (public.auth_rol() in (''admin'',''asistente''))',
    t || '_write', t
  );

  execute format('drop trigger if exists %I on public.%I', t || '_updated_at_trg', t);
  execute format(
    'create trigger %I before update on public.%I
       for each row execute function public.set_updated_at_with_by()',
    t || '_updated_at_trg', t
  );

  execute format('drop trigger if exists %I on public.%I', 'audit_' || t, t);
  execute format(
    'create trigger %I after insert or update or delete on public.%I
       for each row execute function public.audit_trigger()',
    'audit_' || t, t
  );
end $$;

NOTIFY pgrst, 'reload schema';

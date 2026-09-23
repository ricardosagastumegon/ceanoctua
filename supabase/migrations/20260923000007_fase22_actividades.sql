-- Fase 22 · Actividades y Eventos, según el documento del 2026-09-23.
--
-- La tabla guardaba el evento, sus fechas y el pago, pero le faltaban los dos
-- bloques centrales del documento: "Información de participante" e
-- "Información de precio". Se agregan a la propia actividad porque el
-- documento los pide una sola vez por evento, no repetidos.

alter table public.att_actividades
  add column if not exists participantes text,
  add column if not exists confirmacion text,
  add column if not exists reserva_nombre text,
  add column if not exists lugares text,
  add column if not exists personas integer,
  add column if not exists tiene_tickets boolean not null default false,
  add column if not exists inclusiones text,
  add column if not exists tarifa numeric(14,2),
  add column if not exists extras text,
  add column if not exists monto_extras numeric(14,2),
  add column if not exists monto numeric(14,2),
  add column if not exists moneda public.currency not null default 'USD',
  add column if not exists confirmacion_path text;

comment on column public.att_actividades.participantes is
  'Nombres separados por coma, como los acompanantes del viaje.';
comment on column public.att_actividades.tiene_tickets is
  'La casilla "No. de Ticket ... si es que aplica". Si esta marcada, el evento
   lleva su lista de entradas en att_actividad_entradas.';
comment on column public.att_actividades.monto is
  'Derivado: tarifa por persona x personas + monto de extras. Se recalcula al guardar.';

-- Estado de pago · lista unificada de 6 valores, eliminando la vieja de 5.
alter table public.att_actividades drop constraint if exists att_actividades_estado_pago_check;
alter table public.att_actividades drop constraint if exists att_actividades_estado_pago_chk;
alter table public.att_actividades add constraint att_actividades_estado_pago_chk
  check (estado_pago is null or estado_pago in (
    'HOLD', 'PAGO PARCIAL', 'CONFIRMADO', 'CANCELADO', 'ABIERTO', 'A PAGAR EN PROPIEDAD'
  ));

update public.att_actividades
   set monto = coalesce(tarifa, 0) * coalesce(personas, 0) + coalesce(monto_extras, 0)
 where monto is null
   and deleted_at is null;

-- ============================================================
-- Las entradas del evento
--
-- El documento: "No. De Ticket: casilla para seleccion si es que aplica, si se
-- selecciona, abrir casilla con Nombre / No. De Ticket / Lugar. Opcion para
-- agregar multiples tickets."
--
-- Cuelga directo de la actividad. Las dos tablas del port viejo no encajan:
-- att_actividad_tickets es un bloque repetible CON SU PROPIA tarifa y extras,
-- y el documento pone el precio a nivel del evento una sola vez;
-- att_actividad_subtickets tiene los campos correctos pero cuelga de aquella.
-- Ambas estan vacias y quedan marcadas como deprecadas mas abajo.
-- ============================================================
create table if not exists public.att_actividad_entradas (
  id uuid primary key default gen_random_uuid(),
  actividad_id uuid not null references public.att_actividades(id) on delete cascade,
  nombre text,
  ticket text,
  lugar text,
  orden int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);

comment on table public.att_actividad_entradas is
  'Entradas de una actividad: nombre, numero de ticket y lugar.';

create index if not exists att_actividad_entradas_actividad_id_idx
  on public.att_actividad_entradas(actividad_id) where deleted_at is null;

-- RLS Pattern A + triggers de auditoria.
do $$
declare
  t text := 'att_actividad_entradas';
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

-- ============================================================
-- Deprecacion de las dos tablas del port viejo
--
-- No se borran aqui: quedan agendadas en docs/PENDIENTES.md, como se hizo con
-- att_pins. Ambas estan vacias, asi que dropearlas no perderia nada.
-- ============================================================
comment on table public.att_actividad_tickets is
  'DEPRECADA (2026-09-23, fase 22). El documento pone el precio a nivel del
   evento, no por bloque de participante. Reemplazada por columnas en
   att_actividades + att_actividad_entradas. Vacia; pendiente de drop.';
comment on table public.att_actividad_subtickets is
  'DEPRECADA (2026-09-23, fase 22). Colgaba de att_actividad_tickets.
   Reemplazada por att_actividad_entradas. Vacia; pendiente de drop.';

NOTIFY pgrst, 'reload schema';

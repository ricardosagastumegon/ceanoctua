-- Phase 19-1 · Schema completo T&T para paridad total con TT_modulo.html
--
-- Objetivo: agregar las 17 tablas nuevas y las columnas faltantes a att_viajes
-- para soportar los 14 servicios del módulo standalone + workflow manual +
-- itinerario por días + notas del día.
--
-- Regla 0 aplicada a TODAS las tablas nuevas:
--   - PK uuid, viaje_id (o parent_id) references con on delete cascade
--   - AuditCols completos: created_at, updated_at, created_by, updated_by, deleted_at
--   - Índice compuesto (parent_id) where deleted_at is null
--   - Trigger audit_trigger (audit_log)
--   - Trigger set_updated_at_with_by (updated_at + updated_by)
--   - RLS Pattern A (Financial): admin + asistente rw
--
-- Simplificaciones vs plan original:
--   - renta.extras y poi.puntos → JSONB [{label,amount}] / [{nombre,descripcion}]
--   - Sin *_pay_records por servicio nuevo (matches HTML: sólo cols escalares)
--   - Sync reunión → day_plan_rows queda en React Query, no en trigger SQL
--
-- Idempotente: create table if not exists + drop trigger if exists → create.
--
-- Aplicar en Supabase Studio SQL Editor manualmente.

BEGIN;

-- ============================================================
-- 1) att_viajes: campos nuevos (trip_no + manual_status)
-- ============================================================
alter table public.att_viajes
  add column if not exists trip_no text unique,
  add column if not exists manual_status text
    check (manual_status in ('Solicitado','En planeación','En curso','Finalizado'))
    default 'Solicitado';

create index if not exists att_viajes_trip_no_idx on public.att_viajes(trip_no);
create index if not exists att_viajes_manual_status_idx on public.att_viajes(manual_status) where deleted_at is null;

-- Sequence para correlativo TT-YYYY-####
create sequence if not exists public.att_viaje_seq start 1;

-- Trigger que asigna trip_no automáticamente si no viene set
create or replace function public.att_viaje_generate_no()
returns trigger
language plpgsql as $$
begin
  if new.trip_no is null or new.trip_no = '' then
    new.trip_no := 'TT-' || to_char(coalesce(new.created_at, now()), 'YYYY') || '-' ||
                   lpad(nextval('public.att_viaje_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists att_viaje_gen_no_trg on public.att_viajes;
create trigger att_viaje_gen_no_trg
  before insert on public.att_viajes
  for each row execute function public.att_viaje_generate_no();

-- ============================================================
-- 2) att_hotel_habitaciones — habitaciones múltiples por hotel
-- ============================================================
create table if not exists public.att_hotel_habitaciones (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.att_hoteles(id) on delete cascade,
  reserva_nombre text,
  pax integer,
  tipo_hab text,
  desayuno text,
  tarifa numeric(12,2),
  noches integer,
  orden integer default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);

-- ============================================================
-- 3) att_rentas — renta de vehículos
-- ============================================================
create table if not exists public.att_rentas (
  id uuid primary key default gen_random_uuid(),
  viaje_id uuid not null references public.att_viajes(id) on delete cascade,
  nombre text not null,
  ciudad text,
  direccion text,
  telefono text,
  tipo_veh text,
  desc_veh text,
  reservado text,
  reserva_nombre text,
  confirmacion text,
  recepcion_fecha date,
  recepcion_hora time,
  recepcion_dir text,
  entrega_fecha date,
  entrega_hora time,
  entrega_dir text,
  dias integer,
  tarifa numeric(12,2),
  deposito numeric(12,2),
  extras jsonb not null default '[]'::jsonb,
  cancelacion text,
  estatus_pago text,
  estado_pago text not null default 'Reservado'
    check (estado_pago in ('Reservado','Pagado','Pago parcial','A pagar en propiedad','Cancelado')),
  pagado_con text,
  confirm_file_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);

-- ============================================================
-- 4) att_tours
-- ============================================================
create table if not exists public.att_tours (
  id uuid primary key default gen_random_uuid(),
  viaje_id uuid not null references public.att_viajes(id) on delete cascade,
  prestador text not null,
  ciudad text,
  direccion text,
  telefono text,
  tipo_servicio text,
  descripcion text,
  reservado text,
  reserva_nombre text,
  confirmacion text,
  fecha date,
  hora time,
  inclusiones text,
  personas integer,
  dias integer,
  duracion text,
  tarifa numeric(12,2),
  cancelacion text,
  estatus_pago text,
  estado_pago text not null default 'Reservado'
    check (estado_pago in ('Reservado','Pagado','Pago parcial','A pagar en propiedad','Cancelado')),
  pagado_con text,
  confirm_file_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);

-- ============================================================
-- 5) att_aeronaves — renta de aeronave privada
-- ============================================================
create table if not exists public.att_aeronaves (
  id uuid primary key default gen_random_uuid(),
  viaje_id uuid not null references public.att_viajes(id) on delete cascade,
  prestador text not null,
  ciudad text,
  direccion text,
  telefono text,
  tipo_aeronave text,
  capacidad text,
  tipo_servicio text,
  descripcion text,
  reservado text,
  reserva_nombre text,
  confirmacion text,
  origen text,
  destino text,
  fecha date,
  hora time,
  inclusiones text,
  tarifa numeric(12,2),
  extras text,
  monto_extras numeric(12,2),
  cancelacion text,
  estatus_pago text,
  estado_pago text not null default 'Reservado'
    check (estado_pago in ('Reservado','Pagado','Pago parcial','A pagar en propiedad','Cancelado')),
  pagado_con text,
  confirm_file_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);

-- ============================================================
-- 6) att_acuaticos — traslado acuático (con OW/RT)
-- ============================================================
create table if not exists public.att_acuaticos (
  id uuid primary key default gen_random_uuid(),
  viaje_id uuid not null references public.att_viajes(id) on delete cascade,
  prestador text not null,
  ciudad text,
  direccion text,
  telefono text,
  tipo_embarcacion text,
  capacidad text,
  tipo_servicio text check (tipo_servicio in ('Privada','Colectiva','Otro') or tipo_servicio is null),
  tipo_servicio_otro text,
  descripcion text,
  reservado text,
  reserva_nombre text,
  confirmacion text,
  tipo text not null default 'OW' check (tipo in ('OW','RT')),
  fecha date,
  origen text,
  destino text,
  etd time,
  eta time,
  ret_fecha date,
  ret_origen text,
  ret_destino text,
  ret_etd time,
  ret_eta time,
  inclusiones text,
  tarifa numeric(12,2),
  extras text,
  monto_extras numeric(12,2),
  cancelacion text,
  estatus_pago text,
  estado_pago text not null default 'Reservado'
    check (estado_pago in ('Reservado','Pagado','Pago parcial','A pagar en propiedad','Cancelado')),
  pagado_con text,
  confirm_file_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);

-- ============================================================
-- 7) att_ferries (con OW/RT + servicio_para Personas/Vehículos)
-- ============================================================
create table if not exists public.att_ferries (
  id uuid primary key default gen_random_uuid(),
  viaje_id uuid not null references public.att_viajes(id) on delete cascade,
  prestador text not null,
  ciudad text,
  direccion text,
  telefono text,
  tipo_embarcacion text,
  servicio_para text default 'Personas' check (servicio_para in ('Personas','Vehículos')),
  tipo_servicio text check (tipo_servicio in ('Privada','Colectiva','Otro') or tipo_servicio is null),
  tipo_servicio_otro text,
  descripcion text,
  reservado text,
  reserva_nombre text,
  confirmacion text,
  tipo text not null default 'OW' check (tipo in ('OW','RT')),
  fecha date,
  origen text,
  destino text,
  etd time,
  eta time,
  ret_fecha date,
  ret_origen text,
  ret_destino text,
  ret_etd time,
  ret_eta time,
  inclusiones text,
  tarifa numeric(12,2),
  extras text,
  monto_extras numeric(12,2),
  cancelacion text,
  estatus_pago text,
  estado_pago text not null default 'Reservado'
    check (estado_pago in ('Reservado','Pagado','Pago parcial','A pagar en propiedad','Cancelado')),
  pagado_con text,
  confirm_file_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);

-- ============================================================
-- 8) att_terrestres — traslado terrestre (con OW/RT)
-- ============================================================
create table if not exists public.att_terrestres (
  id uuid primary key default gen_random_uuid(),
  viaje_id uuid not null references public.att_viajes(id) on delete cascade,
  prestador text not null,
  ciudad text,
  direccion text,
  telefono text,
  tipo_veh text,
  tipo_servicio text check (tipo_servicio in ('Privada','Colectiva','Otro') or tipo_servicio is null),
  tipo_servicio_otro text,
  reservado text,
  reserva_nombre text,
  personas integer,
  confirmacion text,
  tipo text not null default 'OW' check (tipo in ('OW','RT')),
  fecha date,
  origen text,
  destino text,
  etd time,
  eta time,
  ret_fecha date,
  ret_origen text,
  ret_destino text,
  ret_etd time,
  ret_eta time,
  inclusiones text,
  tarifa numeric(12,2),
  extras text,
  monto_extras numeric(12,2),
  cancelacion text,
  estatus_pago text,
  estado_pago text not null default 'Reservado'
    check (estado_pago in ('Reservado','Pagado','Pago parcial','A pagar en propiedad','Cancelado')),
  pagado_con text,
  confirm_file_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);

-- ============================================================
-- 9) att_tiendas — sin costo, sin pagado_con
-- ============================================================
create table if not exists public.att_tiendas (
  id uuid primary key default gen_random_uuid(),
  viaje_id uuid not null references public.att_viajes(id) on delete cascade,
  nombre text not null,
  ciudad text,
  direccion text,
  telefono text,
  apertura time,
  cierre time,
  detalle text,
  confirm_file_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);

-- ============================================================
-- 10) att_actividades — parent de tickets de actividad
-- ============================================================
create table if not exists public.att_actividades (
  id uuid primary key default gen_random_uuid(),
  viaje_id uuid not null references public.att_viajes(id) on delete cascade,
  evento text not null,
  ciudad text,
  direccion text,
  descripcion text,
  duracion text,
  fecha date,
  inicio time,
  fin time,
  reservado text,
  cancelacion text,
  comentarios text,
  estatus_pago text,
  estado_pago text not null default 'Reservado'
    check (estado_pago in ('Reservado','Pagado','Pago parcial','A pagar en propiedad','Cancelado')),
  pagado_con text,
  confirm_file_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);

-- ============================================================
-- 11) att_actividad_tickets — tickets múltiples por actividad
-- ============================================================
create table if not exists public.att_actividad_tickets (
  id uuid primary key default gen_random_uuid(),
  actividad_id uuid not null references public.att_actividades(id) on delete cascade,
  nombres text,
  personas integer,
  confirmacion text,
  lugares text,
  tarifa numeric(12,2),
  extras text,
  monto_extras numeric(12,2),
  tiene_subtickets boolean not null default false,
  orden integer default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);

-- ============================================================
-- 12) att_actividad_subtickets — sub-tickets individuales
-- ============================================================
create table if not exists public.att_actividad_subtickets (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.att_actividad_tickets(id) on delete cascade,
  nombre text,
  ticket text,
  lugar text,
  orden integer default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);

-- ============================================================
-- 13) att_reuniones — sin costo, sync a day_plan_rows desde React Query
-- ============================================================
create table if not exists public.att_reuniones (
  id uuid primary key default gen_random_uuid(),
  viaje_id uuid not null references public.att_viajes(id) on delete cascade,
  cita text not null,
  asunto text,
  fecha date not null,
  hora time not null,
  participantes text,
  ciudad text,
  direccion text,
  confirm_file_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);

-- ============================================================
-- 14) att_rutas — link + descripción de ruta en Google Maps
-- ============================================================
create table if not exists public.att_rutas (
  id uuid primary key default gen_random_uuid(),
  viaje_id uuid not null references public.att_viajes(id) on delete cascade,
  nombre text not null,
  fecha date,
  descripcion text,
  link text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);

-- ============================================================
-- 15) att_pois — puntos de interés (puntos como JSONB)
-- ============================================================
create table if not exists public.att_pois (
  id uuid primary key default gen_random_uuid(),
  viaje_id uuid not null references public.att_viajes(id) on delete cascade,
  titulo text not null,
  ciudad text,
  puntos jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);

-- ============================================================
-- 16) att_day_plans — itinerario específico del día (parent)
-- ============================================================
create table if not exists public.att_day_plans (
  id uuid primary key default gen_random_uuid(),
  viaje_id uuid not null references public.att_viajes(id) on delete cascade,
  dia text,
  fecha date not null,
  lugar text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  unique (viaje_id, fecha) deferrable initially deferred
);

-- ============================================================
-- 17) att_day_plan_rows — filas Horario|Itinerario de un day_plan
-- ============================================================
create table if not exists public.att_day_plan_rows (
  id uuid primary key default gen_random_uuid(),
  day_plan_id uuid not null references public.att_day_plans(id) on delete cascade,
  horario time,
  itinerario text,
  orden integer default 0,
  reunion_id uuid references public.att_reuniones(id) on delete set null,
  es_auto_reunion boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz
);

-- ============================================================
-- 18) att_day_notes — nota corta para pasajeros por día
-- ============================================================
create table if not exists public.att_day_notes (
  id uuid primary key default gen_random_uuid(),
  viaje_id uuid not null references public.att_viajes(id) on delete cascade,
  fecha date not null,
  texto text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  deleted_at timestamptz,
  unique (viaje_id, fecha) deferrable initially deferred
);

-- ============================================================
-- Índices compuestos (parent_id) where deleted_at is null
-- ============================================================
create index if not exists att_hotel_habitaciones_hotel_id_idx on public.att_hotel_habitaciones(hotel_id) where deleted_at is null;
create index if not exists att_rentas_viaje_id_idx on public.att_rentas(viaje_id) where deleted_at is null;
create index if not exists att_tours_viaje_id_idx on public.att_tours(viaje_id) where deleted_at is null;
create index if not exists att_aeronaves_viaje_id_idx on public.att_aeronaves(viaje_id) where deleted_at is null;
create index if not exists att_acuaticos_viaje_id_idx on public.att_acuaticos(viaje_id) where deleted_at is null;
create index if not exists att_ferries_viaje_id_idx on public.att_ferries(viaje_id) where deleted_at is null;
create index if not exists att_terrestres_viaje_id_idx on public.att_terrestres(viaje_id) where deleted_at is null;
create index if not exists att_tiendas_viaje_id_idx on public.att_tiendas(viaje_id) where deleted_at is null;
create index if not exists att_actividades_viaje_id_idx on public.att_actividades(viaje_id) where deleted_at is null;
create index if not exists att_actividad_tickets_actividad_id_idx on public.att_actividad_tickets(actividad_id) where deleted_at is null;
create index if not exists att_actividad_subtickets_ticket_id_idx on public.att_actividad_subtickets(ticket_id) where deleted_at is null;
create index if not exists att_reuniones_viaje_id_idx on public.att_reuniones(viaje_id) where deleted_at is null;
create index if not exists att_reuniones_fecha_idx on public.att_reuniones(viaje_id, fecha) where deleted_at is null;
create index if not exists att_rutas_viaje_id_idx on public.att_rutas(viaje_id) where deleted_at is null;
create index if not exists att_pois_viaje_id_idx on public.att_pois(viaje_id) where deleted_at is null;
create index if not exists att_day_plans_viaje_id_idx on public.att_day_plans(viaje_id) where deleted_at is null;
create index if not exists att_day_plan_rows_day_plan_id_idx on public.att_day_plan_rows(day_plan_id) where deleted_at is null;
create index if not exists att_day_notes_viaje_id_idx on public.att_day_notes(viaje_id) where deleted_at is null;

-- ============================================================
-- Triggers: set_updated_at_with_by + audit_trigger + RLS Pattern A
-- Todas las tablas nuevas tienen updated_at Y updated_by, por eso
-- se usa el trigger with_by (fase 4 · 20260524000002_created_updated_by.sql).
-- ============================================================
do $$
declare
  t text;
  new_tables text[] := array[
    'att_hotel_habitaciones',
    'att_rentas',
    'att_tours',
    'att_aeronaves',
    'att_acuaticos',
    'att_ferries',
    'att_terrestres',
    'att_tiendas',
    'att_actividades',
    'att_actividad_tickets',
    'att_actividad_subtickets',
    'att_reuniones',
    'att_rutas',
    'att_pois',
    'att_day_plans',
    'att_day_plan_rows',
    'att_day_notes'
  ];
begin
  if not exists (select 1 from pg_proc where proname = 'audit_trigger') then
    raise exception 'audit_trigger() no existe — falta correr la migración fase 3';
  end if;
  if not exists (select 1 from pg_proc where proname = 'set_updated_at_with_by') then
    raise exception 'set_updated_at_with_by() no existe — falta correr la migración fase 4 (20260524000002)';
  end if;
  if not exists (select 1 from pg_proc where proname = 'auth_rol') then
    raise exception 'public.auth_rol() no existe — falta correr la migración fase 3';
  end if;

  foreach t in array new_tables loop
    -- RLS enabled
    execute format('alter table public.%I enable row level security', t);

    -- Policy READ (Pattern A)
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format(
      'create policy %I on public.%I for select using (public.auth_rol() in (''admin'',''asistente''))',
      t || '_read', t
    );

    -- Policy WRITE (Pattern A)
    execute format('drop policy if exists %I on public.%I', t || '_write', t);
    execute format(
      'create policy %I on public.%I for all
         using (public.auth_rol() in (''admin'',''asistente''))
         with check (public.auth_rol() in (''admin'',''asistente''))',
      t || '_write', t
    );

    -- Trigger: set_updated_at_with_by (stamps updated_at + updated_by)
    execute format('drop trigger if exists %I on public.%I', t || '_updated_at_trg', t);
    execute format(
      'create trigger %I before update on public.%I
         for each row execute function public.set_updated_at_with_by()',
      t || '_updated_at_trg', t
    );

    -- Trigger: audit_log
    execute format('drop trigger if exists %I on public.%I', 'audit_' || t, t);
    execute format(
      'create trigger %I after insert or update or delete on public.%I
         for each row execute function public.audit_trigger()',
      'audit_' || t, t
    );
  end loop;
end $$;

COMMIT;

-- Invariante 2 de CLAUDE.md §4: forzar reload del schema cache
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- Verificación post-migración (correr en SQL Editor tras el Run)
-- ============================================================
--
-- 1) Verificar que las 17 tablas nuevas se crearon:
--    select tablename from pg_tables
--     where schemaname='public'
--       and tablename in (
--         'att_hotel_habitaciones','att_rentas','att_tours','att_aeronaves',
--         'att_acuaticos','att_ferries','att_terrestres','att_tiendas',
--         'att_actividades','att_actividad_tickets','att_actividad_subtickets',
--         'att_reuniones','att_rutas','att_pois',
--         'att_day_plans','att_day_plan_rows','att_day_notes'
--       )
--     order by tablename;
--    -- esperado: 17 filas
--
-- 2) Verificar RLS Pattern A (17 tablas × 2 policies = 34 filas):
--    select tablename, policyname, cmd from pg_policies
--     where schemaname='public'
--       and tablename in (
--         'att_hotel_habitaciones','att_rentas','att_tours','att_aeronaves',
--         'att_acuaticos','att_ferries','att_terrestres','att_tiendas',
--         'att_actividades','att_actividad_tickets','att_actividad_subtickets',
--         'att_reuniones','att_rutas','att_pois',
--         'att_day_plans','att_day_plan_rows','att_day_notes'
--       )
--     order by tablename, policyname;
--
-- 3) Verificar triggers audit_ + set_updated_at_with_by (17 × 2 = 34):
--    select tgname, tgrelid::regclass as tabla
--      from pg_trigger
--     where tgrelid::regclass::text in (
--       'att_hotel_habitaciones','att_rentas','att_tours','att_aeronaves',
--       'att_acuaticos','att_ferries','att_terrestres','att_tiendas',
--       'att_actividades','att_actividad_tickets','att_actividad_subtickets',
--       'att_reuniones','att_rutas','att_pois',
--       'att_day_plans','att_day_plan_rows','att_day_notes'
--     )
--       and not tgisinternal
--     order by tabla, tgname;
--
-- 4) Verificar trip_no + manual_status en att_viajes:
--    select column_name, data_type, column_default from information_schema.columns
--     where table_schema='public' and table_name='att_viajes'
--       and column_name in ('trip_no','manual_status')
--     order by column_name;
--
-- 5) Verificar sequence:
--    select sequencename, last_value from pg_sequences
--     where schemaname='public' and sequencename='att_viaje_seq';
--
-- 6) Prueba real:
--    insert into public.att_viajes (titulo, estado) values ('test-trip-no', 'planificado')
--      returning id, trip_no, manual_status;
--    -- esperado: trip_no auto-generado tipo 'TT-2026-0001', manual_status='Solicitado'
--    delete from public.att_viajes where titulo='test-trip-no';

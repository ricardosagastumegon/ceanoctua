-- ============================================================
-- Board Assistant v2 - All migrations consolidated
-- Apply once on a fresh Supabase project, in order.
-- Project: bbxieuyhzxqygkkxwvwo.supabase.co
-- ============================================================


-- ============================================================
-- supabase/migrations/20260523000001_extensions_enums_helpers.sql
-- ============================================================
-- Phase 2 - Migration 0001
-- Extensions, enums, sequences and helper functions.

-- Extensions ---------------------------------------------------------------
create extension if not exists pgcrypto;

-- Enums --------------------------------------------------------------------
-- Defined in PLAN-FASE-2.md
create type currency         as enum ('USD','GTQ','EUR','GBP');
create type reintegro_status as enum ('generada','firmada','presentada','procesada','reintegrada');
create type tc_tipo          as enum ('corporativa','presidencia');

-- The following enums are placeholders. PLAN-FASE-2.md instructs to confirm
-- the exact values against reference/board-assistant-actual.html. Adjust the
-- values below (or add migrations that ALTER TYPE ... ADD VALUE) once the HTML
-- is available.
create type task_priority   as enum ('baja','media','alta');
create type task_status     as enum ('pendiente','en_progreso','completada','cancelada');
create type trip_status     as enum ('planificado','en_curso','completado','cancelado');
create type trip_type       as enum ('personal','trabajo','familia','salud','otro');
create type vale_status     as enum ('Creado','Aprobado','Liquidado','Anulado');
create type firma_status    as enum ('pendiente','firmado','presentado','procesado');
create type pago_tipo       as enum ('transferencia','cheque','efectivo','tarjeta','otro');
create type evento_tipo     as enum ('reunion','cumpleanos','aniversario','viaje','religioso','otro');

-- Sequences for human-readable serials ------------------------------------
create sequence if not exists seq_voucher    start with 1;
create sequence if not exists seq_cc_vale    start with 1;
create sequence if not exists seq_miel_corr  start with 1;

-- Helper: set updated_at automatically on UPDATE --------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ============================================================
-- supabase/migrations/20260523000002_identity.sql
-- ============================================================
-- Phase 2 - Migration 0002
-- Identity & organisation tables.
-- Tables whose exact shape was not in PLAN-FASE-2.md are noted with
-- "ajustar contra el HTML"; review fields once the HTML is available.

-- Miembros del board -------------------------------------------------------
create table miembros_board (
  id          uuid primary key default gen_random_uuid(),
  codigo      text unique not null,                -- 'MAA','JA','LA',...
  nombre      text not null,
  rol         text,
  color       text,
  orden       int,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid,
  updated_by  uuid
);

-- Empleados (adminDB.empleados) -- ajustar contra el HTML
create table empleados (
  id          uuid primary key default gen_random_uuid(),
  legacy_id   bigint unique,
  nombre      text not null,
  puesto      text,
  departamento text,
  empresa     text,
  email       text,
  telefono    text,
  notas       text,
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid,
  updated_by  uuid
);

-- Entidades (adminDB.entidades) -- ajustar contra el HTML
create table entidades (
  id          uuid primary key default gen_random_uuid(),
  legacy_id   bigint unique,
  nombre      text not null,
  nit         text,
  direccion   text,
  contacto    text,
  telefono    text,
  email       text,
  notas       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid,
  updated_by  uuid
);

-- Autorizadores (adminDB.autorizadores) -- ajustar contra el HTML
create table autorizadores (
  id          uuid primary key default gen_random_uuid(),
  legacy_id   bigint unique,
  nombre      text not null,
  cargo       text,
  empresa     text,
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Tipos de pago (adminDB.tipospago) -- ajustar contra el HTML
create table tipos_pago (
  id          uuid primary key default gen_random_uuid(),
  legacy_id   bigint unique,
  nombre      text not null,                       -- 'transferencia','cheque',...
  descripcion text,
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Proveedores (fusion: aceProveedores + adminDB.proveedores)
create table proveedores (
  id          uuid primary key default gen_random_uuid(),
  legacy_id   bigint unique,
  origen      text,                                -- 'ace' | 'admin'
  nombre      text not null,
  nit         text,
  contacto    text,
  telefono    text,
  email       text,
  direccion   text,
  rubro       text,
  notas       text,
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid,
  updated_by  uuid
);

-- Tarjetas de credito (fusion: tccorp + tcpres)
create table tarjetas_credito (
  id          uuid primary key default gen_random_uuid(),
  legacy_id   bigint unique,
  tipo        tc_tipo not null,                    -- 'corporativa' | 'presidencia'
  tc_id       text not null,                       -- terminacion / identificador
  empresa     text,
  titular     text,
  red         text,                                -- VISA / Mastercard / Amex
  banco       text,
  nit         text,
  limite      text,
  direccion   text,
  notas       text,
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid,
  updated_by  uuid
);
create index tarjetas_credito_tipo_idx on tarjetas_credito (tipo);


-- ============================================================
-- supabase/migrations/20260523000003_agenda.sql
-- ============================================================
-- Phase 2 - Migration 0003
-- Tasks, trips, events, notes, profiles, kit, religious event.

-- Tareas (state.tasks) ----------------------------------------------------
create table tareas (
  id          uuid primary key default gen_random_uuid(),
  legacy_id   bigint unique,
  miembro_id  uuid references miembros_board(id),
  lista       text,                                -- 'gifts','home','kids',...
  texto       text not null,                       -- 'subject' en el original
  fecha       date,
  prioridad   task_priority,
  estado      task_status not null default 'pendiente',
  notas       text,
  done        boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid,
  updated_by  uuid
);
create index tareas_miembro_idx on tareas (miembro_id);
create index tareas_estado_idx  on tareas (estado);

-- Viajes (state.trips) + checklist ----------------------------------------
create table viajes (
  id          uuid primary key default gen_random_uuid(),
  legacy_id   bigint unique,
  miembro_id  uuid references miembros_board(id),
  destino     text not null,
  fecha_ini   date,
  fecha_fin   date,
  tipo        trip_type,
  estado      trip_status not null default 'planificado',
  notas       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid,
  updated_by  uuid
);
create index viajes_miembro_idx on viajes (miembro_id);

create table viaje_checklist (
  id          uuid primary key default gen_random_uuid(),
  legacy_id   bigint unique,
  viaje_id    uuid not null references viajes(id) on delete cascade,
  item        text not null,
  done        boolean not null default false,
  orden       int,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index viaje_checklist_viaje_idx on viaje_checklist (viaje_id);

-- Eventos (fusion: laevents + maaevents) -- ajustar contra el HTML --------
create table eventos (
  id          uuid primary key default gen_random_uuid(),
  legacy_id   bigint unique,
  origen      text,                                -- 'la' | 'maa'
  miembro_id  uuid references miembros_board(id),
  titulo      text not null,
  tipo        evento_tipo,
  fecha       timestamptz,
  lugar       text,
  descripcion text,
  notas       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid,
  updated_by  uuid
);
create index eventos_miembro_idx on eventos (miembro_id);
create index eventos_fecha_idx   on eventos (fecha);

-- Notas (fusion: state.notes + state.maanotes) ----------------------------
create table notas (
  id          uuid primary key default gen_random_uuid(),
  legacy_id   bigint unique,
  origen      text,                                -- 'board' | 'maa' | ...
  miembro_id  uuid references miembros_board(id),
  titulo      text,
  contenido   text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid,
  updated_by  uuid
);

-- Perfiles (state.profiles) + sub-tablas -- ajustar contra el HTML --------
create table perfiles (
  id            uuid primary key default gen_random_uuid(),
  legacy_id     bigint unique,
  miembro_id    uuid references miembros_board(id),
  nombre        text not null,
  alias         text,
  parentesco    text,
  fecha_nac     date,
  notas         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid,
  updated_by    uuid
);
create index perfiles_miembro_idx on perfiles (miembro_id);

create table perfil_vehiculos (
  id          uuid primary key default gen_random_uuid(),
  legacy_id   bigint unique,
  perfil_id   uuid not null references perfiles(id) on delete cascade,
  marca       text,
  modelo      text,
  anio        int,
  placa       text,
  color       text,
  vin         text,
  notas       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table perfil_familia (
  id          uuid primary key default gen_random_uuid(),
  legacy_id   bigint unique,
  perfil_id   uuid not null references perfiles(id) on delete cascade,
  nombre      text not null,
  relacion    text,
  fecha_nac   date,
  notas       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table perfil_fechas (
  id          uuid primary key default gen_random_uuid(),
  legacy_id   bigint unique,
  perfil_id   uuid not null references perfiles(id) on delete cascade,
  titulo      text not null,
  fecha       date not null,
  recurrente  boolean not null default true,
  notas       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Kit (state.kit) ----------------------------------------------------------
create table kit_items (
  id          uuid primary key default gen_random_uuid(),
  legacy_id   bigint unique,
  miembro_id  uuid references miembros_board(id),
  nombre      text not null,
  categoria   text,
  cantidad    int,
  notas       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Evento religioso (state.relEvent) --------------------------------------
-- Registro unico; protegido con check sobre la columna singleton.
create table evento_religioso (
  singleton   boolean primary key default true,
  titulo      text,
  fecha       timestamptz,
  lugar       text,
  notas       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint evento_religioso_one_row check (singleton)
);


-- ============================================================
-- supabase/migrations/20260523000004_finance.sql
-- ============================================================
-- Phase 2 - Migration 0004
-- Finance: TC consumos, reintegros, caja chica, pagos, vouchers.
-- Note: tc_consumos and reintegros reference each other. Tables are created
-- first without the cross-reference, then both FKs are added at the end.

-- TC consumos (fusion: maatc + latc + aceConsumos) ------------------------
create table tc_consumos (
  id            uuid primary key default gen_random_uuid(),
  legacy_id     bigint unique,
  origen        text,                              -- 'maa' | 'la' | 'ace'
  voucher_num   text,                              -- 'VCH-0001' (de seq_voucher)
  fecha         date not null,
  empresa       text,
  card_id       text not null,
  tarjeta_id    uuid references tarjetas_credito(id),
  proveedor     text not null,                     -- 'supplier'
  proveedor_id  uuid references proveedores(id),
  concepto      text not null,
  monto         numeric(14,2) not null,
  moneda        currency not null,
  autorizo      text,
  autorizador_id uuid references autorizadores(id),
  reintegro_id  uuid,                              -- FK agregada al final
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid,
  updated_by    uuid
);
create index tc_consumos_fecha_idx     on tc_consumos (fecha);
create index tc_consumos_card_idx      on tc_consumos (card_id);
create index tc_consumos_origen_idx    on tc_consumos (origen);
create index tc_consumos_proveedor_idx on tc_consumos (proveedor_id);
create index tc_consumos_active_idx    on tc_consumos (deleted_at) where deleted_at is null;

-- Reintegros (fusion: larei + reintegros de ACE) --------------------------
create table reintegros (
  id            uuid primary key default gen_random_uuid(),
  legacy_id     bigint unique,
  fecha         date not null,
  empresa       text not null,
  tc_empresa    text,
  card_id       text not null,
  consumo_id    uuid references tc_consumos(id),  -- ex 'linkedId'
  monto         numeric(14,2) not null,
  moneda        currency not null,
  autorizo      text,
  autorizador_id uuid references autorizadores(id),
  notas         text,
  estado        reintegro_status not null default 'generada',
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid,
  updated_by    uuid
);
create index reintegros_fecha_idx   on reintegros (fecha);
create index reintegros_consumo_idx on reintegros (consumo_id);
create index reintegros_estado_idx  on reintegros (estado);
create index reintegros_active_idx  on reintegros (deleted_at) where deleted_at is null;

-- Close the cycle: tc_consumos.reintegro_id -> reintegros(id)
alter table tc_consumos
  add constraint tc_consumos_reintegro_fk
  foreign key (reintegro_id) references reintegros(id);

-- Caja chica - vales (ccVales) -------------------------------------------
create table caja_chica_vales (
  id          uuid primary key default gen_random_uuid(),
  legacy_id   bigint unique,
  serial      text unique,                         -- 'CC-0001' (de seq_cc_vale)
  fecha       date,
  moneda      currency not null default 'GTQ',
  monto       numeric(14,2) not null,
  vale_a      text not null,                       -- 'valeA'
  empleado_id uuid references empleados(id),
  entidad     text,
  entidad_id  uuid references entidades(id),
  concepto    text,
  lugar       text,
  estado      vale_status not null default 'Creado',
  notas       text,
  deleted_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid,
  updated_by  uuid
);
create index caja_chica_vales_estado_idx on caja_chica_vales (estado);
create index caja_chica_vales_active_idx on caja_chica_vales (deleted_at) where deleted_at is null;

-- Caja chica - liquidaciones (ccLiq) -- ajustar contra el HTML ------------
create table caja_chica_liquidaciones (
  id          uuid primary key default gen_random_uuid(),
  legacy_id   bigint unique,
  fecha       date not null,
  periodo     text,                                -- ej. '2026-05'
  moneda      currency not null default 'GTQ',
  monto_total numeric(14,2) not null default 0,
  responsable text,
  empleado_id uuid references empleados(id),
  notas       text,
  estado      text not null default 'Creada',
  deleted_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid,
  updated_by  uuid
);

-- Pagos (acePagos) -- ajustar contra el HTML ------------------------------
create table pagos (
  id            uuid primary key default gen_random_uuid(),
  legacy_id     bigint unique,
  fecha         date not null,
  proveedor     text,
  proveedor_id  uuid references proveedores(id),
  concepto      text,
  monto         numeric(14,2) not null,
  moneda        currency not null default 'GTQ',
  tipo          pago_tipo not null default 'transferencia',
  referencia    text,                              -- num cheque / transf
  banco         text,
  autorizo      text,
  autorizador_id uuid references autorizadores(id),
  notas         text,
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid,
  updated_by    uuid
);
create index pagos_fecha_idx     on pagos (fecha);
create index pagos_proveedor_idx on pagos (proveedor_id);

-- Vouchers (aceVouchers) -- ajustar contra el HTML -----------------------
create table vouchers (
  id            uuid primary key default gen_random_uuid(),
  legacy_id     bigint unique,
  serial        text unique,                       -- 'VCH-0001' (de seq_voucher)
  fecha         date not null,
  consumo_id    uuid references tc_consumos(id),
  concepto      text,
  monto         numeric(14,2),
  moneda        currency,
  estado        text,
  notas         text,
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid,
  updated_by    uuid
);
create index vouchers_consumo_idx on vouchers (consumo_id);


-- ============================================================
-- supabase/migrations/20260523000005_cea.sql
-- ============================================================
-- Phase 2 - Migration 0005
-- CEA operations: todos, firmas, lavanderia, directorio.
-- Shapes inferred from PLAN-FASE-2.md; ajustar contra el HTML.

create table cea_todos (
  id          uuid primary key default gen_random_uuid(),
  legacy_id   bigint unique,
  texto       text not null,
  responsable text,
  empleado_id uuid references empleados(id),
  fecha_lim   date,
  prioridad   task_priority,
  estado      task_status not null default 'pendiente',
  done        boolean not null default false,
  notas       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid,
  updated_by  uuid
);
create index cea_todos_estado_idx on cea_todos (estado);

create table firmas (
  id            uuid primary key default gen_random_uuid(),
  legacy_id     bigint unique,
  fecha         date not null,
  documento     text,                              -- titulo/descripcion del doc
  empresa       text,
  consumo_id    uuid references tc_consumos(id),   -- ex 'linkedConsumo' / 'linkedFirmas'
  reintegro_id  uuid references reintegros(id),
  estado        firma_status not null default 'pendiente',
  notas         text,
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid,
  updated_by    uuid
);
create index firmas_estado_idx   on firmas (estado);
create index firmas_consumo_idx  on firmas (consumo_id);

create table lavanderia (
  id          uuid primary key default gen_random_uuid(),
  legacy_id   bigint unique,
  fecha       date not null,
  prenda      text not null,
  cantidad    int,
  proveedor   text,
  proveedor_id uuid references proveedores(id),
  monto       numeric(14,2),
  moneda      currency default 'GTQ',
  estado      text,                                -- 'enviado','recibido','pagado',...
  notas       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid,
  updated_by  uuid
);

create table cea_directorio (
  id          uuid primary key default gen_random_uuid(),
  legacy_id   bigint unique,
  nombre      text not null,
  cargo       text,
  empresa     text,
  telefono    text,
  email       text,
  direccion   text,
  notas       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid,
  updated_by  uuid
);


-- ============================================================
-- supabase/migrations/20260523000006_miel_sj.sql
-- ============================================================
-- Phase 2 - Migration 0006
-- Miel SJ: constancias.
-- Shape inferred from PLAN-FASE-2.md; ajustar contra el HTML.

create table miel_constancias (
  id            uuid primary key default gen_random_uuid(),
  legacy_id     bigint unique,
  correlativo   text unique,                       -- 'MSJ-0001' (de seq_miel_corr)
  fecha         date not null,
  cliente       text not null,
  nit           text,
  direccion     text,
  producto      text,
  presentacion  text,
  cantidad      numeric(12,3),
  unidad        text,
  precio_unit   numeric(14,2),
  monto_total   numeric(14,2),
  moneda        currency not null default 'GTQ',
  notas         text,
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid,
  updated_by    uuid
);
create index miel_constancias_fecha_idx on miel_constancias (fecha);


-- ============================================================
-- supabase/migrations/20260523000007_arriaza.sql
-- ============================================================
-- Phase 2 - Migration 0007
-- Arriaza T&T: viajes y sub-tablas + pines del mapa.
-- Shapes inferred from PLAN-FASE-2.md; ajustar contra el HTML.

create table att_viajes (
  id            uuid primary key default gen_random_uuid(),
  legacy_id     bigint unique,
  miembro_id    uuid references miembros_board(id),
  titulo        text not null,
  destino       text,
  pais          text,
  ciudad        text,
  fecha_ini     date,
  fecha_fin     date,
  estado        trip_status not null default 'planificado',
  proposito     text,
  acompanantes  text,
  notas         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid,
  updated_by    uuid
);
create index att_viajes_miembro_idx on att_viajes (miembro_id);

create table att_tickets (
  id              uuid primary key default gen_random_uuid(),
  legacy_id       bigint unique,
  viaje_id        uuid not null references att_viajes(id) on delete cascade,
  aerolinea       text,
  codigo_reserva  text,
  numero_ticket   text,
  origen          text,
  destino         text,
  fecha_salida    timestamptz,
  fecha_llegada   timestamptz,
  asiento         text,
  clase           text,
  monto           numeric(14,2),
  moneda          currency,
  notas           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index att_tickets_viaje_idx on att_tickets (viaje_id);

create table att_hoteles (
  id          uuid primary key default gen_random_uuid(),
  legacy_id   bigint unique,
  viaje_id    uuid not null references att_viajes(id) on delete cascade,
  nombre      text not null,
  direccion   text,
  ciudad      text,
  pais        text,
  checkin     date,
  checkout    date,
  confirmacion text,
  monto       numeric(14,2),
  moneda      currency,
  notas       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index att_hoteles_viaje_idx on att_hoteles (viaje_id);

create table att_restaurantes (
  id          uuid primary key default gen_random_uuid(),
  legacy_id   bigint unique,
  viaje_id    uuid not null references att_viajes(id) on delete cascade,
  nombre      text not null,
  ciudad      text,
  direccion   text,
  fecha       date,
  monto       numeric(14,2),
  moneda      currency,
  reserva     text,
  notas       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index att_restaurantes_viaje_idx on att_restaurantes (viaje_id);

create table att_pins (
  id          uuid primary key default gen_random_uuid(),
  legacy_id   bigint unique,
  viaje_id    uuid references att_viajes(id) on delete cascade,
  titulo      text,
  categoria   text,                                -- hotel / restaurante / sitio / etc.
  lat         double precision not null,
  lng         double precision not null,
  direccion   text,
  notas       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index att_pins_viaje_idx on att_pins (viaje_id);


-- ============================================================
-- supabase/migrations/20260523000008_documentos_audit.sql
-- ============================================================
-- Phase 2 - Migration 0008
-- Documentos (reemplaza los base64) y audit_log.

create table documentos (
  id            uuid primary key default gen_random_uuid(),
  legacy_id     bigint unique,
  nombre        text not null,
  tipo_mime     text,
  tamano_bytes  bigint,
  storage_path  text not null,                     -- ruta en el bucket 'documentos'
  entidad_tipo  text,                              -- nombre de la tabla
  entidad_id    uuid,                              -- id del registro
  created_at    timestamptz not null default now(),
  created_by    uuid
);
create index documentos_entidad_idx on documentos (entidad_tipo, entidad_id);

create table audit_log (
  id            uuid primary key default gen_random_uuid(),
  tabla         text not null,
  registro_id   uuid,
  accion        text not null,                     -- 'insert' | 'update' | 'delete'
  usuario_id    uuid,
  datos_antes   jsonb,
  datos_despues jsonb,
  created_at    timestamptz not null default now()
);
create index audit_log_tabla_idx     on audit_log (tabla);
create index audit_log_registro_idx  on audit_log (registro_id);
create index audit_log_created_idx   on audit_log (created_at);


-- ============================================================
-- supabase/migrations/20260523000009_storage_bucket.sql
-- ============================================================
-- Phase 2 - Migration 0009
-- Storage bucket para los documentos (reemplaza los base64 del HTML original).

insert into storage.buckets (id, name, public)
values ('documentos', 'documentos', false)
on conflict (id) do nothing;


-- ============================================================
-- supabase/migrations/20260524000001_auth_schema.sql
-- ============================================================
-- Phase 3 - Migration 0001
-- App role enum, usuarios profile table, trigger to auto-create profile,
-- helper functions auth_rol() / es_admin() / mi_miembro_id().

create type app_rol as enum ('admin','asistente','board_member','solo_lectura');

create table public.usuarios (
  id          uuid primary key references auth.users(id) on delete cascade,
  nombre      text,
  rol         app_rol not null default 'solo_lectura',
  miembro_id  uuid references public.miembros_board(id),
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index usuarios_miembro_idx on public.usuarios (miembro_id);

alter table public.usuarios enable row level security;

-- Auto-create a profile row whenever a Supabase auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.usuarios (id, nombre)
  values (new.id, new.raw_user_meta_data->>'nombre')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper: rol of the current user. SECURITY DEFINER so RLS on usuarios
-- does not block lookup, and STABLE so Postgres caches it within a query.
create or replace function public.auth_rol()
returns app_rol
language sql
stable
security definer
set search_path = public
as $$
  select rol from public.usuarios where id = auth.uid();
$$;

create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.auth_rol() = 'admin', false);
$$;

create or replace function public.mi_miembro_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select miembro_id from public.usuarios where id = auth.uid();
$$;

-- usuarios RLS: a user sees and edits their own row; admin sees all.
create policy usuarios_select on public.usuarios for select
  using ( id = auth.uid() or public.es_admin() );

create policy usuarios_self_update on public.usuarios for update
  using ( id = auth.uid() )
  with check ( id = auth.uid() and rol = (select rol from public.usuarios u where u.id = auth.uid()) );
-- ^ a user can update their own row but cannot change their own rol.

create policy usuarios_admin_all on public.usuarios for all
  using ( public.es_admin() )
  with check ( public.es_admin() );

-- Attach the updated_at trigger to usuarios (Phase 2 helper).
drop trigger if exists set_updated_at_usuarios on public.usuarios;
create trigger set_updated_at_usuarios
  before update on public.usuarios
  for each row execute function public.set_updated_at();


-- ============================================================
-- supabase/migrations/20260524000002_created_updated_by.sql
-- ============================================================
-- Phase 3 - Migration 0002
-- Activate created_by default auth.uid() on every table that has the column.
-- Add a second updated_at trigger function that also stamps updated_by.
-- Re-attach the correct trigger per table based on column presence.

-- 1) Default auth.uid() on created_by ------------------------------------
do $$
declare
  r record;
begin
  for r in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid
    where n.nspname = 'public'
      and c.relkind = 'r'
      and a.attname = 'created_by'
      and not a.attisdropped
  loop
    execute format(
      'alter table public.%I alter column created_by set default auth.uid()',
      r.relname
    );
  end loop;
end;
$$;

-- 2) Variant trigger function that also sets updated_by ------------------
create or replace function public.set_updated_at_with_by()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

-- 3) Re-create updated_at triggers, picking the variant per table -------
do $$
declare
  r record;
  trg_name text;
  has_updated_by boolean;
begin
  for r in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid
    where n.nspname = 'public'
      and c.relkind = 'r'
      and a.attname = 'updated_at'
      and not a.attisdropped
  loop
    trg_name := 'set_updated_at_' || r.relname;

    select exists (
      select 1
      from pg_attribute a2
      join pg_class c2 on c2.oid = a2.attrelid
      join pg_namespace n2 on n2.oid = c2.relnamespace
      where n2.nspname = 'public'
        and c2.relname = r.relname
        and a2.attname = 'updated_by'
        and not a2.attisdropped
    ) into has_updated_by;

    execute format('drop trigger if exists %I on public.%I', trg_name, r.relname);

    if has_updated_by then
      execute format(
        'create trigger %I before update on public.%I for each row execute function public.set_updated_at_with_by()',
        trg_name, r.relname
      );
    else
      execute format(
        'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
        trg_name, r.relname
      );
    end if;
  end loop;
end;
$$;


-- ============================================================
-- supabase/migrations/20260524000003_rls_policies.sql
-- ============================================================
-- Phase 3 - Migration 0003
-- Row Level Security policies for all tables.
-- Three patterns:
--   A) Financial    -- read: admin|asistente|solo_lectura ; write: admin|asistente
--   B) Member data  -- admin|asistente see all; board_member sees own rows
--   C) Catalog      -- read: all authenticated ; write: admin
-- Special:
--   * documentos    -- read all authenticated ; write admin|asistente
--   * audit_log     -- read admin only ; no app writes (trigger uses SECURITY DEFINER)

-- ============================================================
-- Pattern A - financial tables
-- ============================================================
do $$
declare
  t text;
  finance_tables text[] := array[
    'tc_consumos',
    'reintegros',
    'caja_chica_vales',
    'caja_chica_liquidaciones',
    'pagos',
    'vouchers'
  ];
begin
  foreach t in array finance_tables loop
    execute format(
      'create policy %I on public.%I for select using ( public.auth_rol() in (''admin'',''asistente'',''solo_lectura'') )',
      t || '_select', t
    );
    execute format(
      'create policy %I on public.%I for all using ( public.auth_rol() in (''admin'',''asistente'') ) with check ( public.auth_rol() in (''admin'',''asistente'') )',
      t || '_modify', t
    );
  end loop;
end;
$$;

-- ============================================================
-- Pattern B - member-owned tables (direct miembro_id)
-- ============================================================
do $$
declare
  t text;
  member_tables text[] := array[
    'tareas',
    'viajes',
    'eventos',
    'notas',
    'perfiles'
  ];
begin
  foreach t in array member_tables loop
    execute format(
      'create policy %I on public.%I for all
        using ( public.auth_rol() in (''admin'',''asistente'') or miembro_id = public.mi_miembro_id() )
        with check ( public.auth_rol() in (''admin'',''asistente'') or miembro_id = public.mi_miembro_id() )',
      t || '_access', t
    );
  end loop;
end;
$$;

-- ============================================================
-- Pattern B' - sub-tables, parent-driven access
-- ============================================================

-- viaje_checklist: via viajes.miembro_id
create policy viaje_checklist_access on public.viaje_checklist for all
  using (
    public.auth_rol() in ('admin','asistente')
    or exists (
      select 1 from public.viajes v
      where v.id = viaje_checklist.viaje_id
        and v.miembro_id = public.mi_miembro_id()
    )
  )
  with check (
    public.auth_rol() in ('admin','asistente')
    or exists (
      select 1 from public.viajes v
      where v.id = viaje_checklist.viaje_id
        and v.miembro_id = public.mi_miembro_id()
    )
  );

-- perfil_vehiculos / perfil_familia / perfil_fechas: via perfiles.miembro_id
do $$
declare
  t text;
  sub_perfil_tables text[] := array['perfil_vehiculos','perfil_familia','perfil_fechas'];
begin
  foreach t in array sub_perfil_tables loop
    execute format(
      'create policy %I on public.%I for all
        using (
          public.auth_rol() in (''admin'',''asistente'')
          or exists (
            select 1 from public.perfiles p
            where p.id = %I.perfil_id and p.miembro_id = public.mi_miembro_id()
          )
        )
        with check (
          public.auth_rol() in (''admin'',''asistente'')
          or exists (
            select 1 from public.perfiles p
            where p.id = %I.perfil_id and p.miembro_id = public.mi_miembro_id()
          )
        )',
      t || '_access', t, t, t
    );
  end loop;
end;
$$;

-- ============================================================
-- Pattern C - catalog tables (read all authenticated, write admin)
-- ============================================================
do $$
declare
  t text;
  catalog_tables text[] := array[
    'miembros_board',
    'empleados',
    'entidades',
    'autorizadores',
    'tipos_pago',
    'proveedores',
    'tarjetas_credito',
    'kit_items',
    'evento_religioso',
    'cea_todos',
    'firmas',
    'lavanderia',
    'cea_directorio',
    'miel_constancias',
    'att_viajes',
    'att_tickets',
    'att_hoteles',
    'att_restaurantes',
    'att_pins'
  ];
begin
  foreach t in array catalog_tables loop
    execute format(
      'create policy %I on public.%I for select using ( auth.uid() is not null )',
      t || '_read', t
    );
    execute format(
      'create policy %I on public.%I for all using ( public.es_admin() ) with check ( public.es_admin() )',
      t || '_admin_write', t
    );
  end loop;
end;
$$;

-- ============================================================
-- Special - documentos and audit_log
-- ============================================================

create policy documentos_read on public.documentos for select
  using ( auth.uid() is not null );

create policy documentos_write on public.documentos for all
  using ( public.auth_rol() in ('admin','asistente') )
  with check ( public.auth_rol() in ('admin','asistente') );

-- audit_log: only admin reads. No INSERT/UPDATE/DELETE policies, so RLS
-- blocks app writes. The audit trigger uses SECURITY DEFINER and bypasses
-- RLS as the function owner (typically postgres).
create policy audit_log_select on public.audit_log for select
  using ( public.es_admin() );


-- ============================================================
-- supabase/migrations/20260524000004_audit_triggers.sql
-- ============================================================
-- Phase 3 - Migration 0004
-- Audit trigger function and attach to the 6 financial tables.

create or replace function public.audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_id  uuid;
begin
  if TG_OP = 'INSERT' then
    v_old := null;
    v_new := to_jsonb(NEW);
    v_id  := NEW.id;
  elsif TG_OP = 'UPDATE' then
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_id  := NEW.id;
  else  -- DELETE
    v_old := to_jsonb(OLD);
    v_new := null;
    v_id  := OLD.id;
  end if;

  insert into public.audit_log
    (tabla, registro_id, accion, usuario_id, datos_antes, datos_despues)
  values
    (TG_TABLE_NAME, v_id, lower(TG_OP), auth.uid(), v_old, v_new);

  if TG_OP = 'DELETE' then
    return OLD;
  end if;
  return NEW;
end;
$$;

-- Attach to financial tables.
do $$
declare
  t text;
  trg text;
  finance_tables text[] := array[
    'tc_consumos',
    'reintegros',
    'caja_chica_vales',
    'caja_chica_liquidaciones',
    'pagos',
    'vouchers'
  ];
begin
  foreach t in array finance_tables loop
    trg := 'audit_' || t;
    execute format('drop trigger if exists %I on public.%I', trg, t);
    execute format(
      'create trigger %I after insert or update or delete on public.%I
        for each row execute function public.audit_trigger()',
      trg, t
    );
  end loop;
end;
$$;


-- ============================================================
-- supabase/migrations/20260524000005_storage_policies.sql
-- ============================================================
-- Phase 3 - Migration 0005
-- Storage policies for the 'documentos' bucket.
-- Read: any authenticated user. Write: admin or asistente only.

drop policy if exists "documentos read authenticated" on storage.objects;
drop policy if exists "documentos insert admin asistente" on storage.objects;
drop policy if exists "documentos update admin asistente" on storage.objects;
drop policy if exists "documentos delete admin asistente" on storage.objects;

create policy "documentos read authenticated"
  on storage.objects for select
  using ( bucket_id = 'documentos' and auth.uid() is not null );

create policy "documentos insert admin asistente"
  on storage.objects for insert
  with check (
    bucket_id = 'documentos'
    and public.auth_rol() in ('admin','asistente')
  );

create policy "documentos update admin asistente"
  on storage.objects for update
  using (
    bucket_id = 'documentos'
    and public.auth_rol() in ('admin','asistente')
  )
  with check (
    bucket_id = 'documentos'
    and public.auth_rol() in ('admin','asistente')
  );

create policy "documentos delete admin asistente"
  on storage.objects for delete
  using (
    bucket_id = 'documentos'
    and public.auth_rol() in ('admin','asistente')
  );


-- ============================================================
-- supabase/migrations/20260525000001_seed_miembros_board.sql
-- ============================================================
-- Phase 4 - Seed: 7 miembros del board.
-- Los nombres reales deben tomarse del HTML original. Por ahora se usa el
-- código como nombre placeholder; edita estas filas en cuanto los tengas.
-- Las políticas RLS patrón B (tareas, viajes, ...) dependen de que estos
-- registros existan para poder enlazar usuarios->miembro_id.

insert into public.miembros_board (codigo, nombre, orden) values
  ('MAA', 'MAA', 1),
  ('JA',  'JA',  2),
  ('LA',  'LA',  3),
  ('JM',  'JM',  4),
  ('AA',  'AA',  5),
  ('EG',  'EG',  6),
  ('PE',  'PE',  7)
on conflict (codigo) do nothing;


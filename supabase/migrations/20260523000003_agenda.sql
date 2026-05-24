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

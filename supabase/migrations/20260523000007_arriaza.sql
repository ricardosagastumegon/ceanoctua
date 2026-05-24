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

-- Phase 13 — Arriaza T&T detail tables
--   Mirror the original HTML's multi-item collections per ticket / hotel /
--   restaurant so users can capture full reservations as in the monolith.
--
-- New tables (8):
--   att_ticket_pax            multiple passengers per flight ticket
--   att_ticket_segments       multi-leg flight segments
--   att_ticket_pay_records    payment methods/cards for a ticket
--   att_hotel_services        extra services (transfer, breakfast, spa, …)
--   att_hotel_pay_records     payment methods/cards for a hotel stay
--   att_restaurant_diners     list of diners (covers detail)
--   att_restaurant_services   extras (wine, tip, etc.)
--   att_restaurant_pay_records payment methods/cards for a reservation

------------------------------------------------------------------
-- Tickets · pax
------------------------------------------------------------------
create table if not exists public.att_ticket_pax (
  id              uuid primary key default gen_random_uuid(),
  legacy_id       bigint unique,
  ticket_id       uuid not null references public.att_tickets(id) on delete cascade,
  tipo            text,                -- 'AD' | 'CHD' | 'INF' | 'SSA'
  nombre          text,                -- nombre completo en pasaporte
  nacionalidad    text,
  pasaporte_num   text,
  pasaporte_exp   date,
  libreta_num     text,
  visa_pais       text,
  visa_num        text,
  visa_exp        date,
  ffn             text,                -- numero frecuente
  programa        text,                -- AAdvantage, LifeMiles, etc.
  orden           int,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists att_ticket_pax_ticket_idx on public.att_ticket_pax(ticket_id);

------------------------------------------------------------------
-- Tickets · segments (multi-leg)
------------------------------------------------------------------
create table if not exists public.att_ticket_segments (
  id              uuid primary key default gen_random_uuid(),
  legacy_id       bigint unique,
  ticket_id       uuid not null references public.att_tickets(id) on delete cascade,
  direccion       text,                -- 'dep' | 'ret'
  origen_iata     text,
  origen_ciudad   text,
  destino_iata    text,
  destino_ciudad  text,
  fecha           date,
  checkin         time,
  etd             time,                -- hora salida
  eta             time,                -- hora llegada
  numero_vuelo    text,
  orden           int,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists att_ticket_segments_ticket_idx on public.att_ticket_segments(ticket_id);

------------------------------------------------------------------
-- Tickets · pay records
------------------------------------------------------------------
create table if not exists public.att_ticket_pay_records (
  id              uuid primary key default gen_random_uuid(),
  legacy_id       bigint unique,
  ticket_id       uuid not null references public.att_tickets(id) on delete cascade,
  metodo          text,                -- 'tc' | 'millas' | 'millasd' | 'puntos' | 'efectivo'
  tc_id           text,                -- '**** 1234'
  titular         text,
  autorizado_por  text,
  monto           numeric(14,2),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists att_ticket_pay_records_ticket_idx on public.att_ticket_pay_records(ticket_id);

------------------------------------------------------------------
-- Hotels · services
------------------------------------------------------------------
create table if not exists public.att_hotel_services (
  id              uuid primary key default gen_random_uuid(),
  legacy_id       bigint unique,
  hotel_id        uuid not null references public.att_hoteles(id) on delete cascade,
  nombre          text not null,       -- 'Transfer aeropuerto', 'Spa', ...
  monto           numeric(14,2) not null default 0,
  notas           text,
  orden           int,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists att_hotel_services_hotel_idx on public.att_hotel_services(hotel_id);

------------------------------------------------------------------
-- Hotels · pay records
------------------------------------------------------------------
create table if not exists public.att_hotel_pay_records (
  id              uuid primary key default gen_random_uuid(),
  legacy_id       bigint unique,
  hotel_id        uuid not null references public.att_hoteles(id) on delete cascade,
  tc_id           text,
  titular         text,
  autorizado_por  text,
  monto           numeric(14,2),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists att_hotel_pay_records_hotel_idx on public.att_hotel_pay_records(hotel_id);

------------------------------------------------------------------
-- Restaurants · diners
------------------------------------------------------------------
create table if not exists public.att_restaurant_diners (
  id              uuid primary key default gen_random_uuid(),
  legacy_id       bigint unique,
  restaurante_id  uuid not null references public.att_restaurantes(id) on delete cascade,
  nombre          text not null,
  notas           text,
  orden           int,
  created_at      timestamptz not null default now()
);
create index if not exists att_restaurant_diners_rest_idx on public.att_restaurant_diners(restaurante_id);

------------------------------------------------------------------
-- Restaurants · services
------------------------------------------------------------------
create table if not exists public.att_restaurant_services (
  id              uuid primary key default gen_random_uuid(),
  legacy_id       bigint unique,
  restaurante_id  uuid not null references public.att_restaurantes(id) on delete cascade,
  nombre          text not null,       -- 'Vinos', 'Propina', ...
  monto           numeric(14,2) not null default 0,
  orden           int,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists att_restaurant_services_rest_idx on public.att_restaurant_services(restaurante_id);

------------------------------------------------------------------
-- Restaurants · pay records
------------------------------------------------------------------
create table if not exists public.att_restaurant_pay_records (
  id              uuid primary key default gen_random_uuid(),
  legacy_id       bigint unique,
  restaurante_id  uuid not null references public.att_restaurantes(id) on delete cascade,
  tc_id           text,
  titular         text,
  autorizado_por  text,
  monto           numeric(14,2),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists att_restaurant_pay_records_rest_idx on public.att_restaurant_pay_records(restaurante_id);

------------------------------------------------------------------
-- RLS — Pattern C (read all authenticated, write admin|asistente)
------------------------------------------------------------------
do $$
declare
  t text;
  detail_tables text[] := array[
    'att_ticket_pax',
    'att_ticket_segments',
    'att_ticket_pay_records',
    'att_hotel_services',
    'att_hotel_pay_records',
    'att_restaurant_diners',
    'att_restaurant_services',
    'att_restaurant_pay_records'
  ];
begin
  foreach t in array detail_tables loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_write', t);
    execute format(
      'create policy %I on public.%I for select using (auth.uid() is not null)',
      t || '_read', t
    );
    execute format(
      'create policy %I on public.%I for all
         using (public.auth_rol() in (''admin'',''asistente''))
         with check (public.auth_rol() in (''admin'',''asistente''))',
      t || '_write', t
    );
  end loop;
end $$;

------------------------------------------------------------------
-- Helpful generated columns for totals
------------------------------------------------------------------
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='att_hoteles' and column_name='services_total'
  ) then
    -- services_total no es generated (cross-table) — se actualiza por trigger.
    alter table public.att_hoteles add column services_total numeric(14,2) default 0;
  end if;
end $$;

create or replace function public.recalc_hotel_services_total()
returns trigger language plpgsql as $$
declare
  h_id uuid;
begin
  h_id := coalesce(new.hotel_id, old.hotel_id);
  if h_id is not null then
    update public.att_hoteles
       set services_total = coalesce((
         select sum(coalesce(monto,0)) from public.att_hotel_services where hotel_id = h_id
       ), 0),
       updated_at = now()
     where id = h_id;
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists trg_recalc_hotel_services on public.att_hotel_services;
create trigger trg_recalc_hotel_services
  after insert or update or delete on public.att_hotel_services
  for each row execute function public.recalc_hotel_services_total();

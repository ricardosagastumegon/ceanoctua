-- Phase 17 (Refactor Finanzas · F-1 a F-5 · Modelo de datos completo)
-- Spec: PLAN-FINANZAS-REFACTOR.md secciones F-1 a F-5.
--
-- Cambios en esta migración:
--   * F-1 Vales: enum vale_tipo, nullable FKs (vale_a / liquidar_a)
--   * F-2 Liquidaciones: drop vale.liquidacion_id, junction
--     liquidacion_vales, tabla liquidacion_renglones, nuevos campos
--   * F-3 Reintegros: NO requiere DDL (vista de lectura sobre vales)
--   * F-4 Consumos TC: nuevos campos, consumo_renglones, tarjetas.color,
--     formato de serial {CODE}-YYYY-####
--   * F-5 Pagos: rename estado → status, status_id FK, nuevos campos,
--     tabla pagos_notificaciones (bandeja)

BEGIN;

------------------------------------------------------------------
-- F-1 · Vales
------------------------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_type where typname='vale_tipo') then
    create type vale_tipo as enum ('desembolso','entidad');
  end if;
end $$;

alter table public.caja_chica_vales
  add column if not exists tipo vale_tipo not null default 'desembolso',
  add column if not exists vale_a_empleado_id uuid references public.empleados(id),
  add column if not exists vale_a_entidad_id  uuid references public.entidades(id),
  add column if not exists liquidar_a_empleado_id uuid references public.empleados(id),
  add column if not exists liquidar_a_entidad_id  uuid references public.entidades(id);

-- Backfill desde columnas viejas (empleado_id / entidad_id) hacia los nuevos
-- nombres explícitos para tipo='desembolso'.
update public.caja_chica_vales
   set vale_a_empleado_id = empleado_id
 where vale_a_empleado_id is null and empleado_id is not null;

update public.caja_chica_vales
   set liquidar_a_entidad_id = entidad_id
 where liquidar_a_entidad_id is null and entidad_id is not null;

-- Coherencia tipo↔columnas (CHECK opcional; en producción puede generar
-- fallos si hay datos parciales, lo dejamos como NOT VALID para validar
-- manualmente después).
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'vale_tipo_coherencia'
  ) then
    alter table public.caja_chica_vales
      add constraint vale_tipo_coherencia
      check (
        (tipo = 'desembolso' and vale_a_entidad_id is null and liquidar_a_empleado_id is null)
        or
        (tipo = 'entidad' and vale_a_empleado_id is null and liquidar_a_entidad_id is null)
      ) not valid;
  end if;
end $$;

------------------------------------------------------------------
-- F-2 · Liquidaciones
------------------------------------------------------------------
-- Drop la FK errónea vale.liquidacion_id (era 1:N en vez de N:M)
alter table public.caja_chica_vales drop column if exists liquidacion_id;

-- Junction muchos-a-muchos
create table if not exists public.liquidacion_vales (
  liquidacion_id uuid not null references public.caja_chica_liquidaciones(id) on delete cascade,
  vale_id        uuid not null references public.caja_chica_vales(id)         on delete restrict,
  created_at     timestamptz not null default now(),
  primary key (liquidacion_id, vale_id)
);
create index if not exists liq_vales_liq_idx  on public.liquidacion_vales(liquidacion_id);
create index if not exists liq_vales_vale_idx on public.liquidacion_vales(vale_id);

alter table public.liquidacion_vales enable row level security;
drop policy if exists liq_vales_read on public.liquidacion_vales;
drop policy if exists liq_vales_write on public.liquidacion_vales;
create policy liq_vales_read on public.liquidacion_vales
  for select using (auth.uid() is not null);
create policy liq_vales_write on public.liquidacion_vales
  for all
  using (public.auth_rol() in ('admin','asistente'))
  with check (public.auth_rol() in ('admin','asistente'));

-- Renglones de compra (line items) — la tabla caja_chica_liq_rows ya existe
-- desde Fase 11. Esta migración la ENRIQUECE con `factura` (si falta) y
-- la deja consolidada. Mantenemos el nombre actual por compat.
alter table public.caja_chica_liq_rows
  add column if not exists factura text;

-- Campos nuevos en liquidaciones
alter table public.caja_chica_liquidaciones
  add column if not exists producto_servicio text,
  add column if not exists forma_pago text,
  add column if not exists reintegrar_a_persona_id uuid references public.personas(id),
  add column if not exists total_compras numeric(14,2),
  add column if not exists total_vales numeric(14,2);

-- diff ya es generated column (Fase 11). No tocar.
-- payment_method existente conserva los datos; forma_pago será el nuevo
-- nombre canónico. Backfill:
update public.caja_chica_liquidaciones
   set forma_pago = payment_method
 where forma_pago is null and payment_method is not null;

-- Sync de total_compras desde caja_chica_liq_rows.
create or replace function public.recalc_liq_totales()
returns trigger language plpgsql as $$
declare
  liq_id uuid;
  sum_compras numeric(14,2);
  sum_vales numeric(14,2);
begin
  liq_id := coalesce(new.liquidacion_id, old.liquidacion_id);
  if liq_id is null then return coalesce(new, old); end if;

  select coalesce(sum(coalesce(cantidad,0) * coalesce(unitario,0)), 0)
    into sum_compras
    from public.caja_chica_liq_rows
   where liquidacion_id = liq_id;

  select coalesce(sum(coalesce(v.monto, 0)), 0)
    into sum_vales
    from public.liquidacion_vales lv
    join public.caja_chica_vales v on v.id = lv.vale_id
   where lv.liquidacion_id = liq_id;

  update public.caja_chica_liquidaciones
     set total_compras = sum_compras,
         total_vales = sum_vales,
         monto_total = sum_compras,
         vale_monto = sum_vales,
         updated_at = now()
   where id = liq_id;
  return coalesce(new, old);
end $$;

drop trigger if exists trg_recalc_liq_totales_rows on public.caja_chica_liq_rows;
create trigger trg_recalc_liq_totales_rows
  after insert or update or delete on public.caja_chica_liq_rows
  for each row execute function public.recalc_liq_totales();

-- También recalcular cuando cambia la junction
create or replace function public.recalc_liq_totales_from_vales()
returns trigger language plpgsql as $$
begin
  perform public.recalc_liq_totales() from (select coalesce(new.liquidacion_id, old.liquidacion_id) as liquidacion_id) sub;
  return coalesce(new, old);
end $$;

drop trigger if exists trg_recalc_liq_totales_vales on public.liquidacion_vales;
create trigger trg_recalc_liq_totales_vales
  after insert or delete on public.liquidacion_vales
  for each row execute function public.recalc_liq_totales();

-- Trigger que cambia vale.estado → 'Asignado a Liquidación' al vincular
create or replace function public.mark_vale_as_assigned()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update public.caja_chica_vales
       set estado = 'Asignado a Liquidación'::vale_status
     where id = new.vale_id;
  elsif tg_op = 'DELETE' then
    -- Al desligar, restaurar a 'Creado'
    update public.caja_chica_vales
       set estado = 'Creado'::vale_status
     where id = old.vale_id;
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists trg_mark_vale_assigned on public.liquidacion_vales;
create trigger trg_mark_vale_assigned
  after insert or delete on public.liquidacion_vales
  for each row execute function public.mark_vale_as_assigned();

------------------------------------------------------------------
-- F-4 · Consumos TC Corp
------------------------------------------------------------------
alter table public.tc_consumos
  add column if not exists solicitado_por text,
  add column if not exists solicitado_por_id uuid,
  add column if not exists no_autorizacion text,
  add column if not exists pagado_por text,
  add column if not exists empresa_codigo text;

alter table public.tarjetas_credito
  add column if not exists color text;

-- Renglones (line items)
create table if not exists public.consumo_renglones (
  id           uuid primary key default gen_random_uuid(),
  consumo_id   uuid not null references public.tc_consumos(id) on delete cascade,
  orden        int not null,
  descripcion  text not null,
  cantidad     numeric(14,2) not null default 1,
  precio_unit  numeric(14,2) not null default 0,
  subtotal     numeric(14,2) generated always as (cantidad * precio_unit) stored,
  created_at   timestamptz not null default now()
);
create index if not exists consumo_renglones_consumo_idx on public.consumo_renglones(consumo_id);

alter table public.consumo_renglones enable row level security;
drop policy if exists consumo_renglones_read on public.consumo_renglones;
drop policy if exists consumo_renglones_write on public.consumo_renglones;
create policy consumo_renglones_read on public.consumo_renglones
  for select using (auth.uid() is not null);
create policy consumo_renglones_write on public.consumo_renglones
  for all
  using (public.auth_rol() in ('admin','asistente'))
  with check (public.auth_rol() in ('admin','asistente'));

-- Sync de monto desde renglones
create or replace function public.recalc_consumo_total()
returns trigger language plpgsql as $$
declare
  c_id uuid;
  sum_total numeric(14,2);
begin
  c_id := coalesce(new.consumo_id, old.consumo_id);
  if c_id is null then return coalesce(new, old); end if;

  select coalesce(sum(coalesce(cantidad,0) * coalesce(precio_unit,0)), 0)
    into sum_total
    from public.consumo_renglones
   where consumo_id = c_id;

  -- Solo actualizar si hay renglones; si no, deja el monto manual
  if sum_total > 0 then
    update public.tc_consumos
       set monto = sum_total,
           updated_at = now()
     where id = c_id;
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists trg_recalc_consumo_total on public.consumo_renglones;
create trigger trg_recalc_consumo_total
  after insert or update or delete on public.consumo_renglones
  for each row execute function public.recalc_consumo_total();

------------------------------------------------------------------
-- F-5 · Pagos
------------------------------------------------------------------
-- Rename estado → status (mantenemos la columna enum, solo renombramos)
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='pagos' and column_name='estado'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='pagos' and column_name='status'
  ) then
    alter table public.pagos rename column estado to status;
  end if;
end $$;

-- status_id (FK al catálogo status_solicitud_pago de Fase 16)
alter table public.pagos
  add column if not exists status_id uuid references public.status_solicitud_pago(id),
  add column if not exists tipo_cambio numeric(14,6),
  add column if not exists origen_notificacion_id uuid;

-- Backfill: mapear el enum status legacy al catálogo nuevo por nombre.
update public.pagos pg
   set status_id = ssp.id
  from public.status_solicitud_pago ssp
 where pg.status_id is null
   and pg.status::text = ssp.nombre;

-- Bandeja de notificaciones para Pagos
create table if not exists public.pagos_notificaciones (
  id            uuid primary key default gen_random_uuid(),
  origen_tipo   text not null check (origen_tipo in ('liquidacion','consumo_tc')),
  origen_id     uuid not null,
  monto         numeric(14,2),
  moneda        text,
  resumen       text,
  procesado     boolean not null default false,
  pago_id       uuid references public.pagos(id),
  created_at    timestamptz not null default now(),
  procesado_at  timestamptz
);
create index if not exists pagos_notif_pendientes_idx
  on public.pagos_notificaciones(procesado, created_at desc);

-- FK pagos.origen_notificacion_id → pagos_notificaciones
alter table public.pagos
  drop constraint if exists pagos_origen_notif_fk;
alter table public.pagos
  add constraint pagos_origen_notif_fk
  foreign key (origen_notificacion_id) references public.pagos_notificaciones(id)
  on delete set null;

alter table public.pagos_notificaciones enable row level security;
drop policy if exists pagos_notif_read on public.pagos_notificaciones;
drop policy if exists pagos_notif_write on public.pagos_notificaciones;
create policy pagos_notif_read on public.pagos_notificaciones
  for select using (auth.uid() is not null);
create policy pagos_notif_write on public.pagos_notificaciones
  for all
  using (public.auth_rol() in ('admin','asistente'))
  with check (public.auth_rol() in ('admin','asistente'));

COMMIT;

-- Forzar reload del schema cache de PostgREST. Sin esto el frontend
-- falla con "Could not find column X in schema cache" aunque el DDL
-- haya sido exitoso. Se ejecuta FUERA de la transacción.
NOTIFY pgrst, 'reload schema';
